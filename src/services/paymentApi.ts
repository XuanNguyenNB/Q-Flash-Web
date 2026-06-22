export type PaymentOrder = {
  id: string;
  orderCode: number;
  status: "pending" | "paid" | "expired" | "cancelled" | "failed";
  amount: number;
  currency: string;
  modelId: string;
  modelName: string;
  product: string;
  serial: string;
  checkoutUrl: string;
  expiresAt: string;
  paidAt?: string;
};

export type UnlockPass = {
  id: string;
  token: string;
  orderId: string;
  status: "active" | "consumed" | "expired" | "revoked";
  modelId: string;
  product: string;
  serial: string;
  expiresAt: string;
  consumedAt?: string;
  retryUntil?: string;
};

export type FirmwareKeys = Record<string, { key: string; iv: string }>;

export type Donation = {
  id: string;
  orderCode: number;
  status: "pending" | "paid" | "expired" | "cancelled" | "failed";
  amount: number;
  currency: string;
  checkoutUrl: string;
  qrCode: string;
  provider: string;
  providerPaymentLinkId?: string;
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
  updatedAt: string;
};

export type PaymentTarget = {
  modelId: string;
  modelName: string;
  product: string;
  serial: string;
};

const readJson = async <T>(response: Response): Promise<T> => {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error?: { message?: string } }).error?.message ?? "Payment API failed.")
        : `Payment API failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
};

export const createPaymentOrder = async (target: PaymentTarget) => {
  const response = await fetch("/api/payments/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  });
  return readJson<{ order: PaymentOrder; pass?: UnlockPass }>(response);
};

export const getPaymentOrder = async (orderId: string) => {
  const response = await fetch(`/api/payments/orders/${encodeURIComponent(orderId)}`);
  return readJson<{ order: PaymentOrder; pass?: UnlockPass }>(response);
};

export const createDonation = async (amount: number) => {
  const response = await fetch("/api/donations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  return readJson<{ donation: Donation }>(response);
};

export const getDonation = async (donationId: string) => {
  const response = await fetch(`/api/donations/${encodeURIComponent(donationId)}`);
  return readJson<{ donation: Donation }>(response);
};

export const consumeUnlockPass = async (passToken: string, target: PaymentTarget) => {
  const response = await fetch(`/api/passes/${encodeURIComponent(passToken)}/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId: target.modelId,
      product: target.product,
      serial: target.serial,
    }),
  });
  return readJson<{ pass: UnlockPass; mode: "consumed" | "retry" }>(response);
};

export const authorizeAssetKeys = async (passToken: string, target: PaymentTarget, paths: readonly string[]) => {
  const response = await fetch("/api/assets/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: passToken,
      modelId: target.modelId,
      product: target.product,
      serial: target.serial,
      paths,
    }),
  });
  return readJson<{ keys: FirmwareKeys }>(response);
};
