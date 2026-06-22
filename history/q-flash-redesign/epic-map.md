# Epic Map: Q Flash Web Redesign

Mode: `high_risk_feature`

## Feature Outcome

Q Flash Web production presents as a polished Vietnamese product website with an immediately understandable unlock service explanation and a usable unlock workspace. The core WebUSB unlock behavior, payment/pass gates, model support, safety gates, and R2 asset release path remain intact.

## Architecture / Reality Basis

- The app is a static Vite/React surface with no router.
- `src/App.tsx` already composes the full UI and can host product sections plus workspace.
- Workflow behavior is encapsulated in `useUnlockWorkflow` and `UnlockWorkflowRunner`.
- Deployment is a static `dist/` upload to `https://unlock.choimaytau.com` with R2 assets loaded from release `20260617-001`.

## Epics

| Epic | Capability/Risk Area | Why It Exists | Stories | Proof Needed |
| --- | --- | --- | --- | --- |
| E1 Product framing | First-time comprehension | Users need purpose, flow, prep, risks, and workspace entry before the console | QFW-REDESIGN-001 | App tests, screenshots |
| E2 Workspace preservation | Safety-critical controls | Visual changes must not remove gates or action bindings | QFW-REDESIGN-001 | App tests, diff review |
| E3 Release proof | Deploy confidence | Production must load redesigned site with correct asset base | QFW-REDESIGN-001 | Build, local/prod smoke |

## Story Queue

| Story | Epic | Outcome | Depends On | Feasibility Status |
| --- | --- | --- | --- | --- |
| QFW-REDESIGN-001 | E1/E2/E3 | Product website plus unlock workspace redesigned, verified, and deployed | Existing React app and deploy access | Ready with constraints |

## Current Story To Prepare

Current story: `QFW-REDESIGN-001`.

Why now: it covers the entire user request as one vertical slice without changing backend or runner behavior.
