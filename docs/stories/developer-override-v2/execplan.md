# S1 Backend Override Authority - Exec Plan

## Goal

Produce the backend authority spine for Developer Override V2 before any runner gate, terminal, or frontend override capability is expanded.

## Scope

In scope:

- Backend config for `DEVELOPER_OVERRIDE_MASTER_KEY`.
- In-memory 15-minute override session store.
- Login/status/logout/audit API routes under `/api/developer-override`.
- Secure/HttpOnly/SameSite override cookie.
- Override audit action typing and sanitized audit metadata.
- Focused backend tests and normal payment/asset-key regression proof.

Out of scope:

- React panel changes.
- Workflow runner bypass policy.
- Resume, Selective Bypass, and Full Override behavior.
- EDL commands or terminal support.
- Deployment or real-device execution.

## Risk Classification

Risk flags:

- Auth.
- Authorization.
- Audit/security.
- Public API contract.
- Existing behavior.
- Weak proof until focused tests exist.

Hard gates:

- Auth.
- Authorization.
- Audit/security.

Lane: high-risk.

## Work Phases

1. Validate existing backend routes, config, audit table, and tests.
2. Add config and backend-only session helpers.
3. Add login/status/logout/audit route handlers with strict parsing.
4. Extend audit action typing and sanitized metadata handling.
5. Add focused backend tests.
6. Run focused server tests and update story validation evidence.
7. Return to Khuym planning/validating for S2 before touching workflow gates.

## Stop Conditions

Pause for human confirmation if:

- A reusable secret must be put in frontend code, build output, URLs, logs, or the repo.
- Secure/HttpOnly/SameSite cookies cannot be maintained.
- Existing payment/pass/asset-key behavior would need to weaken.
- Any new protocol-level destructive operation or EDL command surface becomes necessary.
- Production deploy or real-device execution is requested.
