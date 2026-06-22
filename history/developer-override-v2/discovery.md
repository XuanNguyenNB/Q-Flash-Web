# Developer Override V2 - Discovery

**Date:** 2026-06-22
**Mode:** `high_risk_feature`
**Source of truth:** `history/developer-override-v2/CONTEXT.md`

## Discovery Status

- Khuym onboarding is current.
- `history/learnings/critical-patterns.md` was read before planning.
- `node .codex/khuym_status.mjs --json` confirmed `developer-override-v2` is active.
- `gkg` readiness is degraded: the repo is supported, but `gkg` is not installed on PATH. Both required commands failed:
  - `gkg index C:\Users\XuanNguyen\Documents\Q-Flash-Web`
  - `gkg server start`
- Harness impact-analysis capability query returned no present providers, so discovery uses targeted `rg` and file reads.

## Architecture Snapshot

### Frontend

- Vite + React app in `src/`.
- Main UI is `src/App.tsx`; workflow state and actions are surfaced by `src/hooks/useUnlockWorkflow.ts`.
- Existing tests use Vitest + Testing Library in `src/App.test.tsx` and workflow/service tests.
- Vite dev server proxies `/api` to `http://127.0.0.1:8787`.

### Workflow Runner

- `src/workflow/runner.ts` owns device detection, model verification, phase execution, gate checks, asset preparation, antirollback, confirmations, and Fastboot terminal execution.
- Existing gate methods and checks include:
  - `requireVerifiedTarget()`
  - `requireConfirmation(confirmed)`
  - `ensureAssetsForPhase(...)`
  - `assertFastbootProduct(...)`
  - `runAntirollbackCheck(...)`
  - EFISP `assertEfispUnlocked(...)`
- Existing `overrideTargetModel(...)` is frontend/env-flag based through `VITE_ALLOW_TARGET_OVERRIDE`, legacy-only, and unaudited.
- Current `workflowPhaseOrder(...)` supports standard legacy, EFISP, and `edl-standard` Fastboot-after-external-ABL mode.

### Terminal / Device Command Surface

- `src/services/fastboot.ts` is the only current text terminal parser/executor.
- Supported Fastboot terminal parser kinds: `devices`, `getvar`, `erase`, `set_active`, `reboot`, and `raw` Fastboot protocol command.
- Text terminal intentionally rejects `fastboot flash` and `fastboot boot` because they require file upload.
- `src/services/adb.ts` exposes ADB primitives to runner operations, but there is no general ADB terminal UI.
- `src/services/edl.ts` exposes structured WebUSB EDL primitives but is not wired as a terminal. CONTEXT D11 prohibits adding EDL commands.

### Backend

- Express backend is under `server/`.
- `server/src/config.ts` loads environment config. Production currently requires `PAYMENTS_ADMIN_TOKEN` and `PAYMENTS_ASSET_KEYS_PATH`.
- `server/src/routes.ts` owns `/api/health`, payment/donation/pass/asset-key routes, admin HTML/JSON, and the existing admin cookie helper.
- Existing admin cookie is `qflash_admin`, set from query token for `/api/admin`. Developer Override V2 must not reuse query-token master-key auth.
- `server/src/db/store.ts` owns SQLite schema, payment/domain methods, and a generic `audit_events` table.
- `AuditAction` is currently a narrow union for payment/donation/pass/asset-key events; override audit actions need extension or a typed helper.

### Payment / Asset Key Contract

- `src/services/paymentApi.ts` calls same-origin `/api` for orders, donations, pass consume, and `/api/assets/keys`.
- `CryptoAssetClient` obtains backend-authorized keys through a callback in `useUnlockWorkflow.ts`.
- Payment readiness and pass consumption are enforced in `useUnlockWorkflow.ts` before dangerous phases and destructive manual Fastboot commands.
- CONTEXT D19 requires normal payment and asset-key behavior to remain unchanged.

## Constraints

- No secrets in repo, frontend bundle, logs, or API responses.
- Override session cookie must be Secure, HttpOnly, SameSite, and expire after 15 minutes.
- Override can bypass gates but cannot fake device command success or data existence.
- No deploy and no real-device destructive execution.
- No EDL terminal or arbitrary EDL commands.
- Final proof must include `npm test`, `npm run server:test`, `npm run build`, `npm run check:csp`, and desktop/mobile UI inspection after implementation.

## Existing Proof Surfaces

- `server/payments.test.ts` can be extended for backend auth/session/audit and no-regression payment assertions.
- `src/workflow/runner.test.ts` already covers model verification, EFISP gates, antirollback, terminal confirmation/product checks, and old override behavior.
- `src/workflow/preflight.test.ts` covers safety readiness mode behavior.
- `src/App.test.tsx` mocks `useUnlockWorkflow` and can verify locked/unlocked override panel states.
- `src/services/paymentApi.test.ts` can cover client functions for override session/status/audit calls if placed in the same service.

## Warnings

- The worktree is already dirty with many existing project files; implementation must avoid reverting unrelated changes.
- The old developer override uses `VITE_ALLOW_TARGET_OVERRIDE`; keeping this path active would violate backend-only authorization.
- Secure cookie behavior must be validated through backend tests and browser/UI checks; local test clients may need to explicitly preserve cookies.
- Audit must avoid logging command arguments if they can contain secrets. Fastboot command type/result can be audited with sanitized command kind and outcome.
