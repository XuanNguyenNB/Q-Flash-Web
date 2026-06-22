# payOS Payments v1 - Discovery

Date: 2026-06-18

## Tooling And Workflow

- Khuym onboarding is complete and `.khuym/HANDOFF.json` does not exist.
- `history/payos-payments/CONTEXT.md` is the source of truth for locked decisions D1-D20.
- `gkg` is not available on PATH, and the scout reports the gkg server is not reachable or indexed. Planning uses targeted repo reads as a degraded fallback.
- `br`, `bv`, `cass`, and `cm` are not available on PATH. Real bead graph creation is deferred until tooling exists or validation approves a non-bead execution path.
- Harness intake classified this as `high-risk` because the feature touches payments, authorization, SQLite data, audit/security, external provider behavior, public API contracts, and frontend/backend/admin surfaces.

## Runtime And Existing Stack

- The app is Vite + React + TypeScript with Vitest. `package.json` has `npm test`, `npm run build`, and asset scripts.
- `tsconfig.json` currently includes only `src`, so backend TypeScript under `server/` will need its own tsconfig or a package script that compiles/runs server files separately.
- `vite.config.ts` configures React, Tailwind, SRI, and Vitest with jsdom setup.
- No `server/` backend exists yet.
- `.gitignore` excludes `node_modules`, `dist`, `dist-assets`, `*.local`, and Harness DB files. It does not yet exclude payment SQLite database paths or local live asset key files.

## Current Frontend Workflow

- `src/hooks/useUnlockWorkflow.ts` owns UI-facing workflow state, `destructivePhases`, `canRun`, `prepareAssetsEarly`, and runner calls.
- Dangerous phases are `boot-permissive`, `write-abl`, `write-efisp`, `cleanup-data`, `flash-ftd`, `unlock-payload`, and `restore-gpt`.
- `prepare-assets` can be run early after target verification and currently only prepares verified blobs in IndexedDB.
- `src/workflow/runner.ts` owns device compatibility checks, model locking, target verification, asset preparation, and device-side commands.
- `connectInitialAdb()` reads product and Android version. `connectFastboot()` reads `product`, `serial`, and `anti`, and stores `fastbootSerial` in `TargetDetection`.
- EFISP requires ADB-first and blocks security patches newer than `2026-02-01`.
- Existing order must remain unchanged except for payment/pass/key gates.

## Current Asset And Key Flow

- `src/services/assetClient.ts` loads `manifest.json`, `sha256sums.json`, package `flash-plan.json`, and package `sha256sums.json` from the asset base URL.
- `src/services/assetClient.ts` prepares assets by downloading, optional decode, SHA-256 verification, and IndexedDB caching.
- `src/services/cryptoAssetClient.ts` treats `unlock/payloads/`, `unlock/gpt/`, and `ennea/` paths as encrypted, downloads `<path>.enc`, then decrypts with AES-CBC keys loaded from public `keys.json`.
- `scripts/build-assets.ts` writes `keys.json` to `dist-assets/` and signs it when an asset signing key is configured.
- The paid flow must remove public key access for encrypted unlock assets. Keeping encrypted blobs public on R2 is acceptable only if decryption keys are served by backend after pass authorization.
- Existing `keys.json` release behavior is a release-process risk. Planning must include a migration path that avoids making `keys.json` public for paid encrypted assets.

## payOS Official Docs Snapshot

Checked on 2026-06-18:

- Official API reference: `https://payos.vn/docs/api/`
- Official webhook signature reference: `https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/`
- Official Node SDK docs: `https://payos.vn/docs/sdks/back-end/node/`
- Official FAQ: `https://payos.vn/docs/cau-hoi-thuong-gap/`

Facts used for planning:

- Create payment link uses payOS payment requests with `orderCode`, `amount`, `description`, `items`, `cancelUrl`, and `returnUrl`; the Node SDK exposes `paymentRequests.create(...)`.
- Create-link signature is HMAC-SHA256 over sorted fields: `amount`, `cancelUrl`, `description`, `orderCode`, and `returnUrl`.
- Payment webhooks deliver `code`, `desc`, `success`, `data`, and `signature`.
- Webhook signature verification uses HMAC-SHA256 over sorted `data` fields with the checksum key.
- `confirm-webhook` registers/validates the webhook URL and sends a sample signed payload.
- No doc conflict was found. Live webhook confirmation requires production credentials and remains out of scope until credentials are provided outside git.

## Missing Capabilities

- Backend server, database migrations, repositories, and API tests.
- payOS provider adapter and local mock/sandbox provider.
- Payment order expiration, paid status polling, pass issue, pass consume, retry window, revoke flow, and audit records.
- Backend authorized firmware key endpoint and local key source.
- Frontend payment/pass UI, polling, and dangerous-phase gating.
- Admin dashboard and admin API.
- Deployment docs for `/api` Nginx proxy, systemd, SQLite backup, env vars, and recovery.
- End-to-end local proof that backend starts, migrates SQLite, mock payment order becomes paid, pass is issued/consumed, keys are authorized, and admin operations work.

## Warnings

- ADB serial is not currently captured; Fastboot serial is captured during verified target detection. Since payment starts after compatible target verification, planning should use verified Fastboot serial as the required serial source.
- If a path lets the user reach paid dangerous phases without Fastboot serial, validation must fail or require a narrow blocker decision.
- If public `keys.json` remains available for encrypted paid assets, the feature is not complete.
- Frontend-only payment state is not authorization. Backend must decide pass/key/consume state.
