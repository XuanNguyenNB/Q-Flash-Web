import { createHmac, timingSafeEqual } from "node:crypto";

type SignableValue = string | number | boolean | null | undefined;
export type SignablePayload = Record<string, SignableValue>;

export const serializePayosPayload = (payload: SignablePayload) =>
  Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key] ?? ""}`)
    .join("&");

export const createPayosSignature = (payload: SignablePayload, checksumKey: string) =>
  createHmac("sha256", checksumKey).update(serializePayosPayload(payload)).digest("hex");

export const verifyPayosSignature = (payload: SignablePayload, signature: string, checksumKey: string) => {
  if (!signature || !/^[0-9a-fA-F]+$/.test(signature)) {
    return false;
  }

  const expected = createPayosSignature(payload, checksumKey);
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
};
