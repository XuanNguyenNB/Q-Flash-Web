[CmdletBinding()]
param(
  [string]$EnvPath = ".env.local"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw "$EnvPath not found. Run scripts/setup-payos-local.ps1 first."
}

foreach ($line in Get-Content -LiteralPath $EnvPath) {
  if ($line -match '^\s*#' -or $line -match '^\s*$') {
    continue
  }
  if ($line -match '^([^=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2], "Process")
  }
}

npm.cmd run server:dev
