@echo off
cd bin
call find_edl_port.bat
echo.device connected: %port%
fh_loader.exe --port=\\.\%port% --sendxml=..\res\reboot.xml --noprompt --skip_configure --mainoutputdir=./