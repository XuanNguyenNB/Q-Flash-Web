#Requires -Version 5.1
<#
.SYNOPSIS
  Download MINI ENG ROM archives into the shared local package folder.

.DESCRIPTION
  Reads the GitHub release assets from 18xjul08/xiaomi_eng_rom, downloads each
  archive into the folder used by scripts/build-assets.ts, and verifies the
  GitHub-provided SHA-256 digest before keeping the file.
#>
[CmdletBinding()]
param(
  [string]$Destination = 'C:\Users\XuanNguyen\Downloads\minieng',
  [string]$ReleaseApiUrl = 'https://api.github.com/repos/18xjul08/xiaomi_eng_rom/releases/tags/engrom',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Destination)) {
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}

$headers = @{
  'User-Agent' = 'q-flash-web-assets'
  'Accept' = 'application/vnd.github+json'
}

Write-Host "Reading release: $ReleaseApiUrl" -ForegroundColor Cyan
$release = Invoke-RestMethod -Uri $ReleaseApiUrl -Headers $headers
$assets = @($release.assets)

if ($assets.Count -eq 0) {
  throw "Release has no assets: $ReleaseApiUrl"
}

Write-Host "Destination: $Destination" -ForegroundColor Cyan
Write-Host "Assets:      $($assets.Count)"

$downloaded = 0
$skipped = 0

foreach ($asset in $assets) {
  $target = Join-Path $Destination $asset.name
  $expected = [string]$asset.digest
  $expected = $expected -replace '^sha256:', ''

  if (-not $expected) {
    throw "Asset $($asset.name) does not include a SHA-256 digest."
  }

  if ((Test-Path -LiteralPath $target) -and -not $Force) {
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash.ToLowerInvariant()
    if ($actual -eq $expected.ToLowerInvariant()) {
      Write-Host "  = $($asset.name) already present" -ForegroundColor DarkGray
      $skipped += 1
      continue
    }

    Write-Host "  ! $($asset.name) exists but SHA-256 differs; re-downloading" -ForegroundColor Yellow
  }

  $partial = "$target.partial"
  if (Test-Path -LiteralPath $partial) {
    Remove-Item -LiteralPath $partial -Force
  }

  $sizeMb = [math]::Round(([double]$asset.size) / 1MB, 2)
  Write-Host "  > $($asset.name) ($sizeMb MB)" -ForegroundColor Green
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $partial -Headers $headers -UseBasicParsing

  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $partial).Hash.ToLowerInvariant()
  if ($actual -ne $expected.ToLowerInvariant()) {
    Remove-Item -LiteralPath $partial -Force
    throw "SHA-256 mismatch for $($asset.name): expected $expected, got $actual"
  }

  Move-Item -LiteralPath $partial -Destination $target -Force
  $downloaded += 1
}

Write-Host ""
Write-Host "Done. Downloaded: $downloaded, skipped: $skipped" -ForegroundColor Cyan
