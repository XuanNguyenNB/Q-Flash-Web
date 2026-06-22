import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import type { AssetKeyStore } from "./assets/keyStore.js";
import type { ServerConfig } from "./config.js";
import { DONATION_MAX_VND, DONATION_MIN_VND, PaymentStore } from "./db/store.js";
import { ApiError, badRequest, conflict, forbidden, unauthorized } from "./errors.js";
import type { PaymentProvider } from "./payments/provider.js";
import { verifyPayosSignature, type SignablePayload } from "./payos/signature.js";
import { addMs, now as defaultNow, toIso } from "./time.js";

export type AppDependencies = {
  config: ServerConfig;
  store: PaymentStore;
  provider: PaymentProvider;
  keyStore?: AssetKeyStore;
  now?: () => Date;
};

const orderRequestSchema = z.object({
  modelId: z.string().min(1),
  modelName: z.string().min(1),
  product: z.string().min(1),
  serial: z.string().min(1),
  compatibility: z.unknown().optional(),
});

const donationRequestSchema = z
  .object({
    amount: z.number().int().min(DONATION_MIN_VND).max(DONATION_MAX_VND),
  })
  .strict();

const payosWebhookSchema = z.object({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  signature: z.string(),
});

const consumeSchema = z.object({
  token: z.string().min(1),
  modelId: z.string().min(1),
  product: z.string().min(1),
  serial: z.string().min(1),
});

const keyRequestSchema = consumeSchema.extend({
  paths: z.array(z.string().min(1)).min(1),
});

const developerOverrideLoginSchema = z
  .object({
    masterKey: z.string().min(1),
  })
  .strict();

const developerOverrideAuditSchema = z
  .object({
    eventType: z.enum(["mode_change", "phase_select", "gate_policy", "technical_command", "session_notice"]),
    mode: z.enum(["resume", "selective_bypass", "full_override"]).optional(),
    workflowMode: z.enum(["standard", "edl-standard"]).optional(),
    modelId: z.string().min(1).max(80).optional(),
    phase: z.string().min(1).max(80).optional(),
    bypassedGates: z.array(z.string().min(1).max(80)).max(20).optional(),
    commandType: z.enum(["adb", "fastboot", "workflow", "session"]).optional(),
    result: z.enum(["ok", "failed", "blocked", "cancelled", "bypassed"]).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

type DeveloperOverrideSession = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
};

const adminTokenFrom = (request: Request) => {
  const header = request.header("x-admin-token") || request.header("authorization")?.replace(/^Bearer\s+/i, "");
  const cookie = request
    .header("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("qflash_admin="))
    ?.slice("qflash_admin=".length);
  const query = typeof request.query.token === "string" ? request.query.token : "";

  try {
    return header || (cookie ? decodeURIComponent(cookie) : "") || query;
  } catch {
    return header || cookie || query;
  }
};

const cookieValueFrom = (request: Request, name: string) => {
  const prefix = `${name}=`;
  const cookie = request
    .header("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);

  if (!cookie) {
    return "";
  }

  try {
    return decodeURIComponent(cookie);
  } catch {
    return cookie;
  }
};

const sameSecret = (input: string, expected: string) => {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
};

const overrideCookieOptions = (config: ServerConfig) => ({
  httpOnly: true,
  maxAge: config.developerOverride.sessionTtlMs,
  path: "/api/developer-override",
  sameSite: "strict" as const,
  secure: true,
});

const overrideClearCookieOptions = () => ({
  httpOnly: true,
  path: "/api/developer-override",
  sameSite: "strict" as const,
  secure: true,
});

const sessionJson = (session: DeveloperOverrideSession, at: Date) => ({
  expiresAt: toIso(session.expiresAt),
  remainingMs: Math.max(0, session.expiresAt.getTime() - at.getTime()),
});

const SECRET_METADATA_KEY_PATTERN =
  /(master.?key|session.?id|session|cookie|authorization|bearer|token|pass.?token|asset.?key|secret|password|api.?key|checksum|private.?key|iv)/i;

const sanitizeOverrideAuditValue = (
  value: unknown,
  unsafeValues: string[],
  path: string[],
  depth: number,
): unknown => {
  if (depth > 3) {
    throw badRequest("DEVELOPER_OVERRIDE_AUDIT_INVALID", "Override audit metadata is too deeply nested.");
  }

  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (unsafeValues.some((unsafe) => unsafe && value.includes(unsafe))) {
      throw badRequest("DEVELOPER_OVERRIDE_AUDIT_INVALID", "Override audit metadata contains protected data.");
    }

    return value.length > 240 ? `${value.slice(0, 240)}...` : value;
  }

  if (Array.isArray(value)) {
    if (value.length > 20) {
      throw badRequest("DEVELOPER_OVERRIDE_AUDIT_INVALID", "Override audit metadata array is too large.");
    }

    return value.map((entry, index) => sanitizeOverrideAuditValue(entry, unsafeValues, [...path, String(index)], depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 20) {
      throw badRequest("DEVELOPER_OVERRIDE_AUDIT_INVALID", "Override audit metadata object is too large.");
    }

    return sanitizeOverrideAuditMetadata(value as Record<string, unknown>, unsafeValues, path, depth + 1);
  }

  throw badRequest("DEVELOPER_OVERRIDE_AUDIT_INVALID", "Override audit metadata contains an unsupported value.");
};

const sanitizeOverrideAuditMetadata = (
  metadata: Record<string, unknown>,
  unsafeValues: string[],
  path: string[] = [],
  depth = 0,
) => {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_METADATA_KEY_PATTERN.test(key)) {
      throw badRequest("DEVELOPER_OVERRIDE_AUDIT_INVALID", "Override audit metadata contains a secret-like field.");
    }

    sanitized[key] = sanitizeOverrideAuditValue(value, unsafeValues, [...path, key], depth);
  }

  return sanitized;
};

const requireAdmin = (request: Request, config: ServerConfig) => {
  if (!config.adminToken) {
    throw forbidden("ADMIN_TOKEN_NOT_CONFIGURED", "Admin token is not configured.");
  }

  if (adminTokenFrom(request) !== config.adminToken) {
    throw forbidden("ADMIN_FORBIDDEN", "Admin token is invalid.");
  }
};

const setAdminCookieIfQueryToken = (request: Request, response: Response, config: ServerConfig) => {
  const query = typeof request.query.token === "string" ? request.query.token : "";

  if (query && query === config.adminToken) {
    response.cookie("qflash_admin", config.adminToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      path: "/api/admin",
      sameSite: "strict",
      secure: config.publicBaseUrl.startsWith("https://"),
    });
  }
};

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#39;";
    }
  });

let donationOrderSequence = 0;
const createDonationOrderCode = () => Date.now() * 1000 + (donationOrderSequence++ % 1000);

const html = (content: string) => `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Q Flash Payments Admin</title>
    <style>
      body{font-family:system-ui,sans-serif;margin:24px;background:#0f172a;color:#e2e8f0}
      a{color:#67e8f9} table{border-collapse:collapse;width:100%;margin-top:16px}
      th,td{border:1px solid #334155;padding:8px;text-align:left;font-size:14px}
      th{background:#1e293b} code{color:#fde68a}
    </style>
  </head>
  <body>${content}</body>
</html>`;

export const createApp = ({ config, store, provider, keyStore, now = defaultNow }: AppDependencies) => {
  const app = express();
  const developerOverrideSessions = new Map<string, DeveloperOverrideSession>();

  const getDeveloperOverrideSession = (request: Request) => {
    const sessionId = cookieValueFrom(request, config.developerOverride.cookieName);
    if (!sessionId) {
      return undefined;
    }

    const session = developerOverrideSessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    if (session.expiresAt.getTime() <= now().getTime()) {
      developerOverrideSessions.delete(sessionId);
      return undefined;
    }

    return session;
  };

  const requireDeveloperOverrideSession = (request: Request) => {
    const session = getDeveloperOverrideSession(request);

    if (!session) {
      throw unauthorized("DEVELOPER_OVERRIDE_SESSION_REQUIRED", "Developer override session is required.");
    }

    return session;
  };

  const createDeveloperOverrideSession = () => {
    const createdAt = now();
    const session: DeveloperOverrideSession = {
      id: randomBytes(32).toString("base64url"),
      createdAt,
      expiresAt: addMs(createdAt, config.developerOverride.sessionTtlMs),
    };
    developerOverrideSessions.set(session.id, session);
    return session;
  };

  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, provider: config.provider });
  });

  app.post("/api/developer-override/login", (request, response, next) => {
    try {
      const body = developerOverrideLoginSchema.parse(request.body);
      const masterKey = config.developerOverride.masterKey;

      if (!masterKey) {
        store.audit("developer-override", "developer_override.login.rejected", {
          metadata: { reason: "not_configured" },
        });
        throw forbidden(
          "DEVELOPER_OVERRIDE_NOT_CONFIGURED",
          "Developer override master key is not configured.",
        );
      }

      if (!sameSecret(body.masterKey, masterKey)) {
        store.audit("developer-override", "developer_override.login.rejected", {
          metadata: { reason: "invalid_key" },
        });
        throw forbidden("DEVELOPER_OVERRIDE_FORBIDDEN", "Developer override master key is invalid.");
      }

      const session = createDeveloperOverrideSession();
      response.cookie(config.developerOverride.cookieName, session.id, overrideCookieOptions(config));
      store.audit("developer-override", "developer_override.login.accepted", {
        metadata: { expiresAt: toIso(session.expiresAt) },
      });
      response.json({ session: sessionJson(session, now()) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/developer-override/status", (request, response, next) => {
    try {
      const session = requireDeveloperOverrideSession(request);
      response.json({ session: sessionJson(session, now()) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/developer-override/logout", (request, response, next) => {
    try {
      const session = getDeveloperOverrideSession(request);

      if (session) {
        developerOverrideSessions.delete(session.id);
        store.audit("developer-override", "developer_override.logout", {
          metadata: { expiresAt: toIso(session.expiresAt) },
        });
      }

      response.clearCookie(config.developerOverride.cookieName, overrideClearCookieOptions());
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/developer-override/audit", (request, response, next) => {
    try {
      const session = requireDeveloperOverrideSession(request);
      const body = developerOverrideAuditSchema.parse(request.body);
      const unsafeValues = [config.developerOverride.masterKey ?? "", session.id];
      const metadata = sanitizeOverrideAuditMetadata(body.metadata ?? {}, unsafeValues);

      store.audit("developer-override", "developer_override.event", {
        modelId: body.modelId,
        metadata: {
          eventType: body.eventType,
          mode: body.mode,
          workflowMode: body.workflowMode,
          phase: body.phase,
          bypassedGates: body.bypassedGates ?? [],
          commandType: body.commandType,
          result: body.result,
          metadata,
        },
      });
      response.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/payments/orders", async (request, response, next) => {
    try {
      const body = orderRequestSchema.parse(request.body);
      const orderCode = Date.now();
      const paymentLink = await provider.createPaymentLink({
        orderCode,
        amount: 10000,
        description: `QFLASH${String(orderCode).slice(-6)}`,
        returnUrl: config.payos.returnUrl,
        cancelUrl: config.payos.cancelUrl,
      });
      const order = store.createOrder({
        ...body,
        orderCode,
        provider: config.provider,
        checkoutUrl: paymentLink.checkoutUrl,
        providerPaymentLinkId: paymentLink.paymentLinkId,
      });
      response.status(201).json({ order });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/payments/orders/:id", (request, response, next) => {
    try {
      const order = store.getOrder(request.params.id);

      if (!order) {
        throw badRequest("ORDER_NOT_FOUND", "Order not found.");
      }

      response.json({ order, pass: store.getPassByOrder(order.id) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/donations", async (request, response, next) => {
    try {
      const body = donationRequestSchema.parse(request.body);
      const orderCode = createDonationOrderCode();
      const paymentLink = await provider.createPaymentLink({
        orderCode,
        amount: body.amount,
        description: `QFDON${String(orderCode).slice(-4)}`,
        itemName: "Q Flash Web donation",
        returnUrl: config.payos.returnUrl,
        cancelUrl: config.payos.cancelUrl,
      });

      if (!paymentLink.qrCode) {
        throw badRequest("DONATION_QR_MISSING", "Payment provider response did not include a donation QR code.");
      }

      const donation = store.createDonation({
        orderCode,
        amount: body.amount,
        provider: config.provider,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        providerPaymentLinkId: paymentLink.paymentLinkId,
      });
      response.status(201).json({ donation });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/donations/:id", (request, response, next) => {
    try {
      const donation = store.getDonation(request.params.id);

      if (!donation) {
        throw badRequest("DONATION_NOT_FOUND", "Donation not found.");
      }

      response.json({ donation });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/payments/webhook/payos", (request, response, next) => {
    try {
      const body = payosWebhookSchema.parse(request.body);
      const checksumKey = config.payos.checksumKey;

      if (!checksumKey) {
        throw forbidden("PAYOS_CHECKSUM_MISSING", "payOS checksum key is not configured.");
      }

      if (!verifyPayosSignature(body.data as SignablePayload, body.signature, checksumKey)) {
        throw forbidden("PAYOS_SIGNATURE_INVALID", "payOS webhook signature is invalid.");
      }

      if (!body.success || body.code !== "00") {
        response.json({ ok: true, ignored: true });
        return;
      }

      const orderCode = Number(body.data.orderCode);

      if (!Number.isSafeInteger(orderCode)) {
        throw badRequest("PAYOS_ORDER_CODE_INVALID", "payOS webhook orderCode is invalid.");
      }

      const donation = store.getDonationByCode(orderCode);
      const order = store.getOrderByCode(orderCode);

      if (donation && order) {
        throw conflict("PAYOS_ORDER_AMBIGUOUS", "payOS webhook orderCode matches multiple payment domains.");
      }

      if (donation) {
        if (Number(body.data.amount) !== donation.amount) {
          throw forbidden("PAYOS_AMOUNT_MISMATCH", "payOS webhook amount does not match the donation.");
        }

        const currency = typeof body.data.currency === "string" ? body.data.currency : "";
        if (currency !== donation.currency) {
          throw forbidden("PAYOS_CURRENCY_MISMATCH", "payOS webhook currency does not match the donation.");
        }

        const paymentLinkId = typeof body.data.paymentLinkId === "string" ? body.data.paymentLinkId : "";
        if (donation.providerPaymentLinkId && paymentLinkId !== donation.providerPaymentLinkId) {
          throw forbidden("PAYOS_PAYMENT_LINK_MISMATCH", "payOS webhook paymentLinkId does not match the donation.");
        }

        const result = store.markDonationPaidByCode(orderCode, "payos-webhook");
        response.json({ ok: true, donation: result.donation, idempotent: result.idempotent });
        return;
      }

      if (!order) {
        response.json({ ok: true, ignored: true, reason: "ORDER_NOT_FOUND" });
        return;
      }

      if (Number(body.data.amount) !== order.amount) {
        throw forbidden("PAYOS_AMOUNT_MISMATCH", "payOS webhook amount does not match the order.");
      }

      const currency = typeof body.data.currency === "string" ? body.data.currency : "";
      if (currency && currency !== order.currency) {
        throw forbidden("PAYOS_CURRENCY_MISMATCH", "payOS webhook currency does not match the order.");
      }

      const paymentLinkId = typeof body.data.paymentLinkId === "string" ? body.data.paymentLinkId : "";
      if (order.providerPaymentLinkId && paymentLinkId && paymentLinkId !== order.providerPaymentLinkId) {
        throw forbidden("PAYOS_PAYMENT_LINK_MISMATCH", "payOS webhook paymentLinkId does not match the order.");
      }

      const result = store.markOrderPaidByCode(orderCode, "payos-webhook");
      response.json({ ok: true, order: result.order, pass: result.pass, idempotent: result.idempotent });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/passes/:token/consume", (request, response, next) => {
    try {
      const body = consumeSchema.parse({ ...request.body, token: request.params.token });
      response.json(store.consumePass(body));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/passes/:token", (request, response, next) => {
    try {
      const pass = store.getPassByToken(request.params.token);

      if (!pass) {
        throw badRequest("PASS_NOT_FOUND", "Unlock pass not found.");
      }

      response.json({ pass });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/assets/keys", (request, response, next) => {
    try {
      if (!keyStore) {
        throw forbidden("ASSET_KEYS_NOT_CONFIGURED", "Asset key store is not configured.");
      }

      const body = keyRequestSchema.parse(request.body);
      const pass = store.authorizePassForKeys(body);
      const keys = keyStore.getMany(body.paths);
      store.audit("system", "asset.keys.authorized", {
        passId: pass.id,
        serial: pass.serial,
        modelId: pass.modelId,
        metadata: { paths: body.paths },
      });
      response.json({ keys });
    } catch (error) {
      if (request.body && typeof request.body === "object" && "token" in request.body) {
        const token = String((request.body as { token?: unknown }).token ?? "");
        const pass = token ? store.getPassByToken(token) : undefined;
        store.audit("system", "asset.keys.rejected", {
          passId: pass?.id,
          serial: pass?.serial,
          modelId: pass?.modelId,
          metadata: { reason: error instanceof Error ? error.message : String(error) },
        });
      }
      next(error);
    }
  });

  app.get("/api/admin", (request, response, next) => {
    try {
      requireAdmin(request, config);
      setAdminCookieIfQueryToken(request, response, config);
      const rows = store
        .listOrders()
        .map(
          (order) =>
            `<tr><td><a href="/api/admin/orders/${encodeURIComponent(order.id)}">${escapeHtml(order.id)}</a></td><td>${escapeHtml(order.status)}</td><td>${escapeHtml(order.amount)}</td><td><code>${escapeHtml(order.serial)}</code></td><td>${escapeHtml(order.modelName)}</td><td>${escapeHtml(order.createdAt)}</td></tr>`,
        )
        .join("");
      response.type("html").send(
        html(`<h1>Q Flash Payments Admin</h1><p><a href="/api/admin/donations">Donations</a> · <a href="/api/admin/audit">Audit events</a></p><table><thead><tr><th>Order</th><th>Status</th><th>Amount</th><th>Serial</th><th>Model</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>`),
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/orders", (request, response, next) => {
    try {
      requireAdmin(request, config);
      response.json({ orders: store.listOrders() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/orders/:id", (request, response, next) => {
    try {
      requireAdmin(request, config);
      setAdminCookieIfQueryToken(request, response, config);
      const order = store.getOrder(request.params.id);

      if (!order) {
        throw badRequest("ORDER_NOT_FOUND", "Order not found.");
      }

      const pass = store.getPassByOrder(order.id);
      const wantsHtml = request.accepts(["html", "json"]) === "html";

      if (!wantsHtml) {
        response.json({ order, pass });
        return;
      }

      response.type("html").send(
        html(`<h1>Order ${escapeHtml(order.id)}</h1><dl><dt>Status</dt><dd>${escapeHtml(order.status)}</dd><dt>Serial</dt><dd><code>${escapeHtml(order.serial)}</code></dd><dt>Model</dt><dd>${escapeHtml(order.modelName)}</dd><dt>Pass</dt><dd><code>${escapeHtml(pass?.token ?? "none")}</code> ${escapeHtml(pass?.status ?? "")}</dd></dl>`),
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/donations", (request, response, next) => {
    try {
      requireAdmin(request, config);
      setAdminCookieIfQueryToken(request, response, config);
      const donations = store.listDonations();
      const wantsHtml = request.accepts(["html", "json"]) === "html";

      if (!wantsHtml) {
        response.json({ donations });
        return;
      }

      const rows = donations
        .map(
          (donation) =>
            `<tr><td><a href="/api/admin/donations/${encodeURIComponent(donation.id)}">${escapeHtml(donation.id)}</a></td><td>${escapeHtml(donation.status)}</td><td>${escapeHtml(donation.amount)}</td><td>${escapeHtml(donation.currency)}</td><td><code>${escapeHtml(donation.providerPaymentLinkId ?? "")}</code></td><td>${escapeHtml(donation.createdAt)}</td></tr>`,
        )
        .join("");
      response.type("html").send(
        html(`<h1>Donations</h1><p><a href="/api/admin">Orders</a> · <a href="/api/admin/audit">Audit events</a></p><table><thead><tr><th>Donation</th><th>Status</th><th>Amount</th><th>Currency</th><th>Provider Link</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>`),
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/donations/:id", (request, response, next) => {
    try {
      requireAdmin(request, config);
      setAdminCookieIfQueryToken(request, response, config);
      const donation = store.getDonation(request.params.id);

      if (!donation) {
        throw badRequest("DONATION_NOT_FOUND", "Donation not found.");
      }

      const wantsHtml = request.accepts(["html", "json"]) === "html";

      if (!wantsHtml) {
        response.json({ donation });
        return;
      }

      response.type("html").send(
        html(`<h1>Donation ${escapeHtml(donation.id)}</h1><dl><dt>Status</dt><dd>${escapeHtml(donation.status)}</dd><dt>Amount</dt><dd>${escapeHtml(donation.amount)} ${escapeHtml(donation.currency)}</dd><dt>Order code</dt><dd><code>${escapeHtml(donation.orderCode)}</code></dd><dt>Provider link</dt><dd><code>${escapeHtml(donation.providerPaymentLinkId ?? "none")}</code></dd><dt>Checkout</dt><dd><a href="${escapeHtml(donation.checkoutUrl)}">${escapeHtml(donation.checkoutUrl)}</a></dd></dl>`),
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/orders/:id/mark-paid", (request, response, next) => {
    try {
      requireAdmin(request, config);
      const order = store.getOrder(request.params.id);

      if (!order) {
        throw badRequest("ORDER_NOT_FOUND", "Order not found.");
      }

      const result = store.markOrderPaidByCode(order.orderCode, "admin");
      response.json({ order: result.order, pass: result.pass, idempotent: result.idempotent });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/orders/:id/issue-pass", (request, response, next) => {
    try {
      requireAdmin(request, config);
      response.json({ pass: store.issuePassForOrderId(request.params.id, "admin") });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/passes/:token/revoke", (request, response, next) => {
    try {
      requireAdmin(request, config);
      response.json({ pass: store.revokePass(request.params.token, "admin") });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/audit", (request, response, next) => {
    try {
      requireAdmin(request, config);
      setAdminCookieIfQueryToken(request, response, config);
      const events = store.listAudit();
      const wantsHtml = request.accepts(["html", "json"]) === "html";

      if (!wantsHtml) {
        response.json({ events });
        return;
      }

      const rows = events
        .map((event) => `<tr><td>${escapeHtml(event.id)}</td><td>${escapeHtml(event.created_at)}</td><td>${escapeHtml(event.actor)}</td><td>${escapeHtml(event.action)}</td><td>${escapeHtml(event.order_id ?? "")}</td><td>${escapeHtml(event.pass_id ?? "")}</td></tr>`)
        .join("");
      response.type("html").send(
        html(`<h1>Audit Events</h1><table><thead><tr><th>ID</th><th>Time</th><th>Actor</th><th>Action</th><th>Order</th><th>Pass</th></tr></thead><tbody>${rows}</tbody></table>`),
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/payos/confirm-webhook", async (request, response, next) => {
    try {
      requireAdmin(request, config);
      const webhookUrl = config.payos.webhookUrl;

      if (!webhookUrl) {
        throw badRequest("PAYOS_WEBHOOK_URL_MISSING", "PAYOS_WEBHOOK_URL is not configured.");
      }

      const result = await provider.confirmWebhook(webhookUrl);
      response.json({ ok: true, result });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request body is invalid.", details: error.issues },
      });
      return;
    }

    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }

    response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Internal error." },
    });
  });

  return app;
};
