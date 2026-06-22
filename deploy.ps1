<#
.SYNOPSIS
  Build and deploy Q-Flash-Web to the VPS over SSH.

.DESCRIPTION
  - Uses a dedicated known_hosts file with accept-new on first contact.
  - Verifies the uploaded archive SHA-256 before switching the release symlink.
  - Packages the static frontend plus compiled payment backend.
  - Installs production npm dependencies on the remote release before activation.
  - Parameters are overridable through QFLASH_DEPLOY_* environment variables.
#>
[CmdletBinding()]
param(
  [string]$AssetBaseUrl = $(if ($env:QFLASH_DEPLOY_ASSET_URL) { $env:QFLASH_DEPLOY_ASSET_URL } else { "https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001" }),
  [string]$KeyPath      = $(if ($env:QFLASH_DEPLOY_KEY) { $env:QFLASH_DEPLOY_KEY } else { "C:\Users\XuanNguyen\Downloads\VPS.pem" }),
  [string]$HostTarget   = $(if ($env:QFLASH_DEPLOY_HOST) { $env:QFLASH_DEPLOY_HOST } else { "ubuntu@43.134.51.214" }),
  [string]$RemoteRoot   = $(if ($env:QFLASH_DEPLOY_ROOT) { $env:QFLASH_DEPLOY_ROOT } else { "/var/www/unlock.choimaytau.com/app" }),
  [string]$PublicUrl    = $(if ($env:QFLASH_DEPLOY_PUBLIC_URL) { $env:QFLASH_DEPLOY_PUBLIC_URL } else { "https://unlock.choimaytau.com" }),
  [string]$KnownHosts   = $(if ($env:QFLASH_DEPLOY_KNOWN_HOSTS) { $env:QFLASH_DEPLOY_KNOWN_HOSTS } else { Join-Path $env:USERPROFILE ".ssh\known_hosts_qflash" }),
  [switch]$AllowStaticOnly
)

$ErrorActionPreference = 'Stop'

Set-Location -LiteralPath "C:\Users\XuanNguyen\Documents\Q-Flash-Web"
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

$allowStaticOnlyEffective =
  $AllowStaticOnly.IsPresent -or
  ($env:QFLASH_DEPLOY_ALLOW_STATIC_ONLY -match '^(1|true|yes)$')

$remoteReadinessCommand = @'
set -e
service_ready=0
env_ready=0
nginx_ready=0

if systemctl list-unit-files qflash-payments.service --no-legend 2>/dev/null | grep -q qflash-payments; then
  service_ready=1
fi

if sudo test -s /etc/qflash-payments.env; then
  env_ready=1
  for key in PAYMENTS_PROVIDER PAYMENTS_ADMIN_TOKEN PAYMENTS_ASSET_KEYS_PATH; do
    if ! sudo grep -Eq "^${key}=.+" /etc/qflash-payments.env; then
      env_ready=0
    fi
  done

  provider=$(sudo grep -E '^PAYMENTS_PROVIDER=' /etc/qflash-payments.env | head -n 1 | cut -d= -f2-)
  if [ "$provider" = "payos" ]; then
    for key in PAYOS_CLIENT_ID PAYOS_API_KEY PAYOS_CHECKSUM_KEY; do
      if ! sudo grep -Eq "^${key}=.+" /etc/qflash-payments.env; then
        env_ready=0
      fi
    done
  fi
fi

if sudo nginx -T 2>/dev/null | grep -Eq 'location[[:space:]]+/api/?[[:space:]]*\{'; then
  nginx_ready=1
fi

printf 'service=%s\nenv=%s\nnginx=%s\n' "$service_ready" "$env_ready" "$nginx_ready"
'@

$remoteReadinessText = ssh @sshOpts -o BatchMode=yes $HostTarget $remoteReadinessCommand
$remoteReadiness = ConvertFrom-StringData (($remoteReadinessText | Out-String).Trim())
$paymentsReady =
  $remoteReadiness.service -eq '1' -and
  $remoteReadiness.env -eq '1' -and
  $remoteReadiness.nginx -eq '1'

if (-not $paymentsReady -and -not $allowStaticOnlyEffective) {
  throw @"
Production payment backend is not ready; deploy stopped before build/upload.
Required: qflash-payments.service, populated /etc/qflash-payments.env, and Nginx location /api/.
Detected: service=$($remoteReadiness.service), env=$($remoteReadiness.env), nginx=$($remoteReadiness.nginx).
Provision production secrets outside git, or pass -AllowStaticOnly only for an intentional frontend-only release.
"@
}

if (-not $paymentsReady) {
  Write-Warning "Static-only deploy explicitly allowed; paid unlock API will remain unavailable."
}

npm.cmd run build

$release = (Get-Date -Format 'yyyyMMdd_HHmmss') + '_manual_deploy'
$archive = Join-Path $env:TEMP "unlock-webusb-$release.tgz"
$stage = Join-Path $env:TEMP "unlock-webusb-$release-stage"
$repoRoot = (Get-Location).Path

if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}
if (Test-Path -LiteralPath $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}

New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item -Path (Join-Path $repoRoot 'dist\*') -Destination $stage -Recurse
New-Item -ItemType Directory -Path (Join-Path $stage 'server\dist') -Force | Out-Null
Copy-Item -Path (Join-Path $repoRoot 'server\dist\*') -Destination (Join-Path $stage 'server\dist') -Recurse
Copy-Item -LiteralPath (Join-Path $repoRoot 'package.json') -Destination $stage
Copy-Item -LiteralPath (Join-Path $repoRoot 'package-lock.json') -Destination $stage

tar -C $stage -czf $archive .
Remove-Item -LiteralPath $stage -Recurse -Force

$localHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLower()
Write-Host "Local archive SHA-256: $localHash" -ForegroundColor DarkGray

ssh @sshOpts -o BatchMode=yes $HostTarget "set -e; sudo mkdir -p '$RemoteRoot/releases/$release'; sudo chown ubuntu:ubuntu '$RemoteRoot/releases/$release'"

scp @sshOpts -q $archive "${HostTarget}:/tmp/unlock-webusb-$release.tgz"

$remoteHashCommand = "sha256sum '/tmp/unlock-webusb-$release.tgz' | cut -d ' ' -f 1"
$remoteHash = ssh @sshOpts -o BatchMode=yes $HostTarget $remoteHashCommand
$remoteHash = ($remoteHash | Out-String).Trim().ToLower()
Write-Host "Remote archive SHA-256: $remoteHash" -ForegroundColor DarkGray

if ($remoteHash -ne $localHash) {
  ssh @sshOpts -o BatchMode=yes $HostTarget "rm -f '/tmp/unlock-webusb-$release.tgz'"
  Remove-Item -LiteralPath $archive -Force
  throw "SHA-256 mismatch after upload - local=$localHash remote=$remoteHash. Aborting before symlink swap."
}

$remoteInstall = @"
set -e
tar -xzf '/tmp/unlock-webusb-$release.tgz' -C '$RemoteRoot/releases/$release'
cd '$RemoteRoot/releases/$release'
npm ci --omit=dev
sudo chown -R www-data:www-data '$RemoteRoot/releases/$release'
sudo ln -sfn 'releases/$release' '$RemoteRoot/current'
sudo nginx -t
if systemctl list-unit-files qflash-payments.service --no-legend 2>/dev/null | grep -q qflash-payments; then
  sudo systemctl restart qflash-payments
else
  echo 'qflash-payments.service not installed; backend will not serve /api until systemd is configured.'
fi
sudo systemctl reload nginx
rm -f '/tmp/unlock-webusb-$release.tgz'
readlink -f '$RemoteRoot/current'
"@

ssh @sshOpts -o BatchMode=yes $HostTarget $remoteInstall

Remove-Item -LiteralPath $archive -Force

if (-not $allowStaticOnlyEffective) {
  $healthUrl = $PublicUrl.TrimEnd('/') + '/api/health'
  $healthResponse = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -Headers @{ 'Cache-Control' = 'no-cache' }
  $healthContentType = [string]$healthResponse.Headers['Content-Type']

  if ($healthResponse.StatusCode -ne 200 -or $healthContentType -notmatch 'application/json') {
    throw "Production payment health check failed: status=$($healthResponse.StatusCode), content-type=$healthContentType, url=$healthUrl"
  }

  $healthBody = $healthResponse.Content | ConvertFrom-Json
  if ($healthBody.ok -ne $true) {
    throw "Production payment health check returned JSON without ok=true: $healthUrl"
  }
}

Write-Host "Deploy complete!" -ForegroundColor Green
