import { v1ManifestModels } from "../domain/models";
import type { FlashPlan, Manifest, Sha256Sums, SupportedModel } from "../domain/schemas";
import type { AdbClient, AdbShellResult } from "./adb";
import {
  requiredAssetPathsForModel,
  requiredAssetPathsForPhase,
  type AssetClient,
  type AssetPrepareProgress,
} from "./assetClient";
import type { EdlClient, EdlProgramTarget } from "./edl";
import type { FastbootClient } from "./fastboot";

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export const blazerMockModel = v1ManifestModels.find((model) => model.id === "xiaomi15ultra")!;

const mockBlob = (path: string) =>
  new Blob([path.endsWith("anti_version.txt") ? "0\n" : `mock blazer asset for ${path}`], {
    type: "application/octet-stream",
  });

export class BlazerMockAssetClient implements AssetClient {
  private prepared = new Set<string>();
  private plan: FlashPlan = {
    modelId: "xiaomi15ultra",
    product: "xuanyuan",
    antiRollbackFile: "images/anti_version.txt",
    operations: [
      { type: "getvar", name: "product", expect: "xuanyuan" },
      { type: "getvar", name: "anti" },
      { type: "erase", partition: "boot_ab" },
      { type: "flash", partition: "boot_ab", file: "images/boot.img" },
      { type: "flash", partition: "vendor_boot_ab", file: "images/vendor_boot.img" },
      { type: "set_active", slot: "a" },
      { type: "reboot" },
    ],
  };

  async loadManifest(): Promise<Manifest> {
    await delay(80);
    return { version: 1, models: [...v1ManifestModels] };
  }

  async loadRootSha256(): Promise<Sha256Sums> {
    await delay(40);
    return {};
  }

  async loadFlashPlan(): Promise<FlashPlan> {
    await delay(60);
    return this.plan;
  }

  async loadPackageSha256(): Promise<Sha256Sums> {
    await delay(40);
    return {};
  }

  async prepareModelAssets(model: SupportedModel, plan: FlashPlan, onProgress?: (event: AssetPrepareProgress) => void) {
    await this.prepareAssetPaths(requiredAssetPathsForModel(model, plan), onProgress);
  }

  async prepareAssetPaths(paths: readonly string[], onProgress?: (event: AssetPrepareProgress) => void) {
    const uniquePaths = [...new Set(paths)];
    const totalFiles = uniquePaths.length;
    let receivedBytes = 0;
    const totalBytes = totalFiles * 1024 * 1024;

    for (const [index, path] of uniquePaths.entries()) {
      const completedFiles = index;

      onProgress?.({
        label: `[MOCK blazer] Checking cache ${path}`,
        path,
        completedFiles,
        totalFiles,
        completedItems: completedFiles,
        totalItems: totalFiles,
        receivedBytes,
        totalBytes,
        state: "checking-cache",
        progress: index / totalFiles,
        overallProgress: index / totalFiles,
        itemProgress: 0,
        itemLabel: path,
      });
      await delay(50);

      for (let chunk = 1; chunk <= 4; chunk += 1) {
        const fileReceivedBytes = chunk * 256 * 1024;
        receivedBytes = index * 1024 * 1024 + fileReceivedBytes;
        onProgress?.({
          label: `[MOCK blazer] Downloading ${path}`,
          path,
          completedFiles,
          totalFiles,
          completedItems: completedFiles,
          totalItems: totalFiles,
          receivedBytes,
          totalBytes,
          fileReceivedBytes,
          fileTotalBytes: 1024 * 1024,
          bytesPerSecond: 3.5 * 1024 * 1024,
          etaSeconds: Math.max(0, (totalBytes - receivedBytes) / (3.5 * 1024 * 1024)),
          state: "downloading",
          progress: (index + chunk / 4) / totalFiles,
          overallProgress: (index + chunk / 4) / totalFiles,
          itemProgress: chunk / 4,
          itemLabel: path,
        });
        await delay(60);
      }

      this.prepared.add(path);
      onProgress?.({
        label: `[MOCK blazer] Stored ${path}`,
        path,
        completedFiles: index + 1,
        totalFiles,
        completedItems: index + 1,
        totalItems: totalFiles,
        receivedBytes,
        totalBytes,
        fileReceivedBytes: 1024 * 1024,
        fileTotalBytes: 1024 * 1024,
        bytesPerSecond: 3.5 * 1024 * 1024,
        etaSeconds: Math.max(0, (totalBytes - receivedBytes) / (3.5 * 1024 * 1024)),
        state: "stored",
        progress: (index + 1) / totalFiles,
        overallProgress: (index + 1) / totalFiles,
        itemProgress: 1,
        itemLabel: path,
      });
    }
  }

  async fetchVerifiedBlob(path: string, onProgress?: (receivedBytes: number, totalBytes?: number) => void) {
    if (!this.prepared.has(path)) {
      const phasePaths = requiredAssetPathsForPhase(blazerMockModel, this.plan, "unlock-payload");
      if (!phasePaths.includes(path)) {
        this.prepared.add(path);
      }
    }

    const blob = mockBlob(path);
    onProgress?.(blob.size, blob.size);
    await delay(40);
    return blob;
  }
}

export class BlazerMockFastbootClient implements FastbootClient {
  async connect() {
    await delay(80);
  }

  async close() {
    await delay(20);
  }

  async getvar(name: string) {
    await delay(50);
    if (name === "product") {
      return "xuanyuan";
    }
    if (name === "anti") {
      return "0";
    }
    return "";
  }

  async runRaw() {
    await delay(120);
    return "[MOCK blazer] OKAY";
  }

  async erase() {
    await delay(100);
  }

  async flash(_partition: string, _blob: Blob, onProgress?: (progress: number) => void) {
    for (const progress of [0.15, 0.35, 0.62, 0.88, 1]) {
      onProgress?.(progress);
      await delay(90);
    }
  }

  async boot(_blob: Blob, onProgress?: (progress: number) => void) {
    for (const progress of [0.25, 0.55, 0.85, 1]) {
      onProgress?.(progress);
      await delay(80);
    }
  }

  async setActive() {
    await delay(80);
  }

  async reboot() {
    await delay(120);
  }

  async rebootBootloaderAndWait(onReconnect?: () => void) {
    onReconnect?.();
    await delay(180);
  }
}

export class BlazerMockEdlClient implements EdlClient {
  async connect9008() {
    await delay(80);
  }

  async uploadProgrammer(_blob: Blob, onProgress?: (progress: number) => void) {
    for (const progress of [0.2, 0.45, 0.75, 1]) {
      onProgress?.(progress);
      await delay(60);
    }
  }

  async configureUfs() {
    await delay(80);
  }

  async programRaw(_target: EdlProgramTarget, _blob: Blob, onProgress?: (progress: number) => void) {
    for (const progress of [0.25, 0.55, 0.85, 1]) {
      onProgress?.(progress);
      await delay(70);
    }
  }

  async reset() {
    await delay(80);
  }

  async close() {
    await delay(20);
  }
}

export class BlazerMockAdbClient implements AdbClient {
  async connect() {
    await delay(80);
  }

  async shell(command: string): Promise<AdbShellResult> {
    await delay(80);
    if (command.startsWith("getprop ")) {
      return { stdout: "blazer\n", stderr: "", exitCode: 0 };
    }
    if (command === "getenforce") {
      return { stdout: "Permissive\n", stderr: "", exitCode: 0 };
    }
    return { stdout: "[MOCK blazer] OK\n", stderr: "", exitCode: 0 };
  }

  async push() {
    await delay(120);
  }

  async rebootBootloader() {
    await delay(120);
  }

  async close() {
    await delay(20);
  }
}
