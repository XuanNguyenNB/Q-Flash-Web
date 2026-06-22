# Current Story Pack: QFW-REDESIGN-001

Epic: Product framing, workspace preservation, release proof

## Entry State

- `src/App.tsx` renders a dense technical console with a compact hero, workflow rail, control panel, payment/compatibility panels, and terminal.
- Core workflow state and safety behavior live in `src/hooks/useUnlockWorkflow.ts` and `src/workflow/runner.ts`.
- Production deploy process is documented in `docs/DEPLOY.md` and uses a static VPS release symlink.

## Exit State

- The top of the page explains Q Flash Web in Vietnamese and gives a new user enough context to understand purpose, sample flow, preparation, risks, and workspace entry.
- The unlock workspace remains usable and preserves existing hook-driven behavior.
- Desktop and mobile screenshots show a polished layout with no obvious broken text, overlap, or unusable controls.
- `npm test`, `npm run build`, local browser smoke, production deploy, and production smoke are recorded.

## Files Likely Touched

- `src/App.tsx`
- `src/style.css`
- `src/App.test.tsx`
- `docs/product/q-flash-web.md`
- `docs/stories/q-flash-redesign/*`
- `history/q-flash-redesign/*`
- `.khuym/state.json`

## Feasibility Assumptions

| Assumption | Risk | Proof Needed |
| --- | --- | --- |
| Product sections can be added without changing workflow state | Medium | Typecheck/tests and no hook/runner behavior diff |
| Existing deploy SSH key is available | High | Deploy command succeeds, or pause with blocker |
| Browser smoke can run locally | Medium | Dev/preview server and screenshot evidence |
| Production asset base is unchanged | High | Build command with env and bundle/content smoke |

## Verification

- `npm test`
- `npm run build`
- Local browser smoke on desktop and mobile viewport
- Production smoke at `https://unlock.choimaytau.com`
- Asset base smoke for `https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001/manifest.json`

## Out Of Scope

- Changing payment/backend API contracts.
- Changing model support, asset release, or workflow phase semantics.
- Native EDL helper work.
