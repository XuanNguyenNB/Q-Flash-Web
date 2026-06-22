# S1 Backend Donation Authority - Design

## Domain Model

Donation:

- `id`: internal UUID.
- `orderCode`: integer merchant order code unique across payment-bearing records.
- `status`: `pending`, `paid`, `expired`, `cancelled`, or `failed`.
- `amount`: integer VND, `10000..5000000`.
- `currency`: `VND`.
- `checkoutUrl`: payOS fallback checkout URL.
- `qrCode`: payOS VietQR payload string.
- `provider`: `mock` or `payos`.
- `providerPaymentLinkId`: payOS payment link id when available.
- `createdAt`, `expiresAt`, `paidAt`, `updatedAt`.

Donation has no serial, model, product, pass token, asset key, donor name, message, email, or phone field in v1.

## Application Flow

Create donation:

1. Parse and validate amount.
2. Generate unique `orderCode`.
3. Create provider payment link with donation item name and configured return/cancel URLs.
4. Store donation as pending with QR and provider identifiers.
5. Return anonymous donation DTO.

Poll donation:

1. Look up donation by id.
2. Expire pending donation if TTL has passed.
3. Return donation DTO without pass fields.

Webhook:

1. Parse payOS webhook body.
2. Verify signature.
3. Ignore non-success events after recording safe state when needed.
4. Resolve `orderCode` against donation records before or alongside unlock orders.
5. Validate amount, currency, payment link id, and donation status.
6. Mark donation paid idempotently without pass issue.

## Interface Contract

Donation routes:

- `POST /api/donations`
  - request: `{ "amount": number }`
  - response: `{ "donation": DonationDto }`
  - invalid amounts return `400 VALIDATION_FAILED` or a donation-specific amount error.
- `GET /api/donations/:id`
  - response: `{ "donation": DonationDto }`

Existing routes stay compatible:

- `POST /api/payments/orders`
- `GET /api/payments/orders/:id`
- `POST /api/payments/webhook/payos`
- `POST /api/assets/keys`
- pass routes

Webhook response may include a donation payload for donation webhooks, but must not include `pass`.

## Data Model

Preferred: add a separate `donations` table:

- `id TEXT PRIMARY KEY`
- `order_code INTEGER NOT NULL UNIQUE`
- `status TEXT NOT NULL`
- `amount INTEGER NOT NULL`
- `currency TEXT NOT NULL`
- `checkout_url TEXT NOT NULL`
- `qr_code TEXT NOT NULL`
- `provider TEXT NOT NULL`
- `provider_payment_link_id TEXT`
- `created_at TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `paid_at TEXT`
- `updated_at TEXT NOT NULL`

Indexes:

- `idx_donations_status_expires(status, expires_at)`
- `idx_donations_order_code(order_code)`

Audit events may reuse the existing table with donation metadata in `metadata_json`, or add nullable donation id only if needed. Do not overload pass ids for donations.

## UI / Platform Impact

No UI change in S1 except optional TypeScript DTO support if needed for shared API typing. Frontend donation section belongs to S3.

## Observability

Audit actions should distinguish donations from unlock orders, for example:

- `donation.created`
- `donation.expired`
- `donation.paid`
- `donation.webhook.replayed`
- `donation.webhook.rejected`

Operational logs should not include secrets or donor identity.

## Alternatives Considered

1. Reuse unlock `orders` and add fake device fields. Rejected because it hides donation intent and risks pass issuance.
2. Add `orders.kind` to the existing table. Viable only if implementation also gates every pass issuance/admin/key path by kind; higher migration risk than a separate table for S1.
3. Frontend-only donation. Rejected because amount validation, payOS link creation, and webhook verification belong to backend.
