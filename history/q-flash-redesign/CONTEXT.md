# Q Flash Web Redesign - Context

**Feature slug:** q-flash-redesign
**Date:** 2026-06-18
**Exploring session:** complete
**Scope:** Deep
**Domain types:** SEE | RUN | READ | ORGANIZE

## Feature Boundary

Deliver a polished Vietnamese product website experience for Q Flash Web with a clear introduction, supported flow, preparation/risk guidance, and the existing unlock workspace, then verify and deploy the static web app when checks pass.

## Locked Decisions

These are fixed. Planning must implement them exactly.

- **D1:** Keep the existing WebUSB unlock workflow behavior, phase order, payment/pass gates, asset key authorization, model support, and safety gates intact unless a verified bug forces a focused fix.
- **D2:** Do not change the production asset release path. Production build must keep `VITE_ASSET_BASE_URL=https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001`.
- **D3:** The redesigned app must be more than a console screen: first-time users must see what Q Flash Web does, which flow is supported, what to prepare, what can go wrong, and how to enter the workspace.
- **D4:** UI copy and user-facing errors must use Vietnamese with accents where practical. Technical terminal logs may remain ASCII.
- **D5:** The unlock workspace must remain the primary working surface after the product introduction and must keep existing controls for ADB/Fastboot/EDL mode, preflight, confirmations, payment, compatibility, progress, and terminal log.
- **D6:** Desktop and mobile layouts must be visually inspected before deployment; obvious overlap, clipped text, unusable controls, or console/runtime errors block deploy.
- **D7:** Deployment is allowed only after local `npm test`, `npm run build`, local browser smoke, and desktop/mobile screenshots pass.
- **D8:** Production proof must verify `https://unlock.choimaytau.com` loads the redesigned site, primary navigation/workspace entry works, and the configured asset base behavior is not broken.

### Agent's Discretion

The agent may choose copy, visual hierarchy, section order, responsive layout, and focused component/test organization if the locked decisions are preserved. The agent may add documentation and Harness/Khuym trace artifacts for this redesign.

## Existing Code Context

### Reusable Assets

- `src/App.tsx` - Current single-route React UI, product hero, workflow rail, control panel, payment panel, compatibility panel, and terminal log.
- `src/style.css` - Tailwind v4 import plus global surface tokens and background treatment.
- `src/hooks/useUnlockWorkflow.ts` - Runtime state and gating contract used by UI; should remain behaviorally intact.
- `src/workflow/runner.ts` - ADB/Fastboot/EDL orchestration and safety checks; not a redesign target.
- `src/domain/models.ts` - Supported model list and family metadata used to present supported flows.
- `docs/DEPLOY.md` and `docs/ASSETS_R2.md` - Production deploy and R2 asset base source of truth.

### Established Patterns

- The app is a static Vite/React page; product sections can live in the same route without backend changes.
- Icons come from `lucide-react`; use existing icon-button conventions and restrained control styling.
- Existing tests mock `useUnlockWorkflow` and assert visible UI behavior in `src/App.test.tsx`.
- Safety is enforced through hook and runner state, not by marketing copy.

### Integration Points

- `src/App.tsx` - Add/reshape product sections and workspace navigation while preserving hook calls and action bindings.
- `src/style.css` - Adjust global background/tokens only as needed for the redesigned visual system.
- `src/App.test.tsx` - Update assertions for product introduction, workspace entry, and preserved payment/workflow surfaces.

## Canonical References

- `AGENTS.md` - Repo operating rules, asset/deploy notes, Khuym and Harness guardrails.
- `README.md` - Current commands and runtime environment.
- `docs/DEPLOY.md` - Static VPS release process.
- `docs/ASSETS_R2.md` - Current R2 release and asset verification rules.
- `docs/WORKFLOW.md` - Existing unlock phase order and safety gates.

## Deferred Ideas

- Native helper/libusb/UsbDk for EDL reliability is out of scope for this redesign.
- Changing payment/pass/backend contracts is out of scope unless production verification exposes a blocking contract break.
- Creating a multi-page router is deferred; a polished single-page product plus workspace is sufficient.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning, validation, review, and deployment must preserve the locked decisions and record proof.
