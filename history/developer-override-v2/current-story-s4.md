# S4 Current Story Pack: Resume And Selective Bypass Behavior

Date: 2026-06-22
Story id: `QFW-DEVOVR-S4`
Mode: `high_risk_feature`
Epic: E2 Gate Policy Spine
Status: Validated READY WITH CONSTRAINTS; implementation is not approved yet.

## Entry State

- S1 backend master-key session and audit routes are implemented and verified.
- S2 runner/hook no-override gate policy is implemented and verified.
- S3 frontend session client and locked Developer Override V2 panel shell are implemented and verified.
- S3 intentionally did not wire Resume, Selective Bypass, Full Override, EDL commands, deploy, or real-device execution.

## Story Outcome

An authorized Developer Override V2 session can use Resume and Selective Bypass behavior against the existing runner/hook policy spine:

- Resume selects workflow mode, model, and phase, then marks earlier phases as `manually assumed`.
- Selective Bypass can bypass only explicitly selected gates.
- Normal no-override flow remains unchanged.
- Bypass never marks missing device/data/command results as verified.
- Backend audit receives mode/model/phase/gate selections and relevant workflow command outcomes without secrets.

## Exit State

After S4 implementation:

- Resume is available only while the frontend has a valid backend override session.
- Resume can select supported workflow mode, supported model, and a visible phase.
- Earlier phases are logged/statused as `manually assumed`, not `verified`.
- Selective Bypass applies a typed `OverrideGatePolicy` to runner/hook behavior only for selected gates.
- Default `noOverrideGatePolicy` keeps model verification, preflight, payment, confirmation, asset verification, asset-key authorization, antirollback, compatibility/version, Fastboot product, and EFISP unlock verification gates unchanged.
- Bypass logs clearly say `bypassed` for gate skips.
- Real device/data/command success is never fabricated.
- Backend audit records mode, workflow mode, model, phase, bypassed gate set, command type/result/time; no master key, session id, pass token, asset key, or reusable secret is included.
- No Full Override terminal expansion, no EDL terminal, no raw EDL command input, no BrowserEdlClient command surface, no deploy, and no real-device execution are added.

## Likely Files Touched

- `src/hooks/useUnlockWorkflow.ts`
- `src/workflow/runner.ts`
- `src/workflow/types.ts`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/workflow/runner.test.ts`
- `src/services/developerOverrideApi.ts` only if audit payload shape needs extension
- `history/developer-override-v2/progress.md`
- `history/developer-override-v2/validation-s4.md`
- `.khuym/state.json`

## Validation To Run

Before S4 implementation, validate the exact gate map and pause for approval.

Focused proof after implementation should include:

```powershell
npm.cmd test -- src/workflow/runner.test.ts src/App.test.tsx src/services/developerOverrideApi.test.ts server/override.test.ts
npm.cmd test -- src/services/paymentApi.test.ts
npm.cmd test
npm.cmd run server:test
npm.cmd run build
npm.cmd run check:csp
```

## Out Of Scope

- Full Override behavior and terminal unlocking.
- Any new ADB terminal.
- Any EDL terminal, arbitrary EDL command, or BrowserEdlClient command surface.
- Production deploy.
- Real-device or destructive command execution.

## Validation Result

See `history/developer-override-v2/validation-s4.md`.

S4 is READY WITH CONSTRAINTS. The mandatory constraints are:

- Do not reuse the legacy env-gated override path as-is because it marks manual selection `verified: true`.
- Resume must log/status earlier phases as `manually assumed`.
- Selective bypass may bypass gates but must not fake device, asset, key, or command success.
- Payment and `/api/assets/keys` behavior for normal users must remain unchanged.
- No Full Override, terminal expansion, EDL command surface, deploy, or real-device execution in S4.

## Approval Gate

S4 implementation is not approved. Wait for explicit S4 execution approval before source changes.
