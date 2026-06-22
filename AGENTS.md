# Ghi chú cho agent kế tiếp

Tài liệu này là điểm vào nhanh khi tiếp tục làm dự án `webusb-xiaomi-unlock`.

## Bối cảnh nhanh

- App là Vite + React, chạy static, dùng WebUSB cho ADB/Fastboot/EDL.
- Site production hiện chạy ở `https://unlock.choimaytau.com`.
- Asset ROM/ABL/firehose được tải từ R2 qua `VITE_ASSET_BASE_URL`.
- Asset production hiện dùng `https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001`.
- Source workspace thường dùng: `C:\Users\nguye\Downloads\unlock-15ultra\webusb-xiaomi-unlock`.
- SSH key deploy VPS: `C:\Users\nguye\Downloads\VPS.pem`.

Không commit secret vào repo. Các credential R2/S3 phải nằm trong rclone config hoặc `.env.local` cục bộ.

## Lệnh hay dùng

```powershell
npm test
npm run build
npm run build:assets
npm run sync:assets:r2:dry-run
npm run sync:assets:r2
npm run verify:assets:r2
```

Build production:

```powershell
$env:VITE_ASSET_BASE_URL="https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001"
npm run build
```

Deploy VPS: xem [docs/DEPLOY.md](docs/DEPLOY.md).

Asset R2: xem [docs/ASSETS_R2.md](docs/ASSETS_R2.md).

Workflow và EDL: xem [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Cấu trúc quan trọng

- `src/App.tsx`: UI chính, workflow rail, control panel, terminal log.
- `src/hooks/useUnlockWorkflow.ts`: state/hook nối UI với runner.
- `src/workflow/runner.ts`: thứ tự phase, safety gate, ADB/Fastboot/EDL orchestration.
- `src/workflow/types.ts`: phase, progress, device status, workflow mode.
- `src/services/adb.ts`: WebUSB ADB.
- `src/services/fastboot.ts`: WebUSB Fastboot.
- `src/services/edl.ts`: WebUSB Sahara/Firehose EDL.
- `src/services/assetClient.ts`: manifest, flash plan, cache, verified fetch.
- `src/domain/models.ts`: model metadata, ABL, EDL sector mapping.
- `scripts/build-assets.ts`: build `dist-assets/`.
- `scripts/sync-assets-r2.ts`: upload R2 bằng rclone.
- `scripts/verify-assets-r2.ts`: verify R2/CORS/content-length.

## Quy tắc làm việc

- Chạy `npm test` và `npm run build` trước khi deploy nếu thay đổi code.
- Không sửa `dist-assets/` bằng tay trừ khi đang chuẩn bị asset release.
- Không thay đổi flow mặc định nếu yêu cầu chỉ liên quan EDL/C06.
- Log kỹ thuật trong app có thể không dấu; UI và lỗi người dùng nên dùng tiếng Việt có dấu.
- Không copy trực tiếp GPL code từ `bkerler/edl`. Nếu tham khảo protocol thì tự implement lại.

## Tình trạng EDL WebUSB hiện tại

EDL qua browser là thử nghiệm. Các lần gần nhất cho thấy Sahara upload firehose có thể chạy được, nhưng Firehose `configure` có thể timeout ở `bulk OUT` trên Chrome/WinUSB sau đoạn chuyển Sahara -> Firehose.

Code hiện tại dùng cấu hình bảo thủ trong `src/services/edl.ts`:

- Chờ Firehose ổn định khoảng 2 giây sau Sahara.
- Configure thẳng payload `4096`.
- Không retry nhiều payload sau khi `transferOut` timeout.

Nếu vẫn gặp `EDL bulk OUT hết thời gian truyền` ở `firehose configure`, hướng xử lý thực tế tiếp theo có thể là native helper/libusb/UsbDk thay vì tiếp tục retry trong WebUSB.

<!-- KHUYM:START -->
# Khuym Workflow

Use `khuym:using-khuym` first in this repo unless you are resuming an already approved Khuym handoff.

## Startup

1. Read this file at session start and again after any context compaction.
2. If `.khuym/onboarding.json` is missing or outdated, stop and run `khuym:using-khuym` before continuing.
3. If `.codex/khuym_status.mjs` exists, run `node .codex/khuym_status.mjs --json` as the first quick scout step.
4. If `.khuym/HANDOFF.json` exists, do not auto-resume. Surface the saved state and wait for user confirmation.
5. If `history/learnings/critical-patterns.md` exists, read it before planning or execution work.

## Chain

```
khuym:using-khuym
  → khuym:exploring
  → khuym:planning
  → khuym:validating
  → khuym:swarming
  → khuym:executing
  → khuym:reviewing
  → khuym:compounding
```

## Critical Rules

1. Never execute without validating.
2. `CONTEXT.md` is the source of truth for locked decisions.
3. If context usage passes roughly 65%, write `.khuym/HANDOFF.json` and pause cleanly.
4. Treat `.khuym/state.json` as the single runtime state file for routing, current focus, and operator notes.
5. After compaction, re-read `AGENTS.md`, run `node .codex/khuym_status.mjs --json` if present, then re-open `.khuym/HANDOFF.json`, `.khuym/state.json`, and the active feature context before more work.
6. P1 review findings block merge.

## Working Files

```
.khuym/
  onboarding.json     ← onboarding state for the Khuym plugin
  state.json          ← single runtime state file for agents, tools, and humans
  HANDOFF.json        ← pause/resume artifact
  reservations.json   ← local file reservations for same-session Codex swarms

history/<feature>/
  CONTEXT.md          ← locked decisions
  discovery.md        ← research findings
  approach.md         ← approach + risk map

history/learnings/
  critical-patterns.md

.beads/               ← bead/task files when beads are in use
.spikes/              ← spike outputs when validation requires them
```

.codex/
  khuym_status.mjs    ← read-only scout command for onboarding, state, and handoff
  khuym_state.mjs     ← shared state helpers used by the scout command
  khuym_reservations.mjs ← local reservation helper used by swarming, executing, and hooks

## Codex Guardrails

- Repo-local `.codex/` files installed by Khuym are workflow guardrails, not optional decoration.
- Use `node .codex/khuym_status.mjs --json` as the preferred quick scout step when it is available.
- Treat `compact_prompt` recovery instructions as mandatory.
- Use `bv` only with `--robot-*` flags. Bare `bv` launches the TUI and should be avoided in agent sessions.
- If the repo is only partially onboarded, stay in bootstrap/planning mode and surface what is missing before implementation.

## Session Finish

Before ending a substantial Khuym work chunk:

1. Update or close the active bead/task if one exists.
2. Leave `.khuym/state.json` and `.khuym/HANDOFF.json` consistent with the current pause/resume state.
3. Mention any remaining blockers, open questions, or next actions in the final response.
<!-- KHUYM:END -->

<!-- HARNESS:BEGIN -->
## Harness

This repo uses Harness. Before work, read:

- `README.md`
- `docs/HARNESS.md`
- `docs/FEATURE_INTAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`
- `docs/TOOL_REGISTRY.md`
- `scripts/bin/harness-cli query matrix`

Use the Rust Harness CLI at `scripts/bin/harness-cli` as the main operational
tool. Before a step that could use an external tool, run
`scripts/bin/harness-cli query tools --capability <name> --status present` to
see what is equipped; an absent capability is a clean skip.
<!-- HARNESS:END -->
