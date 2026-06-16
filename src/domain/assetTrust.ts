import { WorkflowError } from "../workflow/errors";

const PUBLIC_KEY_BASE64 = (import.meta.env.VITE_ASSET_PUBLIC_KEY ?? "").trim();

const base64ToBytes = (b64: string) => {
  const cleaned = b64.replace(/\s+/g, "");

  if (!cleaned) {
    return new Uint8Array(0);
  }

  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

let publicKeyPromise: Promise<CryptoKey | undefined> | undefined;

const importPublicKey = async (): Promise<CryptoKey | undefined> => {
  if (!PUBLIC_KEY_BASE64) {
    return undefined;
  }

  const spki = base64ToBytes(PUBLIC_KEY_BASE64);

  try {
    return await crypto.subtle.importKey("spki", spki, { name: "Ed25519" }, false, ["verify"]);
  } catch (error) {
    throw new WorkflowError(
      "ASSET_SIGNATURE_INVALID",
      "Public key Ed25519 không hợp lệ — kiểm tra lại VITE_ASSET_PUBLIC_KEY (SPKI base64).",
      error,
    );
  }
};

export const isAssetTrustEnabled = () => Boolean(PUBLIC_KEY_BASE64);

export const verifyDetachedSignature = async (bytes: Uint8Array, signatureB64: string) => {
  if (!PUBLIC_KEY_BASE64) {
    return;
  }

  if (!publicKeyPromise) {
    publicKeyPromise = importPublicKey();
  }

  const key = await publicKeyPromise;

  if (!key) {
    return;
  }

  const trimmed = signatureB64.trim();

  if (!trimmed) {
    throw new WorkflowError("ASSET_SIGNATURE_MISSING", "Chữ ký Ed25519 rỗng.");
  }

  let signature: Uint8Array;

  try {
    signature = base64ToBytes(trimmed);
  } catch (error) {
    throw new WorkflowError("ASSET_SIGNATURE_INVALID", "Chữ ký Ed25519 không phải base64 hợp lệ.", error);
  }

  const toArrayBuffer = (view: Uint8Array) => {
    const copy = new Uint8Array(view.byteLength);
    copy.set(view);
    return copy.buffer;
  };

  let valid: boolean;

  try {
    valid = await crypto.subtle.verify({ name: "Ed25519" }, key, toArrayBuffer(signature), toArrayBuffer(bytes));
  } catch (error) {
    throw new WorkflowError("ASSET_SIGNATURE_INVALID", "Không xác thực được chữ ký Ed25519.", error);
  }

  if (!valid) {
    throw new WorkflowError("ASSET_SIGNATURE_INVALID");
  }
};
