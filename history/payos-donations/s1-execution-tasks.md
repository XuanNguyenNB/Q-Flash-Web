# S1 Backend Donation Authority - Execution Tasks

Date: 2026-06-18

Status: implemented locally; awaiting S1 review

## Gate

S1 execution was explicitly approved by the operator and implemented through the degraded direct-execution path.

`br`, `bv`, and `gkg` are not available on PATH in this workspace. S1 used this task list and `history/payos-donations/current-story-pack.md` as the execution boundary.

## Task Order

1. Provider QR contract
   - Extend `server/src/payments/provider.ts` so payment link creation can return `qrCode` while preserving `checkoutUrl`, `paymentLinkId`, and current unlock behavior.
   - Allow donation-specific item naming without changing the unlock item default.
   - Add or extend tests so the mock provider returns deterministic `checkoutUrl`, `paymentLinkId`, and `qrCode`.

2. Donation persistence
   - Add isolated donation storage in `server/src/db/store.ts` or a nearby store module.
   - Prefer a separate `donations` table with `order_code`, `status`, `amount`, `currency`, `checkout_url`, `qr_code`, `provider`, `provider_payment_link_id`, `created_at`, `expires_at`, `paid_at`, and `updated_at`.
   - Keep paid donation transitions separate from `markOrderPaidByCode()` and never call pass issuance from donation code.

3. Donation API
   - Add `POST /api/donations` with backend amount validation for integer VND `10000..5000000`.
   - Add `GET /api/donations/:id` for polling pending, paid, expired, and failed/cancelled states.
   - Return only donation reconciliation fields. Do not return pass token, asset key material, serial, model fields, donor identity, or public donor data.

4. Webhook dispatch
   - Update `POST /api/payments/webhook/payos` to dispatch by backend-owned order identity before state changes.
   - For donation webhooks, verify signature, success status, amount, currency, donation identity, and `paymentLinkId` when present.
   - Make replay idempotent without duplicate payment accounting and without pass/key side effects.
   - Preserve the existing unlock webhook path and its idempotent one-pass behavior.

5. Admin backend surface
   - Add token-gated donation list/detail routes under the existing admin boundary.
   - Keep pass issue/revoke actions limited to unlock orders.
   - Keep v1 anonymous: no donor name, message, phone, email, receipt, or public donor list.

6. Focused backend proof
   - Add tests for valid amounts: `10000`, `20000`, `50000`, `100000`, `200000`, `5000000`.
   - Add tests for invalid amounts: missing, string, decimal, `9999`, `5000001`.
   - Prove donation create returns `qrCode`, `checkoutUrl`, provider id, amount, status, and timestamps.
   - Prove polling pending and expiry.
   - Prove signed webhook marks donation paid, rejects invalid signature and mismatched amount/currency/link, and replay remains idempotent.
   - Prove paid donation creates no pass row, returns no pass token, and cannot authorize asset keys.
   - Re-run existing unlock webhook tests to prove unlock still issues exactly one pass.

## Verification Commands

Passed after S1 implementation:

```powershell
npm.cmd run server:test
npm.cmd test -- server
npm.cmd test
npm.cmd run build
```

Results:

- `npm.cmd run server:test`: 1 test file, 14 tests passed.
- `npm.cmd test -- server`: 1 test file, 14 tests passed.
- `npm.cmd test`: 14 test files, 96 tests passed.
- `npm.cmd run build`: TypeScript, server TypeScript, and Vite build passed.

## Stop Conditions

- Any implementation path weakens existing unlock payment/pass/asset-key authorization.
- Donation paid state can reach `issuePass()` or asset-key authorization.
- Webhook identity is ambiguous between donation and unlock order.
- Tests cannot prove replay idempotency and no pass/key side effects.
- payOS provider changes require credentials committed to the repo.

## Handoff

After S1 passes, move Khuym state to the next validated slice before frontend QR/admin polish/deploy. Do not start E3 website UI or production deploy from this file alone.
