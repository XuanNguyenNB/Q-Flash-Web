import { describe, expect, it } from "vitest";

import { findModelByProduct, v1ManifestModels } from "./models";
import { manifestSchema } from "./schemas";

describe("manifest schema and model matching", () => {
  it("validates v1 manifest models", () => {
    const manifest = manifestSchema.parse({
      version: 1,
      models: v1ManifestModels,
    });

    expect(manifest.models).toHaveLength(6);
    expect(manifest.models.every((model) => model.family === "legacy-ftd")).toBe(true);
  });

  it("treats legacy R2 manifests without family as legacy FTD models", () => {
    const legacyModel = v1ManifestModels.find((model) => model.id === "xiaomi15ultra");

    if (!legacyModel || legacyModel.family !== "legacy-ftd") {
      throw new Error("xiaomi15ultra fixture missing");
    }

    const { family: _family, ...legacyWithoutFamily } = legacyModel;
    const manifest = manifestSchema.parse({
      version: 1,
      models: [legacyWithoutFamily],
    });

    expect(manifest.models[0]?.family).toBe("legacy-ftd");
    expect(manifest.models[0]?.id).toBe("xiaomi15ultra");
  });

  it("matches only legacy FTD models by fastboot product case-insensitively", () => {
    expect(findModelByProduct(v1ManifestModels, "PUDDING")).toBeUndefined();
    expect(findModelByProduct(v1ManifestModels, "PANDORA")).toBeUndefined();
    expect(findModelByProduct(v1ManifestModels, "POPSICLE")).toBeUndefined();
    expect(findModelByProduct(v1ManifestModels, "NEZHA")).toBeUndefined();
    expect(findModelByProduct(v1ManifestModels, "MYRON")).toBeUndefined();
    expect(findModelByProduct(v1ManifestModels, "XUANYUAN")?.id).toBe("xiaomi15ultra");
    expect(findModelByProduct(v1ManifestModels, "XUANYUAN", "efisp-8e-gen5")).toBeUndefined();
    expect(findModelByProduct(v1ManifestModels, "unknown")).toBeUndefined();
  });
});
