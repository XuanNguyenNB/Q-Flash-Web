1、退出账号、打开oem
2、执行Enter_firehose_mode.bat
3、进入9008模式
4、执行Read_by_xml.bat 选择img里面的main.xml 回车后输入y 回车 此步骤生成的文件夹为备份分区保存好
5、执行Write_by_xml.bat   选择img里面的main.xml 回车后输入y 回车
6、执行reboot.bat
7、bin\platform-tools目录执行 fastboot reboot bootloader
8、bin\platform-tools目录执行 fastboot flashing unlock
9、img里面的main.xml复制到生成的备份文件夹里面
10、进入9008
11、执行Enter_firehose_mode.bat
12、执行Write_by_xml.bat   生成的备份文件夹里面的main.xml 回车后输入y 回车
13、执行reboot.bat
14、开机、如果重启到rec就格式化一下


