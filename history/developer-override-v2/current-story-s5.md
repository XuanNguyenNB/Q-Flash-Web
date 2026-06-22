# S5 Current Story Pack: Full Override Existing Surfaces

Date: 2026-06-22
Story id: `QFW-DEVOVR-S5`
Mode: `high_risk_feature`
Epic: E4 Full Override Supported Surfaces
Status: Implementation complete; S5 validation passed.

## Entry State

- S1 backend override auth/session/audit is complete.
- S2 typed override policy spine is complete and default behavior remains `noOverrideGatePolicy`.
- S3 locked Developer Override V2 panel/session shell is complete.
- S4 Resume and Selective Bypass are complete:
  - Resume marks previous phases `manually_assumed`.
  - Selective Bypass can bypass individual gates without faking device/data/command success.
  - Full Override is currently visible in the panel but intentionally non-executable.

## Story Outcome

An authorized Developer Override V2 session can use Full Override as the strongest supported policy:

- Full Override applies every existing override gate in `overrideGateIds`.
- Full Override can select Standard, EFISP, and existing `edl-standard` phase surfaces already supported by the workflow.
- Full Override unlocks the currently supported Fastboot terminal parser/executor only.
- Full Override remains backend-session-gated and audited.
- No new ADB terminal, EDL terminal, arbitrary EDL input, BrowserEdlClient command surface, deploy, or real-device execution is added.

## Exit State

After S5 implementation:

- The panel Apply button is no longer S4-specific and can apply `full_override` while a valid backend session is active.
- Full Override `bypassedGates` equals the full `overrideGateIds` list via `normalizeOverrideGatePolicy`.
- Full Override may select all visible phases for the selected model/workflow:
  - Legacy Standard: preflight, connect, prepare, boot/write ABL when applicable, flash FTD, unlock payload, restore GPT, verify unlock.
  - EFISP: preflight, connect, prepare, boot permissive, write EFISP, verify unlock, cleanup data.
  - EDL_Standard: the existing manual/external-ABL Fastboot workflow mode only when `VITE_ALLOW_ADVANCED_EDL=true`.
- Full Override preserves truthfulness:
  - Missing device connections still fail.
  - Missing prepared blobs still fail.
  - Unsupported text-only `fastboot flash` and `fastboot boot` remain blocked by the existing parser.
  - Fastboot raw protocol commands still depend on real Fastboot responses.
- Full Override technical command attempts/results are audited with mode, workflow mode, model, phase or command type, bypassed gates, result, and no secrets.
- Logout/session expiry clears the active Full Override policy.
- Normal no-session/no-override flow remains unchanged.

## Likely Files Touched

- `src/hooks/useUnlockWorkflow.ts`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/workflow/runner.test.ts`
- `src/services/fastboot.test.ts`
- `history/developer-override-v2/progress.md`
- `history/developer-override-v2/validation-s5.md`
- `.khuym/state.json`

## Validation To Run

Focused S5 proof after implementation:

```powershell
npm.cmd test -- src\App.test.tsx src\workflow\runner.test.ts src\services\fastboot.test.ts src\services\developerOverrideApi.test.ts server\override.test.ts src\services\paymentApi.test.ts
npm.cmd run server:test
```

Final proof remains S6:

```powershell
npm.cmd test
npm.cmd run server:test
npm.cmd run build
npm.cmd run check:csp
```

## Out Of Scope

- Any new ADB terminal.
- Any EDL terminal, arbitrary EDL command input, or BrowserEdlClient command surface.
- New protocol-level destructive behavior.
- Production deploy.
- Real-device or destructive command execution.

## Validation Result

See `history/developer-override-v2/validation-s5.md`.

S5 implementation was completed after explicit user approval. Post-implementation validation passed:

- Focused S5 proof: `npm.cmd test -- src\App.test.tsx src\hooks\useUnlockWorkflow.test.tsx src\workflow\runner.test.ts src\services\fastboot.test.ts src\services\developerOverrideApi.test.ts server\override.test.ts src\services\paymentApi.test.ts`
- Backend proof: `npm.cmd run server:test`
- Full suite proof: `npm.cmd test`
- Build proof: `npm.cmd run build`
- CSP proof: `npm.cmd run check:csp`
- Secret/scope scans found no frontend/build master-key/session secret exposure and no new EDL terminal/raw EDL/BrowserEdlClient command surface.
- Locked UI desktop/mobile artifacts were captured under `.codex-run/developer-override-v2-s5/ui/`.

## Approval Gate

S5 execution was approved by the user and is complete. Next work is S6 final review/validation report; no deploy or real-device execution has been performed.
