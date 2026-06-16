<#
.SYNOPSIS
  Build và deploy Q-Flash-Web lên VPS qua SSH.

.DESCRIPTION
  - Strict host key check (accept-new lần đầu, sau đó verify chặt).
  - SHA-256 verify archive trước/sau khi upload để chống MITM.
  - Tham số overridable qua $env:QFLASH_DEPLOY_*.

.NOTES
  Lần đầu chạy với host mới, script sẽ tự thêm host key vào known_hosts.
  Để xem host key trước, chạy: ssh-keyscan -H <host>
  Tham khảo nginx headers tại: docs/security/nginx-security-headers.conf
#>
[CmdletBinding()]
param(
  [string]$AssetBaseUrl = ($env:QFLASH_DEPLOY_ASSET_URL ?? "https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260506-001"),
  [string]$KeyPath      = ($env:QFLASH_DEPLOY_KEY      ?? "C:\Users\XuanNguyen\Downloads\VPS.pem"),
  [string]$HostTarget   = ($env:QFLASH_DEPLOY_HOST     ?? "ubuntu@43.134.51.214"),
  [string]$RemoteRoot   = ($env:QFLASH_DEPLOY_ROOT     ?? "/var/www/unlock.choimaytau.com/app"),
  [string]$KnownHosts   = ($env:QFLASH_DEPLOY_KNOWN_HOSTS ?? (Join-Path $env:USERPROFILE ".ssh\known_hosts_qflash"))
)

$ErrorActionPreference = 'Stop'

cd C:\Users\XuanNguyen\Documents\Q-Flash-Web
$env:VITE_ASSET_BASE_URL = $AssetBaseUrl

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "SSH key not found at $KeyPath"
}

$knownHostsDir = Split-Path -Parent $KnownHosts
if ($knownHostsDir -and -not (Test-Path -LiteralPath $knownHostsDir)) {
  New-Item -ItemType Directory -Path $knownHostsDir -Force | Out-Null
}
if (-not (Test-Path -LiteralPath $KnownHosts)) {
  New-Item -ItemType File -Path $KnownHosts -Force | Out-Null
}

$sshOpts = @(
  '-o', "UserKnownHostsFile=$KnownHosts",
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'ConnectTimeout=10',
  '-o', 'ServerAliveInterval=15',
  '-i', $KeyPath
)

npm run build

$release = (Get-Date -Format 'yyyyMMdd_HHmmss') + '_manual_deploy'
$archive = Join-Path $env:TEMP "unlock-webusb-$release.tgz"

if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}

tar -C dist -czf $archive .

$localHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLower()
Write-Host "Local archive SHA-256: $localHash" -ForegroundColor DarkGray

ssh @sshOpts -o BatchMode=yes $HostTarget "set -e; sudo mkdir -p '$RemoteRoot/releases/$release'; sudo chown ubuntu:ubuntu '$RemoteRoot/releases/$release'"

scp @sshOpts -q $archive "${HostTarget}:/tmp/unlock-webusb-$release.tgz"

$remoteHash = ssh @sshOpts -o BatchMode=yes $HostTarget "sha256sum '/tmp/unlock-webusb-$release.tgz' | awk '{print `$1}'"
$remoteHash = ($remoteHash | Out-String).Trim().ToLower()
Write-Host "Remote archive SHA-256: $remoteHash" -ForegroundColor DarkGray

if ($remoteHash -ne $localHash) {
  ssh @sshOpts -o BatchMode=yes $HostTarget "rm -f '/tmp/unlock-webusb-$release.tgz'"
  Remove-Item -LiteralPath $archive -Force
  throw "SHA-256 mismatch after upload — local=$localHash remote=$remoteHash. Aborting before symlink swap."
}

ssh @sshOpts -o BatchMode=yes $HostTarget "set -e; tar -xzf '/tmp/unlock-webusb-$release.tgz' -C '$RemoteRoot/releases/$release'; sudo chown -R www-data:www-data '$RemoteRoot/releases/$release'; sudo ln -sfn 'releases/$release' '$RemoteRoot/current'; sudo nginx -t; sudo systemctl reload nginx; rm -f '/tmp/unlock-webusb-$release.tgz'; readlink -f '$RemoteRoot/current'"

Remove-Item -LiteralPath $archive -Force

Write-Host "Deploy complete!" -ForegroundColor Green
