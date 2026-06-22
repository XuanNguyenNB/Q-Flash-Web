# payOS Payments v1 - Context

**Feature slug:** payos-payments
**Date:** 2026-06-18
**Exploring session:** complete
**Scope:** Deep
**Domain types:** SEE | CALL | RUN | READ | ORGANIZE

## Feature Boundary

Deliver payOS v1 paid unlock passes for Q Flash Web in this repo: free compatibility checking remains available, payment/pass/key gates are added before dangerous unlock phases, a Node/Express SQLite backend under `server/` owns orders, passes, asset key authorization, webhooks, and admin operations, and production serves the backend at the same origin under `/api`.

## Locked Decisions

These are fixed. Planning must implement them exactly.

- **D1:** Price is exactly `10000` VND for one unlock pass.
  - Rationale: The frontend may display `10.000 VND` or `10.000d`, but backend validation and payOS order creation must use integer `10000`.
- **D2:** Compatibility checking is free and must complete before the payment gate.
  - Rationale: Users only pay after the app verifies the model/session is compatible enough to proceed.
- **D3:** No customer accounts, purchase history, email, Zalo, SMS, or identity collection in v1.
- **D4:** Each paid pass is one-use and tied to the detected serial/model pair.
  - Rationale: The pass must not be reusable across devices or models.
- **D5:** An unused pass expires after 7 days.
- **D6:** Pending orders expire after 10 minutes.
- **D7:** A consumed pass allows retry only for the same serial/model for 24 hours.
  - Rationale: Browser/device interruptions can be recovered without creating a second paid unlock for the same verified target.
- **D8:** `prepare-assets` must not consume a pass.
  - Rationale: Asset download/cache is non-dangerous and may be retried before destructive work begins.
- **D9:** The first dangerous phase must consume the pass atomically before the device operation starts.
  - Dangerous phases are the existing destructive phases in `src/hooks/useUnlockWorkflow.ts`: `boot-permissive`, `write-abl`, `write-efisp`, `cleanup-data`, `flash-ftd`, `unlock-payload`, and `restore-gpt`.
- **D10:** The core ADB/Fastboot/EDL unlock order must not change except for payment, pass, and asset-key gates.
- **D11:** Encrypted unlock asset keys must not be public in paid flow.
  - Rationale: Current `CryptoAssetClient` loads public `keys.json`; implementation must replace that path with backend-authorized key retrieval for paid encrypted assets.
- **D12:** Backend is Node/Express under `server/` with SQLite storage kept in the same repo but with local database files ignored.
- **D13:** Production serves static frontend and backend on the same origin, with Nginx proxying `/api` to the backend service.
- **D14:** Admin dashboard uses simple internal admin token/password authentication only.
  - Rationale: If stronger auth is required, the task must pause instead of expanding scope.
- **D15:** Admin dashboard must list orders, show order details, mark paid manually, issue/revoke passes, and show audit events.
- **D16:** Backend, not the browser, decides order/payment/pass/key authorization.
  - Rationale: The browser can request status and keys, but cannot be trusted to self-authorize paid assets.
- **D17:** payOS integration must follow official current docs for create payment link, webhook verification, and confirm-webhook.
- **D18:** No payOS secrets, admin secrets, SQLite database files, live asset keys, or production credentials may be committed.
- **D19:** Local proof must support mock/sandbox payment without live payOS credentials.
- **D20:** `docs/PAYMENTS.md` is the running progress log and must become the operator doc before final handoff.

### Agent's Discretion

The agent may choose route names, database table/index names, exact response envelopes, UI placement, and test organization if they preserve the locked decisions, current repo patterns, and validation requirements. The agent may add dependencies needed for Express, SQLite, payOS integration, and focused tests, but must keep secrets out of git and avoid expanding to accounts or notification channels.

## Specific Ideas And References

- User requested payOS v1, one unlock pass per paid compatible device/session, price `10000` VND, and admin operations sufficient for real payment support.
- User requested Node/Express backend under `server/`, SQLite storage, static-compatible React frontend with `/api` calls, and production Nginx same-origin `/api` proxying.
- User requested official payOS docs as canonical for create payment link, webhook verification, and confirm-webhook behavior.

## Existing Code Context

From the quick scout. Downstream agents read these before planning.

### Reusable Assets

- `src/hooks/useUnlockWorkflow.ts` - Owns visible phase order, `destructivePhases`, `canRun`, `prepareAssetsEarly`, and the UI-facing runner calls. Payment/pass gates should attach here without changing phase order.
- `src/workflow/runner.ts` - Owns ADB/Fastboot compatibility detection, target verification, prepare-assets, and dangerous phase methods. The first dangerous phase consume call must happen before these methods start device-side destructive work.
- `src/workflow/types.ts` - Defines `TargetDetection`, `DeviceCompatibilityReport`, phase IDs, progress, and callback contracts. Serial/model/payment status types should fit this boundary.
- `src/services/assetClient.ts` - Owns manifest/hash loading, asset preparation, IndexedDB cache, and verified blob fetches.
- `src/services/cryptoAssetClient.ts` - Current encrypted asset client resolves encrypted files and decrypts with public `keys.json`. This is the primary paid-flow key exposure to remove.
- `scripts/build-assets.ts` - Currently writes `keys.json` into `dist-assets/` for encrypted firmware. Planning must decide how to keep backend-held live keys without breaking asset release assumptions.
- `src/services/adb.ts` - ADB wrapper can read product/version through runner shell calls but does not expose device serial.
- `src/services/fastboot.ts` - Fastboot wrapper exposes `getSerial()` through `serialno`/`serial`; this is the reliable serial source already used in compatibility reports.
- `src/App.tsx` - Main UI, compatibility panel, action buttons, and current price display. Payment gate and admin link/surface should preserve the technical console style.
- `.env.example` - Current env surface only covers asset/R2 values; payment/admin/server env vars must be added without secrets.

### Established Patterns

- Static React app reads assets from `VITE_ASSET_BASE_URL` and can remain static if all paid behavior goes through `/api`.
- Runner requires verified model and prepared assets before dangerous phases; new payment/pass checks should be another safety gate, not a reordered workflow.
- Asset cache key is `baseUrl + path + sha256`; paid key authorization must not silently reuse stale public-key behavior.
- Tests already use Vitest and focused unit tests in `src/workflow/*.test.ts` and `src/services/*.test.ts`.

### Integration Points

- `src/hooks/useUnlockWorkflow.ts` - Add payment state, polling, pass state, and can-run gating.
- `src/workflow/runner.ts` - Add pass/key hooks or dependency callbacks so pass consumption is atomic before the first dangerous phase and never during `prepare-assets`.
- `src/services/cryptoAssetClient.ts` - Replace public `keys.json` fetch with backend authorized key fetch for encrypted paths in paid mode.
- `server/` - New Express API, payOS adapter, SQLite migrations/repositories, audit, admin dashboard, and tests.
- `docs/DEPLOY.md` - Extend deployment with backend service, systemd, Nginx `/api`, and SQLite backup.
- `docs/ASSETS_R2.md` - Explain paid encrypted asset key handling and avoid public `keys.json`.
- `docs/PAYMENTS.md` - Running log and final payment/admin/operator documentation.

## Canonical References

- `AGENTS.md` - Repo operating rules, Khuym workflow, Harness workflow, asset/deploy notes.
- `README.md` - Existing commands, runtime env, and asset hosting model.
- `docs/DEPLOY.md` - Current static VPS deployment process to extend with backend service and Nginx proxy.
- `docs/ASSETS_R2.md` - Current R2 release process and public asset layout.
- `docs/WORKFLOW.md` - Existing phase order, safety gates, and prepare-assets semantics.
- `https://payos.vn/docs/api/` - Official payOS API reference including `POST /v2/payment-requests`, webhook payload, and `POST /confirm-webhook`.
- `https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/` - Official payOS signature verification rules.
- `https://payos.vn/docs/sdks/back-end/node/` - Official payOS Node SDK usage for payment link creation and webhook verification.
- `https://payos.vn/docs/cau-hoi-thuong-gap/` - Official payOS FAQ noting create-link signature fields.

## payOS Doc Snapshot

As checked on 2026-06-18:

- Create payment link uses payOS payment requests with `orderCode`, `amount`, `description`, `items`, `cancelUrl`, and `returnUrl`; the Node SDK exposes `paymentRequests.create(...)`.
- The create-link signature is HMAC-SHA256 over sorted fields: `amount`, `cancelUrl`, `description`, `orderCode`, and `returnUrl`.
- Payment webhooks deliver `code`, `desc`, `success`, `data`, and `signature`; webhook data signature verification uses HMAC-SHA256 over sorted `data` fields with the checksum key.
- `confirm-webhook` registers/validates the webhook URL and payOS sends a sample signed payload during confirmation.

No official-doc conflict was found during exploring. Live webhook confirmation requires production credentials and must remain a pause condition.

## Outstanding Questions

### Resolve Before Planning

- None. The user prompt supplied enough product, scope, validation, and pause rules to plan.

### Deferred To Planning

- [ ] Decide exact API response envelope and error code shape.
- [ ] Decide whether to use official `@payos/node` SDK directly or a tiny adapter around payOS HTTP/signature logic for easier tests.
- [ ] Decide the backend-held key storage format for local dev and production so public `keys.json` is removed from paid encrypted assets without committing live keys.
- [ ] Decide how the frontend distinguishes free compatibility state, pending payment, paid pass, consumed retry window, and expired/revoked states.
- [ ] Decide whether admin dashboard is server-rendered HTML under `/api/admin` or a small React route calling admin APIs.

## Deferred Ideas

- Customer accounts and purchase history - explicitly out of scope for v1.
- Email, Zalo, SMS, or receipt delivery - explicitly out of scope for v1.
- Strong admin authentication, roles, or sessions beyond simple internal token/password - pause if required.
- Native helper/libusb/UsbDk for EDL reliability - unrelated to payment v1 and should not be added here.
- Live payOS credential setup or production webhook confirmation - pause until operator provides credentials outside git.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked decisions, code context, canonical references, and deferred-to-planning questions. Validating and reviewing use locked decisions for coverage and UAT.
