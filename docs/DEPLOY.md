# Deploy VPS

Tài liệu này mô tả cách deploy web app static lên VPS production.

## Production hiện tại

- URL: `https://unlock.choimaytau.com`
- SSH target: `ubuntu@43.134.51.214`
- SSH key cục bộ: `C:\Users\nguye\Downloads\VPS.pem`
- Remote root: `/var/www/unlock.choimaytau.com/app`
- Release layout:
  - `/var/www/unlock.choimaytau.com/app/releases/<release-id>`
  - `/var/www/unlock.choimaytau.com/app/current -> releases/<release-id>`

Nginx phục vụ thư mục `current`. Deploy chỉ thay symlink sau khi upload/extract xong.

## Chuẩn bị trước deploy

Từ workspace:

```powershell
cd C:\Users\nguye\Downloads\unlock-15ultra\webusb-xiaomi-unlock
```

Nếu production dùng asset R2, set đúng asset base trước khi build:

```powershell
$env:VITE_ASSET_BASE_URL="https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001"
```

Chạy kiểm tra:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1
```

Nếu cần deploy nhanh khi đã test ở bước trước, tối thiểu vẫn chạy:

```powershell
npm run build
```

## Deploy chuẩn

Ưu tiên chạy script đã có readiness gate:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

Mặc định script sẽ dừng trước build/upload nếu thiếu một trong ba điều kiện production:

- `qflash-payments.service`
- `/etc/qflash-payments.env` có các biến bắt buộc
- Nginx có `location /api/`

Sau deploy, script yêu cầu `https://unlock.choimaytau.com/api/health` trả JSON có `ok=true`.

Nếu backend chưa được provision trên VPS, chuẩn bị file env riêng không commit, ví dụ `.env.production.local`, có real `PAYMENTS_ADMIN_TOKEN`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, và `PAYOS_CHECKSUM_KEY`. Sau đó chạy helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\provision-payments-vps.ps1 -EnvPath .\.env.production.local
```

Helper này ghi `/etc/qflash-payments.env`, upload backend asset key file, tạo `qflash-payments.service`, và thêm Nginx `/api` proxy. Dùng `-CheckOnly` để chỉ kiểm tra readiness mà không upload hay sửa VPS:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\provision-payments-vps.ps1 -EnvPath .\.env.production.local -CheckOnly
```

Chỉ dùng frontend-only khi đã chủ động chấp nhận payment API chưa hoạt động:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -AllowStaticOnly
```

Khối PowerShell thủ công bên dưới chỉ dành cho rollback/khôi phục static:

```powershell
$ErrorActionPreference = 'Stop'

$release = (Get-Date -Format 'yyyyMMdd_HHmmss') + '_manual_deploy'
$key = 'C:\Users\nguye\Downloads\VPS.pem'
$hostTarget = 'ubuntu@43.134.51.214'
$remoteRoot = '/var/www/unlock.choimaytau.com/app'
$archive = Join-Path $env:TEMP "unlock-webusb-$release.tgz"

if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}

tar -C dist -czf $archive .

ssh -i $key -o BatchMode=yes $hostTarget "set -e; sudo mkdir -p '$remoteRoot/releases/$release'; sudo chown ubuntu:ubuntu '$remoteRoot/releases/$release'"

scp -i $key -q $archive "${hostTarget}:/tmp/unlock-webusb-$release.tgz"

ssh -i $key -o BatchMode=yes $hostTarget "set -e; tar -xzf '/tmp/unlock-webusb-$release.tgz' -C '$remoteRoot/releases/$release'; sudo chown -R www-data:www-data '$remoteRoot/releases/$release'; sudo ln -sfn 'releases/$release' '$remoteRoot/current'; sudo nginx -t; sudo systemctl reload nginx; rm -f '/tmp/unlock-webusb-$release.tgz'; readlink -f '$remoteRoot/current'"

Remove-Item -LiteralPath $archive -Force
```

Kết quả mong đợi:

- `nginx: configuration file ... test is successful`
- Dòng cuối in ra release mới, ví dụ `/var/www/unlock.choimaytau.com/app/releases/20260508_143911_manual_deploy`

## Verify sau deploy

```powershell
$response = Invoke-WebRequest -Uri 'https://unlock.choimaytau.com/' -UseBasicParsing -Headers @{ 'Cache-Control'='no-cache' }
$response.StatusCode
($response.Content | Select-String -Pattern 'index-[^"'']+' -AllMatches).Matches.Value | Sort-Object -Unique
```

Kết quả mong đợi:

- `StatusCode` là `200`.
- Bundle JS/CSS khớp file vừa build trong `dist/assets/`.

Kiểm tra nhanh file build local:

```powershell
Get-ChildItem dist\assets
```

Người dùng nên `Ctrl+F5` sau deploy để tránh cache browser.

## Rollback

Liệt kê release trên VPS:

```powershell
$key = 'C:\Users\nguye\Downloads\VPS.pem'
$hostTarget = 'ubuntu@43.134.51.214'
$remoteRoot = '/var/www/unlock.choimaytau.com/app'

ssh -i $key -o BatchMode=yes $hostTarget "ls -1dt '$remoteRoot/releases/'* | head -20"
```

Rollback sang release cũ:

```powershell
$key = 'C:\Users\nguye\Downloads\VPS.pem'
$hostTarget = 'ubuntu@43.134.51.214'
$remoteRoot = '/var/www/unlock.choimaytau.com/app'
$release = 'PASTE_RELEASE_DIRECTORY_NAME_HERE'

ssh -i $key -o BatchMode=yes $hostTarget "set -e; test -d '$remoteRoot/releases/$release'; sudo ln -sfn 'releases/$release' '$remoteRoot/current'; sudo nginx -t; sudo systemctl reload nginx; readlink -f '$remoteRoot/current'"
```

## Lưu ý

- Deploy web không upload `dist-assets/`; app production đang trỏ asset sang R2.
- Paid flow cần backend Node/Express, systemd service, SQLite backup và Nginx `/api` proxy; xem [PAYMENTS.md](PAYMENTS.md) trước khi deploy bản có thanh toán.
- Nếu đổi release R2 thì phải build web lại với `VITE_ASSET_BASE_URL` mới rồi deploy.
- Không dùng `git reset --hard` hoặc xóa release cũ khi không được yêu cầu.
- Không ghi credential R2/S3 vào tài liệu hay commit.

