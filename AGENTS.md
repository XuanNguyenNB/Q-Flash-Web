# Ghi chú cho agent kế tiếp

Tài liệu này là điểm vào nhanh khi tiếp tục làm dự án `webusb-xiaomi-unlock`.

## Bối cảnh nhanh

- App là Vite + React, chạy static, dùng WebUSB cho ADB/Fastboot/EDL.
- Site production hiện chạy ở `https://unlock.choimaytau.com`.
- Asset ROM/ABL/firehose được tải từ R2 qua `VITE_ASSET_BASE_URL`.
- Asset production hiện dùng `https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260506-001`.
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
$env:VITE_ASSET_BASE_URL="https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260506-001"
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

