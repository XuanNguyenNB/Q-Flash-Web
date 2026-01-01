::call test_rw mode.bat [y n]
::rwmode_gptmain_mode=1: 0-5 common  6 special  7-n common
::rwmode_gptmain_mode=2: 0-33 common  34-n common

@ECHO OFF
setlocal EnableDelayedExpansion

set runfulltest=%1
set rwmode=unknown& set rwmode_gptmain_mode=
if not "%storage_type%"=="emmc" (set secsize=4096) else (set secsize=512)

:: Create log file with timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value ^| find "="') do set datetime=%%I
set logfile=test_rw_mode_log_%datetime:~0,4%.%datetime:~4,2%.%datetime:~6,2%_%datetime:~8,2%.%datetime:~10,2%.%datetime:~12,2%.txt

echo ============================================== > "%logfile%"
echo Test RW Mode Log - %date% %time% >> "%logfile%"
echo ============================================== >> "%logfile%"
echo Port: %port% >> "%logfile%"
echo Storage Type: %storage_type% >> "%logfile%"
echo Sector Size: %secsize% >> "%logfile%"
echo Full Test: %runfulltest% >> "%logfile%"
echo. >> "%logfile%"

goto QUICKTEST

:QUICKTEST
echo [%time%] === QUICK TEST START === >> "%logfile%"

::test oplus_gptbackup
::5-35
set result_5-35=failed
echo [%time%] Testing oplus_gptbackup mode (sectors 5-35)... >> "%logfile%"
echo.^<?xml version="1.0" ?^>^<data^>^<program SECTOR_SIZE_IN_BYTES="%secsize%" filename="tmp.bin" physical_partition_number="0" label="5-35" start_sector="5" num_partition_sectors="31"/^>^</data^>>cmd.xml
echo [%time%] CMD: >> "%logfile%"
type cmd.xml >> "%logfile%"
echo. >> "%logfile%"

fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=cmd.xml --convertprogram2read --mainoutputdir=.\ --skip_configure --showpercentagecomplete --special_rw_mode=oplus_gptbackup --noprompt --verbose >> "%logfile%" 2>&1 && set result_5-35=success&& set rwmode=oplus_gptbackup&& goto QUICKTEST-DONE

echo [%time%] result_5-35: %result_5-35% >> "%logfile%"

::test rwmode_gptmain_mode
set rwmode=oplus_gptmain
::33-35
set result_33-35=failed
echo [%time%] Testing oplus_gptmain mode (sectors 33-35)... >> "%logfile%"
echo.^<?xml version="1.0" ?^>^<data^>^<program SECTOR_SIZE_IN_BYTES="%secsize%" filename="tmp.bin" physical_partition_number="0" label="33-35" start_sector="3" num_partition_sectors="33"/^>^</data^>>cmd.xml
echo [%time%] CMD: >> "%logfile%"
type cmd.xml >> "%logfile%"
echo. >> "%logfile%"

fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=cmd.xml --convertprogram2read --mainoutputdir=.\ --skip_configure --showpercentagecomplete --special_rw_mode=oplus_gptmain --noprompt --verbose >> "%logfile%" 2>&1 && set result_33-35=success&& set rwmode_gptmain_mode=1&& goto QUICKTEST-DONE

echo [%time%] result_33-35: %result_33-35% >> "%logfile%"

if "%rwmode_gptmain_mode%"=="" set rwmode_gptmain_mode=2
goto QUICKTEST-DONE

:QUICKTEST-DONE
echo. & echo.quick test result: %rwmode% %rwmode_gptmain_mode%
echo [%time%] === QUICK TEST DONE === >> "%logfile%"
echo [%time%] Quick Test Result: rwmode=%rwmode% rwmode_gptmain_mode=%rwmode_gptmain_mode% >> "%logfile%"
echo [%time%] result_5-35: %result_5-35% >> "%logfile%"
echo [%time%] result_33-35: %result_33-35% >> "%logfile%"
echo. >> "%logfile%"

if not "%runfulltest%"=="y" goto END
if "%rwmode%"=="oplus_gptbackup" goto END
goto FULLTEST-%rwmode_gptmain_mode%

:FULLTEST-1
echo [%time%] === FULL TEST MODE 1 START === >> "%logfile%"

set result_0-5=failed
echo [%time%] Testing sectors 0-5... >> "%logfile%"
echo.^<?xml version="1.0" ?^>^<data^>^<program SECTOR_SIZE_IN_BYTES="%secsize%" filename="tmp.bin" physical_partition_number="0" label="0-5" start_sector="0" num_partition_sectors="6"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=cmd.xml --convertprogram2read --mainoutputdir=.\ --skip_configure --showpercentagecomplete --special_rw_mode=oplus_gptmain --noprompt --verbose >> "%logfile%" 2>&1 && set result_0-5=success
echo [%time%] result_0-5: %result_0-5% >> "%logfile%"

set result_6=failed
echo [%time%] Testing sector 6... >> "%logfile%"
echo.^<?xml version="1.0" ?^>^<data^>^<program SECTOR_SIZE_IN_BYTES="%secsize%" filename="tmp.bin" physical_partition_number="0" label="6" start_sector="6" num_partition_sectors="1"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=cmd.xml --convertprogram2read --mainoutputdir=.\ --skip_configure --showpercentagecomplete --special_rw_mode=oplus_gptmain --noprompt --verbose >> "%logfile%" 2>&1 && set result_6=success
echo [%time%] result_6: %result_6% >> "%logfile%"

set result_7-4000=failed
echo [%time%] Testing sectors 7-4000... >> "%logfile%"
echo.^<?xml version="1.0" ?^>^<data^>^<program SECTOR_SIZE_IN_BYTES="%secsize%" filename="tmp.bin" physical_partition_number="0" label="7-4000" start_sector="7" num_partition_sectors="3994"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=cmd.xml --convertprogram2read --mainoutputdir=.\ --skip_configure --showpercentagecomplete --special_rw_mode=oplus_gptmain --noprompt --verbose >> "%logfile%" 2>&1 && set result_7-4000=success
echo [%time%] result_7-4000: %result_7-4000% >> "%logfile%"

set rwmode_gptmain_mode=unknown
if "%result_0-5%"=="success" (
    if "%result_6%"=="failed" (
        if "%result_7-4000%"=="success" set rwmode_gptmain_mode=1
    )
)
goto FULLTEST-DONE

:FULLTEST-2
echo [%time%] === FULL TEST MODE 2 START === >> "%logfile%"

set result_0-33=failed
echo [%time%] Testing sectors 0-33... >> "%logfile%"
echo.^<?xml version="1.0" ?^>^<data^>^<program SECTOR_SIZE_IN_BYTES="%secsize%" filename="tmp.bin" physical_partition_number="0" label="0-33" start_sector="0" num_partition_sectors="34"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=cmd.xml --convertprogram2read --mainoutputdir=.\ --skip_configure --showpercentagecomplete --special_rw_mode=oplus_gptmain --noprompt --verbose >> "%logfile%" 2>&1 && set result_0-33=success
echo [%time%] result_0-33: %result_0-33% >> "%logfile%"

set result_34-4000=failed
echo [%time%] Testing sectors 34-4000... >> "%logfile%"
echo.^<?xml version="1.0" ?^>^<data^>^<program SECTOR_SIZE_IN_BYTES="%secsize%" filename="tmp.bin" physical_partition_number="0" label="result_34-4000" start_sector="34" num_partition_sectors="3967"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=cmd.xml --convertprogram2read --mainoutputdir=.\ --skip_configure --showpercentagecomplete --special_rw_mode=oplus_gptmain --noprompt --verbose >> "%logfile%" 2>&1 && set result_34-4000=success
echo [%time%] result_34-4000: %result_34-4000% >> "%logfile%"

if "%result_0-33%"=="success" (
    if "%result_34-4000%"=="success" set rwmode_gptmain_mode=2
)
goto FULLTEST-DONE

:FULLTEST-DONE
echo. & echo.full test result: %rwmode% %rwmode_gptmain_mode%
echo.result_5-35    %result_5-35%
echo.result_33-35   %result_33-35%
echo.result_0-5     %result_0-5%
echo.result_6       %result_6%
echo.result_7-4000  %result_7-4000%
echo.result_0-33    %result_0-33%
echo.result_34-4000 %result_34-4000%

echo [%time%] === FULL TEST DONE === >> "%logfile%"
echo [%time%] Full Test Result: rwmode=%rwmode% rwmode_gptmain_mode=%rwmode_gptmain_mode% >> "%logfile%"
echo [%time%] result_5-35:    %result_5-35% >> "%logfile%"
echo [%time%] result_33-35:   %result_33-35% >> "%logfile%"
echo [%time%] result_0-5:     %result_0-5% >> "%logfile%"
echo [%time%] result_6:       %result_6% >> "%logfile%"
echo [%time%] result_7-4000:  %result_7-4000% >> "%logfile%"
echo [%time%] result_0-33:    %result_0-33% >> "%logfile%"
echo [%time%] result_34-4000: %result_34-4000% >> "%logfile%"
goto END

:END
echo. >> "%logfile%"
echo [%time%] Log saved to: %logfile% >> "%logfile%"
echo Log saved to: %logfile%
endlocal & set rwmode=%rwmode%& set rwmode_gptmain_mode=%rwmode_gptmain_mode%
goto :eof
