#Requires -Version 5.1
<#
.SYNOPSIS
  Generate scripts/firmware-source.expected.json with SHA-256 of every firmware-source/ file.

.DESCRIPTION
  Walk firmware-source/ recursively, hash every regular file via SHA-256,
  emit a JSON map { "<relative posix path>": "<sha256 hex>" } sorted by key.
  Skips README.md and .gitkeep so the map only covers binary firmware payloads.

  Run this once after you trust the contents of firmware-source/. Future runs
  of populate-firmware-source.ps1 verify each copied file against this map.
#>
[CmdletBinding()]
param(
  [string]$OutputPath = (Join-Path $PSScriptRoot 'firmware-source.expected.json')
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FirmwareSource = Join-Path $ProjectRoot 'firmware-source'

if (-not (Test-Path $FirmwareSource)) {
  Write-Host "firmware-source/ not found at $FirmwareSource" -ForegroundColor Red
  exit 1
}

$entries = Get-ChildItem -LiteralPath $FirmwareSource -Recurse -File |
  Where-Object { $_.Name -notin @('README.md', '.gitkeep') }

$map = [ordered]@{}
$count = 0

foreach ($file in $entries | Sort-Object FullName) {
  $relative = ($file.FullName.Substring($FirmwareSource.Length).TrimStart('\', '/')) -replace '\\', '/'
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToLower()
  $map[$relative] = $hash
  $count += 1
  Write-Host "  $relative" -ForegroundColor DarkGray
}

$json = $map | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($OutputPath, "$json`n", [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "Hashed $count files -> $OutputPath" -ForegroundColor Cyan
