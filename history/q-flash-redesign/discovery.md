# Discovery - Q Flash Web Redesign

## Architecture Snapshot

gkg was unavailable in this session (`gkg` command not found), so discovery used `rg`, direct file reads, and Harness/Khuym scout output.

- Frontend stack: Vite 8, React 19, Tailwind CSS v4, `lucide-react`.
- Runtime shape: static app at `src/main.tsx` rendering `src/App.tsx`; production deploy uploads `dist/` to the VPS static release directory.
- Workflow contract: `src/hooks/useUnlockWorkflow.ts` owns UI state, phase order, payment/pass readiness, and action callbacks. `src/workflow/runner.ts` owns device orchestration and phase safety checks.
- Asset contract: production web build must embed `https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001`; public R2 release must not expose `keys.json`.
- Existing product surface: `src/App.tsx` already contains a technician-style hero, three-column workspace, compatibility/payment panels, and terminal log.

## Existing Patterns

- `src/App.test.tsx` mocks the hook and checks visible UI behavior, which is the right place to prove product copy and preserved workspace affordances.
- The app avoids routing and relies on anchor/scroll navigation (`workflow-console`, `terminal-log`), so product sections should keep same-route ergonomics.
- Current UI uses compact cards, border-based panels, and icon-led controls. The redesign should stay dense and operational rather than becoming a generic marketing page.
- User-visible copy is mostly Vietnamese; several technical logs and some legacy labels are ASCII by design.

## Constraints

- Do not edit `dist-assets/` or asset release paths.
- Do not change model metadata, workflow order, destructive confirmations, or pass consumption semantics for visual polish.
- Browser verification must cover desktop and mobile because the app has sticky panels and horizontally dense model/workflow data.
- Production deploy may be blocked if required SSH access or backend/payment health is unavailable.

## Current Risk Notes

- `.khuym/state.json` still records a prior production blocker: `/api/health` returning static SPA HTML instead of backend JSON. This redesign should not change backend contracts, but production smoke should report this if still present.
- The worktree is already dirty with previous payOS/workflow changes. Redesign edits must work with existing changes and not revert unrelated files.
