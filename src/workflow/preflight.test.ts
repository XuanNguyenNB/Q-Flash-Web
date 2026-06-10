import { describe, expect, it } from "vitest";

import { isWorkflowSafetyReady } from "./preflight";
import type { PreflightState } from "./types";

const partialPreflight: PreflightState = {
  isHttps: true,
  hasWebUsb: true,
  backedUp: false,
  acceptsDataLoss: false,
  hasStockRom: false,
};

describe("isWorkflowSafetyReady", () => {
  it("requires full preflight acknowledgements in Standard mode", () => {
    expect(isWorkflowSafetyReady(partialPreflight, "standard")).toBe(false);
    expect(
      isWorkflowSafetyReady(
        {
          ...partialPreflight,
          backedUp: true,
          acceptsDataLoss: true,
          hasStockRom: true,
        },
        "standard",
      ),
    ).toBe(true);
  });

  it("requires only browser safety checks in EDL_Standard mode", () => {
    expect(isWorkflowSafetyReady(partialPreflight, "edl-standard")).toBe(true);
    expect(isWorkflowSafetyReady({ ...partialPreflight, hasWebUsb: false }, "edl-standard")).toBe(false);
  });
});
