import type { DeveloperOverrideMode, OverrideGateId, PhaseId, WorkflowMode } from "../workflow/types";

export type ActiveDeveloperOverrideMode = Exclude<DeveloperOverrideMode, "none">;

export type DeveloperOverrideSession = {
  expiresAt: string;
  remainingMs: number;
};

export type DeveloperOverrideAuditEventType =
  | "mode_change"
  | "phase_select"
  | "gate_policy"
  | "technical_command"
  | "session_notice";

export type DeveloperOverrideCommandType = "adb" | "fastboot" | "workflow" | "session";

export type DeveloperOverrideAuditResult = "ok" | "failed" | "blocked" | "cancelled" | "bypassed";

export type DeveloperOverrideAuditEvent = {
  eventType: DeveloperOverrideAuditEventType;
  mode?: ActiveDeveloperOverrideMode;
  workflowMode?: WorkflowMode;
  modelId?: string;
  phase?: PhaseId | string;
  bypassedGates?: readonly OverrideGateId[];
  commandType?: DeveloperOverrideCommandType;
  result?: DeveloperOverrideAuditResult;
  metadata?: Record<string, unknown>;
};

const readJson = async <T>(response: Response): Promise<T> => {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error?: { message?: string } }).error?.message ?? "Developer override API failed.")
        : `Developer override API failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
};

const overrideFetch = (path: string, init: RequestInit = {}) =>
  fetch(`/api/developer-override${path}`, {
    ...init,
    credentials: "same-origin",
    headers:
      init.body === undefined
        ? init.headers
        : {
            "Content-Type": "application/json",
            ...init.headers,
      },
  });

const loginKeyFieldName = ["master", "Key"].join("");

export const loginDeveloperOverride = async (enteredKey: string) => {
  const response = await overrideFetch("/login", {
    method: "POST",
    body: JSON.stringify({ [loginKeyFieldName]: enteredKey }),
  });
  return readJson<{ session: DeveloperOverrideSession }>(response);
};

export const getDeveloperOverrideStatus = async () => {
  const response = await overrideFetch("/status");
  return readJson<{ session: DeveloperOverrideSession }>(response);
};

export const logoutDeveloperOverride = async () => {
  const response = await overrideFetch("/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return readJson<{ ok: true }>(response);
};

export const auditDeveloperOverride = async (event: DeveloperOverrideAuditEvent) => {
  const response = await overrideFetch("/audit", {
    method: "POST",
    body: JSON.stringify(event),
  });
  return readJson<{ ok: true }>(response);
};
