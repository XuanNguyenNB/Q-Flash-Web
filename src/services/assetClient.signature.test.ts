import { afterEach, describe, expect, it, vi } from "vitest";

import type { AssetCacheStore, CachedAssetRecord } from "./assetStore";

class MemoryAssetCacheStore implements AssetCacheStore {
  records = new Map<string, CachedAssetRecord>();

  async get(key: string) {
    return this.records.get(key);
  }

  async put(record: CachedAssetRecord) {
    this.records.set(record.key, record);
  }
}

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

const sums = { "images/boot.img": "a".repeat(64) };
const body = `${JSON.stringify(sums, null, 2)}\n`;
const bodyBytes = new TextEncoder().encode(body);

type SignedFixture = {
  publicKeyB64: string;
  sigB64: string;
};

const buildSignedFixture = async (): Promise<SignedFixture> => {
  const keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, keyPair.privateKey, bodyBytes));

  return { publicKeyB64: toBase64(spki), sigB64: toBase64(signature) };
};

const loadClient = async (publicKeyB64: string) => {
  vi.resetModules();
  vi.stubEnv("VITE_ASSET_PUBLIC_KEY", publicKeyB64);
  const { ServerAssetClient } = await import("./assetClient");
  return new ServerAssetClient("/dist-assets", new MemoryAssetCacheStore());
};

describe("asset signature verification", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts sha256sums.json with a valid Ed25519 signature", async () => {
    const { publicKeyB64, sigB64 } = await buildSignedFixture();

    globalThis.fetch = async (input) => {
      const url = new URL(String(input), "https://assets.test");
      if (url.pathname.endsWith("/sha256sums.json.sig")) {
        return new Response(sigB64);
      }
      if (url.pathname.endsWith("/sha256sums.json")) {
        return new Response(body);
      }
      return new Response("{}", { status: 404 });
    };

    const client = await loadClient(publicKeyB64);
    await expect(client.loadRootSha256()).resolves.toEqual(sums);
  });

  it("rejects a tampered body whose signature no longer matches", async () => {
    const { publicKeyB64, sigB64 } = await buildSignedFixture();

    globalThis.fetch = async (input) => {
      const url = new URL(String(input), "https://assets.test");
      if (url.pathname.endsWith("/sha256sums.json.sig")) {
        return new Response(sigB64);
      }
      if (url.pathname.endsWith("/sha256sums.json")) {
        // Tampered: a different mapping the original signature does not cover.
        return new Response(`${JSON.stringify({ "images/boot.img": "b".repeat(64) }, null, 2)}\n`);
      }
      return new Response("{}", { status: 404 });
    };

    const client = await loadClient(publicKeyB64);
    await expect(client.loadRootSha256()).rejects.toMatchObject({ code: "ASSET_SIGNATURE_INVALID" });
  });

  it("rejects when the .sig file is missing", async () => {
    const { publicKeyB64 } = await buildSignedFixture();

    globalThis.fetch = async (input) => {
      const url = new URL(String(input), "https://assets.test");
      if (url.pathname.endsWith("/sha256sums.json.sig")) {
        return new Response("not found", { status: 404 });
      }
      if (url.pathname.endsWith("/sha256sums.json")) {
        return new Response(body);
      }
      return new Response("{}", { status: 404 });
    };

    const client = await loadClient(publicKeyB64);
    await expect(client.loadRootSha256()).rejects.toMatchObject({ code: "ASSET_SIGNATURE_MISSING" });
  });
});
