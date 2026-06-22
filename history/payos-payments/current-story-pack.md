# Current Story Pack: Backend Payment/Pass/Key Spine

Epic: E1 Backend payment/pass spine, with the first E2 key-authorization contract included because paid frontend asset safety depends on it.

## Entry State

- No `server/` backend exists.
- The frontend can verify a device and stores verified Fastboot serial/model in `TargetDetection`.
- `CryptoAssetClient` currently decrypts encrypted assets with public `keys.json`.
- Node runtime is v24.16.0 and supports `node:sqlite`.
- Express is not installed yet and must be added.
- Khuym bead CLIs are unavailable, so execution will be a bounded direct implementation instead of a bead graph unless tooling appears.

## Exit State

After this story:

- `server/` contains a Node/Express backend with SQLite migrations and config parsing.
- Backend can start locally and expose a health endpoint.
- Mock payment provider can create a 10,000 VND payment order without live payOS credentials.
- payOS signature helpers verify official-style sorted HMAC-SHA256 payloads.
- Orders expire after 10 minutes if pending.
- Paid orders issue one pass tied to serial/model.
- Unused passes expire after 7 days.
- Pass consume is atomic and allows retry only for the same serial/model within 24 hours.
- Backend key authorization endpoint returns configured keys only for authorized pass/session/path requests.
- Audit events are written for order creation, webhook/manual paid, pass issue/consume/revoke, and key authorization decisions.
- Local tests cover payment state transitions, payOS signature verification, pass issue/consume/retry/revoke, key authorization, and audit writes.
- `.gitignore` and `.env.example` cover backend DB/key/admin/payment env names without secrets.

## Files Likely Touched

- `package.json`
- `package-lock.json`
- `.gitignore`
- `.env.example`
- `server/**`
- `docs/PAYMENTS.md`
- `history/payos-payments/validation.md`
- `.khuym/state.json`

Frontend wiring is out of scope for this first story except where tests or shared contracts require a placeholder. `src/` workflow gates are a later story after backend contracts pass.

## Feasibility Assumptions

| Assumption | Risk | Proof Needed |
| --- | --- | --- |
| Node can use SQLite without native dependency install risk. | Medium | `node:sqlite` probe passes. |
| Express can be added cleanly to the existing root package. | Low | `npm.cmd install express @types/express` succeeds and package lock updates. |
| Backend tests can run under existing Vitest setup or a server-specific config. | Medium | Focused backend tests execute locally. |
| Fastboot serial/model is available before payment gate. | Medium | Existing `TargetDetection.fastbootSerial` is populated in runner after verification. |
| Key authorization can be proven before frontend wiring. | High | Backend endpoint/repository tests reject unauthorized requests and accept paid same serial/model. |

## Verification

During implementation:

- `npm.cmd test -- server`
- `npm.cmd test -- server src/services/cryptoAssetClient.test.ts` once frontend key client work starts
- Focused backend tests for transitions and signature helpers

Story exit proof:

- `npm.cmd test -- server`
- Local backend startup/migration smoke
- No generated DB/key files tracked by git

Full feature proof remains deferred until all epics complete:

- `npm.cmd test`
- `npm.cmd run build`
- Local mock payment/pass/key/consume/admin flow

## Out Of Scope

- React payment UI.
- Replacing frontend `CryptoAssetClient` public key fetch.
- Dangerous-phase pass consume hook.
- Admin dashboard UI.
- Production live payOS credentials or live webhook confirmation.
- Uploading or changing real R2 asset releases.

## Bead Mapping

Bead CLI tooling is unavailable on PATH. This story will proceed as a bounded direct implementation after validation, with file scope limited to backend/config/docs for this story.
