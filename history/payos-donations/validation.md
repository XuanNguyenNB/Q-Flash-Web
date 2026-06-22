# payOS Donations - Validation

Date: 2026-06-18

Current work: S1 Backend Donation Authority

## Reality Gate Report

Mode: `high_risk_feature`

Current work: create backend donation authority that can create/poll/expire/mark-paid donations and prove paid donations do not issue passes or authorize asset keys.

| Gate | Result | Evidence |
| --- | --- | --- |
| MODE FIT | PASS | `history/payos-donations/approach.md` identifies external payment provider, signed webhook, SQLite, admin/API, and unlock authorization boundary risks. |
| REPO FIT | PASS | `server/src/routes.ts`, `server/src/db/store.ts`, `server/src/payments/provider.ts`, and `server/payments.test.ts` already provide the backend spine needed for a bounded donation story. |
| ASSUMPTIONS | PASS WITH CONSTRAINTS | `node:sqlite` probe passed; `npm.cmd run server:test` and `npm.cmd test -- server` passed. `gkg`, `br`, and `bv` are not available on PATH, so validation uses direct inspection and no beads were created. |
| SMALLER PATH | PASS | Backend donation authority is the smallest safe slice because current `markOrderPaidByCode()` always calls `issuePass()`. UI work before backend isolation would be unsafe. |
| PROOF SURFACE | PASS | Existing Vitest backend suite can be extended to cover amount bounds, provider QR fields, donation webhook idempotency, no pass row, and asset-key rejection. |

Decision: READY WITH CONSTRAINTS

Constraints:

- Execute only S1 backend donation authority next.
- Do not start frontend QR UI, production deploy, or admin polish until S1 tests prove donation/unlock isolation.
- Because `br` and `bv` are unavailable, bead creation/review cannot run in this workspace. If strict bead workflow is required before execution, install/enable those tools first; otherwise execute S1 directly with the current-story pack as the task boundary.

## Feasibility Matrix

| Part / Assumption | Risk | Proof Required | Evidence | Result |
| --- | --- | --- | --- | --- |
| Node SQLite works locally | Medium | Runtime import succeeds | `node -e "import('node:sqlite')..."` printed `node:sqlite ok` | PASS |
| Baseline backend is healthy before changes | High | Existing backend tests pass | `npm.cmd run server:test`: 1 file / 10 tests passed; `npm.cmd test -- server`: 1 file / 10 tests passed | PASS |
| Current unlock paid path issues passes | High | Code inspection proves pass issuance coupling | `rg markOrderPaidByCode|issuePass` shows `markOrderPaidByCode()` calls `issuePass()` for first and replayed paid orders | PASS |
| Donation can be isolated from unlock orders | High | Current story can add a separate donation path without removing unlock tests | Store/router/provider files are localized and existing tests are focused; S1 pack limits scope to backend donation authority | PASS WITH CONSTRAINTS |
| Provider can return QR fields | Medium | Official docs and adapter can expose `qrCode`; tests must cover mock and parsed payOS response | payOS API docs show create-link response data includes `qrCode`; current provider already parses response data for `checkoutUrl`/`paymentLinkId` | PASS WITH CONSTRAINTS |
| Webhook can dispatch donation vs unlock by order code | High | Tests must cover signed donation webhook, signed unlock webhook, replay, unknown order, amount/currency/link mismatch | Existing webhook route centralizes payOS signature and amount checks; no donation dispatch exists yet | PASS WITH CONSTRAINTS |
| Paid donation cannot authorize asset keys | High | Test paid donation returns no token/pass and `/api/assets/keys` rejects donation-derived input | Current `/api/assets/keys` requires pass token and `authorizePassForKeys()` validates pass target | PASS WITH CONSTRAINTS |
| Production deploy can be proven later | High | `/api/health` backend JSON and safe external secrets are available before deploy | Prior state says production `/api` was missing; production is outside S1 | DEFERRED |

## Current Story Readiness

Entry state is observable in current backend files and tests. Exit state is testable with focused Vitest cases and no live payOS credentials. File scope is bounded to backend store/routes/provider/tests, with frontend UI and production explicitly out of scope.

S1 is ready for execution with constraints.

## Required S1 Acceptance Checks

- Backend rejects invalid donation amounts: missing, string, decimal, `9999`, `5000001`.
- Backend accepts valid bounds and suggested amounts: `10000`, `20000`, `50000`, `100000`, `200000`, `5000000`.
- Donation create returns `qrCode`, `checkoutUrl`, provider payment link id, amount, status, and timestamps.
- Donation polling returns pending and expired states.
- Signed donation webhook marks paid after signature/amount/currency/payment-link validation.
- Replayed signed donation webhook is idempotent.
- Invalid signature and mismatched amount/currency/payment link are rejected.
- Paid donation creates no pass row and response includes no pass token.
- Paid donation cannot authorize asset keys.
- Existing unlock order paid webhook still issues exactly one pass and remains idempotent.

## Commands Run

```powershell
node -e "import('node:sqlite').then(()=>console.log('node:sqlite ok')).catch((e)=>{console.error(e.message); process.exit(1)})"
npm.cmd run server:test
npm.cmd test -- server
```

Results:

- `node:sqlite ok`
- `npm.cmd run server:test`: passed, 1 test file, 10 tests
- `npm.cmd test -- server`: passed, 1 test file, 10 tests

## Approval Gate

VALIDATION COMPLETE - APPROVAL REQUIRED BEFORE EXECUTION

Mode: `high_risk_feature`
Work: S1 Backend Donation Authority
Reality gate: PASS
Feasibility: READY WITH CONSTRAINTS
Structure: PASS after 1 iteration
Spikes: none
Integration readiness: PASS WITH CONSTRAINTS
Bead review: not done, because `br` and `bv` are unavailable on PATH
Current story/work readiness: PASS
Unresolved concerns: production backend/proxy/secrets remain deferred outside S1

Execution was explicitly approved by the operator for S1 only before runtime code edits.

## S1 Execution Evidence

S1 backend donation authority was implemented after explicit operator approval.

Implemented proof:

- Donation provider link creation now carries `qrCode` and donation-specific item naming while preserving unlock default item copy.
- SQLite has isolated donation persistence and paid transition code separate from unlock `orders` and `passes`.
- `/api/donations` create/poll validates integer VND amounts from `10000` to `5000000`.
- payOS webhook dispatch checks donation vs unlock identity before state changes.
- Donation webhook validates signature, amount, currency, and provider payment link id, then marks paid without issuing a pass.
- Donation webhook replay is idempotent and creates no second `donation.paid` audit event.
- Admin list/detail donation endpoints exist under the current admin token boundary.
- Existing unlock order webhook still issues one pass and asset-key authorization remains pass-token based.

Commands passed after implementation:

```powershell
npm.cmd run server:test
npm.cmd test -- server
npm.cmd test
npm.cmd run build
```

Results:

- `npm.cmd run server:test`: passed, 1 test file / 14 tests.
- `npm.cmd test -- server`: passed, 1 test file / 14 tests.
- `npm.cmd test`: passed, 14 test files / 96 tests.
- `npm.cmd run build`: passed.

## Current Validation Status

S1 backend donation authority is implemented and locally verified. Frontend donation QR UI, mobile/desktop browser QA, production deploy, and production smoke remain outside S1 and are still required for the full goal.

## 2026-06-18 Review Recheck

- `gkg` was unavailable on PATH, so review used direct file inspection.
- `npm.cmd run server:test`: passed, 1 test file / 14 tests.
- `npm.cmd test -- server`: passed, 1 test file / 14 tests.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/verify-release.ps1`: passed, 14 test files / 96 tests, TypeScript/server build, Vite production build, and CSP/SRI check.
- Safe local secret discovery found `.env.local` but no `PAYMENTS_*` or `PAYOS_*` values; `server/data/payment-asset-keys.local.json` exists locally.
- Safe VPS readiness probe found `qflash-payments.service=0`, `/etc/qflash-payments.env=0`, Nginx `/api` proxy `0`, `/var/lib/qflash-payments=0`, and remote asset key file `0`.
- Normal `deploy.ps1` correctly stopped before build/upload with `service=0`, `env=0`, and `nginx=0`; production deploy remains blocked until real secrets and service/proxy wiring exist outside git.
- `scripts/provision-payments-vps.ps1 -CheckOnly` now gives a non-mutating way to verify the production provisioning gap; the current VPS result is `node=1 service=0 env=0 nginx=0 current_backend=1`.
