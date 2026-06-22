// @vitest-environment node

import { randomUUID } from "node:crypto";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import type { ServerConfig } from "./src/config.js";
import { loadServerConfig } from "./src/config.js";
import { PaymentStore } from "./src/db/store.js";
import { MockPaymentProvider } from "./src/payments/provider.js";
import { createApp } from "./src/routes.js";

const MASTER_KEY = randomUUID();
const baseTime = new Date("2026-06-22T00:00:00.000Z");

const testConfig = (masterKey?: string, sessionTtlMs = 15 * 60 * 1000): ServerConfig => ({
  port: 0,
  databasePath: ":memory:",
  provider: "mock",
  publicBaseUrl: "https://unlock.example",
  adminToken: "test-admin",
  developerOverride: {
    masterKey,
    sessionTtlMs,
    cookieName: "qflash_dev_override",
  },
  payos: {
    checksumKey: "test_checksum_key",
    returnUrl: "https://unlock.example/payment/return",
    cancelUrl: "https://unlock.example/payment/cancel",
    webhookUrl: "https://unlock.example/api/payments/webhook/payos",
  },
});

describe("Developer Override backend authority", () => {
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

  const startApp = async (options: { masterKey?: string; sessionTtlMs?: number; now?: () => Date } = {}) => {
    const config = testConfig(options.masterKey, options.sessionTtlMs);
    const store = PaymentStore.open(":memory:");
    const app = createApp({
      config,
      store,
      provider: new MockPaymentProvider(),
      now: options.now ?? (() => baseTime),
    });
    const server = app.listen(0);
    servers.push(server);
    stores.push(store);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as AddressInfo;
    return { baseUrl: `http://127.0.0.1:${address.port}`, config, store };
  };

  const postJson = async (url: string, body: unknown, cookie?: string) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    return { response, json };
  };

  const getJson = async (url: string, cookie?: string) => {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });
    const json = await response.json();
    return { response, json };
  };

  const cookiePairFrom = (response: Response) => {
    const setCookie = response.headers.get("set-cookie") ?? "";
    return setCookie.split(";")[0];
  };

  const metadataFor = (event: Record<string, unknown>) => JSON.parse(String(event.metadata_json ?? "{}"));

  it("loads the master key only from backend environment config", () => {
    const config = loadServerConfig({
      PAYMENTS_PUBLIC_BASE_URL: "https://unlock.example",
      DEVELOPER_OVERRIDE_MASTER_KEY: MASTER_KEY,
    });

    expect(config.developerOverride.masterKey).toBe(MASTER_KEY);
    expect(config.developerOverride.sessionTtlMs).toBe(15 * 60 * 1000);
    expect(config.developerOverride.cookieName).toBe("qflash_dev_override");
  });

  it("keeps login disabled when no master key is configured and does not audit the submitted key", async () => {
    const { baseUrl, store } = await startApp();
    const result = await postJson(`${baseUrl}/api/developer-override/login`, { masterKey: MASTER_KEY });

    expect(result.response.status).toBe(403);
    expect(result.json.error.code).toBe("DEVELOPER_OVERRIDE_NOT_CONFIGURED");

    const auditText = JSON.stringify(store.listAudit());
    expect(auditText).toContain("developer_override.login.rejected");
    expect(auditText).toContain("not_configured");
    expect(auditText).not.toContain(MASTER_KEY);
  });

  it("rejects a wrong master key and audits no reusable secret", async () => {
    const { baseUrl, store } = await startApp({ masterKey: MASTER_KEY });
    const wrongKey = randomUUID();
    const result = await postJson(`${baseUrl}/api/developer-override/login`, { masterKey: wrongKey });

    expect(result.response.status).toBe(403);
    expect(result.json.error.code).toBe("DEVELOPER_OVERRIDE_FORBIDDEN");

    const auditText = JSON.stringify(store.listAudit());
    expect(auditText).toContain("developer_override.login.rejected");
    expect(auditText).toContain("invalid_key");
    expect(auditText).not.toContain(wrongKey);
    expect(auditText).not.toContain(MASTER_KEY);
  });

  it("creates a 15-minute Secure HttpOnly SameSite session cookie and returns status", async () => {
    const { baseUrl, store } = await startApp({ masterKey: MASTER_KEY });
    const login = await postJson(`${baseUrl}/api/developer-override/login`, { masterKey: MASTER_KEY });

    expect(login.response.status).toBe(200);
    expect(login.json.session.remainingMs).toBe(15 * 60 * 1000);

    const setCookie = login.response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("qflash_dev_override=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/api/developer-override");
    expect(setCookie).toContain("Max-Age=900");

    const cookie = cookiePairFrom(login.response);
    const status = await getJson(`${baseUrl}/api/developer-override/status`, cookie);
    expect(status.response.status).toBe(200);
    expect(status.json.session.expiresAt).toBe("2026-06-22T00:15:00.000Z");
    expect(status.json.session.remainingMs).toBe(15 * 60 * 1000);

    const auditText = JSON.stringify(store.listAudit());
    expect(auditText).toContain("developer_override.login.accepted");
    expect(auditText).not.toContain(MASTER_KEY);
    expect(auditText).not.toContain(cookie.split("=")[1]);
  });

  it("expires sessions automatically and blocks status or audit after expiry", async () => {
    let current = baseTime;
    const { baseUrl } = await startApp({
      masterKey: MASTER_KEY,
      sessionTtlMs: 1000,
      now: () => current,
    });
    const login = await postJson(`${baseUrl}/api/developer-override/login`, { masterKey: MASTER_KEY });
    const cookie = cookiePairFrom(login.response);

    current = new Date(baseTime.getTime() + 1001);

    const status = await getJson(`${baseUrl}/api/developer-override/status`, cookie);
    expect(status.response.status).toBe(401);
    expect(status.json.error.code).toBe("DEVELOPER_OVERRIDE_SESSION_REQUIRED");

    const audit = await postJson(
      `${baseUrl}/api/developer-override/audit`,
      { eventType: "session_notice", result: "blocked" },
      cookie,
    );
    expect(audit.response.status).toBe(401);
    expect(audit.json.error.code).toBe("DEVELOPER_OVERRIDE_SESSION_REQUIRED");
  });

  it("logs out by invalidating the session and clearing the cookie", async () => {
    const { baseUrl, store } = await startApp({ masterKey: MASTER_KEY });
    const login = await postJson(`${baseUrl}/api/developer-override/login`, { masterKey: MASTER_KEY });
    const cookie = cookiePairFrom(login.response);

    const logout = await postJson(`${baseUrl}/api/developer-override/logout`, {}, cookie);
    expect(logout.response.status).toBe(200);
    expect(logout.response.headers.get("set-cookie")).toContain("qflash_dev_override=");

    const status = await getJson(`${baseUrl}/api/developer-override/status`, cookie);
    expect(status.response.status).toBe(401);

    const auditText = JSON.stringify(store.listAudit());
    expect(auditText).toContain("developer_override.logout");
    expect(auditText).not.toContain(cookie.split("=")[1]);
  });

  it("requires a valid session for override audit and stores sanitized event fields", async () => {
    const { baseUrl, store } = await startApp({ masterKey: MASTER_KEY });
    const unauthenticated = await postJson(`${baseUrl}/api/developer-override/audit`, {
      eventType: "technical_command",
      commandType: "fastboot",
      result: "blocked",
    });
    expect(unauthenticated.response.status).toBe(401);

    const login = await postJson(`${baseUrl}/api/developer-override/login`, { masterKey: MASTER_KEY });
    const cookie = cookiePairFrom(login.response);
    const event = await postJson(
      `${baseUrl}/api/developer-override/audit`,
      {
        eventType: "technical_command",
        mode: "full_override",
        workflowMode: "standard",
        modelId: "xiaomi15ultra",
        phase: "flash-ftd",
        bypassedGates: ["payment", "preflight"],
        commandType: "fastboot",
        result: "failed",
        metadata: { reason: "mock-client command failed", attempts: 1 },
      },
      cookie,
    );
    expect(event.response.status).toBe(201);

    const events = store.listAudit();
    const overrideEvent = events.find((row) => row.action === "developer_override.event");
    expect(overrideEvent).toBeTruthy();
    expect(overrideEvent?.model_id).toBe("xiaomi15ultra");
    expect(metadataFor(overrideEvent!)).toMatchObject({
      eventType: "technical_command",
      mode: "full_override",
      workflowMode: "standard",
      phase: "flash-ftd",
      bypassedGates: ["payment", "preflight"],
      commandType: "fastboot",
      result: "failed",
      metadata: { reason: "mock-client command failed", attempts: 1 },
    });

    const auditText = JSON.stringify(events);
    expect(auditText).not.toContain(MASTER_KEY);
    expect(auditText).not.toContain(cookie.split("=")[1]);
  });

  it("rejects secret-like audit metadata without storing the secret", async () => {
    const { baseUrl, store } = await startApp({ masterKey: MASTER_KEY });
    const login = await postJson(`${baseUrl}/api/developer-override/login`, { masterKey: MASTER_KEY });
    const cookie = cookiePairFrom(login.response);
    const secretValue = randomUUID();

    const result = await postJson(
      `${baseUrl}/api/developer-override/audit`,
      {
        eventType: "session_notice",
        result: "blocked",
        metadata: { sessionId: secretValue },
      },
      cookie,
    );

    expect(result.response.status).toBe(400);
    expect(result.json.error.code).toBe("DEVELOPER_OVERRIDE_AUDIT_INVALID");
    expect(JSON.stringify(store.listAudit())).not.toContain(secretValue);
  });
});
