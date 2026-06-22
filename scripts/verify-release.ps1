[CmdletBinding()]
param(
  [string]$AssetBaseUrl = "https://xiaomi.choimaytau.com/xiaomi-webusb/releases/20260617-001"
)

$ErrorActionPreference = "Stop"
$env:VITE_ASSET_BASE_URL = $AssetBaseUrl

function Invoke-Npm {
  param([Parameter(Mandatory)][string[]]$Arguments)

  & npm.cmd @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "npm.cmd $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Invoke-Npm @("test")
Invoke-Npm @("run", "build")
Invoke-Npm @("run", "check:csp")
