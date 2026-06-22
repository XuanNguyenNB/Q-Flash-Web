# QFW-REDESIGN-001 Exec Plan

## Goal

Redesign Q Flash Web into a polished Vietnamese product website plus unlock workspace, verify it locally on desktop/mobile, and deploy to production after checks pass.

## Scope

In scope:

- Product introduction, purpose, supported flow, preparation/risk guidance, and workspace entry.
- Unlock workspace layout polish while preserving existing hook-driven behavior.
- UI tests, build proof, local browser screenshots, and production smoke.
- Product/Harness/Khuym trace artifacts for this redesign.

Out of scope:

- Payment/backend contract changes.
- Asset release or model metadata changes.
- Core runner phase/order changes unless a verified bug is found.

## Risk Classification

Risk flags:

- Public contracts.
- Cross-platform.
- Existing behavior.
- Weak proof.
- Multi-domain.

Hard gates:

- Existing safety behavior must not be weakened.
- Deployment must not proceed until local checks pass.

## Work Phases

1. Capture context and validation plan.
2. Redesign product sections and workspace layout.
3. Update focused UI tests.
4. Run local checks and browser screenshots.
5. Deploy static build.
6. Run production smoke and record trace.

## Stop Conditions

Pause for human confirmation if:

- Required deploy credential or SSH access is unavailable after reasonable local discovery.
- A secret is needed and cannot be sourced safely outside git.
- Verification repeatedly fails in a way that would require changing unlock, payment, backend, or asset contracts.
- Production smoke fails and rollback/repair cannot be completed safely.
