import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Manifest } from "../domain/schemas";
import { overrideGateIds } from "../workflow/types";
import { useUnlockWorkflow } from "./useUnlockWorkflow";

const hookManifest = vi.hoisted<() => Manifest>(() => () => ({
  version: 1,
  models: [
    {
      family: "legacy-ftd",
      id: "xiaomi15",
      name: "Xiaomi 15",
      product: "dada",
      chip: "8E",
      ablFile: "abl/mi15.elf",
      ftdPackage: "packages/xiaomi15",
      unlock: { gptBoth4: "unlock/gpt_both4.bin", bootImage: "unlock/boot.img" },
      finalGpt: [
        "packages/xiaomi15/images/gpt_both0.bin",
        "packages/xiaomi15/images/gpt_both1.bin",
        "packages/xiaomi15/images/gpt_both2.bin",
        "packages/xiaomi15/images/gpt_both3.bin",
        "packages/xiaomi15/images/gpt_both4.bin",
        "packages/xiaomi15/images/gpt_both5.bin",
      ],
    },
    {
      family: "efisp-8e-gen5",
      id: "xiaomi17",
      name: "Xiaomi 17",
      product: "pudding",
      efispUnlockFile: "efisp/gbl_efi_unlock.efi",
    },
  ],
}));

vi.mock("../domain/assets", () => ({
  getAssetBaseUrl: () => "/dist-assets",
}));

vi.mock("../services/cryptoAssetClient", () => ({
  CryptoAssetClient: class {
    async loadManifest() {
      return hookManifest();
    }

    async loadRootSha256() {
      return {};
    }
  },
}));

vi.mock("../services/adb", () => ({
  BrowserAdbClient: class {},
}));

vi.mock("../services/fastboot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/fastboot")>();
  return {
    ...actual,
    BrowserFastbootClient: class {},
  };
});

afterEach(() => {
  cleanup();
});

describe("useUnlockWorkflow developer override session", () => {
  it("applies Full Override as every gate while keeping the target manually assumed", async () => {
    const { result } = renderHook(() => useUnlockWorkflow());

    await waitFor(() => expect(result.current.manifest?.models.map((model) => model.id)).toContain("xiaomi15"));

    let applied = false;
    act(() => {
      applied = result.current.applyDeveloperOverrideSession({
        mode: "full_override",
        workflowMode: "standard",
        modelId: "xiaomi15",
        phase: "flash-ftd",
        bypassedGates: [],
      });
    });

    expect(applied).toBe(true);
    expect(result.current.overrideGatePolicy).toEqual({
      mode: "full_override",
      bypassedGates: overrideGateIds,
    });
    expect(result.current.targetDetection).toMatchObject({
      source: "override",
      verified: false,
      provenance: "manually_assumed",
      fastbootProduct: "dada",
    });
    expect(result.current.phaseProvenance).toMatchObject({
      preflight: "manually_assumed",
      "connect-device": "manually_assumed",
      "prepare-assets": "manually_assumed",
    });
    expect(result.current.statuses["flash-ftd"]).toBe("pending");
  });
});
