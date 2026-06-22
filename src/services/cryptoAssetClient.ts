import { WorkflowError } from "../workflow/errors";
import { ServerAssetClient } from "./assetClient";

type FirmwareKeys = Record<string, { key: string; iv: string }>;
export type FirmwareKeyProvider = (paths: readonly string[]) => Promise<FirmwareKeys>;

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
  private readonly firmwareKeyProvider: FirmwareKeyProvider | undefined;

  constructor(baseUrl: string, firmwareKeyProvider?: FirmwareKeyProvider) {
    super(baseUrl);
    this.firmwareKeyProvider = firmwareKeyProvider;
  }

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

    await this.loadFirmwareKey(path);

    const entry = this.firmwareKeys?.[path];

    if (!entry) {
      throw new WorkflowError("PAYMENT_REQUIRED", `Backend chua cap key/IV cho ${path}.`);
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
      // WebCrypto AES-CBC validates and strips PKCS#7 padding per W3C spec; do not strip again.
      plaintext = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, importedKey, ciphertext);
    } catch (error) {
      throw new WorkflowError("ASSET_DECRYPT_FAILED", `Giai ma AES-CBC that bai cho ${path}.`, error);
    }

    return new Blob([plaintext]);
  }

  async loadFirmwareKey(path: string) {
    if (this.firmwareKeys?.[path]) {
      return;
    }

    if (!this.firmwareKeyProvider) {
      throw new WorkflowError("PAYMENT_REQUIRED", "Can thanh toan va nhan unlock pass truoc khi lay khoa giai ma asset.");
    }

    try {
      this.firmwareKeys = {
        ...(this.firmwareKeys ?? {}),
        ...(await this.firmwareKeyProvider([path])),
      };
    } catch (error) {
      if (error instanceof WorkflowError) {
        throw error;
      }
      throw new WorkflowError("PAYMENT_REQUIRED", "Khong lay duoc khoa giai ma asset tu backend.", error);
    }
  }
}
