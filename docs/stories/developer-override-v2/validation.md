# S1 Backend Override Authority - Validation

## Proof Strategy

Prove the backend can own Developer Override authority without weakening normal payment/pass/asset-key behavior. S1 validation is backend-only and uses deterministic tests; no browser device APIs, deploy, or real hardware are involved.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | Config parses `DEVELOPER_OVERRIDE_MASTER_KEY`; session helper creates, expires, and deletes opaque sessions. |
| Integration | Login disabled when not configured, wrong key rejected, correct key sets cookie attributes, status requires valid session, expiry rejects, logout clears, audit route requires session. |
| E2E | Not in S1. |
| Platform | Not in S1. |
| Performance | Not in S1. |
| Logs/Audit | Login success/failure/logout/event rows exist and contain no master key, session id, pass token, asset key, or submitted secret text. |

## Fixtures

- In-memory SQLite database.
- Mock payment provider.
- Test config with `publicBaseUrl` set to HTTPS when asserting `Secure` cookie behavior.
- Runtime-generated test master key value, never a reusable source config default.
- Existing asset-key fixture from `server/payments.test.ts` for regression proof.

## Commands

Focused commands for S1:

```powershell
npm.cmd run server:test
npm.cmd test -- server
```

Whole-feature commands remain required after all stories:

```powershell
npm.cmd test
npm.cmd run server:test
npm.cmd run build
npm.cmd run check:csp
```

## Acceptance Evidence

Feasibility baseline before implementation:

- `node --version`: `v24.16.0`
- `node:crypto` probe passed for `randomUUID`, `randomBytes`, and `timingSafeEqual`.
- `npm.cmd run server:test`: passed, 1 test file / 15 tests.
- `npm.cmd test -- server`: passed, 1 test file / 15 tests.

S1 implementation proof:

- `npm.cmd run server:test`: passed, 2 test files / 23 tests.
- `npm.cmd test -- server`: passed, 2 test files / 23 tests.
- `npm.cmd run build`: passed.
- `npm.cmd test`: passed, 15 test files / 107 tests.
- `npm.cmd run check:csp`: passed.
- Secret/bundle scan: `rg -n "DEVELOPER_OVERRIDE_MASTER_KEY|qflash_dev_override|developer_override|masterKey" dist src` returned no matches.

## Current Validation Status

S1 implementation is complete and verified. Next story must return to planning/validating before execution.
