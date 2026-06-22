# S1 Backend Donation Authority - Exec Plan

## Goal

Create the backend contract for independent anonymous payOS donations, with strict proof that paid donations cannot grant unlock entitlements.

## Scope

In scope:

- Donation amount validation on the backend.
- Donation persistence in SQLite.
- Mock/payOS payment-link creation that exposes QR data.
- Donation create and poll API routes.
- payOS webhook handling for donation paid state.
- Tests proving donation paid state is idempotent and has no pass/key side effects.
- Preservation of existing unlock order/pass/key behavior.

Out of scope:

- React donation section and QR rendering.
- Mobile/desktop browser QA.
- Production deploy and smoke.
- Public donor list or donor identity collection.

## Risk Classification

Risk flags:

- Data model.
- External systems.
- Public contracts.
- Existing behavior.
- Audit/security.
- Weak proof.
- Multi-domain.

Hard gates:

- External provider behavior.
- Authorization boundary for unlock pass and asset-key access.
- Audit/security.

## Work Shape

High-risk current story under the `payos-donations` epic map.

Execution should stay inside the backend donation authority surface and avoid frontend UI until the data model, provider fields, webhook dispatch, and no-entitlement invariant pass focused tests.

## Stop Conditions

Pause for human confirmation if:

- The implementation would require weakening pass or asset-key authorization.
- The implementation would require collecting donor identity in v1.
- The implementation cannot distinguish donation and unlock paid states without large migration risk.
- payOS docs or API behavior contradict the expected QR/signature fields.
- Validation requires production credentials before local mock proof is complete.
