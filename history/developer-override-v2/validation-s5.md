# S5 Validation: Full Override Existing Surfaces

Date: 2026-06-22
Story id: `QFW-DEVOVR-S5`
Mode: `high_risk_feature`
Decision: `READY WITH CONSTRAINTS`
Execution approval: granted by user after validation.
Implementation status: complete.

## Reality Gate Report

Mode: high-risk feature
Current work: wire authorized Full Override into the existing panel/hook/runner policy spine without adding new protocol surfaces.

MODE FIT: PASS

- S5 touches authorization-controlled workflow gates, Fastboot terminal access, phase navigation, audit, and dangerous-operation UX.
- Smaller modes are insufficient because a mistake could weaken safety gates or expose destructive command paths.

REPO FIT: PASS

- S4 code already has `DeveloperOverrideMode = "full_override"` and `normalizeOverrideGatePolicy(...)` expands Full Override to every `overrideGateIds` entry.
- Runner gate checks already call `isOverrideGateBypassed(...)`, so Full Override can reuse the S4 per-gate enforcement path.
- The panel currently lists `full_override` but blocks Apply with `full_override_out_of_scope_s4`.
- `useUnlockWorkflow.applyDeveloperOverrideSession(...)` currently returns `false` for `options.mode === "full_override"`.
- Fastboot terminal support exists only through `src/services/fastboot.ts` and rejects text-only `fastboot flash` / `fastboot boot`.
- Existing EDL code is structured service code in `src/services/edl.ts`; no arbitrary EDL terminal input exists in the UI/API.

ASSUMPTIONS: PASS WITH CONSTRAINTS

- Full Override should be a policy preset plus existing phase access, not a new protocol API.
- EDL_Standard remains the existing manual/external-ABL Fastboot workflow mode gated by `VITE_ALLOW_ADVANCED_EDL=true`.
- Full Override must not synthesize asset keys, prepared blobs, device responses, command output, or unlock state.
- Fastboot terminal parser must stay unchanged unless tests prove a narrowly necessary audit/UI adjustment.

SMALLER PATH: PASS

- Implement only Full Override policy application and UI naming/access.
- Do not combine S5 with S6 final report/docs or any production/UAT work.

PROOF SURFACE: PASS

- Focused baseline command passed:
  - `npm.cmd test -- src\App.test.tsx src\workflow\runner.test.ts src\services\fastboot.test.ts src\services\developerOverrideApi.test.ts server\override.test.ts src\services\paymentApi.test.ts`
  - Result: 6 files passed, 83 tests passed.
- Backend baseline passed:
  - `npm.cmd run server:test`
  - Result: 2 files passed, 23 tests passed.
- Scope scan found no Developer Override EDL terminal/raw EDL/BrowserEdlClient command surface in the panel, hook API client, or backend route surfaces.
- Secret scan over `src` and `dist` found no override master-key/cookie/session symbols; it found only the `pass-token` fixture in `src/services/paymentApi.test.ts`.
- `gkg`, `br`, and `bv` are unavailable on PATH; validation uses direct file inspection, `rg`, and test commands.

Decision: proceed after explicit S5 execution approval.

## Feasibility Matrix

| Part / Assumption | Risk | Proof Required | Evidence | Result |
| --- | --- | --- | --- | --- |
| Full Override can reuse the typed gate policy | New mode could bypass too much or too little | Type normalizer expands `full_override` to all gates | `src/workflow/types.ts` has `normalizeOverrideGatePolicy` full-override branch | PASS |
| Runner enforcement already supports all Full Override gates | Full Override could require new runner behavior | S4 gate tests prove per-gate bypass behavior; Full Override should only pass all gates at once | `src/workflow/runner.ts` uses `isOverrideGateBypassed` for S4 gates; S4 runner tests passed | PASS WITH TEST WORK |
| UI currently blocks Full Override by design | S5 needs a real change, not just docs | Source must show the S4 block | `src/App.tsx` has `full_override_out_of_scope_s4` branch and Apply label `Apply S4 override` | PASS WITH WORK |
| Hook currently blocks Full Override by design | S5 must remove hook block safely | Source must show the S4 block | `src/hooks/useUnlockWorkflow.ts` rejects `options.mode === "full_override"` | PASS WITH WORK |
| Fastboot terminal scope is limited to existing parser | S5 must not add flash/boot upload or EDL terminal | Parser tests and source must prove current surface | `src/services/fastboot.ts` supports devices/getvar/erase/set_active/reboot/raw and throws on text-only flash/boot | PASS |
| EDL boundary remains unchanged | Violating D11 would add arbitrary EDL commands | Search UI/API surfaces for EDL terminal/command additions | S5 scope scan found none in current surfaces | PASS |
| EDL_Standard phase access can stay existing-mode only | Full Override might be mistaken for EDL command support | Workflow mode source and docs must define current behavior | `docs/WORKFLOW.md`, `src/hooks/useUnlockWorkflow.ts`, and `src/workflow/runner.ts` define `edl-standard` as manual/external ABL plus Fastboot phases | PASS WITH CONSTRAINT |
| Audit captures Full Override actions/results | Missing S5 audit trail | Reuse S3/S4 audit client and hook command audits | `server/src/routes.ts` audit schema already accepts `full_override`; hook audits non-none policies | PASS WITH TEST WORK |
| Normal flow remains unchanged | Full Override could weaken default gates | Default policy tests and payment tests must stay green | S5 baseline focused tests passed; final implementation must rerun full suite | PASS WITH TEST WORK |

## Execution Constraints For S5

1. Do not add any EDL terminal, raw EDL input, BrowserEdlClient command route, or new EDL UI command surface.
2. Do not add a general ADB terminal.
3. Full Override must be applied only after a valid backend override session is active in the panel.
4. In `applyDeveloperOverrideSession`, Full Override should create a normalized policy with all `overrideGateIds`; Selective Bypass remains explicitly selected gates; Resume remains no bypass gates.
5. Full Override should keep manual model/phase selection provenance as `manually_assumed`, not `verified`.
6. The UI must show Full Override mode, all bypassed gates, remaining session time, and danger warning.
7. The Apply button should be renamed away from S4-specific wording and must not be visible while locked.
8. EDL_Standard selection must remain subject to the existing `showAdvancedEdl`/`VITE_ALLOW_ADVANCED_EDL` behavior.
9. Fastboot terminal must keep the existing parser support and existing `flash`/`boot` text-only rejection.
10. Missing devices, missing blobs, failed commands, and missing asset keys must continue to fail truthfully.
11. Add tests proving logout/expiry clears Full Override policy and unauthorized/locked users cannot apply it.
12. No deploy and no real-device/destructive execution.

## Required S5 Test Additions

- App tests:
  - valid session can select Full Override and apply it for a legacy Standard phase with all gates.
  - valid session can select Full Override for EFISP phases; EFISP forces Standard workflow mode.
  - with advanced EDL enabled, valid session can select EDL_Standard and a later Fastboot phase without adding EDL terminal controls.
  - locked panel never shows/apply Full Override controls beyond password login.
  - logout/expiry clears a Full Override policy.
  - phase-select audit includes `mode: "full_override"`, workflow mode, model, phase, all bypassed gates, and no secrets.

- Hook/runner tests:
  - `applyDeveloperOverrideSession({mode:"full_override"})` installs a policy whose gates equal `overrideGateIds`.
  - Full Override allows the same bypasses proven in S4 when all gates are active.
  - Full Override still fails when a command needs missing prepared blobs.
  - Full Override does not mark manual targets as `verified`.

- Fastboot tests:
  - terminal parser still rejects text-only `fastboot flash ...` and `fastboot boot ...`.
  - Full Override terminal command audit uses command kind only and does not log reusable secrets.

- Scope tests/scans:
  - no UI/API text or code path introduces EDL terminal/raw EDL/BrowserEdlClient command surface.

## Validation Baseline

Commands run during S5 validation:

```powershell
npm.cmd test -- src\App.test.tsx src\workflow\runner.test.ts src\services\fastboot.test.ts src\services\developerOverrideApi.test.ts server\override.test.ts src\services\paymentApi.test.ts
npm.cmd run server:test
```

Results:

- Focused test slice: 6 files passed, 83 tests passed.
- Server override/payment slice: 2 files passed, 23 tests passed.

Tooling notes:

- `gkg`, `br`, and `bv` are unavailable on PATH in this environment.
- Harness impact-analysis provider query returned no present provider output.
- Validation used targeted source inspection and local tests.

## Approval Gate

VALIDATION COMPLETE - APPROVAL REQUIRED BEFORE EXECUTION

Mode: high-risk feature
Work: S5 Full Override existing surfaces
Current story: `history/developer-override-v2/current-story-s5.md`
Reality gate: PASS
Feasibility: READY WITH CONSTRAINTS
Structure: PASS after 1 validation iteration
Spikes: none required before S5 execution
Integration readiness: PASS
Bead review: not available because `br`/`bv` are unavailable; S5 can proceed as one bounded execution slice unless the user enables bead tooling first.
Current story/work readiness: PASS
Unresolved concerns: none blocking, but constraints are mandatory.

Approve execution for S5 only before source implementation.

## Post-Implementation Validation

S5 source changes were implemented after explicit user approval.

Implemented behavior:

- Removed the S4-only Full Override block in `src/App.tsx`.
- Renamed the panel action from `Apply S4 override` to `Apply override`.
- Allowed `useUnlockWorkflow.applyDeveloperOverrideSession(...)` to accept `mode: "full_override"`.
- Reused `normalizeOverrideGatePolicy(...)`, so Full Override expands to the full `overrideGateIds` list.
- Did not add ADB terminal, EDL terminal, raw EDL input, BrowserEdlClient command route, deploy logic, or real-device execution.

Focused S5 proof:

```powershell
npm.cmd test -- src\App.test.tsx src\hooks\useUnlockWorkflow.test.tsx src\workflow\runner.test.ts src\services\fastboot.test.ts src\services\developerOverrideApi.test.ts server\override.test.ts src\services\paymentApi.test.ts
```

Result: 7 files passed, 89 tests passed.

Backend proof:

```powershell
npm.cmd run server:test
```

Result: 2 files passed, 23 tests passed.

Full proof run during S5:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run check:csp
```

Results:

- `npm.cmd test`: 17 files passed, 134 tests passed.
- `npm.cmd run build`: passed with existing Vite warnings for `android-fastboot` browser externalization and chunk size.
- `npm.cmd run check:csp`: passed.

Safety scans:

```powershell
rg -n "DEVELOPER_OVERRIDE_MASTER_KEY|masterKey|qflash_dev_override|developer_override|session secret|pass-token|asset decryption key" src dist
rg -n "EDL terminal|raw EDL|edl command|BrowserEdlClient|Apply S4 override|full_override_out_of_scope_s4|scheduled for S5" src/App.tsx src/App.test.tsx src/hooks/useUnlockWorkflow.ts src/services/developerOverrideApi.ts server/src/routes.ts dist
```

Results:

- Secret scan found only the expected `pass-token` fixture in `src/services/paymentApi.test.ts`.
- Scope scan found only an App test assertion that no `EDL terminal|raw EDL|BrowserEdlClient` UI text exists.
- No master key, reusable override secret, session secret, or cookie secret was found in `src` or `dist`.

UI inspection:

- Desktop locked-panel screenshot: `.codex-run/developer-override-v2-s5/ui/desktop-locked-panel.png`
- Mobile locked-panel screenshot: `.codex-run/developer-override-v2-s5/ui/mobile-locked-panel-scrolled.png`
- Mobile inspection JSON: `.codex-run/developer-override-v2-s5/ui/mobile-scrolled-inspection.json`

Mobile inspection result:

- viewport: 390x844
- horizontal overflow: false
- master key field visible: true
- Apply Override visible while locked: false
- Override mode control visible while locked: false
- EDL command surface text visible: false

S5 exit decision: PASS. S6 final review/report remains next; no deploy and no real-device execution were performed.
