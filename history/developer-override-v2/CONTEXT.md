# Developer Override V2 - Context

**Feature slug:** developer-override-v2
**Date:** 2026-06-22
**Exploring session:** complete
**Scope:** Deep
**Domain types:** SEE | CALL | RUN | READ | ORGANIZE

## Feature Boundary

Deliver Developer Override V2 for Q Flash Web: a backend-authenticated, time-limited master-key override session unlocks a locked developer panel with Resume, Selective Bypass, and Full Override controls for existing supported workflow surfaces, while the normal user flow, payment behavior, safety gates, and device command truthfulness remain unchanged.

## Locked Decisions

These are fixed. Planning must implement them exactly.

- **D1:** Developer Override V2 is protected by one fixed master key read only from backend environment configuration.
  - Rationale: No reusable key, hash, derived verifier, or static secret may be committed, bundled into frontend code, printed in logs, or exposed through API responses.
- **D2:** The backend, not the browser, verifies the master key and creates the override session.
  - Rationale: The frontend may display login and status UI, but cannot self-authorize override behavior.
- **D3:** Override sessions are delivered through Secure, HttpOnly, SameSite cookies and expire after 15 minutes.
  - Rationale: The browser must not store a reusable bearer secret in local storage, session storage, JS memory as a long-lived token, or the built bundle.
- **D4:** The override panel is locked until the backend reports a valid unexpired override session.
- **D5:** The override panel must support logout and automatic expiry handling.
  - Rationale: Expiry must disable override controls without requiring a page reload.
- **D6:** Normal users must see no behavioral change in the default unlock flow.
  - Rationale: Existing preflight, model verification, payment/pass, asset-key, confirmation, antirollback, compatibility, and command-result gates remain the default behavior when no valid override session exists.
- **D7:** Resume mode lets an authorized operator select workflow family/mode, model, and phase, then mark earlier phases as complete.
  - Rationale: Earlier phases are treated as manually assumed, not verified.
- **D8:** Selective Bypass mode lets an authorized operator independently bypass model verification, preflight, payment, destructive confirmation, asset verification, antirollback, compatibility/version gates, and related runner gates.
- **D9:** Full Override mode bypasses all gates that Selective Bypass can bypass and exposes every existing supported phase surface for Standard, EFISP, and the existing EDL_Standard workflow mode.
  - Rationale: Full Override is a stronger gate policy, not permission to invent new protocol operations.
- **D10:** Full Override terminal scope is limited to currently supported command surfaces.
  - Rationale: The user selected option A during exploring.
- **D11:** There must be no EDL terminal, no arbitrary EDL command input, and no new BrowserEdlClient command surface in Developer Override V2.
  - Rationale: The user explicitly said "khong co bat ki lenh EDL nao"; existing EDL_Standard mode is a manual/external-ABL Fastboot workflow mode, not an EDL command terminal.
- **D12:** ADB and EDL access in Full Override may only occur through existing runner/workflow operations already supported by the system.
  - Rationale: If planning finds no existing ADB or EDL terminal surface, this feature must not add arbitrary raw ADB/EDL terminals.
- **D13:** The Fastboot terminal may be unlocked for the currently supported Fastboot command parser/executor only.
  - Rationale: Existing text terminal support includes `devices`, `getvar`, `erase`, `set_active`, `reboot`, and raw Fastboot protocol commands, while text-only `flash` and `boot` remain unsupported because they require file upload.
- **D14:** Override may bypass a gate but must never fake device, data, or command success.
  - Rationale: Real device connections, real blobs/data where an operation needs data, and real device/API responses must still exist. Audit/UI may say a gate was bypassed, but not that a skipped check was verified.
- **D15:** UI logs and status must distinguish `verified`, `manually assumed`, and `bypassed`.
  - Rationale: Operators must be able to tell whether a fact came from the device/backend, a resume assumption, or an override bypass.
- **D16:** The override UI must prominently show current override mode, bypassed gates, time remaining, and dangerous-operation warnings.
- **D17:** Every override login, logout, mode change, selected model, selected workflow/phase, bypassed gate set, supported technical command type, result, and timestamp must be audited by the backend.
- **D18:** Audit events must never include the master key, session secret, pass token, asset decryption key, or other reusable secret.
- **D19:** Payment and asset-key APIs must not regress for normal users.
  - Rationale: Override may bypass the frontend payment gate only when a valid override session exists; normal pass consume and `/api/assets/keys` authorization stay unchanged.
- **D20:** No production deploy and no real-device destructive execution are in scope for this feature without a separate explicit user approval.
- **D21:** Developer Override V2 must move through Khuym exploring, planning, and validating before implementation.
  - Rationale: This is high-risk security and workflow-control work.
- **D22:** Progress must be recorded in `history/developer-override-v2/progress.md`.

### Agent's Discretion

The agent may choose exact endpoint names, response envelopes, cookie names, session signing/storage strategy, audit action names, React component structure, and internal gate-policy types if they preserve the locked decisions, existing repo patterns, and validation requirements. The agent may add tests and docs needed to prove the behavior, but must pause before changing protocol-level destructive behavior, adding raw EDL command support, deploying, or running against a real device.

## Specific Ideas And References

- User requested three override levels: Resume, Selective Bypass, and Full Override.
- User required backend-only master-key verification and 15-minute Secure/HttpOnly/SameSite sessions.
- User required backend audit for login, mode, model, phase, bypassed gates, command type, result, and time, with no master-key logging.
- User required final proof through `npm test`, `npm run server:test`, `npm run build`, `npm run check:csp`, mock-client phase coverage, normal-flow regression proof, and desktop/mobile UI inspection.
- User explicitly chose Full Override option A and added that there must be no EDL commands.

## Existing Code Context

From the quick scout. Downstream agents read these before planning.

### Reusable Assets

- `src/hooks/useUnlockWorkflow.ts` - Owns UI-facing workflow state, visible phase order, old `applyDeveloperOverride`, payment/pass gating, phase confirmations, and Fastboot terminal submission.
- `src/workflow/runner.ts` - Owns model verification, phase orchestration, runner gates, old frontend-only `overrideTargetModel`, and Fastboot terminal execution.
- `src/workflow/types.ts` - Defines phase IDs, workflow modes, target detection, progress, logs, and callback contracts.
- `src/workflow/preflight.ts` - Defines preflight and EDL_Standard safety readiness behavior.
- `src/workflow/errors.ts` - Defines user-facing workflow error codes and advice, including old developer-override-disabled behavior.
- `src/services/fastboot.ts` - Existing supported Fastboot terminal parser/executor surface.
- `src/services/adb.ts` - Existing ADB primitives used by runner operations; no general ADB terminal currently exists.
- `src/services/edl.ts` - Existing structured WebUSB EDL client primitives; not currently an arbitrary terminal and must not become one for this feature.
- `src/services/paymentApi.ts` - Existing frontend payment, pass, donation, and asset-key API client surface.
- `server/src/routes.ts` - Existing Express routes for health, payments, donations, passes, asset keys, admin, and audit list.
- `server/src/config.ts` - Existing backend environment parsing and production checks.
- `server/src/db/store.ts` - Existing SQLite persistence and `audit_events` table.
- `server/payments.test.ts` - Existing backend tests for payment/pass/asset-key/admin/audit behavior.
- `src/App.tsx` and `src/App.test.tsx` - Existing UI and mocked workflow tests, including the old developer override panel.

### Established Patterns

- Static React frontend calls same-origin `/api`; local Vite can proxy to the Express backend.
- Backend owns payment/pass/asset-key authorization and stores audit events in SQLite.
- Existing admin auth uses an environment token and HttpOnly admin cookie for HTML admin navigation, but Developer Override V2 must not reuse admin query-token behavior for the master key.
- Runner gates currently guard preflight, verified target, product match, prepared assets, confirmations, antirollback, and unlock verification.
- Existing terminal support is Fastboot text-only and intentionally blocks text-only file-upload commands.
- Technical terminal logs may be ASCII; user-facing UI copy and errors should be Vietnamese with accents.

### Integration Points

- `server/src/config.ts` - Add backend-only override master-key/session configuration without exposing secrets.
- `server/src/routes.ts` - Add override auth/session/status/logout/audit routes or handlers.
- `server/src/db/store.ts` - Extend audit action support or add override-specific audit storage without storing secrets.
- `src/services/paymentApi.ts` or a new API client - Add override session/status/audit calls without changing payment API behavior.
- `src/hooks/useUnlockWorkflow.ts` - Replace old env-flag developer override with backend-session gate policy and mode-aware bypass behavior.
- `src/workflow/runner.ts` - Accept an explicit override gate policy for supported bypasses while preserving default gates.
- `src/App.tsx` - Replace the old unlocked developer override panel with a locked Developer Override V2 panel showing mode, bypassed gates, remaining time, and warnings.
- Tests in `src/workflow/*.test.ts`, `src/App.test.tsx`, `src/services/*.test.ts`, and `server/payments.test.ts` or new focused tests - Prove auth/session, gate policy, phase navigation, audit, and normal-flow regression coverage.

## Canonical References

- `AGENTS.md` - Repo operating rules, Khuym workflow, Harness workflow, asset/deploy notes.
- `history/learnings/critical-patterns.md` - Production readiness pattern for required backend health.
- `docs/WORKFLOW.md` - Existing workflow families, phases, safety gates, EDL_Standard notes, and EDL reliability constraints.
- `docs/product/q-flash-web.md` - Product contract for user-visible unlock workspace and non-goals.
- `docs/PAYMENTS.md` - Current payment/pass/key/admin operator behavior that override must not regress.
- `history/payos-payments/CONTEXT.md` - Locked paid unlock payment/pass/key decisions that normal flow must preserve.
- `src/services/fastboot.ts` - Canonical current terminal command support.
- `src/services/edl.ts` - Canonical current EDL operation boundary; no override terminal expansion is allowed.

## Outstanding Questions

### Resolve Before Planning

- None. The user answered the only blocker: Full Override uses currently supported command surfaces and no EDL commands.

### Deferred To Planning

- Decide exact backend session implementation: signed opaque cookie, server-side in-memory sessions, SQLite-backed sessions, or another backend-only strategy that supports 15-minute expiry and logout.
- Decide exact gate-policy type shape and where it is enforced between hook and runner.
- Decide exact audit storage format and action names while keeping master key and session secrets out of logs.
- Decide how to prove "normal flow unchanged" with tests around payment, asset keys, preflight, model/product verification, antirollback, confirmations, and terminal behavior.
- Decide UI structure for desktop/mobile without overcrowding the existing workspace.

## Deferred Ideas

- Production deployment - explicitly out of scope until separately approved.
- Real-device UAT or destructive command execution - explicitly out of scope until separately approved.
- Arbitrary EDL/Firehose/Sahara terminal commands - explicitly prohibited.
- New native helper/libusb/UsbDk bridge - out of scope for this feature.
- Customer/user accounts, role systems, or long-lived operator identities - out of scope unless a later task asks for them.
- Replacing payOS/admin systems wholesale - out of scope; only add override behavior without payment regression.

## Internal Review Pass

- Decision IDs are stable from D1 through D22.
- No locked decision requires storing a reusable secret in frontend code.
- No locked decision weakens the normal user flow.
- Full Override scope is explicit and does not allow new EDL commands.
- Planning has enough source files, validation expectations, and pause rules to continue.
- The only sub-agent review requirement from the exploring skill was not executed because this session's multi-agent tool policy allows spawning only when the user explicitly requests sub-agents.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked decisions, code context, canonical references, and deferred-to-planning questions. Validating and reviewing use locked decisions for coverage and UAT.
