@ECHO OFF
setlocal EnableDelayedExpansion

set storage_type=ufs
cd /d %~dp0bin

:: Create log file with timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value ^| find "="') do set datetime=%%I
set logfile=reboot_edl_log_%datetime:~0,4%.%datetime:~4,2%.%datetime:~6,2%_%datetime:~8,2%.%datetime:~10,2%.%datetime:~12,2%.txt

echo ============================================== > "%logfile%"
echo Reboot EDL Log - %date% %time% >> "%logfile%"
echo ============================================== >> "%logfile%"
echo. >> "%logfile%"

echo. & echo.waiting for edl port (9008)... & TITLE waiting for edl port (9008)...
echo [%time%] Waiting for EDL port (9008)... >> "%logfile%"

call find_edl_port.bat
echo.device connected: %port%
echo [%time%] Device connected: %port% >> "%logfile%"

:: Create power reset_to_edl command
echo.^<?xml version="1.0" ?^>^<data^>^<power value="reset_to_edl" /^>^</data^>>.\\cmd.xml
echo [%time%] Command XML created: >> "%logfile%"
type cmd.xml >> "%logfile%"
echo. >> "%logfile%"

:: Execute with verbose logging
echo [%time%] Executing fh_loader... >> "%logfile%"
echo [%time%] Command: fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=.\cmd.xml --mainoutputdir=.\ --skip_configure --noprompt --verbose >> "%logfile%"
echo. >> "%logfile%"

fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=.\cmd.xml --mainoutputdir=.\ --skip_configure --noprompt --verbose >> "%logfile%" 2>&1

if %ERRORLEVEL% NEQ 0 goto FAILED

echo [%time%] SUCCESS! Device rebooting to EDL mode. >> "%logfile%"
echo. & echo.SUCCESS! Device rebooting to EDL mode...
echo Log saved to: %logfile%
EXIT

:FAILED
echo [%time%] FAILED! Error code: %ERRORLEVEL% >> "%logfile%"
echo. & echo.FAILED! Check log: %logfile%
echo. & echo.failed. press any key to exit... && pause>nul && EXIT
