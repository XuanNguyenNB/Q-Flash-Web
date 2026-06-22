# payOS Donations - Discovery

Date: 2026-06-18

## Architecture Snapshot

- Frontend is a static Vite/React app. It already calls same-origin `/api` for paid unlock orders, pass polling, pass consume, and asset-key authorization through `src/services/paymentApi.ts`.
- Main UI is in `src/App.tsx`. The current product hero, top nav, support strip, control panel, compatibility panel, unlock payment panel, progress, and terminal all live in one route.
- Unlock workflow state is owned by `src/hooks/useUnlockWorkflow.ts`. It computes `paymentReady` only from unlock pass state and gates destructive workflow phases on unlock pass readiness.
- Backend is Express under `server/`. `server/src/routes.ts` owns JSON API routes, payOS webhook handling, and simple token-gated admin HTML/JSON.
- Persistence is `node:sqlite` in `server/src/db/store.ts`. The current `orders` table is unlock-specific: it requires `model_id`, `model_name`, `product`, and `serial`.
- Current paid unlock happy path is tightly coupled: `markOrderPaidByCode()` marks an order paid and then calls private `issuePass()`. Replayed paid unlock webhooks are idempotent by returning the existing pass or issuing one if missing.
- Current provider abstraction `server/src/payments/provider.ts` creates payment links for unlock with item name `Q Flash Web unlock pass` and returns `checkoutUrl`, optional `paymentLinkId`, and raw provider data. It does not expose `qrCode`.
- Current payOS webhook route validates HMAC signature, success code, order code, amount, currency, and payment link id, then calls `markOrderPaidByCode()`.
- Admin currently lists all unlock orders, shows unlock order details plus pass, can mark paid, issue pass, revoke pass, confirm webhook, and list audit events.
- Deployment currently requires same-origin `/api` readiness for payment releases. `docs/DEPLOY.md`, `docs/PAYMENTS.md`, and `history/learnings/critical-patterns.md` record the production blocker where `/api/health` returned static SPA HTML because the backend service/proxy was missing.

## Current Contracts To Preserve

- Paid unlock pass remains tied to serial/model and is the only way to authorize encrypted asset keys.
- `prepare-assets` does not consume pass; first dangerous phase consumes pass.
- Donation must not alter `paymentReady`, pass consume, pass issue, asset key authorization, destructive phase ordering, model support, or WebUSB flows.
- Admin auth remains the existing internal token/cookie boundary; no accounts or roles are introduced for donation v1.
- Secrets remain outside git: payOS credentials, admin token, SQLite DB, live asset keys, R2 credentials.

## Official payOS Check

Checked official payOS docs on 2026-06-18:

- `POST /v2/payment-requests` requires integer `orderCode`, integer `amount`, `description`, `cancelUrl`, `returnUrl`, and `signature`.
- The create-link response includes `checkoutUrl`, `paymentLinkId`, `status`, `amount`, `currency`, and `qrCode`.
- Webhook body includes `code`, `desc`, `success`, `data`, and `signature`; sample `data` includes `orderCode`, `amount`, `currency`, and `paymentLinkId`.
- Signature verification uses HMAC-SHA256 over sorted fields.
- `confirm-webhook` registers or updates the webhook URL and requires merchant credentials.
- payOS checkout flow still expects merchant backend webhook as the durable paid-state update; return URL is user-facing feedback, not authoritative payment proof.

Sources:

- `https://payos.vn/docs/api/`
- `https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/`
- `https://payos.vn/docs/sdks/back-end/node/`
- `https://payos.vn/docs/checkout/how-checkout-works/`

## Tooling And Capability Reality

- `gkg` is not available on PATH. Command attempted: `gkg index C:\Users\XuanNguyen\Documents\Q-Flash-Web`; it failed with `CommandNotFoundException`.
- Harness CLI query commands often exit 0 without stdout in this workspace; one documentation-lookup query timed out. Planning uses targeted file reads and records this degraded discovery path.
- Tests use Vitest. `package.json` has `npm test`, `npm run server:test`, and `npm run build`; on Windows previous payment work noted `npm.cmd` should be used instead of PowerShell `npm.ps1`.

## Missing Capability

- No donation API, donation store, donation frontend client, QR renderer, donation UI, or donation admin exists yet.
- No current `qrCode` field exists in frontend or backend payment types.
- No order-kind discriminator exists in the current store. Without a new donation-specific write path, any paid order processed through `markOrderPaidByCode()` will issue an unlock pass.
- No current test proves "paid donation does not issue pass or asset key".
- No production backend/proxy/secrets are currently proven available; deploy remains gated by public `/api/health` backend JSON and safe external configuration.

## Planning Implications

- The first implementation story should establish donation backend authority before UI work depends on it.
- Prefer a separate donation persistence path over trying to squeeze donations through the current unlock `orders` table. The current table shape and pass issuance coupling make shared paid-state mutation risky.
- The provider abstraction should become product/item-name agnostic and return `qrCode`, but unlock order behavior must be covered by existing and expanded tests.
- Webhook dispatch must determine whether an `orderCode` belongs to a donation or unlock order before mutating state.
- UI should call donation APIs separate from `createPaymentOrder()` / `getPaymentOrder()` so donation cannot influence unlock workflow state.
