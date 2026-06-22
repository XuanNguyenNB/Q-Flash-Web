# Developer Override Backend Authority

Date: 2026-06-22

## Status

Accepted

## Context

Developer Override V2 unlocks dangerous workflow controls for operators with a master key. The existing override path is frontend/env-flag based, legacy-only, and unaudited. The requested feature requires backend-only master-key verification, a 15-minute Secure/HttpOnly/SameSite session, logout/expiry handling, and sanitized audit events without changing normal user payment or safety behavior.

## Decision

Developer Override authority belongs to the backend. The backend reads `DEVELOPER_OVERRIDE_MASTER_KEY`, verifies login requests, creates opaque in-memory sessions, sends the session id only in an HttpOnly/Secure/SameSite cookie, and stores sanitized override audit records in the existing `audit_events` table.

The frontend may display login/status UI later, but it cannot self-authorize override behavior and cannot receive a reusable verifier, hash, master key, or long-lived bearer token. The existing admin query-token pattern is not used for Developer Override.

## Alternatives Considered

1. Keep `VITE_ALLOW_TARGET_OVERRIDE`: rejected because frontend bundle authority violates the backend-only master-key requirement.
2. Reuse the admin token and query-cookie route: rejected because query tokens can leak through URLs/history/logs and admin is a different trust boundary.
3. Store override sessions in SQLite: deferred because an in-memory 15-minute session is sufficient and server restart invalidation is acceptable for this operator-only feature.

## Consequences

Positive:

- Later Resume, Selective Bypass, and Full Override controls can depend on a backend-confirmed unexpired session.
- Session expiry and logout can be proven before workflow gates are touched.
- Audit rows can be tested for required event coverage and secret exclusion.

Tradeoffs:

- Local browser testing over plain HTTP cannot rely on a Secure cookie round-trip. Later UI checks must use mocks or HTTPS dev setup rather than weakening cookie attributes.
- Server restart invalidates active override sessions.

## Follow-Up

- Implement and validate S1 backend session/audit spine.
- In later stories, wire frontend and runner behavior only through the backend session status.
