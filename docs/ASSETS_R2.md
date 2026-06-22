# Asset ROM trên Cloudflare R2

App tải ROM/ABL/firehose từ asset base URL công khai. Production hiện dùng Cloudflare R2 qua custom domain.

## Cấu hình hiện tại

- R2 bucket: `unlockxiaomi`
- Public custom domain: `https://xiaomi.choimaytau.com`
- S3 endpoint: `https://e807dd1d066d407f04a0801053636a3a.r2.cloudflarestorage.com`
- Release prefix production: `xiaomi-webusb/releases/20260617-001`
- App asset base URL:

```text
https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001
```

Không commit `R2_ACCESS_KEY_ID` hoặc `R2_SECRET_ACCESS_KEY`. Dùng rclone config hoặc biến môi trường cục bộ.

## Layout asset

`npm run build:assets` tạo `dist-assets/` với cấu trúc chính:

```text
dist-assets/
  manifest.json
  sha256sums.json
  abl/
  firehose/
  efisp/
  unlock/
  packages/
```

Browser không giải nén `.rar`; mọi file phải có sẵn trong `dist-assets/` hoặc R2 theo đúng path manifest.

Paid unlock flow không upload public `keys.json` cho asset unlock đã mã hóa. `scripts/build-assets.ts` ghi khóa giải mã vào `PAYMENTS_ASSET_KEYS_PATH` (mặc định `server/data/payment-asset-keys.local.json`) để backend `/api/assets/keys` cấp key sau khi unlock pass được xác thực. File key này là secret vận hành, không commit và không đồng bộ lên R2.

## Build asset

```powershell
npm run build:assets
```

Nếu source asset nằm khác mặc định:

```powershell
npm run build:assets -- --source-root C:\path\Unlock_8E_Xiaomi --abl-root C:\path\downgrade-abl --unlock-root C:\path\unlock-assets --efisp-root C:\path\Unlock_BL_Xiaomi_17_Series_8E_GEN5 --out C:\path\asset-upload
```

## rclone remote

Tạo remote S3-compatible cho R2:

```powershell
rclone config
```

Thông số quan trọng:

- Type: `s3`
- Provider: Cloudflare
- Access key: lấy từ Cloudflare R2 API token
- Secret key: lấy từ Cloudflare R2 API token
- Endpoint: `https://e807dd1d066d407f04a0801053636a3a.r2.cloudflarestorage.com`
- Region/location constraint: để trống nếu rclone không yêu cầu

Ví dụ remote name: `r2`.

## Env cục bộ

Có thể đặt trong `.env.local`:

```dotenv
R2_BUCKET=unlockxiaomi
R2_REMOTE=r2
R2_ASSET_DOMAIN=https://xiaomi.choimaytau.com
R2_RELEASE=20260617-001
R2_PREFIX=xiaomi-webusb/releases/20260617-001
R2_SOURCE_DIR=dist-assets
R2_VERIFY_ORIGIN=https://unlock.choimaytau.com
VITE_ASSET_BASE_URL=https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001
```

Nếu tạo release mới, đổi cả `R2_RELEASE`, `R2_PREFIX`, và `VITE_ASSET_BASE_URL`.

## Upload asset

Dry-run trước:

```powershell
npm run sync:assets:r2:dry-run
```

Upload thật:

```powershell
npm run sync:assets:r2
```

Script dùng `rclone copy`, không dùng delete/sync, để tránh xóa nhầm release đang active.
Script sẽ dừng nếu source còn `keys.json`; chạy lại `npm run build:assets` để tạo layout sạch và giữ key giải mã trong backend-only `PAYMENTS_ASSET_KEYS_PATH`.

Cache policy trong script:

- Binary/image/ELF/MELF: `public, max-age=31536000, immutable`
- JSON/hash/manifest: `no-cache`

## Verify R2

```powershell
npm run verify:assets:r2
```

Script kiểm tra:

- `manifest.json`
- `sha256sums.json`
- `keys.json` phải trả 404 trên release public
- một số file đại diện như ABL/firehose/file lớn
- HTTP 200
- CORS
- `Content-Length`
- app build có chứa đúng `VITE_ASSET_BASE_URL`

Nếu verify báo thiếu `Content-Length`, progress tải trong UI có thể không chính xác.

## CORS R2

Trong Cloudflare Dashboard:

`R2` -> bucket `unlockxiaomi` -> `Settings` -> `CORS Policy` -> `Add`

Policy gợi ý:

```json
[
  {
    "AllowedOrigins": [
      "https://unlock.choimaytau.com",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "ETag", "Accept-Ranges"],
    "MaxAgeSeconds": 86400
  }
]
```

Nếu domain app đổi, thêm domain mới vào `AllowedOrigins`.

## Đổi release asset production

Quy trình an toàn:

```powershell
$env:R2_RELEASE="20260508-001"
$env:R2_PREFIX="xiaomi-webusb/releases/20260508-001"
$env:R2_ASSET_DOMAIN="https://xiaomi.choimaytau.com"
$env:VITE_ASSET_BASE_URL="https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260508-001"

npm run build:assets
npm run sync:assets:r2:dry-run
npm run sync:assets:r2
npm run build
npm run verify:assets:r2
```

Sau đó deploy web theo [DEPLOY.md](DEPLOY.md).

