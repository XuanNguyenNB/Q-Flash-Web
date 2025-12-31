# Product Brief: Q-Flash-Web USB/ADB/Fastboot Extension

**Date:** 2025-12-30  
**Author:** Nguyen & AI Business Analyst  
**Context:** Brownfield Enhancement - Expanding existing EDL tool to multi-mode platform  
**Status:** Draft

---

## Executive Summary

Q-Flash-Web hiện tại là một browser-based Qualcomm EDL Flash Tool mạnh mẽ, chỉ hỗ trợ EDL mode (9008). Dự án mở rộng này sẽ biến Q-Flash-Web thành **Unified Android Device Management Platform** bằng cách thêm hỗ trợ **ADB (Android Debug Bridge)** và **Fastboot** modes.

Với việc tận dụng WebUSB API và các thư viện mã nguồn mở như `ya-webadb` và `fastboot.js`, Q-Flash-Web sẽ trở thành **all-in-one tool** cho kỹ thuật viên và enthusiasts mà không cần cài đặt bất kỳ phần mềm nào trên máy tính.

---

## Core Vision

### Problem Statement

Hiện tại, kỹ thuật viên sửa chữa điện thoại và ROM enthusiasts phải sử dụng **nhiều công cụ riêng biệt** để quản lý thiết bị Android:

1. **EDL Mode:** Q-Flash-Web hoặc QFIL (Windows only)
2. **ADB Mode:** ADB command line hoặc các GUI tools như Minimal ADB
3. **Fastboot Mode:** Fastboot command line hoặc Google Android Flash Tool

Điều này gây ra:
- **Rời rạc workflow:** Phải mở nhiều ứng dụng, chuyển đổi liên tục
- **Yêu cầu cài đặt:** Cần cài ADB/Fastboot drivers, platform-tools
- **Học tập curve cao:** Command line phức tạp cho người mới
- **Platform dependency:** Một số tool chỉ chạy trên Windows

### Problem Impact

| Vấn đề | Ảnh hưởng |
|--------|-----------|
| Workflow rời rạc | Mất 2-5 phút chuyển đổi giữa các tool |
| Cài đặt drivers | 10-30 phút setup cho máy mới |
| Command line | Lỗi gõ sai lệnh, rủi ro brick device |
| Windows-only tools | Không thể làm việc trên Mac/Linux/ChromeOS |

### Proposed Solution

Mở rộng Q-Flash-Web thành **Multi-Mode Android Device Platform** với:

1. **Mode Selector** trên Navigation Bar - Chọn EDL/ADB/Fastboot trước khi kết nối
2. **WebUSB Integration** - Sử dụng `ya-webadb` và `fastboot.js` cho browser-native support
3. **Function Buttons** - Các nút thao tác nhanh cho lệnh phổ biến thay vì free-form terminal
4. **Unified Terminal Log** - Hiển thị kết quả lệnh và quá trình thực hiện
5. **Seamless Mode Switching** - ADB → reboot EDL → Flash → reboot Fastboot trong cùng session

### Key Differentiators

| So với | Q-Flash-Web Advantage |
|--------|----------------------|
| Native ADB/Fastboot | Không cần cài đặt, chạy trên mọi OS có Chrome |
| Minimal ADB & Fastboot | UI hiện đại, không cần command line |
| Google Android Flash Tool | Hỗ trợ EDL mode, nhiều tính năng hơn |
| Odin (Samsung) | Cross-platform, không chỉ Samsung |

---

## Target Users

### Primary Users

**1. Kỹ thuật viên sửa chữa điện thoại (Technicians)**

- **Profile:** Làm việc tại cửa hàng sửa chữa, xử lý 5-20 thiết bị/ngày
- **Pain points:** 
  - Cần tool nhanh, ổn định
  - Khách hàng đợi, không có thời gian debug
  - Máy tính có thể thay đổi (không muốn setup lại)
- **Needs:**
  - Quick unlock bootloader cho flash ROM
  - Reboot modes nhanh (EDL ↔ Fastboot ↔ ADB)
  - Device info để xác định model/chipset
- **Quote:** "Tôi cần flash ROM nhanh nhất có thể, khách đang đợi"

**2. ROM Enthusiasts & Modders**

- **Profile:** Flash custom ROMs, root devices, cài Magisk
- **Pain points:**
  - Nhiều bước thao tác giữa các mode
  - Hay quên lệnh fastboot/adb
  - Muốn try different ROMs
- **Needs:**
  - Unlock/lock bootloader
  - Flash boot/recovery/vbmeta partitions
  - Sideload OTA updates
  - Check device variables
- **Quote:** "Tôi muốn một tool làm được mọi thứ từ A-Z"

### Secondary Users

**3. Developers (Future Phase)**

- Debug apps via ADB
- Install APKs wirelessly
- View logcat in browser
- Screen capture/recording

---

## MVP Scope (Phase 1)

### Core Features

#### F1: Mode Selector UI
- Thêm **Mode Tabs** hoặc **Dropdown** trên Navigation Bar
- 3 modes: **EDL** (hiện tại) | **ADB** | **Fastboot**
- Visual indicator cho mode đang active
- Mode persistence (nhớ lựa chọn cuối)

#### F2: ADB Mode - Core Functions
Sử dụng `ya-webadb` library via WebUSB.

| Function | Button Label | ADB Command | Priority |
|----------|--------------|-------------|----------|
| Connect Device | "Connect ADB" | `adb devices` | P0 |
| Device Info | "Get Info" | `adb shell getprop` | P0 |
| Reboot to EDL | "Reboot EDL" | `adb reboot edl` | P0 |
| Reboot to Bootloader | "Reboot Fastboot" | `adb reboot bootloader` | P0 |
| Reboot to Recovery | "Reboot Recovery" | `adb reboot recovery` | P1 |
| Normal Reboot | "Reboot" | `adb reboot` | P1 |
| Shutdown | "Power Off" | `adb shell reboot -p` | P2 |

**Device Info Panel hiển thị:**
- Device model (`ro.product.model`)
- Android version (`ro.build.version.release`)
- Build number (`ro.build.display.id`)
- Serial number
- Bootloader status

#### F3: Fastboot Mode - Core Functions
Sử dụng `fastboot.js` library via WebUSB.

| Function | Button Label | Fastboot Command | Priority |
|----------|--------------|------------------|----------|
| Connect Device | "Connect Fastboot" | `fastboot devices` | P0 |
| Device Variables | "Get Variables" | `fastboot getvar all` | P0 |
| Unlock Bootloader | "Unlock" | `fastboot flashing unlock` | P0 |
| Lock Bootloader | "Lock" | `fastboot flashing lock` | P0 |
| Reboot System | "Reboot" | `fastboot reboot` | P1 |
| Reboot Bootloader | "Reboot Fastboot" | `fastboot reboot bootloader` | P1 |
| Reboot Recovery | "Reboot Recovery" | `fastboot reboot recovery` | P2 |

**Device Variables Panel hiển thị:**
- `product` - Device codename
- `variant` - Device variant
- `serialno` - Serial number
- `unlocked` - Bootloader unlock status
- `secure` - Secure boot status
- `slot-count` - A/B partition count

#### F4: Fastboot Flash Functions

| Function | Button Label | Fastboot Command | Priority |
|----------|--------------|------------------|----------|
| Flash Boot | "Flash Boot" | `fastboot flash boot` | P1 |
| Flash Recovery | "Flash Recovery" | `fastboot flash recovery` | P1 |
| Flash Vbmeta | "Flash Vbmeta" | `fastboot flash vbmeta --disable-verity` | P1 |
| Erase Partition | "Erase" | `fastboot erase <partition>` | P2 |
| Flash Zip | "Flash Factory Image" | Multiple commands | P2 |

#### F5: Unified Terminal/Log Panel
- Hiển thị output của tất cả commands
- Log level filtering (info, success, warning, error)
- Copy log functionality
- Auto-scroll với manual override
- Timestamps cho mỗi entry

#### F6: Mode-Specific Pages

**ADB Page Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [Connect ADB]  Device: Pixel 7 Pro (Connected)    │
├─────────────────────────────────────────────────────┤
│  Device Info                    │  Quick Actions    │
│  ───────────────               │  ─────────────    │
│  Model: Pixel 7 Pro            │  [Reboot EDL]     │
│  Android: 14                   │  [Reboot Fastboot]│
│  Build: AP2A.240805.005        │  [Reboot Recovery]│
│  Serial: XXXXX                 │  [Reboot]         │
│  Bootloader: Unlocked          │  [Power Off]      │
├─────────────────────────────────────────────────────┤
│  Terminal Log                                       │
│  ───────────────────────────────────────────────   │
│  [12:30:01] Connected to device                    │
│  [12:30:02] Model: Pixel 7 Pro                     │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

**Fastboot Page Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [Connect Fastboot]  Device: cheetah (Connected)   │
├─────────────────────────────────────────────────────┤
│  Device Variables              │  Bootloader       │
│  ───────────────              │  ─────────────    │
│  Product: cheetah             │  [Unlock]         │
│  Variant: MP                  │  [Lock]           │
│  Serial: XXXXX                │                   │
│  Unlocked: yes                │  Reboot           │
│  Secure: yes                  │  ─────────────    │
│  Slot: a                      │  [Reboot System]  │
│                               │  [Reboot Fastboot]│
├───────────────────────────────┴─────────────────────┤
│  Flash Partitions                                   │
│  ─────────────────────────────────────────────────  │
│  [Flash Boot] [Flash Recovery] [Flash Vbmeta]       │
│  [Erase Partition ▼]  [Flash Factory Image]         │
├─────────────────────────────────────────────────────┤
│  Terminal Log                                       │
└─────────────────────────────────────────────────────┘
```

### Out of Scope for MVP (Phase 1)

| Feature | Reason | Target Phase |
|---------|--------|--------------|
| Scrcpy/Screen Mirroring | Complex implementation, needs `ya-webadb` scrcpy integration | Phase 2 |
| ADB Sideload | Less common use case | Phase 2 |
| ADB Install APK | Requires file handling | Phase 2 |
| ADB Push/Pull Files | Requires FileSystem API | Phase 2 |
| ADB Shell Interactive | Complex streaming implementation | Phase 3 |
| ADB Logcat Viewer | Large data streaming | Phase 2 |
| Fastboot OEM Commands | Device-specific | Phase 2 |
| Multi-device Support | UI complexity | Phase 2 |

### MVP Success Criteria

- [ ] User có thể chọn mode (EDL/ADB/Fastboot) từ Navigation Bar
- [ ] ADB mode: Connect device và xem device info
- [ ] ADB mode: Reboot to EDL/Fastboot/Recovery/System works
- [ ] Fastboot mode: Connect device và xem variables
- [ ] Fastboot mode: Unlock/Lock bootloader works
- [ ] Fastboot mode: Flash boot/recovery/vbmeta works
- [ ] Terminal log hiển thị output của tất cả commands
- [ ] No regressions: EDL mode vẫn hoạt động như cũ
- [ ] Works on Chrome/Edge trên Windows/Mac/Linux

---

## Technical Preferences

### Technology Stack (Additions)

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| ADB Protocol | `@anthropic/ya-webadb` or `@anthropic/adb` | Latest | ADB over WebUSB |
| Fastboot Protocol | `fastboot.js` (kdrag0n) | Latest | Fastboot over WebUSB |
| File Handling | File System Access API | Native | For flashing files |

### Architecture Approach

**Preserve existing architecture:**
- New protocols in `src/core/` alongside existing files
- New hooks: `useADB.ts`, `useFastboot.ts`
- New stores: `adbStore.ts`, `fastbootStore.ts`
- New pages: `ADBPage.tsx`, `FastbootPage.tsx`
- Update Navigation with mode selector

**File Structure Addition:**
```
src/
├── core/
│   ├── FirehoseProtocol.ts    # (existing)
│   ├── SaharaProtocol.ts      # (existing)
│   ├── WebUSBManager.ts       # (existing - may extend)
│   ├── ADBProtocol.ts         # NEW
│   └── FastbootProtocol.ts    # NEW
├── hooks/
│   ├── useWebUSB.ts           # (existing)
│   ├── useFirehose.ts         # (existing)
│   ├── useADB.ts              # NEW
│   └── useFastboot.ts         # NEW
├── stores/
│   ├── deviceStore.ts         # (enhance for multi-mode)
│   ├── adbStore.ts            # NEW
│   └── fastbootStore.ts       # NEW
├── pages/
│   ├── ToolPage.tsx           # (existing - EDL)
│   ├── ADBPage.tsx            # NEW
│   └── FastbootPage.tsx       # NEW
```

### WebUSB Device Filters

```typescript
// EDL Mode (existing)
{ vendorId: 0x05C6, productId: 0x9008 }  // Qualcomm EDL

// ADB Mode (new)
{ vendorId: 0x18D1, productId: 0x4EE0 }  // Google ADB
{ vendorId: 0x18D1, productId: 0x4EE2 }  // Google ADB Composite
{ vendorId: 0x05C6, productId: 0x9025 }  // Qualcomm ADB
{ vendorId: 0x2A70, productId: 0x9011 }  // OnePlus ADB
{ vendorId: 0x22D9, productId: 0x2769 }  // OPPO ADB

// Fastboot Mode (new)
{ vendorId: 0x18D1, productId: 0xD00D }  // Google Fastboot
{ vendorId: 0x18D1, productId: 0x4EE0 }  // Google Fastboot Alt
{ vendorId: 0x05C6, productId: 0x9006 }  // Qualcomm Fastboot
{ vendorId: 0x2A70, productId: 0x9012 }  // OnePlus Fastboot
{ vendorId: 0x22D9, productId: 0x2D00 }  // OPPO Fastboot
```

---

## Future Vision (Phase 2+)

### Phase 2: Enhanced ADB Features
- **Scrcpy Integration** - Screen mirroring via `ya-webadb` scrcpy module
- **ADB Sideload** - Install OTA zips
- **ADB Install** - Install APK files
- **ADB Logcat** - Real-time log viewer with filtering
- **ADB Shell Quick Commands** - Preset shell commands

### Phase 3: Advanced Features
- **Multi-device Support** - Connect multiple devices simultaneously
- **ADB over Wi-Fi** - Wireless ADB connection
- **Backup/Restore** - Full device backup via ADB
- **OEM Commands** - Device-specific Fastboot OEM commands
- **Batch Operations** - Run commands on multiple devices

---

## Risks and Assumptions

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| WebUSB browser compatibility | Low | High | Support Chrome/Edge only initially |
| ADB protocol complexity | Medium | Medium | Use proven `ya-webadb` library |
| Fastboot device variations | Medium | Low | Focus on common commands first |
| USB driver conflicts | Medium | Medium | Document driver requirements |

### Assumptions

1. Users have Chrome/Edge browser (WebUSB support)
2. Users have USB debugging enabled for ADB
3. Users have OEM unlocking enabled for bootloader unlock
4. Device manufacturers don't block WebUSB access
5. `ya-webadb` and `fastboot.js` libraries are maintained

---

## Timeline Constraints

### Estimated Development Time

| Phase | Features | Estimate |
|-------|----------|----------|
| Phase 1.1 | Mode Selector + ADB Core | 1-2 weeks |
| Phase 1.2 | Fastboot Core | 1 week |
| Phase 1.3 | Flash Functions + Polish | 1 week |
| **Phase 1 Total** | **MVP** | **3-4 weeks** |
| Phase 2 | Scrcpy + Advanced ADB | 2-3 weeks |

---

## Supporting Materials

### Reference Implementations

- **WebADB:** https://app.webadb.com - Full ADB implementation in browser
- **ya-webadb:** https://github.com/anthropics/ya-webadb - TypeScript ADB library
- **fastboot.js:** https://github.com/anthropics/fastboot.js - Fastboot in browser
- **android-webinstall:** https://github.com/anthropics/android-webinstall - ROM installer using fastboot.js
- **Google Android Flash Tool:** https://flash.android.com - Reference for UX

### VID/PID Database

- https://devicehunt.com/all-usb-vendors
- https://android.googlesource.com/platform/system/core/+/master/adb/usb_vendors.c

---

_This Product Brief captures the vision and requirements for Q-Flash-Web USB/ADB/Fastboot Extension._

_It was created through collaborative discovery and reflects the unique needs of this brownfield enhancement project._

_Next: Create Architecture Decision Document to define detailed implementation approach._
