# S1 Current Story Pack: Backend Override Auth, Session, And Audit Spine

Date: 2026-06-22
Story id: `QFW-DEVOVR-S1`
Mode: `high_risk_feature`
Epic: E1 Backend Override Authority
Status: Implemented and verified for S1.

## Approval Basis

The user approved `history/developer-override-v2/epic-map.md`. This story is the first execution slice from that map and is limited to the backend authority boundary required before any frontend, runner, or terminal override expansion.

## Story Outcome

The backend can authenticate a fixed environment-only Developer Override master key, issue a 15-minute server-owned override session through an HttpOnly/Secure/SameSite cookie, report valid session status, expire or logout that session, and audit sanitized override events without storing or returning reusable secrets.

## Scope

In scope:

- Add backend config for `DEVELOPER_OVERRIDE_MASTER_KEY`.
- Add a server-side in-memory session store keyed by an opaque random session id.
- Set an override cookie, proposed name `qflash_dev_override`, with `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/developer-override`, and 15-minute `Max-Age`.
- Add override auth routes:
  - `POST /api/developer-override/login`
  - `GET /api/developer-override/status`
  - `POST /api/developer-override/logout`
  - `POST /api/developer-override/audit`
- Extend backend audit action typing for override events.
- Add focused backend tests for missing config, wrong key, success cookie attributes, status, expiry, logout, session-required audit, and secret-free audit records.
- Keep existing payment, pass, asset-key, donation, and admin behavior unchanged.

Out of scope:

- React override panel.
- Runner gate policy, Resume, Selective Bypass, or Full Override behavior.
- Any ADB, Fastboot, or EDL command execution.
- Any EDL terminal or new EDL command surface.
- Production deploy or real-device testing.

## Locked Decision Coverage

- D1-D3: Backend-only master key, backend session creation, 15-minute Secure/HttpOnly/SameSite cookie.
- D4-D5: Status/logout/expiry primitives that the frontend will use to lock the panel.
- D6 and D19: Normal user and payment/asset-key flows stay untouched in this story.
- D17-D18: Override events are audited and must not include the master key, session id, pass token, asset key, or other reusable secret.
- D20-D21: No deploy, no device execution, and no implementation before validation approval.

## Proposed Backend Contract

`POST /api/developer-override/login`

- Body: `{ "masterKey": "<operator input>" }`
- Disabled response when env key is absent: `403` with `DEVELOPER_OVERRIDE_NOT_CONFIGURED`.
- Wrong key response: `403` with `DEVELOPER_OVERRIDE_FORBIDDEN`.
- Success response: `200` with `{ "session": { "expiresAt": "...", "remainingMs": 900000 } }` and the override cookie.
- Audit:
  - `developer_override.login.rejected` for disabled/wrong key without recording the submitted key.
  - `developer_override.login.accepted` for success without recording the session id.

`GET /api/developer-override/status`

- Requires a valid unexpired override cookie.
- Success response: `200` with `{ "session": { "expiresAt": "...", "remainingMs": <number> } }`.
- Missing, invalid, or expired cookie response: `401` with `DEVELOPER_OVERRIDE_SESSION_REQUIRED`.

`POST /api/developer-override/logout`

- Clears the cookie and invalidates the current session if present.
- Audits `developer_override.logout` when a valid session was found.

`POST /api/developer-override/audit`

- Requires a valid unexpired override session.
- Body is a strict, sanitized event envelope for later stories:
  - `eventType`: `mode_change`, `phase_select`, `gate_policy`, `technical_command`, or `session_notice`
  - optional `mode`, `workflowMode`, `modelId`, `phase`, `bypassedGates`, `commandType`, `result`, `metadata`
- The route rejects known secret-like metadata keys and stores only whitelisted/sanitized values.
- This route does not authorize command success; it records what happened after the relevant UI/runner operation.

## Implementation Boundaries For S1

Expected files:

- `server/src/config.ts`
- `server/src/routes.ts`
- `server/src/db/store.ts`
- `server/override.test.ts` or focused additions to `server/payments.test.ts`
- `history/developer-override-v2/progress.md`

No frontend or workflow source files should be edited in S1 unless validation reveals a test harness requirement. If that happens, return to planning before implementation.

## Verification Plan

Focused during S1:

- `npm.cmd run server:test`
- `npm.cmd test -- server`

Before the whole feature is complete:

- `npm.cmd test`
- `npm.cmd run server:test`
- `npm.cmd run build`
- `npm.cmd run check:csp`

S1 acceptance tests:

- Missing `DEVELOPER_OVERRIDE_MASTER_KEY` keeps login disabled.
- Wrong key returns forbidden and creates a sanitized rejection audit event.
- Correct key returns a session, sets the required cookie attributes, and creates a sanitized accepted audit event.
- Status succeeds only with a valid unexpired session and returns remaining time.
- Expired session is rejected and cannot use status or audit.
- Logout invalidates the session and clears the cookie.
- Session-required audit rejects unauthenticated callers.
- Stored audit metadata does not contain the master key, session cookie value, pass token, asset key, or submitted secret text.
- Existing payment/pass/asset-key tests still pass.

## Risks And Constraints

- Secure cookies are required even in local tests. Backend tests can inspect and replay `Set-Cookie`; local browser testing over plain HTTP may need mocked session state or HTTPS dev setup in later UI stories. Do not weaken cookie security to make HTTP dev easier.
- Existing admin query-token behavior must not be reused for the override master key.
- In-memory sessions are acceptable for a 15-minute developer override; server restart invalidates sessions.
- The audit route must capture event categories and outcomes, not raw command text or secret-bearing payloads.

## Exit Criteria

S1 is complete. Backend authority spine exists, focused and full validation commands pass, and no frontend, runner, terminal, EDL, deploy, or real-device work was included.

Implementation evidence:

- `DEVELOPER_OVERRIDE_MASTER_KEY` is parsed only by backend config.
- `POST /api/developer-override/login` rejects missing/wrong keys and creates a 15-minute opaque session cookie on success.
- `GET /api/developer-override/status` requires a valid unexpired session.
- `POST /api/developer-override/logout` invalidates the server-side session and clears the cookie.
- `POST /api/developer-override/audit` requires a valid session and rejects secret-like metadata.
- Override audit actions are stored in `audit_events` without master key or session id.
- Existing payment/pass/asset-key tests still pass.

## Bead Mapping

Formal bead tooling is unavailable in this workspace (`br`/`bv` are not on PATH and `.beads/` does not exist). S1 is therefore prepared as one bounded backend execution pass unless the user requires installing/enabling bead tooling first.
