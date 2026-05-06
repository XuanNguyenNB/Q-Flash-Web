import { describe, expect, it } from "vitest";

import { toWorkflowError } from "./errors";

describe("toWorkflowError", () => {
  it("preserves generic asset fetch failures", () => {
    const error = toWorkflowError(new Error("Could not fetch manifest.json: HTTP 404"), "ASSET_FETCH_FAILED");

    expect(error.code).toBe("ASSET_FETCH_FAILED");
  });
});
