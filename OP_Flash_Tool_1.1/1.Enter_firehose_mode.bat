@ECHO OFF
set storage_type=ufs
cd /d %~dp0bin

echo. >> ..\debug_log.txt
echo ============================================================================== >> ..\debug_log.txt
echo [%DATE% %TIME%] Starting New Session >> ..\debug_log.txt
echo ============================================================================== >> ..\debug_log.txt

:SETFILEPATH
CLS
TITLE set file path
set "devprg_filepath="
echo. & set /p "devprg_filepath=device programmer file path: "
if "%devprg_filepath%"=="" goto SETFILEPATH
set "digest_filepath="
echo. & set /p "digest_filepath=digest file path: "
if "%digest_filepath%"=="" goto SETFILEPATH
set "sig_filepath="
echo. & set /p "sig_filepath=sig file path: "
if "%sig_filepath%"=="" goto SETFILEPATH

:WAITEDLPORT
echo. & echo.waiting for edl port (9008)... & TITLE waiting for edl port (9008)...
call find_edl_port.bat
echo.device connected: %port%

echo. & echo.send device programmer... & TITLE send device programmer...
echo [LOG] Sending Programmer >> ..\debug_log.txt
QSaharaServer.exe -p \\.\%port% -s 13:"%devprg_filepath%" >> ..\debug_log.txt 2>&1 || goto FAILED

echo. & echo.send digest... & TITLE send digest...
echo [LOG] Sending Digest >> ..\debug_log.txt
fh_loader.exe --port=\\.\%port% --signeddigests="%digest_filepath%" --testvipimpact --noprompt --skip_configure --mainoutputdir=.\ --verbose >> ..\debug_log.txt 2>&1

echo. & echo.send verify command... & TITLE send verify command...
echo [LOG] Sending Verify >> ..\debug_log.txt
echo.^<?xml version="1.0"?^>^<data^>^<verify value="ping" EnableVip="1"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --sendxml=cmd.xml --noprompt --skip_configure --mainoutputdir=.\ --verbose >> ..\debug_log.txt 2>&1 || goto FAILED

echo. & echo.send sig... & TITLE send sig...
echo [LOG] Sending Signature >> ..\debug_log.txt
fh_loader.exe --port=\\.\%port% --signeddigests="%sig_filepath%" --testvipimpact --noprompt --skip_configure --mainoutputdir=.\ --verbose >> ..\debug_log.txt 2>&1 || goto FAILED

echo. & echo.send sha256init command... & TITLE send sha256init command...
echo [LOG] Sending sha256init >> ..\debug_log.txt
echo.^<?xml version="1.0"?^>^<data^>^<sha256init Verbose="1"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --sendxml=cmd.xml --noprompt --skip_configure --mainoutputdir=.\ --verbose >> ..\debug_log.txt 2>&1 || goto FAILED

echo. & echo.configure... & TITLE configure...
echo [LOG] Configuring >> ..\debug_log.txt
call configure.bat >> ..\debug_log.txt 2>&1 || goto FAILED

echo. & echo.all done & TITLE all done & pause>nul & EXIT

:FAILED
echo.failed. disconnect device and press any key to retry... && pause>nul && goto WAITEDLPORT
