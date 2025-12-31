# PRD: Q-Flash-Web USB/ADB/Fastboot Extension

> **Version:** 1.0  
> **Date:** 2025-12-30  
> **Author:** Product Manager Agent with Nguyen  
> **Status:** Draft  
> **Related:** 
> - [Product Brief](./product-brief-usb-adb-fastboot.md)
> - [Architecture Decision](./architecture-usb-adb-fastboot.md)

---

## 1. Overview

### 1.1 Product Vision

Mở rộng Q-Flash-Web từ **EDL-only tool** thành **Unified Android Device Management Platform** hỗ trợ ba chế độ: **EDL (9008)**, **ADB**, và **Fastboot**. Cho phép kỹ thuật viên và enthusiasts thực hiện toàn bộ workflow sửa chữa/modding thiết bị Android từ một browser interface duy nhất.

### 1.2 Problem Statement

Kỹ thuật viên và ROM modders hiện phải sử dụng nhiều công cụ riêng biệt:
- Q-Flash-Web hoặc QFIL cho EDL mode
- ADB command line cho ADB mode  
- Fastboot command line cho Fastboot mode

Điều này gây ra workflow rời rạc, yêu cầu cài đặt phức tạp, và đường cong học tập cao.

### 1.3 Solution

Tích hợp ADB và Fastboot protocols vào Q-Flash-Web sử dụng WebUSB API, cung cấp:
- **Mode Selector** trên Navigation Bar
- **Function Buttons** cho các lệnh phổ biến
- **Unified Terminal Log** cho tất cả operations
- **Seamless Mode Switching** trong cùng session

---

## 2. Target Users

### 2.1 Primary Personas

#### Persona 1: Kỹ Thuật Viên Sửa Chữa (Technician)

| Attribute | Description |
|-----------|-------------|
| **Role** | Nhân viên cửa hàng sửa chữa điện thoại |
| **Experience** | Trung bình - cao với Android |
| **Daily Tasks** | Flash ROM, unlock bootloader, recovery thiết bị brick |
| **Pain Points** | Cần tool nhanh, ổn định, không setup |
| **Goals** | Hoàn thành sửa chữa nhanh nhất có thể |
| **Quote** | "Khách đang đợi, tôi cần flash xong trong 10 phút" |

#### Persona 2: ROM Enthusiast/Modder

| Attribute | Description |
|-----------|-------------|
| **Role** | Người dùng đam mê custom ROM, root |
| **Experience** | Cao với Android modding |
| **Daily Tasks** | Flash custom ROM, cài Magisk, thử nghiệm |
| **Pain Points** | Nhiều tool riêng lẻ, hay quên command line |
| **Goals** | Có tool all-in-one dễ dùng |
| **Quote** | "Tôi muốn làm mọi thứ từ A-Z trong một app" |

---

## 3. Functional Requirements

### 3.1 Mode Selection (FR-MODE)

#### FR-MODE-001: Mode Selector UI

**Priority:** P0 (Must have)

**Description:** User có thể chọn device mode trước khi kết nối.

**Acceptance Criteria:**
- [ ] Mode selector hiển thị trên Navigation Bar hoặc Header
- [ ] 3 mode options: EDL | ADB | Fastboot
- [ ] Mode đang active có visual indicator (highlight, underline, hoặc background)
- [ ] Click vào mode sẽ chuyển sang trang tương ứng
- [ ] Mode selection được lưu vào localStorage (persist qua sessions)
- [ ] Khi device đã connected, không cho phép đổi mode (disable other options)
- [ ] Tooltip giải thích mỗi mode khi hover

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│  Q-Flash  [EDL ▼] [ADB] [Fastboot]  | Guide | Downloads │
└─────────────────────────────────────────────────────────┘
```

---

### 3.2 ADB Mode Features (FR-ADB)

#### FR-ADB-001: ADB Device Connection

**Priority:** P0

**Description:** User có thể kết nối thiết bị đang ở ADB mode qua WebUSB.

**Acceptance Criteria:**
- [ ] Button "Connect ADB" hiển thị rõ ràng
- [ ] Click button mở WebUSB device picker với filter cho ADB devices
- [ ] Hỗ trợ các VID/PID phổ biến: Google, Qualcomm, OnePlus, OPPO, Xiaomi, Samsung
- [ ] Nếu connection thất bại, hiển thị error message rõ ràng
- [ ] Nếu connection thành công, hiển thị device info
- [ ] Terminal log ghi lại quá trình connection
- [ ] Connection status indicator (Connected/Disconnected)

**Error Messages:**
- "Device not found" → Hướng dẫn enable USB debugging
- "Permission denied" → User cancelled dialog
- "Device in use" → Close other ADB tools

---

#### FR-ADB-002: ADB Device Info Display

**Priority:** P0

**Description:** Sau khi connect, hiển thị thông tin thiết bị.

**Acceptance Criteria:**
- [ ] Hiển thị Device Model (`ro.product.model`)
- [ ] Hiển thị Android Version (`ro.build.version.release`)
- [ ] Hiển thị Build Number (`ro.build.display.id`)
- [ ] Hiển thị Serial Number
- [ ] Hiển thị Manufacturer
- [ ] Hiển thị Device Codename
- [ ] Info panel có styling đẹp, dễ đọc
- [ ] Có button "Refresh" để cập nhật info

**UI Mockup:**
```
┌─────────────────────────────────────┐
│  📱 Device Information              │
├─────────────────────────────────────┤
│  Model:        Pixel 7 Pro          │
│  Android:      14                   │
│  Build:        AP2A.240805.005      │
│  Serial:       XXXXXXXXXXXX         │
│  Manufacturer: Google               │
│  Device:       cheetah              │
└─────────────────────────────────────┘
```

---

#### FR-ADB-003: Reboot to EDL Mode

**Priority:** P0

**Description:** User có thể reboot thiết bị vào EDL mode từ ADB.

**Acceptance Criteria:**
- [ ] Button "Reboot EDL" hoặc "⚡ Reboot EDL" hiển thị rõ
- [ ] Click button gửi lệnh `adb reboot edl`
- [ ] Confirmation dialog trước khi thực hiện (optional: can skip)
- [ ] Terminal log hiển thị "Rebooting to EDL mode..."
- [ ] Sau khi reboot, hiển thị message "Device will restart in EDL mode"
- [ ] Auto disconnect sau khi gửi command
- [ ] Hướng dẫn user chuyển sang EDL tab để connect lại

---

#### FR-ADB-004: Reboot to Bootloader (Fastboot)

**Priority:** P0

**Description:** User có thể reboot thiết bị vào Fastboot mode từ ADB.

**Acceptance Criteria:**
- [ ] Button "Reboot Fastboot" hoặc "🔧 Reboot Bootloader"
- [ ] Click button gửi lệnh `adb reboot bootloader`
- [ ] Terminal log hiển thị quá trình
- [ ] Sau khi reboot, hiển thị message "Device will restart in Fastboot mode"
- [ ] Auto disconnect
- [ ] Hướng dẫn user chuyển sang Fastboot tab

---

#### FR-ADB-005: Reboot to Recovery

**Priority:** P1

**Description:** User có thể reboot thiết bị vào Recovery mode.

**Acceptance Criteria:**
- [ ] Button "Reboot Recovery" hoặc "🔄 Reboot Recovery"
- [ ] Click button gửi lệnh `adb reboot recovery`
- [ ] Terminal log hiển thị quá trình
- [ ] Auto disconnect sau khi gửi command

---

#### FR-ADB-006: Normal Reboot

**Priority:** P1

**Description:** User có thể reboot thiết bị về system bình thường.

**Acceptance Criteria:**
- [ ] Button "Reboot" hoặc "🔄 Reboot System"
- [ ] Click button gửi lệnh `adb reboot`
- [ ] Terminal log hiển thị quá trình
- [ ] Auto disconnect

---

#### FR-ADB-007: Shutdown Device

**Priority:** P2

**Description:** User có thể tắt nguồn thiết bị từ xa.

**Acceptance Criteria:**
- [ ] Button "Power Off" hoặc "⏻ Shutdown"
- [ ] Confirmation dialog bắt buộc trước khi thực hiện
- [ ] Click button gửi lệnh `adb shell reboot -p`
- [ ] Auto disconnect

---

#### FR-ADB-008: ADB Page Layout

**Priority:** P0

**Description:** Trang ADB có layout rõ ràng, dễ sử dụng.

**Acceptance Criteria:**
- [ ] Header với Connect button và connection status
- [ ] Device Info panel bên trái hoặc trên
- [ ] Quick Actions panel với các reboot buttons
- [ ] Terminal log panel ở dưới
- [ ] Responsive trên các kích thước màn hình
- [ ] Dark mode support

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│  [Connect ADB]        Status: 🟢 Connected              │
├─────────────────────────┬───────────────────────────────┤
│  📱 Device Information  │  ⚡ Quick Actions             │
│  ─────────────────────  │  ───────────────────────────  │
│  Model: Pixel 7 Pro     │  [⚡ Reboot EDL]              │
│  Android: 14            │  [🔧 Reboot Fastboot]         │
│  Build: AP2A.240...     │  [🔄 Reboot Recovery]         │
│  Serial: XXXXXXXXX      │  [🔄 Reboot System]           │
│                         │  [⏻ Power Off]                │
├─────────────────────────┴───────────────────────────────┤
│  📋 Terminal Log                          [Copy] [Clear]│
│  ─────────────────────────────────────────────────────  │
│  [11:30:01] Connecting to device...                     │
│  [11:30:02] ✓ Connected to Pixel 7 Pro                  │
│  [11:30:03] Model: Pixel 7 Pro                          │
└─────────────────────────────────────────────────────────┘
```

---

### 3.3 Fastboot Mode Features (FR-FB)

#### FR-FB-001: Fastboot Device Connection

**Priority:** P0

**Description:** User có thể kết nối thiết bị đang ở Fastboot mode.

**Acceptance Criteria:**
- [ ] Button "Connect Fastboot" hiển thị rõ ràng
- [ ] Click button mở WebUSB device picker với filter cho Fastboot devices
- [ ] Hỗ trợ các VID/PID phổ biến
- [ ] Error handling với messages rõ ràng
- [ ] Terminal log ghi lại quá trình
- [ ] Connection status indicator

---

#### FR-FB-002: Fastboot Device Variables Display

**Priority:** P0

**Description:** Sau khi connect, hiển thị device variables.

**Acceptance Criteria:**
- [ ] Hiển thị Product (device codename)
- [ ] Hiển thị Variant
- [ ] Hiển thị Serial Number
- [ ] Hiển thị **Bootloader Status** (Locked/Unlocked) với visual indicator
- [ ] Hiển thị Secure Boot status
- [ ] Hiển thị Current Slot (a/b)
- [ ] Hiển thị Slot Count
- [ ] Hiển thị Battery Level (if available)
- [ ] Button "Refresh" để cập nhật

**UI Mockup:**
```
┌─────────────────────────────────────┐
│  🔧 Device Variables                │
├─────────────────────────────────────┤
│  Product:     cheetah               │
│  Variant:     MP                    │
│  Serial:      XXXXXXXXXXXX          │
│  Bootloader:  🔓 Unlocked           │
│  Secure:      Yes                   │
│  Slot:        a                     │
│  Battery:     85%                   │
└─────────────────────────────────────┘
```

---

#### FR-FB-003: Unlock Bootloader

**Priority:** P0

**Description:** User có thể unlock bootloader từ Fastboot mode.

**Acceptance Criteria:**
- [ ] Button "🔓 Unlock Bootloader" với styling cảnh báo (orange/yellow)
- [ ] **Confirmation dialog bắt buộc** với warning về data loss
- [ ] Dialog text: "⚠️ CẢNH BÁO: Unlock bootloader sẽ xóa toàn bộ dữ liệu trên thiết bị. Bạn phải xác nhận trên màn hình thiết bị."
- [ ] Click confirm gửi lệnh `fastboot flashing unlock`
- [ ] Terminal log hiển thị "Unlocking bootloader... User must confirm on device"
- [ ] Sau khi gửi lệnh, hiển thị hướng dẫn xác nhận trên device
- [ ] Auto refresh device variables sau khi unlock

**Warning Dialog:**
```
┌─────────────────────────────────────────────────────────┐
│  ⚠️ Unlock Bootloader                                   │
├─────────────────────────────────────────────────────────┤
│  WARNING: This will ERASE ALL DATA on your device!      │
│                                                         │
│  • All apps and data will be deleted                    │
│  • Device will factory reset                            │
│  • You must confirm on the device screen                │
│                                                         │
│  Are you sure you want to proceed?                      │
├─────────────────────────────────────────────────────────┤
│                        [Cancel]  [Unlock Bootloader]    │
└─────────────────────────────────────────────────────────┘
```

---

#### FR-FB-004: Lock Bootloader

**Priority:** P0

**Description:** User có thể lock bootloader từ Fastboot mode.

**Acceptance Criteria:**
- [ ] Button "🔒 Lock Bootloader"
- [ ] **Confirmation dialog bắt buộc** với warning
- [ ] Dialog text: "⚠️ CẢNH BÁO: Lock bootloader sẽ xóa toàn bộ dữ liệu và ngăn flash custom ROMs."
- [ ] Click confirm gửi lệnh `fastboot flashing lock`
- [ ] Terminal log hiển thị quá trình
- [ ] Auto refresh device variables sau khi lock

---

#### FR-FB-005: Flash Boot Partition

**Priority:** P1

**Description:** User có thể flash boot.img vào boot partition.

**Acceptance Criteria:**
- [ ] Button "Flash Boot" hoặc file input
- [ ] Click button mở file picker (accept .img files)
- [ ] Sau khi chọn file, hiển thị file name và size
- [ ] Confirmation dialog trước khi flash
- [ ] Progress bar hiển thị tiến trình flash
- [ ] Terminal log hiển thị chi tiết
- [ ] Success/Error notification sau khi hoàn thành

---

#### FR-FB-006: Flash Recovery Partition

**Priority:** P1

**Description:** User có thể flash recovery.img vào recovery partition.

**Acceptance Criteria:**
- [ ] Button "Flash Recovery"
- [ ] Flow tương tự FR-FB-005
- [ ] Gửi lệnh `fastboot flash recovery <file>`

---

#### FR-FB-007: Flash Vbmeta (Disable Verification)

**Priority:** P1

**Description:** User có thể flash vbmeta với disabled verification.

**Acceptance Criteria:**
- [ ] Button "Flash Vbmeta (Disable AVB)"
- [ ] **Extra warning** về security implications
- [ ] Gửi lệnh với flags `--disable-verity --disable-verification`
- [ ] Terminal log hiển thị chi tiết

---

#### FR-FB-008: Erase Partition

**Priority:** P2

**Description:** User có thể xóa một partition.

**Acceptance Criteria:**
- [ ] Dropdown hoặc input để chọn/nhập partition name
- [ ] Common partitions: userdata, cache, metadata
- [ ] **Confirmation dialog bắt buộc**
- [ ] Gửi lệnh `fastboot erase <partition>`
- [ ] Terminal log hiển thị kết quả

---

#### FR-FB-009: Reboot from Fastboot

**Priority:** P1

**Description:** User có thể reboot từ Fastboot mode.

**Acceptance Criteria:**
- [ ] Button "Reboot System" - `fastboot reboot`
- [ ] Button "Reboot Bootloader" - `fastboot reboot-bootloader`
- [ ] Button "Reboot Recovery" - `fastboot reboot-recovery`
- [ ] Auto disconnect sau reboot (trừ reboot-bootloader)

---

#### FR-FB-010: Fastboot Page Layout

**Priority:** P0

**Description:** Trang Fastboot có layout rõ ràng.

**Acceptance Criteria:**
- [ ] Header với Connect button
- [ ] Device Variables panel
- [ ] Bootloader Actions panel (Unlock/Lock)
- [ ] Flash Actions panel (Boot/Recovery/Vbmeta)
- [ ] Reboot Actions panel
- [ ] Terminal log panel

**UI Mockup:**
```
┌─────────────────────────────────────────────────────────┐
│  [Connect Fastboot]        Status: 🟢 Connected         │
├─────────────────────────┬───────────────────────────────┤
│  🔧 Device Variables    │  🔓 Bootloader                │
│  ─────────────────────  │  ───────────────────────────  │
│  Product: cheetah       │  Status: 🔓 Unlocked          │
│  Serial: XXXXXXXXX      │                               │
│  Slot: a                │  [🔓 Unlock]  [🔒 Lock]       │
│  Battery: 85%           │                               │
├─────────────────────────┼───────────────────────────────┤
│  📦 Flash Partitions    │  🔄 Reboot                    │
│  ─────────────────────  │  ───────────────────────────  │
│  [Flash Boot]           │  [Reboot System]              │
│  [Flash Recovery]       │  [Reboot Bootloader]          │
│  [Flash Vbmeta]         │  [Reboot Recovery]            │
│  [Erase Partition ▼]    │                               │
├─────────────────────────┴───────────────────────────────┤
│  📋 Terminal Log                                        │
└─────────────────────────────────────────────────────────┘
```

---

### 3.4 Shared Features (FR-SHARED)

#### FR-SHARED-001: Unified Terminal Log

**Priority:** P0

**Description:** Terminal log panel hiển thị output từ tất cả operations.

**Acceptance Criteria:**
- [ ] Terminal hiển thị ở tất cả mode pages (EDL, ADB, Fastboot)
- [ ] Log entries có timestamp `[HH:mm:ss]`
- [ ] Log levels với color coding:
  - Info: Gray
  - Success: Green
  - Warning: Yellow/Orange
  - Error: Red
- [ ] Auto-scroll xuống dưới khi có log mới
- [ ] Button "Copy Log" để copy toàn bộ log
- [ ] Button "Clear" để xóa log
- [ ] Log không bị mất khi switch giữa tabs/pages

---

#### FR-SHARED-002: i18n Support

**Priority:** P1

**Description:** Tất cả text mới phải hỗ trợ đa ngôn ngữ.

**Acceptance Criteria:**
- [ ] Translations cho English (`en.json`)
- [ ] Translations cho Vietnamese (`vi.json`)
- [ ] Mode labels: "EDL", "ADB", "Fastboot"
- [ ] Button labels
- [ ] Device info labels
- [ ] Error messages
- [ ] Confirmation dialog text

---

#### FR-SHARED-003: Error Handling

**Priority:** P0

**Description:** Xử lý lỗi gracefully với messages rõ ràng.

**Acceptance Criteria:**
- [ ] WebUSB not supported → "Trình duyệt không hỗ trợ WebUSB. Vui lòng sử dụng Chrome hoặc Edge."
- [ ] Device not found → "Không tìm thấy thiết bị. Đảm bảo thiết bị đang ở đúng mode và đã bật USB debugging."
- [ ] Permission denied → "Quyền truy cập bị từ chối. Bạn đã hủy dialog chọn thiết bị."
- [ ] Device in use → "Thiết bị đang được sử dụng bởi ứng dụng khác. Đóng các tool ADB/Fastboot khác."
- [ ] Connection lost → "Mất kết nối với thiết bị."
- [ ] Command failed → Hiển thị error message từ device

---

---

## 4. Non-Functional Requirements

### 4.1 Performance (NFR-PERF)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-001 | ADB connection time | < 3 seconds |
| NFR-PERF-002 | Fastboot connection time | < 2 seconds |
| NFR-PERF-003 | Flash progress update frequency | Every 1% or 1MB |
| NFR-PERF-004 | Terminal log render | No lag with 1000+ entries |

### 4.2 Compatibility (NFR-COMPAT)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-COMPAT-001 | Browser support | Chrome 120+, Edge 120+ |
| NFR-COMPAT-002 | OS support | Windows, macOS, Linux, ChromeOS |
| NFR-COMPAT-003 | ADB device support | Google, Qualcomm, OnePlus, OPPO, Xiaomi, Samsung, HTC, Huawei |
| NFR-COMPAT-004 | Fastboot device support | Same as ADB |

### 4.3 Security (NFR-SEC)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-SEC-001 | HTTPS required | Yes (WebUSB requirement) |
| NFR-SEC-002 | RSA key storage | Browser localStorage only |
| NFR-SEC-003 | Dangerous action confirmation | Required for unlock/lock/erase |
| NFR-SEC-004 | No data transmission | All operations local to browser |

### 4.4 Usability (NFR-UX)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-UX-001 | Time to first action | < 30 seconds from page load |
| NFR-UX-002 | Error recovery | Clear guidance on how to fix |
| NFR-UX-003 | Accessibility | Keyboard navigation, screen reader |
| NFR-UX-004 | Mobile responsive | Usable on tablet screens |

---

## 5. Out of Scope

Các tính năng sau **KHÔNG** nằm trong MVP (Phase 1):

| Feature | Reason | Target Phase |
|---------|--------|--------------|
| Scrcpy/Screen Mirroring | Complex, needs ya-webadb integration | Phase 2 |
| ADB Sideload | Less common use case | Phase 2 |
| ADB Install APK | File management complexity | Phase 2 |
| ADB Push/Pull Files | File management complexity | Phase 2 |
| ADB Shell Interactive | Streaming complexity | Phase 3 |
| ADB Logcat Viewer | Large data streaming | Phase 2 |
| Fastboot OEM Commands | Device-specific | Phase 2 |
| Multi-device Support | UI complexity | Phase 2 |
| ADB over Wi-Fi | Network complexity | Phase 3 |

---

## 6. Success Metrics

### 6.1 MVP Success Criteria (Phase 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mode switching works | 100% | Manual testing |
| ADB connect success rate | > 95% | Testing on 5+ device models |
| Fastboot connect success rate | > 95% | Testing on 5+ device models |
| Reboot commands work | 100% | Each reboot type tested |
| Unlock/Lock works | 100% | Tested on unlockable devices |
| Flash boot/recovery works | 100% | Tested with valid images |
| No regression in EDL mode | 100% | Full EDL regression test |

### 6.2 User Satisfaction Targets

| Metric | Target |
|--------|--------|
| Time to complete unlock bootloader | < 2 minutes |
| Time to flash boot.img | < 1 minute |
| User understands mode switching | First try |

---

## 7. Dependencies

### 7.1 Technical Dependencies

| Dependency | Version | Purpose | Risk |
|------------|---------|---------|------|
| `@anthropic-ai/adb` or `ya-webadb` | Latest | ADB protocol | Medium - may need adaptation |
| `android-fastboot` or `fastboot.js` | Latest | Fastboot protocol | Low - proven library |
| WebUSB API | N/A | Browser USB access | Low - stable API |

### 7.2 Driver Dependencies

| OS | Driver | Required For |
|----|--------|--------------|
| Windows | WinUSB (via Zadig) | All modes |
| macOS | None | Native support |
| Linux | udev rules | ADB/Fastboot |

---

## 8. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Library compatibility issues | Medium | High | Have fallback libraries identified |
| Device-specific VID/PID missing | Medium | Medium | Allow manual VID/PID input |
| RSA key exchange fails | Low | High | Document troubleshooting steps |
| WebUSB browser security changes | Low | High | Monitor Chrome releases |
| User data loss from unlock | N/A | High | Multiple confirmation dialogs |

---

## 9. Timeline

### Phase 1: MVP (3-4 weeks)

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Foundation | Core protocols, stores, hooks |
| Week 2 | UI | Mode selector, ADB page, Fastboot page |
| Week 3 | Polish | Flash features, error handling, testing |
| Week 4 | Buffer | Bug fixes, documentation |

### Phase 2: Enhanced Features (Future)

- Scrcpy screen mirroring
- ADB sideload
- ADB install APK
- Logcat viewer

---

## 10. Appendix

### A. VID/PID Reference

#### ADB Mode Devices
```
Google:     0x18D1:0x4EE0, 0x18D1:0x4EE2, 0x18D1:0x4EE7
Qualcomm:   0x05C6:0x9025
OnePlus:    0x2A70:0x9011
OPPO:       0x22D9:0x2769
Xiaomi:     0x2717:0xFF40
Samsung:    0x04E8:0x6860
HTC:        0x0BB4:0x0C02
Huawei:     0x12D1:0x1038
```

#### Fastboot Mode Devices
```
Google:     0x18D1:0xD00D, 0x18D1:0x4EE0
Qualcomm:   0x05C6:0x9006
OnePlus:    0x2A70:0x9012
OPPO:       0x22D9:0x2D00
Xiaomi:     0x2717:0xFF80
Samsung:    0x04E8:0x6860
HTC:        0x0BB4:0x0C01
Huawei:     0x12D1:0x1050
```

### B. Related Documents

- [Product Brief](./product-brief-usb-adb-fastboot.md)
- [Architecture Decision](./architecture-usb-adb-fastboot.md)
- [Existing Architecture](./architecture.md)
- [UX Design Specification](./ux-design-specification.md)

---

_This PRD was created through collaborative product planning._  
_Date: 2025-12-30_  
_Author: Nguyen & PM Agent_

_Next: Create Epics & Stories to break down implementation tasks._
