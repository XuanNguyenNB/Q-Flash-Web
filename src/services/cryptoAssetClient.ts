import { WorkflowError } from "../workflow/errors";
import { ServerAssetClient } from "./assetClient";

type FirmwareKeys = Record<string, { key: string; iv: string }>;

const ENCRYPTED_PATH_PREFIXES = ["unlock/payloads/", "unlock/gpt/", "ennea/"] as const;

const isEncryptedPath = (path: string) =>
  ENCRYPTED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

const hexToBytes = (hex: string, label: string) => {
  if (typeof hex !== "string" || hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new WorkflowError("ASSET_DECRYPT_FAILED", `Hex khong hop le cho ${label}.`);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.substring(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

export class CryptoAssetClient extends ServerAssetClient {
  private firmwareKeys: FirmwareKeys | undefined;
  private firmwareKeysPromise: Promise<void> | undefined;

  protected resolveFetchPath(path: string) {
    if (isEncryptedPath(path) && !path.endsWith(".enc")) {
      return `${path}.enc`;
    }
    return path;
  }

  protected async decodeBlob(path: string, blob: Blob) {
    if (!isEncryptedPath(path)) {
      return blob;
    }

    await this.loadFirmwareKeys();

    if (!this.firmwareKeys) {
      throw new WorkflowError("ASSET_DECRYPT_FAILED", "Chua tai firmware keys.json.");
    }

    const entry = this.firmwareKeys[path];

    if (!entry) {
      throw new WorkflowError("ASSET_DECRYPT_FAILED", `Thieu key/IV cho ${path} trong firmware keys.`);
    }

    const rawKey = hexToBytes(entry.key, `key cho ${path}`);
    const iv = hexToBytes(entry.iv, `IV cho ${path}`);

    if (rawKey.length !== 32) {
      throw new WorkflowError(
        "ASSET_DECRYPT_FAILED",
        `Key AES cho ${path} phai 32 byte (nhan duoc ${rawKey.length}).`,
      );
    }

    if (iv.length !== 16) {
      throw new WorkflowError(
        "ASSET_DECRYPT_FAILED",
        `IV AES-CBC cho ${path} phai 16 byte (nhan duoc ${iv.length}).`,
      );
    }

    let importedKey: CryptoKey;

    try {
      importedKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-CBC" }, false, ["decrypt"]);
    } catch (error) {
      throw new WorkflowError("ASSET_DECRYPT_FAILED", `Khong the import key AES cho ${path}.`, error);
    }

    const ciphertext = await blob.arrayBuffer();
    let plaintext: ArrayBuffer;

    try {
      // WebCrypto AES-CBC validates and strips PKCS#7 padding per W3C spec — do not strip again.
      plaintext = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, importedKey, ciphertext);
    } catch (error) {
      throw new WorkflowError("ASSET_DECRYPT_FAILED", `Giai ma AES-CBC that bai cho ${path}.`, error);
    }

    return new Blob([plaintext]);
  }

  async loadFirmwareKeys() {
    if (this.firmwareKeys) {
      return;
    }

    if (!this.firmwareKeysPromise) {
      this.firmwareKeysPromise = (async () => {
        try {
          const raw = await this.fetchSignedJson("keys.json");
          this.firmwareKeys = raw as FirmwareKeys;
        } catch (error) {
          this.firmwareKeysPromise = undefined;
          if (error instanceof WorkflowError) {
            throw error;
          }
          throw new WorkflowError("ASSET_DECRYPT_FAILED", "Không tải được firmware keys.json.", error);
        }
      })();
    }

    await this.firmwareKeysPromise;
  }
}
