import { describe, expect, it } from "vitest";

import { buildAssetUrl, normalizePath } from "./assets";

describe("asset URL helpers", () => {
  it("normalizes slash variants", () => {
    expect(normalizePath("\\packages//xiaomi15\\images\\boot.img")).toBe("packages/xiaomi15/images/boot.img");
  });

  it("builds stable asset URLs", () => {
    expect(buildAssetUrl("https://assets.example.com/root/", "/manifest.json")).toBe(
      "https://assets.example.com/root/manifest.json",
    );
  });

  it("builds R2 release-prefixed asset URLs", () => {
    expect(
      buildAssetUrl(
        "https://assets.example.com/xiaomi-webusb/releases/20260506-001/",
        "/packages/xiaomi15/images/boot.img",
      ),
    ).toBe("https://assets.example.com/xiaomi-webusb/releases/20260506-001/packages/xiaomi15/images/boot.img");
  });
});
