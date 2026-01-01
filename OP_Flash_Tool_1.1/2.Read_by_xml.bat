@ECHO OFF
set storage_type=ufs
cd /d %~dp0bin

REM Create log file with timestamp
for /f %%a in ('gettime.exe') do set logtime=%%a
set logfile=..\read_by_xml_log_%logtime%.txt

echo ============================================================================== >> %logfile%
echo [%date% %time%] Starting Read by XML Session >> %logfile%
echo ============================================================================== >> %logfile%

:SETFILEPATH
CLS
TITLE set file path
echo. & echo.now input the xml file path. enter 'y' to confirm, or 'n' to re-enter.
set xml_filepath_all=
:SETFILEPATH-1
set "xml_filepath="
set /p "xml_filepath=xml path/y/n: "
if "%xml_filepath%"=="n" goto SETFILEPATH
if "%xml_filepath%"=="y" goto SETFILEPATH-2
if "%xml_filepath%"=="" goto SETFILEPATH-1
if "%xml_filepath_all%"=="" (set "xml_filepath_all=%xml_filepath%") else (set "xml_filepath_all=%xml_filepath_all%,%xml_filepath%") 
goto SETFILEPATH-1
:SETFILEPATH-2
echo.selected xml: %xml_filepath_all%
echo [LOG] Selected XML: %xml_filepath_all% >> %logfile%

echo.use oplus read/write mode? press Enter or enter 'y' to confirm, or 'n' to decline.
set /p "use_oplus_rw_mode=Enter/y/n: "
echo [LOG] OPLUS RW Mode: %use_oplus_rw_mode% >> %logfile%

echo. & echo.waiting for edl port (9008)... & TITLE waiting for edl port (9008)...
call find_edl_port.bat
echo.device connected: %port%
echo [LOG] Device connected: %port% >> %logfile%

echo. & echo.configure... & TITLE configure...
echo [LOG] Configuring... >> %logfile%
call configure.bat >> %logfile% 2>&1 || goto FAILED

if "%use_oplus_rw_mode%"=="n"     set rwmode=
if not "%use_oplus_rw_mode%"=="n" echo. & echo.test rw mode... & TITLE test rw mode...
if not "%use_oplus_rw_mode%"=="n" call test_rw_mode.bat >> %logfile% 2>&1
if not "%use_oplus_rw_mode%"=="n" echo.rw mode: %rwmode% %rwmode_gptmain_mode%
if not "%use_oplus_rw_mode%"=="n" echo [LOG] RW Mode: %rwmode% %rwmode_gptmain_mode% >> %logfile%

echo. & echo.readback... & TITLE readback...
for /f %%a in ('gettime.exe') do set dirname=readback_xml_%%a
md ..\%dirname%
echo [LOG] Output directory: %dirname% >> %logfile%
echo [LOG] Starting readback... >> %logfile%

if "%use_oplus_rw_mode%"=="n" (
    echo [LOG] Running fh_loader without RW mode >> %logfile%
    echo [LOG] Command: fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=%xml_filepath_all% --convertprogram2read --mainoutputdir=..\%dirname% --skip_configure --showpercentagecomplete --noprompt --verbose >> %logfile%
    fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=%xml_filepath_all% --convertprogram2read --mainoutputdir=..\%dirname% --skip_configure --showpercentagecomplete --noprompt --verbose >> %logfile% 2>&1 || goto FAILED
) else (
    echo [LOG] Running fh_loader with RW mode: %rwmode% >> %logfile%
    echo [LOG] Command: fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=%xml_filepath_all% --convertprogram2read --mainoutputdir=..\%dirname% --skip_configure --showpercentagecomplete --special_rw_mode=%rwmode% --noprompt --verbose >> %logfile%
    fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=%xml_filepath_all% --convertprogram2read --mainoutputdir=..\%dirname% --skip_configure --showpercentagecomplete --special_rw_mode=%rwmode% --noprompt --verbose >> %logfile% 2>&1 || goto FAILED
)

echo [LOG] All done successfully >> %logfile%
echo. & echo.all done & TITLE all done 
echo Log file saved to: %logfile%
pause>nul & EXIT

:FAILED
echo [LOG] FAILED >> %logfile%
echo. & echo.failed. Log file saved to: %logfile%
echo. & echo.press any key to exit... && pause>nul && EXIT
