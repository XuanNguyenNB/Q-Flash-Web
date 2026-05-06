import { describe, expect, it } from "vitest";

import { sha256Blob, verifySha256Blob } from "./hash";

describe("SHA-256 verification", () => {
  it("hashes and verifies blobs", async () => {
    const blob = new Blob(["abc"]);

    await expect(sha256Blob(blob)).resolves.toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    await expect(verifySha256Blob(blob, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("rejects mismatched blobs", async () => {
    await expect(verifySha256Blob(new Blob(["abc"]), "0".repeat(64))).rejects.toThrow("Hash mismatch");
  });
});
