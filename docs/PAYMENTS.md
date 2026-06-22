# Payments v1

This document is the running implementation log for the payOS v1 paid unlock flow. It starts as notes during Khuym planning and must become the final operator guide before release.

## Progress Log

- 2026-06-18: Goal accepted for payOS v1 integration: 10,000 VND per unlock pass, free compatibility check, pass tied to serial/model, Node/Express + SQLite backend under `server/`, backend-authorized asset keys, and admin operations.
- 2026-06-18: Khuym scout completed. Onboarding is current, no handoff exists, and no prior active Khuym feature was in progress.
- 2026-06-18: `gkg` CLI is not available on PATH, so architecture discovery is degraded to Harness docs plus targeted repo reads.
- 2026-06-18: Harness intake classified this as high-risk because it touches payments, authorization, SQLite data, audit/security, external provider behavior, API contracts, and multiple product surfaces.
- 2026-06-18: Official payOS docs checked for create payment link, webhook signature verification, Node SDK usage, and confirm-webhook behavior. No doc conflict found; live webhook confirmation still requires real credentials and is a pause condition.
- 2026-06-18: Current key exposure identified: `src/services/cryptoAssetClient.ts` loads public `keys.json`; paid implementation must move encrypted asset keys behind backend authorization.
- 2026-06-18: Planning mode selected as `high_risk_feature`; artifacts written under `history/payos-payments/` with backend payment/pass/key spine as the first story to validate.
- 2026-06-18: Validation passed with constraints for backend payment/pass/key spine. Node supports `node:sqlite`; use `npm.cmd` on Windows because PowerShell blocks `npm.ps1`.
- 2026-06-18: Implemented Express/SQLite payment backend, mock/payOS provider adapter, webhook verification, confirm-webhook admin trigger, pass issue/consume/retry/revoke, backend asset-key authorization, React payment/pass gate, and admin dashboard/API operations.
- 2026-06-18: Proof loop passed locally: `npm.cmd test -- server` (9 tests), `npm.cmd test` (14 files, 85 tests), `npm.cmd run build`, and compiled-backend HTTP smoke for health, mock order, admin dashboard/list/detail, confirm-webhook, manual paid, authorized asset key fetch, pass consume, and audit events.
- 2026-06-18: Production audit found release `20260617-001` had public `keys.json`; removed `keys.json` and `keys.json.sig` from R2, moved local key material to ignored `server/data/payment-asset-keys.local.json`, and added sync/verify guards so public key files block release.
- 2026-06-18: Production audit blocker remains: `https://unlock.choimaytau.com/api/health` returns the static app HTML, so Nginx `/api` proxy and the `qflash-payments` systemd service are not live yet. Do not public-launch paid flow until `/api/health` returns backend JSON.

## Current Planning State

- Khuym source of truth: `history/payos-payments/CONTEXT.md`
- Current Khuym phase: implementation and local validation complete for v1 mock/payOS payment wiring.
- Operator sections below cover env vars, local test flow, payOS webhook setup, Nginx `/api` proxy, systemd service, SQLite backup, manual recovery steps, and admin dashboard operations.

## Environment Variables

Keep real values in `.env.local`, systemd environment files, or VPS secrets. Do not commit live payOS credentials, admin tokens, SQLite files, or live asset key files.

```dotenv
PAYMENTS_PORT=8787
PAYMENTS_DATABASE_PATH=server/data/payments.db
PAYMENTS_PUBLIC_BASE_URL=https://unlock.choimaytau.com
PAYMENTS_PROVIDER=mock
# Production blocks mock provider unless PAYMENTS_ALLOW_MOCK_IN_PRODUCTION=true.
PAYMENTS_ADMIN_TOKEN=replace-with-secret
PAYMENTS_ASSET_KEYS_PATH=server/data/payment-asset-keys.local.json

PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PAYOS_RETURN_URL=
PAYOS_CANCEL_URL=
PAYOS_WEBHOOK_URL=
```

`PAYMENTS_PROVIDER=mock` is for local development and deterministic tests. Use `PAYMENTS_PROVIDER=payos` only when `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, and `PAYOS_CHECKSUM_KEY` are configured outside git.

## Local Test Flow

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. Start the backend in mock mode:

   ```powershell
   $env:PAYMENTS_PROVIDER="mock"
   $env:PAYMENTS_DATABASE_PATH="server/data/payments.db"
   $env:PAYMENTS_ADMIN_TOKEN="local-admin-token"
   $env:PAYMENTS_ASSET_KEYS_PATH="server/data/payment-asset-keys.local.json"
   npm.cmd run server:dev
   ```

3. In another shell, start the frontend:

   ```powershell
   npm.cmd run dev
   ```

   Vite proxies `/api` to `http://127.0.0.1:8787`, so the static app can call the backend through same-origin paths during development.

4. Verify backend health:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8787/api/health
   ```

5. For local mock payment support, create a test order from the app after Fastboot serial/model verification. In mock mode the checkout URL is local and admin can mark the order paid manually:

   ```powershell
   Invoke-RestMethod -Method Post `
     -Headers @{ "x-admin-token"="local-admin-token" } `
     -Uri http://127.0.0.1:8787/api/admin/orders/<order-id>/mark-paid
   ```

6. Run proof commands:

   ```powershell
   npm.cmd test -- server
   npm.cmd test
   npm.cmd run build
   ```

## Asset Key Handling

Encrypted paid assets remain in the public asset release as `.enc` files. Decryption keys are backend-only.

`npm.cmd run build:assets` writes encrypted firmware keys to:

```text
PAYMENTS_ASSET_KEYS_PATH
```

If `PAYMENTS_ASSET_KEYS_PATH` is not set, the default is:

```text
server/data/payment-asset-keys.local.json
```

Do not upload a live `keys.json` to R2 for paid encrypted unlock assets. Do not commit the backend key file. The frontend `CryptoAssetClient` asks `/api/assets/keys` for only the paths needed and the backend authorizes that request against the paid pass and serial/model.

## payOS Webhook Setup

Production payOS setup requires real credentials outside this repo.

1. Set:

   ```dotenv
   PAYMENTS_PROVIDER=payos
   PAYOS_CLIENT_ID=<from payOS>
   PAYOS_API_KEY=<from payOS>
   PAYOS_CHECKSUM_KEY=<from payOS>
   PAYOS_RETURN_URL=https://unlock.choimaytau.com/payment/return
   PAYOS_CANCEL_URL=https://unlock.choimaytau.com/payment/cancel
   PAYOS_WEBHOOK_URL=https://unlock.choimaytau.com/api/payments/webhook/payos
   ```

2. Confirm/register the webhook URL in payOS dashboard or with payOS `confirm-webhook` behavior.

3. The backend verifies webhook signatures with `PAYOS_CHECKSUM_KEY`. Invalid signatures are rejected and do not mark orders paid.

4. payOS `confirm-webhook` sends a signed sample webhook to verify the URL. A signed sample that does not match a local order is acknowledged as `ignored` with no pass, donation, asset-key, or workflow side effect. Matching real orders and donations still require amount/currency/payment-link validation before any status change.

5. Live webhook confirmation is a credentialed production operation and should not be attempted from committed code or docs examples with real secrets.

## Donation QR Flow

The website includes an anonymous "Ủng hộ dự án" section that calls same-origin donation routes:

- `POST /api/donations` with `{ "amount": <integer VND> }`
- `GET /api/donations/:id` while the QR is pending

The frontend allows manual integer VND entry from `10000` to `5000000` and suggested buttons for `20000`, `50000`, `100000`, and `200000`. The payOS `qrCode` payload is rendered locally in the browser as an SVG data URL; no QR payload is sent to an external QR image service. `checkoutUrl` remains visible as the fallback link.

A paid donation stays separate from unlock payment authority. It never creates an unlock pass, changes `paymentReady`, consumes a pass, or authorizes asset keys.

## Production Provisioning Helper

Use `scripts/provision-payments-vps.ps1` after a private production env file exists. The helper does not generate or print secrets; it reads real values from a local file that must stay outside git.

Minimum private env file:

```dotenv
PAYMENTS_ADMIN_TOKEN=<strong-admin-token>
PAYOS_CLIENT_ID=<from-payos>
PAYOS_API_KEY=<from-payos>
PAYOS_CHECKSUM_KEY=<from-payos>
```

The helper forces production-safe remote paths and URLs before uploading:

```text
PAYMENTS_PROVIDER=payos
PAYMENTS_DATABASE_PATH=/var/lib/qflash-payments/payments.db
PAYMENTS_ASSET_KEYS_PATH=/var/lib/qflash-payments/payment-asset-keys.local.json
PAYMENTS_PUBLIC_BASE_URL=https://unlock.choimaytau.com
PAYOS_RETURN_URL=https://unlock.choimaytau.com/payment/return
PAYOS_CANCEL_URL=https://unlock.choimaytau.com/payment/cancel
PAYOS_WEBHOOK_URL=https://unlock.choimaytau.com/api/payments/webhook/payos
```

Dry readiness check:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\provision-payments-vps.ps1 -EnvPath .\.env.production.local -CheckOnly
```

Provision service/env/proxy:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\provision-payments-vps.ps1 -EnvPath .\.env.production.local
```

After provisioning, run normal deploy without `-AllowStaticOnly`:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

Do not set `PAYMENTS_ALLOW_MOCK_IN_PRODUCTION` for public production.

## Nginx Same-Origin `/api` Proxy

Production keeps the frontend static and proxies backend calls at the same origin:

```nginx
server {
    server_name unlock.choimaytau.com;

    root /var/www/unlock.choimaytau.com/app/current;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8787/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Run `sudo nginx -t` before reload.

## systemd Service

Example service:

```ini
[Unit]
Description=Q Flash Web payments API
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/unlock.choimaytau.com/app/current
Environment=NODE_ENV=production
EnvironmentFile=/etc/qflash-payments.env
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
RestartSec=3
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Deploy flow after build:

```powershell
npm.cmd test
npm.cmd run build
```

Upload `dist/`, `server/dist/`, `package.json`, `package-lock.json`, and production `node_modules` or run `npm ci --omit=dev` on the VPS release. Keep `/etc/qflash-payments.env` outside the release directory.

## SQLite Backup

SQLite files are local operational state. Recommended production path:

```text
/var/lib/qflash-payments/payments.db
```

Backup with SQLite online backup or a stopped-service file copy:

```bash
sudo systemctl stop qflash-payments
sudo install -d -m 750 /var/backups/qflash-payments
sudo cp /var/lib/qflash-payments/payments.db /var/backups/qflash-payments/payments-$(date +%Y%m%d-%H%M%S).db
sudo systemctl start qflash-payments
```

If WAL mode is enabled later, include `payments.db-wal` and `payments.db-shm` or use the SQLite `.backup` command.

## Manual Recovery

- Pending order not updated by webhook: verify payOS transaction in dashboard, then use admin `mark-paid` for the exact order.
- Paid order missing pass: use admin `issue-pass` on the paid order. The operation is idempotent and returns the existing pass when present.
- Wrong customer/device: revoke the pass from admin. A revoked pass cannot authorize keys or consume.
- Browser interrupted after consume: retry is allowed only for the same serial/model for 24 hours.
- Asset decrypt fails after payment: check `PAYMENTS_ASSET_KEYS_PATH`, ensure the key file matches the encrypted asset release, and do not upload public `keys.json`.

## Admin Dashboard

Use the internal admin token only on trusted machines. Opening the HTML admin
URL with `token=` sets an HttpOnly admin cookie for navigation; scripts should
prefer the `x-admin-token` header and avoid putting tokens in shell history when
possible.

```text
https://unlock.choimaytau.com/api/admin?token=<PAYMENTS_ADMIN_TOKEN>
```

JSON endpoints also accept:

```text
x-admin-token: <PAYMENTS_ADMIN_TOKEN>
```

Supported v1 operations:

- list orders
- view order details
- mark paid manually
- issue pass
- revoke pass
- view audit events
