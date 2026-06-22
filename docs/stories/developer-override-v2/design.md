# S1 Backend Override Authority - Design

## Domain Model

Developer Override authority has three backend-only concepts:

- Master key: fixed value read from `DEVELOPER_OVERRIDE_MASTER_KEY`.
- Override session: opaque random session id stored only in a server-side in-memory map with `createdAt` and `expiresAt`.
- Override audit event: sanitized record in the existing `audit_events` table.

The browser never receives the master key, a reusable verifier, or the raw session id in JSON. The session id appears only inside the HttpOnly cookie.

## Application Flow

Login:

1. Parse `{ masterKey }` at the HTTP boundary.
2. If `DEVELOPER_OVERRIDE_MASTER_KEY` is missing, reject and audit a disabled login attempt.
3. Compare the submitted key to the environment key in backend code.
4. On success, create an opaque session id, store it with a 15-minute expiry, set the cookie, and audit a success event without the key or session id.

Status:

1. Read the override cookie.
2. Require a known unexpired session.
3. Return `expiresAt` and `remainingMs`; otherwise return locked/unauthorized.

Logout:

1. Read and delete the current session if present.
2. Clear the override cookie.
3. Audit logout only when a valid session existed.

Audit:

1. Require a valid unexpired session.
2. Parse a strict event envelope.
3. Store only allowed event fields and sanitized metadata.

## Interface Contract

Routes:

- `POST /api/developer-override/login`
- `GET /api/developer-override/status`
- `POST /api/developer-override/logout`
- `POST /api/developer-override/audit`

Cookie:

- Name: proposed `qflash_dev_override`
- Attributes: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/developer-override`, `Max-Age=900`

Errors:

- `DEVELOPER_OVERRIDE_NOT_CONFIGURED`
- `DEVELOPER_OVERRIDE_FORBIDDEN`
- `DEVELOPER_OVERRIDE_SESSION_REQUIRED`
- `DEVELOPER_OVERRIDE_AUDIT_INVALID`

## Data Model

No new database table is required in S1. The existing `audit_events` table can store override action rows by extending the `AuditAction` union and using sanitized JSON metadata.

Proposed actions:

- `developer_override.login.accepted`
- `developer_override.login.rejected`
- `developer_override.logout`
- `developer_override.event`

## UI / Platform Impact

No UI source changes are in S1. Later frontend work will call these endpoints and keep the panel locked until status succeeds.

Secure cookies are required. Local HTTP browser testing may need mock API state or HTTPS development setup in later UI stories; S1 must not downgrade cookie security.

## Observability

Audit events are product records. They must include event type, mode/model/phase/gate/command result where applicable in later stories, timestamps from `audit_events.created_at`, and no secret material.

No application logs should print the submitted master key or cookie value.

## Alternatives Considered

1. Frontend env flag authorization: rejected because it puts authority in the bundle.
2. Existing admin query token: rejected because URL/query-token auth is a different trust boundary and can leak through history/logs.
3. SQLite-backed sessions: deferred because a 15-minute developer override can use in-memory sessions, and server restart invalidation is acceptable.
