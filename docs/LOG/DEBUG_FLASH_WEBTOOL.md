# Debug Flash Q-Flash-Web Tool

## Thông tin Device
- **Model**: Find N2
- **Storage**: Samsung UFS 256GB (`SAMSUNG KLUEG4RHGB-B0E1`)
- **ROM đang flash**: PGU110domestic_11_14.0.0.713CN01_2024102919240220

## Vấn đề gặp phải khi flash bằng OP_Flash_Tool

### 1. GPT bị block
```
ERROR: operation 0 on BackupGPT:5:31 is forbidden on external network
ERROR: operation 0 on PrimaryGPT:3:33 is forbidden on external network
```
**Nguyên nhân**: Device từ chối đọc/ghi GPT trong chế độ bình thường (external network)

### 2. super.img bị bỏ qua
```
WARNING: Bad magic: 0 probably not processing a sparse image
WARNING: Failed to parse sparse file. Skip flashing: super.img
```
**Nguyên nhân**: 
- Tool `fh_loader` expect sparse image nhưng super.img là **RAW format**
- Magic `0x00000000` (RAW) ≠ `0xED26FF3A` (SPARSE)
- Kích thước: 15,328,980,992 bytes (~14.6 GB)

### 3. userdata flash failed
```
ERROR: Cannot get label for start_sector: 3829191
```
**Nguyên nhân**: 
- GPT không được flash thành công
- Device vẫn dùng partition table cũ
- Sector 3829191 không tồn tại theo GPT hiện tại của device

## So sánh Super.img giữa các ROM

| Thuộc tính | PHY110 (512GB) | PGU110 (256GB) |
|------------|----------------|----------------|
| super.img size | 16,896 MB | 14,619 MB |
| Partition size | 17,716,740,096 | 15,328,980,992 |
| Format | RAW | RAW |

## Thứ tự Flash chuẩn

### Bước 1: Flash BLANK_GPT (xóa partition table cũ)
```xml
rawprogram0_BLANK_GPT.xml (gpt_empty0.bin)
rawprogram1_BLANK_GPT.xml (gpt_empty1.bin)
rawprogram2_BLANK_GPT.xml (gpt_empty2.bin)
rawprogram3_BLANK_GPT.xml (gpt_empty3.bin)
rawprogram4_BLANK_GPT.xml (gpt_empty4.bin)
rawprogram5_BLANK_GPT.xml (gpt_empty5.bin)
```

### Bước 2: Flash rawprogram (partition data + new GPT)
```
rawprogram0.xml → rawprogram5.xml
```

**Files trong rawprogram0.xml:**
- persist.img (32 MB) ✅
- super.img (14.6 GB, RAW) - SKIPPED do tool không hỗ trợ
- vbmeta_system.img ✅
- vbmeta_vendor.img ✅
- metadata.img (16 MB) ✅
- splash.img ✅
- userdata.img (sparse) - FAILED do GPT mismatch
- gpt_main0.bin (primary GPT) - cần flash
- gpt_backup0.bin (backup GPT) - cần flash

### Bước 3: Flash patch files
```
patch0.xml → patch5.xml
```

### Bước 4: Set bootable & reboot
```xml
<setbootablestoragedrive value="1"/>
<power value="reset"/>
```

## Debug Points cho Q-Flash-Web

### 1. Kiểm tra khi flash GPT
- Log `start_sector` và `num_partition_sectors` cho mỗi GPT entry
- Verify data được gửi đúng với file binary
- Check response từ device

### 2. Kiểm tra khi flash super.img (RAW)
- Log kích thước file và định dạng
- Flash theo chunks (1MB mỗi chunk)
- Handle timeout cho file lớn

### 3. Kiểm tra partition label
- Log `label` attribute từ XML
- Verify device có partition với label đó
- Handle case partition không tồn tại

## Các file cần debug

### rawprogram0.xml entries:
| Label | Filename | Start Sector | Size | Notes |
|-------|----------|--------------|------|-------|
| ssd | (empty) | 6 | 8 KB | Skip - no file |
| persist | persist.img | 8 | 32 MB | OK |
| misc | (empty) | 8200 | 1 MB | Skip - no file |
| keystore | (empty) | 8456 | 512 KB | Skip - no file |
| frp | (empty) | 8584 | 512 KB | Skip - no file |
| super | super.img | 8712 | 14.6 GB | RAW format |
| vbmeta_system_a | vbmeta_system.img | 3751139 | 64 KB | OK |
| vbmeta_system_b | (empty) | 3751155 | 64 KB | Skip |
| vbmeta_vendor_a | vbmeta_vendor.img | 3751171 | 64 KB | OK |
| vbmeta_vendor_b | vbmeta_vendor.img | 3751187 | 64 KB | OK |
| metadata | metadata.img | 3751203 | 16 MB | OK |
| rawdump | (empty) | 3755299 | 256 MB | Skip |
| splash_odm | splash.img | 3820835 | 33 MB | OK |
| userdata | userdata.img | 3829191 | varies | Sparse |
| PrimaryGPT | gpt_main0.bin | 0 | 24 KB | GPT |
| BackupGPT | gpt_backup0.bin | END-5 | 20 KB | GPT |

## Lỗi thường gặp và cách xử lý

### "Cannot get label for start_sector: X"
- **Nguyên nhân**: Partition table chưa được cập nhật
- **Fix**: Flash GPT trước, sau đó flash partition

### "operation forbidden on external network"
- **Nguyên nhân**: Device block một số operation trên mạng external
- **Fix**: Cần special mode hoặc signed programmer

### "Bad magic" khi flash super
- **Nguyên nhân**: Tool expect sparse nhưng file là raw
- **Fix**: Stream file trực tiếp, không parse sparse header

## Recommended Flash Order for Q-Flash-Web

1. Configure device
2. Flash GPT (gpt_empty → gpt_main → gpt_backup) per LUN
3. Flash small partitions first (persist, vbmeta, metadata, splash)
4. Flash super.img (large file, stream mode)
5. Flash userdata if needed
6. Apply patches
7. Set bootable storage drive
8. Reboot device
