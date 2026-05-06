import { describe, expect, it } from "vitest";

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
  it("keeps EDL ABL metadata in sync with rawprogram4.xml for all models", () => {
    const models = v1ManifestModels.map((entry) => supportedModelSchema.parse(entry));
    const legacyModels = models.filter((model) => model.family === "legacy-ftd");
    const phoneModels = ["xiaomi15", "xiaomi15pro", "xiaomi15ultra", "redmi-k80pro", "redmi-k90"];

    expect(models).toHaveLength(11);
    expect(legacyModels).toHaveLength(6);
    expect(legacyModels.every((model) => model.edlAbl)).toBe(true);

    for (const model of legacyModels) {
      expect(model.edlAbl).toMatchObject({
        firehoseFile: "firehose/firehose_SM8750.melf",
        firehoseSha256: "95bd33db724706db5da03882c65783d01338df6159ce563be0ce1b963d83668d",
        sectorSize: 4096,
      });
    }

    for (const modelId of phoneModels) {
      expect(models.find((model) => model.id === modelId)?.edlAbl?.targets).toEqual([
        { slot: "a", label: "abl_a", lun: 4, startSector: "121734", maxSectors: 2048 },
        { slot: "b", label: "abl_b", lun: 4, startSector: "367036", maxSectors: 2048 },
      ]);
    }

    expect(models.find((model) => model.id === "xiaomi-pad8pro")?.edlAbl?.targets).toEqual([
      { slot: "a", label: "abl_a", lun: 4, startSector: "58758", maxSectors: 2048 },
      { slot: "b", label: "abl_b", lun: 4, startSector: "241084", maxSectors: 2048 },
    ]);
  });

  it("lists only the shared EFISP payload for 8E Gen 5 models", () => {
    const model = v1ManifestModels.find((entry) => entry.id === "xiaomi17");
    const plan: FlashPlan = {
      modelId: "xiaomi17",
      product: "pudding",
      operations: [{ type: "getvar", name: "product", expect: "pudding" }],
    };

    if (!model) {
      throw new Error("xiaomi17 model fixture missing");
    }

    expect(requiredAssetPathsForModel(model, plan)).toEqual(["efisp/gbl_efi_unlock.efi"]);
    expect(requiredAssetPathsForPhase(model, plan, "write-efisp")).toEqual(["efisp/gbl_efi_unlock.efi"]);
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
      "packages/xiaomi15/images/gpt_both0.bin",
      "packages/xiaomi15/images/gpt_both1.bin",
      "packages/xiaomi15/images/gpt_both2.bin",
      "packages/xiaomi15/images/gpt_both3.bin",
      "packages/xiaomi15/images/gpt_both4.bin",
      "packages/xiaomi15/images/gpt_both5.bin",
      "packages/xiaomi15/images/anti_version.txt",
      "packages/xiaomi15/images/boot.img",
      "packages/xiaomi15/images/vendor_boot.img",
    ]);
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
      "packages/xiaomi15/images/gpt_both0.bin",
      "packages/xiaomi15/images/gpt_both1.bin",
      "packages/xiaomi15/images/gpt_both2.bin",
      "packages/xiaomi15/images/gpt_both3.bin",
      "packages/xiaomi15/images/gpt_both4.bin",
      "packages/xiaomi15/images/gpt_both5.bin",
    ]);
  });

  it("emits detailed download progress metrics", async () => {
    const hash = await sha256Hex("boot");
    const cacheStore = new MemoryAssetCacheStore();
    const client = new ServerAssetClient("/dist-assets", cacheStore);
    const originalFetch = globalThis.fetch;
    const progress: unknown[] = [];

    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url.endsWith("/sha256sums.json")) {
        return Response.json({ "images/boot.img": hash });
      }

      if (url.endsWith("/images/boot.img")) {
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
  });

  it("keeps overall prepare progress monotonic across multiple files", async () => {
    const bootHash = await sha256Hex("boot");
    const vendorHash = await sha256Hex("vendor");
    const cacheStore = new MemoryAssetCacheStore();
    const client = new ServerAssetClient("/dist-assets", cacheStore);
    const originalFetch = globalThis.fetch;
    const progress: Array<number | undefined> = [];

    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url.endsWith("/sha256sums.json")) {
        return Response.json({
          "images/boot.img": bootHash,
          "images/vendor_boot.img": vendorHash,
        });
      }

      if (url.endsWith("/images/boot.img")) {
        return new Response("boot", { headers: { "Content-Length": "4" } });
      }

      if (url.endsWith("/images/vendor_boot.img")) {
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
