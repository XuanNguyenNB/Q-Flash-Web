# Q-Flash-Web - USB/ADB/Fastboot Extension Epics & Stories

**Author:** Nguyen  
**Date:** 2025-12-30  
**Project Level:** Brownfield Enhancement  
**Related:** [PRD](./prd-usb-adb-fastboot.md) | [Architecture](./architecture-usb-adb-fastboot.md)

---

## Overview

This document provides the epic and story breakdown for the USB/ADB/Fastboot Extension feature, adding ADB and Fastboot mode support to Q-Flash-Web.

### Epic Summary

| Epic | Goal | Stories | Dependencies |
|------|------|---------|--------------|
| **Epic 6: Mode Selection & Core** | Multi-mode architecture foundation | 4 | Epic 1-2 (existing) |
| **Epic 7: ADB Mode Features** | Complete ADB functionality | 5 | Epic 6 |
| **Epic 8: Fastboot Mode Features** | Complete Fastboot functionality | 6 | Epic 6 |

**Total Stories:** 15

---

## Epic 6: Mode Selection & Core Infrastructure

**Goal:** Thiết lập nền tảng multi-mode architecture cho phép user chọn giữa EDL, ADB, và Fastboot modes trước khi kết nối thiết bị.

**Business Value:** Enables unified tool for all Android device management modes.

**Dependencies:** Epic 1 (Foundation), Epic 2 (Device Management)

---

### Story 6.1: Install ADB & Fastboot Libraries

As a **developer**,  
I want **the ADB and Fastboot WebUSB libraries installed and configured**,  
So that **I can build protocol wrappers**.

**Acceptance Criteria:**

**Given** the existing React + Vite project  
**When** I install the required packages  
**Then** `@anthropic-ai/adb` (or `ya-webadb` packages) is installed

**And** `android-fastboot` (or `fastboot.js`) is installed  
**And** TypeScript types are available  
**And** `npm run dev` works without errors  
**And** Packages are importable in TypeScript files

**Prerequisites:** Epic 1 complete

**Technical Notes:**
```bash
# ADB Library (choose one)
npm install @anthropic-ai/adb
# OR
npm install @anthropic-ai/adb-backend-webusb @anthropic-ai/adb-scrcpy

# Fastboot Library
npm install android-fastboot
# OR install from GitHub if not on npm
```

**Estimated Effort:** 2 hours

---

### Story 6.2: ADB Protocol Wrapper

As a **developer**,  
I want **a TypeScript wrapper class for ADB protocol**,  
So that **React components can use ADB functions cleanly**.

**Acceptance Criteria:**

**Given** ADB library is installed  
**When** I create the ADBProtocol class  
**Then** `src/core/ADBProtocol.ts` exists with:

**And** `static getFilters()` returns WebUSB filter list for ADB devices  
**And** `connect()` establishes ADB connection via WebUSB  
**And** `disconnect()` cleanly disconnects  
**And** `getDeviceInfo()` returns device model, Android version, build number, serial  
**And** `rebootToEDL()` sends `adb reboot edl`  
**And** `rebootToBootloader()` sends `adb reboot bootloader`  
**And** `rebootToRecovery()` sends `adb reboot recovery`  
**And** `reboot()` sends `adb reboot`  
**And** `shutdown()` sends `adb shell reboot -p`  
**And** All methods log to provided logger callback  
**And** `isConnected` getter returns connection state

**Prerequisites:** Story 6.1

**Technical Notes:**
- Follow pattern from existing `FirehoseProtocol.ts`
- Use ref-based singleton in hook later
- VID/PID list: Google (0x18D1), Qualcomm (0x05C6), OnePlus (0x2A70), OPPO (0x22D9), Xiaomi (0x2717), Samsung (0x04E8)
- Handle RSA key exchange for ADB auth

**Estimated Effort:** 6 hours

---

### Story 6.3: Fastboot Protocol Wrapper

As a **developer**,  
I want **a TypeScript wrapper class for Fastboot protocol**,  
So that **React components can use Fastboot functions cleanly**.

**Acceptance Criteria:**

**Given** Fastboot library is installed  
**When** I create the FastbootProtocol class  
**Then** `src/core/FastbootProtocol.ts` exists with:

**And** `static getFilters()` returns WebUSB filter list for Fastboot devices  
**And** `connect()` establishes Fastboot connection via WebUSB  
**And** `disconnect()` cleanly disconnects  
**And** `getDeviceInfo()` returns product, variant, serial, unlock status, secure boot, slot info  
**And** `getVariable(name)` gets any fastboot variable  
**And** `unlockBootloader()` sends `fastboot flashing unlock`  
**And** `lockBootloader()` sends `fastboot flashing lock`  
**And** `flashPartition(name, file, onProgress)` flashes file to partition  
**And** `flashVbmetaDisabled(file)` flashes vbmeta with disabled verification  
**And** `erasePartition(name)` erases partition  
**And** `reboot()` sends `fastboot reboot`  
**And** `rebootBootloader()` sends `fastboot reboot-bootloader`  
**And** `rebootRecovery()` sends `fastboot reboot-recovery`  
**And** All methods log to provided logger callback  
**And** `isConnected` getter returns connection state

**Prerequisites:** Story 6.1

**Technical Notes:**
- Follow pattern from existing `FirehoseProtocol.ts`
- VID/PID list for Fastboot mode devices
- Progress callback for flash operations
- Handle sparse image format if library supports

**Estimated Effort:** 6 hours

---

### Story 6.4: Mode Selector Component & Device Store Enhancement

As a **user**,  
I want **to select device mode (EDL/ADB/Fastboot) from the navigation bar**,  
So that **I can work with devices in different modes**.

**Acceptance Criteria:**

**Given** I am on any page of Q-Flash-Web  
**When** I look at the navigation/header area  
**Then** a Mode Selector component is visible

**And** it shows 3 options: EDL, ADB, Fastboot  
**And** current mode has visual highlight (background, underline, or bold)  
**And** clicking a mode navigates to that mode's page  
**And** mode selection is persisted to localStorage  
**And** when device is connected, other modes are disabled (grayed out with tooltip)  
**And** each mode has an icon (⚡ EDL, 📱 ADB, 🔧 Fastboot)

**Additional Store Requirements:**
- `deviceStore.currentMode` stores selected mode ('edl' | 'adb' | 'fastboot')
- `deviceStore.setMode(mode)` updates mode and resets connection state

**Prerequisites:** Epic 1, Epic 2 complete

**Technical Notes:**
- Use Tabs or ToggleGroup from shadcn/ui
- Add `currentMode` to deviceStore with persist middleware
- Create `ModeSelector.tsx` in `src/components/layout/`
- Update `Header.tsx` to include ModeSelector
- Add routes for `/adb` and `/fastboot`

**Estimated Effort:** 4 hours

---

## Epic 7: ADB Mode Features

**Goal:** Implement complete ADB mode functionality including device connection, info display, and reboot actions.

**Business Value:** Users can quickly reboot devices to different modes without command line.

**Dependencies:** Epic 6 (Mode Selection & Core)

---

### Story 7.1: ADB Store & Hook

As a **developer**,  
I want **Zustand store and React hook for ADB operations**,  
So that **ADB page components can access ADB functionality**.

**Acceptance Criteria:**

**Given** ADBProtocol wrapper exists  
**When** I create the store and hook  
**Then** `src/stores/adbStore.ts` exists with:
  - `deviceInfo: ADBDeviceInfo | null`
  - `isConnecting: boolean`
  - `pendingOperation: string | null`
  - `setDeviceInfo`, `setConnecting`, `setPendingOperation`, `reset`

**And** `src/hooks/useADB.ts` exists with:
  - `connect()` - connects and fetches device info
  - `disconnect()` - disconnects and resets store
  - `rebootToEDL()` - sends reboot edl command
  - `rebootToBootloader()` - sends reboot bootloader command
  - `rebootToRecovery()` - sends reboot recovery command
  - `reboot()` - sends normal reboot
  - `shutdown()` - sends shutdown command
  - All methods log to terminalStore
  - All methods update adbStore state

**Prerequisites:** Story 6.2

**Technical Notes:**
- Follow existing hook patterns (useWebUSB, useFirehose)
- Use useRef for ADBProtocol singleton
- Use useCallback for memoized methods
- Sync with deviceStore.isConnected

**Estimated Effort:** 4 hours

---

### Story 7.2: ADB Device Connection UI

As a **user**,  
I want **to connect my device in ADB mode via a Connect button**,  
So that **I can perform ADB operations**.

**Acceptance Criteria:**

**Given** I am on the ADB page  
**When** I click the "Connect ADB" button  
**Then** WebUSB device picker opens with ADB device filter

**And** after selecting device, connection is established  
**And** button changes to "Disconnect" when connected  
**And** connection status indicator shows: Disconnected (gray), Connecting (pulse), Connected (green)  
**And** if connection fails, error message is shown and logged  
**And** terminal log shows connection steps

**Error Handling:**
- No device found: "Không tìm thấy thiết bị ADB. Đảm bảo USB Debugging đã bật."
- Permission denied: "Quyền truy cập bị từ chối."
- Device in use: "Thiết bị đang được sử dụng bởi ứng dụng khác."

**Prerequisites:** Story 7.1

**Technical Notes:**
- Create `ADBConnectionStatus.tsx` component
- Show spinner/pulse during connection
- Use toast for error notifications

**Estimated Effort:** 3 hours

---

### Story 7.3: ADB Device Info Panel

As a **user**,  
I want **to see my device information after connecting via ADB**,  
So that **I can verify the correct device is connected**.

**Acceptance Criteria:**

**Given** device is connected via ADB  
**When** I view the ADB page  
**Then** Device Info panel shows:
  - Model (e.g., "Pixel 7 Pro")
  - Android Version (e.g., "14")
  - Build Number (e.g., "AP2A.240805.005")
  - Serial Number
  - Manufacturer (e.g., "Google")
  - Device Codename (e.g., "cheetah")

**And** panel has "Refresh" button to re-fetch info  
**And** panel has clean, card-style design  
**And** empty state shows "Connect device to view info"

**Prerequisites:** Story 7.2

**Technical Notes:**
- Create `ADBDeviceInfo.tsx` component
- Use Card from shadcn/ui
- Display with label-value pairs

**Estimated Effort:** 2 hours

---

### Story 7.4: ADB Quick Actions (Reboot Buttons)

As a **user**,  
I want **buttons to reboot my device to different modes**,  
So that **I can quickly switch between EDL, Fastboot, and Recovery**.

**Acceptance Criteria:**

**Given** device is connected via ADB  
**When** I view the Quick Actions panel  
**Then** buttons exist for:
  - ⚡ "Reboot EDL" - reboots to EDL mode
  - 🔧 "Reboot Fastboot" - reboots to bootloader/fastboot
  - 🔄 "Reboot Recovery" - reboots to recovery
  - 🔄 "Reboot System" - normal reboot
  - ⏻ "Power Off" - shuts down device

**And** buttons are disabled when no device connected  
**And** clicking a button executes the command  
**And** button shows loading state during operation  
**And** terminal log shows command execution  
**And** after reboot command, device auto-disconnects  
**And** toast notification confirms action

**Confirmation Dialog (for Power Off only):**
- "Bạn có chắc muốn tắt nguồn thiết bị?"

**Prerequisites:** Story 7.1

**Technical Notes:**
- Create `ADBQuickActions.tsx` component
- Use Button from shadcn/ui
- Only Power Off needs confirmation dialog
- After reboot, show hint to switch mode tabs

**Estimated Effort:** 3 hours

---

### Story 7.5: ADB Page Layout

As a **user**,  
I want **a well-organized ADB page with all ADB features**,  
So that **I can easily perform ADB operations**.

**Acceptance Criteria:**

**Given** I select ADB mode and navigate to /adb  
**When** the page loads  
**Then** page has professional layout with:
  - Header: Connect button + connection status
  - Left panel: Device Info
  - Right panel: Quick Actions
  - Bottom: Terminal Log panel

**And** layout is responsive (stacks on mobile/tablet)  
**And** dark mode styling consistent with rest of app  
**And** all text is translated (EN/VI)  
**And** page title updates to "Q-Flash - ADB Mode"

**i18n Keys Required:**
- `adb.title`: "ADB Mode"
- `adb.connect`: "Connect ADB"
- `adb.disconnect`: "Disconnect"
- `adb.deviceInfo.title`: "Device Information"
- `adb.deviceInfo.model`: "Model"
- `adb.deviceInfo.android`: "Android Version"
- `adb.deviceInfo.build`: "Build Number"
- `adb.deviceInfo.serial`: "Serial Number"
- `adb.deviceInfo.manufacturer`: "Manufacturer"
- `adb.deviceInfo.device`: "Device"
- `adb.quickActions.title`: "Quick Actions"
- `adb.quickActions.rebootEdl`: "Reboot EDL"
- `adb.quickActions.rebootFastboot`: "Reboot Fastboot"
- `adb.quickActions.rebootRecovery`: "Reboot Recovery"
- `adb.quickActions.reboot`: "Reboot System"
- `adb.quickActions.shutdown`: "Power Off"
- `adb.status.disconnected`: "Disconnected"
- `adb.status.connecting`: "Connecting..."
- `adb.status.connected`: "Connected"

**Prerequisites:** Stories 7.2, 7.3, 7.4

**Technical Notes:**
- Create `src/pages/ADBPage.tsx`
- Add route in router.ts
- Compose from smaller components
- Use existing LogPanel component

**Estimated Effort:** 4 hours

---

### Story 7.6: ADB Scrcpy Integration (Screen Mirror) [COMPLETED]

**Status:** ✅ Completed on 2025-12-31
**Documentation:** `docs/features/adb-scrcpy.md`

As a **user**,  
I want **to view and control my device screen directly in the browser**,  
So that **I can interact with the device without leaving the application**.

**Acceptance Criteria:**

**Given** device is connected via ADB  
**When** I click "Screen Mirror" button (or tab)  
**Then** a panel opens showing device screen with Low Latency (~60fps)

**And** Features Delivered:
- Video stream real-time (WebCodecs H.264, 1024px @ 2Mbps)
- Full Touch (Swipe, Drag, Pinch) Support
- Bi-directional Clipboard Sync (Ctrl+C / Ctrl+V)
- Sidebar Controls (Power, Volume, Nav Buttons)
- Status "Live Sync" indicator

**Prerequisites:** Story 7.1

**Technical Notes:**
- Implemented `ScrcpyPanel.tsx` with optimized `WebCodecsVideoDecoder`.
- Solved Coordinate Mapping issue via `videoWidth` key.
- Implemented custom `injectTouch` logic.

**Estimated Effort:** 8 hours (Actual: ~6 hours)

---

## Epic 8: Fastboot Mode Features

**Goal:** Implement complete Fastboot mode functionality including connection, device info, bootloader unlock/lock, and partition flashing.

**Business Value:** Users can unlock bootloader and flash partitions without command line.

**Dependencies:** Epic 6 (Mode Selection & Core)

---

### Story 8.1: Fastboot Store & Hook

As a **developer**,  
I want **Zustand store and React hook for Fastboot operations**,  
So that **Fastboot page components can access Fastboot functionality**.

**Acceptance Criteria:**

**Given** FastbootProtocol wrapper exists  
**When** I create the store and hook  
**Then** `src/stores/fastbootStore.ts` exists with:
  - `deviceInfo: FastbootDeviceInfo | null`
  - `isConnecting: boolean`
  - `flashProgress: { partition: string; progress: number } | null`
  - `pendingOperation: string | null`
  - `setDeviceInfo`, `setConnecting`, `setFlashProgress`, `setPendingOperation`, `reset`

**And** `src/hooks/useFastboot.ts` exists with:
  - `connect()` - connects and fetches device variables
  - `disconnect()` - disconnects and resets store
  - `unlockBootloader()` - sends flashing unlock
  - `lockBootloader()` - sends flashing lock
  - `flashPartition(partition, file)` - flashes file to partition
  - `erasePartition(partition)` - erases partition
  - `reboot()` - reboots to system
  - `rebootBootloader()` - reboots to bootloader
  - `rebootRecovery()` - reboots to recovery
  - All methods log to terminalStore
  - All methods update fastbootStore state

**Prerequisites:** Story 6.3

**Technical Notes:**
- Follow existing hook patterns
- useRef for FastbootProtocol singleton
- Progress callback updates flashProgress

**Estimated Effort:** 4 hours

---

### Story 8.2: Fastboot Device Connection UI

As a **user**,  
I want **to connect my device in Fastboot mode via a Connect button**,  
So that **I can perform Fastboot operations**.

**Acceptance Criteria:**

**Given** I am on the Fastboot page  
**When** I click the "Connect Fastboot" button  
**Then** WebUSB device picker opens with Fastboot device filter

**And** after selecting device, connection is established  
**And** button changes to "Disconnect" when connected  
**And** connection status indicator shows correct state  
**And** if connection fails, error message is shown and logged

**Error Handling:**
- No device found: "Không tìm thấy thiết bị Fastboot. Đảm bảo thiết bị đang ở Fastboot/Bootloader mode."

**Prerequisites:** Story 8.1

**Technical Notes:**
- Similar to ADB connection UI
- Create `FastbootConnectionStatus.tsx`

**Estimated Effort:** 2 hours

---

### Story 8.3: Fastboot Device Variables Panel

As a **user**,  
I want **to see device variables after connecting via Fastboot**,  
So that **I can verify device info and bootloader status**.

**Acceptance Criteria:**

**Given** device is connected via Fastboot  
**When** I view the Fastboot page  
**Then** Device Variables panel shows:
  - Product (device codename)
  - Variant
  - Serial Number
  - **Bootloader Status** with visual indicator (🔓 Unlocked / 🔒 Locked)
  - Secure Boot status
  - Current Slot (a/b)
  - Slot Count
  - Battery Level (if available)

**And** panel has "Refresh" button  
**And** Bootloader status is prominently displayed  
**And** empty state shows "Connect device to view variables"

**Prerequisites:** Story 8.2

**Technical Notes:**
- Create `FastbootDeviceInfo.tsx` component
- Highlight bootloader status with color (green=unlocked, red=locked)

**Estimated Effort:** 2 hours

---

### Story 8.4: Bootloader Unlock/Lock Buttons

As a **user**,  
I want **buttons to unlock and lock the bootloader**,  
So that **I can prepare my device for custom ROMs**.

**Acceptance Criteria:**

**Given** device is connected via Fastboot  
**When** I view the Bootloader Actions panel  
**Then** buttons exist for:
  - 🔓 "Unlock Bootloader"
  - 🔒 "Lock Bootloader"

**Unlock Button:**
- **Confirmation dialog required** with warning text:
  - Title: "⚠️ Unlock Bootloader"
  - Body: "CẢNH BÁO: Unlock bootloader sẽ XÓA TOÀN BỘ DỮ LIỆU trên thiết bị!
    - Tất cả apps và dữ liệu sẽ bị xóa
    - Thiết bị sẽ factory reset
    - Bạn phải xác nhận trên màn hình thiết bị"
  - Buttons: "Cancel" | "Unlock Bootloader"
- After confirming, sends `fastboot flashing unlock`
- Terminal shows "User must confirm on device screen"
- Auto refresh device variables after operation

**Lock Button:**
- **Confirmation dialog required** with warning text
- Body: "CẢNH BÁO: Lock bootloader sẽ xóa dữ liệu và ngăn flash custom ROMs."
- Sends `fastboot flashing lock`
- Auto refresh device variables after operation

**And** buttons are disabled when no device connected  
**And** button shows loading state during operation

**Prerequisites:** Story 8.1

**Technical Notes:**
- Create `BootloaderActions.tsx` component
- Use AlertDialog from shadcn/ui for confirmation
- Style unlock button as warning (orange/yellow)
- Style lock button as danger (red)

**Estimated Effort:** 4 hours

---

### Story 8.5: Fastboot Flash Partitions

As a **user**,  
I want **to flash boot, recovery, and vbmeta partitions from Fastboot**,  
So that **I can install custom boot images**.

**Acceptance Criteria:**

**Given** device is connected via Fastboot  
**When** I view the Flash Partitions panel  
**Then** buttons exist for:
  - "Flash Boot" - flashes boot.img to boot partition
  - "Flash Recovery" - flashes recovery.img to recovery partition
  - "Flash Vbmeta (Disable AVB)" - flashes vbmeta with disabled verification

**Flash Flow:**
1. Click button opens file picker (accept .img files)
2. After selecting file, show file name and size
3. Confirmation dialog: "Flash {filename} to {partition}?"
4. Progress bar shows flash progress (0-100%)
5. Terminal log shows progress
6. Success/Error toast after completion

**Vbmeta Special Handling:**
- Extra warning about security implications
- Flash with `--disable-verity --disable-verification` flags

**And** buttons are disabled when no device connected  
**And** only one flash operation at a time (disable other buttons during flash)

**Prerequisites:** Story 8.1

**Technical Notes:**
- Create `FastbootFlashPanel.tsx` component
- Use File input with accept=".img"
- Progress bar from shadcn/ui
- Disable UI during flash operation

**Estimated Effort:** 5 hours

---

### Story 8.6: Fastboot Page Layout

As a **user**,  
I want **a well-organized Fastboot page with all Fastboot features**,  
So that **I can easily perform Fastboot operations**.

**Acceptance Criteria:**

**Given** I select Fastboot mode and navigate to /fastboot  
**When** the page loads  
**Then** page has professional layout with:
  - Header: Connect button + connection status
  - Left column: Device Variables
  - Right column (top): Bootloader Actions (Unlock/Lock)
  - Right column (middle): Reboot Actions
  - Center: Flash Partitions panel
  - Bottom: Terminal Log panel

**And** layout is responsive  
**And** all text is translated (EN/VI)  
**And** page title updates to "Q-Flash - Fastboot Mode"

**Reboot Actions:**
- "Reboot System" - reboots to system
- "Reboot Bootloader" - stays in fastboot
- "Reboot Recovery" - reboots to recovery

**i18n Keys Required:**
- `fastboot.title`: "Fastboot Mode"
- `fastboot.connect`: "Connect Fastboot"
- `fastboot.disconnect`: "Disconnect"
- `fastboot.variables.title`: "Device Variables"
- `fastboot.variables.product`: "Product"
- `fastboot.variables.variant`: "Variant"
- `fastboot.variables.serial`: "Serial Number"
- `fastboot.variables.bootloader`: "Bootloader"
- `fastboot.variables.unlocked`: "Unlocked"
- `fastboot.variables.locked`: "Locked"
- `fastboot.variables.secure`: "Secure Boot"
- `fastboot.variables.slot`: "Current Slot"
- `fastboot.variables.battery`: "Battery"
- `fastboot.bootloader.title`: "Bootloader"
- `fastboot.bootloader.unlock`: "Unlock Bootloader"
- `fastboot.bootloader.lock`: "Lock Bootloader"
- `fastboot.bootloader.unlockWarning`: "WARNING: Unlocking will ERASE ALL DATA..."
- `fastboot.bootloader.lockWarning`: "WARNING: Locking will erase data..."
- `fastboot.flash.title`: "Flash Partitions"
- `fastboot.flash.boot`: "Flash Boot"
- `fastboot.flash.recovery`: "Flash Recovery"
- `fastboot.flash.vbmeta`: "Flash Vbmeta (Disable AVB)"
- `fastboot.flash.confirm`: "Flash {filename} to {partition}?"
- `fastboot.flash.progress`: "Flashing... {percent}%"
- `fastboot.reboot.title`: "Reboot"
- `fastboot.reboot.system`: "Reboot System"
- `fastboot.reboot.bootloader`: "Reboot Bootloader"
- `fastboot.reboot.recovery`: "Reboot Recovery"

**Prerequisites:** Stories 8.2, 8.3, 8.4, 8.5

**Technical Notes:**
- Create `src/pages/FastbootPage.tsx`
- Add route in router.ts
- Compose from smaller components
- Use existing LogPanel component

**Estimated Effort:** 4 hours

---

## Implementation Order

### Phase 1.1: Foundation (Week 1)

| Order | Story | Effort | Dependencies |
|-------|-------|--------|--------------|
| 1 | 6.1 - Install Libraries | 2h | None |
| 2 | 6.2 - ADB Protocol Wrapper | 6h | 6.1 |
| 3 | 6.3 - Fastboot Protocol Wrapper | 6h | 6.1 |
| 4 | 6.4 - Mode Selector Component | 4h | None |

**Week 1 Total:** 18 hours

### Phase 1.2: ADB Mode (Week 2)

| Order | Story | Effort | Dependencies |
|-------|-------|--------|--------------|
| 5 | 7.1 - ADB Store & Hook | 4h | 6.2 |
| 6 | 7.2 - ADB Connection UI | 3h | 7.1 |
| 7 | 7.3 - ADB Device Info Panel | 2h | 7.2 |
| 8 | 7.4 - ADB Quick Actions | 3h | 7.1 |
| 9 | 7.5 - ADB Page Layout | 4h | 7.2, 7.3, 7.4 |

**Week 2 Total:** 16 hours

### Phase 1.3: Fastboot Mode (Week 3)

| Order | Story | Effort | Dependencies |
|-------|-------|--------|--------------|
| 10 | 8.1 - Fastboot Store & Hook | 4h | 6.3 |
| 11 | 8.2 - Fastboot Connection UI | 2h | 8.1 |
| 12 | 8.3 - Fastboot Device Variables | 2h | 8.2 |
| 13 | 8.4 - Bootloader Unlock/Lock | 4h | 8.1 |
| 14 | 8.5 - Fastboot Flash Partitions | 5h | 8.1 |
| 15 | 8.6 - Fastboot Page Layout | 4h | 8.2-8.5 |

**Week 3 Total:** 21 hours

### Grand Total

| Phase | Stories | Hours |
|-------|---------|-------|
| Phase 1.1 | 4 | 18h |
| Phase 1.2 | 5 | 16h |
| Phase 1.3 | 6 | 21h |
| **Total** | **15** | **55h (~7 days)** |

---

## Testing Checklist

### ADB Mode Testing

- [ ] Connect Google Pixel device via ADB
- [ ] Connect OnePlus device via ADB
- [ ] Connect OPPO device via ADB
- [ ] Device info displays correctly
- [ ] Reboot to EDL works
- [ ] Reboot to Fastboot works
- [ ] Reboot to Recovery works
- [ ] Normal reboot works
- [ ] Shutdown works

### Fastboot Mode Testing

- [ ] Connect device in Fastboot mode
- [ ] Device variables display correctly
- [ ] Bootloader status shows correctly
- [ ] Unlock bootloader (on test device)
- [ ] Lock bootloader (on test device)
- [ ] Flash boot.img works
- [ ] Flash recovery.img works
- [ ] Flash vbmeta.img works
- [ ] Reboot commands work

### Integration Testing

- [ ] Mode switching works correctly
- [ ] EDL mode still works (no regression)
- [ ] Terminal log shows all operations
- [ ] i18n translations complete (EN/VI)
- [ ] Dark mode styling correct
- [ ] Responsive layout works

---

_For implementation: Use the `dev-story` workflow to implement individual stories._

_Next: Update sprint-status.yaml with new epics and stories._
