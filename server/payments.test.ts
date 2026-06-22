// @vitest-environment node

import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { AssetKeyStore } from "./src/assets/keyStore.js";
import type { ServerConfig } from "./src/config.js";
import {
  DONATION_MAX_VND,
  DONATION_MIN_VND,
  DONATION_TTL_MS,
  ORDER_TTL_MS,
  PASS_TTL_MS,
  PaymentStore,
  RETRY_TTL_MS,
} from "./src/db/store.js";
import { MockPaymentProvider } from "./src/payments/provider.js";
import { createPayosSignature, serializePayosPayload, verifyPayosSignature } from "./src/payos/signature.js";
import { createApp } from "./src/routes.js";

const baseTime = new Date("2026-06-18T00:00:00.000Z");

const testConfig = (): ServerConfig => ({
  port: 0,
  databasePath: ":memory:",
  provider: "mock",
  publicBaseUrl: "http://localhost:5173",
  adminToken: "test-admin",
  developerOverride: {
    sessionTtlMs: 15 * 60 * 1000,
    cookieName: "qflash_dev_override",
  },
  payos: {
    checksumKey: "test_checksum_key",
    returnUrl: "http://localhost:5173/payment/return",
    cancelUrl: "http://localhost:5173/payment/cancel",
    webhookUrl: "http://localhost:8787/api/payments/webhook/payos",
  },
});

const createOrder = (store: PaymentStore, orderCode = 10001) =>
  store.createOrder({
    orderCode,
    modelId: "xiaomi15ultra",
    modelName: "Xiaomi 15 Ultra",
    product: "xuanyuan",
    serial: "SERIAL123",
    provider: "mock",
    checkoutUrl: "http://localhost/checkout",
    providerPaymentLinkId: `mock-${orderCode}`,
    now: baseTime,
  });

const createDonation = (store: PaymentStore, orderCode = 20001, amount = 50000) =>
  store.createDonation({
    orderCode,
    amount,
    provider: "mock",
    checkoutUrl: "http://localhost/donate-checkout",
    qrCode: `mock-qr-${orderCode}`,
    providerPaymentLinkId: `mock-${orderCode}`,
    now: baseTime,
  });

describe("payOS signatures", () => {
  it("serializes sorted fields and verifies HMAC-SHA256 signatures", () => {
    const payload = {
      orderCode: 123,
      amount: 10000,
      description: "QFLASH123",
      returnUrl: "https://unlock.example/return",
      cancelUrl: "https://unlock.example/cancel",
    };
    expect(serializePayosPayload(payload)).toBe(
      "amount=10000&cancelUrl=https://unlock.example/cancel&description=QFLASH123&orderCode=123&returnUrl=https://unlock.example/return",
    );
    const signature = createPayosSignature(payload, "checksum");
    expect(verifyPayosSignature(payload, signature, "checksum")).toBe(true);
    expect(verifyPayosSignature({ ...payload, amount: 20000 }, signature, "checksum")).toBe(false);
  });
});

describe("PaymentStore", () => {
  let stores: PaymentStore[] = [];

  afterEach(() => {
    for (const store of stores) {
      store.close();
    }
    stores = [];
  });

  const openStore = () => {
    const store = PaymentStore.open(":memory:");
    stores.push(store);
    return store;
  };

  it("expires pending orders after 10 minutes", () => {
    const store = openStore();
    const order = createOrder(store);
    expect(store.getOrder(order.id, new Date(baseTime.getTime() + ORDER_TTL_MS - 1))?.status).toBe("pending");
    expect(store.getOrder(order.id, new Date(baseTime.getTime() + ORDER_TTL_MS))?.status).toBe("expired");
  });

  it("expires pending donations and keeps paid donation transitions separate from passes", () => {
    const store = openStore();
    const expiring = createDonation(store, 20001, DONATION_MIN_VND);
    expect(store.getDonation(expiring.id, new Date(baseTime.getTime() + DONATION_TTL_MS - 1))?.status).toBe("pending");
    expect(store.getDonation(expiring.id, new Date(baseTime.getTime() + DONATION_TTL_MS))?.status).toBe("expired");

    const payable = createDonation(store, 20002, 100000);
    const first = store.markDonationPaidByCode(payable.orderCode, "payos-webhook", baseTime);
    const second = store.markDonationPaidByCode(payable.orderCode, "payos-webhook", baseTime);
    const passCount = store.db.prepare("SELECT COUNT(*) AS count FROM passes").get() as { count: number };
    const paidAuditCount = store.db
      .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'donation.paid'")
      .get() as { count: number };

    expect(first.donation.status).toBe("paid");
    expect(second.idempotent).toBe(true);
    expect(passCount.count).toBe(0);
    expect(paidAuditCount.count).toBe(1);
  });

  it("issues one pass for a paid order and keeps webhook handling idempotent", () => {
    const store = openStore();
    const order = createOrder(store);
    const first = store.markOrderPaidByCode(order.orderCode, "payos-webhook", baseTime);
    const second = store.markOrderPaidByCode(order.orderCode, "payos-webhook", baseTime);
    expect(first.order.status).toBe("paid");
    expect(first.pass.token).toBe(second.pass.token);
    expect(second.idempotent).toBe(true);
  });

  it("does not mark expired pending orders as paid", () => {
    const store = openStore();
    const order = createOrder(store);

    expect(() =>
      store.markOrderPaidByCode(order.orderCode, "payos-webhook", new Date(baseTime.getTime() + ORDER_TTL_MS)),
    ).toThrow(/expired/);
  });

  it("consumes a pass once and allows retry only for the same serial/model within 24 hours", () => {
    const store = openStore();
    const order = createOrder(store);
    const { pass } = store.markOrderPaidByCode(order.orderCode, "payos-webhook", baseTime);
    const target = { token: pass.token, modelId: order.modelId, product: order.product, serial: order.serial };
    expect(store.consumePass({ ...target, now: baseTime }).mode).toBe("consumed");
    expect(store.consumePass({ ...target, now: new Date(baseTime.getTime() + RETRY_TTL_MS - 1) }).mode).toBe("retry");
    expect(() => store.consumePass({ ...target, serial: "OTHER", now: baseTime })).toThrow(/different serial/);
    expect(() => store.consumePass({ ...target, now: new Date(baseTime.getTime() + RETRY_TTL_MS) })).toThrow(/expired/);
  });

  it("expires unused passes after 7 days", () => {
    const store = openStore();
    const order = createOrder(store);
    const { pass } = store.markOrderPaidByCode(order.orderCode, "payos-webhook", baseTime);
    expect(() =>
      store.consumePass({
        token: pass.token,
        modelId: order.modelId,
        product: order.product,
        serial: order.serial,
        now: new Date(baseTime.getTime() + PASS_TTL_MS),
      }),
    ).toThrow(/expired/);
  });
});

describe("payments API", () => {
  const servers: Array<{ close: (callback?: () => void) => void }> = [];
  const stores: PaymentStore[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(resolve))));
    for (const store of stores) {
      store.close();
    }
    servers.length = 0;
    stores.length = 0;
  });

  const startApp = async () => {
    const config = testConfig();
    const store = PaymentStore.open(":memory:");
    const keyStore = new AssetKeyStore({
      "unlock/payloads/test.bin": {
        key: "00".repeat(32),
        iv: "11".repeat(16),
      },
    });
    const app = createApp({ config, store, provider: new MockPaymentProvider(), keyStore });
    const server = app.listen(0);
    servers.push(server);
    stores.push(store);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    return { baseUrl: `http://127.0.0.1:${address.port}`, config, store };
  };

  const postJson = async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return { response, json };
  };

  const postAdmin = async (url: string, body: unknown = {}) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": "test-admin" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return { response, json };
  };

  const getJson = async (url: string) => {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const json = await response.json();
    return { response, json };
  };

  const getAdmin = async (url: string) => {
    const response = await fetch(url, { headers: { "x-admin-token": "test-admin", Accept: "application/json" } });
    const json = await response.json();
    return { response, json };
  };

  it("validates donation amounts and returns mock QR payment data", async () => {
    const { baseUrl } = await startApp();
    const invalidBodies = [{}, { amount: "20000" }, { amount: 20000.5 }, { amount: DONATION_MIN_VND - 1 }, { amount: DONATION_MAX_VND + 1 }];

    for (const body of invalidBodies) {
      const result = await postJson(`${baseUrl}/api/donations`, body);
      expect(result.response.status).toBe(400);
    }

    for (const amount of [DONATION_MIN_VND, 20000, 50000, 100000, 200000, DONATION_MAX_VND]) {
      const result = await postJson(`${baseUrl}/api/donations`, { amount });
      expect(result.response.status).toBe(201);
      expect(result.json.donation).toMatchObject({
        amount,
        currency: "VND",
        status: "pending",
        provider: "mock",
      });
      expect(result.json.donation.checkoutUrl).toContain("/mock-checkout/");
      expect(result.json.donation.qrCode).toBe(`mock-qr-${result.json.donation.orderCode}`);
      expect(result.json.donation.providerPaymentLinkId).toBe(`mock-${result.json.donation.orderCode}`);

      const poll = await getJson(`${baseUrl}/api/donations/${result.json.donation.id}`);
      expect(poll.response.status).toBe(200);
      expect(poll.json.donation.status).toBe("pending");
    }
  });

  it("marks donation paid from signed webhook without issuing passes or asset-key authority", async () => {
    const { baseUrl, config, store } = await startApp();
    const donationResult = await postJson(`${baseUrl}/api/donations`, { amount: 50000 });
    expect(donationResult.response.status).toBe(201);
    const donation = donationResult.json.donation;

    const data = {
      orderCode: donation.orderCode,
      amount: donation.amount,
      description: "QFDON",
      accountNumber: "12345678",
      reference: "TF230204212323",
      transactionDateTime: "2026-06-18 10:00:00",
      currency: "VND",
      paymentLinkId: donation.providerPaymentLinkId,
      code: "00",
      desc: "Thanh cong",
    };
    const signature = createPayosSignature(data, config.payos.checksumKey!);
    const webhook = await postJson(`${baseUrl}/api/payments/webhook/payos`, {
      code: "00",
      desc: "success",
      success: true,
      data,
      signature,
    });
    expect(webhook.response.status).toBe(200);
    expect(webhook.json.donation.status).toBe("paid");
    expect(webhook.json.pass).toBeUndefined();

    const replay = await postJson(`${baseUrl}/api/payments/webhook/payos`, {
      code: "00",
      desc: "success",
      success: true,
      data,
      signature,
    });
    expect(replay.response.status).toBe(200);
    expect(replay.json.idempotent).toBe(true);
    expect(replay.json.pass).toBeUndefined();

    const passCount = store.db.prepare("SELECT COUNT(*) AS count FROM passes").get() as { count: number };
    const paidAuditCount = store.db
      .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'donation.paid'")
      .get() as { count: number };
    expect(passCount.count).toBe(0);
    expect(paidAuditCount.count).toBe(1);

    const keyResult = await postJson(`${baseUrl}/api/assets/keys`, {
      token: donation.id,
      modelId: "xiaomi15ultra",
      product: "xuanyuan",
      serial: "SERIAL123",
      paths: ["unlock/payloads/test.bin"],
    });
    expect(keyResult.response.status).not.toBe(200);

    const adminList = await getAdmin(`${baseUrl}/api/admin/donations`);
    expect(adminList.response.status).toBe(200);
    expect(adminList.json.donations).toHaveLength(1);
    expect(adminList.json.donations[0].status).toBe("paid");

    const adminDetail = await getAdmin(`${baseUrl}/api/admin/donations/${donation.id}`);
    expect(adminDetail.response.status).toBe(200);
    expect(adminDetail.json.donation.providerPaymentLinkId).toBe(donation.providerPaymentLinkId);
  });

  it("rejects invalid donation webhooks and amount, currency, or payment-link mismatches", async () => {
    const { baseUrl, config } = await startApp();
    const donationResult = await postJson(`${baseUrl}/api/donations`, { amount: 20000 });
    const donation = donationResult.json.donation;

    const validData = {
      orderCode: donation.orderCode,
      amount: donation.amount,
      currency: "VND",
      paymentLinkId: donation.providerPaymentLinkId,
      code: "00",
      desc: "Thanh cong",
    };
    const invalidSignature = await postJson(`${baseUrl}/api/payments/webhook/payos`, {
      code: "00",
      desc: "success",
      success: true,
      data: validData,
      signature: "deadbeef",
    });
    expect(invalidSignature.response.status).toBe(403);

    for (const data of [
      { ...validData, amount: donation.amount + 1 },
      { ...validData, currency: "USD" },
      { ...validData, paymentLinkId: "other-link" },
    ]) {
      const result = await postJson(`${baseUrl}/api/payments/webhook/payos`, {
        code: "00",
        desc: "success",
        success: true,
        data,
        signature: createPayosSignature(data, config.payos.checksumKey!),
      });
      expect(result.response.status).toBe(403);
    }
  });

  it("accepts signed unknown payOS webhook probes without payment side effects", async () => {
    const { baseUrl, config, store } = await startApp();
    const data = {
      orderCode: 123,
      amount: 3000,
      description: "VQRIO123",
      accountNumber: "12345678",
      reference: "TF230204212323",
      transactionDateTime: "2023-02-04 18:25:00",
      currency: "VND",
      paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
      code: "00",
      desc: "Thanh cong",
    };

    const result = await postJson(`${baseUrl}/api/payments/webhook/payos`, {
      code: "00",
      desc: "success",
      success: true,
      data,
      signature: createPayosSignature(data, config.payos.checksumKey!),
    });

    expect(result.response.status).toBe(200);
    expect(result.json).toMatchObject({ ok: true, ignored: true, reason: "ORDER_NOT_FOUND" });
    expect(store.listOrders()).toHaveLength(0);
    expect(store.listDonations()).toHaveLength(0);
    expect(store.listAudit()).toHaveLength(0);
  });

  it("creates a mock order, accepts signed payOS webhook, authorizes keys, and consumes the pass", async () => {
    const { baseUrl, config } = await startApp();
    const orderResult = await postJson(`${baseUrl}/api/payments/orders`, {
      modelId: "xiaomi15ultra",
      modelName: "Xiaomi 15 Ultra",
      product: "xuanyuan",
      serial: "SERIAL123",
    });
    expect(orderResult.response.status).toBe(201);
    expect(orderResult.json.order.amount).toBe(10000);
    expect(orderResult.json.order.status).toBe("pending");

    const data = {
      orderCode: orderResult.json.order.orderCode,
      amount: 10000,
      description: "QFLASH",
      accountNumber: "12345678",
      reference: "TF230204212323",
      transactionDateTime: "2026-06-18 10:00:00",
      currency: "VND",
      paymentLinkId: orderResult.json.order.providerPaymentLinkId,
      code: "00",
      desc: "Thanh cong",
    };
    const signature = createPayosSignature(data, config.payos.checksumKey!);
    const webhook = await postJson(`${baseUrl}/api/payments/webhook/payos`, {
      code: "00",
      desc: "success",
      success: true,
      data,
      signature,
    });
    expect(webhook.response.status).toBe(200);
    expect(webhook.json.pass.status).toBe("active");

    const keyResult = await postJson(`${baseUrl}/api/assets/keys`, {
      token: webhook.json.pass.token,
      modelId: "xiaomi15ultra",
      product: "xuanyuan",
      serial: "SERIAL123",
      paths: ["unlock/payloads/test.bin"],
    });
    expect(keyResult.response.status).toBe(200);
    expect(keyResult.json.keys["unlock/payloads/test.bin"].key).toBe("00".repeat(32));

    const consume = await postJson(`${baseUrl}/api/passes/${webhook.json.pass.token}/consume`, {
      modelId: "xiaomi15ultra",
      product: "xuanyuan",
      serial: "SERIAL123",
    });
    expect(consume.response.status).toBe(200);
    expect(consume.json.mode).toBe("consumed");
  });

  it("rejects invalid webhook signatures and wrong-device key requests", async () => {
    const { baseUrl, config } = await startApp();
    const orderResult = await postJson(`${baseUrl}/api/payments/orders`, {
      modelId: "xiaomi15ultra",
      modelName: "Xiaomi 15 Ultra",
      product: "xuanyuan",
      serial: "SERIAL123",
    });
    const invalidWebhook = await postJson(`${baseUrl}/api/payments/webhook/payos`, {
      code: "00",
      desc: "success",
      success: true,
      data: { orderCode: orderResult.json.order.orderCode, amount: 10000 },
      signature: "deadbeef",
    });
    expect(invalidWebhook.response.status).toBe(403);

    const amountMismatchData = {
      orderCode: orderResult.json.order.orderCode,
      amount: 1,
      currency: "VND",
      paymentLinkId: orderResult.json.order.providerPaymentLinkId,
      code: "00",
      desc: "Thanh cong",
    };
    const amountMismatchWebhook = await postJson(`${baseUrl}/api/payments/webhook/payos`, {
      code: "00",
      desc: "success",
      success: true,
      data: amountMismatchData,
      signature: createPayosSignature(amountMismatchData, config.payos.checksumKey!),
    });
    expect(amountMismatchWebhook.response.status).toBe(403);

    const data = {
      orderCode: orderResult.json.order.orderCode,
      amount: 10000,
      currency: "VND",
      paymentLinkId: orderResult.json.order.providerPaymentLinkId,
      code: "00",
      desc: "Thanh cong",
    };
    const webhook = await postJson(`${baseUrl}/api/payments/webhook/payos`, {
      code: "00",
      desc: "success",
      success: true,
      data,
      signature: createPayosSignature(data, config.payos.checksumKey!),
    });
    const keyResult = await postJson(`${baseUrl}/api/assets/keys`, {
      token: webhook.json.pass.token,
      modelId: "xiaomi15ultra",
      product: "xuanyuan",
      serial: "OTHER",
      paths: ["unlock/payloads/test.bin"],
    });
    expect(keyResult.response.status).toBe(403);
  });

  it("supports admin list, detail, manual paid, issue, revoke, and audit operations", async () => {
    const { baseUrl } = await startApp();
    const orderResult = await postJson(`${baseUrl}/api/payments/orders`, {
      modelId: "xiaomi15ultra",
      modelName: "Xiaomi 15 Ultra",
      product: "xuanyuan",
      serial: "SERIAL123",
    });
    const orderId = orderResult.json.order.id;

    const forbidden = await fetch(`${baseUrl}/api/admin/orders`, { headers: { Accept: "application/json" } });
    expect(forbidden.status).toBe(403);

    const list = await getAdmin(`${baseUrl}/api/admin/orders`);
    expect(list.response.status).toBe(200);
    expect(list.json.orders).toHaveLength(1);

    const manualPaid = await postAdmin(`${baseUrl}/api/admin/orders/${orderId}/mark-paid`);
    expect(manualPaid.response.status).toBe(200);
    expect(manualPaid.json.order.status).toBe("paid");
    expect(manualPaid.json.pass.status).toBe("active");

    const issueAgain = await postAdmin(`${baseUrl}/api/admin/orders/${orderId}/issue-pass`);
    expect(issueAgain.response.status).toBe(200);
    expect(issueAgain.json.pass.token).toBe(manualPaid.json.pass.token);

    const detail = await getAdmin(`${baseUrl}/api/admin/orders/${orderId}`);
    expect(detail.response.status).toBe(200);
    expect(detail.json.pass.token).toBe(manualPaid.json.pass.token);

    const revoked = await postAdmin(`${baseUrl}/api/admin/passes/${manualPaid.json.pass.token}/revoke`);
    expect(revoked.response.status).toBe(200);
    expect(revoked.json.pass.status).toBe("revoked");

    const audit = await getAdmin(`${baseUrl}/api/admin/audit`);
    expect(audit.response.status).toBe(200);
    expect(audit.json.events.map((event: { action: string }) => event.action)).toEqual(
      expect.arrayContaining(["order.created", "order.paid", "pass.issued", "pass.revoked"]),
    );

    const escapedOrder = await postJson(`${baseUrl}/api/payments/orders`, {
      modelId: "xiaomi15ultra",
      modelName: "<script>alert(1)</script>",
      product: "xuanyuan",
      serial: "SERIAL<script>",
    });
    expect(escapedOrder.response.status).toBe(201);

    const adminHtml = await fetch(`${baseUrl}/api/admin?token=test-admin`, { headers: { Accept: "text/html" } });
    const html = await adminHtml.text();
    expect(adminHtml.headers.get("set-cookie")).toContain("qflash_admin=");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("?token=");
  });

  it("supports admin confirm-webhook trigger in mock mode", async () => {
    const { baseUrl } = await startApp();
    const result = await postAdmin(`${baseUrl}/api/admin/payos/confirm-webhook`);

    expect(result.response.status).toBe(200);
    expect(result.json.result.confirmed).toBe(true);
  });
});
