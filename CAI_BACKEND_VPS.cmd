@echo off
cd /d "%~dp0"
echo Dang cai backend thanh toan len VPS. Vui long khong dong cua so nay...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\provision-payments-vps.ps1" -EnvPath "%~dp0.env.local"
if errorlevel 1 (
  echo.
  echo CAI DAT THAT BAI. Hay chup man hinh loi va gui cho Codex.
) else (
  echo.
  echo CAI DAT THANH CONG. Backend payOS da duoc ket noi.
)
pause
