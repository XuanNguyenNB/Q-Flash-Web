import { describe, expect, it, vi } from "vitest";

vi.mock("../domain/assetTrust", () => ({
  isAssetTrustEnabled: () => false,
  verifyDetachedSignature: async () => undefined,
}));

import { v1ManifestModels } from "../domain/models";
import { supportedModelSchema, type FlashPlan } from "../domain/schemas";
import { requiredAssetPathsForModel, requiredAssetPathsForPhase, ServerAssetClient } from "./assetClient";
import type { CachedAssetRecord, AssetCacheStore } from "./assetStore";

class MemoryAssetCacheStore implements AssetCacheStore {
  records = new Map<string, CachedAssetRecord>();

  async get(key: string) {
    return this.records.get(key);
  }

  async put(record: CachedAssetRecord) {
    this.records.set(record.key, record);
  }
}

const sha256Hex = async (text: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

describe("requiredAssetPathsForModel", () => {
  it("includes legacy FTD and all EFISP Gen 5 models in the v1 runtime manifest", () => {
    const models = v1ManifestModels.map((entry) => supportedModelSchema.parse(entry));
    const legacyModels = models.filter((model) => model.family === "legacy-ftd");
    const efispModels = models.filter((model) => model.family === "efisp-8e-gen5");

    expect(models.length).toBeGreaterThanOrEqual(6);
    expect(legacyModels.length).toBeGreaterThanOrEqual(6);
    expect(efispModels.map((model) => model.product)).toEqual([
      "pudding",
      "pandora",
      "popsicle",
      "nezha",
      "myron",
    ]);
    expect(efispModels.every((model) => model.efispUnlockFile === "efisp/gbl_efi_unlock.efi")).toBe(true);

    const legacyEdlModels = legacyModels.filter((model) => model.edlAbl);
    expect(legacyEdlModels).toHaveLength(6);
    for (const model of legacyEdlModels) {
      expect(model.edlAbl).toMatchObject({
        firehoseFile: "firehose/firehose_SM8750.melf",
        firehoseSha256: "95bd33db724706db5da03882c65783d01338df6159ce563be0ce1b963d83668d",
        sectorSize: 4096,
      });
    }

    const legacyAdbModels = legacyModels.filter((model) => model.adbExploit);
    expect(legacyAdbModels.length).toBeGreaterThan(0);
    for (const model of legacyAdbModels) {
      const paths = model.adbExploit?.candidates?.flatMap((candidate) => [candidate.exploitFile, candidate.suFile]) ??
        [model.adbExploit?.exploitFile, model.adbExploit?.suFile];

      expect(paths.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    }

    expect(legacyModels.filter((model) => model.packageStatus !== "missing-mini-eng")).toHaveLength(24);
    expect(legacyModels.filter((model) => model.packageStatus === "missing-mini-eng")).toHaveLength(2);
  });

  it("lists ABL and firehose for EDL ABL phase", () => {
    const model = v1ManifestModels.find((entry) => entry.id === "xiaomi15");
    const plan: FlashPlan = {
      modelId: "xiaomi15",
      product: "dada",
      operations: [{ type: "flash", partition: "boot_ab", file: "images/boot.img" }],
    };

    if (!model) {
      throw new Error("xiaomi15 model fixture missing");
    }

    expect(requiredAssetPathsForPhase(model, plan, "edl-abl")).toEqual([
      "abl/mi15.elf",
      "firehose/firehose_SM8750.melf",
    ]);
  });

  it("lists ABL, unlock assets, antirollback, FTD flash files, and final GPT files", () => {
    const model = v1ManifestModels.find((entry) => entry.id === "xiaomi15");
    const plan: FlashPlan = {
      modelId: "xiaomi15",
      product: "dada",
      antiRollbackFile: "images/anti_version.txt",
      operations: [
        { type: "getvar", name: "product", expect: "dada" },
        { type: "erase", partition: "boot_ab" },
        { type: "flash", partition: "boot_ab", file: "images/boot.img" },
        { type: "flash", partition: "vendor_boot_ab", file: "images/vendor_boot.img" },
        { type: "set_active", slot: "a" },
        { type: "reboot" },
      ],
    };

    if (!model) {
      throw new Error("xiaomi15 model fixture missing");
    }

    expect(requiredAssetPathsForModel(model, plan)).toEqual([
      "abl/mi15.elf",
      "unlock/gpt_both4.bin",
      "unlock/boot.img",
      "packages/xiaomi15/images/gpt_both4.bin",
      "packages/xiaomi15/images/anti_version.txt",
      "packages/xiaomi15/images/boot.img",
      "packages/xiaomi15/images/vendor_boot.img",
    ]);
  });

  it("does not include FTD package assets for K80 Pro pre-unlock flow", () => {
    const model = v1ManifestModels.find((entry) => entry.id === "redmi-k80pro");
    const plan: FlashPlan = {
      modelId: "redmi-k80pro",
      product: "miro",
      antiRollbackFile: "images/anti_version.txt",
      operations: [
        { type: "flash", partition: "boot_ab", file: "images/boot.img" },
        { type: "flash", partition: "vendor_boot_ab", file: "images/vendor_boot.img" },
      ],
    };

    if (!model) {
      throw new Error("redmi-k80pro model fixture missing");
    }

    expect(requiredAssetPathsForModel(model, plan)).toEqual([
      "abl/k80pro.elf",
      "unlock/gpt_both4.bin",
      "unlock/boot.img",
      "packages/redmi-k80pro/images/gpt_both4.bin",
    ]);
    expect(requiredAssetPathsForPhase(model, plan, "flash-ftd")).toEqual([]);
  });

  it("prepares only the verified shared EFI for EFISP Gen 5", () => {
    const model = v1ManifestModels.find((entry) => entry.id === "xiaomi17");
    const emptyPlan: FlashPlan = {
      modelId: "xiaomi17",
      product: "pudding",
      operations: [],
    };

    if (!model) {
      throw new Error("xiaomi17 model fixture missing");
    }

    expect(requiredAssetPathsForModel(model, emptyPlan)).toEqual(["efisp/gbl_efi_unlock.efi"]);
    expect(requiredAssetPathsForPhase(model, emptyPlan, "write-efisp")).toEqual([
      "efisp/gbl_efi_unlock.efi",
    ]);
  });

  it("uses per-device final GPT assets when a model defines finalGptFile", () => {
    const model = v1ManifestModels.find((entry) => entry.id === "xiaomi14");
    const plan: FlashPlan = {
      modelId: "xiaomi14",
      product: "houji",
      antiRollbackFile: "images/anti_version.txt",
      operations: [
        { type: "getvar", name: "product", expect: "houji" },
        { type: "flash", partition: "abl_ab", file: "images/abl.elf" },
      ],
    };

    if (!model) {
      throw new Error("xiaomi14 model fixture missing");
    }

    const paths = requiredAssetPathsForModel(model, plan);

    expect(paths).toContain("unlock/gpt/14.bin");
    expect(paths).toContain("packages/xiaomi14/images/abl.elf");
    expect(paths).not.toContain("packages/xiaomi14/images/gpt_both0.bin");
    expect(paths).not.toContain("packages/xiaomi14/images/gpt_both5.bin");
  });

  it("keeps EFISP models from server manifests for runtime use", async () => {
    const originalFetch = globalThis.fetch;
    const client = new ServerAssetClient("/dist-assets", new MemoryAssetCacheStore());
    const legacyModel = v1ManifestModels.find((entry) => entry.id === "xiaomi15");

    if (!legacyModel) {
      throw new Error("xiaomi15 model fixture missing");
    }

    globalThis.fetch = async () =>
      Response.json({
        version: 1,
        models: [
          legacyModel,
          {
            id: "xiaomi17",
            name: "Xiaomi 17",
            product: "pudding",
            family: "efisp-8e-gen5",
            efispUnlockFile: "efisp/gbl_efi_unlock.efi",
          },
        ],
      });

    try {
      await expect(client.loadManifest()).resolves.toMatchObject({
        models: [
          expect.objectContaining({ id: "xiaomi15", family: "legacy-ftd" }),
          expect.objectContaining({
            id: "xiaomi17",
            family: "efisp-8e-gen5",
            efispUnlockFile: "efisp/gbl_efi_unlock.efi",
          }),
        ],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("lists only final GPT files for restore-gpt resume", () => {
    const model = v1ManifestModels.find((entry) => entry.id === "xiaomi15");
    const plan: FlashPlan = {
      modelId: "xiaomi15",
      product: "dada",
      operations: [{ type: "flash", partition: "boot_ab", file: "images/boot.img" }],
    };

    if (!model) {
      throw new Error("xiaomi15 model fixture missing");
    }

    expect(requiredAssetPathsForPhase(model, plan, "restore-gpt")).toEqual([
      "packages/xiaomi15/images/gpt_both4.bin",
    ]);
  });

  it("emits detailed download progress metrics", async () => {
    const hash = await sha256Hex("boot");
    const cacheStore = new MemoryAssetCacheStore();
    const client = new ServerAssetClient("/dist-assets", cacheStore);
    const originalFetch = globalThis.fetch;
    const progress: unknown[] = [];
    const blobRequests: Array<{ url: string; cache?: RequestCache }> = [];

    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input), "https://assets.test");

      if (url.pathname.endsWith("/sha256sums.json")) {
        return Response.json({ "images/boot.img": hash });
      }

      if (url.pathname.endsWith("/images/boot.img")) {
        blobRequests.push({ url: url.toString(), cache: init?.cache });
        return new Response("boot", {
          headers: {
            "Content-Length": "4",
          },
        });
      }

      return new Response("{}", { status: 404 });
    };

    try {
      await client.loadRootSha256();
      await client.prepareAssetPaths(["images/boot.img"], (event) => progress.push(event));
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "images/boot.img", state: "checking-cache" }),
        expect.objectContaining({
          path: "images/boot.img",
          state: "stored",
          completedFiles: 1,
          totalFiles: 1,
          completedItems: 1,
          totalItems: 1,
          fileReceivedBytes: 4,
          fileTotalBytes: 4,
          overallProgress: 1,
          itemProgress: 1,
          itemLabel: "images/boot.img",
        }),
      ]),
    );
    expect(cacheStore.records.size).toBe(1);
    expect(blobRequests).toEqual([
      expect.objectContaining({
        cache: "no-store",
        url: expect.stringContaining(`sha=${hash.slice(0, 16)}`),
      }),
    ]);
  });

  it("keeps overall prepare progress monotonic across multiple files", async () => {
    const bootHash = await sha256Hex("boot");
    const vendorHash = await sha256Hex("vendor");
    const cacheStore = new MemoryAssetCacheStore();
    const client = new ServerAssetClient("/dist-assets", cacheStore);
    const originalFetch = globalThis.fetch;
    const progress: Array<number | undefined> = [];

    globalThis.fetch = async (input) => {
      const url = new URL(String(input), "https://assets.test");

      if (url.pathname.endsWith("/sha256sums.json")) {
        return Response.json({
          "images/boot.img": bootHash,
          "images/vendor_boot.img": vendorHash,
        });
      }

      if (url.pathname.endsWith("/images/boot.img")) {
        return new Response("boot", { headers: { "Content-Length": "4" } });
      }

      if (url.pathname.endsWith("/images/vendor_boot.img")) {
        return new Response("vendor", { headers: { "Content-Length": "6" } });
      }

      return new Response("{}", { status: 404 });
    };

    try {
      await client.loadRootSha256();
      await client.prepareAssetPaths(["images/boot.img", "images/vendor_boot.img"], (event) =>
        progress.push(event.overallProgress),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    const numericProgress = progress.filter((value): value is number => value !== undefined);
    expect(numericProgress.length).toBeGreaterThan(0);
    for (let index = 1; index < numericProgress.length; index += 1) {
      expect(numericProgress[index]).toBeGreaterThanOrEqual(numericProgress[index - 1]);
    }
    expect(numericProgress.at(-1)).toBe(1);
  });
});
