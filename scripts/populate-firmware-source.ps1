#Requires -Version 5.1
<#
.SYNOPSIS
  Populate firmware-source/ from external roots into the canonical layout.

.DESCRIPTION
  Copies firmware binaries from various local roots (jiangli_firmware, ReverseMT,
  downgrade-abl, auto-unlock-standalone, etc.) into firmware-source/<chip>/<slug>/.
  Reports missing files but does not fail-fast — user can copy manually.

.PARAMETER Force
  Overwrite existing files in firmware-source/ even if present.
#>
[CmdletBinding()]
param(
  [switch]$Force,
  [switch]$SkipHashCheck
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FirmwareSource = Join-Path $ProjectRoot 'firmware-source'
$ExpectedHashesPath = Join-Path $PSScriptRoot 'firmware-source.expected.json'

$script:ExpectedHashes = @{}
if ((Test-Path $ExpectedHashesPath) -and -not $SkipHashCheck) {
  try {
    $raw = Get-Content -LiteralPath $ExpectedHashesPath -Raw -Encoding UTF8
    $obj = $raw | ConvertFrom-Json
    foreach ($prop in $obj.PSObject.Properties) {
      $script:ExpectedHashes[$prop.Name] = $prop.Value.ToLower()
    }
    Write-Host "Loaded $($script:ExpectedHashes.Count) expected SHA-256 hashes from firmware-source.expected.json" -ForegroundColor DarkGray
  } catch {
    Write-Host "Failed to parse $ExpectedHashesPath — $_" -ForegroundColor Red
    exit 1
  }
} elseif (-not $SkipHashCheck) {
  Write-Host "No firmware-source.expected.json found — running without provenance check (use scripts/hash-firmware-source.ps1 to generate one)." -ForegroundColor Yellow
}

# External roots — adjust if your layout differs.
$Roots = @{
  Jiangli   = 'C:\Users\XuanNguyen\Downloads\Unpack\jiangli_firmware'
  ReverseMt = 'C:\Users\XuanNguyen\Downloads\ReverseMT\extracted\res_extracted\Xiaomi'
  Abl       = 'C:\Users\XuanNguyen\Documents\8G3_Xiaomi_Unlock_Bootloader\extracted\downgrade-abl'
  Generic   = 'C:\Users\XuanNguyen\Documents\auto-unlock-standalone\assets'
  Firehose  = 'C:\Users\XuanNguyen\Documents\Unlock_Xiaomi_15U_C06'
  Efisp     = 'C:\Users\nguye\Documents\Unlock_BL_Xiaomi_17_Series_8E_GEN5'
  Exploits  = 'C:\Users\XuanNguyen\Documents\8G3_Xiaomi_Unlock_Bootloader\extracted\bin'
}

$script:Missing = @()
$script:Copied = 0
$script:Skipped = 0

function Copy-Asset {
  param(
    [Parameter(Mandatory)] [string]$Source,
    [Parameter(Mandatory)] [string]$Dest,
    [Parameter(Mandatory)] [string]$Label
  )

  if (-not (Test-Path $Source)) {
    $script:Missing += "$Label — $Source"
    return
  }

  if ((Test-Path $Dest) -and -not $Force) {
    $script:Skipped += 1
    return
  }

  $destDir = Split-Path -Parent $Dest
  if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }

  Copy-Item -Path $Source -Destination $Dest -Force
  $script:Copied += 1
  Write-Host "  + $Label" -ForegroundColor DarkGray

  if ($script:ExpectedHashes.Count -gt 0) {
    $relative = ($Dest.Substring($FirmwareSource.Length).TrimStart('\','/')) -replace '\\','/'
    $expected = $script:ExpectedHashes[$relative]
    if ($expected) {
      $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Dest).Hash.ToLower()
      if ($actual -ne $expected) {
        $script:Missing += "hash-mismatch:$relative (expected $expected, got $actual)"
        Write-Host "    ! SHA-256 mismatch for $relative" -ForegroundColor Red
      }
    } else {
      Write-Host "    ? No expected SHA-256 entry for $relative" -ForegroundColor DarkYellow
    }
  }
}

function Copy-PerDevice {
  param(
    [string]$Chip,        # 8G2, 8G3, 8SG3, 8SG4
    [string]$Slug,        # xiaomi13, redmi-k70, etc.
    [string]$AblSrc,      # downgrade-abl basename or full path
    [string]$PayloadSrc,  # full path
    [string]$FinalGptSrc  # full path
  )
  $destBase = Join-Path $FirmwareSource "$Chip\$Slug"
  Copy-Asset -Source $AblSrc -Dest (Join-Path $destBase 'abl.elf') -Label "$Chip/$Slug/abl.elf"
  Copy-Asset -Source $PayloadSrc -Dest (Join-Path $destBase 'payload.bin') -Label "$Chip/$Slug/payload.bin"
  Copy-Asset -Source $FinalGptSrc -Dest (Join-Path $destBase 'final_gpt.bin') -Label "$Chip/$Slug/final_gpt.bin"
}

Write-Host "Populating firmware-source/ ..." -ForegroundColor Cyan
Write-Host "  Project root: $ProjectRoot"
Write-Host "  Target:       $FirmwareSource"
Write-Host ""

# ── 8E (SM8750) — 6 model ─────────────────────────────────────────────────────
Write-Host "8E (SM8750):" -ForegroundColor Yellow
Copy-Asset -Source (Join-Path $Roots.ReverseMt '8E\boot.img') `
           -Dest   (Join-Path $FirmwareSource '8E\ennea.img') `
           -Label  '8E/ennea.img'

$Map8E = @(
  @{ Slug='xiaomi15';      Folder='15';       Abl='abl_dada.elf';     Final='mi15_gpt_both4.bin' }
  @{ Slug='xiaomi15pro';   Folder='15pro';    Abl='abl_haotian.elf';  Final='mi15pro_gpt_both4.bin' }
  @{ Slug='xiaomi15ultra'; Folder='15u';      Abl='abl_xuanyuan.elf'; Final='mi15u_gpt_both4.bin' }
  @{ Slug='redmi-k80pro';  Folder='k80pro';   Abl='abl_miro.elf';     Final='k80pro_gpt_both4.bin' }
  @{ Slug='redmi-k90';     Folder='k90';      Abl='abl_annibale.elf'; Final='k90_gpt_both4.bin' }
  @{ Slug='xiaomi-pad8pro';Folder='pad8pro';  Abl='abl_piano.elf';    Final='pad8pro_gpt_both4.bin' }
)
foreach ($m in $Map8E) {
  $src = Join-Path $Roots.ReverseMt "8E\$($m.Folder)"
  Copy-PerDevice -Chip '8E' -Slug $m.Slug `
    -AblSrc      (Join-Path $src $m.Abl) `
    -PayloadSrc  (Join-Path $src 'gpt_both4.bin') `
    -FinalGptSrc (Join-Path $src $m.Final)
}

# ── 8G2 (SM8550) — 5 model ────────────────────────────────────────────────────
Write-Host "8G2 (SM8550):" -ForegroundColor Yellow
Copy-Asset -Source (Join-Path $Roots.Jiangli 'SM8550_Gen2\8550-Ennea.img') `
           -Dest   (Join-Path $FirmwareSource '8G2\ennea.img') `
           -Label  '8G2/ennea.img'

$Map8G2 = @(
  @{ Slug='xiaomi13';       Abl='mi13.elf';     Suffix='13' }
  @{ Slug='xiaomi13pro';    Abl='mi13p.elf';    Suffix='13p' }
  @{ Slug='xiaomi13ultra';  Abl='mi13u.elf';    Suffix='13u' }
  @{ Slug='redmi-k60pro';   Abl='k60pro.elf';   Suffix='k60p' }
  @{ Slug='xiaomi-pad6spro';Abl='pad6spro.elf'; Suffix='pad6sp' }
)
foreach ($m in $Map8G2) {
  Copy-PerDevice -Chip '8G2' -Slug $m.Slug `
    -AblSrc      (Join-Path $Roots.Abl $m.Abl) `
    -PayloadSrc  (Join-Path $Roots.Jiangli "SM8550_Gen2\unlock_$($m.Suffix).bin") `
    -FinalGptSrc (Join-Path $Roots.Jiangli "SM8550_Gen2\gpt_both4_$($m.Suffix).bin")
}

# ── 8G3 (SM8650) — 8 model (K70 lấy từ ReverseMT) ─────────────────────────────
Write-Host "8G3 (SM8650):" -ForegroundColor Yellow
Copy-Asset -Source (Join-Path $Roots.Jiangli 'SM8650_Gen3\8650-Ennea.img') `
           -Dest   (Join-Path $FirmwareSource '8G3\ennea.img') `
           -Label  '8G3/ennea.img'

$Map8G3Jiangli = @(
  @{ Slug='xiaomi14';       Abl='mi14.elf';      Suffix='14' }
  @{ Slug='xiaomi14pro';    Abl='mi14p.elf';     Suffix='14p' }
  @{ Slug='xiaomi14ultra';  Abl='mi14u.elf';     Suffix='14u' }
  @{ Slug='redmi-k70pro';   Abl='k70pro.elf';    Suffix='k70p' }
  @{ Slug='redmi-k80';      Abl='k80.elf';       Suffix='k80' }
  @{ Slug='xiaomimixfold4'; Abl='mixfold4.elf';  Suffix='fold4' }
  @{ Slug='xiaomimixflip';  Abl='mixflip.elf';   Suffix='flip' }
)
foreach ($m in $Map8G3Jiangli) {
  Copy-PerDevice -Chip '8G3' -Slug $m.Slug `
    -AblSrc      (Join-Path $Roots.Abl $m.Abl) `
    -PayloadSrc  (Join-Path $Roots.Jiangli "SM8650_Gen3\unlock_$($m.Suffix).bin") `
    -FinalGptSrc (Join-Path $Roots.Jiangli "SM8650_Gen3\gpt_both4_$($m.Suffix).bin")
}

# K70 — special source (ReverseMT, same file used for both payload and final GPT)
$K70Src = Join-Path $Roots.ReverseMt '8G2\k70\k70_gpt_both4.bin'
Copy-PerDevice -Chip '8G3' -Slug 'redmi-k70' `
  -AblSrc      (Join-Path $Roots.Abl 'k70.elf') `
  -PayloadSrc  $K70Src `
  -FinalGptSrc $K70Src

# ── 8SG3 (SM8635) — 4 model ───────────────────────────────────────────────────
Write-Host "8SG3 (SM8635):" -ForegroundColor Yellow
Copy-Asset -Source (Join-Path $Roots.Jiangli 'SM8635_SGen3\8635-Ennea.img') `
           -Dest   (Join-Path $FirmwareSource '8SG3\ennea.img') `
           -Label  '8SG3/ennea.img'

$Map8SG3 = @(
  @{ Slug='xiaomi-pad7';    Abl='pad7.elf';    Suffix='pad7' }
  @{ Slug='xiaomi-pad7pro'; Abl='pad7pro.elf'; Suffix='pad7p' }
  @{ Slug='xiaomi-civi4pro';Abl='civi4pro.elf';Suffix='civi4' }
  @{ Slug='redmi-turbo3';   Abl='turbo3.elf';  Suffix='tb3' }
)
foreach ($m in $Map8SG3) {
  Copy-PerDevice -Chip '8SG3' -Slug $m.Slug `
    -AblSrc      (Join-Path $Roots.Abl $m.Abl) `
    -PayloadSrc  (Join-Path $Roots.Jiangli "SM8635_SGen3\unlock_$($m.Suffix).bin") `
    -FinalGptSrc (Join-Path $Roots.Jiangli "SM8635_SGen3\gpt_both4_$($m.Suffix).bin")
}

# ── 8SG4 (SM8735) — 3 model (per-device, từ ReverseMT/8SG4) ───────────────────
Write-Host "8SG4 (SM8735):" -ForegroundColor Yellow
Copy-Asset -Source (Join-Path $Roots.Jiangli 'SM8735_8sGen4\8735-Ennea.img') `
           -Dest   (Join-Path $FirmwareSource '8SG4\ennea.img') `
           -Label  '8SG4/ennea.img'

$Map8SG4 = @(
  @{ Slug='xiaomi-civi5pro';   Folder='civi5pro';         Abl='abl_luming.elf';Final='luming_gpt_both4.bin' }
  @{ Slug='xiaomi-pad8';       Folder='pad8';             Abl='abl_yupei.elf'; Final='yupei_gpt_both4.bin' }
  @{ Slug='redmi-turbo4pro';   Folder='turbo4pro-pocof7'; Abl='abl_onyx.elf';  Final='onyx_gpt_both4.bin' }
)
foreach ($m in $Map8SG4) {
  $src = Join-Path $Roots.ReverseMt "8SG4\$($m.Folder)"
  Copy-PerDevice -Chip '8SG4' -Slug $m.Slug `
    -AblSrc      (Join-Path $src $m.Abl) `
    -PayloadSrc  (Join-Path $src 'gpt_both4.bin') `
    -FinalGptSrc (Join-Path $src $m.Final)
}

# ── Shared ────────────────────────────────────────────────────────────────────
Write-Host "shared/:" -ForegroundColor Yellow
Copy-Asset -Source (Join-Path $Roots.Firehose 'firehose_SM8750.melf') `
           -Dest   (Join-Path $FirmwareSource 'shared\firehose\firehose_SM8750.melf') `
           -Label  'shared/firehose/firehose_SM8750.melf'
Copy-Asset -Source (Join-Path $Roots.Generic 'boot.img') `
           -Dest   (Join-Path $FirmwareSource 'shared\unlock_generic\boot.img') `
           -Label  'shared/unlock_generic/boot.img'
Copy-Asset -Source (Join-Path $Roots.Generic 'gpt_both4.bin') `
           -Dest   (Join-Path $FirmwareSource 'shared\unlock_generic\gpt_both4.bin') `
           -Label  'shared/unlock_generic/gpt_both4.bin'
Copy-Asset -Source (Join-Path $Roots.Efisp 'gbl_efi_unlock.efi') `
           -Dest   (Join-Path $FirmwareSource 'shared\efisp\gbl_efi_unlock.efi') `
           -Label  'shared/efisp/gbl_efi_unlock.efi'

foreach ($exp in @('8g2','8g3','8sg3')) {
  Copy-Asset -Source (Join-Path $Roots.Exploits "$exp\exploit") `
             -Dest   (Join-Path $FirmwareSource "shared\exploits\$exp\exploit") `
             -Label  "shared/exploits/$exp/exploit"
  Copy-Asset -Source (Join-Path $Roots.Exploits "$exp\su") `
             -Dest   (Join-Path $FirmwareSource "shared\exploits\$exp\su") `
             -Label  "shared/exploits/$exp/su"
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Done. Copied: $script:Copied, Skipped (already exists): $script:Skipped, Missing: $($script:Missing.Count)" -ForegroundColor Cyan

if ($script:Missing.Count -gt 0) {
  Write-Host ""
  Write-Host "Missing sources (copy manually or fix root paths in this script):" -ForegroundColor Yellow
  foreach ($m in $script:Missing) {
    Write-Host "  ! $m" -ForegroundColor Red
  }
  exit 1
}

exit 0
