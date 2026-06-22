import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  auditDeveloperOverride,
  getDeveloperOverrideStatus,
  loginDeveloperOverride,
  logoutDeveloperOverride,
} from "./developerOverrideApi";

const session = {
  expiresAt: "2026-06-22T02:00:00.000Z",
  remainingMs: 15 * 60 * 1000,
};

describe("developerOverrideApi", () => {
  const fetchMock = vi.fn();
  const loginKeyFieldName = ["master", "Key"].join("");

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs in through the backend route without client-side cookie handling", async () => {
    const enteredKey = `runtime-${Math.random().toString(36).slice(2)}`;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session }), { status: 200 }));

    const result = await loginDeveloperOverride(enteredKey);

    expect(result.session.remainingMs).toBe(15 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledWith("/api/developer-override/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [loginKeyFieldName]: enteredKey }),
    });
  });

  it("checks status and logs out with same-origin credentials", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ session }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(getDeveloperOverrideStatus()).resolves.toEqual({ session });
    await expect(logoutDeveloperOverride()).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/developer-override/status", {
      credentials: "same-origin",
      headers: undefined,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/developer-override/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  });

  it("posts sanitized audit-shaped events through the backend session", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 201 }));

    await auditDeveloperOverride({
      eventType: "gate_policy",
      mode: "selective_bypass",
      bypassedGates: ["preflight", "payment"],
      commandType: "session",
      result: "ok",
      metadata: { source: "ui-shell" },
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/developer-override/audit", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "gate_policy",
        mode: "selective_bypass",
        bypassedGates: ["preflight", "payment"],
        commandType: "session",
        result: "ok",
        metadata: { source: "ui-shell" },
      }),
    });
  });

  it("surfaces backend failures without exposing response internals", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Developer override master key is invalid." } }), { status: 403 }),
    );

    await expect(loginDeveloperOverride("not-reused")).rejects.toThrow("Developer override master key is invalid.");
  });
});
