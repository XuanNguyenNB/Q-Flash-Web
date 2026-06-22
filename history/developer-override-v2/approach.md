# Developer Override V2 - Approach

**Date:** 2026-06-22
**Mode gate:** `high_risk_feature`

## Mode Decision

`high_risk_feature` is required.

Smaller modes are insufficient because the work touches auth, authorization, audit/security, public API contracts, existing workflow gates, payment/pass/key behavior, desktop/mobile UI, and weakly proven dangerous command paths.

## Recommended Approach

Use an epic map with one current story prepared after approval. The first story should build the backend override session and audit spine because every frontend and runner bypass must depend on a server-confirmed unexpired session.

Implementation should proceed in small vertical slices after validation:

1. Backend auth/session/audit spine.
2. Frontend override API/status model and locked panel shell.
3. Runner/hook gate policy for Resume and Selective Bypass with default behavior unchanged.
4. Full Override integration for existing supported phases and Fastboot terminal only.
5. End-to-end validation, docs, CSP/build/browser checks, and report.

## Key Design Direction

- Prefer an in-memory server-side override session store keyed by a cryptographically random opaque session id in an HttpOnly cookie.
  - This avoids signing secrets in frontend code and avoids committing reusable session material.
  - Server restart invalidates sessions, which is acceptable for a 15-minute developer override.
  - Validation must prove logout removes the session and expiry rejects old cookies.
- Add backend config for `DEVELOPER_OVERRIDE_MASTER_KEY`.
- Reuse the existing `audit_events` table with override-specific action names and sanitized metadata.
- Replace the old frontend-only `VITE_ALLOW_TARGET_OVERRIDE` override path with backend-session-gated behavior.
- Represent override gate policy explicitly in workflow types.
  - Default policy is no override and must be behaviorally identical to current flow.
  - Resume marks skipped earlier phases as manually assumed.
  - Bypassed checks log/display `bypassed`, not `verified`.
- Treat Full Override as a preset gate policy plus access to existing supported phase controls and Fastboot terminal behavior.
  - Do not add ADB terminal.
  - Do not add EDL terminal or EDL commands.

## Rejected Alternatives

- Keep `VITE_ALLOW_TARGET_OVERRIDE` as the authorization mechanism.
  - Rejected: violates backend-only master-key/session requirements and would put authority in the frontend bundle.
- Use the existing admin token/query-token cookie for override.
  - Rejected: admin query token can appear in URLs and is a different trust boundary.
- Add raw ADB/EDL terminals.
  - Rejected: user explicitly chose current supported surfaces and no EDL commands.
- Store override sessions in localStorage/sessionStorage.
  - Rejected: violates HttpOnly/backend-owned session requirement.
- Mark bypassed checks as successful verification.
  - Rejected: violates command truthfulness and log semantics.

## Risk Map

| Component | Risk | Reason | Proof Needed |
| --- | --- | --- | --- |
| Backend session auth | HIGH | Master key/session mistakes expose dangerous controls. | Wrong key fails, missing config disabled, cookie HttpOnly/Secure/SameSite, 15-minute expiry, logout rejection, no secret in audit. |
| Audit | HIGH | Audit is required and must not leak secrets. | Login/mode/model/phase/gate/command result events present; search proves master key/session/pass/key absent. |
| Runner gate policy | HIGH | Incorrect bypass can weaken normal flow or fake success. | Tests prove default gates unchanged and each bypass only bypasses intended checks. |
| Payment/pass/key gates | HIGH | Normal paid unlock flow must not regress. | Existing payment tests still pass; override bypass does not change `/api/assets/keys` normal authorization. |
| UI override panel | MEDIUM | Dense dangerous controls can be confusing or visible to unauthorized users. | Locked state, session state, countdown, bypass chips, mobile/desktop screenshots. |
| Fastboot terminal | HIGH | Destructive manual commands already exist; override changes access policy. | Tests prove unauthorized users blocked, override audited, no EDL command UI exists. |
| EDL boundary | HIGH | Scope creep into raw EDL can brick devices and violates CONTEXT. | Search/test confirms no EDL terminal/command route or UI added. |
| CSP/build | MEDIUM | New frontend/backend API may affect CSP/SRI assumptions. | `npm run build` and `npm run check:csp` pass. |

## Likely File Boundaries

Backend:

- `server/src/config.ts`
- `server/src/routes.ts`
- `server/src/db/store.ts`
- `server/payments.test.ts` or new `server/override.test.ts`

Frontend/workflow:

- `src/services/paymentApi.ts` or new `src/services/developerOverrideApi.ts`
- `src/workflow/types.ts`
- `src/workflow/runner.ts`
- `src/workflow/preflight.ts` if gate policy needs preflight helper changes
- `src/hooks/useUnlockWorkflow.ts`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/workflow/runner.test.ts`

Docs/artifacts:

- `history/developer-override-v2/progress.md`
- `history/developer-override-v2/validation-report.md`
- Potential operator notes in `docs/WORKFLOW.md` or `docs/PAYMENTS.md` only if behavior/doc truth changes.

## Validating Questions

Validation must answer these before implementation beads:

- Can a backend-only in-memory session satisfy 15-minute expiry and logout without new dependencies?
- Can Secure/HttpOnly/SameSite cookies round-trip in local test/dev setup without weakening cookie policy?
- Can runner gate policy be added with default behavior exactly unchanged?
- Can payment bypass be scoped to UI/runner gate policy without modifying normal pass consume or asset-key authorization?
- Can audit capture required events without raw secrets or unsafe command text?
- Can all three modes be proven with mock clients across Standard, EFISP, and EDL_Standard without real-device execution?

## Handoff

Planning should proceed with the epic map. After approval, prepare the current story pack for backend override auth/session/audit spine and hand off to `khuym:validating`.
