# QFW-REDESIGN-001 Validation

## Proof Strategy

Prove that the redesigned UI renders the required Vietnamese product context and that existing workspace controls still render from the mocked workflow state. Then prove runtime layout through local browser screenshots and production smoke.

## Test Plan

| Layer | Cases |
| --- | --- |
| Unit | `src/App.test.tsx` product copy, workspace entry, payment gate, compatibility panel, phase rail |
| Integration | No backend contract changes; existing payment tests remain in `npm test` |
| E2E | Local browser smoke for product nav and workspace entry |
| Platform | Desktop and mobile screenshots; production URL smoke |
| Performance | Build size warnings reviewed if Vite emits them |
| Logs/Audit | Console checked during browser smoke; Harness trace recorded |

## Fixtures

- Existing `src/App.test.tsx` mocked `useUnlockWorkflow` fixture.
- Production R2 asset manifest at `https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001/manifest.json`.

## Commands

```text
npm test
npm run build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/verify-release.ps1
```

## Acceptance Evidence

- `npm.cmd test -- src/App.test.tsx`: passed, 11 tests.
- `npm.cmd test`: passed, 14 files / 92 tests.
- `npm.cmd run build` with the locked production R2 asset base: passed.
- `npm.cmd run check:csp`: passed.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/verify-release.ps1`: passed.
- `wsl ./scripts/bin/harness-cli story verify QFW-REDESIGN-001`: passed after the story verifier path was corrected to use `./scripts/verify-release.ps1`.
- Local desktop/mobile screenshots: `.codex-run/qflash-local-5173-desktop.png`, `.codex-run/qflash-local-5173-mobile.png`.
- Final production deploy release: `/var/www/unlock.choimaytau.com/app/releases/20260618_220220_manual_deploy`.
- Final production screenshots: `.codex-run/qflash-prod-verified-desktop-top.png`, `.codex-run/qflash-prod-verified-desktop.png`, `.codex-run/qflash-prod-verified-mobile.png`.
- Production workspace navigation: `#workflow-console` scroll verified; visible heading `Kết nối thiết bị`.
- Production asset smoke: R2 `manifest.json` returned 200 with `Access-Control-Allow-Origin: https://unlock.choimaytau.com`.
- Final production browser smoke: zero console errors and zero failed network requests on desktop/mobile.
- Deployment guard: default `deploy.ps1` now stops before build/upload if the payment service, env file, or Nginx `/api` proxy is absent. Static-only deployment requires explicit `-AllowStaticOnly`.

## Remaining Blockers

- Production `/api/health` returns SPA HTML because `qflash-payments.service`, `/etc/qflash-payments.env`, `/var/lib/qflash-payments`, and Nginx `/api` proxy are not configured on the VPS. Static redesign is deployed, but live paid unlock pass/payment behavior remains blocked until production secrets and service wiring are installed outside git.

## 2026-06-18 Resumed Proof

- Backend/payment tests passed: `npm.cmd run server:test` and `npm.cmd test -- server`, 14 backend tests.
- Release verifier passed: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/verify-release.ps1`, 96 tests plus production build and CSP/SRI check.
- Guarded deploy was attempted without `-AllowStaticOnly` and stopped before upload because the VPS still reports `service=0`, `env=0`, `nginx=0`.

## 2026-06-18 Provisioning Helper Proof

- Added `scripts/provision-payments-vps.ps1` for the missing service/env/proxy step.
- PowerShell parser check passed.
- `scripts/provision-payments-vps.ps1 -CheckOnly` performed no upload and no remote writes; current VPS readiness is `node=1 service=0 env=0 nginx=0 current_backend=1`.
- Normal `deploy.ps1` still correctly stops before build/upload until real production payOS/admin secrets are supplied and provisioning succeeds.

## 2026-06-21 Unlock Xiaomi Amber Blueprint Proof

- Implemented the approved `m0xc9` amber blueprint direction as the public UI, with public brand `Unlock Xiaomi`, bundled mascot logo, Roboto font stack, amber visual system, and Vietnamese SEO copy.
- `npm.cmd test`: passed, 14 files / 99 tests.
- `npm.cmd run build`: passed; Vite emitted the existing `android-fastboot` browser externalization and chunk-size warnings.
- Local preview QA at `http://127.0.0.1:5173/`: console capture reported no console messages; network capture recorded 9 requests with 0 failures.
- Desktop/mobile screenshots: `.codex-run/qflash-blueprint-cdp-desktop.png`, `.codex-run/qflash-blueprint-cdp-mobile.png`.
- Workspace screenshot: `.codex-run/qflash-blueprint-workspace.png`.
- Donation regression proof remains in `src/App.test.tsx`: creating a donation QR calls `/api/donations`, renders QR/checkout status, and does not call unlock payment creation.
