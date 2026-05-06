# Xiaomi WebUSB Unlock

Static Vite + React app for the Xiaomi WebUSB unlock workflow. It uses WebUSB ADB/Fastboot in Chrome/Edge and expects expanded binary assets from a public asset path or same-origin static directory.

## Commands

```bash
npm install
npm test
npm run build
npm run build:assets
npm run sync:assets:r2:dry-run
npm run sync:assets:r2
npm run verify:assets:r2
```

`npm run build:assets` reads the current workspace layout:

- `../Unlock_8E_Xiaomi/Unlock_8E_Xiaomi`
- `../downgrade-abl`
- `../auto-unlock-standalone/assets`
- `C:\Users\nguye\Documents\Unlock_BL_Xiaomi_17_Series_8E_GEN5` for `gbl_efi_unlock.efi`

It writes upload-ready files to `dist-assets/`. The asset builder supports already-extracted packages and matching `.rar` packages when `UnRAR.exe` is available in the unlock asset directory. Override paths when needed:

```bash
npm run build:assets -- --source-root C:\path\Unlock_8E_Xiaomi --abl-root C:\path\downgrade-abl --unlock-root C:\path\unlock-assets --efisp-root C:\path\Unlock_BL_Xiaomi_17_Series_8E_GEN5 --out C:\path\asset-upload
```

## Runtime Env

No environment variable is required for local testing. By default, the app loads assets from:

```bash
/dist-assets
```

If assets are hosted elsewhere, set:

```bash
VITE_ASSET_BASE_URL=https://<public-asset-domain-or-path>
```

The asset host must allow public `GET`, CORS from the app origin when cross-origin, and expose `Content-Length` so progress is accurate. Use short/no-cache for `manifest.json` and `sha256sums.json`, and long immutable cache for binary images.

## Cloudflare R2 Asset Hosting

The browser can load ROM assets directly from a public R2 custom domain. Keep each upload under a release prefix so Cloudflare cache never serves stale files after a ROM/manifest update:

```bash
https://assets.<domain>/xiaomi-webusb/releases/<release-id>
```

Recommended env:

```bash
R2_BUCKET=xiaomi-webusb-assets
R2_REMOTE=r2
R2_ASSET_DOMAIN=https://assets.<domain>
R2_RELEASE=20260506-001
R2_PREFIX=xiaomi-webusb/releases/20260506-001
VITE_ASSET_BASE_URL=https://assets.<domain>/xiaomi-webusb/releases/20260506-001
```

Configure `R2_REMOTE` in rclone as an S3-compatible Cloudflare R2 remote. Store the access key/secret in the rclone config, not in this repo. The remote endpoint should be:

```bash
https://<account_id>.r2.cloudflarestorage.com
```

Release upload flow:

```bash
npm run build:assets
npm run sync:assets:r2:dry-run
npm run sync:assets:r2
VITE_ASSET_BASE_URL=https://assets.<domain>/xiaomi-webusb/releases/20260506-001 npm run build
npm run verify:assets:r2
```

PowerShell example:

```powershell
$env:R2_BUCKET="xiaomi-webusb-assets"
$env:R2_REMOTE="r2"
$env:R2_ASSET_DOMAIN="https://assets.<domain>"
$env:R2_RELEASE="20260506-001"
$env:R2_PREFIX="xiaomi-webusb/releases/20260506-001"
$env:VITE_ASSET_BASE_URL="https://assets.<domain>/xiaomi-webusb/releases/20260506-001"
npm run sync:assets:r2:dry-run
npm run sync:assets:r2
npm run build
npm run verify:assets:r2
```

`sync:assets:r2` uses `rclone copy`, not delete/sync, to avoid removing an active release by mistake. It uploads JSON files with `Cache-Control: no-cache`, and binary ROM/ABL/firehose files with `Cache-Control: public, max-age=31536000, immutable`.

R2 CORS policy for the bucket:

```json
[
  {
    "AllowedOrigins": ["https://<app-domain>", "http://localhost:5173", "http://127.0.0.1:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "ETag", "Accept-Ranges"],
    "MaxAgeSeconds": 86400
  }
]
```

After upload, `npm run verify:assets:r2` fetches the manifest/hash files, checks representative ABL/firehose/ROM objects with `HEAD`, verifies CORS headers, checks `Content-Length`, and confirms the built app contains the configured `VITE_ASSET_BASE_URL`.

## Experimental ADB/Fastboot Flow

The browser does not download or extract `.rar` files. It loads the expanded `dist-assets/` layout from the configured asset base URL or the same-origin default.

The entry step accepts either Android ADB or Fastboot. If the phone starts in Android, the browser connects ADB, reads `ro.product.device`, `ro.product.vendor.device`, and `ro.build.product`, then sends `adb reboot bootloader`. After the phone reaches Fastboot, the user must connect Fastboot and `fastboot getvar product` must exactly match the ADB codename before any asset download or destructive phase is allowed.

The app has two workflow families. `efisp-8e-gen5` supports only Xiaomi 17 (`pudding`), Xiaomi 17 Pro (`pandora`), Xiaomi 17 Pro Max (`popsicle`), Xiaomi 17 Ultra (`nezha`), and Redmi K90 Pro Max / POCO F8 Ultra (`myron`); it prepares only `efisp/gbl_efi_unlock.efi`, boots Android permissive with `fastboot oem set-gpu-preemption-value 0 androidboot.selinux=permissive`, writes EFISP through MQSAS, verifies `unlocked: yes`, then erases `efisp`, `metadata`, and `userdata`.

The legacy `legacy-ftd` family keeps the Mi15/K80/K90/Pad8 flow. After verified product detection, the `prepare-assets` phase downloads and verifies every required file for the locked model: ABL, unlock GPT, unlock boot image, antirollback file, FTD flash-plan images, and final GPT `partition:0..5`. Files are stored in IndexedDB using `baseUrl + path + sha256`.

ADB/Fastboot phases use only prepared cached blobs. If a required asset was not prepared or browser cache storage fails, the workflow stops before destructive commands.

## Deploy

Build with `npm run build` and deploy `dist/` to any static host. Put the generated `dist-assets/` folder at `/dist-assets` on the same origin, or configure `VITE_ASSET_BASE_URL` to the public R2 asset location.
