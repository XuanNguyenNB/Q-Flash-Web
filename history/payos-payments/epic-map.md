# Epic Map: payOS Payments v1

Mode: `high_risk_feature`

## Feature Outcome

Q Flash Web lets users verify a Xiaomi device for free, then pay 10,000 VND through payOS for one unlock pass tied to the verified serial/model. The backend owns order state, pass issue/consume/retry/revoke state, audit records, and encrypted asset key authorization. The frontend remains static-compatible and only calls same-origin `/api` for payment/pass/key gates. Production can operate behind Nginx `/api`, and admins can support real orders and passes without customer accounts.

## Architecture / Reality Basis

- Existing app is static Vite + React with WebUSB ADB/Fastboot.
- Existing workflow already separates compatibility verification, `prepare-assets`, and dangerous phases.
- Existing Fastboot detection captures serial through `FastbootClient.getSerial()`.
- Existing encrypted firmware flow currently downloads `.enc` files but retrieves public `keys.json`; paid flow must replace this.
- No backend exists yet. Node/Express + SQLite must be added under `server/`.
- Local proof cannot require live payOS credentials.
- Khuym/gkg/bead CLI tooling is not available, so execution bead graph waits until validation/tooling can support it.

## Epics

| Epic | Capability/Risk Area | Why It Exists | Stories | Proof Needed |
| --- | --- | --- | --- | --- |
| E1 Backend payment/pass spine | Orders, payOS/mock adapter, SQLite state, pass lifecycle, audit | All paid behavior depends on durable backend authority. | S1 backend skeleton and migrations; S2 order create/status/expiry; S3 payOS webhook verify/idempotent paid; S4 pass issue/expire/consume/retry/revoke; S5 audit coverage | Backend unit/integration tests and local startup/migration proof |
| E2 Asset key authorization | Backend-held keys and frontend key client | Current public `keys.json` bypasses payment. | S6 backend key source and auth endpoint; S7 asset build/release change to keep live keys private; S8 frontend crypto client uses authorized keys | Tests proving no public-key fallback and unauthorized key requests fail |
| E3 Frontend payment/pass gates | User payment gate and dangerous phase consume gate | Existing workflow must add gates without phase reorder. | S9 payment UI after compatibility; S10 order polling/pass status; S11 prepare-assets non-consuming; S12 consume before first dangerous phase; S13 retry window UI | Hook/runner tests, app tests, local mock flow proof |
| E4 Admin operations | Internal dashboard and support actions | Operators need enough tools for real payment support. | S14 admin auth; S15 list/detail orders; S16 manual mark paid; S17 issue/revoke pass; S18 audit view | Admin route/API tests and browser/manual smoke proof |
| E5 Ops, docs, and release safety | Env, deploy, backup, recovery, final validation | Backend changes production topology and key handling. | S19 env docs; S20 Nginx/systemd docs; S21 SQLite backup/recovery; S22 payment operator runbook; S23 final full test/build/local proof | `docs/PAYMENTS.md`, deploy docs, `npm test`, `npm run build`, backend smoke proof |

## Story Queue

| Story | Epic | Outcome | Depends On | Feasibility Status |
| --- | --- | --- | --- | --- |
| S1 Backend skeleton and SQLite migrations | E1 | `server/` can start locally, migrate SQLite, expose health/config-safe routes, and run tests without secrets. | none | Needs validation |
| S2 Order create/status/expiry | E1 | Backend creates 10,000 VND pending orders tied to serial/model, expires after 10 minutes, and returns status. | S1 | Needs validation |
| S3 payOS webhook verify/idempotent paid | E1 | Official-style payOS webhooks are signature-verified, idempotently mark paid, and reject invalid payloads. | S1-S2 | Needs validation |
| S4 Pass lifecycle | E1 | Paid order yields one pass tied to serial/model; unused pass expires after 7 days; consume is atomic; retry same serial/model for 24 hours. | S1-S3 | Needs validation |
| S5 Audit coverage | E1 | Payment/pass/admin/key events write audit records. | S1-S4 | Needs validation |
| S6 Backend key source and authorization endpoint | E2 | Backend reads non-git key source and returns keys only for authorized pass/session/path requests. | S1-S4 | Needs validation |
| S7 Asset release key privacy | E2 | Paid encrypted release process does not upload public live `keys.json`. | S6 | Needs validation |
| S8 Frontend crypto authorized keys | E2 | `CryptoAssetClient` no longer decrypts paid assets from public `keys.json`; it uses `/api/assets/keys`. | S6-S7 | Needs validation |
| S9 Payment UI after compatibility | E3 | UI shows payment gate only after verified compatible serial/model. | S1-S4 | Needs validation |
| S10 Polling/pass status | E3 | UI can create mock/sandbox order, poll paid status, and display pass state. | S9 | Needs validation |
| S11 Prepare-assets non-consuming | E3 | `prepare-assets` remains available after payment authorization but never consumes a pass. | S8-S10 | Needs validation |
| S12 Dangerous phase consume gate | E3 | First dangerous phase consumes pass atomically before runner device commands. | S11 | Needs validation |
| S13 Retry window UI | E3 | Consumed same serial/model can retry within 24 hours, other serial/model cannot. | S12 | Needs validation |
| S14 Admin auth | E4 | Admin surface requires simple configured internal token/password. | S1 | Needs validation |
| S15 Admin list/detail | E4 | Admin can list orders and view order details. | S14 | Needs validation |
| S16 Manual mark paid | E4 | Admin can mark an order paid and issue pass with audit event. | S15, S4 | Needs validation |
| S17 Issue/revoke pass | E4 | Admin can issue/revoke passes with audit events. | S15, S4 | Needs validation |
| S18 Audit view | E4 | Admin can show audit events for support. | S5, S15 | Needs validation |
| S19 Env docs | E5 | `.env.example` and `docs/PAYMENTS.md` explain non-secret env vars. | E1-E4 | Deferred |
| S20 Nginx/systemd docs | E5 | Production docs explain same-origin `/api` proxy and backend service. | E1-E4 | Deferred |
| S21 SQLite backup/recovery | E5 | Operator docs cover backup and manual recovery. | E1-E4 | Deferred |
| S22 Final operator runbook | E5 | `docs/PAYMENTS.md` explains local test flow, payOS webhook setup, admin recovery, and key release safety. | E1-E4 | Deferred |
| S23 Final proof | E5 | `npm test`, `npm run build`, backend local proof, mock payment/pass/key/consume/admin flows pass. | S1-S22 | Deferred |

## Current Story To Prepare After Approval

S1-S4 should be prepared as one feasibility story: **Backend payment/pass/key spine**.

Why this story is first:

- It proves SQLite, provider adapter, order/pass state transitions, and atomic consume before frontend wiring.
- It can run locally without live payOS credentials through a mock provider.
- Frontend gates and key authorization depend on these backend contracts.
- It surfaces the serial/model binding and transition-table risks early.

Testable exit:

- Backend starts locally and migrates SQLite.
- Tests prove payment state transitions, payOS-style signature verification, pass issue/expire/consume/retry/revoke, and audit writes.
- A mock provider can create an order, mark it paid, issue a pass, authorize key access, and consume the pass before a dangerous action.
- No secrets, DB files, or live keys are committed.

## Approval

Approve this epic map before current story prep, feasibility validation, beads, or implementation.
