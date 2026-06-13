import { verifySha256Blob } from "../domain/hash";
import { buildAssetUrl, normalizePath } from "../domain/assets";
import { isEfisp8eModel, isLegacyFtdModel } from "../domain/models";
import {
  flashPlanSchema,
  manifestSchema,
  sha256SumsSchema,
  type FlashPlan,
  type Manifest,
  type Sha256Sums,
  type SupportedModel,
} from "../domain/schemas";
import { WorkflowError } from "../workflow/errors";
import { IndexedDbAssetCacheStore, type AssetCacheStore } from "./assetStore";

type ProgressHandler = (receivedBytes: number, totalBytes?: number) => void;
export type AssetPrepareState = "checking-cache" | "cached" | "downloading" | "verifying" | "stored";

const progressStateLabel: Record<AssetPrepareState, string> = {
  "checking-cache": "Kiểm tra bộ nhớ đệm",
  cached: "Đã có trong bộ nhớ đệm",
  downloading: "Đang tải",
  verifying: "Đang kiểm tra SHA-256",
  stored: "Đã lưu",
};

const now = () => globalThis.performance?.now() ?? Date.now();

const clampProgress = (value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, value));
};

export type AssetPrepareProgress = {
  label: string;
  path: string;
  completedFiles: number;
  totalFiles: number;
  receivedBytes: number;
  totalBytes?: number;
  fileReceivedBytes?: number;
  fileTotalBytes?: number;
  bytesPerSecond?: number;
  etaSeconds?: number;
  state: AssetPrepareState;
  progress?: number;
  overallProgress?: number;
  itemProgress?: number;
  itemLabel?: string;
  completedItems?: number;
  totalItems?: number;
};

export interface AssetClient {
  loadManifest(): Promise<Manifest>;
  loadRootSha256(): Promise<Sha256Sums>;
  loadFlashPlan(packagePath: string): Promise<FlashPlan>;
  loadPackageSha256(packagePath: string): Promise<Sha256Sums>;
  prepareModelAssets(
    model: SupportedModel,
    plan: FlashPlan,
    onProgress?: (event: AssetPrepareProgress) => void,
  ): Promise<void>;
  prepareAssetPaths(paths: readonly string[], onProgress?: (event: AssetPrepareProgress) => void): Promise<void>;
  fetchVerifiedBlob(path: string, onProgress?: ProgressHandler): Promise<Blob>;
}

export const requiredAssetPathsForModel = (model: SupportedModel, plan: FlashPlan) => {
  if (isEfisp8eModel(model)) {
    return [normalizePath(model.efispUnlockFile)];
  }

  const paths = [
    model.ablFile,
    model.unlock.gptBoth4,
    model.unlock.bootImage,
    ...model.finalGpt,
    ...(plan.antiRollbackFile ? [`${model.ftdPackage}/${plan.antiRollbackFile}`] : []),
    ...plan.operations
      .filter((operation) => operation.type === "flash")
      .map((operation) => `${model.ftdPackage}/${operation.file}`),
  ];

  if (isLegacyFtdModel(model) && model.adbExploit) {
    paths.push(model.adbExploit.exploitFile, model.adbExploit.suFile);
  }

  return [...new Set(paths.map(normalizePath))];
};

export type AssetPhase =
  | "boot-permissive"
  | "downgrade-abl"
  | "edl-abl"
  | "write-efisp"
  | "flash-ftd"
  | "unlock-payload"
  | "restore-gpt";

export const requiredAssetPathsForPhase = (model: SupportedModel, plan: FlashPlan, phase: AssetPhase) => {
  if (isEfisp8eModel(model)) {
    return [normalizePath(model.efispUnlockFile)];
  }

  if (!isLegacyFtdModel(model)) {
    return [];
  }

  if (phase === "boot-permissive") {
    return requiredAssetPathsForModel(model, plan);
  }

  if (phase === "downgrade-abl") {
    return [normalizePath(model.ablFile)];
  }

  if (phase === "edl-abl") {
    return [model.ablFile, model.edlAbl?.firehoseFile].filter((path): path is string => Boolean(path)).map(normalizePath);
  }

  if (phase === "flash-ftd") {
    const flashPaths = [
      ...(plan.antiRollbackFile ? [`${model.ftdPackage}/${plan.antiRollbackFile}`] : []),
      ...plan.operations
        .filter((operation) => operation.type === "flash")
        .map((operation) => `${model.ftdPackage}/${operation.file}`),
    ];
    if (model.adbExploit) {
      flashPaths.push(model.adbExploit.exploitFile, model.adbExploit.suFile, model.ablFile);
    }
    return flashPaths.map(normalizePath);
  }

  if (phase === "unlock-payload") {
    return [model.unlock.gptBoth4, model.unlock.bootImage].map(normalizePath);
  }

  return model.finalGpt.map(normalizePath);
};

export const assetCacheKey = (baseUrl: string, path: string, sha256: string) =>
  `${baseUrl.replace(/\/+$/, "")}|${normalizePath(path)}|${sha256.toLowerCase()}`;

export class ServerAssetClient implements AssetClient {
  private rootSha256: Sha256Sums | undefined;
  private packageSha256 = new Map<string, Sha256Sums>();
  private preparedAssetKeys = new Map<string, string>();
  private readonly baseUrl: string;
  private readonly cacheStore: AssetCacheStore;

  constructor(baseUrl: string, cacheStore: AssetCacheStore = new IndexedDbAssetCacheStore()) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.cacheStore = cacheStore;
  }

  async loadManifest(): Promise<Manifest> {
    const manifest = manifestSchema.parse(await this.fetchJson("manifest.json"));
    return {
      ...manifest,
      models: manifest.models.filter(isLegacyFtdModel),
    };
  }

  async loadRootSha256() {
    this.rootSha256 = sha256SumsSchema.parse(await this.fetchJson("sha256sums.json"));
    return this.rootSha256;
  }

  async loadFlashPlan(packagePath: string): Promise<FlashPlan> {
    return flashPlanSchema.parse(await this.fetchJson(`${packagePath}/flash-plan.json`));
  }

  async loadPackageSha256(packagePath: string) {
    const normalizedPackage = normalizePath(packagePath);
    const sums = sha256SumsSchema.parse(await this.fetchJson(`${normalizedPackage}/sha256sums.json`));
    this.packageSha256.set(normalizedPackage, sums);
    return sums;
  }

  async prepareModelAssets(
    model: SupportedModel,
    plan: FlashPlan,
    onProgress?: (event: AssetPrepareProgress) => void,
  ) {
    await this.prepareAssetPaths(requiredAssetPathsForModel(model, plan), onProgress);
  }

  async prepareAssetPaths(pathsInput: readonly string[], onProgress?: (event: AssetPrepareProgress) => void) {
    const paths = [...new Set(pathsInput.map(normalizePath))];
    const totalFiles = paths.length;
    let completedFiles = 0;
    let receivedBytes = 0;
    let knownTotalBytes = 0;
    const startedAt = now();

    const emit = (
      path: string,
      state: AssetPrepareState,
      overrides: Partial<Omit<AssetPrepareProgress, "label" | "path" | "completedFiles" | "totalFiles" | "receivedBytes" | "state">> = {},
    ) => {
      const elapsedSeconds = Math.max(0.001, (now() - startedAt) / 1000);
      const bytesPerSecond = state === "downloading" || state === "stored" ? receivedBytes / elapsedSeconds : undefined;
      const remainingBytes =
        bytesPerSecond && overrides.totalBytes !== undefined ? Math.max(0, overrides.totalBytes - receivedBytes) : undefined;
      const fileProgress =
        overrides.fileReceivedBytes !== undefined && overrides.fileTotalBytes
          ? overrides.fileReceivedBytes / overrides.fileTotalBytes
          : state === "cached" || state === "stored"
            ? 1
            : state === "checking-cache"
              ? 0
              : undefined;
      const overallProgress = clampProgress(overrides.progress);
      const itemProgress = clampProgress(fileProgress);

      onProgress?.({
        label: `${progressStateLabel[state]} ${path}`,
        path,
        completedFiles,
        totalFiles,
        completedItems: completedFiles,
        totalItems: totalFiles,
        receivedBytes,
        bytesPerSecond,
        etaSeconds: remainingBytes !== undefined && bytesPerSecond ? remainingBytes / bytesPerSecond : undefined,
        state,
        overallProgress,
        itemProgress,
        itemLabel: path,
        ...overrides,
      });
    };

    for (const path of paths) {
      const expected = this.expectedHash(path);

      if (!expected) {
        throw new WorkflowError("ASSET_PREFETCH_FAILED", `Thiếu SHA-256 cho ${path}.`);
      }

      emit(path, "checking-cache", { progress: totalFiles ? completedFiles / totalFiles : undefined });
      const key = assetCacheKey(this.baseUrl, path, expected);
      const cached = await this.getCachedAsset(key, path, expected);

      if (cached) {
        try {
          await verifySha256Blob(cached.blob, expected);
        } catch (error) {
          throw new WorkflowError("ASSET_CACHE_FAILED", `Tệp trong bộ nhớ đệm không qua SHA-256: ${path}.`, error);
        }

        completedFiles += 1;
        receivedBytes += cached.blob.size;
        knownTotalBytes += cached.blob.size;
        this.preparedAssetKeys.set(path, key);
        emit(path, "cached", {
          fileReceivedBytes: cached.blob.size,
          fileTotalBytes: cached.blob.size,
          totalBytes: knownTotalBytes,
          progress: completedFiles / totalFiles,
        });
        continue;
      }

      let lastReceivedForFile = 0;
      let expectedTotalForFile: number | undefined;

      let blob: Blob;

      try {
        blob = await this.fetchBlob(path, expected, (current, total) => {
          receivedBytes += Math.max(0, current - lastReceivedForFile);
          lastReceivedForFile = current;
          expectedTotalForFile = total;
          emit(path, "downloading", {
            fileReceivedBytes: current,
            fileTotalBytes: total,
            totalBytes: knownTotalBytes + (total ?? current),
            progress: (completedFiles + (total ? current / total : 0)) / totalFiles,
          });
        });
      } catch (error) {
        throw new WorkflowError("ASSET_PREFETCH_FAILED", `Không tải được ${path}.`, error);
      }

      if (lastReceivedForFile === 0) {
        receivedBytes += blob.size;
      }

      knownTotalBytes += expectedTotalForFile ?? blob.size;
      emit(path, "verifying", {
        fileReceivedBytes: blob.size,
        fileTotalBytes: expectedTotalForFile ?? blob.size,
        totalBytes: knownTotalBytes,
        progress: (completedFiles + 1) / totalFiles,
      });

      try {
        await verifySha256Blob(blob, expected);
      } catch (error) {
        throw new WorkflowError("ASSET_PREFETCH_FAILED", `Không thể tải và kiểm tra ${path}.`, error);
      }

      await this.putCachedAsset({
        key,
        baseUrl: this.baseUrl,
        path,
        sha256: expected,
        blob,
        size: blob.size,
        storedAt: new Date().toISOString(),
      });

      completedFiles += 1;
      this.preparedAssetKeys.set(path, key);
      emit(path, "stored", {
        fileReceivedBytes: blob.size,
        fileTotalBytes: expectedTotalForFile ?? blob.size,
        totalBytes: knownTotalBytes,
        progress: completedFiles / totalFiles,
      });
    }
  }

  async fetchVerifiedBlob(path: string, onProgress?: ProgressHandler) {
    const normalized = normalizePath(path);
    const expected = this.expectedHash(normalized);

    if (!expected) {
      throw new WorkflowError("ASSET_NOT_PREPARED", `Thiếu SHA-256 cho tệp đã chuẩn bị ${normalized}.`);
    }

    const key = assetCacheKey(this.baseUrl, normalized, expected);

    if (this.preparedAssetKeys.get(normalized) !== key) {
      throw new WorkflowError("ASSET_NOT_PREPARED", `${normalized} chưa được chuẩn bị trong phiên hiện tại.`);
    }

    const cached = await this.getCachedAsset(key, normalized, expected);

    if (!cached) {
      throw new WorkflowError("ASSET_CACHE_FAILED", `Tệp đã chuẩn bị không còn trong bộ nhớ đệm trình duyệt: ${normalized}.`);
    }

    onProgress?.(cached.blob.size, cached.blob.size);
    return cached.blob;
  }

  private expectedHash(path: string) {
    const rootMatch = this.rootSha256?.[path];

    if (rootMatch) {
      return rootMatch;
    }

    for (const [packagePath, sums] of this.packageSha256) {
      if (path.startsWith(`${packagePath}/`)) {
        return sums[path.slice(packagePath.length + 1)] ?? sums[path];
      }
    }

    return undefined;
  }

  private async fetchJson(path: string) {
    const response = await fetch(buildAssetUrl(this.baseUrl, path), { cache: "no-store" });

    if (!response.ok) {
      throw new WorkflowError("ASSET_FETCH_FAILED", `Không tải được ${path}: HTTP ${response.status}`);
    }

    return response.json();
  }

  private async fetchBlob(path: string, expectedSha256: string, onProgress?: ProgressHandler) {
    const url = new URL(buildAssetUrl(this.baseUrl, path), globalThis.location?.href ?? "https://asset.local/");
    url.searchParams.set("sha", expectedSha256.slice(0, 16));
    const response = await fetch(url.toString(), { cache: "no-store" });

    if (!response.ok) {
      throw new WorkflowError("ASSET_FETCH_FAILED", `Không tải được ${path}: HTTP ${response.status}`);
    }

    if (!response.body || !onProgress) {
      return response.blob();
    }

    const total = Number(response.headers.get("Content-Length") || 0) || undefined;
    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const copy = new Uint8Array(value.byteLength);
      copy.set(value);
      chunks.push(copy);
      received += value.byteLength;
      onProgress(received, total);
    }

    return new Blob(chunks);
  }

  private async getCachedAsset(key: string, path: string, sha256: string) {
    try {
      const record = await this.cacheStore.get(key);

      if (!record) {
        return undefined;
      }

      if (normalizePath(record.path) !== path || record.sha256.toLowerCase() !== sha256.toLowerCase()) {
        return undefined;
      }

      return record;
    } catch (error) {
      throw new WorkflowError("ASSET_CACHE_FAILED", `Không đọc được bộ nhớ đệm trình duyệt cho ${path}.`, error);
    }
  }

  private async putCachedAsset(record: {
    key: string;
    baseUrl: string;
    path: string;
    sha256: string;
    blob: Blob;
    size: number;
    storedAt: string;
  }) {
    try {
      await this.cacheStore.put(record);
    } catch (error) {
      throw new WorkflowError("ASSET_CACHE_FAILED", `Không ghi được ${record.path} vào bộ nhớ đệm trình duyệt.`, error);
    }
  }
}
