import { findModelByProduct, isLegacyFtdModel } from "../domain/models";
import type { FlashOperation, FlashPlan, LegacyFtdModel, Manifest, SupportedModel } from "../domain/schemas";
import type { AdbClient } from "../services/adb";
import { requiredAssetPathsForPhase, type AssetPhase } from "../services/assetClient";
import { parseFastbootTerminalCommand, type FastbootClient } from "../services/fastboot";
import { toWorkflowError, WorkflowError } from "./errors";
import type { PhaseId, ProgressEvent, WorkflowDependencies, WorkflowLog, WorkflowMode } from "./types";

const ADB_PRODUCT_PROPS = ["ro.product.device", "ro.product.vendor.device", "ro.build.product"] as const;

type OperationProgressState = Extract<ProgressEvent["state"], "flashing" | "booting" | "configuring">;

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
  private pendingAdbDetection:
    | {
        model: SupportedModel;
        product: string;
      }
    | undefined;
  private readonly deps: WorkflowDependencies;

  constructor(deps: WorkflowDependencies) {
    this.deps = deps;
  }

  get selectedModel() {
    return this.model;
  }

  overrideTargetModel(model: SupportedModel) {
    const legacyModel = this.asLegacyModel(model);
    this.model = legacyModel;
    this.targetVerified = true;
    this.pendingAdbDetection = undefined;
    this.deps.onModelDetected?.({
      model: legacyModel,
      fastbootProduct: legacyModel.product,
      source: "override",
      verified: true,
    });
    this.log("warn", `Developer override target: ${legacyModel.name} (${legacyModel.product}).`);
  }

  setWorkflowMode(mode: WorkflowMode) {
    if (mode === "edl-standard") {
      this.log("warn", "EDL_Standard: engineering ABL da duoc nap thu cong; app chi chay Fastboot/FTD.");
      return;
    }

    this.log("warn", "Workflow mode: Standard Fastboot/FTD.");
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
    this.targetVerified = false;
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
      this.log("success", `Da tai manifest v${this.manifest.version}, ${this.manifest.models.length} model legacy FTD.`);
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

      const candidates = await this.readAdbProductCandidates();
      const detected = candidates
        .map((product) => ({ product, model: findModelByProduct(manifest.models, product) }))
        .find((candidate): candidate is { product: string; model: SupportedModel } => Boolean(candidate.model));

      if (!detected) {
        throw new WorkflowError(
          "UNSUPPORTED_PRODUCT",
          `ADB codename ${candidates.join(", ") || "(empty)"} khong duoc ho tro trong flow FTD.`,
        );
      }

      const model = this.asLegacyModel(detected.model);
      this.model = model;
      this.targetVerified = false;
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

      if (this.pendingAdbDetection) {
        const pending = this.pendingAdbDetection;

        if (!product.trim()) {
          throw new WorkflowError("WRONG_PRODUCT", `Fastboot product empty, can khop ADB codename ${pending.product}.`);
        }

        if (product.trim().toLowerCase() !== pending.model.product.toLowerCase()) {
          throw new WorkflowError(
            "WRONG_PRODUCT",
            `ADB codename ${pending.product} nhung Fastboot product ${product}; dung de tranh sai may.`,
          );
        }

        this.model = pending.model;
        this.targetVerified = true;
        this.pendingAdbDetection = undefined;
        this.deps.onModelDetected?.({
          model: pending.model,
          adbProduct: pending.product,
          fastbootProduct: product,
          fastbootSerial: serial || undefined,
          source: "verified",
          verified: true,
        });
        this.log("success", `ADB/Fastboot da khop: ${pending.model.name} (${product}).`);
        return pending.model;
      }

      const model = findModelByProduct(manifest.models, product);

      if (!model) {
        throw new WorkflowError("UNSUPPORTED_PRODUCT", `Codename ${product || "(empty)"} khong duoc ho tro trong flow FTD.`);
      }

      const legacyModel = this.asLegacyModel(model);
      this.model = legacyModel;
      this.targetVerified = true;
      this.deps.onModelDetected?.({
        model: legacyModel,
        fastbootProduct: product,
        fastbootSerial: serial || undefined,
        source: "fastboot",
        verified: true,
      });
      this.log("success", `Da khoa model: ${legacyModel.name} (${legacyModel.product}).`);
      return legacyModel;
    });
  }

  async runFastbootTerminalCommand(input: string) {
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
      const model = this.requireLegacyModel();
      this.requireVerifiedTarget();
      const plan = await this.loadPlanForModel(model);

      this.log("info", `Preparing FTD assets for ${model.name}.`);
      await this.deps.assets.prepareModelAssets(model, plan, (event) => {
        this.deps.onProgress?.(event);
      });
      this.preparedModels.add(model.id);
      this.log("success", `Assets for ${model.name} are verified and ready in browser cache.`);
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

  async runUnlockPayload(confirmed: boolean) {
    return this.runPhase("unlock-payload", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireLegacyModel();
      await this.ensureAssetsForPhase("unlock-payload", model);
      const fastboot = await this.ensureFastbootForModel();
      await this.assertFastbootProduct(fastboot, model);
      const totalOperations = 3;

      this.log("command", "fastboot reboot bootloader");
      this.emitOperationProgress("Reboot bootloader", 0, "configuring", 0, totalOperations, "fastboot reboot bootloader");
      this.deps.onDeviceStatus?.("waiting-manual-reboot");
      await fastboot.rebootBootloaderAndWait(() => {
        this.deps.onDeviceStatus?.("waiting-manual-reboot");
        this.log("warn", "Cho may ve lai Fastboot sau reboot bootloader. Neu browser hien picker, chon lai thiet bi.");
      });
      this.emitOperationProgress("Reboot bootloader", 1, "configuring", 0, totalOperations, "fastboot reboot bootloader");
      this.deps.onDeviceStatus?.("fastboot");
      this.log("success", "Fastboot da reconnect sau reboot bootloader.");
      await this.assertFastbootProduct(fastboot, model);

      this.log("command", `fastboot flash partition:4 ${model.unlock.gptBoth4}`);
      const unlockGpt = await this.fetch(model.unlock.gptBoth4, "Tai unlock GPT partition:4", {
        completedItems: 1,
        totalItems: totalOperations,
        itemLabel: "Tai unlock GPT partition:4",
      });
      this.emitOperationProgress("Flash partition:4", 0, "flashing", 1, totalOperations, "Flash partition:4");
      await fastboot.flash("partition:4", unlockGpt, (progress) =>
        this.emitOperationProgress("Flash partition:4", progress, "flashing", 1, totalOperations, "Flash partition:4"),
      );
      this.emitOperationProgress("Flash partition:4", 1, "flashing", 1, totalOperations, "Flash partition:4");

      this.log("command", `fastboot boot ${model.unlock.bootImage}`);
      const unlockBoot = await this.fetch(model.unlock.bootImage, "Tai unlock boot.img", {
        completedItems: 2,
        totalItems: totalOperations,
        itemLabel: "Tai unlock boot.img",
      });
      this.emitOperationProgress("Boot unlock payload", 0, "booting", 2, totalOperations, "Boot unlock payload");
      await fastboot.boot(unlockBoot, (progress) =>
        this.emitOperationProgress("Boot unlock payload", progress, "booting", 2, totalOperations, "Boot unlock payload"),
      );
      this.emitOperationProgress("Boot unlock payload", 1, "booting", 2, totalOperations, "Boot unlock payload");
      this.deps.onDeviceStatus?.("waiting-manual-reboot");
      this.log("warn", "Sau man hinh trang, giu Power + Volume Down de ve Fastboot.");
    });
  }

  async restoreFinalGpt(confirmed: boolean) {
    return this.runPhase("restore-gpt", async () => {
      this.requireConfirmation(confirmed);
      const model = this.requireLegacyModel();
      await this.ensureAssetsForPhase("restore-gpt", model);
      const fastboot = await this.ensureFastbootForModel();
      await this.assertFastbootProduct(fastboot, model);
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

  private async loadPlanForModel(model: LegacyFtdModel) {
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

    const antiBlob = await this.fetch(`${model.ftdPackage}/${plan.antiRollbackFile}`, "Tai anti_version.txt");
    const packageAnti = Number((await antiBlob.text()).trim() || "0");
    this.log("command", "fastboot getvar anti");
    const deviceAnti = Number((await fastboot.getvar("anti")) || "0");

    if (deviceAnti > packageAnti) {
      throw new WorkflowError("ANTIROLLBACK_FAILED", `anti device=${deviceAnti}, package=${packageAnti}; dung flash.`);
    }

    this.log("success", `Antirollback OK: device=${deviceAnti}, package=${packageAnti}.`);
  }

  private async assertFastbootProduct(fastboot: FastbootClient, model: SupportedModel) {
    this.log("command", "fastboot getvar product");
    const product = await fastboot.getvar("product");

    if (product.toLowerCase() !== model.product.toLowerCase()) {
      throw new WorkflowError("WRONG_PRODUCT", `Dang ket noi ${product || "(empty)"}, can ${model.product}.`);
    }
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

  private async ensureAssetsForPhase(phase: AssetPhase, model: LegacyFtdModel) {
    this.requireVerifiedTarget();

    if (this.preparedModels.has(model.id)) {
      return;
    }

    const plan = await this.loadPlanForModel(model);
    const paths = requiredAssetPathsForPhase(model, plan, phase);
    this.log("info", `Verify/cache ${paths.length} asset cho phase ${phase}.`);
    await this.deps.assets.prepareAssetPaths(paths, (event) => {
      this.deps.onProgress?.(event);
    });
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

  private async readAdbProductCandidates() {
    const candidates: string[] = [];

    for (const prop of ADB_PRODUCT_PROPS) {
      const result = await this.shell(`getprop ${prop}`);
      const value = result.stdout.trim().split(/\s+/)[0];

      if (value && !candidates.some((candidate) => candidate.toLowerCase() === value.toLowerCase())) {
        candidates.push(value);
      }
    }

    return candidates;
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

  private asLegacyModel(model: SupportedModel): LegacyFtdModel {
    if (!isLegacyFtdModel(model)) {
      throw new WorkflowError("UNSUPPORTED_PRODUCT", `Mau may ${model.name} khong dung flow legacy FTD.`);
    }

    return model;
  }

  private requireVerifiedTarget() {
    if (!this.targetVerified) {
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

  private log(level: WorkflowLog["level"], message: string) {
    this.deps.onLog?.({
      time: logTime(),
      level,
      message,
    });
  }
}
