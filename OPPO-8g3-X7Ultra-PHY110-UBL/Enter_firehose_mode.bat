@ECHO OFF
set storage_type=ufs
cd /d %~dp0bin
goto :main
:FAILED
echo.failed. disconnect device and press any key to retry... && pause>nul && goto WAITEDLPORT
:main
:SETFILEPATH
CLS
TITLE set file path
set devprg_filepath=%~dp0res\OPPO_SM8650_New.melf
set digest_filepath=%~dp0res\OPPO_8Gen3_Digest.elf
set sig_filepath=%~dp0\res\OPPO_8Gen3_Sign.bin


:WAITEDLPORT
echo. & echo.waiting for edl port (9008)... & TITLE waiting for edl port (9008)...
call find_edl_port.bat
echo.device connected: %port%

echo. & echo.send device programmer... & TITLE send device programmer...
QSaharaServer.exe -p \\.\%port% -s 13:"%devprg_filepath%" || goto FAILED

echo. & echo.send digest... & TITLE send digest...
fh_loader.exe --port=\\.\%port% --signeddigests="%digest_filepath%" --testvipimpact --noprompt --skip_configure --mainoutputdir=.\

echo. & echo.send verify command... & TITLE send verify command...
echo.^<?xml version="1.0"?^>^<data^>^<verify value="ping" EnableVip="1"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --sendxml=cmd.xml --noprompt --skip_configure --mainoutputdir=.\ || goto FAILED

echo. & echo.send sig... & TITLE send sig...
fh_loader.exe --port=\\.\%port% --signeddigests="%sig_filepath%" --testvipimpact --noprompt --skip_configure --mainoutputdir=.\ || goto FAILED

echo. & echo.send sha256init command... & TITLE send sha256init command...
echo.^<?xml version="1.0"?^>^<data^>^<sha256init Verbose="1"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --sendxml=cmd.xml --noprompt --skip_configure --mainoutputdir=.\ || goto FAILED

echo. & echo.configure... & TITLE configure...
call configure.bat || goto FAILED


