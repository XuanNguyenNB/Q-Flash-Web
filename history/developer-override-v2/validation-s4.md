# S4 Validation: Resume And Selective Bypass Behavior

Date: 2026-06-22
Story id: `QFW-DEVOVR-S4`
Mode: `high_risk_feature`
Decision: `READY WITH CONSTRAINTS`
Execution approval: not granted yet.

## Reality Gate Report

Mode: high-risk feature
Current work: wire authorized Resume and Selective Bypass into the existing hook/runner policy spine without changing normal flow.

MODE FIT: PASS

- S4 still touches workflow gates, payment readiness, dangerous confirmations, audit, and UI session controls.

REPO FIT: PASS

- S1 backend session/audit route exists in `server/src/routes.ts`.
- S2 type/policy spine exists in `src/workflow/types.ts` and `src/workflow/runner.ts`.
- S3 locked frontend panel and API client exist in `src/App.tsx` and `src/services/developerOverrideApi.ts`.
- Current runner does not yet enforce `overrideGatePolicy`; S4 is exactly the next missing behavior.

ASSUMPTIONS: PASS WITH CONSTRAINTS

- Existing `overrideTargetModel` is unsafe for S4 as-is because it is frontend env-gated and marks target detection `verified: true`.
- S4 must replace or bypass that legacy path with a backend-session-gated Resume path that records `manually assumed`, not `verified`.
- Asset and asset-key bypass can only bypass gates. It must not create fake keys, fake blobs, skip missing blob failures, or alter normal `/api/assets/keys` authorization.

SMALLER PATH: PASS

- Keep S4 to Resume and Selective Bypass only.
- Full Override, Fastboot terminal unlocking, EDL_Standard broad phase access, and any terminal expansion stay in S5.

PROOF SURFACE: PASS

- Focused baseline command passed:
  - `npm.cmd test -- src\workflow\runner.test.ts src\App.test.tsx src\services\developerOverrideApi.test.ts server\override.test.ts src\services\paymentApi.test.ts`
  - Result: 5 files passed, 66 tests passed.
- Backend payment/asset-key baseline passed:
  - `npm.cmd run server:test`
  - Result: 2 files passed, 23 tests passed.
- Secret scan over `src` and `dist` found no override master env name, cookie name, or contiguous `masterKey` in frontend artifacts. It only found fixture text `pass-token` inside `src/services/paymentApi.test.ts`.
- Scope scan of `src/App.tsx`, `src/services/developerOverrideApi.ts`, and `server/src/routes.ts` found no EDL terminal or developer-override EDL command surface.

Decision: proceed after explicit S4 execution approval.

## Feasibility Matrix

| Part / Assumption | Risk | Proof Required | Evidence | Result |
| --- | --- | --- | --- | --- |
| Backend session can gate UI actions | Unauthorized operator could access bypass controls | Status/login/logout/audit already require session | `server/src/routes.ts` has `/api/developer-override/status`, `/logout`, `/audit`; `server: test` passed | PASS |
| UI can keep controls locked without session | Normal users could reach override apply controls | App tests prove only session shell exists | `src/App.test.tsx` S3 tests; focused command passed | PASS |
| Runner policy can be enforced without default regression | Bypass could weaken normal flow | Existing no-override tests plus new S4 per-gate tests | S2 tests currently pass; policy currently not enforced beyond storage | PASS WITH WORK |
| Resume can select model/phase without fake verification | Old path marks `verified: true` | Replace old path with manual assumption provenance and logs | `src/hooks/useUnlockWorkflow.ts` old `applyDeveloperOverride` and `src/workflow/runner.ts` old `overrideTargetModel` prove what must not be reused as-is | PASS WITH CONSTRAINT |
| Preflight/payment/confirmation/compatibility gates can be bypassed selectively | Hook and runner gates are split | Add one typed policy path through hook and runner | `useUnlockWorkflow.ts` owns `canRun`, pass consume, compatibility acceptance; runner owns confirmation/security/product checks | PASS WITH WORK |
| Asset verification and asset-key authorization can be bypassed truthfully | Could fake data or leak keys | Bypass gate only; real cached/prepared data still required; no fabricated keys or backend auth weakening | `CryptoAssetClient` only gets keys through provider; `ServerAssetClient.fetchVerifiedBlob` fails if asset was not prepared | PASS WITH STRICT CONSTRAINT |
| Audit can capture selections and command outcomes | Missing audit trail | Reuse existing audit client, add hook/runner command outcome calls | `developerOverrideApi.ts` supports `phase_select`, `gate_policy`, `technical_command`; backend sanitizer rejects secret-like metadata | PASS |
| No EDL command surface enters S4 | Violates locked D11 | Search UI/API for EDL terminal/additions | Scope scan found none in override UI/API surfaces | PASS |
| Normal flow remains unchanged | Payment/safety regression | Default no-override policy and payment tests stay green | Focused tests and `server:test` passed | PASS |

## Execution Constraints For S4

1. Do not call or expose the old `applyDeveloperOverride` UI path directly from the panel unless it is rewritten to require an active backend override session and to avoid `verified: true` for manual assumptions.
2. Prefer a new explicit hook action for S4, for example `applyDeveloperOverrideSessionResume(...)`, that receives mode, workflow mode, model, phase, and gate policy from the locked panel.
3. Resume must mark previous visible phases as `manually assumed` in UI/logs. It may mark phase statuses complete for navigation, but it must not label skipped checks as verified.
4. `OverrideGatePolicy` default remains `noOverrideGatePolicy`; tests must show no default bypass for model verification, preflight, payment, confirmation, asset verification, asset-key authorization, antirollback, compatibility/security patch, fastboot product, and EFISP unlock verification.
5. Payment bypass may skip frontend payment/pass readiness and pass consume only while the backend override session is valid. It must not change `server/src/routes.ts` payment, pass, donation, or `/api/assets/keys` authorization behavior.
6. Asset-key bypass must not request, synthesize, store, log, or expose asset keys. If an encrypted asset is not already available through real data/cache, the phase must fail with a real error.
7. Asset verification bypass may bypass the gate/log state only. Real blobs must still exist before any command needing file data can run; command/data failure must be surfaced as failure, not success.
8. Fastboot product and EFISP unlock verification bypasses must be logged as `bypassed`. If a later command fails because the device response is missing or wrong, that result must remain failed.
9. Every Resume phase selection, mode change, gate policy change, and workflow command attempt/result in override mode must call backend audit without master key, session id, pass token, asset key, or raw reusable secret metadata.
10. No Full Override behavior, no terminal unlock expansion, no EDL terminal, no raw EDL input, no BrowserEdlClient command surface, no deploy, and no real-device execution in S4.

## Required S4 Test Additions

- App tests:
  - locked user cannot see Resume/Apply controls.
  - valid session can select workflow mode, model, phase, and apply Resume.
  - Resume shows/logs `manually assumed`.
  - Selective Bypass toggles build the expected `OverrideGatePolicy`.
  - logout/expiry removes policy from the workflow and disables controls.
  - audit calls include mode/model/phase/gates and contain no secret-like fields.

- Hook tests or App-backed tests:
  - payment bypass enables the next phase only when selected and session-active.
  - normal no-override payment gate remains disabled before pass readiness.
  - asset-key bypass does not call `/api/assets/keys` and fails truthfully when encrypted data is unavailable.

- Runner tests:
  - default policy preserves current gates.
  - model verification/manual assumption does not emit `verified`.
  - confirmation bypass skips only confirmation.
  - antirollback bypass skips only antirollback.
  - compatibility/security patch bypass skips only the intended compatibility gate.
  - fastboot product bypass does not mark product match verified.
  - EFISP unlock verification bypass does not fake `unlocked: yes`.
  - asset verification bypass does not mark missing prepared assets as success.

- Audit/API tests:
  - technical command outcomes are audited with `ok`, `failed`, `blocked`, or `bypassed`.
  - audit sanitizer still rejects secret-like metadata.

## Validation Baseline

Commands run during S4 validation:

```powershell
npm.cmd test -- src\workflow\runner.test.ts src\App.test.tsx src\services\developerOverrideApi.test.ts server\override.test.ts src\services\paymentApi.test.ts
npm.cmd run server:test
```

Results:

- Focused test slice: 5 files passed, 66 tests passed.
- Server payment/asset-key/override slice: 2 files passed, 23 tests passed.

Tooling notes:

- `gkg`, `br`, and `bv` are unavailable on PATH in this environment, so validation used targeted source inspection and local tests.
- `scripts/bin/harness-cli query matrix --numeric` timed out once during validation; earlier matrix queries produced no output. Harness trace/status should still be updated with the available CLI commands where they return.

## Approval Gate

VALIDATION COMPLETE - APPROVAL REQUIRED BEFORE EXECUTION

Mode: high-risk feature
Work: S4 Resume and Selective Bypass behavior
Current story: `history/developer-override-v2/current-story-s4.md`
Reality gate: PASS
Feasibility: READY WITH CONSTRAINTS
Structure: PASS after 1 validation iteration
Spikes: none required before S4 execution, but asset-key bypass must follow the cache/data-truth constraint above.
Integration readiness: PASS
Bead review: not available because `br`/`bv` are unavailable; S4 can proceed as one bounded execution slice unless the user asks to install bead tooling.
Current story/work readiness: PASS
Unresolved concerns: none blocking, but constraints are mandatory.

Approve execution for S4 only before source implementation.
