import { describe, expect, it, vi } from "vitest";

import { CryptoAssetClient } from "./cryptoAssetClient";

describe("CryptoAssetClient paid key authorization", () => {
  it("requires a backend firmware key provider for encrypted assets", async () => {
    const client = new CryptoAssetClient("/dist-assets");

    await expect(client.loadFirmwareKey("unlock/payloads/test.bin")).rejects.toMatchObject({
      code: "PAYMENT_REQUIRED",
    });
  });

  it("loads encrypted asset keys through the supplied provider instead of public keys.json", async () => {
    const provider = vi.fn(async () => ({
      "unlock/payloads/test.bin": {
        key: "00".repeat(32),
        iv: "11".repeat(16),
      },
    }));
    const client = new CryptoAssetClient("/dist-assets", provider);

    await client.loadFirmwareKey("unlock/payloads/test.bin");

    expect(provider).toHaveBeenCalledWith(["unlock/payloads/test.bin"]);
  });
});
