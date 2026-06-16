# firmware-source/

Single source of truth cho firmware binaries dùng để build `dist-assets/`. Folder này **gitignored** (chỉ commit `README.md` + `.gitkeep`) vì chứa binary lớn và file độc quyền.

## Layout

```
firmware-source/
├── 8E/                          SM8750 (Snapdragon 8 Elite) — 6 model
│   ├── ennea.img                shared cho cả 6 máy
│   └── <slug>/
│       ├── abl.elf              engineering ABL
│       ├── payload.bin          unlock payload (flash partition:4)
│       └── final_gpt.bin        GPT cuối (flash partition:4 lúc restore)
├── 8G2/                         SM8550 — 5 model (xiaomi13/13p/13u/k60p/pad6sp)
├── 8G3/                         SM8650 — 8 model (14/14p/14u/k70/k70p/k80/fold4/flip)
├── 8SG3/                        SM8635 — 4 model (pad7/pad7p/civi4/tb3)
├── 8SG4/                        SM8735 — 3 model (luming/yupei/onyx)
└── shared/
    ├── firehose/firehose_SM8750.melf
    ├── unlock_generic/{boot.img, gpt_both4.bin}    generic 8 Elite payload
    ├── efisp/gbl_efi_unlock.efi                    efisp-8e-gen5
    └── exploits/{8g2,8g3,8sg3}/{exploit, su}
```

Mỗi `<slug>` khớp với `model.id` trong `src/domain/models.ts`.

## Populate

Chạy `scripts/populate-firmware-source.ps1` để copy từ các nguồn ngoài vào layout chuẩn:

```powershell
pwsh ./scripts/populate-firmware-source.ps1
```

Script:
- Đọc từ các root path local (jiangli_firmware, ReverseMT, downgrade-abl, auto-unlock-standalone, Unlock_Xiaomi_15U_C06, Unlock_BL_Xiaomi_17_Series_8E_GEN5, 8G3_Xiaomi_Unlock_Bootloader).
- Copy vào `firmware-source/` theo layout trên.
- Báo cáo file thiếu (không fail-fast — user copy thủ công bù).

## FTD packages (.rar)

**KHÔNG** copy vào đây vì size lớn (~25-40 GB cho 18 model). Build script đọc qua flag `--ftd-packages-root` (mặc định `..\Unlock_8E_Xiaomi\Unlock_8E_Xiaomi\Goi_ha_cap`).

## Build

```powershell
npm run build:assets
```

Output ở `dist-assets/`. File trong `unlock/payloads/`, `unlock/gpt/`, `ennea/` được encrypt AES-256-CBC; key/IV ghi vào `dist-assets/keys.json`.

## Thêm máy mới

1. Tạo folder `firmware-source/<chip>/<slug>/` chứa `abl.elf`, `payload.bin`, `final_gpt.bin`.
2. Add entry vào `v1LegacyModelSources` trong `src/domain/models.ts` với field `chip` đúng và `...perDeviceUnlock(chip, slug)`.
3. Nếu chưa có FTD package: set `skipFtdPackage: true`.
4. Run `npm run build:assets` + `npm test`.
