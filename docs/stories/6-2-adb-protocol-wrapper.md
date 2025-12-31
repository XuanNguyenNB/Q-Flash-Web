# Story 6.2: ADB Protocol Wrapper

## Story Info
- **Epic:** Epic 6 - Mode Selection & Core Infrastructure
- **Priority:** P0 (Must have)
- **Estimated Effort:** 6 hours
- **Status:** review
- **Dependencies:** Story 6.1 ✅

---

## User Story

As a **developer**,  
I want **a TypeScript wrapper class for ADB protocol**,  
So that **React components can use ADB functions cleanly**.

---

## Acceptance Criteria

### AC1: File Structure
- [x] `src/core/ADBProtocol.ts` exists
- [x] Exports `ADBProtocol` class
- [x] Exports `ADBDeviceInfo` interface

### AC2: Device Filters
- [x] `static getFilters()` returns WebUSB filter array
- [x] Filters include: Google (0x18D1), Qualcomm (0x05C6), OnePlus (0x2A70), OPPO (0x22D9), Xiaomi (0x2717), Samsung (0x04E8), HTC (0x0BB4), Huawei (0x12D1)

### AC3: Connection Methods
- [x] `connect()` establishes ADB connection via WebUSB
- [x] `disconnect()` cleanly disconnects
- [x] `isConnected` getter returns connection state
- [x] Connection logs to provided logger callback

### AC4: Device Info
- [x] `getDeviceInfo()` returns `ADBDeviceInfo` object with:
  - `model` (ro.product.model)
  - `androidVersion` (ro.build.version.release)
  - `buildNumber` (ro.build.display.id)
  - `serialNumber`
  - `manufacturer` (ro.product.manufacturer)
  - `device` (ro.product.device)
  - Battery level/status (extended)
  - Storage/Memory usage (extended)
  - Network info (extended)

### AC5: Reboot Commands
- [x] `rebootToEDL()` sends `adb reboot edl`
- [x] `rebootToBootloader()` sends `adb reboot bootloader`
- [x] `rebootToFastbootD()` sends `adb reboot fastboot`
- [x] `rebootToRecovery()` sends `adb reboot recovery`
- [x] `reboot()` sends `adb reboot`
- [x] `shutdown()` sends `adb reboot -p`
- [x] All methods return `Promise<boolean>` (success/failure)

### AC6: Logging
- [x] Constructor accepts optional logger callback
- [x] All operations log with appropriate level (info, success, error)

### AC7: Extended Features (Bonus)
- [x] App Management: `listPackages()`, `installAPK()`, `uninstallPackage()`, `getPackagePath()`
- [x] File Operations: `listDirectory()`, `readFile()`, `writeFile()`, `pullFile()`, `pushFile()`, `deleteFile()`, `createDirectory()`

---

## Technical Notes

### Interface Definition

```typescript
export interface ADBDeviceInfo {
    model: string;
    androidVersion: string;
    buildNumber: string;
    serialNumber: string;
    manufacturer: string;
    device: string;
    batteryLevel?: string;
    batteryStatus?: string;
    storageUsage?: string;
    memoryUsage?: string;
    ipAddress?: string;
    wifiStatus?: string;
}
```

### Implementation Details

**Libraries Used:**
- `@yume-chan/adb` - Core ADB protocol
- `@yume-chan/adb-daemon-webusb` - WebUSB transport
- `@yume-chan/adb-credential-web` - RSA key storage for pairing
- `@yume-chan/stream-extra` - Stream utilities for file operations

**Key APIs Used:**
- `Adb.getProp()` - Built-in method for reading device properties
- `Adb.createSocketAndWait()` - Shell command execution
- `AdbDaemonTransport.authenticate()` - RSA authentication flow
- `Adb.sync()` - File sync operations (read/write/opendir)

**VID/PID Filters:**
Extended to support many manufacturers including:
- Google, Qualcomm, OnePlus, OPPO, Xiaomi
- Samsung, HTC, Huawei, Realme, Vivo, Honor
- Motorola, Sony, LG, ASUS

---

## Tasks

- [x] Task 1: Create `ADBDeviceInfo` interface
- [x] Task 2: Create `ADBProtocol` class skeleton with singleton pattern
- [x] Task 3: Implement `getFilters()` static method
- [x] Task 4: Implement `connect()` with retry logic
- [x] Task 5: Implement `disconnect()` method
- [x] Task 6: Implement `getDeviceInfo()` with extended info
- [x] Task 7: Implement `runShellCommand()` using createSocketAndWait
- [x] Task 8: Implement all reboot methods (EDL, bootloader, fastbootd, recovery, normal, shutdown)
- [x] Task 9: Implement app management methods
- [x] Task 10: Implement file operation methods
- [x] Task 11: Add comprehensive logging
- [x] Task 12: Fix TypeScript errors and verify compilation

---

## Definition of Done

- [x] All acceptance criteria met
- [x] TypeScript compiles without errors (`npx tsc --noEmit` passes)
- [x] Pattern consistent with existing codebase
- [x] Story marked as `review` in sprint-status.yaml

---

## Dev Agent Record

### Debug Log
- **2026-01-01**: Re-implemented ADBProtocol.ts with complete feature set
- **2026-01-01**: Fixed sync.write() to use correct ya-webadb API with ReadableStream
- **2026-01-01**: Added uint8ArrayToStream helper for file operations  
- **2026-01-01**: Fixed useADB.ts to properly convert File to Uint8Array
- **2026-01-01**: Fixed ScrcpyPanel.tsx to use runShellCommand instead of subprocess.spawn
- **2026-01-01**: Fixed ADBPage.tsx - removed className from ADBTerminal
- **2026-01-01**: Fixed pullFile Blob conversion using new Uint8Array()
- **2026-01-01**: Removed obsolete ScrcpyPanel.backup.tsx
- **2026-01-01**: Verified TypeScript compilation - no errors
- **2026-01-01**: Fixed race condition in connectToDevice causing "Device busy" error by adding connection locking
- **2026-01-01**: Fixed state sync issue by implementing connection status listener pattern in ADBProtocol and useADB hook

### Key Implementation Notes

1. **Singleton Pattern**: ADBProtocol uses getInstance() for connection persistence
2. **Retry Logic**: connect() retries up to 10 times for USB debugging authorization
3. **Stream API**: File writes use ya-webadb's stream-based sync.write() API
4. **Shell Commands**: Uses createSocketAndWait() for reliable shell execution
5. **Extended Info**: Device info includes battery, storage, memory, network status

---

## File List

### Modified/Created Files
- `src/core/ADBProtocol.ts` - Main ADB protocol wrapper (~677 lines)
- `src/hooks/useADB.ts` - Fixed to work with ADBProtocol API
- `src/components/features/adb/ScrcpyPanel.tsx` - Fixed subprocess usage
- `src/pages/ADBPage.tsx` - Fixed ADBTerminal props

### Removed Files
- `src/components/features/adb/ScrcpyPanel.backup.tsx` - Obsolete backup

### Dependencies (from Story 6.1)
- `@yume-chan/adb`
- `@yume-chan/adb-daemon-webusb`
- `@yume-chan/adb-credential-web`
- `@yume-chan/stream-extra`

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Initial implementation | Dev Agent |
| 2026-01-01 | Complete re-implementation with extended features | Dev Agent |
| 2026-01-01 | Fixed all TypeScript errors for full compilation | Dev Agent |

---

## References

- [ya-webadb/Tango ADB GitHub](https://github.com/yume-chan/ya-webadb)
- [ya-webadb API Documentation](https://yume-chan.github.io/ya-webadb/)
