# payOS Donations - Approach

Date: 2026-06-18

## Mode Gate

Mode: `high_risk_feature`

Smaller modes are insufficient because this work touches external provider behavior, signed webhooks, SQLite persistence, public API contracts, admin operations, production deployment, desktop/mobile UI, and an existing authorization boundary for unlock passes and asset keys.

## Recommended Approach

Build donation as a separate capability that reuses only safe infrastructure:

1. Extend the payment provider abstraction so both unlock and donation link creation can request product-specific item names and receive `qrCode`, `checkoutUrl`, provider payment link id, and raw provider data.
2. Add donation-specific persistence and state transitions in the backend, preferably a `donations` table or equivalent isolated store API, instead of running donations through unlock `orders`.
3. Dispatch payOS webhooks by `orderCode` to the correct domain before changing state:
   - unlock order -> existing paid unlock pass path,
   - donation -> mark donation paid without pass/key side effects.
4. Add donation API routes under `/api/donations` for create and poll. Validate amount server-side as integer VND from `10000` to `5000000`.
5. Add admin donation list/detail routes under the existing admin auth boundary. Keep unlock pass actions unavailable for donations.
6. Add React donation client functions and UI surfaces:
   - visible "Ủng hộ dự án" section,
   - small workspace entry point,
   - suggested amounts,
   - custom amount input,
   - on-page QR,
   - status polling and terminal-independent success/expired/failed states,
   - checkout URL fallback only.
7. Update operator docs and deployment proof to include donation smoke while preserving the backend readiness gate.

## Data Shape Recommendation

Use a separate `donations` table rather than broadening the existing unlock `orders` table for v1.

Reasoning:

- Current `orders` rows require unlock-specific `model_id`, `model_name`, `product`, and `serial`.
- Current paid transition is intentionally coupled to `issuePass()`.
- Donation has different required fields: amount, status, provider identifiers, timestamps, and anonymous reconciliation metadata only.
- A separate table makes the "paid donation grants no unlock right" invariant easier to test and review.

The store may still share constants, helper methods, `order_code` uniqueness strategy, audit table, and provider adapter. If a generalized order-kind design is chosen during implementation, validation must prove the same isolation with explicit kind checks before pass issue, admin issue-pass, and asset key authorization.

## API Shape Recommendation

Use same-origin JSON routes:

- `POST /api/donations`
  - body: `{ amount: number }`
  - validates integer VND bounds server-side
  - creates payOS/mock link with item name like `Q Flash Web donation`
  - returns `{ donation }`
- `GET /api/donations/:id`
  - returns `{ donation }`
  - updates expired pending donations before returning
- `GET /api/admin/donations`
  - token-gated JSON list
- `GET /api/admin/donations/:id`
  - token-gated JSON/HTML detail

Donation response should include only:

- `id`
- `orderCode`
- `status`
- `amount`
- `currency`
- `checkoutUrl`
- `qrCode`
- `provider`
- `providerPaymentLinkId`
- `createdAt`
- `expiresAt`
- `paidAt`
- `updatedAt`

No pass token, model id, serial, customer name, message, email, phone, or public donor list field should be returned.

## Risk Map

| Component | Risk | Reason | Proof Needed |
| --- | --- | --- | --- |
| Store/domain | HIGH | Current paid order transition always issues a pass. | Tests show donation paid creates no pass row and unlock paid still creates one pass. |
| Webhook dispatch | HIGH | Same payOS webhook route will receive both unlock and donation payments. | Signed webhook tests for donation/ unlock, amount mismatch, payment link mismatch, replay idempotency, unknown order code. |
| Provider adapter | MEDIUM | Existing provider does not expose `qrCode` and hardcodes unlock item name. | Unit/integration tests for mock link and parsed payOS response fields without losing checkout URL behavior. |
| Frontend API/UI | MEDIUM | Donation must be visible and ergonomic but must not touch workflow state. | Component tests and browser screenshots for QR/loading/success/expired/failed on desktop/mobile. |
| Admin | MEDIUM | Admin actions that issue passes must not apply to donations. | Admin tests list/detail donations and assert issue-pass route cannot operate on donation ids. |
| Production deployment | HIGH | Prior redesign deployed static site while `/api` returned SPA HTML. | Deploy script/backend health check, production `/api/health` JSON, donation create/poll smoke, admin visibility. |
| Secrets | HIGH | payOS credentials and admin token must stay outside git. | `.env.example` contains names only; git status excludes DB/secrets; production commands use external env. |

## Rejected Alternatives

1. **Reuse unlock `orders` as-is for donations.** Rejected because current schema requires device fields and paid transition issues passes.
2. **Frontend-only donation QR.** Rejected because payOS link creation, amount validation, provider identifiers, and webhook verification belong on the backend.
3. **Use checkout URL redirect as primary UX.** Rejected because the locked product decision requires QR directly on the website.
4. **Public donor wall in v1.** Rejected by context; no public donor list.
5. **Donation grants discount/pass/workflow access.** Rejected by context; donation is independent support only.

## Likely File Boundaries

Backend:

- `server/src/payments/provider.ts`
- `server/src/db/store.ts` or a new adjacent donation store module
- `server/src/routes.ts`
- `server/payments.test.ts`

Frontend:

- `src/services/paymentApi.ts`
- `src/services/paymentApi.test.ts`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/style.css` only if layout needs dedicated QR sizing

Docs/deploy:

- `docs/PAYMENTS.md`
- `docs/DEPLOY.md`
- `docs/product/q-flash-web.md`
- `docs/stories/payos-donations/*` when current story prep is approved
- `docs/TEST_MATRIX.md` or Harness durable story matrix

## Validation Questions Before Execution

- Does the chosen data model make it impossible for donation paid state to call `issuePass()`?
- Does webhook replay for a donation return idempotent success without extra paid audit that could be counted as a second payment?
- Does the QR payload from mock/payOS render locally without external image services?
- Can tests prove invalid amounts under `10000`, over `5000000`, decimal, string, and missing amounts are rejected by backend?
- Can production smoke create a legitimate donation and verify polling/admin without committing credentials or leaving secrets in command history?
- Is production backend/proxy/secrets readiness available? If not, deploy must pause after local proof.

## Current Story Recommendation

After approval of this work shape, prepare and validate the first story:

**Story S1: Backend Donation Authority**

Outcome: backend can create, poll, expire, and mark paid anonymous donation records with QR/provider identifiers, while signed payOS webhooks are idempotent and paid donations never create passes or asset-key authorization.

Why first: every frontend/admin/deploy behavior depends on a safe backend distinction between donation and unlock order. This story directly addresses the highest-risk invariant.
