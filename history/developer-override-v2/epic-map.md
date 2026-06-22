# Epic Map: Developer Override V2

Mode: `high_risk_feature`

## Feature Outcome

Developer Override V2 is available only to an operator with the backend master key. The operator receives a 15-minute HttpOnly/Secure/SameSite override session, can use Resume, Selective Bypass, and Full Override controls for existing supported workflow surfaces, and every override action is audited without leaking secrets. Normal users keep the existing workflow, payment, safety, and command behavior.

## Architecture / Reality Basis

- Frontend is Vite + React with workflow state in `src/hooks/useUnlockWorkflow.ts` and UI in `src/App.tsx`.
- Workflow execution and gates live in `src/workflow/runner.ts`.
- Existing terminal support is Fastboot text-only in `src/services/fastboot.ts`.
- Backend is Express + SQLite in `server/`, with existing config, admin, payment, asset-key, and audit patterns.
- `gkg` was unavailable, so repo discovery used targeted file reads and `rg`.
- CONTEXT prohibits new EDL commands and real-device execution.

## Epics

| Epic | Capability/Risk Area | Why It Exists | Stories | Proof Needed |
| --- | --- | --- | --- | --- |
| E1 Backend Override Authority | Master-key verification, 15-minute session cookie, logout, status, backend audit. | All override behavior must depend on backend authority, not frontend env flags. | S1 Backend override auth/session/audit spine. | Server tests for wrong key, success, status, expiry, logout, cookie attributes, audit without secrets. |
| E2 Gate Policy Spine | Typed gate policy through runner/hook with default behavior unchanged. | Bypass must be explicit, testable, and unable to fake device/data success. | S2 Default-preserving override gate policy; S4 Resume and Selective Bypass runner behavior. | Runner tests for every gate, default regression, manually assumed vs bypassed logs. |
| E3 Override UI And Session UX | Locked panel, login/logout, countdown, mode selector, gate toggles, warnings, mobile/desktop layout. | Dangerous controls must stay hidden until authorized and be obvious when active. | S3 Frontend session client and locked panel shell. | App tests for locked/expired/logout/mode states; screenshots desktop/mobile. |
| E4 Full Override Supported Surfaces | Full Override preset for Standard/EFISP/EDL_Standard existing phases and Fastboot terminal only. | User needs broad phase access but explicitly no EDL commands. | S5 Full Override phase/terminal integration. | Mock-client tests across Standard, EFISP, EDL_Standard; no EDL command UI/API added. |
| E5 Final Proof And Docs | Validation report, normal-flow proof, secret scan, CSP/build/browser checks. | High-risk work needs evidence before UAT. | S6 Validation report and docs refresh. | `npm test`, `npm run server:test`, `npm run build`, `npm run check:csp`, UI checks, secret/audit scan. |

## Story Queue

| Story | Epic | Outcome | Depends On | Feasibility Status |
| --- | --- | --- | --- | --- |
| S1 Backend override auth/session/audit spine | E1 | Backend can login/logout/status an override session, expire it after 15 minutes, set required cookie attributes, and audit sanitized events. | Approved epic map. | Complete. |
| S2 Default-preserving gate policy | E2 | Runner/hook accepts explicit no-override policy and existing tests prove default behavior unchanged. | S1 interface shape known. | Complete. |
| S3 Frontend session client and locked panel shell | E3 | UI locks without session, uses backend login/status/logout, shows mode/gates/countdown/warnings with session, and exposes no bypass execution yet. | S1, S2 policy model. | Complete. |
| S4 Resume and Selective Bypass behavior | E2 | Authorized policy can mark earlier phases manually assumed and bypass only selected gates. | S3 locked session shell. | Validated READY WITH CONSTRAINTS; awaiting separate execution approval. |
| S5 Full Override existing surfaces | E4 | Authorized Full Override can access all existing supported phase surfaces and Fastboot terminal, with no EDL commands added. | S3, S4. | Needs validation. |
| S6 Final validation report | E5 | Acceptance criteria are proven and documented; ready for real-device UAT but not deployed. | S1-S5. | Needs validation after implementation. |

## Completed Current Story

S3: Frontend session client and locked panel shell is complete.

Delivered:

- Frontend override API client calls backend login/status/logout/audit routes without storing reusable secrets.
- Override panel is locked without a valid backend session and supports logout/auto-expiry.
- Valid session shows mode, bypass gate selections, remaining time, and warnings as shell state only.
- No Resume, Selective Bypass, Full Override, EDL command, deploy, or real-device execution was added in S3.
- Normal workflow/payment/terminal behavior remains unchanged by focused and full validation.

## Current Story To Prepare

Prepare and validate S4: Resume and Selective Bypass behavior.

Why now:

- S1 established backend session authority.
- S2 established the explicit no-override policy baseline and proved normal gates remain intact.
- S3 added the backend-session-gated UI shell, so bypass behavior can now be wired behind the correct authority boundary.

Testable exit for S4:

- Resume mode can select workflow/model/phase and mark earlier phases `manually assumed`, not `verified`.
- Selective Bypass can bypass only selected gates from the S2 gate policy.
- Default no-override behavior remains unchanged.
- Bypasses never fake device/data/command success.
- Backend audit receives mode/model/phase/gate selections and relevant workflow command results without secrets.
- No Full Override terminal expansion, no EDL command surface, no deploy, and no real-device execution are added in S4.

## Approval Summary

The epic map is approved from earlier planning. S3 has passed implementation validation. S4 has passed Khuym validation as READY WITH CONSTRAINTS and still requires separate execution approval before implementation.
