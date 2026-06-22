import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authorizeAssetKeys,
  consumeUnlockPass,
  createDonation,
  createPaymentOrder,
  getDonation,
  getPaymentOrder,
  type PaymentTarget,
} from "./paymentApi";

const target: PaymentTarget = {
  modelId: "xiaomi15",
  modelName: "Xiaomi 15",
  product: "dada",
  serial: "SERIAL123",
};

const order = {
  id: "order-1",
  orderCode: 123456,
  status: "pending",
  amount: 10000,
  currency: "VND",
  checkoutUrl: "https://pay.payos.vn/mock",
  expiresAt: "2026-06-18T00:10:00.000Z",
  ...target,
};

const pass = {
  id: "pass-1",
  token: "pass-token",
  orderId: order.id,
  status: "active",
  modelId: target.modelId,
  product: target.product,
  serial: target.serial,
  expiresAt: "2026-06-25T00:00:00.000Z",
};

const donation = {
  id: "donation-1",
  orderCode: 654321,
  status: "pending",
  amount: 50000,
  currency: "VND",
  checkoutUrl: "https://pay.payos.vn/donate",
  qrCode: "vietqr-payload",
  provider: "payos",
  providerPaymentLinkId: "link-1",
  createdAt: "2026-06-21T00:00:00.000Z",
  expiresAt: "2026-06-21T00:10:00.000Z",
  updatedAt: "2026-06-21T00:00:00.000Z",
};

describe("paymentApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates and polls payment orders through same-origin /api routes", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ order }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ order: { ...order, status: "paid" }, pass }), { status: 200 }));

    const created = await createPaymentOrder(target);
    const refreshed = await getPaymentOrder("order-1");

    expect(created.order.amount).toBe(10000);
    expect(refreshed.pass?.token).toBe("pass-token");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/payments/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/payments/orders/order-1");
  });

  it("consumes a pass and authorizes asset keys for the detected serial/model only", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ pass: { ...pass, status: "consumed" }, mode: "consumed" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            keys: {
              "unlock/payloads/test.bin": {
                key: "00".repeat(32),
                iv: "11".repeat(16),
              },
            },
          }),
          { status: 200 },
        ),
      );

    const consumed = await consumeUnlockPass("pass token", target);
    const keys = await authorizeAssetKeys("pass token", target, ["unlock/payloads/test.bin"]);

    expect(consumed.mode).toBe("consumed");
    expect(keys.keys["unlock/payloads/test.bin"].key).toBe("00".repeat(32));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/passes/pass%20token/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: target.modelId,
        product: target.product,
        serial: target.serial,
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/assets/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "pass token",
        modelId: target.modelId,
        product: target.product,
        serial: target.serial,
        paths: ["unlock/payloads/test.bin"],
      }),
    });
  });

  it("creates and polls anonymous donation orders without unlock target data", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ donation }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ donation: { ...donation, status: "paid" } }), { status: 200 }));

    const created = await createDonation(50000);
    const refreshed = await getDonation("donation-1");

    expect(created.donation.qrCode).toBe("vietqr-payload");
    expect(refreshed.donation.status).toBe("paid");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 50000 }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/donations/donation-1");
  });
});
