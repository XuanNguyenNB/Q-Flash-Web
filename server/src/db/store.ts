import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import { addMs, DAY_MS, HOUR_MS, MINUTE_MS, now as defaultNow, toIso } from "../time.js";

export const UNLOCK_PRICE_VND = 10000;
export const DONATION_MIN_VND = 10000;
export const DONATION_MAX_VND = 5000000;
export const ORDER_TTL_MS = 10 * MINUTE_MS;
export const DONATION_TTL_MS = ORDER_TTL_MS;
export const PASS_TTL_MS = 7 * DAY_MS;
export const RETRY_TTL_MS = 24 * HOUR_MS;

export type OrderStatus = "pending" | "paid" | "expired" | "cancelled";
export type DonationStatus = "pending" | "paid" | "expired" | "cancelled" | "failed";
export type PassStatus = "active" | "consumed" | "expired" | "revoked";

export type OrderRecord = {
  id: string;
  orderCode: number;
  status: OrderStatus;
  amount: number;
  currency: string;
  modelId: string;
  modelName: string;
  product: string;
  serial: string;
  checkoutUrl: string;
  provider: string;
  providerPaymentLinkId?: string;
  createdAt: string;
  expiresAt: string;
  paidAt?: string;
  updatedAt: string;
};

export type DonationRecord = {
  id: string;
  orderCode: number;
  status: DonationStatus;
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

export type PassRecord = {
  id: string;
  token: string;
  orderId: string;
  status: PassStatus;
  modelId: string;
  product: string;
  serial: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt?: string;
  retryUntil?: string;
  revokedAt?: string;
};

type OrderRow = {
  id: string;
  order_code: number;
  status: OrderStatus;
  amount: number;
  currency: string;
  model_id: string;
  model_name: string;
  product: string;
  serial: string;
  checkout_url: string;
  provider: string;
  provider_payment_link_id: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  updated_at: string;
};

type DonationRow = {
  id: string;
  order_code: number;
  status: DonationStatus;
  amount: number;
  currency: string;
  checkout_url: string;
  qr_code: string;
  provider: string;
  provider_payment_link_id: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  updated_at: string;
};

type PassRow = {
  id: string;
  token: string;
  order_id: string;
  status: PassStatus;
  model_id: string;
  product: string;
  serial: string;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
  retry_until: string | null;
  revoked_at: string | null;
};

export type CreateOrderInput = {
  orderCode: number;
  modelId: string;
  modelName: string;
  product: string;
  serial: string;
  provider: string;
  checkoutUrl: string;
  providerPaymentLinkId?: string;
  now?: Date;
};

export type CreateDonationInput = {
  orderCode: number;
  amount: number;
  provider: string;
  checkoutUrl: string;
  qrCode: string;
  providerPaymentLinkId?: string;
  now?: Date;
};

export type ConsumeInput = {
  token: string;
  modelId: string;
  product: string;
  serial: string;
  now?: Date;
};

export type AuditAction =
  | "order.created"
  | "order.expired"
  | "order.paid"
  | "donation.created"
  | "donation.expired"
  | "donation.paid"
  | "pass.issued"
  | "pass.consumed"
  | "pass.retried"
  | "pass.revoked"
  | "pass.expired"
  | "asset.keys.authorized"
  | "asset.keys.rejected"
  | "developer_override.login.accepted"
  | "developer_override.login.rejected"
  | "developer_override.logout"
  | "developer_override.event";

export class PaymentStore {
  readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  static open(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    const db = new DatabaseSync(path);
    const store = new PaymentStore(db);
    store.migrate();
    return store;
  }

  close() {
    this.db.close();
  }

  migrate() {
    this.db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_code INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        model_id TEXT NOT NULL,
        model_name TEXT NOT NULL,
        product TEXT NOT NULL,
        serial TEXT NOT NULL,
        checkout_url TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_payment_link_id TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        paid_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_orders_status_expires ON orders(status, expires_at);
      CREATE INDEX IF NOT EXISTS idx_orders_serial_model ON orders(serial, model_id);

      CREATE TABLE IF NOT EXISTS donations (
        id TEXT PRIMARY KEY,
        order_code INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        checkout_url TEXT NOT NULL,
        qr_code TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_payment_link_id TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        paid_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_donations_status_expires ON donations(status, expires_at);
      CREATE INDEX IF NOT EXISTS idx_donations_order_code ON donations(order_code);

      CREATE TABLE IF NOT EXISTS passes (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        order_id TEXT NOT NULL REFERENCES orders(id),
        status TEXT NOT NULL,
        model_id TEXT NOT NULL,
        product TEXT NOT NULL,
        serial TEXT NOT NULL,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        retry_until TEXT,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_passes_token ON passes(token);
      CREATE INDEX IF NOT EXISTS idx_passes_order ON passes(order_id);

      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        order_id TEXT,
        pass_id TEXT,
        serial TEXT,
        model_id TEXT,
        metadata_json TEXT NOT NULL
      );
    `);
  }

  createOrder(input: CreateOrderInput) {
    const createdAt = input.now ?? defaultNow();
    const record: OrderRecord = {
      id: randomUUID(),
      orderCode: input.orderCode,
      status: "pending",
      amount: UNLOCK_PRICE_VND,
      currency: "VND",
      modelId: input.modelId,
      modelName: input.modelName,
      product: input.product,
      serial: input.serial,
      checkoutUrl: input.checkoutUrl,
      provider: input.provider,
      providerPaymentLinkId: input.providerPaymentLinkId,
      createdAt: toIso(createdAt),
      expiresAt: toIso(addMs(createdAt, ORDER_TTL_MS)),
      updatedAt: toIso(createdAt),
    };

    this.db
      .prepare(
        `INSERT INTO orders (
          id, order_code, status, amount, currency, model_id, model_name, product, serial,
          checkout_url, provider, provider_payment_link_id, created_at, expires_at, paid_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.orderCode,
        record.status,
        record.amount,
        record.currency,
        record.modelId,
        record.modelName,
        record.product,
        record.serial,
        record.checkoutUrl,
        record.provider,
        record.providerPaymentLinkId ?? null,
        record.createdAt,
        record.expiresAt,
        null,
        record.updatedAt,
      );
    this.audit("system", "order.created", { orderId: record.id, serial: record.serial, modelId: record.modelId });
    return record;
  }

  createDonation(input: CreateDonationInput) {
    this.assertDonationAmount(input.amount);

    const createdAt = input.now ?? defaultNow();
    const record: DonationRecord = {
      id: randomUUID(),
      orderCode: input.orderCode,
      status: "pending",
      amount: input.amount,
      currency: "VND",
      checkoutUrl: input.checkoutUrl,
      qrCode: input.qrCode,
      provider: input.provider,
      providerPaymentLinkId: input.providerPaymentLinkId,
      createdAt: toIso(createdAt),
      expiresAt: toIso(addMs(createdAt, DONATION_TTL_MS)),
      updatedAt: toIso(createdAt),
    };

    this.db
      .prepare(
        `INSERT INTO donations (
          id, order_code, status, amount, currency, checkout_url, qr_code,
          provider, provider_payment_link_id, created_at, expires_at, paid_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.orderCode,
        record.status,
        record.amount,
        record.currency,
        record.checkoutUrl,
        record.qrCode,
        record.provider,
        record.providerPaymentLinkId ?? null,
        record.createdAt,
        record.expiresAt,
        null,
        record.updatedAt,
      );
    this.audit("system", "donation.created", {
      metadata: { donationId: record.id, orderCode: record.orderCode, amount: record.amount },
    });
    return record;
  }

  getOrder(id: string, at = defaultNow()) {
    this.expirePendingOrders(at);
    const row = this.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
    return row ? this.mapOrder(row) : undefined;
  }

  listOrders(at = defaultNow()) {
    this.expirePendingOrders(at);
    return (this.db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as OrderRow[]).map((row) =>
      this.mapOrder(row),
    );
  }

  getOrderByCode(orderCode: number) {
    const row = this.db.prepare("SELECT * FROM orders WHERE order_code = ?").get(orderCode) as OrderRow | undefined;
    return row ? this.mapOrder(row) : undefined;
  }

  getDonation(id: string, at = defaultNow()) {
    this.expirePendingDonations(at);
    const row = this.db.prepare("SELECT * FROM donations WHERE id = ?").get(id) as DonationRow | undefined;
    return row ? this.mapDonation(row) : undefined;
  }

  listDonations(at = defaultNow()) {
    this.expirePendingDonations(at);
    return (this.db.prepare("SELECT * FROM donations ORDER BY created_at DESC").all() as DonationRow[]).map((row) =>
      this.mapDonation(row),
    );
  }

  getDonationByCode(orderCode: number, at = defaultNow()) {
    this.expirePendingDonations(at);
    const row = this.db.prepare("SELECT * FROM donations WHERE order_code = ?").get(orderCode) as
      | DonationRow
      | undefined;
    return row ? this.mapDonation(row) : undefined;
  }

  getPassByOrder(orderId: string) {
    const row = this.db.prepare("SELECT * FROM passes WHERE order_id = ?").get(orderId) as PassRow | undefined;
    return row ? this.mapPass(row) : undefined;
  }

  getPassByToken(token: string) {
    const row = this.db.prepare("SELECT * FROM passes WHERE token = ?").get(token) as PassRow | undefined;
    return row ? this.mapPass(row) : undefined;
  }

  markOrderPaidByCode(orderCode: number, actor: string, at = defaultNow()) {
    this.db.exec("BEGIN IMMEDIATE");

    try {
      this.expirePendingOrders(at);
      const row = this.db.prepare("SELECT * FROM orders WHERE order_code = ?").get(orderCode) as OrderRow | undefined;

      if (!row) {
        throw notFound("ORDER_NOT_FOUND", `Order code ${orderCode} not found.`);
      }

      const order = this.mapOrder(row);

      if (order.status === "paid") {
        const existing = this.getPassByOrder(order.id);
        const pass = existing ?? this.issuePass(order, actor, at);
        this.db.exec("COMMIT");
        return { order, pass, idempotent: true };
      }

      if (order.status !== "pending") {
        throw conflict("ORDER_NOT_PAYABLE", `Order is ${order.status}.`);
      }

      const paidAt = toIso(at);
      this.db
        .prepare("UPDATE orders SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?")
        .run(paidAt, paidAt, order.id);
      const paidOrder = { ...order, status: "paid" as const, paidAt, updatedAt: paidAt };
      this.audit(actor, "order.paid", { orderId: order.id, serial: order.serial, modelId: order.modelId });
      const pass = this.issuePass(paidOrder, actor, at);
      this.db.exec("COMMIT");
      return { order: paidOrder, pass, idempotent: false };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  markDonationPaidByCode(orderCode: number, actor: string, at = defaultNow()) {
    this.db.exec("BEGIN IMMEDIATE");

    try {
      this.expirePendingDonations(at);
      const row = this.db.prepare("SELECT * FROM donations WHERE order_code = ?").get(orderCode) as
        | DonationRow
        | undefined;

      if (!row) {
        throw notFound("DONATION_NOT_FOUND", `Donation code ${orderCode} not found.`);
      }

      const donation = this.mapDonation(row);

      if (donation.status === "paid") {
        this.db.exec("COMMIT");
        return { donation, idempotent: true };
      }

      if (donation.status !== "pending") {
        throw conflict("DONATION_NOT_PAYABLE", `Donation is ${donation.status}.`);
      }

      const paidAt = toIso(at);
      this.db
        .prepare("UPDATE donations SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?")
        .run(paidAt, paidAt, donation.id);
      const paidDonation = { ...donation, status: "paid" as const, paidAt, updatedAt: paidAt };
      this.audit(actor, "donation.paid", {
        metadata: { donationId: donation.id, orderCode: donation.orderCode, amount: donation.amount },
      });
      this.db.exec("COMMIT");
      return { donation: paidDonation, idempotent: false };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  consumePass(input: ConsumeInput) {
    this.db.exec("BEGIN IMMEDIATE");

    try {
      const passRow = this.db.prepare("SELECT * FROM passes WHERE token = ?").get(input.token) as PassRow | undefined;

      if (!passRow) {
        throw notFound("PASS_NOT_FOUND", "Unlock pass not found.");
      }

      const pass = this.mapPass(passRow);
      this.assertSameTarget(pass, input);
      const at = input.now ?? defaultNow();
      const atIso = toIso(at);

      if (pass.status === "revoked") {
        throw forbidden("PASS_REVOKED", "Unlock pass has been revoked.");
      }

      if (pass.status === "expired" || pass.expiresAt <= atIso) {
        this.expirePass(pass.id, at);
        throw forbidden("PASS_EXPIRED", "Unlock pass has expired.");
      }

      if (pass.status === "consumed") {
        if (pass.retryUntil && pass.retryUntil > atIso) {
          this.audit("system", "pass.retried", { passId: pass.id, serial: pass.serial, modelId: pass.modelId });
          this.db.exec("COMMIT");
          return { pass, mode: "retry" as const };
        }

        throw forbidden("PASS_ALREADY_CONSUMED", "Unlock pass retry window has expired.");
      }

      const retryUntil = toIso(addMs(at, RETRY_TTL_MS));
      this.db
        .prepare("UPDATE passes SET status = 'consumed', consumed_at = ?, retry_until = ? WHERE id = ?")
        .run(atIso, retryUntil, pass.id);
      const consumed = { ...pass, status: "consumed" as const, consumedAt: atIso, retryUntil };
      this.audit("system", "pass.consumed", { passId: pass.id, serial: pass.serial, modelId: pass.modelId });
      this.db.exec("COMMIT");
      return { pass: consumed, mode: "consumed" as const };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  authorizePassForKeys(input: ConsumeInput) {
    const pass = this.getPassByToken(input.token);

    if (!pass) {
      throw notFound("PASS_NOT_FOUND", "Unlock pass not found.");
    }

    this.assertSameTarget(pass, input);
    const atIso = toIso(input.now ?? defaultNow());

    if (pass.status === "active" && pass.expiresAt > atIso) {
      return pass;
    }

    if (pass.status === "consumed" && pass.retryUntil && pass.retryUntil > atIso) {
      return pass;
    }

    throw forbidden("PASS_NOT_AUTHORIZED", "Unlock pass is not authorized for asset keys.");
  }

  revokePass(token: string, actor: string, at = defaultNow()) {
    const pass = this.getPassByToken(token);

    if (!pass) {
      throw notFound("PASS_NOT_FOUND", "Unlock pass not found.");
    }

    const revokedAt = toIso(at);
    this.db.prepare("UPDATE passes SET status = 'revoked', revoked_at = ? WHERE id = ?").run(revokedAt, pass.id);
    this.audit(actor, "pass.revoked", { passId: pass.id, serial: pass.serial, modelId: pass.modelId });
    return { ...pass, status: "revoked" as const, revokedAt };
  }

  issuePassForOrderId(orderId: string, actor: string, at = defaultNow()) {
    const order = this.getOrder(orderId, at);

    if (!order) {
      throw notFound("ORDER_NOT_FOUND", "Order not found.");
    }

    if (order.status !== "paid") {
      throw conflict("ORDER_NOT_PAID", "Cannot issue pass before order is paid.");
    }

    return this.issuePass(order, actor, at);
  }

  expirePendingOrders(at = defaultNow()) {
    const atIso = toIso(at);
    const expiredRows = this.db
      .prepare("SELECT * FROM orders WHERE status = 'pending' AND expires_at <= ?")
      .all(atIso) as OrderRow[];

    for (const row of expiredRows) {
      this.db.prepare("UPDATE orders SET status = 'expired', updated_at = ? WHERE id = ?").run(atIso, row.id);
      this.audit("system", "order.expired", { orderId: row.id, serial: row.serial, modelId: row.model_id });
    }
  }

  expirePendingDonations(at = defaultNow()) {
    const atIso = toIso(at);
    const expiredRows = this.db
      .prepare("SELECT * FROM donations WHERE status = 'pending' AND expires_at <= ?")
      .all(atIso) as DonationRow[];

    for (const row of expiredRows) {
      this.db.prepare("UPDATE donations SET status = 'expired', updated_at = ? WHERE id = ?").run(atIso, row.id);
      this.audit("system", "donation.expired", {
        metadata: { donationId: row.id, orderCode: row.order_code, amount: row.amount },
      });
    }
  }

  audit(actor: string, action: AuditAction, input: {
    orderId?: string;
    passId?: string;
    serial?: string;
    modelId?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.db
      .prepare(
        `INSERT INTO audit_events (created_at, actor, action, order_id, pass_id, serial, model_id, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        toIso(defaultNow()),
        actor,
        action,
        input.orderId ?? null,
        input.passId ?? null,
        input.serial ?? null,
        input.modelId ?? null,
        JSON.stringify(input.metadata ?? {}),
      );
  }

  listAudit() {
    return this.db.prepare("SELECT * FROM audit_events ORDER BY id ASC").all() as Array<Record<string, unknown>>;
  }

  private issuePass(order: OrderRecord, actor: string, at: Date) {
    const existing = this.getPassByOrder(order.id);

    if (existing) {
      return existing;
    }

    const pass: PassRecord = {
      id: randomUUID(),
      token: randomUUID(),
      orderId: order.id,
      status: "active",
      modelId: order.modelId,
      product: order.product,
      serial: order.serial,
      issuedAt: toIso(at),
      expiresAt: toIso(addMs(at, PASS_TTL_MS)),
    };
    this.db
      .prepare(
        `INSERT INTO passes (
          id, token, order_id, status, model_id, product, serial,
          issued_at, expires_at, consumed_at, retry_until, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        pass.id,
        pass.token,
        pass.orderId,
        pass.status,
        pass.modelId,
        pass.product,
        pass.serial,
        pass.issuedAt,
        pass.expiresAt,
        null,
        null,
        null,
      );
    this.audit(actor, "pass.issued", { orderId: order.id, passId: pass.id, serial: pass.serial, modelId: pass.modelId });
    return pass;
  }

  private expirePass(id: string, at: Date) {
    this.db.prepare("UPDATE passes SET status = 'expired' WHERE id = ?").run(id);
    this.audit("system", "pass.expired", { passId: id, metadata: { at: toIso(at) } });
  }

  private assertSameTarget(pass: PassRecord, input: { modelId: string; product: string; serial: string }) {
    if (pass.modelId !== input.modelId || pass.product !== input.product || pass.serial !== input.serial) {
      throw forbidden("PASS_TARGET_MISMATCH", "Unlock pass is tied to a different serial/model.");
    }
  }

  private assertDonationAmount(amount: number) {
    if (!Number.isInteger(amount) || amount < DONATION_MIN_VND || amount > DONATION_MAX_VND) {
      throw badRequest(
        "DONATION_AMOUNT_INVALID",
        `Donation amount must be an integer VND value from ${DONATION_MIN_VND} to ${DONATION_MAX_VND}.`,
      );
    }
  }

  private mapOrder(row: OrderRow): OrderRecord {
    return {
      id: row.id,
      orderCode: row.order_code,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      modelId: row.model_id,
      modelName: row.model_name,
      product: row.product,
      serial: row.serial,
      checkoutUrl: row.checkout_url,
      provider: row.provider,
      providerPaymentLinkId: row.provider_payment_link_id ?? undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      paidAt: row.paid_at ?? undefined,
      updatedAt: row.updated_at,
    };
  }

  private mapDonation(row: DonationRow): DonationRecord {
    return {
      id: row.id,
      orderCode: row.order_code,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      checkoutUrl: row.checkout_url,
      qrCode: row.qr_code,
      provider: row.provider,
      providerPaymentLinkId: row.provider_payment_link_id ?? undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      paidAt: row.paid_at ?? undefined,
      updatedAt: row.updated_at,
    };
  }

  private mapPass(row: PassRow): PassRecord {
    return {
      id: row.id,
      token: row.token,
      orderId: row.order_id,
      status: row.status,
      modelId: row.model_id,
      product: row.product,
      serial: row.serial,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at ?? undefined,
      retryUntil: row.retry_until ?? undefined,
      revokedAt: row.revoked_at ?? undefined,
    };
  }
}
