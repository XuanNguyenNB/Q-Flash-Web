# S1 Backend Donation Authority - Validation

## Proof Strategy

Prove the backend can own anonymous donation state independently from unlock orders, and prove paid donation cannot create or use unlock entitlement.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Amount validator accepts bounds/suggestions and rejects missing, non-integer, decimal, string, below min, above max. |
| Integration | Donation create/poll/expire/paid webhook, provider QR fields, replay idempotency, invalid signature/mismatch rejection. |
| E2E | Not in S1. |
| Platform | Not in S1. |
| Performance | Not in S1. |
| Logs/Audit | Donation-created/paid/expired/rejected audit records are distinguishable from unlock order/pass audit. |

## Fixtures

- Mock provider donation link with deterministic `checkoutUrl`, `paymentLinkId`, and `qrCode`.
- payOS signed webhook payload using `test_checksum_key`.
- Existing unlock order fixture from `server/payments.test.ts`.
- In-memory SQLite database.

## Commands

Baseline and focused commands:

```powershell
npm.cmd run server:test
npm.cmd test -- server
```

Before S1 is considered implementation-complete:

```powershell
npm.cmd test
npm.cmd run build
```

## Acceptance Evidence

Feasibility baseline before implementation:

- `node:sqlite` import probe passed.
- `npm.cmd run server:test`: passed, 1 test file / 10 tests.
- `npm.cmd test -- server`: passed, 1 test file / 10 tests.

## Current Validation Status

Feasibility validation is READY WITH CONSTRAINTS. Implementation has not started.
