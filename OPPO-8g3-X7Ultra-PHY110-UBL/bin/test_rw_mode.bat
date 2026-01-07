@ECHO OFF
set rwmode=unknown& set rwmode_gptmain_mode=
if not "%storage_type%"=="emmc"  echo.^<?xml version="1.0" ?^>^<data^>^<program SECTOR_SIZE_IN_BYTES="4096" filename="tmp.bin" physical_partition_number="0" label="test" start_sector="6" num_partition_sectors="2"/^>^</data^>>cmd.xml
if "%storage_type%"=="emmc"      echo.^<?xml version="1.0" ?^>^<data^>^<program SECTOR_SIZE_IN_BYTES="512"  filename="tmp.bin" physical_partition_number="0" label="test" start_sector="6" num_partition_sectors="2"/^>^</data^>>cmd.xml
fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=cmd.xml --convertprogram2read --mainoutputdir=.\ --skip_configure --showpercentagecomplete --special_rw_mode=oplus_gptbackup --noprompt && set rwmode=oplus_gptbackup&& goto :eof
set rwmode=oplus_gptmain
fh_loader.exe --port=\\.\%port% --memoryname=%storage_type% --sendxml=cmd.xml --convertprogram2read --mainoutputdir=.\ --skip_configure --showpercentagecomplete --special_rw_mode=oplus_gptain    --noprompt && set rwmode_gptmain_mode=34&& goto :eof
set rwmode_gptmain_mode=6&& goto :eof
