# Hướng Dẫn Tổng Hợp Q-Flash-Web - Công Cụ Flash Qualcomm Trên Trình Duyệt

## 📋 Phần 1: Giới Thiệu & Yêu Cầu Cơ Bản

### Công Cụ Là Gì?

**Q-Flash-Web** là ứng dụng web cho phép bạn flash firmware, backup partition, và khôi phục thiết bị Qualcomm (Oppo, OnePlus, Realme) trực tiếp từ trình duyệt mà không cần cài đặt phần mềm phức tạp. Sử dụng WebUSB API để giao tiếp với thiết bị qua cáp USB.

### Yêu Cầu Hệ Thống

| Yêu Cầu | Chi Tiết |
|---------|---------|
| **Trình Duyệt** | Chrome 89+, Edge 89+ (HTTPS bắt buộc, localhost được chấp nhận) |
| **Hệ Điều Hành** | Windows 10/11 (macOS/Linux cần cài đặt driver bổ sung) |
| **Cáp USB** | Cáp USB 3.0 hoặc 2.0 chất lượng cao |
| **Kết Nối** | Kết nối trực tiếp với cổng USB (KHÔNG dùng Hub USB) |
| **Driver** | WinUSB Driver cần được cài đặt |
| **Thiết Bị** | Điện thoại Qualcomm: Oppo, OnePlus, Realme chạy chipset hỗ trợ |

---

## 📱 Phần 2: Hướng Dẫn Chi Tiết Từng Bước

### Bước 1: Chuẩn Bị Phần Mềm & Driver

#### 1.1 Tải Xuống Q-FLASH-FORGE
- Đây là công cụ tất cả trong một (All-in-One).
- **Tính năng:** Tích hợp sẵn trình cài đặt **Zadig Drivers** và **ADB/Fastboot**.
- Link tải: (Sử dụng link tải phiên bản mới nhất của Q-FLASH-FORGE)

#### 1.2 Cài Đặt Driver & Môi Trường Bằng Q-FLASH-FORGE

1. Mở **Q-FLASH-FORGE** (Chạy với quyền Administrator).
2. Sử dụng tính năng **Install Drivers / Auto Setup** có sẵn trên giao diện.
3. Công cụ sẽ tự động:
   - Cài đặt driver **WinUSB** cho chế độ EDL (9008).
   - Cài đặt và cấu hình **ADB & Fastboot** vào hệ thống.
4. Sau khi hoàn tất, bạn đã sẵn sàng kết nối thiết bị.

#### 1.3 Kiểm Tra (Khuyên Dùng)
- **Driver:** Mở Device Manager, cắm máy (EDL), kiểm tra mục Ports/USB có "Qualcomm HS-USB QDLoader 9008" (driver là WinUSB).
- **ADB:** Mở CMD, gõ `adb version` để chắc chắn đã nhận lệnh.
- **Trình Duyệt:** Cần Chrome hoặc Edge bản mới nhất.

---

### Bước 2: Chuyển Thiết Bị Vào Chế Độ EDL (9008)

#### Phương Pháp 1: Sử Dụng Nút Phần Cứng

**Cách A: Máy đã tắt nguồn (Standard)**
- Giữ **Volume Up + Volume Down** (2 phím âm lượng) rồi cắm cáp USB vào PC.
- Áp dụng cho đa số thiết bị Oppo, OnePlus, Realme đang hoạt động bình thường.

**Cách B: Máy bị Bootloop, Treo Logo hoặc Hard Brick**
- Giữ đồng thời 3 phím: **Volume Up + Volume Down + Power**.
- Giữ liên tục (khoảng 10-15 giây) cho đến khi máy tắt hẳn và máy tính nhận cổng 9008.
- Thả tay ngay khi thấy Device Manager nhận thiết bị (hoặc nghe âm thanh kết nối USB).

> Lưu ý: Khi vào chế độ EDL, màn hình thiết bị sẽ **đen tuyền** (không hiện logo, không sạc). Hãy dựa vào Device Manager để kiểm tra.

#### Phương Pháp 2: Sử Dụng Lệnh ADB

Yêu cầu: Thiết bị đang bật và đã bật USB Debugging.

```bash
adb devices          # Kiểm tra nhận thiết bị
adb reboot edl      # Chuyển trực tiếp sang EDL mode
```

#### Phương Pháp 3: Sử Dụng Fastboot

```bash
fastboot devices     # Kiểm tra thiết bị ở fastboot
fastboot reboot edl  # Reboot vào EDL
```

#### Phương Pháp 4: Test Point (Nâng Cao)

- Tháo nắp lưng, tìm điểm test point trên mainboard (theo sơ đồ từng máy)
- Dùng nhíp ngắn mạch test point với GND
- Cắm cáp USB vào PC trong khi đang ngắn mạch

> Chỉ nên dùng nếu máy hoàn toàn hard-brick hoặc dovà đã hiểu rõ rủi ro phần cứng.

#### Xác Nhận EDL Thành Công

- Mở **Device Manager** trên Windows
- Tại mục *Ports (COM & LPT)* hoặc *Universal Serial Bus devices*: thấy **Qualcomm HS-USB QDLoader 9008**

Nếu không thấy:
- Kiểm tra lại driver WinUSB
- Đổi cổng USB hoặc cáp
- Thử lại tổ hợp phím

---

### Bước 3: Chuẩn Bị ROM

#### 3.1 Tải Stock ROM

Nên dùng ROM chính thức từ nhà sản xuất hoặc các nguồn uy tín:

- Oppo: trang tải ROM chính thức hoặc các site tổng hợp stock ROM
- OnePlus: OnePlus Community / trang firmware chính thức
- Realme: Realme official / diễn đàn cộng đồng

Lưu ý:
- Kiểm tra đúng **model** (ví dụ: CPH2207, IN2023, RMX****)
- Không dùng ROM của model khác, dễ gây brick.

#### 3.2 Định Dạng ROM

Các dạng file thường gặp:

- **.ozip** (Oppo/Realme)
- **.ofp** (Oppo)
- Bộ file đã giải nén: `boot.img`, `system.img`, `vendor.img`, v.v.

#### 3.3 Chuyển Đổi OZIP Bằng Q-FLASH-FORGE

1. Mở Q-FLASH-FORGE trên Windows
2. Chọn file `.ozip` tương ứng với thiết bị
3. Chọn thư mục output
4. Nhấn **Convert / Start**
5. Sau khi hoàn tất, bạn sẽ có bộ file ROM đã sẵn sàng để flash

---

### Bước 4: Sử Dụng Q-Flash-Web

#### 4.1 Truy Cập Công Cụ

1. Mở Chrome hoặc Edge
2. Truy cập URL của Q-Flash-Web (ví dụ: `https://<domain>`)
3. Đảm bảo site chạy qua HTTPS

#### 4.2 First-Time User Wizard

Khi vào trang Tool lần đầu, một wizard sẽ xuất hiện:

1. **Welcome** – Giới thiệu ngắn gọn về công cụ
2. **Prerequisites** – Liệt kê yêu cầu: trình duyệt, driver, Q-FLASH-FORGE
3. **Device Selection** – Hướng dẫn chọn thiết bị trong dropdown
4. **Connect Device** – Hướng dẫn đưa máy vào EDL
5. **Ready** – Tóm tắt lại và nút "Start Flashing"

Bạn có thể:
- Nhấn **Next/Back** để chuyển bước
- Nhấn **Skip** để bỏ qua
- Tick "Don't show again" để không hiện lại

Ngoài ra có nút **Show Guide** trên header để mở lại wizard bất kỳ lúc nào.

#### 4.3 Chọn Thiết Bị

1. Trong phần **Device selector**, mở dropdown
2. Tìm đúng model hoặc dòng chipset (ví dụ: "OnePlus 12R - SM7675")
3. Khi chọn, Q-Flash-Web sẽ:
   - Map đúng **chipsetFolder**
   - Tự động xây dựng URL để tải firehose (`programmer`, `digest`, `signature`, ...)

#### 4.4 Kết Nối Thiết Bị

1. Đảm bảo thiết bị đang ở **EDL (9008)**
2. Cắm cáp USB vào PC
3. Trên Q-Flash-Web, nhấn **Connect Device** (nếu có nút)
4. Trình duyệt sẽ hiển thị popup WebUSB:
   - Chọn thiết bị Qualcomm
   - Nhấn **Connect / OK**

Nếu kết nối thành công, log sẽ hiển thị thông tin thiết bị hoặc trạng thái kết nối.

#### 4.5 Đọc Bảng Partition (Partition Table)

1. Nhấn nút **Read Partition Table**
2. Chờ công cụ đọc GPT từ thiết bị
3. Danh sách partition sẽ hiển thị (vd: `boot_a`, `system_a`, `vendor_a`, `userdata`, `persist`, ...)

> Gợi ý: Backup những partition quan trọng trước khi flash: `boot_a/b`, `system_a/b`, `vendor_a/b`, `persist`, `modem`, ...

#### 4.6 Backup Partition

1. Trong danh sách partitions, tick chọn những partition cần backup
2. Nhấn **Backup** hoặc **Backup Selected**
3. Chọn thư mục lưu trên PC
4. Đợi quá trình backup hoàn tất; thời gian phụ thuộc dung lượng partition

#### 4.7 Flash ROM

**Cách A – Flash Full ROM (Khuyến Nghị Khi Unbrick):**

1. Nhấn **Add / Load Files**
2. Chọn thư mục ROM đã được chuẩn bị (đã convert nếu cần)
3. Chọn các file cần flash (thường gồm `boot`, `system`, `vendor`, `vbmeta`, v.v.)
4. Xác nhận danh sách
5. Nhấn **Start Flash**
6. Theo dõi tiến độ qua progress bar & log

**Cách B – Flash Từng Partition:**

1. Chọn partition cụ thể từ danh sách (vd: `boot_a`)
2. Nhấn **Flash**, chọn file tương ứng (vd: `boot.img`)
3. Xác nhận và bắt đầu

> Lưu ý: Chỉ flash partition mà bạn hiểu rõ chức năng; flash sai có thể gây brick.

---

## 🔧 Phần 3: Troubleshooting & FAQ

### 1. Lỗi: Device không hiển thị (Device not found / Không hiện 9008)

**Nguyên nhân phổ biến:**
- Chưa vào đúng EDL mode
- Driver chưa cài / cài sai
- Cáp hoặc cổng USB lỗi

**Cách xử lý:**
1. Kiểm tra lại Device Manager:
   - Nếu không thấy Qualcomm HS-USB QDLoader 9008 → chưa vào EDL hoặc driver sai
2. Thử:
   - Đổi cáp USB
   - Đổi cổng USB (ưu tiên cổng ở mainboard, tránh case front)
   - Tắt các USB hub, dùng kết nối trực tiếp
3. Cài lại driver với Zadig như phần 1.2

### 2. Lỗi: Bulk transfer timeout / USB timeout

**Biểu hiện:**
- Log hiển thị thông báo timeout khi ghi dữ liệu
- Flash dừng giữa chừng

**Cách khắc phục:**
- Dùng cáp USB 3.0 nếu có
- Tránh kéo lệch cáp, tránh rung lắc trong quá trình flash
- Thử cổng USB khác, ưu tiên cổng phía sau PC
- Đảm bảo không có phần mềm khác truy cập cùng thiết bị USB

### 3. Lỗi: VIP Authentication Failed (thiết bị Oppo)

**Nguyên nhân:**
- Một số thiết bị Oppo yêu cầu VIP authentication khi flash bằng công cụ chính hãng; nếu dùng file hoặc tool không đúng, sẽ bị chặn.

**Xử lý cơ bản:**
- Dùng đúng stock ROM của region tương ứng
- Hạn chế cross-flash ROM khác vùng
- Thử phiên bản ROM thấp hơn/higher patch khác nhau nếu có

### 4. Lỗi: Failed to claim interface (WebUSB)

**Nguyên nhân:**
- Một process khác đang giữ thiết bị (ADB, tool flash khác, driver cũ)

**Khắc phục:**
1. Đóng tất cả tool có thể dùng USB/ADB
2. Rút cáp, cắm lại
3. Khởi động lại trình duyệt
4. Nếu vẫn lỗi: gỡ driver cũ và cài lại WinUSB qua Zadig

### 5. Soft-brick vs Hard-brick

**Soft-brick:**
- Máy bootloop, kẹt logo, nhưng còn vào được Fastboot hoặc Recovery
- Có thể sửa bằng cách flash lại ROM hoặc wipe data/cache

**Hard-brick:**
- Máy không lên, không vào Fastboot/Recovery, chỉ nhận 9008 hoặc hoàn toàn không nhận
- Cần EDL + flash full ROM; nặng hơn có thể phải can thiệp phần cứng

---

## 📚 Phần 4: Cấu Trúc Guide Page Đề Xuất

Bạn có thể tổ chức trang "Guide" như sau:

```markdown
# 📚 Guide

## Quick Start
1. Cài driver WinUSB bằng Zadig
2. Đưa thiết bị vào EDL mode (9008)
3. Mở Q-Flash-Web → chọn thiết bị → flash ROM

## 🔧 Prerequisites
- Hệ điều hành hỗ trợ
- Trình duyệt (Chrome/Edge)
- Driver WinUSB
- Cáp USB & thiết bị tương thích

## 📥 Installing Drivers
- Download Zadig
- Cài WinUSB cho cổng 9008
- Kiểm tra trong Device Manager

## 📱 Entering EDL Mode
- Hardware buttons cho Oppo/OnePlus/Realme
- Dùng ADB (adb reboot edl)
- Dùng Fastboot (fastboot reboot edl)
- Test point (advanced)

## 🔌 Using Q-Flash Tool
- Kết nối thiết bị
- Đọc partition table
- Backup partitions
- Flash partitions / flash full ROM

## 🛠️ ROM Processing (Q-FLASH-FORGE)
- Giải thích OZIP/OF
- Hướng dẫn convert sang bộ file flashable

## ❓ Troubleshooting
- Device không nhận
- Bulk transfer timeout
- VIP authentication failed
- Session limit

## 💬 FAQ
- Tổng hợp các câu hỏi thường gặp
```

---

## 🛡️ Phần 5: Lưu Ý An Toàn

- Luôn backup dữ liệu quan trọng trước khi flash
- Không rút cáp, tắt PC hoặc tắt máy trong lúc flash
- Đảm bảo sử dụng ROM đúng model
- Cẩn trọng khi flash các partition nhạy cảm (modem, persist, ...)
- Chấp nhận rủi ro mất bảo hành khi unlock bootloader / flash ROM tùy thiết bị

---

## ✅ Kết Luận

File hướng dẫn này có thể dùng trực tiếp như nội dung cho trang Guide, documentation, hoặc README cho người dùng Q-Flash-Web. Bạn có thể chỉnh sửa thêm theo brand voice, thêm screenshot, GIF minh họa và link video để tăng tính trực quan.