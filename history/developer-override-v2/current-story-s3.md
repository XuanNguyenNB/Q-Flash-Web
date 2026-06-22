# S3 Current Story Pack: Frontend Session Client And Locked Panel Shell

Date: 2026-06-22
Story id: `QFW-DEVOVR-S3`
Mode: `high_risk_feature`
Epic: E3 Override UI And Session UX
Status: Complete; implementation and focused/full validation passed.

## Planning Repair

The earlier epic queue named S3 as "Resume and Selective Bypass behavior." Validation found that unsafe as the immediate next execution slice because bypass semantics before a backend-session-gated frontend panel would leave dangerous behavior reachable before D2-D4 are fully enforced in the UI. S3 is repaired to build the frontend session client and locked panel shell first. Resume/Selective Bypass behavior moves to the next story.

## Story Outcome

The old always-visible "Ghi de lap trinh vien" panel is replaced by a Developer Override V2 shell that is locked unless the backend reports a valid unexpired override session. The frontend can login, poll status, logout, auto-expire controls, show remaining time, mode, bypass gate selections, and danger warnings, but it does not yet run Resume, Selective Bypass, or Full Override behavior.

## Entry State

- S1 backend routes exist:
  - `POST /api/developer-override/login`
  - `GET /api/developer-override/status`
  - `POST /api/developer-override/logout`
  - `POST /api/developer-override/audit`
- S1 tests prove wrong key, missing config, cookie attributes, expiry, logout, session-required audit, and secret sanitization.
- S2 added `OverrideGatePolicy`, `noOverrideGatePolicy`, and runner/hook default policy plumbing.
- The old App panel is still visible and calls `workflow.applyDeveloperOverride(modelId, phase)`.
- The old runner `overrideTargetModel` path is still gated only by `VITE_ALLOW_TARGET_OVERRIDE`; S3 must not expand it.

## Exit State

After S3 implementation:

- A frontend override API client exists, likely `src/services/developerOverrideApi.ts`, for login/status/logout/audit using same-origin `/api/developer-override/*`.
- No master key, session id, cookie value, pass token, asset key, or reusable secret is stored in frontend state beyond the login form input lifetime, logged, or placed in the bundle as a static value.
- `App.tsx` replaces the old unlocked developer panel with a locked Developer Override V2 panel.
- Without a valid backend session:
  - Override controls are disabled or hidden behind locked state.
  - No model/phase/gate apply action is available.
  - The panel can submit a master key only to the backend login route.
- With a valid backend session:
  - The panel shows mode, selected/available bypass gates, remaining time, and dangerous-operation warnings.
  - Logout clears the panel state and calls the backend logout route.
  - Expiry disables controls without page reload.
  - Mode/gate selections are UI/session state only; they do not bypass workflow gates in S3.
- Existing normal workflow UI, payment/pass flow, asset-key API calls, runner gates, and Fastboot terminal behavior remain unchanged.
- The old `applyDeveloperOverride` action is no longer reachable from the UI without the new session shell. If S3 leaves the hook method for S4, it must be inert from public UI and documented as temporary.
- No EDL terminal, no raw EDL command input, no BrowserEdlClient command surface, no deploy, and no real-device execution are added.

## Likely Files Touched

- `src/services/developerOverrideApi.ts` or a focused addition to `src/services/paymentApi.ts`
- `src/services/developerOverrideApi.test.ts` or focused client tests
- `src/App.tsx`
- `src/App.test.tsx`
- `src/hooks/useUnlockWorkflow.ts` only if needed to remove public old override reachability or expose safe session-shell state
- `history/developer-override-v2/progress.md`
- `history/developer-override-v2/validation-s3.md`
- `.khuym/state.json`

## Feasibility Assumptions

| Assumption | Risk | Proof Needed |
| --- | --- | --- |
| The frontend can use backend session status without reading the HttpOnly cookie. | HIGH | API client/status tests mock `remainingMs` and expiry; backend S1 tests prove cookie lifecycle. |
| The old panel can be locked or replaced without changing the normal unlock flow. | HIGH | App tests prove default workflow/payment/terminal surfaces still render and old apply action is not available while locked. |
| Secure/HttpOnly/SameSite session can be represented in UI tests without storing secrets. | HIGH | Client tests never inspect cookie value and no secret scan matches frontend/build output. |
| Mode/gate shell can be displayed before bypass behavior exists. | MEDIUM | Tests prove changing mode/gates sends at most audit/session UI state and does not call runner bypass/apply functions. |
| Logout and expiry can disable controls without reload. | HIGH | App tests for logout click and status expiry state. |

## Verification

Focused S3 validation/implementation commands:

```powershell
npm.cmd test -- src/App.test.tsx src/services/developerOverrideApi.test.ts server/override.test.ts src/services/paymentApi.test.ts
npm.cmd test -- src/workflow/runner.test.ts src/App.test.tsx
npm.cmd test
npm.cmd run build
npm.cmd run check:csp
rg -n "DEVELOPER_OVERRIDE_MASTER_KEY|masterKey|qflash_dev_override|pass-token|asset.?key" dist src
```

If the API client is added to `paymentApi.ts` instead of a new file, replace `src/services/developerOverrideApi.test.ts` with the actual focused test file.

## S3 Completion Evidence

Implemented:

- Added `src/services/developerOverrideApi.ts` and `src/services/developerOverrideApi.test.ts`.
- Replaced the old unlocked App panel with a locked `Developer Override V2` session shell.
- Added App tests for locked state, login shell, audit on mode/gate selection, logout, expiry, and no public UI reachability for old `applyDeveloperOverride`.
- S3 does not implement Resume execution, Selective Bypass execution, Full Override, EDL command surface, deploy, or real-device execution.

Validation passed:

- `npm.cmd test -- src/App.test.tsx src/services/developerOverrideApi.test.ts server/override.test.ts src/services/paymentApi.test.ts`: 4 files / 31 tests.
- `npm.cmd test -- src/workflow/runner.test.ts src/App.test.tsx`: 2 files / 51 tests.
- `npm.cmd test`: 16 files / 118 tests.
- `npm.cmd run server:test`: 2 files / 23 tests.
- `npm.cmd run build`: passed with existing Vite warnings for `android-fastboot` URL externalization and chunk size.
- `npm.cmd run check:csp`: passed.
- Runtime frontend scan over `dist`, `src/App.tsx`, and `src/services/developerOverrideApi.ts` found no `DEVELOPER_OVERRIDE_MASTER_KEY`, `masterKey`, `qflash_dev_override`, `pass-token`, old unlocked panel text, old apply button text, or blazer mock button text.
- Realbrowser accessibility check showed the opened panel remains locked with only `Master key` input and disabled `Mở Developer Override` button.
- UI artifacts were written under `.codex-run/developer-override-v2-s3/` for desktop/mobile inspection; desktop captures show the opened locked panel, while mobile captures verify responsive rendering.

## Out Of Scope

- Resume behavior that marks previous phases as manually assumed.
- Selective Bypass runner/hook semantics.
- Full Override phase or terminal access.
- Any new ADB terminal, EDL terminal, raw EDL command, or BrowserEdlClient command surface.
- Production deploy.
- Real-device or destructive command execution.

## Bead Mapping

Formal bead tooling is unavailable in this workspace (`br`/`bv` are not on PATH and `.beads/` does not exist). If S3 execution is approved, run it as one bounded frontend/session-shell pass unless bead tooling becomes available first.
