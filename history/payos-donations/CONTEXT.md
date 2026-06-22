# payOS Donations - Context

**Feature slug:** payos-donations
**Date:** 2026-06-18
**Exploring session:** complete
**Scope:** Deep
**Domain types:** SEE | CALL | RUN | READ | ORGANIZE

## Feature Boundary

Deliver an independent payOS donation flow for Q Flash Web: visitors enter or choose a VND donation amount, receive an on-page payOS QR, poll status until paid/expired/failed, and admins can reconcile donation orders; the flow must never grant unlock passes, asset keys, workflow permission, or any other paid-unlock entitlement.

## Locked Decisions

These are fixed. Planning must implement them exactly.

- **D1:** Donations are a separate order kind from paid unlock orders.
  - Rationale: All backend storage, webhook handling, admin views, and frontend clients must preserve an explicit distinction such as `orderKind = donation` or an equivalent table/domain split.
- **D2:** A paid donation never creates an unlock pass, consumes a pass, authorizes asset keys, changes `paymentReady`, or unlocks any workflow phase.
  - Rationale: Donation is support for the project, not a purchase of unlock access.
- **D3:** Existing payment/pass/asset-key gates for unlock remain unchanged except for shared provider/store refactors that preserve behavior.
- **D4:** Donation amounts are integer VND only, with backend-enforced bounds of `10000` through `5000000` inclusive.
- **D5:** Suggested donation buttons are exactly `20000`, `50000`, `100000`, and `200000` VND.
- **D6:** Donation v1 is anonymous.
  - Rationale: The user prohibited a public donor list, and the existing paid flow avoids collecting customer identity. Store only reconciliation data needed for amount, status, provider identifiers, timestamps, and audit.
- **D7:** No public donor list or public donation history is shipped in v1.
- **D8:** The primary payment surface displays the payOS QR directly on the website.
  - Rationale: `checkoutUrl` is only a fallback if QR rendering or scanner use is unavailable.
- **D9:** Backend must persist donation amount, status, provider identifiers, and timestamps in SQLite.
- **D10:** Donation pending orders expire after 10 minutes unless planning finds a payOS-required shorter expiry.
  - Rationale: This aligns with the existing paid unlock order TTL and gives the QR panel a clear expiry.
- **D11:** Backend must validate amount, status, currency, order kind, provider payment link id when present, and webhook signature before marking a donation paid.
- **D12:** Webhook handling must be idempotent and must not process a donation webhook through unlock pass issuance.
- **D13:** Replayed donation webhooks must not double-count payment, create duplicate audit events that imply a second payment, or create any pass/key side effect.
- **D14:** Donation UI states must cover amount entry, QR loading, QR ready, polling, success/thank-you, expired, failed, and retry/create-new.
- **D15:** The website must include a visible "Ủng hộ dự án" area and a small entry point from the unlock workspace.
- **D16:** Admin must list and show donation details for reconciliation.
  - Rationale: Admin can see status, amount, provider/order identifiers, timestamps, and audit; no public donor page is included.
- **D17:** Local proof must support mock donation payment without live payOS credentials.
- **D18:** Production must use real payOS credentials and admin/database secrets only from safe local/VPS configuration, never from committed files.
- **D19:** Production deploy is blocked unless the same-origin `/api` backend is provisioned and `/api/health` returns backend JSON.
  - Rationale: `history/learnings/critical-patterns.md` records a prior failure where static deploy succeeded while `/api` served SPA HTML.
- **D20:** payOS integration must follow current official payOS docs for create payment link, QR response fields, webhook signature verification, and confirm-webhook.

### Agent's Discretion

The agent may choose exact route names, response envelopes, SQLite table/index names, React component placement, admin HTML/JSON layout, QR rendering library, polling interval, and test organization if they preserve the locked decisions, current repo patterns, and validation requirements. The agent may refactor shared payment provider types only when unlock behavior remains covered by tests.

## Specific Ideas And References

- User requested a standalone donation flow, not an extension of unlock pass purchasing.
- User requested manual amount entry plus suggested amounts of 20,000d, 50,000d, 100,000d, and 200,000d.
- User requested QR on the website, with checkout URL as fallback only.
- User requested backend validation of amount, status, and webhook, plus admin donation management.
- User requested production deployment and smoke only after tests/build/browser QA pass and without weakening payment/pass/key authorization.

## Existing Code Context

From the quick scout. Downstream agents read these before planning.

### Reusable Assets

- `docs/PAYMENTS.md` - Current operator doc for payOS unlock payments, local mock mode, Nginx `/api`, systemd, admin token, and production blockers.
- `history/payos-payments/CONTEXT.md` - Source of truth for paid unlock payment/pass/key gates; donation planning must not violate these decisions.
- `src/services/paymentApi.ts` - Existing frontend client for unlock payment orders, polling, pass consume, and key authorization.
- `server/src/payments/provider.ts` - Existing mock/payOS payment provider abstraction; needs QR/result fields if reused for donations.
- `server/src/routes.ts` - Existing Express routes for unlock orders, payOS webhook, passes, asset keys, and admin pages.
- `server/src/db/store.ts` - Existing SQLite store for unlock orders, passes, and audit events.
- `server/payments.test.ts` - Existing backend tests for signatures, unlock order/pass lifecycle, webhook idempotency, admin, and asset-key authorization.
- `src/App.tsx` - Main React UI, product introduction, unlock workspace, current unlock payment panel, and desktop/mobile layout constraints.

### Established Patterns

- Static React app calls same-origin `/api`; Vite proxies local `/api` to the backend during development.
- Existing unlock orders are backend-owned and payOS/mock-provider created; the browser polls order status.
- Existing webhook verification checks payOS HMAC signature, amount, currency, and payment link id before changing backend state.
- Existing admin is simple token-gated HTML/JSON under `/api/admin`; donation admin can reuse the auth boundary without adding accounts.
- Existing deployment must verify backend health before public release because frontend-only deploy can hide a broken `/api`.

### Integration Points

- `src/services/paymentApi.ts` - Add donation API client types/functions without changing unlock payment calls.
- `src/App.tsx` - Add "Ủng hộ dự án" surface and workspace entry point while preserving unlock workspace controls.
- `server/src/payments/provider.ts` - Ensure payment creation returns `qrCode`, `checkoutUrl`, provider payment link id, and raw provider data for both unlock and donation.
- `server/src/db/store.ts` - Add donation persistence or a generic order-kind model with strict pass issuance limited to unlock orders.
- `server/src/routes.ts` - Add donation create/get/admin routes and harden webhook dispatch by order kind.
- `server/payments.test.ts` - Extend coverage for donation amount validation, mock create, webhook paid, polling, idempotency, admin, and no pass/key side effects.
- `docs/PAYMENTS.md` and `docs/DEPLOY.md` - Update operator guidance for donation QR flow, production smoke, and backend readiness.

## Canonical References

- `AGENTS.md` - Repo operating rules, Khuym workflow, Harness workflow, asset/deploy notes.
- `docs/PAYMENTS.md` - Current payOS/backend/admin operator guide.
- `docs/DEPLOY.md` - Production deployment, readiness gate, `/api/health`, Nginx, and systemd requirements.
- `history/payos-payments/CONTEXT.md` - Locked paid unlock payment/pass/key decisions that donation must not weaken.
- `history/learnings/critical-patterns.md` - Production readiness pattern requiring public backend health before deploy.
- `https://payos.vn/docs/api/` - Official payOS API docs for `POST /v2/payment-requests`, response `checkoutUrl`/`qrCode`, webhook payload, and `POST /confirm-webhook`.
- `https://payos.vn/docs/sdks/back-end/node/` - Official payOS Node SDK usage for payment link creation and webhook verification.
- `https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/` - Official payOS HMAC signature verification rules.
- `https://payos.vn/docs/checkout/how-checkout-works/` - Official checkout flow including QR scanning, return URL, and webhook update flow.

## payOS Doc Snapshot

As checked on 2026-06-18:

- Create payment link requires integer `orderCode`, integer `amount`, `description`, `cancelUrl`, `returnUrl`, and `signature`.
- Create payment link response data includes `checkoutUrl`, `paymentLinkId`, `status`, `amount`, `currency`, and `qrCode`.
- The create-link signature is HMAC-SHA256 over sorted fields `amount`, `cancelUrl`, `description`, `orderCode`, and `returnUrl`.
- Webhooks deliver `code`, `desc`, `success`, `data`, and `signature`; webhook `data` includes `orderCode`, `amount`, `currency`, `paymentLinkId`, and status fields.
- `confirm-webhook` registers or updates the webhook URL and may send a sample signed payload during verification.

## Outstanding Questions

### Resolve Before Planning

- None. Donation v1 is anonymous, independent, and bounded by the user prompt.

### Deferred To Planning

- Decide whether donations use a new `donations` table or a generalized `orders.kind` schema while preserving all unlock pass invariants.
- Decide exact API response envelope and error code names for donation amount validation and status polling.
- Decide the QR rendering approach for payOS `qrCode` strings and the fallback checkout link UI.
- Decide admin route layout: combined payments admin with kind filters or separate donation admin pages.
- Decide production smoke mechanics for creating a real donation without leaving an unreconciled payment side effect.

## Deferred Ideas

- Public donor wall or public donation history - explicitly out of scope for v1.
- Donor names, messages, email, Zalo, phone, receipts, or accounts - deferred to a separate privacy/product decision.
- Recurring donations or subscription-style support - out of scope for this standalone one-time donation flow.
- Giving donation any unlock discount, pass, asset key, or workflow privilege - prohibited by this context.
- Weakening admin auth, pass authorization, asset-key authorization, or webhook verification to simplify donation - prohibited.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked decisions, code context, canonical references, and deferred-to-planning questions. Validating and reviewing use locked decisions for coverage and UAT.
