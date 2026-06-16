import { describe, expect, it, vi } from "vitest";

import { v1ManifestModels } from "../domain/models";
import type { FlashPlan, Manifest, Sha256Sums, SupportedModel } from "../domain/schemas";
import type { AdbClient, AdbShellResult } from "../services/adb";
import { requiredAssetPathsForModel, type AssetClient, type AssetPrepareProgress } from "../services/assetClient";
import type { FastbootClient } from "../services/fastboot";
import { UnlockWorkflowRunner } from "./runner";
import type { PhaseId, ProgressEvent, TargetDetection, WorkflowLog } from "./types";

const efispManifestModels: SupportedModel[] = [
  { id: "xiaomi17", name: "Xiaomi 17", product: "pudding", family: "efisp-8e-gen5", efispUnlockFile: "efisp/gbl_efi_unlock.efi" },
  { id: "xiaomi17pro", name: "Xiaomi 17 Pro", product: "pandora", family: "efisp-8e-gen5", efispUnlockFile: "efisp/gbl_efi_unlock.efi" },
  { id: "xiaomi17ultra", name: "Xiaomi 17 Ultra", product: "popsicle", family: "efisp-8e-gen5", efispUnlockFile: "efisp/gbl_efi_unlock.efi" },
  { id: "redmi-k90pro", name: "Redmi K90 Pro", product: "nezha", family: "efisp-8e-gen5", efispUnlockFile: "efisp/gbl_efi_unlock.efi" },
  { id: "redmi-k90promax", name: "Redmi K90 Pro Max", product: "myron", family: "efisp-8e-gen5", efispUnlockFile: "efisp/gbl_efi_unlock.efi" },
];

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
    "ro.build.version.security_patch": "2024-12-01",
  };
  commands: string[] = [];

  async connect() {}

  async shell(command: string): Promise<AdbShellResult> {
    this.commands.push(command);
    if (command.startsWith("getprop ")) {
      return { stdout: `${this.props[command.slice("getprop ".length)] ?? ""}\n`, stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  async push() {}

  async rebootBootloader() {
    this.commands.push("reboot bootloader");
  }

  async close() {}
}

const createRunner = (
  fastboot = new TestFastboot(),
  adb = new TestAdb(),
  assets = new TestAssets(),
) => {
  const phaseStatuses: Array<[PhaseId, string]> = [];
  const logs: WorkflowLog[] = [];
  const detections: TargetDetection[] = [];
  const progress: ProgressEvent[] = [];
  const runner = new UnlockWorkflowRunner({
    assets,
    createFastbootClient: () => fastboot,
    createAdbClient: () => adb,
    onPhaseStatus: (phase, status) => phaseStatuses.push([phase, status]),
    onLog: (log) => logs.push(log),
    onModelDetected: (target) => detections.push(target),
    onProgress: (event) => progress.push(event),
  });

  return { runner, fastboot, adb, assets, phaseStatuses, logs, detections, progress };
};

describe("UnlockWorkflowRunner", () => {
  it("rejects Xiaomi 17/EFISP products even when an old manifest contains them", async () => {
    const assets = new TestAssets();
    assets.manifest = { version: 1, models: [...newTestManifest().models, ...efispManifestModels] };

    for (const product of ["pudding", "pandora", "popsicle", "nezha", "myron"]) {
      const fastboot = new TestFastboot();
      fastboot.product = product;
      const { runner } = createRunner(fastboot, new TestAdb(), assets);

      await runner.initialize();
      await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "UNSUPPORTED_PRODUCT" });
    }
  });

  it("detects Fastboot product and serial after connect", async () => {
    const { runner, fastboot, detections } = createRunner();
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
  });

  it("logs fastboot devices like the CLI", async () => {
    const { runner, logs } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.runFastbootTerminalCommand("fastboot devices")).resolves.toBe("FB123456\tfastboot");

    expect(logs).toEqual(expect.arrayContaining([expect.objectContaining({ level: "success", message: "FB123456\tfastboot" })]));
  });

  it("falls back to unknown when fastboot devices cannot read a serial", async () => {
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
          "flash:partition:0",
          "flash:partition:5",
        ]),
      );
      expect(assets.fetches).toEqual(
        expect.arrayContaining([
          "packages/xiaomi15/images/anti_version.txt",
          "packages/xiaomi15/images/boot.img",
          "unlock/gpt_both4.bin",
          "unlock/boot.img",
          "packages/xiaomi15/images/gpt_both0.bin",
          "packages/xiaomi15/images/gpt_both5.bin",
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("probes ABL engineering with erase frp before antirollback and FTD flash", async () => {
    const { runner, fastboot } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await runner.flashFtdPackage(true);

    const probeIndex = fastboot.commands.indexOf("erase:frp");
    const antiIndex = fastboot.commands.indexOf("getvar:anti");
    const flashIndex = fastboot.commands.indexOf("flash:boot_ab");

    expect(probeIndex).toBeGreaterThan(-1);
    expect(antiIndex).toBeGreaterThan(probeIndex);
    expect(flashIndex).toBeGreaterThan(probeIndex);
  });

  it("warns when security patch is at or after the chip cutoff", async () => {
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "fuxi";
    adb.props["ro.product.vendor.device"] = "fuxi";
    adb.props["ro.build.product"] = "fuxi";
    adb.props["ro.build.version.security_patch"] = "2026-03-05";

    const { runner, logs } = createRunner(new TestFastboot(), adb);

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
  });

  it("does not warn when security patch is before the chip cutoff", async () => {
    const adb = new TestAdb();
    adb.props["ro.product.device"] = "fuxi";
    adb.props["ro.product.vendor.device"] = "fuxi";
    adb.props["ro.build.product"] = "fuxi";
    adb.props["ro.build.version.security_patch"] = "2025-08-01";

    const { runner, logs } = createRunner(new TestFastboot(), adb);

    await runner.initialize();
    await runner.connectInitialAdb();

    expect(logs.some((log) => log.level === "warn" && log.message.includes("security patch"))).toBe(false);
  });

  it("stops flash FTD when erase frp probe fails", async () => {
    const fastboot = new TestFastboot();
    fastboot.failEraseFrp = true;
    const { runner, phaseStatuses, assets } = createRunner(fastboot);

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.flashFtdPackage(true)).rejects.toMatchObject({ code: "ABL_PROBE_FAILED" });

    expect(phaseStatuses).toContainEqual(["flash-ftd", "failed"]);
    expect(fastboot.commands).toContain("getvar:product");
    expect(fastboot.commands).not.toContain("getvar:anti");
    expect(fastboot.commands.some((command) => command.startsWith("flash:"))).toBe(false);
    expect(assets.prepareCalls).toEqual([]);
    expect(assets.fetches).toEqual([]);
  });

  it("blocks a raw terminal command without confirmation", async () => {
    const { runner, fastboot } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.runFastbootTerminalCommand("oem unlock")).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    });
    expect(fastboot.commands).not.toContain("oem unlock");
  });

  it("blocks erase against a mismatched product even when confirmed", async () => {
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
    const { runner, fastboot } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await runner.runFastbootTerminalCommand("erase cache", true);

    expect(fastboot.commands).toContain("erase:cache");
  });

  it("allows read-only terminal commands without confirmation", async () => {
    const { runner, fastboot } = createRunner();

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.runFastbootTerminalCommand("getvar product")).resolves.toBe("dada");
    await expect(runner.runFastbootTerminalCommand("reboot bootloader")).resolves.toBe("");

    expect(fastboot.commands).toContain("reboot:bootloader");
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
