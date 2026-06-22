import { describe, expect, it } from "vitest";

import { findModelByProduct, v1ManifestModels } from "./models";
import { manifestSchema } from "./schemas";

describe("manifest schema and model matching", () => {
  it("validates v1 manifest models", () => {
    const manifest = manifestSchema.parse({
      version: 1,
      models: v1ManifestModels,
    });

    expect(manifest.models.filter((model) => model.family === "legacy-ftd").length).toBeGreaterThanOrEqual(6);
    expect(manifest.models.filter((model) => model.family === "efisp-8e-gen5")).toHaveLength(5);
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

  it("matches legacy and EFISP models by fastboot product case-insensitively", () => {
    expect(findModelByProduct(v1ManifestModels, "PUDDING")?.id).toBe("xiaomi17");
    expect(findModelByProduct(v1ManifestModels, "PANDORA")?.id).toBe("xiaomi17pro");
    expect(findModelByProduct(v1ManifestModels, "POPSICLE")?.id).toBe("xiaomi17promax");
    expect(findModelByProduct(v1ManifestModels, "NEZHA")?.id).toBe("xiaomi17ultra");
    expect(findModelByProduct(v1ManifestModels, "MYRON")?.id).toBe("redmi-k90promax");
    expect(findModelByProduct(v1ManifestModels, "XUANYUAN")?.id).toBe("xiaomi15ultra");
    expect(findModelByProduct(v1ManifestModels, "PUDDING", "legacy-ftd")).toBeUndefined();
    expect(findModelByProduct(v1ManifestModels, "PUDDING", "efisp-8e-gen5")?.id).toBe("xiaomi17");
    expect(findModelByProduct(v1ManifestModels, "XUANYUAN", "efisp-8e-gen5")).toBeUndefined();
    expect(findModelByProduct(v1ManifestModels, "unknown")).toBeUndefined();
  });

  it("keeps K80 Pro post-ABL aliases out of initial product matching", () => {
    const k80Pro = v1ManifestModels.find((model) => model.id === "redmi-k80pro");

    expect(k80Pro).toMatchObject({
      product: "miro",
      postAblFastbootAliases: ["dada"],
    });
    expect(findModelByProduct(v1ManifestModels, "dada")?.id).toBe("xiaomi15");
    expect(findModelByProduct(v1ManifestModels, "dada")?.id).not.toBe("redmi-k80pro");
  });
});
