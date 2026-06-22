# Epic Map: payOS Donations

Mode: `high_risk_feature`

## Feature Outcome

Q Flash Web has an independent "Ủng hộ dự án" donation flow. A visitor can choose or enter an integer VND amount from 10,000d to 5,000,000d, create a payOS donation, scan an on-page QR, see status update through polling, and receive a thank-you state after payment. SQLite stores donation amount, status, provider identifiers, and timestamps. Admin can list and inspect donations for reconciliation. Paid donations do not grant unlock passes, asset keys, or workflow permissions.

## Architecture / Reality Basis

- The current backend already has Express, zod request parsing, mock/payOS provider adapter, payOS HMAC helpers, SQLite via `node:sqlite`, and token-gated admin.
- The current store is unlock-specific and `markOrderPaidByCode()` always issues a pass, so donation must use an isolated paid transition.
- The current provider needs QR support because payOS create-link response includes `qrCode` and donation requires on-page QR.
- The current React UI is a single page with product sections and workspace panels; donation can be added as another product section plus a compact workspace entry without altering workflow state.
- Production deployment is already guarded against static-only payment releases, but production `/api` was previously missing; donation deploy remains blocked until backend service/proxy/secrets exist.
- gkg discovery is unavailable in this environment; planning is based on official docs plus targeted file reads.

## Epics

| Epic | Capability/Risk Area | Why It Exists | Stories | Proof Needed |
| --- | --- | --- | --- | --- |
| E1 Backend Donation Authority | SQLite model, amount validation, provider QR fields, donation state transitions | Establishes the domain split that prevents donation from becoming unlock entitlement. | S1 Backend donation authority | Server tests for amount bounds, QR/provider fields, create/poll/expire/paid, no pass rows. |
| E2 Webhook And Admin Isolation | payOS signed webhook dispatch, idempotency, admin list/detail | Shared payOS webhook/admin surfaces are the easiest place to confuse donation and unlock orders. | S2 Webhook/admin isolation | Signed webhook tests for donation and unlock, replay tests, admin tests, issue-pass not available for donations. |
| E3 Website Donation Experience | React donation section, workspace entry, QR rendering, polling states | Delivers user-facing donation flow without touching unlock workflow state. | S3 Donation UI and polling | App/service tests plus desktop/mobile browser QA for loading, QR, success, expired, failed, fallback URL. |
| E4 Operator Docs And Release | Docs, deploy readiness, production smoke | Required to safely deploy provider-backed payment behavior and prove public `/api` is live. | S4 Docs, deploy, smoke | `npm test`, server tests, build, browser QA, `/api/health`, production donation create/poll/admin smoke. |

## Story Queue

| Story | Epic | Outcome | Depends On | Feasibility Status |
| --- | --- | --- | --- | --- |
| S1 Backend donation authority | E1 | Backend can create/poll/expire/mark-paid anonymous donations with QR/provider fields and no pass/key side effects. | Existing payment backend and official payOS docs. | Ready for validating; gkg unavailable but code path is locally readable. |
| S2 Webhook/admin isolation | E2 | payOS webhook dispatch safely handles unlock vs donation and admin can reconcile donation details without pass actions. | S1 data model and paid transition. | Needs S1 shape. |
| S3 Donation UI and polling | E3 | Site shows "Ủng hộ dự án", suggested/custom amount, QR, fallback checkout URL, polling, success/expired/failed states. | S1 API contract; ideally S2 webhook state semantics. | Needs API contract from S1. |
| S4 Docs, deploy, smoke | E4 | Operator docs and deployment proof cover donation flow, backend readiness, production create/poll/admin smoke. | S1-S3 local proof; production secrets/service/proxy available outside git. | Blocked until local implementation complete and production backend credentials/proxy are available. |

## Current Story To Prepare

Prepare **S1 Backend Donation Authority** after work-shape approval.

S1 should be small enough for feasibility validation and one bounded execution pass:

- provider result includes `qrCode`;
- donation create rejects invalid amounts and accepts valid suggested/custom amounts;
- donation poll returns pending/expired/paid states;
- signed payOS webhook can mark a donation paid;
- replayed webhook is idempotent;
- paid donation creates no pass and cannot authorize asset keys;
- existing unlock order/pass tests continue to pass.

## Approval Summary

Approve this epic map before current story prep and validation.

The first approved work should focus only on backend donation authority and proof of isolation from unlock pass/key authorization. Frontend QR UX, admin polish, docs, deploy, and production smoke remain planned epics but should not be executed until backend isolation is validated.
