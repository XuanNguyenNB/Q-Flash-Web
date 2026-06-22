# payOS Payments v1 - Approach

Date: 2026-06-18

## Mode Gate

Mode: `high_risk_feature`

Smaller modes are insufficient because the feature adds an external payment provider, provider webhooks, backend authorization, SQLite persistence, audit records, asset key protection, frontend workflow gates, deployment changes, and admin operations. The least workflow that protects the work is an epic map with feasibility validation before execution.

## Recommended Architecture

Add a small Node/Express backend under `server/` with its own TypeScript/runtime setup and SQLite migrations. The React app remains static and calls same-origin `/api/*` endpoints. Production Nginx proxies `/api` to the backend service and serves the existing static frontend as before.

Use backend-owned command/query boundaries:

- Commands: create order, mark payOS webhook paid, manually mark paid, issue pass, consume pass, revoke pass, authorize asset keys.
- Queries: get order status, get pass status, list admin orders, get admin order detail, list audit events.

Use a payOS provider adapter with two implementations:

- `payos` implementation using official current payOS behavior and secrets from env.
- `mock` implementation for local tests and proof without live credentials.

Use SQLite as the source of truth for:

- orders
- passes
- pass consumption/retry windows
- asset key grants or authorization events
- audit events

Keep live firmware keys outside public assets and outside git. The backend reads a local secret JSON path from env and returns only keys authorized for a paid pass/session.

## API Shape Direction

Exact response envelopes are deferred to implementation, but these contracts should exist:

- `POST /api/payments/orders`
  - Input: model id/product/name, verified serial, compatibility summary.
  - Behavior: creates a pending 10,000 VND order expiring in 10 minutes, calls payOS/mock provider, returns order id, status, checkout URL/QR data if available, and expiry.
- `GET /api/payments/orders/:id`
  - Returns pending/paid/expired/cancelled plus pass summary when paid.
- `POST /api/payments/webhook/payos`
  - Verifies payOS webhook signature, marks matching order paid exactly once, issues pass, writes audit.
- `POST /api/passes/:id/consume`
  - Input: serial/model/session proof from the verified frontend state.
  - Behavior: atomically consumes unused pass before first dangerous phase, or allows retry for same serial/model within 24 hours.
- `GET /api/passes/:id`
  - Returns pass status for UI gating.
- `POST /api/assets/keys`
  - Input: pass token/id, serial/model, requested encrypted asset paths.
  - Behavior: authorizes only paid/valid/consumed-or-ready same serial/model sessions and returns keys for requested encrypted paths.
- `/api/admin/*`
  - Simple internal token/password protection, order list, detail, manual paid, issue pass, revoke pass, audit list.

## Frontend Direction

Keep the existing workflow order:

1. Preflight.
2. ADB/Fastboot compatibility verification.
3. Payment gate once a compatible verified serial/model is known.
4. `prepare-assets` may run without consuming a pass, but encrypted key retrieval must still require paid/pass authorization before decrypting paid encrypted assets.
5. First dangerous phase consumes pass atomically before calling the runner method.
6. Subsequent retries use backend retry window for same serial/model.

The hook should expose payment status, pass status, order creation/polling actions, and clear UI states. The runner should receive a pass/key authorization dependency rather than embedding payment HTTP calls deep in device operations.

## Asset Key Direction

Replace public `keys.json` access for paid encrypted assets with a backend key client:

- The asset builder may still generate a local keys file for operator use, but paid release docs must instruct operators not to upload it publicly.
- `.gitignore` must exclude local live key files and payment DB files.
- `CryptoAssetClient` should obtain keys through `/api/assets/keys` after payment/pass authorization.
- Tests must prove encrypted paid assets cannot decrypt when backend key authorization is unavailable.

## Admin Direction

Use a minimal operational dashboard for v1:

- Server-rendered admin HTML under `/api/admin` is the simplest path because it avoids expanding the static React app with admin routing/auth state.
- Admin APIs can share the same server modules and require a configured admin token/password.
- Audit events must record provider webhook, manual paid, pass issue, pass consume, pass revoke, key authorization success/failure, and order expiry/manual recovery actions.

## Rejected Alternatives

1. Frontend-only payment/pass state.
   - Rejected because it cannot protect asset keys or enforce pass consumption.
2. Public `keys.json` plus payment UI only.
   - Rejected because it preserves the current key exposure and contradicts D11/D16.
3. Full account system.
   - Rejected because v1 explicitly excludes accounts and purchase history.
4. Live-only payOS integration.
   - Rejected because final local proof must work without production credentials.
5. Reordering unlock phases to make payment easier.
   - Rejected because D10 fixes the existing workflow order.

## Risk Map

| Component | Risk | Reason | Proof Needed |
| --- | --- | --- | --- |
| payOS signatures/webhooks | HIGH | External provider data marks orders paid. | Unit tests with official-style HMAC fixtures, invalid signatures rejected, idempotent webhook behavior. |
| SQLite payment/pass state | HIGH | Incorrect transitions can double-use or lose passes. | Unit/integration tests for pending expiry, paid issue, unused expiry, consume, retry, revoke, audit. |
| Atomic pass consumption | HIGH | Dangerous phase must not start unless consume succeeds once. | Runner/hook tests proving consume occurs before first dangerous runner call and never during prepare-assets. |
| Asset key authorization | HIGH | Public keys would bypass payment. | Tests proving no backend authorization means no decrypt keys; docs prove `keys.json` is not public in paid release. |
| Fastboot serial binding | MEDIUM | ADB serial is not exposed; Fastboot serial must be reliable before payment. | Tests/flow check that payment gate requires verified `fastbootSerial`; missing serial blocks paid order. |
| Admin dashboard | MEDIUM | Manual operations can alter payment/pass state. | Admin API/UI tests for list, detail, mark paid, issue/revoke, audit, admin auth rejection. |
| Static frontend compatibility | MEDIUM | Backend calls must not break static hosting. | Build proof and local same-origin/proxy proof. |
| Deployment docs | MEDIUM | Production requires service/proxy/backup setup. | `docs/PAYMENTS.md`, `docs/DEPLOY.md`, and local backend startup proof. |

## Likely File Boundaries

Backend:

- `server/package` or root package scripts for backend commands.
- `server/src/app.ts`, `server/src/index.ts`, `server/src/config.ts`
- `server/src/db/*`
- `server/src/payments/*`
- `server/src/passes/*`
- `server/src/assets/*`
- `server/src/admin/*`
- `server/test/*`

Frontend:

- `src/services/paymentApi.ts`
- `src/services/cryptoAssetClient.ts`
- `src/hooks/useUnlockWorkflow.ts`
- `src/workflow/runner.ts`
- `src/workflow/types.ts`
- `src/App.tsx`
- focused tests near existing `src/*/*.test.ts`

Assets/docs/config:

- `scripts/build-assets.ts`
- `.env.example`
- `.gitignore`
- `docs/PAYMENTS.md`
- `docs/DEPLOY.md`
- `docs/ASSETS_R2.md`
- new decision record after work shape approval

## Validating Questions

Validation must answer these before execution:

1. Can the backend start locally, create/migrate SQLite, and run payment/pass/key tests without live payOS credentials?
2. Can the current workflow reliably require verified Fastboot serial/model before creating an order?
3. Can `CryptoAssetClient` be changed so encrypted paid asset decryption cannot proceed through public `keys.json`?
4. Can `prepare-assets` remain non-consuming while still requiring paid key authorization for encrypted assets?
5. Can the first dangerous runner call be wrapped so pass consumption is atomic and precedes device commands?
6. Can admin operations stay within simple internal token/password auth?

## Approval Gate

Planning has chosen the smallest work shape: a high-risk epic map with backend payment/pass/key spine as the current story to validate first. Approve `history/payos-payments/epic-map.md` before current story prep, feasibility validation, beads, or implementation.
