# Workflow và kiến trúc

Tài liệu này giúp agent sau hiểu luồng chính trước khi sửa code.

## Các workflow family

State chính nằm ở `src/workflow/types.ts`:

```ts
type WorkflowFamily = "efisp-8e-gen5" | "legacy-ftd";
type WorkflowMode = "standard" | "edl-standard";
```

### `legacy-ftd`

Flow cho Xiaomi 15 / 15 Pro / 15 Ultra / Redmi K80 Pro / Redmi K90 / Xiaomi Pad 8 Pro.

Hai mode ABL:

- `standard`: boot Android permissive, ghi ABL qua MQSAS.
- `edl-standard`: nạp ABL qua EDL 9008 cho máy có bản cập nhật đuôi C06/C07/C08; mode này chỉ hiện khi bật `VITE_ALLOW_ADVANCED_EDL=true`.

Sau ABL là FTD ROM, unlock payload, restore GPT, rồi MiFlash ROM gốc thủ công.

### `efisp-8e-gen5`

Flow cho Xiaomi 17 / K90 Pro Max 8E Gen 5. Không dùng ABL/FTD/GPT legacy. Chỉ unlock EFISP theo flow riêng.

Flow bắt buộc ADB-first, hard-block security patch mới hơn `2026-02-01`, chuẩn bị
`efisp/gbl_efi_unlock.efi` qua asset cache/SHA-256, và chỉ cleanup sau khi Fastboot
trả về chính xác `unlocked: yes`. Xem checklist máy thật tại
[UAT_EFISP_GEN5.md](UAT_EFISP_GEN5.md).

## Thứ tự phase chính

Phase nằm trong `src/workflow/types.ts`:

```text
preflight
connect-device
prepare-assets
boot-permissive
write-efisp
verify-unlock
cleanup-data
downgrade-abl
flash-ftd
unlock-payload
restore-gpt
finished
```

Không phải family nào cũng chạy tất cả phase. Runner quyết định danh sách phase theo family/mode.

## File code chính

- `src/workflow/runner.ts`: orchestration, safety gate, phase execution.
- `src/hooks/useUnlockWorkflow.ts`: state React, action của UI.
- `src/App.tsx`: UI layout, workflow selector, progress, terminal.
- `src/domain/models.ts`: model metadata, ABL path, EDL sector mapping.
- `src/services/assetClient.ts`: load manifest, load flash plan, fetch/cache/verify asset.
- `src/services/adb.ts`: WebUSB ADB.
- `src/services/fastboot.ts`: WebUSB Fastboot.
- `src/services/edl.ts`: WebUSB EDL Sahara/Firehose.

## Safety gates

Trước thao tác nguy hiểm, runner yêu cầu:

- Preflight đã tick đủ.
- Model đã verify bằng ADB/Fastboot hoặc developer override đã khóa model.
- Product/codename khớp model.
- Asset đã fetch và verify SHA-256.
- EDL ABL kiểm tra firehose SHA-256 và ABL padded sectors không vượt `maxSectors`.

Không tự đoán mode C06+ từ version. Người dùng chọn `Nạp ABL qua EDL mode` thủ công.

### K80 Pro `miro -> dada` sau ABL

Redmi K80 Pro (`miro`) có thể trả Fastboot product `dada` sau khi nạp ABL engineering. Runner chỉ chấp nhận `dada` như alias tạm thời khi cùng phiên đã có một lần Fastboot exact-match `miro` trước đó. Alias này chỉ mở khóa các phase `unlock-payload`, `restore-gpt`, và `verify-unlock`; không dùng để detect model ban đầu, không cho terminal destructive command, và không cho flash FTD.

## Prepare assets

`prepare-assets` tải và cache asset vào IndexedDB trước các phase phá hủy. Cache key gồm:

```text
baseUrl + path + sha256
```

Mục tiêu là sau khi đã tải đủ, các phase flash dùng blob đã verify trong cache, không phụ thuộc mạng giữa chừng.

Progress UI có hai mức:

- `overallProgress`: tổng tiến trình của phase.
- `itemProgress`: file hoặc thao tác hiện tại.

Kiểu event nằm ở `ProgressEvent` trong `src/workflow/types.ts`.

## EDL ABL metadata

Metadata nằm trong `src/domain/models.ts`.

Firehose chung:

```text
firehose/firehose_SM8750.melf
SHA-256: 95bd33db724706db5da03882c65783d01338df6159ce563be0ce1b963d83668d
sector size: 4096
max sectors: 2048
```

Sector mapping:

- `xiaomi15`, `xiaomi15pro`, `xiaomi15ultra`, `redmi-k80pro`, `redmi-k90`:
  - LUN `4`
  - `abl_a=121734`
  - `abl_b=367036`
- `xiaomi-pad8pro`:
  - LUN `4`
  - `abl_a=58758`
  - `abl_b=241084`

ABL file vẫn theo từng model qua `model.ablFile`, không dùng một ABL chung.

## EDL WebUSB hiện tại

Luồng trong `src/services/edl.ts`:

```text
connect9008
uploadProgrammer (Sahara)
configureUfs (Firehose configure)
programRaw abl_a
programRaw abl_b
reset
```

Tình trạng thực tế gần nhất:

- WebUSB picker nhận Qualcomm 9008 sau khi driver là WinUSB.
- Sahara upload firehose có thể thành công.
- Firehose `configure MemoryName=ufs` có thể timeout ngay ở `bulk OUT`.

Code hiện tại đã chọn hướng bảo thủ:

- Chờ Firehose ổn định khoảng 2 giây sau Sahara.
- Configure payload `4096` ngay từ đầu.
- Không retry `32768/16384` sau timeout vì WebUSB không hủy transfer đang treo thật sự.

Nếu log vẫn là:

```text
Firehose configure thất bại sau Sahara/WinUSB: configure 4096: Error: EDL bulk OUT hết thời gian truyền.
```

thì hướng tiếp theo nên là native helper/libusb/UsbDk hoặc một bridge local, không nên chỉ tăng retry trong browser.

## User instruction sau EDL reset

Sau khi nạp ABL qua EDL và reset:

```text
Nếu màn hình hiện System destroyed thì yên tâm.
Bấm Power 1 lần để tắt.
Giữ Volume Down 10-15 giây để máy vào lại Fastboot.
Sau đó connect Fastboot và tiếp tục flash ROM FTD.
```

## Test chính

```powershell
npm test
npm run build
```

Test quan trọng:

- `src/workflow/runner.test.ts`
- `src/services/assetClient.test.ts`
- `src/domain/schemas.test.ts`
- `src/domain/flashPlanParser.test.ts`
- `src/App.test.tsx`

