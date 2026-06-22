import {
  findModelByProduct,
  hasAvailableFtdPackage,
  isEfisp8eModel,
  isLegacyFtdModel,
  legacyAblProvisioning,
  shouldRunPreUnlockFlashPlan,
} from "../domain/models";
import type { FlashOperation, FlashPlan, LegacyFtdModel, Manifest, SupportedModel } from "../domain/schemas";
import type { AdbClient } from "../services/adb";
import { requiredAssetPathsForPhase, type AssetPhase } from "../services/assetClient";
import { parseFastbootTerminalCommand, type FastbootClient } from "../services/fastboot";
import { toWorkflowError, WorkflowError } from "./errors";
import {
  noOverrideGatePolicy,
  isOverrideGateBypassed,
  normalizeOverrideGatePolicy,
  type AdbVersionInfo,
  type DeviceCompatibilityReport,
  type FastbootVersionInfo,
  type OverrideGateId,
  type OverrideGatePolicy,
  type PhaseId,
  type ProgressEvent,
  type WorkflowDependencies,
  type WorkflowLog,
  type WorkflowMode,
} from "./types";

const ADB_PRODUCT_PROPS = [
  "ro.product.device",
  "ro.product.vendor.device",
  "ro.product.system.device",
  "ro.product.product.device",
  "ro.product.odm.device",
  "ro.product.system_ext.device",
  "ro.build.product",
  "ro.product.mod_device",
] as const;
const ADB_VERSION_PROPS = [
  "ro.build.version.release",
  "ro.build.version.security_patch",
  "ro.build.version.incremental",
  "ro.miui.ui.version.name",
  "ro.miui.ui.version.code",
  "ro.mi.os.version.name",
  "ro.mi.os.version.code",
] as const;

type AdbProductProp = (typeof ADB_PRODUCT_PROPS)[number];
type AdbVersionProp = (typeof ADB_VERSION_PROPS)[number];

const GENERIC_ADB_PRODUCTS = new Set(["missi", "mivendor", "qssi", "generic", "unknown", "common"]);

const SECURITY_PATCH_CUTOFFS: Partial<Record<LegacyFtdModel["chip"], string>> = {
  "8E": "2026-02-01",
  "8G2": "2026-02-01",
  "8G3": "2026-02-01",
  "8SG3": "2026-02-01",
  "8SG4": "2026-02-01",
};
const EFISP_SECURITY_PATCH_CUTOFF = "2026-02-01";
const EFISP_TEMP_PATH = "/data/local/tmp/gbl_efi_unlock.efi";
const EFISP_MQSAS_COMMAND =
  "service call miui.mqsas.IMQSNative 21 i32 1 s16 'dd' i32 1 s16 'if=/data/local/tmp/gbl_efi_unlock.efi of=/dev/block/by-name/efisp' s16 '/data/mqsas/log.txt' i32 60";
const LEGACY_ABL_TEMP_PATH = "/data/local/tmp/abl";
const PAD8_PRO_ABL_TEMP_PATH = "/data/local/tmp/abl/abl.elf";

type OperationProgressState = Extract<ProgressEvent["state"], "flashing" | "booting" | "configuring">;
type FastbootProductMatch = NonNullable<FastbootVersionInfo["productMatch"]>;

type FetchProgressContext = {
  completedItems: number;
  totalItems: number;
  itemLabel?: string;
};

const logTime = () =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

const clampProgress = (value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, value));
};

export class UnlockWorkflowRunner {
  private manifest: Manifest | undefined;
  private model: SupportedModel | undefined;
  private plans = new Map<string, FlashPlan>();
  private preparedModels = new Set<string>();
  private fastboot: FastbootClient | undefined;
  private adb: AdbClient | undefined;
  private targetVerified = false;
  private exactFastbootProductVerified = false;
  private compatibilityReport: DeviceCompatibilityReport | undefined;
  private pendingAdbDetection:
    | {
        model: SupportedModel;
        product: string;
      }
    | undefined;
  private efispUnlockVerified = false;
  private workflowMode: WorkflowMode = "standard";
  private overrideGatePolicy: OverrideGatePolicy = noOverrideGatePolicy;
  private readonly deps: WorkflowDependencies;

  constructor(deps: WorkflowDependencies) {
    this.deps = deps;
    this.overrideGatePolicy = normalizeOverrideGatePolicy(deps.overrideGatePolicy);
  }

  get selectedModel() {
    return this.model;
  }

  getOverrideGatePolicy() {
    return this.overrideGatePolicy;
  }

  setOverrideGatePolicy(policy: OverrideGatePolicy = noOverrideGatePolicy) {
    this.overrideGatePolicy = normalizeOverrideGatePolicy(policy);
  }

  assumeTargetModel(model: SupportedModel) {
    this.model = model;
    this.targetVerified = true;
    this.exactFastbootProductVerified = false;
    this.pendingAdbDetection = undefined;
    this.efispUnlockVerified = false;
    this.deps.onModelDetected?.({
      model,
      fastbootProduct: model.product,
      source: "override",
      verified: false,
      provenance: "manually_assumed",
    });
    this.emitCompatibilityReport({
      modelId: model.id,
      modelName: model.name,
      product: model.product,
      chip: isLegacyFtdModel(model) ? model.chip : "8E Gen 5",
      verdict: "unknown",
      warnings: ["Developer override resume: target model is manually assumed, not device-verified."],
      fastboot: {
        product: model.product,
        verifiedWithAdb: false,
      },
    });
    this.log("warn", `Developer override resume: manually assumed ${model.name} (${model.product}).`);
  }

  overrideTargetModel(model: SupportedModel) {
    if (import.meta.env.VITE_ALLOW_TARGET_OVERRIDE !== "true") {
      throw new WorkflowError("DEV_OVERRIDE_DISABLED");
    }

    const legacyModel = this.asLegacyModel(model);
    this.model = legacyModel;
    this.targetVerified = true;
    this.exactFastbootProductVerified = true;
    this.pendingAdbDetection = undefined;
    this.deps.onModelDetected?.({
      model: legacyModel,
      fastbootProduct: legacyModel.product,
      source: "override",
      verified: true,
    });
    this.emitCompatibilityReport({
      modelId: legacyModel.id,
      modelName: legacyModel.name,
      product: legacyModel.product,
      chip: legacyModel.chip,
      verdict: "unknown",
      warnings: ["Developer override đang bỏ qua bước kiểm tra phiên bản Android/ADB."],
      fastboot: {
        product: legacyModel.product,
        verifiedWithAdb: false,
      },
    });
    this.log("warn", `Developer override target: ${legacyModel.name} (${legacyModel.product}).`);
  }

  setWorkflowMode(mode: WorkflowMode) {
    if (mode === "edl-standard") {
      if (!this.allowAdvancedEdlMode()) {
        this.log("warn", "EDL_Standard dang bi an; bat VITE_ALLOW_ADVANCED_EDL=true neu ky thuat vien can dung.");
        return;
      }

      this.workflowMode = mode;
      this.log("warn", "EDL_Standard: ABL engineering da duoc nap bang tool/manual ben ngoai; app chi chay cac buoc Fastboot sau do.");
      return;
    }

    this.workflowMode = mode;
    this.log("warn", "Workflow mode: Standard ADB/Fastboot/MQSAS.");
  }

  async disconnectSession() {
    const closeResults = await Promise.allSettled([this.adb?.close(), this.fastboot?.close()]);

    for (const result of closeResults) {
      if (result.status === "rejected") {
        this.log("warn", `Best-effort disconnect warning: ${String(result.reason)}`);
      }
    }

    this.adb = undefined;
    this.fastboot = undefined;
    this.model = undefined;
    this.pendingAdbDetection = undefined;
    this.compatibilityReport = undefined;
    this.targetVerified = false;
    this.exactFastbootProductVerified = false;
    this.efispUnlockVerified = false;
    this.plans.clear();
    this.preparedModels.clear();
    this.deps.onDeviceStatus?.("disconnected");
    this.log("info", "Da reset browser USB session. ROM cache trong IndexedDB duoc giu lai.");
  }

  async initialize() {
    try {
      this.log("info", "Dang tai manifest va bang SHA-256 tu asset server.");
      this.manifest = await this.deps.assets.loadManifest();
      await this.deps.assets.loadRootSha256();
      const legacyCount = this.manifest.models.filter(isLegacyFtdModel).length;
      const efispCount = this.manifest.models.filter(isEfisp8eModel).length;
      this.log("success", `Da tai manifest v${this.manifest.version}: ${legacyCount} legacy FTD, ${efispCount} EFISP Gen 5.`);
      return this.manifest;
    } catch (error) {
      throw toWorkflowError(error, "MANIFEST_INVALID");
    }
  }

  async connectInitialAdb() {
    this.deps.onPhaseStatus?.("connect-device", "running");

    try {
      const manifest = this.requireManifest();
      this.adb = this.deps.createAdbClient();
      this.log("info", "Mo WebUSB picker cho ADB Android.");
      await this.adb.connect();
      this.deps.onDeviceStatus?.("adb");

      const productProps = await this.readAdbProductProps();
      const candidates = this.adbProductCandidates(productProps);
      const detected = candidates
        .map((product) => ({ product, model: findModelByProduct(manifest.models, product) }))
        .find((candidate): candidate is { product: string; model: SupportedModel } => Boolean(candidate.model));

      if (!detected) {
        throw new WorkflowError(
          "UNSUPPORTED_PRODUCT",
          `ADB codename ${candidates.join(", ") || "(empty)"} khong nam trong danh sach ho tro.`,
        );
      }

      const model = detected.model;
      this.model = model;
      this.targetVerified = false;
      this.exactFastbootProductVerified = false;
      this.efispUnlockVerified = false;
      this.pendingAdbDetection = {
        model,
        product: detected.product,
      };
      this.deps.onModelDetected?.({
        model,
        adbProduct: detected.product,
        source: "adb",
        verified: false,
      });
      this.log("success", `ADB detect: ${model.name} (${detected.product}).`);
      const versionProps = await this.readAdbVersionPropsBestEffort();
      this.emitCompatibilityReport(this.buildAdbCompatibilityReport(model, detected.product, productProps, versionProps));

      if (isEfisp8eModel(model)) {
        this.assertEfispSecurityPatch(this.compatibilityReport?.adb?.securityPatch);
      }

      if (isLegacyFtdModel(model)) {
        this.assertLegacyWorkflowModeAllowed(model);
      }

      if (isLegacyFtdModel(model) && model.adbExploit) {
        this.targetVerified = true;
        this.exactFastbootProductVerified = false;
        this.pendingAdbDetection = undefined;
        this.deps.onModelDetected?.({
          model,
          adbProduct: detected.product,
          source: "adb",
          verified: true,
        });
        await this.adb.close();
        this.adb = undefined;
        this.deps.onPhaseStatus?.("connect-device", "done");
        this.log("success", `ADB verify: ${model.name} (${detected.product}) hoan tat.`);
        return model;
      }
      this.log("command", "adb reboot bootloader");
      await this.adb.rebootBootloader();
      await this.adb.close();
      this.adb = undefined;
      this.deps.onDeviceStatus?.("waiting-manual-reboot");
      this.log("warn", "May dang reboot sang Fastboot. Khi thay man Fastboot, bam Ket noi Fastboot de xac minh model.");
      return model;
    } catch (error) {
      await this.adb?.close().catch(() => undefined);
      this.adb = undefined;
      this.deps.onPhaseStatus?.("connect-device", "failed");
      const workflowError = toWorkflowError(error);
      this.log("error", workflowError.message);
      throw workflowError;
    }
  }

  async connectFastboot() {
    return this.runPhase("connect-device", async () => {
      const manifest = this.requireManifest();
      this.fastboot = this.deps.createFastbootClient();
      this.log("info", "Mo WebUSB picker cho Fastboot.");
      await this.fastboot.connect();
      this.deps.onDeviceStatus?.("fastboot");
      this.log("command", "fastboot getvar product");
      const product = await this.fastboot.getvar("product");
      this.log("command", "fastboot getvar serialno");
      const serial = await this.readFastbootSerial(this.fastboot, false);
      const anti = await this.readFastbootAnti(this.fastboot);

      if (this.pendingAdbDetection) {
        const pending = this.pendingAdbDetection;

        if (!product.trim()) {
          throw new WorkflowError("WRONG_PRODUCT", `Fastboot product empty, can khop ADB codename ${pending.product}.`);
        }

        if (product.trim().toLowerCase() !== pending.model.product.toLowerCase()) {
          this.emitFastbootCompatibility(product, serial, anti, false, [
            `ADB codename ${pending.product} không khớp Fastboot product ${product || "(empty)"}.`,
          ]);
          throw new WorkflowError(
            "WRONG_PRODUCT",
            `ADB codename ${pending.product} nhung Fastboot product ${product}; dung de tranh sai may.`,
          );
        }

        if (isLegacyFtdModel(pending.model)) {
          this.assertLegacyWorkflowModeAllowed(pending.model);
        }

        this.model = pending.model;
        this.targetVerified = true;
        this.exactFastbootProductVerified = true;
        this.pendingAdbDetection = undefined;
        this.deps.onModelDetected?.({
          model: pending.model,
          adbProduct: pending.product,
          fastbootProduct: product,
          fastbootSerial: serial || undefined,
          source: "verified",
          verified: true,
        });
        this.emitFastbootCompatibility(product, serial, anti, true);
        this.log("success", `ADB/Fastboot da khop: ${pending.model.name} (${product}).`);
        return pending.model;
      }

      const model = findModelByProduct(manifest.models, product);

      if (!model) {
        throw new WorkflowError("UNSUPPORTED_PRODUCT", `Codename ${product || "(empty)"} khong nam trong danh sach ho tro.`);
      }

      if (isEfisp8eModel(model)) {
        this.emitCompatibilityReport(this.buildFastbootOnlyCompatibilityReport(model, product, serial, anti));
        throw new WorkflowError(
          "ADB_REQUIRED",
          "EFISP 8E Gen 5 bat buoc ket noi Android/ADB truoc de xac minh USB debugging va security patch.",
        );
      }

      const legacyModel = this.asLegacyModel(model);

      this.assertLegacyWorkflowModeAllowed(legacyModel);

      if (!this.allowDirectFastboot()) {
        this.emitCompatibilityReport(this.buildFastbootOnlyCompatibilityReport(legacyModel, product, serial, anti));
        throw new WorkflowError(
          "ADB_REQUIRED",
          "Hãy kết nối máy ở Android/ADB trước để kiểm tra phiên bản rồi app sẽ reboot sang Fastboot.",
        );
      }

      this.model = legacyModel;
      this.targetVerified = true;
      this.exactFastbootProductVerified = true;
      this.deps.onModelDetected?.({
        model: legacyModel,
        fastbootProduct: product,
        fastbootSerial: serial || undefined,
        source: "fastboot",
        verified: true,
      });
      this.emitCompatibilityReport(this.buildFastbootOnlyCompatibilityReport(legacyModel, product, serial, anti));
      this.log("success", `Da khoa model: ${legacyModel.name} (${legacyModel.product}).`);
      return legacyModel;
    });
  }

  async runFastbootTerminalCommand(input: string, confirmed = false) {
    try {
      const command = parseFastbootTerminalCommand(input);
      const fastboot = await this.ensureFastbootForModel();

      this.log("command", command.display);

      if (command.kind === "devices") {
        const serial = await this.readFastbootSerial(fastboot, true);
        return `${serial || "(unknown)"}\tfastboot`;
      }

      if (command.kind === "getvar") {
        const value = await fastboot.getvar(command.name);
        this.log("success", `${command.name}=${value || "(empty)"}`);
        return value;
      }

      const isDestructive =
        command.kind === "erase" || command.kind === "setActive" || command.kind === "raw";

      if (isDestructive) {
        this.requireConfirmation(confirmed);
        const model = this.requireModel();
        await this.assertFastbootProduct(fastboot, model);
      }

      if (command.kind === "erase") {
        await fastboot.erase(command.partition);
        this.log("success", `Erased ${command.partition}`);
        return "";
      }

      if (command.kind === "setActive") {
        await fastboot.setActive(command.slot);
        this.log("success", `Active slot ${command.slot}`);
        return "";
      }

      if (command.kind === "reboot") {
        await fastboot.reboot(command.target);
        this.deps.onDeviceStatus?.("waiting-manual-reboot");
        this.log("success", "Reboot command sent");
        return "";
      }

      const output = await fastboot.runRaw(command.protocolCommand);

      if (output) {
        this.log("info", output);
      }

      this.log("success", "Fastboot command OKAY");
      return output;
    } catch (error) {
      const workflowError = toWorkflowError(error);
      this.log("error", workflowError.message);
      throw workflowError;
    }
  }

  async prepareAssetsForSelectedModel() {
    return this.runPhase("prepare-assets", async () => {
      const model = this.requireModel();
      this.requireVerifiedTarget();

      if (this.isGateBypassed("asset_verification")) {
        this.logGateBypass("asset_verification", `Asset preparation for ${model.name} was skipped; later file reads still require real prepared blobs.`);
        return;
      }

      const plan = isLegacyFtdModel(model) && shouldRunPreUnlockFlashPlan(model)
        ? await this.loadPlanForModel(model)
        : ({ modelId: model.id, product: model.product, operations: [] } satisfies FlashPlan);

      this.log("info", `Preparing verified assets for ${model.name}.`);
      await this.deps.assets.prepareModelAssets(model, plan, (event) => {
        this.deps.onProgress?.(event);
      });
      this.preparedModels.add(model.id);
      this.log("success", `Assets for ${model.name} are verified and ready in browser cache.`);
    });
  }

  async bootEfispPermissive(confirmed: boolean) {
    return this.runPhase("boot-permissive", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireEfispModel();
      this.requireVerifiedTarget();
      await this.ensureAssetsForPhase("write-efisp", model);
      const fastboot = await this.ensureFastbootForModel();
      await this.assertFastbootProduct(fastboot, model);

      this.log("command", "fastboot oem set-gpu-preemption-value 0 androidboot.selinux=permissive");
      await fastboot.runRaw("oem set-gpu-preemption-value 0 androidboot.selinux=permissive");
      this.log("success", "Fastboot da chap nhan tham so Android SELinux permissive.");

      this.log("command", "fastboot continue");
      await fastboot.runRaw("continue");
      await fastboot.close().catch(() => undefined);
      this.fastboot = undefined;
      this.deps.onDeviceStatus?.("waiting-manual-reboot");
      this.log("warn", "May dang boot Android permissive. Cho Android len va giu cap USB de ket noi lai ADB.");
    });
  }

  async writeEfispUnlock(confirmed: boolean) {
    return this.runPhase("write-efisp", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireEfispModel();
      this.requireVerifiedTarget();
      await this.ensureAssetsForPhase("write-efisp", model);
      await this.adb?.close().catch(() => undefined);
      this.adb = this.deps.createAdbClient();

      try {
        this.log("info", "Mo WebUSB picker de reconnect ADB Android permissive.");
        await this.adb.connect();
        this.deps.onDeviceStatus?.("adb");
        const productProps = await this.readAdbProductProps();
        const candidates = this.adbProductCandidates(productProps);

        if (!candidates.some((product) => product.toLowerCase() === model.product.toLowerCase())) {
          throw new WorkflowError(
            "WRONG_PRODUCT",
            `ADB reconnect ${candidates.join(", ") || "(empty)"} khong khop EFISP target ${model.product}.`,
          );
        }

        const versionProps = await this.readAdbVersionPropsBestEffort();
        const adbInfo = this.toAdbVersionInfo(productProps, versionProps);
        this.assertEfispSecurityPatch(adbInfo.securityPatch);

        const blob = await this.fetch(model.efispUnlockFile, "Doc EFI unlock da verify tu browser cache", {
          completedItems: 0,
          totalItems: 2,
          itemLabel: "gbl_efi_unlock.efi",
        });
        this.emitOperationProgress("Push EFI unlock", 0, "flashing", 0, 2, EFISP_TEMP_PATH);
        this.log("command", `adb push ${model.efispUnlockFile} ${EFISP_TEMP_PATH}`);
        await this.adb.push(EFISP_TEMP_PATH, blob);
        this.emitOperationProgress("Push EFI unlock", 1, "flashing", 0, 2, EFISP_TEMP_PATH);

        this.emitOperationProgress("MQSAS write efisp", 0, "flashing", 1, 2, "MQSAS dd -> efisp");
        const result = await this.shell(EFISP_MQSAS_COMMAND);
        const output = `${result.stdout}\n${result.stderr}`.trim();

        if (/permission denied|not permitted|denied/i.test(output) || !/result\s*:/i.test(output)) {
          throw new WorkflowError(
            "SELINUX_NOT_PERMISSIVE",
            `MQSAS khong tra ve Result hop le khi ghi efisp: ${output || "(empty)"}.`,
          );
        }

        this.emitOperationProgress("MQSAS write efisp", 1, "flashing", 1, 2, "MQSAS dd -> efisp");
        this.log("success", "MQSAS da tra ve Result sau lenh ghi efisp.");
        this.log("command", "adb reboot bootloader");
        await this.adb.rebootBootloader();
        await this.adb.close();
        this.adb = undefined;
        this.efispUnlockVerified = false;
        this.deps.onDeviceStatus?.("waiting-manual-reboot");
        this.log("warn", "May dang reboot Fastboot de kiem tra trang thai unlocked.");
      } catch (error) {
        await this.adb?.close().catch(() => undefined);
        this.adb = undefined;
        throw error;
      }
    });
  }

  async verifyEfispUnlock() {
    return this.runPhase("verify-unlock", async () => {
      const model = this.requireEfispModel();
      this.requireVerifiedTarget();
      const fastboot = await this.ensureFastbootForModel();
      await this.assertFastbootProduct(fastboot, model);
      if (this.isGateBypassed("efisp_unlock_verification")) {
        this.efispUnlockVerified = false;
        this.logGateBypass("efisp_unlock_verification", "Fastboot unlocked state was not verified.");
        return;
      }
      await this.assertEfispUnlocked(fastboot);
      this.efispUnlockVerified = true;
      this.log("success", "Da xac minh Fastboot unlocked: yes. Cleanup duoc phep chay.");
    });
  }

  async cleanupEfispData(confirmed: boolean) {
    return this.runPhase("cleanup-data", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireEfispModel();
      this.requireVerifiedTarget();

      if (!this.efispUnlockVerified) {
        if (!this.isGateBypassed("efisp_unlock_verification")) {
          throw new WorkflowError("UNLOCK_NOT_VERIFIED");
        }
        this.logGateBypass("efisp_unlock_verification", "Cleanup is proceeding without a verified unlocked: yes gate.");
      }

      const fastboot = await this.ensureFastbootForModel();
      await this.assertFastbootProduct(fastboot, model);
      if (!this.isGateBypassed("efisp_unlock_verification")) {
        await this.assertEfispUnlocked(fastboot);
      }
      const partitions = ["efisp", "metadata", "userdata"] as const;

      for (const [index, partition] of partitions.entries()) {
        const label = `Erase ${partition}`;
        this.emitOperationProgress(label, 0, "configuring", index, partitions.length, label);
        this.log("command", `fastboot erase ${partition}`);
        await fastboot.erase(partition);
        this.emitOperationProgress(label, 1, "configuring", index, partitions.length, label);
        this.log("success", `Erased ${partition}`);
      }

      this.log("success", "EFISP cleanup hoan tat sau khi da verify unlocked: yes.");
    });
  }

  async bootLegacyAblPermissive(confirmed: boolean) {
    return this.runPhase("boot-permissive", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireLegacyModel();
      this.requireVerifiedTarget();
      this.requireMqsasProvisioning(model);
      const fastboot = await this.ensureFastbootForModel();
      await this.assertFastbootProduct(fastboot, model);

      this.log("command", "fastboot oem set-gpu-preemption 0 androidboot.selinux=permissive");
      await fastboot.runRaw("oem set-gpu-preemption 0 androidboot.selinux=permissive");
      this.log("success", "Fastboot da chap nhan tham so Android SELinux permissive.");

      this.log("command", "fastboot continue || fastboot reboot");
      try {
        await fastboot.runRaw("continue");
      } catch (error) {
        this.log("warn", `fastboot continue that bai, thu fastboot reboot: ${toWorkflowError(error).message}`);
        await fastboot.reboot();
      }

      await fastboot.close().catch(() => undefined);
      this.fastboot = undefined;
      this.deps.onDeviceStatus?.("waiting-manual-reboot");
      this.log("warn", "May dang boot Android permissive. Khi Android len, chon tiep buoc ghi ABL qua MQSAS.");
    });
  }

  async writeLegacyAblViaMqsas(confirmed: boolean) {
    return this.runPhase("write-abl", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireLegacyModel();
      this.requireVerifiedTarget();
      this.requireMqsasProvisioning(model);
      await this.ensureAssetsForPhase("write-abl", model);
      await this.adb?.close().catch(() => undefined);
      this.adb = this.deps.createAdbClient();

      try {
        this.log("info", "Mo WebUSB picker de reconnect ADB Android permissive.");
        await this.adb.connect();
        this.deps.onDeviceStatus?.("adb");
        const candidates = await this.readAdbProductCandidates();

        if (!candidates.some((product) => product.toLowerCase() === model.product.toLowerCase())) {
          throw new WorkflowError(
            "WRONG_PRODUCT",
            `ADB reconnect ${candidates.join(", ") || "(empty)"} khong khop target ${model.product}.`,
          );
        }

        const selinux = (await this.shell("getenforce")).stdout.trim();

        if (!/permissive/i.test(selinux)) {
          throw new WorkflowError("SELINUX_NOT_PERMISSIVE", `getenforce=${selinux || "(empty)"}; chua duoc Permissive.`);
        }

        this.log("success", "SELinux Permissive OK.");
        const ablPath = this.legacyAblTempPath(model);
        const ablBlob = await this.fetch(model.ablFile, "Doc engineering ABL da verify tu browser cache", {
          completedItems: 0,
          totalItems: 4,
          itemLabel: model.ablFile,
        });

        if (ablPath === PAD8_PRO_ABL_TEMP_PATH) {
          await this.shell("mkdir -p /data/local/tmp/abl");
        }

        this.emitOperationProgress("Push engineering ABL", 0, "flashing", 0, 4, ablPath);
        this.log("command", `adb push ${model.ablFile} ${ablPath}`);
        await this.adb.push(ablPath, ablBlob);
        this.emitOperationProgress("Push engineering ABL", 1, "flashing", 0, 4, ablPath);

        await this.writeLegacyAblSlot("a", ablPath, 1, 4);
        await this.writeLegacyAblSlot("b", ablPath, 2, 4);

        this.emitOperationProgress("Reboot bootloader", 0, "configuring", 3, 4, "adb reboot bootloader");
        this.log("command", "adb reboot bootloader");
        await this.adb.rebootBootloader();
        this.emitOperationProgress("Reboot bootloader", 1, "configuring", 3, 4, "adb reboot bootloader");
        await this.adb.close();
        this.adb = undefined;
        this.deps.onDeviceStatus?.("waiting-manual-reboot");
        this.log("warn", "Da ghi ABL engineering. Khi may vao Fastboot, tiep tuc buoc ke tiep.");
      } catch (error) {
        await this.adb?.close().catch(() => undefined);
        this.adb = undefined;
        throw error;
      }
    });
  }

  async rebootAdbToBootloaderForSelectedModel() {
    const model = this.requireLegacyModel();
    this.requireVerifiedTarget();

    await this.adb?.close().catch(() => undefined);
    this.adb = this.deps.createAdbClient();

    try {
      this.log("info", "Mo WebUSB picker cho ADB Android de reboot bootloader.");
      await this.adb.connect();
      this.deps.onDeviceStatus?.("adb");

      const candidates = await this.readAdbProductCandidates();
      const matched = candidates.some((product) => product.toLowerCase() === model.product.toLowerCase());

      if (!matched) {
        throw new WorkflowError(
          "WRONG_PRODUCT",
          `ADB codename ${candidates.join(", ") || "(empty)"} khong khop model da khoa ${model.product}.`,
        );
      }

      this.log("success", `ADB da khop model da khoa: ${model.name} (${model.product}).`);
      this.log("command", "adb reboot bootloader");
      await this.adb.rebootBootloader();
      await this.adb.close();
      this.adb = undefined;
      this.deps.onDeviceStatus?.("waiting-manual-reboot");
      this.log("warn", "May dang reboot sang Fastboot. Khi thay man Fastboot, bam nut chinh de chay tiep buoc hien tai.");
    } catch (error) {
      await this.adb?.close().catch(() => undefined);
      this.adb = undefined;
      const workflowError = toWorkflowError(error);
      this.log("error", workflowError.message);
      throw workflowError;
    }
  }

  async flashFtdPackage(confirmed: boolean) {
    return this.runPhase("flash-ftd", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireLegacyModel();
      this.assertLegacyWorkflowModeAllowed(model);

      if (!shouldRunPreUnlockFlashPlan(model)) {
        throw new WorkflowError("UNSUPPORTED_PRODUCT", `${model.name} khong chay Flash FTD trong flow standard theo batch.`);
      }

      this.requireFtdPackageAvailable(model);

      if (legacyAblProvisioning(model) === "adb-exploit-root" && model.adbExploit) {
        await this.runAdbExploitWorkflow(model);
      }

      const fastboot = await this.ensureFastbootForModel();

      await this.assertFastbootProduct(fastboot, model);
      await this.verifyAblEngineeringProbe(fastboot);
      await this.ensureAssetsForPhase("flash-ftd", model);
      const plan = await this.loadPlanForModel(model);
      const totalOperations = plan.operations.length;
      await this.runAntirollbackCheck(plan, fastboot, model);

      for (const [index, operation] of plan.operations.entries()) {
        await this.runFlashOperation(operation, fastboot, model, index + 1, totalOperations);
      }

      this.deps.onDeviceStatus?.("waiting-manual-reboot");
      this.log("warn", "Neu may vao man hinh den/xanh, giu Power + Volume Down de ve Fastboot.");
    });
  }

  private async verifyAblEngineeringProbe(fastboot: FastbootClient) {
    this.log("command", "fastboot erase frp");

    try {
      await fastboot.erase("frp");
    } catch (error) {
      throw new WorkflowError(
        "ABL_PROBE_FAILED",
        "fastboot erase frp failed; ABL engineering/parcel chua hoat dong hoac Fastboot chua dung trang thai.",
        error,
      );
    }

    this.log("success", "ABL engineering OK: erase frp thanh cong.");
  }

  private assertLegacyWorkflowModeAllowed(model: LegacyFtdModel) {
    if (legacyAblProvisioning(model) !== "manual-external") {
      return;
    }

    if (this.workflowMode === "edl-standard" && this.allowAdvancedEdlMode()) {
      return;
    }

    throw new WorkflowError(
      "ADB_REQUIRED",
      `${model.name} can ABL engineering duoc nap bang tool/manual ben ngoai; bat EDL_Standard advanced roi moi chay cac buoc Fastboot.`,
    );
  }

  private requireMqsasProvisioning(model: LegacyFtdModel) {
    if (legacyAblProvisioning(model) !== "mqsas-permissive") {
      throw new WorkflowError("UNSUPPORTED_PRODUCT", `${model.name} khong dung flow ABL MQSAS.`);
    }
  }

  private legacyAblTempPath(model: LegacyFtdModel) {
    return model.id === "xiaomi-pad8pro" ? PAD8_PRO_ABL_TEMP_PATH : LEGACY_ABL_TEMP_PATH;
  }

  private async writeLegacyAblSlot(slot: "a" | "b", ablPath: string, completedBefore: number, totalItems: number) {
    const label = `MQSAS write abl_${slot}`;
    const command =
      `service call miui.mqsas.IMQSNative 21 i32 1 s16 "dd" i32 1 ` +
      `s16 'if=${ablPath} of=/dev/block/by-name/abl_${slot}' s16 '/data/mqsas/log.txt' i32 60`;
    this.emitOperationProgress(label, 0, "flashing", completedBefore, totalItems, label);
    const result = await this.shell(command);
    this.assertMqsasResult(result.stdout, result.stderr, `abl_${slot}`);
    this.emitOperationProgress(label, 1, "flashing", completedBefore, totalItems, label);
    this.log("success", `MQSAS da ghi abl_${slot}.`);
  }

  private assertMqsasResult(stdout: string, stderr: string, label: string) {
    const output = `${stdout}\n${stderr}`.trim();

    if (/permission denied|not permitted|denied/i.test(output) || !/result\s*:/i.test(output)) {
      throw new WorkflowError("SELINUX_NOT_PERMISSIVE", `MQSAS khong tra ve Result hop le khi ghi ${label}: ${output || "(empty)"}.`);
    }
  }

  async runUnlockPayload(confirmed: boolean) {
    return this.runPhase("unlock-payload", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireLegacyModel();
      await this.ensureAssetsForPhase("unlock-payload", model);
      const fastboot = await this.ensureFastbootForModel();
      await this.assertFastbootProduct(fastboot, model, { allowPostAblAlias: true, phase: "unlock-payload" });
      const totalOperations = 3;
      const payloadPath = model.unlock.payloadFile ?? model.unlock.gptBoth4;
      const enneaPath = model.unlock.enneaFile ?? model.unlock.bootImage;

      this.log("command", `fastboot flash partition:4 ${payloadPath}`);
      const payload = await this.fetch(payloadPath, "Tai unlock payload", {
        completedItems: 0,
        totalItems: totalOperations,
        itemLabel: "Tai unlock payload",
      });
      this.emitOperationProgress("Flash partition:4", 0, "flashing", 0, totalOperations, "Flash partition:4");
      await fastboot.flash("partition:4", payload, (progress) =>
        this.emitOperationProgress("Flash partition:4", progress, "flashing", 0, totalOperations, "Flash partition:4"),
      );
      this.emitOperationProgress("Flash partition:4", 1, "flashing", 0, totalOperations, "Flash partition:4");
      this.log("success", "Da nap unlock payload vao partition:4.");

      this.log("info", "Cho 5s sau khi nap unlock payload truoc khi boot Ennea.");
      await new Promise((r) => setTimeout(r, 5000));

      this.log("command", `fastboot boot ${enneaPath}`);
      const ennea = await this.fetch(enneaPath, "Tai Ennea image", {
        completedItems: 1,
        totalItems: totalOperations,
        itemLabel: "Tai Ennea image",
      });
      this.emitOperationProgress("Boot Ennea", 0, "booting", 1, totalOperations, "Boot Ennea");
      await fastboot.boot(ennea, (progress) =>
        this.emitOperationProgress("Boot Ennea", progress, "booting", 1, totalOperations, "Boot Ennea"),
      );
      this.emitOperationProgress("Boot Ennea", 1, "booting", 1, totalOperations, "Boot Ennea");

      this.log("command", "fastboot reboot bootloader");
      this.emitOperationProgress("Reboot bootloader", 0, "configuring", 2, totalOperations, "fastboot reboot bootloader");
      await fastboot.reboot("bootloader");
      this.emitOperationProgress("Reboot bootloader", 1, "configuring", 2, totalOperations, "fastboot reboot bootloader");
      this.deps.onDeviceStatus?.("waiting-manual-reboot");
      this.log("warn", "May dang reboot lai Fastboot sau Ennea; khi thay man Fastboot, chay tiep buoc khoi phuc GPT.");
    });
  }

  async restoreFinalGpt(confirmed: boolean) {
    return this.runPhase("restore-gpt", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireLegacyModel();
      await this.ensureAssetsForPhase("restore-gpt", model);
      const fastboot = await this.ensureFastbootForModel();
      await this.assertFastbootProduct(fastboot, model, { allowPostAblAlias: true, phase: "restore-gpt" });

      if (model.unlock.finalGptFile) {
        const totalOperations = 2;
        this.log("command", `fastboot flash partition:4 ${model.unlock.finalGptFile}`);
        const blob = await this.fetch(model.unlock.finalGptFile, "Tai GPT cuoi", {
          completedItems: 0,
          totalItems: totalOperations,
          itemLabel: "Tai GPT cuoi",
        });
        this.emitOperationProgress("Flash partition:4", 0, "flashing", 0, totalOperations, "Flash partition:4");
        await fastboot.flash("partition:4", blob, (progress) =>
          this.emitOperationProgress("Flash partition:4", progress, "flashing", 0, totalOperations, "Flash partition:4"),
        );
        this.emitOperationProgress("Flash partition:4", 1, "flashing", 0, totalOperations, "Flash partition:4");

        this.log("command", "fastboot reboot bootloader");
        this.emitOperationProgress("Reboot bootloader", 0, "configuring", 1, totalOperations, "fastboot reboot bootloader");
        await fastboot.reboot("bootloader");
        this.emitOperationProgress("Reboot bootloader", 1, "configuring", 1, totalOperations, "fastboot reboot bootloader");
        this.deps.onDeviceStatus?.("fastboot");
        this.log("success", "Hoan tat GPT cuoi. Mo MiFlash, chon ROM goc dung model, chon Clean All.");
        return;
      }

      const totalOperations = model.finalGpt.length + 1;

      for (const [index, file] of model.finalGpt.entries()) {
        this.log("command", `fastboot flash partition:${index} ${file}`);
        const itemLabel = `Flash GPT ${index}`;
        const blob = await this.fetch(file, `Tai GPT ${index}`, {
          completedItems: index,
          totalItems: totalOperations,
          itemLabel: `Tai GPT ${index}`,
        });
        this.emitOperationProgress(itemLabel, 0, "flashing", index, totalOperations, itemLabel);
        await fastboot.flash(`partition:${index}`, blob, (progress) =>
          this.emitOperationProgress(itemLabel, progress, "flashing", index, totalOperations, itemLabel),
        );
        this.emitOperationProgress(itemLabel, 1, "flashing", index, totalOperations, itemLabel);
      }

      this.log("command", "fastboot reboot bootloader");
      this.emitOperationProgress(
        "Reboot bootloader",
        0,
        "configuring",
        model.finalGpt.length,
        totalOperations,
        "fastboot reboot bootloader",
      );
      await fastboot.reboot("bootloader");
      this.emitOperationProgress(
        "Reboot bootloader",
        1,
        "configuring",
        model.finalGpt.length,
        totalOperations,
        "fastboot reboot bootloader",
      );
      this.deps.onDeviceStatus?.("fastboot");
      this.log("success", "Hoan tat GPT cuoi. Mo MiFlash, chon ROM goc dung model, chon Clean All.");
    });
  }

  async verifyLegacyUnlock() {
    return this.runPhase("verify-unlock", async () => {
      const model = this.requireLegacyModel();
      this.requireVerifiedTarget();
      const fastboot = await this.ensureFastbootForModel();
      await this.assertFastbootProduct(fastboot, model, { allowPostAblAlias: true, phase: "verify-unlock" });

      this.log("command", "fastboot oem device-info");
      const deviceInfo = await fastboot.runRaw("oem device-info");

      if (!/Device unlocked:\s*true/i.test(deviceInfo)) {
        throw new WorkflowError(
          "UNLOCK_NOT_VERIFIED",
          `fastboot oem device-info chua bao Device unlocked: true: ${deviceInfo || "(empty)"}.`,
        );
      }

      this.log("success", "Bootloader unlocked: true.");
      await this.verifyAblEngineeringProbe(fastboot);
      this.log("success", "BL/FRP verify hoan tat. Co the flash ROM goc bang MiFlash Clean All.");
    });
  }

  private async loadPlanForModel(model: LegacyFtdModel) {
    this.requireFtdPackageAvailable(model);

    const cachedPlan = this.plans.get(model.id);

    if (cachedPlan) {
      return cachedPlan;
    }

    await this.deps.assets.loadPackageSha256(model.ftdPackage);
    const plan = await this.deps.assets.loadFlashPlan(model.ftdPackage);

    if (plan.product.toLowerCase() !== model.product.toLowerCase()) {
      throw new WorkflowError("WRONG_PRODUCT", `Product trong plan ${plan.product} khong khop ${model.product}.`);
    }

    this.plans.set(model.id, plan);
    return plan;
  }

  private async runFlashOperation(
    operation: FlashOperation,
    fastboot: FastbootClient,
    model: LegacyFtdModel,
    index: number,
    total: number,
  ) {
    const prefix = `[${index}/${total}]`;
    const completedBefore = index - 1;

    if (operation.type === "getvar") {
      const itemLabel = `${prefix} getvar ${operation.name}`;
      this.emitOperationProgress(itemLabel, 0, "configuring", completedBefore, total, itemLabel);
      this.log("command", `fastboot getvar ${operation.name}`);
      const actual = await fastboot.getvar(operation.name);

      if (operation.expect && actual.toLowerCase() !== operation.expect.toLowerCase()) {
        if (this.isGateBypassed("fastboot_product") && operation.name.toLowerCase() === "product") {
          this.logGateBypass("fastboot_product", `${operation.name}=${actual || "(empty)"} did not match ${operation.expect}.`);
          this.emitOperationProgress(itemLabel, 1, "configuring", completedBefore, total, itemLabel);
          return;
        }
        throw new WorkflowError("WRONG_PRODUCT", `${operation.name}=${actual || "(empty)"} khong khop ${operation.expect}.`);
      }

      this.log("success", `${prefix} ${operation.name}=${actual || "(empty)"}`);
      this.emitOperationProgress(itemLabel, 1, "configuring", completedBefore, total, itemLabel);
      return;
    }

    if (operation.type === "erase") {
      const itemLabel = `${prefix} erase ${operation.partition}`;
      this.emitOperationProgress(itemLabel, 0, "configuring", completedBefore, total, itemLabel);
      this.log("command", `fastboot erase ${operation.partition}`);
      await fastboot.erase(operation.partition);
      this.log("success", `${prefix} Erased ${operation.partition}`);
      this.emitOperationProgress(itemLabel, 1, "configuring", completedBefore, total, itemLabel);
      return;
    }

    if (operation.type === "flash") {
      const path = `${model.ftdPackage}/${operation.file}`;
      const itemLabel = `${prefix} Flash ${operation.partition}`;
      this.log("command", `fastboot flash ${operation.partition} ${path}`);
      const blob = await this.fetch(path, `${prefix} Tai ${operation.file}`, {
        completedItems: completedBefore,
        totalItems: total,
        itemLabel: `${prefix} Tai ${operation.file}`,
      });
      this.emitOperationProgress(itemLabel, 0, "flashing", completedBefore, total, itemLabel);
      await fastboot.flash(operation.partition, blob, (progress) =>
        this.emitOperationProgress(itemLabel, progress, "flashing", completedBefore, total, itemLabel),
      );
      this.emitOperationProgress(itemLabel, 1, "flashing", completedBefore, total, itemLabel);
      this.log("success", `${prefix} Flashed ${operation.partition}`);
      return;
    }

    if (operation.type === "set_active") {
      const itemLabel = `${prefix} set_active ${operation.slot}`;
      this.emitOperationProgress(itemLabel, 0, "configuring", completedBefore, total, itemLabel);
      this.log("command", `fastboot set_active ${operation.slot}`);
      await fastboot.setActive(operation.slot);
      this.log("success", `${prefix} Active slot ${operation.slot}`);
      this.emitOperationProgress(itemLabel, 1, "configuring", completedBefore, total, itemLabel);
      return;
    }

    const itemLabel = operation.target ? `${prefix} reboot ${operation.target}` : `${prefix} reboot`;
    this.emitOperationProgress(itemLabel, 0, "configuring", completedBefore, total, itemLabel);
    this.log("command", operation.target ? `fastboot reboot ${operation.target}` : "fastboot reboot");
    await fastboot.reboot(operation.target);
    this.log("success", `${prefix} Reboot command sent`);
    this.emitOperationProgress(itemLabel, 1, "configuring", completedBefore, total, itemLabel);
  }

  private async runAntirollbackCheck(plan: FlashPlan, fastboot: FastbootClient, model: LegacyFtdModel) {
    if (!plan.antiRollbackFile) {
      return;
    }

    if (this.isGateBypassed("antirollback")) {
      this.logGateBypass("antirollback", "Device antirollback was not compared with package anti_version.txt.");
      return;
    }

    const antiBlob = await this.fetch(`${model.ftdPackage}/${plan.antiRollbackFile}`, "Tai anti_version.txt");
    const packageAnti = Number((await antiBlob.text()).trim() || "0");
    this.log("command", "fastboot getvar anti");
    const deviceAnti = Number((await fastboot.getvar("anti")) || "0");

    if (deviceAnti > packageAnti) {
      throw new WorkflowError("ANTIROLLBACK_FAILED", `anti device=${deviceAnti}, package=${packageAnti}; dung flash.`);
    }

    this.log("success", `Antirollback OK: device=${deviceAnti}, package=${packageAnti}.`);
  }

  private async assertFastbootProduct(
    fastboot: FastbootClient,
    model: SupportedModel,
    options: { allowPostAblAlias?: boolean; phase?: PhaseId } = {},
  ) {
    this.log("command", "fastboot getvar product");
    const product = (await fastboot.getvar("product")).trim();

    if (this.isGateBypassed("fastboot_product")) {
      this.emitFastbootCompatibility(product, "", undefined, false, [
        `Fastboot product gate bypassed for target ${model.product}; device returned ${product || "(empty)"}.`,
      ]);
      this.logGateBypass("fastboot_product", `Device returned ${product || "(empty)"} while target is ${model.product}.`);
      return;
    }

    if (product.toLowerCase() !== model.product.toLowerCase()) {
      if (this.canAcceptPostAblFastbootAlias(model, product, Boolean(options.allowPostAblAlias))) {
        this.emitFastbootProductCheck(model, product, "post-abl-alias");
        this.log(
          "warn",
          `Fastboot dang tra ${product}, duoc chap nhan la alias sau ABL cua ${model.name} (${model.product}); app se khong flash FTD.`,
        );
        return;
      }

      throw new WorkflowError("WRONG_PRODUCT", `Dang ket noi ${product || "(empty)"}, can ${model.product}.`);
    }

    this.exactFastbootProductVerified = true;
    this.emitFastbootProductCheck(model, product, "exact");
  }

  private canAcceptPostAblFastbootAlias(model: SupportedModel, product: string, allowPostAblAlias: boolean) {
    if (!allowPostAblAlias || !this.exactFastbootProductVerified || !isLegacyFtdModel(model)) {
      return false;
    }

    const normalizedProduct = product.trim().toLowerCase();

    if (!normalizedProduct) {
      return false;
    }

    return (model.postAblFastbootAliases ?? []).some((alias) => alias.trim().toLowerCase() === normalizedProduct);
  }

  private emitFastbootProductCheck(model: SupportedModel, product: string, productMatch: FastbootProductMatch) {
    const base = this.compatibilityReport;

    this.emitCompatibilityReport({
      modelId: base?.modelId ?? model.id,
      modelName: base?.modelName ?? model.name,
      product: base?.product ?? model.product,
      chip: base?.chip ?? (isLegacyFtdModel(model) ? model.chip : "8E Gen 5"),
      verdict: base?.verdict ?? "unknown",
      warnings: base?.warnings ?? [],
      adb: base?.adb,
      fastboot: {
        ...(base?.fastboot ?? {}),
        product: product || undefined,
        productMatch,
        canonicalProduct: model.product,
      },
    });
  }

  private async assertEfispUnlocked(fastboot: FastbootClient) {
    if (this.isGateBypassed("efisp_unlock_verification")) {
      this.logGateBypass("efisp_unlock_verification", "Skipped fastboot getvar unlocked; no unlocked state was verified.");
      return;
    }

    this.log("command", "fastboot getvar unlocked");
    const unlocked = (await fastboot.getvar("unlocked")).trim().toLowerCase();

    if (unlocked !== "yes") {
      this.efispUnlockVerified = false;
      throw new WorkflowError(
        "UNLOCK_NOT_VERIFIED",
        `Fastboot unlocked=${unlocked || "(empty)"}; khong duoc erase efisp/metadata/userdata.`,
      );
    }

    this.log("success", `Fastboot unlocked: ${unlocked}`);
  }

  private async ensureFastbootForModel() {
    if (!this.fastboot) {
      this.fastboot = this.deps.createFastbootClient();
    }

    this.log("info", "Ket noi/reconnect Fastboot.");
    await this.fastboot.connect();
    this.deps.onDeviceStatus?.("fastboot");
    return this.fastboot;
  }

  private async ensureAssetsForPhase(phase: AssetPhase, model: SupportedModel) {
    this.requireVerifiedTarget();

    if (this.isGateBypassed("asset_verification")) {
      this.logGateBypass("asset_verification", `Skipped verified asset preparation for phase ${phase}; real cached blobs are still required when read.`);
      return;
    }

    if (this.preparedModels.has(model.id)) {
      return;
    }

    const plan = isLegacyFtdModel(model) && this.phaseRequiresFtdPlan(phase)
      ? await this.loadPlanForModel(model)
      : ({ modelId: model.id, product: model.product, operations: [] } satisfies FlashPlan);
    const paths = requiredAssetPathsForPhase(model, plan, phase);
    this.log("info", `Verify/cache ${paths.length} asset cho phase ${phase}.`);
    await this.deps.assets.prepareAssetPaths(paths, (event) => {
      this.deps.onProgress?.(event);
    });
  }

  private phaseRequiresFtdPlan(phase: AssetPhase) {
    return phase === "flash-ftd";
  }

  private requireFtdPackageAvailable(model: LegacyFtdModel) {
    if (!hasAvailableFtdPackage(model)) {
      throw new WorkflowError(
        "FTD_PACKAGE_MISSING",
        `Chua co mini engineering ROM VHMOBILE cho ${model.name} (${model.product}); khong chay phase Flash FTD.`,
      );
    }
  }

  private async readFastbootSerial(fastboot: FastbootClient, emitDevicesLine: boolean) {
    const serial = await fastboot.getSerial();

    if (emitDevicesLine) {
      this.log("success", `${serial || "(unknown)"}\tfastboot`);
      return serial;
    }

    if (serial) {
      this.log("success", `Fastboot serial: ${serial}`);
    } else {
      this.log("warn", "Fastboot serial unavailable; fastboot devices se hien (unknown).");
    }

    return serial;
  }

  private async readFastbootAnti(fastboot: FastbootClient) {
    this.log("command", "fastboot getvar anti");

    try {
      const anti = (await fastboot.getvar("anti")).trim();

      if (anti) {
        this.log("success", `Fastboot anti: ${anti}`);
      } else {
        this.log("warn", "Fastboot anti unavailable; se kiem tra lai truoc khi flash neu package co anti_version.");
      }

      return anti || undefined;
    } catch (error) {
      this.log("warn", `Khong doc duoc antirollback Fastboot: ${toWorkflowError(error).message}`);
      return undefined;
    }
  }

  private async readAdbProductCandidates() {
    return this.adbProductCandidates(await this.readAdbProductProps());
  }

  private async readAdbProductProps() {
    return this.readAdbProps(ADB_PRODUCT_PROPS);
  }

  private async readAdbVersionPropsBestEffort() {
    try {
      return await this.readAdbProps(ADB_VERSION_PROPS);
    } catch (error) {
      this.log("warn", `Khong doc duoc thong tin phien ban Android: ${toWorkflowError(error).message}`);
      return {} as Partial<Record<AdbVersionProp, string>>;
    }
  }

  private async readAdbProps<T extends readonly string[]>(props: T) {
    const values: Partial<Record<T[number], string>> = {};

    for (const prop of props) {
      const result = await this.shell(`getprop ${prop}`);
      const value = result.stdout.trim().split(/\s+/)[0];

      if (value) {
        values[prop as T[number]] = value;
      }
    }

    return values;
  }

  private adbProductCandidates(productProps: Partial<Record<AdbProductProp, string>>) {
    const candidates: string[] = [];

    for (const prop of ADB_PRODUCT_PROPS) {
      const value = this.normalizeAdbProductCandidate(productProps[prop]);

      if (value && !candidates.some((candidate) => candidate.toLowerCase() === value.toLowerCase())) {
        candidates.push(value);
      }
    }

    return candidates;
  }

  private normalizeAdbProductCandidate(value: string | undefined) {
    const trimmed = value?.trim().toLowerCase();

    if (!trimmed || GENERIC_ADB_PRODUCTS.has(trimmed)) {
      return undefined;
    }

    const [base] = trimmed.split("_");

    if (!base || GENERIC_ADB_PRODUCTS.has(base)) {
      return undefined;
    }

    return base;
  }

  private buildAdbCompatibilityReport(
    model: SupportedModel,
    product: string,
    productProps: Partial<Record<AdbProductProp, string>>,
    versionProps: Partial<Record<AdbVersionProp, string>>,
  ): DeviceCompatibilityReport {
    const adb = this.toAdbVersionInfo(productProps, versionProps);
    const warnings = isLegacyFtdModel(model) ? this.evaluateAdbCompatibility(model, adb) : [];

    if (isEfisp8eModel(model)) {
      this.logEfispVersionInfo(adb);
    }

    for (const warning of warnings) {
      this.log("warn", warning);
    }

    return {
      modelId: model.id,
      modelName: model.name,
      product,
      chip: isLegacyFtdModel(model) ? model.chip : "8E Gen 5",
      verdict: warnings.length > 0 ? "warning" : "compatible",
      warnings,
      adb,
    };
  }

  private buildFastbootOnlyCompatibilityReport(
    model: SupportedModel,
    product: string,
    serial: string,
    anti: string | undefined,
  ): DeviceCompatibilityReport {
    const isExactProduct = product.trim().toLowerCase() === model.product.toLowerCase();

    return {
      modelId: model.id,
      modelName: model.name,
      product: product || model.product,
      chip: isLegacyFtdModel(model) ? model.chip : "8E Gen 5",
      verdict: "unknown",
      warnings: ["Fastboot-only không đọc được security patch Android; hãy bắt đầu bằng ADB để kiểm tra phiên bản đầy đủ."],
      fastboot: {
        product: product || undefined,
        serial: serial || undefined,
        anti,
        verifiedWithAdb: false,
        productMatch: isExactProduct ? "exact" : undefined,
        canonicalProduct: isExactProduct ? model.product : undefined,
      },
    };
  }

  private toAdbVersionInfo(
    productProps: Partial<Record<AdbProductProp, string>>,
    versionProps: Partial<Record<AdbVersionProp, string>>,
  ): AdbVersionInfo {
    return {
      productProps,
      androidRelease: versionProps["ro.build.version.release"],
      securityPatch: versionProps["ro.build.version.security_patch"],
      incremental: versionProps["ro.build.version.incremental"],
      miuiVersionName: versionProps["ro.miui.ui.version.name"],
      miuiVersionCode: versionProps["ro.miui.ui.version.code"],
      hyperOsVersionName: versionProps["ro.mi.os.version.name"],
      hyperOsVersionCode: versionProps["ro.mi.os.version.code"],
    };
  }

  private evaluateAdbCompatibility(model: LegacyFtdModel, adb: AdbVersionInfo) {
    const warnings: string[] = [];

    if (adb.androidRelease) {
      this.log("info", `Android release: ${adb.androidRelease}`);
    }

    if (adb.hyperOsVersionName || adb.miuiVersionName) {
      this.log("info", `Xiaomi OS: ${adb.hyperOsVersionName ?? adb.miuiVersionName}`);
    }

    const cutoff = SECURITY_PATCH_CUTOFFS[model.chip];
    if (!cutoff) {
      return warnings;
    }

    const patch = adb.securityPatch?.trim();

    if (!patch) {
      warnings.push(
        "Không đọc được security patch từ Android; vẫn cho chạy nhưng cần chắc chắn máy đúng model và đang ở ROM gốc.",
      );
      return warnings;
    }

    this.log("info", `Security patch: ${patch}`);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch)) {
      warnings.push(
        `Security patch "${patch}" không đúng định dạng YYYY-MM-DD; app không thể so với cutoff ${cutoff}, vẫn cho chạy nhưng cần kiểm tra thủ công.`,
      );
      return warnings;
    }

    if (patch >= cutoff) {
      warnings.push(
        `Cảnh báo: security patch ${patch} >= ${cutoff} (chip ${model.chip}). Exploit/FTD có thể fail trên bản vá cao; vẫn cho chạy nếu đã hiểu rủi ro.`,
      );
    }

    return warnings;
  }

  private logEfispVersionInfo(adb: AdbVersionInfo) {
    if (adb.androidRelease) {
      this.log("info", `Android release: ${adb.androidRelease}`);
    }

    if (adb.hyperOsVersionName || adb.miuiVersionName) {
      this.log("info", `Xiaomi OS: ${adb.hyperOsVersionName ?? adb.miuiVersionName}`);
    }

    if (adb.securityPatch) {
      this.log("info", `Security patch: ${adb.securityPatch}`);
    }
  }

  private assertEfispSecurityPatch(patchInput: string | undefined) {
    if (this.isGateBypassed("compatibility")) {
      this.logGateBypass("compatibility", "EFISP security patch was not verified.");
      return;
    }

    const patch = patchInput?.trim();

    if (!patch) {
      throw new WorkflowError(
        "SECURITY_PATCH_BLOCKED",
        `EFISP Gen 5 can doc security patch va chi cho phep <= ${EFISP_SECURITY_PATCH_CUTOFF}.`,
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch)) {
      throw new WorkflowError(
        "SECURITY_PATCH_BLOCKED",
        `Security patch "${patch}" khong dung dinh dang YYYY-MM-DD; khong duoc chay EFISP.`,
      );
    }

    if (patch > EFISP_SECURITY_PATCH_CUTOFF) {
      throw new WorkflowError(
        "SECURITY_PATCH_BLOCKED",
        `Security patch ${patch} moi hon cutoff ${EFISP_SECURITY_PATCH_CUTOFF}; dung EFISP de tranh ghi tren firmware da va lo hong.`,
      );
    }

    this.log("success", `EFISP security patch gate OK: ${patch} <= ${EFISP_SECURITY_PATCH_CUTOFF}.`);
  }

  private emitFastbootCompatibility(
    product: string,
    serial: string,
    anti: string | undefined,
    verifiedWithAdb: boolean,
    extraWarnings: string[] = [],
  ) {
    const base = this.compatibilityReport;
    const model = this.pendingAdbDetection?.model ?? this.model;

    if (!base && !model) {
      return;
    }

    const warnings = [...new Set([...(base?.warnings ?? []), ...extraWarnings])];
    const verdict =
      base?.verdict === "warning" || (base?.verdict === "compatible" && warnings.length > 0)
        ? "warning"
        : base?.verdict ?? (warnings.length > 0 ? "warning" : "unknown");
    const productMatch =
      model && product.trim().toLowerCase() === model.product.toLowerCase() ? "exact" : undefined;

    this.emitCompatibilityReport({
      modelId: base?.modelId ?? model!.id,
      modelName: base?.modelName ?? model!.name,
      product: base?.product ?? model!.product,
      chip: base?.chip ?? (isLegacyFtdModel(model!) ? model!.chip : "8E Gen 5"),
      verdict,
      warnings,
      adb: base?.adb,
      fastboot: {
        ...(base?.fastboot ?? {}),
        product: product || undefined,
        serial: serial || undefined,
        anti,
        verifiedWithAdb,
        productMatch,
        canonicalProduct: productMatch ? model?.product : base?.fastboot?.canonicalProduct,
      },
    });
  }

  private emitCompatibilityReport(report: DeviceCompatibilityReport) {
    this.compatibilityReport = report;
    this.deps.onCompatibilityReport?.(report);
  }

  private allowAdvancedEdlMode() {
    return import.meta.env.VITE_ALLOW_ADVANCED_EDL === "true";
  }

  private allowDirectFastboot() {
    return this.allowAdvancedEdlMode() || import.meta.env.VITE_ALLOW_FASTBOOT_DIRECT === "true";
  }

  private async shell(command: string) {
    const adb = this.requireAdb();
    this.log("command", `adb shell ${command}`);
    const result = await adb.shell(command);

    if (result.exitCode !== 0) {
      throw new WorkflowError("ADB_UNAUTHORIZED", `Lenh ADB that bai (${result.exitCode}): ${result.stderr}`);
    }

    if (result.stderr.trim()) {
      this.log("warn", result.stderr.trim());
    }

    if (result.stdout.trim()) {
      this.log("info", result.stdout.trim());
    }

    return result;
  }

  private async fetch(path: string, label: string, context?: FetchProgressContext) {
    this.log("info", label);
    return this.deps.assets.fetchVerifiedBlob(path, (received, total) => {
      const itemProgress = clampProgress(total ? received / total : undefined);
      const overallProgress =
        context && context.totalItems > 0 ? clampProgress(context.completedItems / context.totalItems) : itemProgress;

      this.deps.onProgress?.({
        label,
        path,
        fileReceivedBytes: received,
        fileTotalBytes: total,
        receivedBytes: received,
        totalBytes: total,
        state: "cached",
        progress: itemProgress,
        overallProgress,
        itemProgress,
        itemLabel: context?.itemLabel ?? path,
        completedItems: context?.completedItems,
        totalItems: context?.totalItems,
      });
    });
  }

  private emitOperationProgress(
    label: string,
    progress: number,
    state: OperationProgressState,
    completedBefore: number,
    totalItems: number,
    itemLabel = label,
  ) {
    const itemProgress = clampProgress(progress);
    const completedItems = Math.min(totalItems, completedBefore + (itemProgress === 1 ? 1 : 0));
    const overallProgress =
      itemProgress === undefined || totalItems <= 0
        ? undefined
        : clampProgress((completedBefore + itemProgress) / totalItems);

    this.deps.onProgress?.({
      label,
      progress: itemProgress,
      state,
      overallProgress,
      itemProgress,
      itemLabel,
      completedItems,
      totalItems,
    });
  }

  private requireManifest() {
    if (!this.manifest) {
      throw new WorkflowError("MANIFEST_INVALID", "Manifest chua tai.");
    }

    return this.manifest;
  }

  private requireModel() {
    if (!this.model) {
      throw new WorkflowError("UNSUPPORTED_PRODUCT", "Chua khoa mau may.");
    }

    return this.model;
  }

  private requireLegacyModel() {
    return this.asLegacyModel(this.requireModel());
  }

  private requireEfispModel() {
    const model = this.requireModel();

    if (!isEfisp8eModel(model)) {
      throw new WorkflowError("UNSUPPORTED_PRODUCT", `Mau may ${model.name} khong dung flow EFISP 8E Gen 5.`);
    }

    return model;
  }

  private isGateBypassed(gate: OverrideGateId) {
    return isOverrideGateBypassed(this.overrideGatePolicy, gate);
  }

  private logGateBypass(gate: OverrideGateId, detail: string) {
    this.log("warn", `Developer override bypassed ${gate}: ${detail}`);
  }

  private asLegacyModel(model: SupportedModel): LegacyFtdModel {
    if (!isLegacyFtdModel(model)) {
      throw new WorkflowError("UNSUPPORTED_PRODUCT", `Mau may ${model.name} khong dung flow legacy FTD.`);
    }

    return model;
  }

  private requireVerifiedTarget() {
    if (!this.targetVerified) {
      if (this.model && this.isGateBypassed("model_verification")) {
        this.logGateBypass("model_verification", `Target ${this.model.name} is manually assumed, not device-verified.`);
        return;
      }

      throw new WorkflowError("WRONG_PRODUCT", "Fastboot product chua duoc xac minh khop mau may.");
    }
  }

  private requireAdb() {
    if (!this.adb) {
      throw new WorkflowError("DEVICE_NOT_FOUND", "ADB chua ket noi.");
    }

    return this.adb;
  }

  private requireConfirmation(confirmed: boolean) {
    if (!confirmed) {
      if (this.isGateBypassed("destructive_confirmation")) {
        this.logGateBypass("destructive_confirmation", "Operator confirmation checkbox was not required.");
        return;
      }

      throw new WorkflowError("CONFIRMATION_REQUIRED");
    }
  }

  private async runPhase<T>(phase: PhaseId, work: () => Promise<T>) {
    this.deps.onPhaseStatus?.(phase, "running");

    try {
      const result = await work();
      this.deps.onPhaseStatus?.(phase, "done");
      return result;
    } catch (error) {
      this.deps.onPhaseStatus?.(phase, "failed");
      const workflowError = toWorkflowError(error);
      this.log("error", workflowError.message);
      throw workflowError;
    }
  }

  private async runAdbExploitWorkflow(model: LegacyFtdModel) {
    if (!model.adbExploit) return;

    this.log("info", "Bat dau qua trinh ADB Exploit.");

    this.adb = this.deps.createAdbClient();
    this.log("info", "Mo WebUSB picker de ket noi ADB.");
    await this.adb.connect();
    this.deps.onDeviceStatus?.("adb");

    const ablBlob = await this.fetch(model.ablFile, "Tai engineering ABL");
    const candidates = this.adbExploitCandidates(model.adbExploit);

    let rootAcquired = false;
    for (const candidate of candidates) {
      const label = candidate.name ?? candidate.exploitFile;
      const exploitBlob = await this.fetch(candidate.exploitFile, `Tai exploit binary (${label})`);
      const suBlob = await this.fetch(candidate.suFile, `Tai su binary (${label})`);

      this.log("info", `Dang day exploit va su (${label}) vao /data/local/tmp/...`);
      await this.adb.push("/data/local/tmp/exploit", exploitBlob);
      await this.adb.push("/data/local/tmp/su", suBlob);
      await this.shell("chmod 755 /data/local/tmp/exploit /data/local/tmp/su");

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        this.log("info", `Dang chay exploit binary (${label}) lan ${attempt}/3...`);

        try {
          await this.shell("/data/local/tmp/exploit");
          this.log("info", "Kiem tra quyen Root...");
          const rootCheck = await this.adb.shell("/data/local/tmp/su -c 'id'");
          this.log("info", `Root check output: ${rootCheck.stdout.trim()}`);

          if (rootCheck.stdout.toLowerCase().includes("uid=0")) {
            rootAcquired = true;
            break;
          }
        } catch (error) {
          this.log("warn", `Exploit ${label} lan ${attempt}/3 chua thanh cong: ${toWorkflowError(error).message}`);
        }
      }

      if (rootAcquired) {
        this.log("success", `Da lay quyen Root thanh cong bang exploit ${label}.`);
        break;
      }

      this.log("warn", `Exploit ${label} that bai sau 3 lan, thu candidate tiep theo neu co.`);
    }

    if (!rootAcquired) {
      throw new WorkflowError("ADB_UNAUTHORIZED", "Khong the lay quyen root qua exploit binary.");
    }

    this.log("info", "Thiet lap SELinux sang Permissive...");
    let permissive = false;
    for (let i = 0; i < 10; i++) {
      await this.adb.shell("/data/local/tmp/exploit");
      const selinuxCheck = await this.adb.shell("/data/local/tmp/su -c 'getenforce'");
      this.log("info", `Trang thai SELinux: ${selinuxCheck.stdout.trim()}`);
      if (selinuxCheck.stdout.toLowerCase().includes("permissive")) {
        permissive = true;
        break;
      }
      this.log("info", `Cho SELinux Permissive (${i + 1}/10)...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!permissive) {
      throw new WorkflowError("ADB_UNAUTHORIZED", "Khong the chuyen SELinux sang Permissive.");
    }
    this.log("success", "SELinux da chuyen sang Permissive.");

    this.log("info", "Dang day engineering ABL vao thiet bi...");
    await this.adb.push("/data/local/tmp/abl.elf", ablBlob);

    this.log("info", "Ghi ABL vao partitions abl_a va abl_b...");
    await this.shell("/data/local/tmp/su -c 'dd if=/data/local/tmp/abl.elf of=/dev/block/by-name/abl_a'");
    await this.shell("/data/local/tmp/su -c 'dd if=/data/local/tmp/abl.elf of=/dev/block/by-name/abl_b'");
    this.log("success", "Da nap engineering ABL thanh cong.");

    this.log("command", "adb reboot bootloader");
    await this.adb.rebootBootloader();
    await this.adb.close();
    this.adb = undefined;
    this.deps.onDeviceStatus?.("waiting-manual-reboot");
    this.log("warn", "May dang reboot sang Fastboot. Vui long chon Ket noi Fastboot khi hop thoai trinh duyet xuat hien de tiep tuc flash.");
  }

  private adbExploitCandidates(adbExploit: NonNullable<LegacyFtdModel["adbExploit"]>) {
    const candidates =
      adbExploit.candidates ??
      (adbExploit.exploitFile && adbExploit.suFile
        ? [{ exploitFile: adbExploit.exploitFile, suFile: adbExploit.suFile }]
        : []);

    if (candidates.length === 0) {
      throw new WorkflowError("ADB_UNAUTHORIZED", "Model chua co exploit binary hop le.");
    }

    return candidates;
  }

  private log(level: WorkflowLog["level"], message: string) {
    this.deps.onLog?.({
      time: logTime(),
      level,
      message,
    });
  }
}
