# Validation - Q Flash Web Redesign

## Reality Gate Report

Mode: `high_risk_feature`

Current work: Redesign the static React product/workspace surface and deploy after proof.

| Gate | Result | Evidence |
| --- | --- | --- |
| Mode fit | PASS | Public product surface plus deployment and safety-critical workflow preservation is high-risk. |
| Repo fit | PASS | `src/App.tsx` is the existing UI composition layer; `useUnlockWorkflow` and runner isolate behavior. |
| Assumptions | READY WITH CONSTRAINTS | `gkg` unavailable, so discovery used `rg` and direct reads. Deploy credentials still need runtime verification. |
| Smaller path | PASS | One vertical story is smaller than splitting into marketing and workspace rewrites. |
| Proof surface | PASS | Tests, build, local/prod browser smoke, screenshots, and asset URL checks are concrete. |

Decision: proceed with implementation, with deployment paused only if credential/access or production smoke blockers appear.

## Feasibility Matrix

| Part / Assumption | Risk | Proof Required | Evidence | Result |
| --- | --- | --- | --- | --- |
| Add product sections in `App.tsx` | Medium | Typecheck/tests | React composition already single-route; no router required | READY |
| Preserve workflow behavior | High | No runner/hook behavior changes unless bug; tests pass | Existing hook exposes all needed UI state/actions | READY |
| Responsive layout | High | Browser screenshots desktop/mobile | To be captured after implementation | READY WITH CONSTRAINTS |
| Production deploy | High | SSH deploy and production smoke | Docs identify key and remote target; key availability pending runtime check | READY WITH CONSTRAINTS |
| Asset base | High | Build with env and smoke manifest URL | Docs lock current production asset URL | READY |

## Validation Plan

1. Run focused UI test after major `App.tsx` edits.
2. Run `npm test`.
3. Run production build with `VITE_ASSET_BASE_URL=https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001`.
4. Inspect local app on desktop and mobile, capture screenshots, and check console.
5. Deploy using the documented static VPS release flow.
6. Smoke production URL, workspace entry, and asset manifest URL.

## Acceptance Evidence

- `npm.cmd test -- src/App.test.tsx`: passed, 11 tests.
- `npm.cmd test`: passed, 14 files / 92 tests.
- `npm.cmd run build` with `VITE_ASSET_BASE_URL=https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001`: passed. Build emitted existing warnings for `android-fastboot` `url` externalization and bundle size over 500 kB.
- `npm.cmd run check:csp`: passed, 1 script and 1 stylesheet signed.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/verify-release.ps1`: passed through Harness story verification after normalizing the script path to forward slashes.
- `wsl ./scripts/bin/harness-cli story verify QFW-REDESIGN-001`: passed after the verifier command was corrected to call `./scripts/verify-release.ps1`.
- Local preview on `http://127.0.0.1:5173/`: desktop and mobile CDP screenshots saved to `.codex-run/qflash-local-5173-desktop.png` and `.codex-run/qflash-local-5173-mobile.png`; console events were empty.
- Local R2 smoke from `Origin: http://127.0.0.1:5173`: `manifest.json` returned 200, `Content-Length: 28350`, `Access-Control-Allow-Origin: http://127.0.0.1:5173`, and 26 manifest models.
- Initial deploy succeeded at release `/var/www/unlock.choimaytau.com/app/releases/20260618_213855_manual_deploy`.
- Final static release after CSP cleanup: `/var/www/unlock.choimaytau.com/app/releases/20260618_220220_manual_deploy`; local and remote archive SHA-256 both `d6e43e2291c10e0b0348f287a4bf6d30a04c72f89958310dc26c63ce8e368275`; Nginx config test and reload succeeded.
- Production static smoke: `https://unlock.choimaytau.com/?qa=smoke` returned 200 with `assets/index-C-pitMaY.js` and `assets/index-D2M3RIlF.css`.
- Production R2 smoke from `Origin: https://unlock.choimaytau.com`: `manifest.json` returned 200, `Content-Length: 28350`, `Access-Control-Allow-Origin: https://unlock.choimaytau.com`, and 26 manifest models.
- Final production screenshots saved to `.codex-run/qflash-prod-verified-desktop-top.png`, `.codex-run/qflash-prod-verified-desktop.png`, and `.codex-run/qflash-prod-verified-mobile.png`.
- Production navigation smoke: clicking `Workspace` set `location.hash` to `#workflow-console`, scrolled to `scrollY=838`, and surfaced heading `Kết nối thiết bị`.
- Final production CDP smoke reported zero console errors and zero failed network requests on desktop and mobile. The Cloudflare automatic analytics beacon is permitted only from `https://static.cloudflareinsights.com`; same-origin collection remains covered by `connect-src 'self'`.
- `deploy.ps1` now blocks normal production deployment before build/upload unless the payment service, populated environment file, and Nginx `/api` proxy are all present. `-AllowStaticOnly` is required for an intentional frontend-only release, and normal deploys require public `/api/health` JSON with `ok=true` after activation.

## Remaining Blockers

- `/api/health` still returns static SPA HTML (`Content-Type: text/html`) instead of backend JSON. Remote inspection found no `qflash-payments.service`, no `/etc/qflash-payments.env`, no `/var/lib/qflash-payments`, and no Nginx `/api` proxy. This blocks live paid unlock pass/payment behavior until production backend secrets and systemd/Nginx wiring are configured outside git.
- No production console/runtime blocker remains after the CSP update.

## 2026-06-18 Resumed Proof

- `npm.cmd run server:test`: passed, 1 file / 14 tests.
- `npm.cmd test -- server`: passed, 1 file / 14 tests.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/verify-release.ps1`: passed, 14 files / 96 tests, production build, and CSP/SRI check.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./deploy.ps1`: correctly stopped before build/upload because remote readiness remained `service=0`, `env=0`, `nginx=0`.
- Public `https://unlock.choimaytau.com/api/health` still returns `text/html` SPA content, so production payment API proof remains incomplete.

## 2026-06-18 Provisioning Helper Proof

- Added `scripts/provision-payments-vps.ps1` to configure the VPS payment backend only when a private env file supplies real payOS/admin values.
- PowerShell parser check passed for `scripts/provision-payments-vps.ps1`.
- `scripts/provision-payments-vps.ps1 -CheckOnly` with throwaway fake values performed no upload and no remote writes; it reported `node=1 service=0 env=0 nginx=0 current_backend=1`.
- The helper refuses `PAYMENTS_ALLOW_MOCK_IN_PRODUCTION` and normalizes production env values to `PAYMENTS_PROVIDER=payos`, `/var/lib/qflash-payments`, and `https://unlock.choimaytau.com`.
