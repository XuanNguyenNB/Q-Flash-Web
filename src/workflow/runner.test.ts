import { describe, expect, it, vi } from "vitest";

import { v1ManifestModels } from "../domain/models";
import type { FlashPlan, Manifest, Sha256Sums, SupportedModel } from "../domain/schemas";
import type { AdbClient, AdbShellResult } from "../services/adb";
import { requiredAssetPathsForModel, type AssetClient, type AssetPrepareProgress } from "../services/assetClient";
import type { EdlClient, EdlProgramTarget } from "../services/edl";
import type { FastbootClient } from "../services/fastboot";
import { WorkflowError } from "./errors";
import { UnlockWorkflowRunner } from "./runner";
import type { ProgressEvent } from "./types";

const testFirehoseSha256 = "88ae91e40c75814ade80f19025a6ad6adfb8f0ac2821d87fbec7dea4c338eccc";

const testManifestModels = v1ManifestModels.map((model) =>
  model.edlAbl
    ? {
        ...model,
        edlAbl: {
          ...model.edlAbl,
          firehoseSha256: testFirehoseSha256,
        },
      }
    : model,
);

const newTestManifest = (): Manifest => JSON.parse(JSON.stringify({ version: 1, models: testManifestModels }));

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
  blobs = new Map<string, Blob>([
    ["abl/mi15.elf", new Blob(["abl"])],
    ["abl/mi15p.elf", new Blob(["abl-pro"])],
    ["abl/mi15u.elf", new Blob(["abl-ultra"])],
    ["abl/k80pro.elf", new Blob(["abl-k80pro"])],
    ["abl/K90.elf", new Blob(["abl-k90"])],
    ["abl/pad8.elf", new Blob(["abl-pad8"])],
    ["efisp/gbl_efi_unlock.efi", new Blob(["efisp-unlock"])],
    ["firehose/firehose_SM8750.melf", new Blob(["firehose"])],
    ["packages/xiaomi15/images/anti_version.txt", new Blob(["1"])],
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
  failPrepare = false;
  prepared = false;
  preparedPaths = new Set<string>();
  hashMismatchPaths = new Set<string>();
  prepareCalls: string[][] = [];
  fetches: string[] = [];

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

  async prepareModelAssets(
    model: SupportedModel,
    plan: FlashPlan,
    onProgress?: (event: AssetPrepareProgress) => void,
  ) {
    await this.prepareAssetPaths(requiredAssetPathsForModel(model, plan), onProgress);
    this.prepared = true;
  }

  async prepareAssetPaths(paths: readonly string[], onProgress?: (event: AssetPrepareProgress) => void) {
    if (this.failPrepare) {
      throw new WorkflowError("ASSET_PREFETCH_FAILED", "prepare failed");
    }

    this.prepareCalls.push([...paths]);

    for (const [index, path] of paths.entries()) {
      if (!this.blobs.has(path)) {
        throw new WorkflowError("ASSET_PREFETCH_FAILED", `missing blob ${path}`);
      }

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
      throw new WorkflowError("ASSET_NOT_PREPARED", `${path} not prepared`);
    }

    if (this.hashMismatchPaths.has(path)) {
      throw new WorkflowError("HASH_MISMATCH", `Hash mismatch for ${path}`);
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
  failFlash = false;
  cancelPicker = false;
  closed = false;
  rawOutput = "";

  async connect() {
    if (this.cancelPicker) {
      throw new DOMException("cancelled", "NotFoundError");
    }
    this.closed = false;
  }

  async close() {
    this.closed = true;
  }

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
    return "";
  }

  async runRaw(command: string) {
    this.commands.push(command);
    return this.rawOutput;
  }

  async erase(partition: string) {
    this.commands.push(`erase:${partition}`);
  }

  async flash(partition: string) {
    if (this.failFlash) {
      throw new Error("fastboot flash failed");
    }
    this.commands.push(`flash:${partition}`);
  }

  async boot() {
    this.commands.push("boot");
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
  unauthorized = false;
  permissive = true;
  closed = false;
  props: Record<string, string> = {
    "ro.product.device": "dada",
    "ro.product.vendor.device": "dada",
    "ro.build.product": "dada",
  };
  commands: string[] = [];

  async connect() {
    if (this.unauthorized) {
      throw new Error("unauthorized");
    }
    this.closed = false;
  }

  async shell(command: string): Promise<AdbShellResult> {
    this.commands.push(command);
    if (command.startsWith("getprop ")) {
      const prop = command.slice("getprop ".length);
      return { stdout: `${this.props[prop] ?? ""}\n`, stderr: "", exitCode: 0 };
    }
    if (command === "getenforce") {
      return { stdout: this.permissive ? "Permissive\n" : "Enforcing\n", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  async push(filename: string) {
    this.commands.push(`push:${filename}`);
  }

  async rebootBootloader() {
    this.commands.push("reboot bootloader");
  }

  async close() {
    this.closed = true;
  }
}

class TestEdl implements EdlClient {
  commands: string[] = [];

  async connect9008() {
    this.commands.push("connect9008");
  }

  async uploadProgrammer() {
    this.commands.push("uploadProgrammer");
  }

  async configureUfs() {
    this.commands.push("configureUfs");
  }

  async programRaw(target: EdlProgramTarget) {
    this.commands.push(
      `program:${target.label}:${target.lun}:${target.startSector}:${target.maxSectors}:${target.sectorSize}`,
    );
  }

  async reset() {
    this.commands.push("reset");
  }

  async close() {
    this.commands.push("close");
  }
}

const createRunner = (
  fastboot: TestFastboot,
  adb: TestAdb,
  assets = new TestAssets(),
  callbacks: Partial<ConstructorParameters<typeof UnlockWorkflowRunner>[0]> = {},
  edl = new TestEdl(),
  family: "legacy-ftd" | "efisp-8e-gen5" = "legacy-ftd",
) => {
  const onPhaseStatus = vi.fn();
  const runner = new UnlockWorkflowRunner({
    assets,
    createFastbootClient: () => fastboot,
    createAdbClient: () => adb,
    createEdlClient: () => edl,
    onPhaseStatus,
    ...callbacks,
  });
  runner.setWorkflowFamily(family);

  return { runner, onPhaseStatus, edl };
};

const initializeConnectAndPrepare = async (runner: UnlockWorkflowRunner) => {
  await runner.initialize();
  await runner.connectFastboot();
  await runner.prepareAssetsForSelectedModel();
};

describe("UnlockWorkflowRunner", () => {
  it("blocks unsupported products", async () => {
    const fastboot = new TestFastboot();
    fastboot.product = "unknown";
    const { runner } = createRunner(fastboot, new TestAdb());

    await runner.initialize();
    await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "UNSUPPORTED_PRODUCT" });
  });

  it("rejects legacy codenames while the EFISP 8E Gen 5 family is selected", async () => {
    const fastboot = new TestFastboot();
    fastboot.product = "annibale";
    const { runner } = createRunner(fastboot, new TestAdb(), undefined, {}, undefined, "efisp-8e-gen5");

    await runner.initialize();
    await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "UNSUPPORTED_PRODUCT" });

    fastboot.product = "xuanyuan";
    await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "UNSUPPORTED_PRODUCT" });
  });

  it("runs the EFISP 8E Gen 5 happy path for Xiaomi 17 pudding", async () => {
    const fastboot = new TestFastboot();
    fastboot.product = "pudding";
    fastboot.unlocked = "yes";
    const adb = new TestAdb();
    adb.props = {
      "ro.product.device": "pudding",
      "ro.product.vendor.device": "pudding",
      "ro.build.product": "pudding",
    };
    const assets = new TestAssets();
    const { runner } = createRunner(fastboot, adb, assets, {}, undefined, "efisp-8e-gen5");

    await runner.initialize();
    await runner.connectFastboot();
    await runner.prepareAssetsForSelectedModel();
    await runner.bootAndroidPermissive();
    await runner.writeEfisp(true);
    await runner.verifyUnlock();
    await runner.cleanupData(true);

    expect(runner.selectedModel?.id).toBe("xiaomi17");
    expect(assets.prepareCalls).toContainEqual(["efisp/gbl_efi_unlock.efi"]);
    expect(fastboot.commands).toContain("oem set-gpu-preemption-value 0 androidboot.selinux=permissive");
    expect(adb.commands).toContain("push:/data/local/tmp/gbl_efi_unlock.efi");
    expect(adb.commands.some((command) => command.includes("of=/dev/block/by-name/efisp"))).toBe(true);
    expect(fastboot.commands).toEqual(expect.arrayContaining(["getvar:unlocked", "erase:efisp", "erase:metadata", "erase:userdata"]));
  });

  it("maps cancelled USB picker to a workflow error", async () => {
    const fastboot = new TestFastboot();
    fastboot.cancelPicker = true;
    const { runner } = createRunner(fastboot, new TestAdb());

    await runner.initialize();
    await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "USB_PICKER_CANCELLED" });
  });

  it("detects the model from initial ADB, reboots bootloader, then verifies Fastboot", async () => {
    const fastboot = new TestFastboot();
    const adb = new TestAdb();
    const { runner, onPhaseStatus } = createRunner(fastboot, adb);

    await runner.initialize();
    await runner.connectInitialAdb();

    expect(runner.selectedModel?.product).toBe("dada");
    expect(adb.commands).toEqual([
      "getprop ro.product.device",
      "getprop ro.product.vendor.device",
      "getprop ro.build.product",
      "reboot bootloader",
    ]);
    expect(onPhaseStatus).toHaveBeenLastCalledWith("connect-device", "running");
    await expect(runner.prepareAssetsForSelectedModel()).rejects.toMatchObject({ code: "WRONG_PRODUCT" });

    await runner.connectFastboot();

    expect(onPhaseStatus).toHaveBeenLastCalledWith("connect-device", "done");
  });

  it("disconnects the browser USB session and clears the locked model without clearing cache state", async () => {
    const fastboot = new TestFastboot();
    const adb = new TestAdb();
    const { runner } = createRunner(fastboot, adb);

    await runner.initialize();
    await runner.connectFastboot();
    await runner.prepareAssetsForSelectedModel();
    await runner.disconnectSession();

    expect(fastboot.closed).toBe(true);
    expect(runner.selectedModel).toBeUndefined();
    expect(adb.closed).toBe(false);
  });

  it("uses developer override target without marking assets as prepared", async () => {
    const assets = new TestAssets();
    const fastboot = new TestFastboot();
    const { runner } = createRunner(fastboot, new TestAdb(), assets);

    await runner.initialize();
    runner.overrideTargetModel(v1ManifestModels.find((model) => model.id === "xiaomi15")!);
    await runner.restoreFinalGpt(true);

    expect(assets.prepareCalls).toHaveLength(1);
    expect(assets.prepareCalls[0]).toEqual([
      "packages/xiaomi15/images/gpt_both0.bin",
      "packages/xiaomi15/images/gpt_both1.bin",
      "packages/xiaomi15/images/gpt_both2.bin",
      "packages/xiaomi15/images/gpt_both3.bin",
      "packages/xiaomi15/images/gpt_both4.bin",
      "packages/xiaomi15/images/gpt_both5.bin",
    ]);
    expect(fastboot.commands).toContain("flash:partition:5");
  });

  it("reboots a verified ADB device to bootloader without completing the current phase", async () => {
    const adb = new TestAdb();
    const onDeviceStatus = vi.fn();
    const { runner, onPhaseStatus } = createRunner(new TestFastboot(), adb, undefined, { onDeviceStatus });

    await runner.initialize();
    runner.overrideTargetModel(v1ManifestModels.find((model) => model.id === "xiaomi15")!);
    await runner.rebootAdbToBootloaderForSelectedModel();

    expect(adb.commands).toEqual([
      "getprop ro.product.device",
      "getprop ro.product.vendor.device",
      "getprop ro.build.product",
      "reboot bootloader",
    ]);
    expect(adb.closed).toBe(true);
    expect(onDeviceStatus).toHaveBeenLastCalledWith("waiting-manual-reboot");
    expect(onPhaseStatus).not.toHaveBeenCalled();
  });

  it("blocks ADB reboot helper when the Android codename does not match the locked model", async () => {
    const adb = new TestAdb();
    adb.props = {
      "ro.product.device": "xuanyuan",
      "ro.product.vendor.device": "xuanyuan",
      "ro.build.product": "xuanyuan",
    };
    const { runner } = createRunner(new TestFastboot(), adb);

    await runner.initialize();
    runner.overrideTargetModel(v1ManifestModels.find((model) => model.id === "xiaomi15")!);

    await expect(runner.rebootAdbToBootloaderForSelectedModel()).rejects.toMatchObject({ code: "WRONG_PRODUCT" });
    expect(adb.commands).not.toContain("reboot bootloader");
    expect(adb.closed).toBe(true);
  });

  it("surfaces ADB authorization errors from the reboot helper without changing the locked target", async () => {
    const adb = new TestAdb();
    adb.unauthorized = true;
    const { runner, onPhaseStatus } = createRunner(new TestFastboot(), adb);

    await runner.initialize();
    runner.overrideTargetModel(v1ManifestModels.find((model) => model.id === "xiaomi15")!);

    await expect(runner.rebootAdbToBootloaderForSelectedModel()).rejects.toMatchObject({ code: "ADB_UNAUTHORIZED" });
    expect(runner.selectedModel?.product).toBe("dada");
    expect(adb.commands).toEqual([]);
    expect(onPhaseStatus).not.toHaveBeenCalled();
  });

  it("keeps standard MQSAS ABL flow from calling EDL", async () => {
    const assets = new TestAssets();
    const adb = new TestAdb();
    const { runner, edl } = createRunner(new TestFastboot(), adb, assets);

    await runner.initialize();
    await runner.connectFastboot();
    await runner.prepareAssetsForSelectedModel();
    await runner.downgradeAbl(true);

    expect(adb.commands).toContain("getenforce");
    expect(adb.commands).toContain("reboot bootloader");
    expect(edl.commands).toEqual([]);
  });

  it("runs C06+ EDL ABL flow for Xiaomi 15 Ultra through downgrade-abl phase", async () => {
    const assets = new TestAssets();
    const model = assets.manifest.models.find((entry) => entry.id === "xiaomi15ultra");
    const { runner, edl } = createRunner(new TestFastboot(), new TestAdb(), assets);

    if (!model) {
      throw new Error("xiaomi15ultra model fixture missing");
    }

    await runner.initialize();
    runner.overrideTargetModel(model);
    runner.setWorkflowMode("c06-edl");
    await runner.downgradeAbl(true);

    expect(assets.prepareCalls).toEqual([["abl/mi15u.elf", "firehose/firehose_SM8750.melf"]]);
    expect(edl.commands).toEqual([
      "connect9008",
      "uploadProgrammer",
      "configureUfs",
      "program:abl_a:4:121734:2048:4096",
      "program:abl_b:4:367036:2048:4096",
      "reset",
      "close",
    ]);
  });

  it("emits operation progress for the C06+ EDL ABL flow", async () => {
    const assets = new TestAssets();
    const model = assets.manifest.models.find((entry) => entry.id === "xiaomi15ultra");
    const progress: ProgressEvent[] = [];
    const { runner } = createRunner(new TestFastboot(), new TestAdb(), assets, {
      onProgress: (event) => progress.push(event),
    });

    if (!model) {
      throw new Error("xiaomi15ultra model fixture missing");
    }

    await runner.initialize();
    runner.overrideTargetModel(model);
    runner.setWorkflowMode("c06-edl");
    await runner.downgradeAbl(true);

    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemLabel: "Sahara upload firehose programmer",
          completedItems: 1,
          totalItems: 4,
          overallProgress: 0.25,
          itemProgress: 1,
        }),
        expect.objectContaining({
          itemLabel: "Configure Firehose UFS",
          completedItems: 2,
          totalItems: 4,
          overallProgress: 0.5,
          itemProgress: 1,
        }),
        expect.objectContaining({
          itemLabel: "Flash abl_a via EDL",
          completedItems: 3,
          totalItems: 4,
          overallProgress: 0.75,
          itemProgress: 1,
        }),
        expect.objectContaining({
          itemLabel: "Flash abl_b via EDL",
          completedItems: 4,
          totalItems: 4,
          overallProgress: 1,
          itemProgress: 1,
        }),
      ]),
    );
  });

  it("uses Pad 8 Pro rawprogram sectors for C06+ EDL ABL", async () => {
    const assets = new TestAssets();
    const model = assets.manifest.models.find((entry) => entry.id === "xiaomi-pad8pro");
    const { runner, edl } = createRunner(new TestFastboot(), new TestAdb(), assets);

    if (!model) {
      throw new Error("xiaomi-pad8pro model fixture missing");
    }

    await runner.initialize();
    runner.overrideTargetModel(model);
    runner.setWorkflowMode("c06-edl");
    await runner.downgradeAbl(true);

    expect(assets.prepareCalls).toEqual([["abl/pad8.elf", "firehose/firehose_SM8750.melf"]]);
    expect(edl.commands).toContain("program:abl_a:4:58758:2048:4096");
    expect(edl.commands).toContain("program:abl_b:4:241084:2048:4096");
  });

  it("blocks C06+ EDL ABL when target model is not verified", async () => {
    const fastboot = new TestFastboot();
    const adb = new TestAdb();
    const { runner, edl } = createRunner(fastboot, adb);

    await runner.initialize();
    await runner.connectInitialAdb();
    runner.setWorkflowMode("c06-edl");

    await expect(runner.downgradeAbl(true)).rejects.toMatchObject({ code: "WRONG_PRODUCT" });
    expect(edl.commands).toEqual([]);
  });

  it("blocks C06+ EDL ABL when the firehose hash mismatches metadata", async () => {
    const assets = new TestAssets();
    const model = assets.manifest.models.find((entry) => entry.id === "xiaomi15ultra");
    const { runner, edl } = createRunner(new TestFastboot(), new TestAdb(), assets);

    if (!model?.edlAbl) {
      throw new Error("xiaomi15ultra EDL metadata missing");
    }

    model.edlAbl.firehoseSha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    await runner.initialize();
    runner.overrideTargetModel(model);
    runner.setWorkflowMode("c06-edl");

    await expect(runner.downgradeAbl(true)).rejects.toMatchObject({ code: "HASH_MISMATCH" });
    expect(edl.commands).toEqual([]);
  });

  it("blocks C06+ EDL ABL when the verified ABL fetch reports a hash mismatch", async () => {
    const assets = new TestAssets();
    const model = assets.manifest.models.find((entry) => entry.id === "xiaomi15ultra");
    const { runner, edl } = createRunner(new TestFastboot(), new TestAdb(), assets);

    if (!model) {
      throw new Error("xiaomi15ultra model fixture missing");
    }

    assets.hashMismatchPaths.add("abl/mi15u.elf");

    await runner.initialize();
    runner.overrideTargetModel(model);
    runner.setWorkflowMode("c06-edl");

    await expect(runner.downgradeAbl(true)).rejects.toMatchObject({ code: "HASH_MISMATCH" });
    expect(edl.commands).toEqual([]);
  });

  it("blocks C06+ EDL ABL when the padded ABL size exceeds the rawprogram limit", async () => {
    const assets = new TestAssets();
    const model = assets.manifest.models.find((entry) => entry.id === "xiaomi15ultra");
    const { runner, edl } = createRunner(new TestFastboot(), new TestAdb(), assets);

    if (!model) {
      throw new Error("xiaomi15ultra model fixture missing");
    }

    assets.blobs.set("abl/mi15u.elf", new Blob([new Uint8Array(2048 * 4096 + 1)]));

    await runner.initialize();
    runner.overrideTargetModel(model);
    runner.setWorkflowMode("c06-edl");

    await expect(runner.downgradeAbl(true)).rejects.toMatchObject({ code: "ASSET_PREFETCH_FAILED" });
    expect(edl.commands).toEqual([]);
  });

  it("blocks prepare-assets when Fastboot product is empty after initial ADB", async () => {
    const fastboot = new TestFastboot();
    fastboot.product = "";
    const { runner } = createRunner(fastboot, new TestAdb());

    await runner.initialize();
    await runner.connectInitialAdb();
    await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "WRONG_PRODUCT" });
    await expect(runner.prepareAssetsForSelectedModel()).rejects.toMatchObject({ code: "WRONG_PRODUCT" });
  });

  it("blocks prepare-assets when initial ADB codename and Fastboot product mismatch", async () => {
    const fastboot = new TestFastboot();
    fastboot.product = "xuanyuan";
    const { runner } = createRunner(fastboot, new TestAdb());

    await runner.initialize();
    await runner.connectInitialAdb();
    await expect(runner.connectFastboot()).rejects.toMatchObject({ code: "WRONG_PRODUCT" });
    await expect(runner.prepareAssetsForSelectedModel()).rejects.toMatchObject({ code: "WRONG_PRODUCT" });
  });

  it("handles ADB unauthorized then succeeds after reconnect", async () => {
    const adb = new TestAdb();
    adb.unauthorized = true;
    const { runner } = createRunner(new TestFastboot(), adb);

    await runner.initialize();
    await runner.connectFastboot();
    await runner.prepareAssetsForSelectedModel();
    await expect(runner.downgradeAbl(true)).rejects.toMatchObject({ code: "ADB_UNAUTHORIZED" });

    adb.unauthorized = false;
    await expect(runner.downgradeAbl(true)).resolves.toBeUndefined();
  });

  it("stops when SELinux is not permissive", async () => {
    const adb = new TestAdb();
    adb.permissive = false;
    const { runner } = createRunner(new TestFastboot(), adb);

    await runner.initialize();
    await runner.connectFastboot();
    await runner.prepareAssetsForSelectedModel();
    await expect(runner.downgradeAbl(true)).rejects.toMatchObject({ code: "SELINUX_NOT_PERMISSIVE" });
  });

  it("stops on antirollback failure", async () => {
    const fastboot = new TestFastboot();
    fastboot.anti = "2";
    const { runner } = createRunner(fastboot, new TestAdb());

    await runner.initialize();
    await runner.connectFastboot();
    await runner.prepareAssetsForSelectedModel();
    await expect(runner.flashFtdPackage(true)).rejects.toMatchObject({ code: "ANTIROLLBACK_FAILED" });
  });

  it("runs the full happy path with mock devices", async () => {
    const fastboot = new TestFastboot();
    const { runner } = createRunner(fastboot, new TestAdb());

    await initializeConnectAndPrepare(runner);
    await runner.bootAndroidPermissive();
    await runner.downgradeAbl(true);
    await runner.flashFtdPackage(true);
    await runner.runUnlockPayload(true);
    await runner.restoreFinalGpt(true);

    expect(fastboot.commands).toContain("oem set-gpu-preemption 0 androidboot.selinux=permissive");
    expect(fastboot.commands).toContain("flash:partition:4");
    expect(fastboot.commands).toContain("flash:partition:5");
    expect(fastboot.commands.at(-1)).toBe("reboot:bootloader");
  });

  it("reboots bootloader before flashing the unlock GPT", async () => {
    const fastboot = new TestFastboot();
    const { runner } = createRunner(fastboot, new TestAdb());

    await initializeConnectAndPrepare(runner);
    await runner.runUnlockPayload(true);

    const rebootIndex = fastboot.commands.indexOf("reboot:bootloader");
    const unlockFlashIndex = fastboot.commands.indexOf("flash:partition:4");

    expect(rebootIndex).toBeGreaterThan(-1);
    expect(unlockFlashIndex).toBeGreaterThan(-1);
    expect(rebootIndex).toBeLessThan(unlockFlashIndex);
  });

  it("runs Fastboot terminal getvar commands through the active client", async () => {
    const fastboot = new TestFastboot();
    const messages: string[] = [];
    const { runner } = createRunner(fastboot, new TestAdb(), new TestAssets(), {
      onLog: (log) => messages.push(log.message),
    });

    await runner.runFastbootTerminalCommand("fastboot getvar product");

    expect(fastboot.commands).toEqual(["getvar:product"]);
    expect(messages).toContain("fastboot getvar product");
    expect(messages).toContain("product=dada");
  });

  it("runs Fastboot terminal reboot bootloader without failing the workflow phase", async () => {
    const fastboot = new TestFastboot();
    const statuses: string[] = [];
    const { runner, onPhaseStatus } = createRunner(fastboot, new TestAdb(), new TestAssets(), {
      onDeviceStatus: (status) => statuses.push(status),
    });

    await runner.runFastbootTerminalCommand("fastboot reboot bootloader");

    expect(fastboot.commands).toEqual(["reboot:bootloader"]);
    expect(statuses).toEqual(["fastboot", "waiting-manual-reboot"]);
    expect(onPhaseStatus).not.toHaveBeenCalled();
  });

  it("surfaces flash failures", async () => {
    const fastboot = new TestFastboot();
    fastboot.failFlash = true;
    const { runner } = createRunner(fastboot, new TestAdb());

    await runner.initialize();
    await runner.connectFastboot();
    await runner.prepareAssetsForSelectedModel();
    await expect(runner.flashFtdPackage(true)).rejects.toBeInstanceOf(WorkflowError);
  });

  it("emits operation progress for the FTD flash plan", async () => {
    const progress: ProgressEvent[] = [];
    const { runner } = createRunner(new TestFastboot(), new TestAdb(), new TestAssets(), {
      onProgress: (event) => progress.push(event),
    });

    await initializeConnectAndPrepare(runner);
    progress.length = 0;
    await runner.flashFtdPackage(true);

    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemLabel: "[1/5] getvar product",
          completedItems: 1,
          totalItems: 5,
          overallProgress: 0.2,
          itemProgress: 1,
        }),
        expect.objectContaining({
          itemLabel: "[3/5] Flash boot_ab",
          completedItems: 3,
          totalItems: 5,
          overallProgress: 0.6,
          itemProgress: 1,
        }),
        expect.objectContaining({
          itemLabel: "[5/5] reboot",
          completedItems: 5,
          totalItems: 5,
          overallProgress: 1,
          itemProgress: 1,
        }),
      ]),
    );
  });

  it("emits operation progress for unlock payload and final GPT restore", async () => {
    const progress: ProgressEvent[] = [];
    const { runner } = createRunner(new TestFastboot(), new TestAdb(), new TestAssets(), {
      onProgress: (event) => progress.push(event),
    });

    await initializeConnectAndPrepare(runner);
    progress.length = 0;
    await runner.runUnlockPayload(true);

    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemLabel: "fastboot reboot bootloader",
          completedItems: 1,
          totalItems: 3,
          overallProgress: 1 / 3,
          itemProgress: 1,
        }),
        expect.objectContaining({
          itemLabel: "Flash partition:4",
          completedItems: 2,
          totalItems: 3,
          overallProgress: 2 / 3,
          itemProgress: 1,
        }),
        expect.objectContaining({
          itemLabel: "Boot unlock payload",
          completedItems: 3,
          totalItems: 3,
          overallProgress: 1,
          itemProgress: 1,
        }),
      ]),
    );

    progress.length = 0;
    await runner.restoreFinalGpt(true);

    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemLabel: "Flash GPT 5",
          completedItems: 6,
          totalItems: 7,
          overallProgress: 6 / 7,
          itemProgress: 1,
        }),
        expect.objectContaining({
          itemLabel: "fastboot reboot bootloader",
          completedItems: 7,
          totalItems: 7,
          overallProgress: 1,
          itemProgress: 1,
        }),
      ]),
    );
  });

  it("prepares all model assets before destructive phases", async () => {
    const assets = new TestAssets();
    const { runner } = createRunner(new TestFastboot(), new TestAdb(), assets);

    await initializeConnectAndPrepare(runner);

    expect(assets.prepareCalls).toHaveLength(1);
    expect(assets.prepareCalls[0]).toEqual([
      "abl/mi15.elf",
      "unlock/gpt_both4.bin",
      "unlock/boot.img",
      "packages/xiaomi15/images/gpt_both0.bin",
      "packages/xiaomi15/images/gpt_both1.bin",
      "packages/xiaomi15/images/gpt_both2.bin",
      "packages/xiaomi15/images/gpt_both3.bin",
      "packages/xiaomi15/images/gpt_both4.bin",
      "packages/xiaomi15/images/gpt_both5.bin",
      "packages/xiaomi15/images/anti_version.txt",
      "packages/xiaomi15/images/boot.img",
    ]);
  });

  it("auto-prepares required assets before boot permissive when resuming", async () => {
    const fastboot = new TestFastboot();
    const assets = new TestAssets();
    const { runner } = createRunner(fastboot, new TestAdb(), assets);

    await runner.initialize();
    await runner.connectFastboot();
    await runner.bootAndroidPermissive();

    expect(assets.prepareCalls).toHaveLength(1);
    expect(fastboot.commands).toContain("oem set-gpu-preemption 0 androidboot.selinux=permissive");
  });

  it("stops when prepare-assets fails before boot permissive", async () => {
    const assets = new TestAssets();
    assets.failPrepare = true;
    const { runner } = createRunner(new TestFastboot(), new TestAdb(), assets);

    await runner.initialize();
    await runner.connectFastboot();
    await expect(runner.prepareAssetsForSelectedModel()).rejects.toMatchObject({ code: "ASSET_PREFETCH_FAILED" });
    await expect(runner.bootAndroidPermissive()).rejects.toMatchObject({ code: "ASSET_PREFETCH_FAILED" });
  });

  it("forwards detailed prepare progress metrics", async () => {
    const progress: AssetPrepareProgress[] = [];
    const assets = new TestAssets();
    const { runner } = createRunner(new TestFastboot(), new TestAdb(), assets, {
      onProgress: (event) => progress.push(event as AssetPrepareProgress),
    });

    await initializeConnectAndPrepare(runner);

    expect(progress[0]).toMatchObject({
      path: "abl/mi15.elf",
      completedFiles: 1,
      totalFiles: 11,
      state: "stored",
    });
  });
});
