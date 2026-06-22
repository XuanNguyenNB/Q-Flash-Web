# Current Story Pack: S1 Backend Donation Authority

Epic: E1 Backend Donation Authority

## Entry State

- `server/src/db/store.ts` has unlock-specific `orders` and `passes` tables.
- `PaymentStore.createOrder()` always creates a 10,000 VND unlock order tied to model/product/serial.
- `PaymentStore.markOrderPaidByCode()` always marks an unlock order paid and issues/returns an unlock pass.
- `server/src/routes.ts` has unlock order create/poll routes and a shared payOS webhook route that currently resolves `orderCode` only against unlock orders.
- `server/src/payments/provider.ts` creates payment links with unlock item copy and returns `checkoutUrl`, optional `paymentLinkId`, and raw data, but not `qrCode`.
- Existing backend tests in `server/payments.test.ts` cover unlock orders, payOS signature verification, pass lifecycle, admin, and asset-key authorization.

## Exit State

After S1 execution:

- Backend can create an anonymous donation record with an integer VND amount from `10000` through `5000000`.
- Backend rejects missing, non-integer, decimal, string, below-minimum, and above-maximum donation amounts.
- Payment provider abstraction returns `qrCode` for donation create responses while preserving unlock checkout behavior.
- Donation polling returns pending, paid, expired, and failed/cancelled states without a pass.
- Signed payOS webhook can mark a donation paid after validating signature, amount, currency, provider payment link id when present, and donation order identity.
- Replayed donation webhook is idempotent and does not double-count payment or create pass/key side effects.
- Paid donation creates no pass row, returns no pass token, and cannot authorize asset keys.
- Existing unlock order/pass/key tests continue to pass.

## Files Likely Touched

- `server/src/payments/provider.ts`
- `server/src/db/store.ts` or a new adjacent donation store module under `server/src/db/`
- `server/src/routes.ts`
- `server/payments.test.ts`
- `src/services/paymentApi.ts` only if shared response types need a `qrCode` field for backend contract tests; frontend donation UI remains out of scope for S1.
- `docs/PAYMENTS.md` only for a short progress-log note if backend contract changes during S1.

## Feasibility Assumptions

| Assumption | Risk | Proof Needed |
| --- | --- | --- |
| Separate donation persistence can coexist with current unlock `orders`/`passes` schema. | Medium | Inspect store migration and add tests that no pass row exists for paid donation. |
| Provider can expose `qrCode` without breaking unlock create flow. | Medium | Mock provider test and payOS response parsing test preserve `checkoutUrl`/`paymentLinkId`. |
| Webhook can dispatch by `orderCode` safely between unlock and donation. | High | Tests for donation webhook, unlock webhook, unknown order, amount mismatch, replay. |
| Asset key authorization remains pass-token-only. | High | Test paid donation cannot call `/api/assets/keys` successfully and no token is returned. |
| No live payOS credentials are needed for S1. | Low | Mock provider and signed webhook fixtures use test checksum key only. |

## Verification

Focused commands for S1:

```powershell
npm.cmd run server:test
npm.cmd test -- server
```

Broader commands before leaving S1 implementation:

```powershell
npm.cmd test
npm.cmd run build
```

Required proof cases:

- valid donation amounts: `10000`, `20000`, `50000`, `100000`, `200000`, `5000000`
- invalid donation amounts: missing, string, decimal, `9999`, `5000001`
- create donation returns `qrCode`, `checkoutUrl`, amount, status, provider identifiers, and timestamps
- poll pending donation
- expire pending donation
- signed webhook marks donation paid
- repeated signed webhook is idempotent
- invalid signature is rejected
- amount/currency/payment-link mismatch is rejected
- paid donation creates no pass and does not authorize asset keys
- existing unlock order paid flow still issues exactly one pass and remains idempotent

## Out Of Scope

- React donation section and QR rendering.
- Admin donation HTML polish beyond any minimal route needed to prove backend reconciliation.
- Production deploy and smoke.
- Public donor list, donor names/messages/contact info, receipts, recurring donations, discounts, or unlock entitlement.

## Bead Mapping

No beads created yet. After validation marks S1 READY, create current-work beads only for the backend donation authority surface, with disjoint ownership if multiple workers are used.
