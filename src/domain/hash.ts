export const arrayBufferToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const sha256ArrayBuffer = async (buffer: ArrayBuffer) =>
  arrayBufferToHex(await crypto.subtle.digest("SHA-256", buffer));

export const sha256Blob = async (blob: Blob) => sha256ArrayBuffer(await blob.arrayBuffer());

export const verifySha256Blob = async (blob: Blob, expected: string) => {
  const actual = await sha256Blob(blob);

  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Hash mismatch: expected ${expected}, got ${actual}`);
  }

  return actual;
};
