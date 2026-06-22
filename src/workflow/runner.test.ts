import { afterEach, describe, expect, it, vi } from "vitest";

import { v1Efisp8eModels, v1ManifestModels } from "../domain/models";
import type { FlashPlan, Manifest, Sha256Sums, SupportedModel } from "../domain/schemas";
import type { AdbClient, AdbShellResult } from "../services/adb";
import { requiredAssetPathsForModel, type AssetClient, type AssetPrepareProgress } from "../services/assetClient";
import type { FastbootClient } from "../services/fastboot";
import { UnlockWorkflowRunner } from "./runner";
import {
  noOverrideGatePolicy,
  overrideGateIds,
  type DeviceCompatibilityReport,
  type OverrideGateId,
  type OverrideGatePolicy,
  type PhaseId,
  type ProgressEvent,
  type TargetDetection,
  type WorkflowLog,
} from "./types";

const efispManifestModels: SupportedModel[] = JSON.parse(JSON.stringify(v1Efisp8eModels));

const newTestManifest = (): Manifest =>
  JSON.parse(JSON.stringify({ version: 1, models: v1ManifestModels.filter((model) => model.family === "legacy-ftd") }));

class TestAssets implements AssetClient {
  manifest: Manifest = newTestManifest();
  plan: FlashPlan = {
    modelId: "xiaomi15",
    product: "dada",
    antiRollbackFile: "images/anti_version.txt",
    operations: [
      { type: "getvar", name: "product", expect: "dada" },
      { type: "erase", partition: "boot_ab" },
      { type: "flash", partition: "boot_ab", file: "images/boot.img" },
      { type: "set_active", slot: "a" },
      { type: "reboot" },
    ],
  };
  prepared = false;
  preparedPaths = new Set<string>();
  prepareCalls: string[][] = [];
  fetches: string[] = [];
  blobs = new Map<string, Blob>([
    ["abl/mi15.elf", new Blob(["abl"])],
    ["abl/mi15u.elf", new Blob(["abl-15u"])],
    ["abl/k80pro.elf", new Blob(["abl-k80pro"])],
    ["abl/K90.elf", new Blob(["abl-k90"])],
    ["abl/pad8.elf", new Blob(["abl-pad8"])],
    ["packages/xiaomi15/images/anti_version.txt", new Blob(["0"])],
    ["packages/xiaomi15/images/boot.img", new Blob(["boot"])],
    ["unlock/gpt_both4.bin", new Blob(["unlock-gpt"])],
    ["unlock/boot.img", new Blob(["unlock-boot"])],
    ["packages/xiaomi15/images/gpt_both0.bin", new Blob(["gpt0"])],
    ["packages/xiaomi15/images/gpt_both1.bin", new Blob(["gpt1"])],
    ["packages/xiaomi15/images/gpt_both2.bin", new Blob(["gpt2"])],
    ["packages/xiaomi15/images/gpt_both3.bin", new Blob(["gpt3"])],
    ["packages/xiaomi15/images/gpt_both4.bin", new Blob(["gpt4"])],
    ["packages/xiaomi15/images/gpt_both5.bin", new Blob(["gpt5"])],
    ["packages/xiaomi15ultra/images/gpt_both4.bin", new Blob(["gpt15u4"])],
    ["packages/redmi-k80pro/images/gpt_both4.bin", new Blob(["gptk80p4"])],
    ["packages/redmi-k90/images/gpt_both4.bin", new Blob(["gptk904"])],
    ["packages/xiaomi-pad8pro/images/gpt_both4.bin", new Blob(["gptpad8p4"])],
    ["efisp/gbl_efi_unlock.efi", new Blob(["efi-unlock"])],
  ]);

  async loadManifest() {
    return this.manifest;
  }

  async loadRootSha256(): Promise<Sha256Sums> {
    return {};
  }

  async loadFlashPlan() {
    return this.plan;
  }

  async loadPackageSha256(): Promise<Sha256Sums> {
    return {};
  }

  async prepareModelAssets(model: SupportedModel, plan: FlashPlan, onProgress?: (event: AssetPrepareProgress) => void) {
    await this.prepareAssetPaths(requiredAssetPathsForModel(model, plan), onProgress);
    this.prepared = true;
  }

  async prepareAssetPaths(paths: readonly string[], onProgress?: (event: AssetPrepareProgress) => void) {
    this.prepareCalls.push([...paths]);

    for (const [index, path] of paths.entries()) {
      this.preparedPaths.add(path);
      onProgress?.({
        label: `Prepared ${path}`,
        path,
        completedFiles: index + 1,
        totalFiles: paths.length,
        receivedBytes: index + 1,
        state: "stored",
        progress: (index + 1) / paths.length,
      });
    }
  }

  async fetchVerifiedBlob(path: string) {
    if (!this.prepared && !this.preparedPaths.has(path)) {
      throw new Error(`${path} not prepared`);
    }

    this.fetches.push(path);
    const blob = this.blobs.get(path);

    if (!blob) {
      throw new Error(`missing blob ${path}`);
    }

    return blob;
  }
}

class TestFastboot implements FastbootClient {
  commands: string[] = [];
  product = "dada";
  anti = "0";
  unlocked = "no";
  serial = "FB123456";
  failEraseFrp = false;

  async connect() {}

  async close() {}

  async getvar(name: string) {
    this.commands.push(`getvar:${name}`);
    if (name === "product") {
      return this.product;
    }
    if (name === "anti") {
      return this.anti;
    }
    if (name === "unlocked") {
      return this.unlocked;
    }
    if (name === "serialno") {
      return this.serial;
    }
    return "";
  }

  async getSerial() {
    this.commands.push("getvar:serialno");
    return this.serial;
  }

  async runRaw(command: string) {
    this.commands.push(command);
    if (command === "oem device-info") {
      return "(bootloader) Device unlocked: true\nOKAY";
    }
    return "";
  }

  async erase(partition: string) {
    if (partition === "frp" && this.failEraseFrp) {
      throw new Error("fastboot erase frp failed");
    }

    this.commands.push(`erase:${partition}`);
  }

  async flash(partition: string, _blob: Blob, onProgress?: (progress: number) => void) {
    this.commands.push(`flash:${partition}`);
    onProgress?.(1);
  }

  async boot(_blob: Blob, onProgress?: (progress: number) => void) {
    this.commands.push("boot");
    onProgress?.(1);
  }

  async setActive(slot: "a" | "b") {
    this.commands.push(`set_active:${slot}`);
  }

  async reboot(target?: "bootloader" | "system") {
    this.commands.push(target ? `reboot:${target}` : "reboot");
  }

  async rebootBootloaderAndWait() {
    this.commands.push("reboot:bootloader");
  }
}

class TestAdb implements AdbClient {
  props: Record<string, string> = {
    "ro.product.device": "dada",
    "ro.product.vendor.device": "dada",
    "ro.build.product": "dada",
    "ro.build.version.release": "15",
    "ro.build.version.security_patch": "2024-12-01",
    "ro.build.version.incremental": "OS2.0.1.0",
    "ro.mi.os.version.name": "OS2.0",
    "ro.mi.os.version.code": "2",
  };
  commands: string[] = [];
  pushes: Array<{ filename: string; size: number }> = [];

  async connect() {}

  async shell(command: string): Promise<AdbShellResult> {
    this.commands.push(command);
    if (command.startsWith("getprop ")) {
      return { stdout: `${this.props[command.slice("getprop ".length)] ?? ""}\n`, stderr: "", exitCode: 0 };
    }
    if (command === "getenforce") {
      return { stdout: "Permissive\n", stderr: "", exitCode: 0 };
    }
    if (command.startsWith("service call miui.mqsas.IMQSNative")) {
      return { stdout: "Result: Parcel(00000000 00000001)\n", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  async push(filename: string, blob: Blob) {
    this.pushes.push({ filename, size: blob.size });
  }

  async rebootBootloader() {
    this.commands.push("reboot bootloader");
  }

  async close() {}
}

const createRunner = (
  fastboot = new TestFastboot(),
  adb = new TestAdb(),
  assets = new TestAssets(),
  overrideGatePolicy: OverrideGatePolicy = noOverrideGatePolicy,
) => {
  const phaseStatuses: Array<[PhaseId, string]> = [];
  const logs: WorkflowLog[] = [];
  const detections: TargetDetection[] = [];
  const compatibilityReports: DeviceCompatibilityReport[] = [];
  const progress: ProgressEvent[] = [];
  const runner = new UnlockWorkflowRunner({
    assets,
    createFastbootClient: () => fastboot,
    createAdbClient: () => adb,
    overrideGatePolicy,
    onPhaseStatus: (phase, status) => phaseStatuses.push([phase, status]),
    onLog: (log) => logs.push(log),
    onModelDetected: (target) => detections.push(target),
    onCompatibilityReport: (report) => compatibilityReports.push(report),
    onProgress: (event) => progress.push(event),
  });

  return { runner, fastboot, adb, assets, phaseStatuses, logs, detections, compatibilityReports, progress };
};

const selectivePolicy = (...bypassedGates: OverrideGateId[]): OverrideGatePolicy => ({
  mode: "selective_bypass",
  bypassedGates,
});

const fullOverridePolicy = (): OverrideGatePolicy => ({
  mode: "full_override",
  bypassedGates: [],
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("UnlockWorkflowRunner", () => {
  it("requires Android/ADB before Fastboot for every EFISP Gen 5 product", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };

    for (const product of ["pudding", "pandora", "popsicle", "nezha", "myron"]) {
      const fastboot = new TestFastboot();
      fastboot.product = product;
      const { runner } = createRunner(fastboot, new TestAdb(), assets);

      await runner.initialize();
      await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "ADB_REQUIRED" });
    }
  });

  it("runs the complete EFISP Gen 5 flow through verified assets and MQSAS", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "pudding";
    adb.props["ro.product.vendor.device"] = "pudding";
    adb.props["ro.build.product"] = "pudding";
    adb.props["ro.build.version.security_patch"] = "2026-02-01";
    const fastboot = new TestFastboot();
    fastboot.product = "pudding";
    fastboot.unlocked = "yes";
    const { runner, phaseStatuses, detections } = createRunner(fastboot, adb, assets);

    await runner.initialize();
    await runner.connectInitialAdb();
    await runner.connectFastboot();
    await runner.prepareAssetsForSelectedModel();
    await runner.bootEfispPermissive(true);
    await runner.writeEfispUnlock(true);
    await runner.verifyEfispUnlock();
    await runner.cleanupEfispData(true);

    expect(detections.at(-1)).toMatchObject({
      model: expect.objectContaining({ id: "xiaomi17", family: "efisp-8e-gen5" }),
      adbProduct: "pudding",
      fastbootProduct: "pudding",
      verified: true,
    });
    expect(assets.prepareCalls).toEqual([["efisp/gbl_efi_unlock.efi"]]);
    expect(assets.fetches).toContain("efisp/gbl_efi_unlock.efi");
    expect(adb.pushes).toEqual([
      expect.objectContaining({ filename: "/data/local/tmp/gbl_efi_unlock.efi" }),
    ]);
    expect(adb.commands).toEqual(
      expect.arrayContaining([
        "reboot bootloader",
        expect.stringContaining("service call miui.mqsas.IMQSNative 21"),
      ]),
    );
    expect(fastboot.commands).toEqual(
      expect.arrayContaining([
        "oem set-gpu-preemption-value 0 androidboot.selinux=permissive",
        "continue",
        "getvar:unlocked",
        "erase:efisp",
        "erase:metadata",
        "erase:userdata",
      ]),
    );
    expect(phaseStatuses.filter(([, status]) => status === "done").map(([phase]) => phase)).toEqual([
      "connect-device",
      "prepare-assets",
      "boot-permissive",
      "write-efisp",
      "verify-unlock",
      "cleanup-data",
    ]);
  });

  it("hard-blocks EFISP when security patch is newer than 2026-02-01", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "pudding";
    adb.props["ro.product.vendor.device"] = "pudding";
    adb.props["ro.build.product"] = "pudding";
    adb.props["ro.build.version.security_patch"] = "2026-02-02";
    const { runner, phaseStatuses } = createRunner(new TestFastboot(), adb, assets);

    await runner.initialize();
    await expect(runner.connectInitialAdb()).rejects.toMatchObject({ code: "SECURITY_PATCH_BLOCKED" });

    expect(adb.commands).not.toContain("reboot bootloader");
    expect(phaseStatuses).toContainEqual(["connect-device", "failed"]);
  });

  it("hard-blocks EFISP when the security patch cannot be verified", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "pudding";
    adb.props["ro.product.vendor.device"] = "pudding";
    adb.props["ro.build.product"] = "pudding";
    adb.props["ro.build.version.security_patch"] = "";
    const { runner } = createRunner(new TestFastboot(), adb, assets);

    await runner.initialize();
    await expect(runner.connectInitialAdb()).rejects.toMatchObject({ code: "SECURITY_PATCH_BLOCKED" });
    expect(adb.commands).not.toContain("reboot bootloader");
  });

  it("blocks EFISP cleanup until Fastboot reports unlocked yes", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "pudding";
    adb.props["ro.product.vendor.device"] = "pudding";
    adb.props["ro.build.product"] = "pudding";
    adb.props["ro.build.version.security_patch"] = "2026-01-01";
    const fastboot = new TestFastboot();
    fastboot.product = "pudding";
    const { runner } = createRunner(fastboot, adb, assets);

    await runner.initialize();
    await runner.connectInitialAdb();
    await runner.connectFastboot();

    await expect(runner.cleanupEfispData(true)).rejects.toMatchObject({ code: "UNLOCK_NOT_VERIFIED" });
    expect(fastboot.commands).not.toEqual(expect.arrayContaining(["erase:efisp", "erase:metadata", "erase:userdata"]));

    await expect(runner.verifyEfispUnlock()).rejects.toMatchObject({ code: "UNLOCK_NOT_VERIFIED" });
    expect(fastboot.commands).not.toEqual(expect.arrayContaining(["erase:efisp", "erase:metadata", "erase:userdata"]));
  });

  it("requires Android/ADB before direct Fastboot in the public flow", async () => {
    const { runner, fastboot, detections, compatibilityReports } = createRunner();

    await runner.initialize();
    await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "ADB_REQUIRED" });

    expect(detections).toEqual([]);
    expect(fastboot.commands).toEqual(expect.arrayContaining(["getvar:product", "getvar:serialno", "getvar:anti"]));
    expect(compatibilityReports.at(-1)).toMatchObject({
      verdict: "unknown",
      fastboot: {
        product: "dada",
        serial: "FB123456",
        anti: "0",
        verifiedWithAdb: false,
      },
    });
  });

  it("detects Fastboot product and serial after connect", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const { runner, fastboot, detections, compatibilityReports } = createRunner();
    fastboot.serial = "SERIAL123";

    await runner.initialize();
    await runner.connectFastboot();

    expect(detections.at(-1)).toMatchObject({
      fastbootProduct: "dada",
      fastbootSerial: "SERIAL123",
      verified: true,
    });
    expect(fastboot.commands).toContain("getvar:product");
    expect(fastboot.commands).toContain("getvar:serialno");
    expect(fastboot.commands).toContain("getvar:anti");
    expect(compatibilityReports.at(-1)).toMatchObject({
      verdict: "unknown",
      fastboot: { product: "dada", serial: "SERIAL123", anti: "0" },
    });
  });

  it("reads Android version props and emits a compatibility report from ADB", async () => {
    const { runner, adb, detections, compatibilityReports } = createRunner();

    await runner.initialize();
    await runner.connectInitialAdb();

    expect(adb.commands).toEqual(
      expect.arrayContaining([
        "getprop ro.product.device",
        "getprop ro.build.version.release",
        "getprop ro.build.version.security_patch",
        "getprop ro.mi.os.version.name",
      ]),
    );
    expect(detections.at(-1)).toMatchObject({ adbProduct: "dada", verified: false });
    expect(compatibilityReports.at(-1)).toMatchObject({
      modelId: "xiaomi15",
      product: "dada",
      verdict: "compatible",
      adb: {
        androidRelease: "15",
        securityPatch: "2024-12-01",
        hyperOsVersionName: "OS2.0",
      },
    });
  });

  it("normalizes real Xiaomi ADB product props with generic vendor/build values", async () => {
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "";
    adb.props["ro.product.vendor.device"] = "mivendor";
    adb.props["ro.product.system.device"] = "";
    adb.props["ro.product.product.device"] = "";
    adb.props["ro.product.odm.device"] = "";
    adb.props["ro.product.system_ext.device"] = "";
    adb.props["ro.build.product"] = "missi";
    adb.props["ro.product.mod_device"] = "nuwa_tw_global";
    adb.props["ro.build.version.release"] = "15";
    adb.props["ro.build.version.security_patch"] = "2025-11-01";
    adb.props["ro.build.version.incremental"] = "OS2.0.203.0.VMBTWXM";
    adb.props["ro.mi.os.version.name"] = "OS2.0";

    const { runner, detections, compatibilityReports } = createRunner(new TestFastboot(), adb);

    await runner.initialize();
    await expect(runner.connectInitialAdb()).rejects.toMatchObject({ code: "ADB_REQUIRED" });

    expect(adb.commands).toContain("getprop ro.product.mod_device");
    expect(detections.at(-1)).toMatchObject({
      model: expect.objectContaining({ id: "xiaomi13pro", product: "nuwa" }),
      adbProduct: "nuwa",
      verified: false,
    });
    expect(compatibilityReports.at(-1)).toMatchObject({
      modelId: "xiaomi13pro",
      product: "nuwa",
      verdict: "compatible",
      warnings: [],
      adb: {
        securityPatch: "2025-11-01",
        hyperOsVersionName: "OS2.0",
        productProps: expect.objectContaining({
          "ro.product.vendor.device": "mivendor",
          "ro.build.product": "missi",
          "ro.product.mod_device": "nuwa_tw_global",
        }),
      },
    });
  });

  it("verifies Fastboot against the ADB-detected model and records antirollback", async () => {
    const fastboot = new TestFastboot();
    fastboot.serial = "SERIAL-ADBFASTBOOT";
    fastboot.anti = "3";
    const { runner, detections, compatibilityReports } = createRunner(fastboot);

    await runner.initialize();
    await runner.connectInitialAdb();
    await runner.connectFastboot();

    expect(detections.at(-1)).toMatchObject({
      adbProduct: "dada",
      fastbootProduct: "dada",
      fastbootSerial: "SERIAL-ADBFASTBOOT",
      source: "verified",
      verified: true,
    });
    expect(compatibilityReports.at(-1)).toMatchObject({
      verdict: "compatible",
      fastboot: {
        product: "dada",
        serial: "SERIAL-ADBFASTBOOT",
        anti: "3",
        verifiedWithAdb: true,
      },
    });
  });

  it("runs Xiaomi 15 Standard through MQSAS ABL, FTD, payload, restore GPT, and BL/FRP verify", async () => {
    vi.useFakeTimers();

    try {
      const { runner, fastboot, adb, assets, phaseStatuses } = createRunner();

      await runner.initialize();
      await runner.connectInitialAdb();
      await runner.connectFastboot();
      await runner.prepareAssetsForSelectedModel();
      await runner.bootLegacyAblPermissive(true);
      await runner.writeLegacyAblViaMqsas(true);
      await runner.flashFtdPackage(true);

      const unlockPromise = runner.runUnlockPayload(true);
      await vi.runAllTimersAsync();
      await unlockPromise;

      await runner.restoreFinalGpt(true);
      await runner.verifyLegacyUnlock();

      expect(fastboot.commands).toEqual(
        expect.arrayContaining([
          "oem set-gpu-preemption 0 androidboot.selinux=permissive",
          "continue",
          "erase:frp",
          "flash:boot_ab",
          "flash:partition:4",
          "boot",
          "reboot:bootloader",
          "oem device-info",
        ]),
      );
      expect(adb.pushes).toContainEqual(expect.objectContaining({ filename: "/data/local/tmp/abl" }));
      expect(adb.commands).toEqual(
        expect.arrayContaining([
          "getenforce",
          expect.stringContaining("if=/data/local/tmp/abl of=/dev/block/by-name/abl_a"),
          expect.stringContaining("if=/data/local/tmp/abl of=/dev/block/by-name/abl_b"),
          "reboot bootloader",
        ]),
      );
      expect(assets.fetches).toEqual(
        expect.arrayContaining([
          "abl/mi15.elf",
          "packages/xiaomi15/images/anti_version.txt",
          "packages/xiaomi15/images/boot.img",
          "unlock/gpt_both4.bin",
          "unlock/boot.img",
          "packages/xiaomi15/images/gpt_both4.bin",
        ]),
      );
      expect(phaseStatuses.filter(([, status]) => status === "done").map(([phase]) => phase)).toEqual([
        "connect-device",
        "prepare-assets",
        "boot-permissive",
        "write-abl",
        "flash-ftd",
        "unlock-payload",
        "restore-gpt",
        "verify-unlock",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips FTD for the other 8E batch models but still writes ABL and restores partition 4", async () => {
    vi.useFakeTimers();

    try {
      const cases = [
        { id: "xiaomi15ultra", product: "xuanyuan", abl: "abl/mi15u.elf", finalGpt: "packages/xiaomi15ultra/images/gpt_both4.bin", temp: "/data/local/tmp/abl" },
        { id: "redmi-k80pro", product: "miro", abl: "abl/k80pro.elf", finalGpt: "packages/redmi-k80pro/images/gpt_both4.bin", temp: "/data/local/tmp/abl" },
        { id: "redmi-k90", product: "annibale", abl: "abl/K90.elf", finalGpt: "packages/redmi-k90/images/gpt_both4.bin", temp: "/data/local/tmp/abl" },
        { id: "xiaomi-pad8pro", product: "piano", abl: "abl/pad8.elf", finalGpt: "packages/xiaomi-pad8pro/images/gpt_both4.bin", temp: "/data/local/tmp/abl/abl.elf" },
      ];

      for (const item of cases) {
        const adb = new TestAdb();
        adb.props["ro.product.device"] = item.product;
        adb.props["ro.product.vendor.device"] = item.product;
        adb.props["ro.build.product"] = item.product;
        const fastboot = new TestFastboot();
        fastboot.product = item.product;
        const { runner, phaseStatuses, assets } = createRunner(fastboot, adb);

        await runner.initialize();
        await runner.connectInitialAdb();
        await runner.connectFastboot();
        await runner.prepareAssetsForSelectedModel();
        await runner.bootLegacyAblPermissive(true);
        await runner.writeLegacyAblViaMqsas(true);

        const unlockPromise = runner.runUnlockPayload(true);
        await vi.runAllTimersAsync();
        await unlockPromise;

        await runner.restoreFinalGpt(true);
        await runner.verifyLegacyUnlock();

        expect(phaseStatuses.some(([phase]) => phase === "flash-ftd")).toBe(false);
        expect(fastboot.commands).not.toContain("flash:boot_ab");
        expect(fastboot.commands.filter((command) => command === "flash:partition:4")).toHaveLength(2);
        expect(adb.pushes).toContainEqual(expect.objectContaining({ filename: item.temp }));
        expect(assets.fetches).toEqual(expect.arrayContaining([item.abl, "unlock/gpt_both4.bin", "unlock/boot.img", item.finalGpt]));

        if (item.id === "xiaomi-pad8pro") {
          expect(adb.commands).toContain("mkdir -p /data/local/tmp/abl");
        }
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts Redmi K80 Pro dada only as a post-ABL alias for payload, restore, and verify", async () => {
    vi.useFakeTimers();

    try {
      const adb = new TestAdb();
      adb.props["ro.product.device"] = "miro";
      adb.props["ro.product.vendor.device"] = "miro";
      adb.props["ro.build.product"] = "miro";
      const fastboot = new TestFastboot();
      fastboot.product = "miro";
      const { runner, fastboot: connectedFastboot, assets, compatibilityReports, logs } = createRunner(fastboot, adb);

      await runner.initialize();
      await runner.connectInitialAdb();
      await runner.connectFastboot();
      await runner.prepareAssetsForSelectedModel();
      await runner.bootLegacyAblPermissive(true);
      await runner.writeLegacyAblViaMqsas(true);

      fastboot.product = "dada";

      const unlockPromise = runner.runUnlockPayload(true);
      await vi.runAllTimersAsync();
      await unlockPromise;

      await runner.restoreFinalGpt(true);
      await runner.verifyLegacyUnlock();

      expect(connectedFastboot.commands).toEqual(
        expect.arrayContaining(["flash:partition:4", "boot", "reboot:bootloader", "oem device-info", "erase:frp"]),
      );
      expect(connectedFastboot.commands).not.toContain("flash:boot_ab");
      expect(assets.fetches).toEqual(
        expect.arrayContaining([
          "abl/k80pro.elf",
          "unlock/gpt_both4.bin",
          "unlock/boot.img",
          "packages/redmi-k80pro/images/gpt_both4.bin",
        ]),
      );
      expect(assets.fetches).not.toContain("packages/redmi-k80pro/images/boot.img");
      expect(compatibilityReports.at(-1)).toMatchObject({
        modelId: "redmi-k80pro",
        product: "miro",
        fastboot: {
          product: "dada",
          productMatch: "post-abl-alias",
          canonicalProduct: "miro",
        },
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: "warn",
            message: expect.stringContaining("duoc chap nhan la alias sau ABL"),
          }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks Redmi K80 Pro when the first Fastboot verification returns dada", async () => {
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "miro";
    adb.props["ro.product.vendor.device"] = "miro";
    adb.props["ro.build.product"] = "miro";
    const fastboot = new TestFastboot();
    fastboot.product = "dada";
    const { runner, compatibilityReports } = createRunner(fastboot, adb);

    await runner.initialize();
    await runner.connectInitialAdb();

    await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "WRONG_PRODUCT" });
    expect(compatibilityReports.at(-1)).toMatchObject({
      modelId: "redmi-k80pro",
      fastboot: { product: "dada", verifiedWithAdb: false },
      warnings: [expect.stringContaining("Fastboot product dada")],
    });
  });

  it("does not allow a K80 Pro post-ABL alias for destructive terminal commands or FTD", async () => {
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "miro";
    adb.props["ro.product.vendor.device"] = "miro";
    adb.props["ro.build.product"] = "miro";
    const fastboot = new TestFastboot();
    fastboot.product = "miro";
    const { runner } = createRunner(fastboot, adb);

    await runner.initialize();
    await runner.connectInitialAdb();
    await runner.connectFastboot();

    fastboot.product = "dada";

    await expect(runner.runFastbootTerminalCommand("erase userdata", true)).rejects.toMatchObject({
      code: "WRONG_PRODUCT",
    });
    await expect(runner.flashFtdPackage(true)).rejects.toMatchObject({ code: "UNSUPPORTED_PRODUCT" });
    expect(fastboot.commands).not.toContain("erase:userdata");
    expect(fastboot.commands).not.toContain("flash:boot_ab");
  });

  it("blocks Fastboot product mismatch after ADB detection", async () => {
    const fastboot = new TestFastboot();
    fastboot.product = "wrongdevice";
    const { runner, compatibilityReports } = createRunner(fastboot);

    await runner.initialize();
    await runner.connectInitialAdb();

    await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "WRONG_PRODUCT" });
    expect(compatibilityReports.at(-1)).toMatchObject({
      verdict: "warning",
      fastboot: { product: "wrongdevice", verifiedWithAdb: false },
      warnings: [expect.stringContaining("không khớp Fastboot product wrongdevice")],
    });
  });

  it("logs fastboot devices like the CLI", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const { runner, logs } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.runFastbootTerminalCommand("fastboot devices")).resolves.toBe("FB123456\tfastboot");

    expect(logs).toEqual(expect.arrayContaining([expect.objectContaining({ level: "success", message: "FB123456\tfastboot" })]));
  });

  it("falls back to unknown when fastboot devices cannot read a serial", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const fastboot = new TestFastboot();
    fastboot.serial = "";
    const { runner, logs } = createRunner(fastboot);

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.runFastbootTerminalCommand("devices")).resolves.toBe("(unknown)\tfastboot");

    expect(logs).toEqual(expect.arrayContaining([expect.objectContaining({ level: "success", message: "(unknown)\tfastboot" })]));
  });

  it("runs only the simplified FTD phase order", async () => {
    vi.useFakeTimers();

    try {
      const { runner, phaseStatuses, fastboot, assets } = createRunner();

      vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
      runner.setWorkflowMode("edl-standard");
      await runner.initialize();
      await runner.connectFastboot();
      await runner.prepareAssetsForSelectedModel();
      await runner.flashFtdPackage(true);

      // runUnlockPayload has a 5 s delay; advance timers concurrently so the test doesn't hang.
      const unlockPromise = runner.runUnlockPayload(true);
      await vi.runAllTimersAsync();
      await unlockPromise;

      await runner.restoreFinalGpt(true);

      const completedPhases = phaseStatuses.filter(([, status]) => status === "done").map(([phase]) => phase);
      expect(completedPhases).toEqual(["connect-device", "prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt"]);
      expect(fastboot.commands).toEqual(
        expect.arrayContaining([
          "getvar:product",
          "erase:frp",
          "erase:boot_ab",
          "flash:boot_ab",
          "set_active:a",
          "reboot",
          "reboot:bootloader",
          "flash:partition:4",
          "boot",
        ]),
      );
      expect(assets.fetches).toEqual(
        expect.arrayContaining([
          "packages/xiaomi15/images/anti_version.txt",
          "packages/xiaomi15/images/boot.img",
          "unlock/gpt_both4.bin",
          "unlock/boot.img",
          "packages/xiaomi15/images/gpt_both4.bin",
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("probes ABL engineering with erase frp before antirollback and FTD flash", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const { runner, fastboot } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await runner.flashFtdPackage(true);

    const probeIndex = fastboot.commands.indexOf("erase:frp");
    const antiIndex = fastboot.commands.lastIndexOf("getvar:anti");
    const flashIndex = fastboot.commands.indexOf("flash:boot_ab");

    expect(probeIndex).toBeGreaterThan(-1);
    expect(antiIndex).toBeGreaterThan(probeIndex);
    expect(flashIndex).toBeGreaterThan(probeIndex);
  });

  it("blocks flash FTD when device antirollback is higher than the package", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const fastboot = new TestFastboot();
    fastboot.anti = "2";
    const { runner, assets } = createRunner(fastboot);

    await runner.initialize();
    await runner.connectFastboot();

    await expect(runner.flashFtdPackage(true)).rejects.toMatchObject({ code: "ANTIROLLBACK_FAILED" });
    expect(fastboot.commands).toContain("erase:frp");
    expect(fastboot.commands).not.toContain("flash:boot_ab");
    expect(assets.fetches).toContain("packages/xiaomi15/images/anti_version.txt");
  });

  it("warns when security patch is at or after the chip cutoff", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "fuxi";
    adb.props["ro.product.vendor.device"] = "fuxi";
    adb.props["ro.build.product"] = "fuxi";
    adb.props["ro.build.version.security_patch"] = "2026-03-05";

    const { runner, logs, compatibilityReports } = createRunner(new TestFastboot(), adb);
    runner.setWorkflowMode("edl-standard");

    await runner.initialize();
    await runner.connectInitialAdb();

    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: "info", message: "Security patch: 2026-03-05" }),
        expect.objectContaining({
          level: "warn",
          message: expect.stringContaining("security patch 2026-03-05 >= 2026-02-01"),
        }),
      ]),
    );
    expect(compatibilityReports.at(-1)).toMatchObject({
      verdict: "warning",
      warnings: [expect.stringContaining("security patch 2026-03-05 >= 2026-02-01")],
    });
  });

  it("does not warn when security patch is before the chip cutoff", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "fuxi";
    adb.props["ro.product.vendor.device"] = "fuxi";
    adb.props["ro.build.product"] = "fuxi";
    adb.props["ro.build.version.security_patch"] = "2025-08-01";

    const { runner, logs, compatibilityReports } = createRunner(new TestFastboot(), adb);
    runner.setWorkflowMode("edl-standard");

    await runner.initialize();
    await runner.connectInitialAdb();

    expect(logs.some((log) => log.level === "warn" && log.message.includes("security patch"))).toBe(false);
    expect(compatibilityReports.at(-1)).toMatchObject({ verdict: "compatible", warnings: [] });
  });

  it("warns but continues when ADB security patch is missing", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "fuxi";
    adb.props["ro.product.vendor.device"] = "fuxi";
    adb.props["ro.build.product"] = "fuxi";
    adb.props["ro.build.version.security_patch"] = "";

    const { runner, compatibilityReports } = createRunner(new TestFastboot(), adb);
    runner.setWorkflowMode("edl-standard");

    await runner.initialize();
    await runner.connectInitialAdb();

    expect(compatibilityReports.at(-1)).toMatchObject({
      verdict: "warning",
      warnings: [expect.stringContaining("Không đọc được security patch")],
    });
  });

  it("stops flash FTD when erase frp probe fails", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const fastboot = new TestFastboot();
    fastboot.failEraseFrp = true;
    const { runner, phaseStatuses, assets } = createRunner(fastboot);

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.flashFtdPackage(true)).rejects.toMatchObject({ code: "ABL_PROBE_FAILED" });

    expect(phaseStatuses).toContainEqual(["flash-ftd", "failed"]);
    expect(fastboot.commands).toContain("getvar:product");
    expect(fastboot.commands.filter((command) => command === "getvar:anti")).toHaveLength(1);
    expect(fastboot.commands.some((command) => command.startsWith("flash:"))).toBe(false);
    expect(assets.prepareCalls).toEqual([]);
    expect(assets.fetches).toEqual([]);
  });

  it("blocks FTD package phases for models missing mini ENG package", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const fastboot = new TestFastboot();
    fastboot.product = "luming";
    const { runner, assets } = createRunner(fastboot);

    runner.setWorkflowMode("edl-standard");
    await runner.initialize();
    await runner.connectFastboot();

    await expect(runner.prepareAssetsForSelectedModel()).rejects.toMatchObject({ code: "FTD_PACKAGE_MISSING" });
    await expect(runner.flashFtdPackage(true)).rejects.toMatchObject({ code: "FTD_PACKAGE_MISSING" });

    expect(assets.prepareCalls).toEqual([]);
    expect(assets.fetches).toEqual([]);
  });

  it("blocks a raw terminal command without confirmation", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const { runner, fastboot } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.runFastbootTerminalCommand("oem unlock")).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    });
    expect(fastboot.commands).not.toContain("oem unlock");
  });

  it("blocks erase against a mismatched product even when confirmed", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const fastboot = new TestFastboot();
    fastboot.product = "wrongdevice";
    const { runner } = createRunner(fastboot);

    await runner.initialize();
    fastboot.product = "dada";
    await runner.connectFastboot();
    fastboot.product = "wrongdevice";

    await expect(runner.runFastbootTerminalCommand("erase userdata", true)).rejects.toMatchObject({
      code: "WRONG_PRODUCT",
    });
    expect(fastboot.commands).not.toContain("erase:userdata");
  });

  it("runs a confirmed destructive command on the matched product", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const { runner, fastboot } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await runner.runFastbootTerminalCommand("erase cache", true);

    expect(fastboot.commands).toContain("erase:cache");
  });

  it("allows read-only terminal commands without confirmation", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const { runner, fastboot } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.runFastbootTerminalCommand("getvar product")).resolves.toBe("dada");
    await expect(runner.runFastbootTerminalCommand("reboot bootloader")).resolves.toBe("");

    expect(fastboot.commands).toContain("reboot:bootloader");
  });

  it("keeps the default override policy from bypassing legacy workflow gates", async () => {
    const fastboot = new TestFastboot();
    const assets = new TestAssets();
    const { runner } = createRunner(fastboot, new TestAdb(), assets, noOverrideGatePolicy);

    expect(runner.getOverrideGatePolicy()).toEqual(noOverrideGatePolicy);

    await runner.initialize();
    await runner.connectInitialAdb();
    await expect(runner.prepareAssetsForSelectedModel()).rejects.toMatchObject({ code: "WRONG_PRODUCT" });
    expect(assets.prepareCalls).toEqual([]);

    await runner.connectFastboot();
    await expect(runner.runFastbootTerminalCommand("erase userdata")).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    });
    expect(fastboot.commands).not.toContain("erase:userdata");

    fastboot.product = "wrongdevice";
    await expect(runner.runFastbootTerminalCommand("erase userdata", true)).rejects.toMatchObject({
      code: "WRONG_PRODUCT",
    });
    expect(fastboot.commands).not.toContain("erase:userdata");

    fastboot.product = "dada";
    const prepareAssets = vi
      .spyOn(assets, "prepareModelAssets")
      .mockRejectedValue(new Error("hash mismatch in verified asset"));

    await expect(runner.prepareAssetsForSelectedModel()).rejects.toMatchObject({ code: "HASH_MISMATCH" });
    expect(prepareAssets).toHaveBeenCalled();
  });

  it("keeps the default override policy from bypassing antirollback", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const fastboot = new TestFastboot();
    fastboot.anti = "2";
    const { runner, assets } = createRunner(fastboot, new TestAdb(), new TestAssets(), noOverrideGatePolicy);

    await runner.initialize();
    await runner.connectFastboot();

    await expect(runner.flashFtdPackage(true)).rejects.toMatchObject({ code: "ANTIROLLBACK_FAILED" });
    expect(fastboot.commands).toContain("erase:frp");
    expect(fastboot.commands).not.toContain("flash:boot_ab");
    expect(assets.fetches).toContain("packages/xiaomi15/images/anti_version.txt");
  });

  it("keeps the default override policy from bypassing EFISP unlock verification", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "pudding";
    adb.props["ro.product.vendor.device"] = "pudding";
    adb.props["ro.build.product"] = "pudding";
    adb.props["ro.build.version.security_patch"] = "2026-01-01";
    const fastboot = new TestFastboot();
    fastboot.product = "pudding";
    fastboot.unlocked = "no";
    const { runner } = createRunner(fastboot, adb, assets, noOverrideGatePolicy);

    await runner.initialize();
    await runner.connectInitialAdb();
    await runner.connectFastboot();

    await expect(runner.cleanupEfispData(true)).rejects.toMatchObject({ code: "UNLOCK_NOT_VERIFIED" });
    expect(fastboot.commands).not.toEqual(expect.arrayContaining(["erase:efisp", "erase:metadata", "erase:userdata"]));
  });

  it("records manually assumed target models without verified detection", () => {
    const target = newTestManifest().models[0];
    const { runner, detections, compatibilityReports, logs } = createRunner();

    runner.assumeTargetModel(target);

    expect(detections.at(-1)).toMatchObject({
      model: expect.objectContaining({ id: target.id }),
      source: "override",
      verified: false,
      provenance: "manually_assumed",
    });
    expect(compatibilityReports.at(-1)?.fastboot).toMatchObject({
      product: target.product,
      verifiedWithAdb: false,
    });
    expect(compatibilityReports.at(-1)?.fastboot?.productMatch).toBeUndefined();
    expect(logs.some((log) => log.message.includes("manually assumed"))).toBe(true);
  });

  it("normalizes Full Override policy to every supported gate", () => {
    const { runner } = createRunner(new TestFastboot(), new TestAdb(), new TestAssets(), fullOverridePolicy());

    expect(runner.getOverrideGatePolicy()).toEqual({
      mode: "full_override",
      bypassedGates: overrideGateIds,
    });

    runner.setOverrideGatePolicy({ mode: "full_override", bypassedGates: ["payment"] });

    expect(runner.getOverrideGatePolicy()).toEqual({
      mode: "full_override",
      bypassedGates: overrideGateIds,
    });
  });

  it("Full Override bypasses all gates but still fails on missing prepared blobs", async () => {
    const target = newTestManifest().models[0];
    const { runner, fastboot, assets, logs } = createRunner(new TestFastboot(), new TestAdb(), new TestAssets(), fullOverridePolicy());

    await runner.initialize();
    runner.assumeTargetModel(target);

    await expect(runner.runUnlockPayload(false)).rejects.toMatchObject({ code: "ASSET_NOT_PREPARED" });
    expect(fastboot.commands).not.toContain("flash:partition:4");
    expect(assets.prepareCalls).toEqual([]);
    expect(logs.some((log) => log.message.includes("bypassed destructive_confirmation"))).toBe(true);
    expect(logs.some((log) => log.message.includes("bypassed asset_verification"))).toBe(true);
  });

  it("Full Override can bypass EFISP unlock verification without faking unlocked yes", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };
    const fastboot = new TestFastboot();
    fastboot.product = "pudding";
    fastboot.unlocked = "no";
    const target = assets.manifest.models.find((model) => model.id === "xiaomi17")!;
    const { runner, logs } = createRunner(fastboot, new TestAdb(), assets, fullOverridePolicy());

    await runner.initialize();
    runner.assumeTargetModel(target);
    await runner.verifyEfispUnlock();
    await runner.cleanupEfispData(false);

    expect(fastboot.commands).not.toContain("getvar:unlocked");
    expect(fastboot.commands).toEqual(expect.arrayContaining(["erase:efisp", "erase:metadata", "erase:userdata"]));
    expect(logs.some((log) => log.message.includes("Fastboot unlocked:"))).toBe(false);
    expect(logs.some((log) => log.message.includes("bypassed efisp_unlock_verification"))).toBe(true);
    expect(logs.some((log) => log.message.includes("bypassed destructive_confirmation"))).toBe(true);
  });

  it("bypasses destructive confirmation only when selected", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const fastboot = new TestFastboot();
    const { runner, logs } = createRunner(fastboot, new TestAdb(), new TestAssets(), selectivePolicy("destructive_confirmation"));

    await runner.initialize();
    await runner.connectFastboot();
    await runner.runFastbootTerminalCommand("erase cache");

    expect(fastboot.commands).toContain("erase:cache");
    expect(logs.some((log) => log.message.includes("bypassed destructive_confirmation"))).toBe(true);
  });

  it("bypasses antirollback without bypassing real flash data reads", async () => {
    vi.stubEnv("VITE_ALLOW_ADVANCED_EDL", "true");
    const fastboot = new TestFastboot();
    fastboot.anti = "2";
    const { runner, assets, logs } = createRunner(fastboot, new TestAdb(), new TestAssets(), selectivePolicy("antirollback"));

    await runner.initialize();
    await runner.connectFastboot();
    await runner.flashFtdPackage(true);

    expect(fastboot.commands).toContain("flash:boot_ab");
    expect(assets.fetches).not.toContain("packages/xiaomi15/images/anti_version.txt");
    expect(assets.fetches).toContain("packages/xiaomi15/images/boot.img");
    expect(logs.some((log) => log.message.includes("bypassed antirollback"))).toBe(true);
  });

  it("asset verification bypass does not fake missing prepared assets", async () => {
    const fastboot = new TestFastboot();
    const target = newTestManifest().models[0];
    const { runner, assets, logs } = createRunner(fastboot, new TestAdb(), new TestAssets(), selectivePolicy("asset_verification"));

    await runner.initialize();
    runner.assumeTargetModel(target);

    await expect(runner.runUnlockPayload(true)).rejects.toMatchObject({ code: "ASSET_NOT_PREPARED" });
    expect(fastboot.commands).not.toContain("flash:partition:4");
    expect(assets.prepareCalls).toEqual([]);
    expect(logs.some((log) => log.message.includes("bypassed asset_verification"))).toBe(true);
  });

  it("fastboot product bypass does not mark a wrong product as verified", async () => {
    const fastboot = new TestFastboot();
    fastboot.product = "wrongdevice";
    const target = newTestManifest().models[0];
    const { runner, compatibilityReports, logs } = createRunner(
      fastboot,
      new TestAdb(),
      new TestAssets(),
      selectivePolicy("fastboot_product", "destructive_confirmation"),
    );

    await runner.initialize();
    runner.assumeTargetModel(target);
    await runner.runFastbootTerminalCommand("erase cache");

    expect(fastboot.commands).toContain("erase:cache");
    expect(compatibilityReports.at(-1)?.fastboot?.product).toBe("wrongdevice");
    expect(compatibilityReports.at(-1)?.fastboot?.productMatch).toBeUndefined();
    expect(logs.some((log) => log.message.includes("bypassed fastboot_product"))).toBe(true);
  });

  it("compatibility bypass skips EFISP security patch hard block", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "pudding";
    adb.props["ro.product.vendor.device"] = "pudding";
    adb.props["ro.build.product"] = "pudding";
    adb.props["ro.build.version.security_patch"] = "2027-01-01";
    const { runner, logs } = createRunner(new TestFastboot(), adb, assets, selectivePolicy("compatibility"));

    await runner.initialize();
    await expect(runner.connectInitialAdb()).resolves.toMatchObject({ id: "xiaomi17" });

    expect(adb.commands).toContain("reboot bootloader");
    expect(logs.some((log) => log.message.includes("bypassed compatibility"))).toBe(true);
  });

  it("EFISP unlock verification bypass does not fake unlocked yes", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };
    const fastboot = new TestFastboot();
    fastboot.product = "pudding";
    fastboot.unlocked = "no";
    const target = assets.manifest.models.find((model) => model.id === "xiaomi17")!;
    const { runner, logs } = createRunner(
      fastboot,
      new TestAdb(),
      assets,
      selectivePolicy("efisp_unlock_verification"),
    );

    await runner.initialize();
    runner.assumeTargetModel(target);
    await runner.verifyEfispUnlock();
    await runner.cleanupEfispData(true);

    expect(fastboot.commands).not.toContain("getvar:unlocked");
    expect(fastboot.commands).toEqual(expect.arrayContaining(["erase:efisp", "erase:metadata", "erase:userdata"]));
    expect(logs.some((log) => log.message.includes("Fastboot unlocked:"))).toBe(false);
    expect(logs.some((log) => log.message.includes("bypassed efisp_unlock_verification"))).toBe(true);
  });

  it("rejects developer target override when the flag is unset", () => {
    const { runner } = createRunner();
    const target = newTestManifest().models[0];

    expect(() => runner.overrideTargetModel(target)).toThrowError(
      expect.objectContaining({ code: "DEV_OVERRIDE_DISABLED" }),
    );
  });

  it("allows developer target override when the flag is enabled", () => {
    vi.stubEnv("VITE_ALLOW_TARGET_OVERRIDE", "true");

    try {
      const { runner, detections } = createRunner();
      const target = newTestManifest().models[0];

      runner.overrideTargetModel(target);

      expect(detections.at(-1)).toMatchObject({ source: "override", verified: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
