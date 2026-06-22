# S2 Current Story Pack: Default-Preserving Gate Policy

Date: 2026-06-22
Story id: `QFW-DEVOVR-S2`
Mode: `high_risk_feature`
Epic: E2 Gate Policy Spine
Status: Implemented and verified for S2.

## Story Outcome

The workflow layer has an explicit typed override gate policy that defaults to no override and preserves the existing public unlock behavior exactly. This story creates the safe policy spine for later Resume, Selective Bypass, and Full Override stories, but does not bypass any gate yet.

## Entry State

- S1 backend auth/session/audit spine is implemented and verified.
- Existing runner gates are direct method calls in `src/workflow/runner.ts`.
- Payment/pass gating is owned by `src/hooks/useUnlockWorkflow.ts`.
- The old `VITE_ALLOW_TARGET_OVERRIDE` path still exists and is frontend/env-flag based.
- No frontend Developer Override V2 session client or locked panel exists yet.

## Exit State

After S2 implementation:

- `src/workflow/types.ts` defines an explicit gate policy shape and no-override/default value.
- `UnlockWorkflowRunner` accepts the policy through constructor or a setter.
- `useUnlockWorkflow` creates the runner with the default no-override policy.
- No gate is bypassed by default.
- Old normal-flow tests continue to pass.
- New focused tests prove default policy preserves:
  - target/model verification gate
  - destructive confirmation gate
  - asset-prepared/asset-verification gate
  - antirollback gate
  - Fastboot product match gate
  - EFISP unlock verification gate
  - payment/pass gate in the hook
- S2 does not implement Resume, Selective Bypass, Full Override, UI session login, or command auditing.

## Likely Files Touched

- `src/workflow/types.ts`
- `src/workflow/runner.ts`
- `src/hooks/useUnlockWorkflow.ts`
- `src/workflow/runner.test.ts`
- `src/App.test.tsx` or focused hook/UI test only if needed to prove payment gate default preservation
- `history/developer-override-v2/progress.md`

## Feasibility Assumptions

| Assumption | Risk | Proof Needed |
| --- | --- | --- |
| A typed policy can be introduced without changing default runner behavior. | HIGH | Existing runner tests plus new default-policy regression tests pass. |
| Hook payment/pass gate can accept a default policy without weakening normal pass consume behavior. | HIGH | Existing payment UI tests and a focused default-policy test pass. |
| S2 can avoid the old frontend override removal until the backend-session UI story. | MEDIUM | `VITE_ALLOW_TARGET_OVERRIDE` remains test-covered as old behavior but no new bypass depends on it. |
| The policy can describe future gates without implementing bypass semantics now. | MEDIUM | Types are explicit and defaults are false/no-op. |

## Verification

Focused S2 validation/implementation commands:

```powershell
npm.cmd test -- src/workflow/runner.test.ts src/App.test.tsx
npm.cmd test
npm.cmd run build
```

Implementation proof:

- `npm.cmd test -- src/workflow/runner.test.ts src/App.test.tsx` passed, 2 files / 47 tests.
- `npm.cmd test` passed, 15 files / 110 tests.
- `npm.cmd run server:test` passed, 2 files / 23 tests.
- `npm.cmd run build` passed with only the existing Vite warnings.
- `npm.cmd run check:csp` passed.
- Secret scan for `DEVELOPER_OVERRIDE_MASTER_KEY`, `masterKey`, and `qflash_dev_override` in `dist`/`src` returned no matches.

Whole-feature final proof remains:

```powershell
npm.cmd test
npm.cmd run server:test
npm.cmd run build
npm.cmd run check:csp
```

## Out Of Scope

- Backend session client in frontend.
- Locked Developer Override V2 panel.
- Resume behavior or manual phase completion.
- Selective Bypass gate semantics.
- Full Override phase/terminal access.
- Any EDL command surface.
- Real-device execution or deploy.

## Bead Mapping

Formal bead tooling is unavailable in this workspace (`br`/`bv` are not on PATH and `.beads/` does not exist). If S2 validation passes, execute it as one bounded frontend/workflow pass unless the user enables bead tooling first.
