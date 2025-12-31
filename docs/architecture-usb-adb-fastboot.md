# Architecture Decision: USB/ADB/Fastboot Extension

> **Version:** 1.0  
> **Date:** 2025-12-30  
> **Author:** Architect Agent with Nguyen  
> **Status:** Draft  
> **Related:** [Product Brief](./product-brief-usb-adb-fastboot.md)

---

## Executive Summary

Tài liệu này định nghĩa kiến trúc cho việc mở rộng Q-Flash-Web từ **EDL-only tool** thành **Multi-Mode Android Device Platform** hỗ trợ **EDL**, **ADB**, và **Fastboot** modes.

**Approach:** Tích hợp các thư viện mã nguồn mở (`@anthropic-ai/adb` hoặc `ya-webadb`, `fastboot.js`) vào codebase hiện tại, tuân thủ patterns đã thiết lập trong architecture gốc.

---

## Decision Summary

| Category | Decision | Rationale |
|----------|----------|-----------|
| **ADB Protocol** | `@anthropic-ai/adb` (fork of ya-webadb) | Actively maintained, TypeScript, WebUSB support |
| **Fastboot Protocol** | `fastboot.js` (kdrag0n) | Proven, used by Google, lightweight |
| **Architecture Pattern** | Protocol per Mode + Shared WebUSB Base | Separation of concerns, code reuse |
| **State Management** | Separate stores per mode + unified deviceStore | Isolation, clear ownership |
| **UI Pattern** | Mode Selector + Mode-specific Pages | User-controlled workflow |
| **Connection Strategy** | User selects mode → Then connects device | Matches existing EDL flow |

---

## Technology Stack Additions

### New Dependencies

```bash
# ADB Protocol - choose ONE of these:
# Option A: @anthropic-ai/adb (fork of ya-webadb, recommended)
npm install @anthropic-ai/adb

# Option B: Original ya-webadb packages
npm install @anthropic-ai/adb-backend-webusb @anthropic-ai/adb-scrcpy

# Fastboot Protocol
npm install android-fastboot

# Note: fastboot.js may need to be installed from GitHub if not on npm
# npm install kdrag0n/fastboot.js
```

### Version Matrix

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `@anthropic-ai/adb` | ^1.0.0 | ADB protocol over WebUSB | ~200KB |
| `android-fastboot` | ^1.0.0 | Fastboot protocol over WebUSB | ~50KB |

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Q-Flash-Web                              │
├─────────────────────────────────────────────────────────────────┤
│  Navigation Bar                                                 │
│  ┌──────────┬──────────┬──────────┬────────────────────────┐   │
│  │   EDL    │   ADB    │ Fastboot │  Guide | Downloads...  │   │
│  └──────────┴──────────┴──────────┴────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Mode-Specific Page                     │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐   │   │
│  │  │   Device Info   │  │    Quick Action Buttons     │   │   │
│  │  └─────────────────┘  └─────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────┐│   │
│  │  │              Mode-Specific Features                  ││   │
│  │  │  (Partitions for EDL, Flash for Fastboot, etc.)     ││   │
│  │  └─────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Unified Terminal Log                    │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                        Stores (Zustand)                         │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐   │
│  │deviceStore│ │ adbStore │ │fastbootStore│ │terminalStore │   │
│  └──────────┘ └──────────┘ └────────────┘ └───────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                         Hooks Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐   │
│  │useWebUSB │ │  useADB  │ │useFastboot │ │useFirehose    │   │
│  └──────────┘ └──────────┘ └────────────┘ └───────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                        Core Protocols                           │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐ │
│  │WebUSBManager   │ │ ADBProtocol    │ │ FastbootProtocol   │ │
│  │(existing)      │ │ (new wrapper)  │ │ (new wrapper)      │ │
│  └────────────────┘ └────────────────┘ └────────────────────┘ │
│  ┌────────────────┐ ┌────────────────┐                        │
│  │FirehoseProtocol│ │ SaharaProtocol │  (existing, preserved) │
│  └────────────────┘ └────────────────┘                        │
├─────────────────────────────────────────────────────────────────┤
│                      External Libraries                         │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────────┐ │
│  │  WebUSB API    │ │ @anthropic-ai/ │ │  android-fastboot  │ │
│  │  (Browser)     │ │     adb        │ │  (fastboot.js)     │ │
│  └────────────────┘ └────────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/
├── core/
│   ├── WebUSBManager.ts         # (existing) - EDL USB handling
│   ├── FirehoseProtocol.ts      # (existing) - EDL Firehose XML
│   ├── SaharaProtocol.ts        # (existing) - EDL Sahara bootloader
│   ├── ADBProtocol.ts           # NEW - ADB wrapper
│   └── FastbootProtocol.ts      # NEW - Fastboot wrapper
│
├── hooks/
│   ├── useWebUSB.ts             # (existing) - EDL connection
│   ├── useFirehose.ts           # (existing) - EDL operations
│   ├── useSahara.ts             # (existing) - EDL handshake
│   ├── useADB.ts                # NEW - ADB operations hook
│   ├── useFastboot.ts           # NEW - Fastboot operations hook
│   └── useDeviceMode.ts         # NEW - Mode selection hook
│
├── stores/
│   ├── deviceStore.ts           # (enhance) - Add mode selection
│   ├── partitionStore.ts        # (existing) - EDL partitions
│   ├── flashStore.ts            # (existing) - EDL flash progress
│   ├── terminalStore.ts         # (existing) - Unified logs
│   ├── adbStore.ts              # NEW - ADB state
│   └── fastbootStore.ts         # NEW - Fastboot state
│
├── pages/
│   ├── ToolPage.tsx             # (existing) - EDL mode page
│   ├── ADBPage.tsx              # NEW - ADB mode page
│   ├── FastbootPage.tsx         # NEW - Fastboot mode page
│   └── ...                      # (other existing pages)
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # (enhance) - Add mode selector
│   │   ├── Sidebar.tsx          # (existing)
│   │   └── ModeSelector.tsx     # NEW - Mode tabs/dropdown
│   │
│   └── features/
│       ├── adb/                  # NEW
│       │   ├── ADBDeviceInfo.tsx
│       │   ├── ADBQuickActions.tsx
│       │   └── ADBConnectionStatus.tsx
│       │
│       └── fastboot/             # NEW
│           ├── FastbootDeviceInfo.tsx
│           ├── FastbootQuickActions.tsx
│           ├── FastbootFlashPanel.tsx
│           └── BootloaderActions.tsx
│
└── types/
    ├── index.ts                 # (enhance) - Export new types
    ├── adb.ts                   # NEW - ADB types
    └── fastboot.ts              # NEW - Fastboot types
```

---

## Core Protocol Wrappers

### ADR-007: ADB Protocol Wrapper

**Decision:** Create a wrapper class around `@anthropic-ai/adb` library

**Rationale:**
- External library handles complex ADB protocol
- Wrapper provides clean API matching our patterns
- Isolates library-specific code for easy updates

```typescript
// src/core/ADBProtocol.ts

import { Adb, AdbDaemonWebUsbConnection } from '@anthropic-ai/adb';

export interface ADBDeviceInfo {
  model: string;
  androidVersion: string;
  buildNumber: string;
  serialNumber: string;
  bootloaderStatus: 'locked' | 'unlocked' | 'unknown';
  manufacturer: string;
  device: string;
}

export class ADBProtocol {
  private adb: Adb | null = null;
  private connection: AdbDaemonWebUsbConnection | null = null;
  private onLog: (message: string, level?: 'info' | 'success' | 'error') => void;

  constructor(logger?: (message: string, level?: string) => void) {
    this.onLog = logger || console.log;
  }

  /**
   * Get WebUSB device filters for ADB mode
   */
  static getFilters(): USBDeviceFilter[] {
    return [
      { vendorId: 0x18D1, productId: 0x4EE0 },  // Google ADB
      { vendorId: 0x18D1, productId: 0x4EE2 },  // Google ADB Composite
      { vendorId: 0x18D1, productId: 0x4EE7 },  // Google ADB (alt)
      { vendorId: 0x05C6, productId: 0x9025 },  // Qualcomm ADB
      { vendorId: 0x2A70, productId: 0x9011 },  // OnePlus ADB
      { vendorId: 0x22D9, productId: 0x2769 },  // OPPO ADB
      { vendorId: 0x2717, productId: 0xFF40 },  // Xiaomi ADB
      { vendorId: 0x04E8, productId: 0x6860 },  // Samsung ADB
      { vendorId: 0x0BB4, productId: 0x0C02 },  // HTC ADB
      { vendorId: 0x12D1, productId: 0x1038 },  // Huawei ADB
    ];
  }

  /**
   * Connect to ADB device via WebUSB
   */
  async connect(): Promise<boolean> {
    try {
      this.onLog('Requesting ADB device...', 'info');
      
      const device = await navigator.usb.requestDevice({
        filters: ADBProtocol.getFilters()
      });

      this.connection = new AdbDaemonWebUsbConnection(device);
      this.adb = await Adb.authenticate(this.connection, {
        // Credential store for RSA keys (browser localStorage)
        credentialStore: {
          // Implementation using localStorage
        }
      });

      this.onLog('ADB connected successfully', 'success');
      return true;
    } catch (error) {
      this.onLog(`ADB connection failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<ADBDeviceInfo | null> {
    if (!this.adb) return null;

    try {
      const props = await this.adb.subprocess.noneShell(`
        getprop ro.product.model;
        getprop ro.build.version.release;
        getprop ro.build.display.id;
        getprop ro.serialno;
        getprop ro.bootimage.build.fingerprint;
        getprop ro.product.manufacturer;
        getprop ro.product.device;
      `);

      const lines = props.stdout.split('\n');
      
      return {
        model: lines[0]?.trim() || 'Unknown',
        androidVersion: lines[1]?.trim() || 'Unknown',
        buildNumber: lines[2]?.trim() || 'Unknown',
        serialNumber: lines[3]?.trim() || 'Unknown',
        bootloaderStatus: 'unknown', // Requires root to check
        manufacturer: lines[5]?.trim() || 'Unknown',
        device: lines[6]?.trim() || 'Unknown',
      };
    } catch (error) {
      this.onLog(`Failed to get device info: ${error}`, 'error');
      return null;
    }
  }

  /**
   * Reboot to EDL mode
   */
  async rebootToEDL(): Promise<boolean> {
    if (!this.adb) return false;
    
    try {
      this.onLog('Rebooting to EDL mode...', 'info');
      await this.adb.subprocess.spawnAndWait('reboot', 'edl');
      this.onLog('Reboot command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Reboot failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Reboot to bootloader (fastboot)
   */
  async rebootToBootloader(): Promise<boolean> {
    if (!this.adb) return false;
    
    try {
      this.onLog('Rebooting to bootloader...', 'info');
      await this.adb.subprocess.spawnAndWait('reboot', 'bootloader');
      this.onLog('Reboot command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Reboot failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Reboot to recovery
   */
  async rebootToRecovery(): Promise<boolean> {
    if (!this.adb) return false;
    
    try {
      this.onLog('Rebooting to recovery...', 'info');
      await this.adb.subprocess.spawnAndWait('reboot', 'recovery');
      this.onLog('Reboot command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Reboot failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Normal reboot
   */
  async reboot(): Promise<boolean> {
    if (!this.adb) return false;
    
    try {
      this.onLog('Rebooting device...', 'info');
      await this.adb.subprocess.spawnAndWait('reboot');
      this.onLog('Reboot command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Reboot failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Shutdown device
   */
  async shutdown(): Promise<boolean> {
    if (!this.adb) return false;
    
    try {
      this.onLog('Shutting down device...', 'info');
      await this.adb.subprocess.shell('reboot -p');
      this.onLog('Shutdown command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Shutdown failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (this.adb) {
      await this.adb.close();
      this.adb = null;
    }
    if (this.connection) {
      await this.connection.dispose();
      this.connection = null;
    }
    this.onLog('ADB disconnected', 'info');
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.adb !== null;
  }
}
```

### ADR-008: Fastboot Protocol Wrapper

**Decision:** Create a wrapper class around `android-fastboot` library

```typescript
// src/core/FastbootProtocol.ts

import { FastbootDevice } from 'android-fastboot';

export interface FastbootDeviceInfo {
  product: string;
  variant: string;
  serialno: string;
  unlocked: boolean;
  secure: boolean;
  currentSlot: string;
  slotCount: number;
  batteryLevel: string;
  offModeCharge: boolean;
}

export class FastbootProtocol {
  private device: FastbootDevice | null = null;
  private onLog: (message: string, level?: 'info' | 'success' | 'error') => void;

  constructor(logger?: (message: string, level?: string) => void) {
    this.onLog = logger || console.log;
  }

  /**
   * Get WebUSB device filters for Fastboot mode
   */
  static getFilters(): USBDeviceFilter[] {
    return [
      { vendorId: 0x18D1, productId: 0xD00D },  // Google Fastboot
      { vendorId: 0x18D1, productId: 0x4EE0 },  // Google Fastboot Alt
      { vendorId: 0x05C6, productId: 0x9006 },  // Qualcomm Fastboot
      { vendorId: 0x2A70, productId: 0x9012 },  // OnePlus Fastboot
      { vendorId: 0x22D9, productId: 0x2D00 },  // OPPO Fastboot
      { vendorId: 0x2717, productId: 0xFF80 },  // Xiaomi Fastboot
      { vendorId: 0x04E8, productId: 0x6860 },  // Samsung Fastboot
      { vendorId: 0x0BB4, productId: 0x0C01 },  // HTC Fastboot
      { vendorId: 0x12D1, productId: 0x1050 },  // Huawei Fastboot
    ];
  }

  /**
   * Connect to Fastboot device via WebUSB
   */
  async connect(): Promise<boolean> {
    try {
      this.onLog('Requesting Fastboot device...', 'info');

      const usbDevice = await navigator.usb.requestDevice({
        filters: FastbootProtocol.getFilters()
      });

      this.device = new FastbootDevice();
      await this.device.connect(usbDevice);

      this.onLog('Fastboot connected successfully', 'success');
      return true;
    } catch (error) {
      this.onLog(`Fastboot connection failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Get all device variables
   */
  async getDeviceInfo(): Promise<FastbootDeviceInfo | null> {
    if (!this.device) return null;

    try {
      const [
        product,
        variant,
        serialno,
        unlocked,
        secure,
        currentSlot,
        slotCount,
        battery,
        offModeCharge
      ] = await Promise.all([
        this.device.getVariable('product'),
        this.device.getVariable('variant'),
        this.device.getVariable('serialno'),
        this.device.getVariable('unlocked'),
        this.device.getVariable('secure'),
        this.device.getVariable('current-slot'),
        this.device.getVariable('slot-count'),
        this.device.getVariable('battery-level'),
        this.device.getVariable('off-mode-charge')
      ]);

      return {
        product: product || 'Unknown',
        variant: variant || 'Unknown',
        serialno: serialno || 'Unknown',
        unlocked: unlocked === 'yes',
        secure: secure === 'yes',
        currentSlot: currentSlot || 'a',
        slotCount: parseInt(slotCount || '2', 10),
        batteryLevel: battery || 'Unknown',
        offModeCharge: offModeCharge === '1',
      };
    } catch (error) {
      this.onLog(`Failed to get device info: ${error}`, 'error');
      return null;
    }
  }

  /**
   * Get a specific variable
   */
  async getVariable(name: string): Promise<string | null> {
    if (!this.device) return null;
    
    try {
      return await this.device.getVariable(name);
    } catch {
      return null;
    }
  }

  /**
   * Unlock bootloader
   */
  async unlockBootloader(): Promise<boolean> {
    if (!this.device) return false;

    try {
      this.onLog('Unlocking bootloader...', 'info');
      this.onLog('⚠️ User must confirm on device screen', 'info');
      await this.device.runCommand('flashing unlock');
      this.onLog('Bootloader unlock command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Unlock failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Lock bootloader
   */
  async lockBootloader(): Promise<boolean> {
    if (!this.device) return false;

    try {
      this.onLog('Locking bootloader...', 'info');
      this.onLog('⚠️ User must confirm on device screen', 'info');
      await this.device.runCommand('flashing lock');
      this.onLog('Bootloader lock command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Lock failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Flash a partition from file
   */
  async flashPartition(
    partitionName: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    if (!this.device) return false;

    try {
      this.onLog(`Flashing ${partitionName}...`, 'info');
      
      const buffer = await file.arrayBuffer();
      
      await this.device.flashBlob(partitionName, new Blob([buffer]), {
        onProgress: (bytes, total) => {
          const percent = Math.round((bytes / total) * 100);
          onProgress?.(percent);
        }
      });

      this.onLog(`${partitionName} flashed successfully`, 'success');
      return true;
    } catch (error) {
      this.onLog(`Flash failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Flash vbmeta with --disable-verity --disable-verification
   */
  async flashVbmetaDisabled(file: File): Promise<boolean> {
    if (!this.device) return false;

    try {
      this.onLog('Flashing vbmeta with disabled verification...', 'info');
      
      const buffer = await file.arrayBuffer();
      
      // Some devices need special flags
      await this.device.runCommand('flash:vbmeta --disable-verity --disable-verification');
      await this.device.flashBlob('vbmeta', new Blob([buffer]));

      this.onLog('vbmeta flashed successfully', 'success');
      return true;
    } catch (error) {
      this.onLog(`Flash failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Erase a partition
   */
  async erasePartition(partitionName: string): Promise<boolean> {
    if (!this.device) return false;

    try {
      this.onLog(`Erasing ${partitionName}...`, 'info');
      await this.device.runCommand(`erase:${partitionName}`);
      this.onLog(`${partitionName} erased`, 'success');
      return true;
    } catch (error) {
      this.onLog(`Erase failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Reboot to system
   */
  async reboot(): Promise<boolean> {
    if (!this.device) return false;

    try {
      this.onLog('Rebooting to system...', 'info');
      await this.device.runCommand('reboot');
      this.onLog('Reboot command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Reboot failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Reboot to bootloader
   */
  async rebootBootloader(): Promise<boolean> {
    if (!this.device) return false;

    try {
      this.onLog('Rebooting to bootloader...', 'info');
      await this.device.runCommand('reboot-bootloader');
      this.onLog('Reboot command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Reboot failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Reboot to recovery
   */
  async rebootRecovery(): Promise<boolean> {
    if (!this.device) return false;

    try {
      this.onLog('Rebooting to recovery...', 'info');
      await this.device.runCommand('reboot-recovery');
      this.onLog('Reboot command sent', 'success');
      return true;
    } catch (error) {
      this.onLog(`Reboot failed: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (this.device) {
      // FastbootDevice doesn't have explicit disconnect
      this.device = null;
    }
    this.onLog('Fastboot disconnected', 'info');
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.device !== null;
  }
}
```

---

## State Management

### ADR-009: Device Store Enhancement

**Decision:** Extend `deviceStore` with mode selection

```typescript
// src/stores/deviceStore.ts (enhanced)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DeviceMode = 'edl' | 'adb' | 'fastboot';

interface DeviceState {
  // Mode selection
  currentMode: DeviceMode;
  setMode: (mode: DeviceMode) => void;

  // Connection state (mode-independent)
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Device info (varies by mode)
  deviceInfo: Record<string, unknown> | null;
  setDeviceInfo: (info: Record<string, unknown> | null) => void;

  // EDL-specific (existing)
  selectedDevice: DeviceProfile | null;
  firehoseLoaded: boolean;
  
  // Error state
  connectionError: string | null;
  setConnectionError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      // Mode
      currentMode: 'edl',
      setMode: (mode) => set({ currentMode: mode, isConnected: false, deviceInfo: null }),

      // Connection
      isConnected: false,
      setConnected: (connected) => set({ isConnected: connected }),

      // Device info
      deviceInfo: null,
      setDeviceInfo: (info) => set({ deviceInfo: info }),

      // EDL (existing)
      selectedDevice: null,
      firehoseLoaded: false,

      // Error
      connectionError: null,
      setConnectionError: (error) => set({ connectionError: error }),

      // Reset
      reset: () => set({
        isConnected: false,
        deviceInfo: null,
        connectionError: null,
      }),
    }),
    {
      name: 'device-storage',
      partialize: (state) => ({ currentMode: state.currentMode }),
    }
  )
);
```

### ADR-010: ADB Store

```typescript
// src/stores/adbStore.ts

import { create } from 'zustand';
import type { ADBDeviceInfo } from '@/core/ADBProtocol';

interface ADBState {
  // Device info
  deviceInfo: ADBDeviceInfo | null;
  setDeviceInfo: (info: ADBDeviceInfo | null) => void;

  // Connection
  isConnecting: boolean;
  setConnecting: (connecting: boolean) => void;

  // Operations
  pendingOperation: string | null;
  setPendingOperation: (op: string | null) => void;

  // Reset
  reset: () => void;
}

export const useADBStore = create<ADBState>((set) => ({
  deviceInfo: null,
  setDeviceInfo: (info) => set({ deviceInfo: info }),

  isConnecting: false,
  setConnecting: (connecting) => set({ isConnecting: connecting }),

  pendingOperation: null,
  setPendingOperation: (op) => set({ pendingOperation: op }),

  reset: () => set({
    deviceInfo: null,
    isConnecting: false,
    pendingOperation: null,
  }),
}));
```

### ADR-011: Fastboot Store

```typescript
// src/stores/fastbootStore.ts

import { create } from 'zustand';
import type { FastbootDeviceInfo } from '@/core/FastbootProtocol';

interface FastbootState {
  // Device info
  deviceInfo: FastbootDeviceInfo | null;
  setDeviceInfo: (info: FastbootDeviceInfo | null) => void;

  // Connection
  isConnecting: boolean;
  setConnecting: (connecting: boolean) => void;

  // Flash progress
  flashProgress: {
    partition: string;
    progress: number;
  } | null;
  setFlashProgress: (progress: { partition: string; progress: number } | null) => void;

  // Operations
  pendingOperation: string | null;
  setPendingOperation: (op: string | null) => void;

  // Reset
  reset: () => void;
}

export const useFastbootStore = create<FastbootState>((set) => ({
  deviceInfo: null,
  setDeviceInfo: (info) => set({ deviceInfo: info }),

  isConnecting: false,
  setConnecting: (connecting) => set({ isConnecting: connecting }),

  flashProgress: null,
  setFlashProgress: (progress) => set({ flashProgress: progress }),

  pendingOperation: null,
  setPendingOperation: (op) => set({ pendingOperation: op }),

  reset: () => set({
    deviceInfo: null,
    isConnecting: false,
    flashProgress: null,
    pendingOperation: null,
  }),
}));
```

---

## React Hooks

### ADR-012: useADB Hook

```typescript
// src/hooks/useADB.ts

import { useRef, useCallback } from 'react';
import { ADBProtocol } from '@/core/ADBProtocol';
import { useDeviceStore } from '@/stores/deviceStore';
import { useADBStore } from '@/stores/adbStore';
import { useTerminalStore } from '@/stores/terminalStore';

export function useADB() {
  const adbRef = useRef<ADBProtocol | null>(null);
  
  const { setConnected, setConnectionError } = useDeviceStore();
  const { setDeviceInfo, setConnecting, setPendingOperation, reset } = useADBStore();
  const { log } = useTerminalStore();

  const getADB = useCallback(() => {
    if (!adbRef.current) {
      adbRef.current = new ADBProtocol((msg, level) => log(level || 'info', msg));
    }
    return adbRef.current;
  }, [log]);

  const connect = useCallback(async () => {
    const adb = getADB();
    setConnecting(true);
    setConnectionError(null);

    try {
      const success = await adb.connect();
      if (success) {
        setConnected(true);
        const info = await adb.getDeviceInfo();
        setDeviceInfo(info);
        log('success', `Connected to ${info?.model || 'device'}`);
      }
      return success;
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setConnecting(false);
    }
  }, [getADB, setConnected, setDeviceInfo, setConnecting, setConnectionError, log]);

  const disconnect = useCallback(async () => {
    const adb = getADB();
    await adb.disconnect();
    setConnected(false);
    reset();
  }, [getADB, setConnected, reset]);

  const rebootToEDL = useCallback(async () => {
    const adb = getADB();
    setPendingOperation('reboot-edl');
    const success = await adb.rebootToEDL();
    setPendingOperation(null);
    if (success) {
      await disconnect();
    }
    return success;
  }, [getADB, setPendingOperation, disconnect]);

  const rebootToBootloader = useCallback(async () => {
    const adb = getADB();
    setPendingOperation('reboot-bootloader');
    const success = await adb.rebootToBootloader();
    setPendingOperation(null);
    if (success) {
      await disconnect();
    }
    return success;
  }, [getADB, setPendingOperation, disconnect]);

  const rebootToRecovery = useCallback(async () => {
    const adb = getADB();
    setPendingOperation('reboot-recovery');
    const success = await adb.rebootToRecovery();
    setPendingOperation(null);
    if (success) {
      await disconnect();
    }
    return success;
  }, [getADB, setPendingOperation, disconnect]);

  const reboot = useCallback(async () => {
    const adb = getADB();
    setPendingOperation('reboot');
    const success = await adb.reboot();
    setPendingOperation(null);
    if (success) {
      await disconnect();
    }
    return success;
  }, [getADB, setPendingOperation, disconnect]);

  const shutdown = useCallback(async () => {
    const adb = getADB();
    setPendingOperation('shutdown');
    const success = await adb.shutdown();
    setPendingOperation(null);
    if (success) {
      await disconnect();
    }
    return success;
  }, [getADB, setPendingOperation, disconnect]);

  return {
    connect,
    disconnect,
    rebootToEDL,
    rebootToBootloader,
    rebootToRecovery,
    reboot,
    shutdown,
    isConnected: adbRef.current?.isConnected ?? false,
  };
}
```

### ADR-013: useFastboot Hook

```typescript
// src/hooks/useFastboot.ts

import { useRef, useCallback } from 'react';
import { FastbootProtocol } from '@/core/FastbootProtocol';
import { useDeviceStore } from '@/stores/deviceStore';
import { useFastbootStore } from '@/stores/fastbootStore';
import { useTerminalStore } from '@/stores/terminalStore';

export function useFastboot() {
  const fastbootRef = useRef<FastbootProtocol | null>(null);
  
  const { setConnected, setConnectionError } = useDeviceStore();
  const { 
    setDeviceInfo, 
    setConnecting, 
    setFlashProgress,
    setPendingOperation, 
    reset 
  } = useFastbootStore();
  const { log } = useTerminalStore();

  const getFastboot = useCallback(() => {
    if (!fastbootRef.current) {
      fastbootRef.current = new FastbootProtocol((msg, level) => log(level || 'info', msg));
    }
    return fastbootRef.current;
  }, [log]);

  const connect = useCallback(async () => {
    const fb = getFastboot();
    setConnecting(true);
    setConnectionError(null);

    try {
      const success = await fb.connect();
      if (success) {
        setConnected(true);
        const info = await fb.getDeviceInfo();
        setDeviceInfo(info);
        log('success', `Connected to ${info?.product || 'device'}`);
      }
      return success;
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setConnecting(false);
    }
  }, [getFastboot, setConnected, setDeviceInfo, setConnecting, setConnectionError, log]);

  const disconnect = useCallback(async () => {
    const fb = getFastboot();
    await fb.disconnect();
    setConnected(false);
    reset();
  }, [getFastboot, setConnected, reset]);

  const unlockBootloader = useCallback(async () => {
    const fb = getFastboot();
    setPendingOperation('unlock');
    const success = await fb.unlockBootloader();
    setPendingOperation(null);
    // Refresh device info after unlock
    if (success) {
      const info = await fb.getDeviceInfo();
      setDeviceInfo(info);
    }
    return success;
  }, [getFastboot, setPendingOperation, setDeviceInfo]);

  const lockBootloader = useCallback(async () => {
    const fb = getFastboot();
    setPendingOperation('lock');
    const success = await fb.lockBootloader();
    setPendingOperation(null);
    if (success) {
      const info = await fb.getDeviceInfo();
      setDeviceInfo(info);
    }
    return success;
  }, [getFastboot, setPendingOperation, setDeviceInfo]);

  const flashPartition = useCallback(async (partition: string, file: File) => {
    const fb = getFastboot();
    setPendingOperation(`flash-${partition}`);
    setFlashProgress({ partition, progress: 0 });
    
    const success = await fb.flashPartition(partition, file, (progress) => {
      setFlashProgress({ partition, progress });
    });
    
    setFlashProgress(null);
    setPendingOperation(null);
    return success;
  }, [getFastboot, setPendingOperation, setFlashProgress]);

  const erasePartition = useCallback(async (partition: string) => {
    const fb = getFastboot();
    setPendingOperation(`erase-${partition}`);
    const success = await fb.erasePartition(partition);
    setPendingOperation(null);
    return success;
  }, [getFastboot, setPendingOperation]);

  const reboot = useCallback(async () => {
    const fb = getFastboot();
    setPendingOperation('reboot');
    const success = await fb.reboot();
    setPendingOperation(null);
    if (success) {
      await disconnect();
    }
    return success;
  }, [getFastboot, setPendingOperation, disconnect]);

  const rebootBootloader = useCallback(async () => {
    const fb = getFastboot();
    setPendingOperation('reboot-bootloader');
    const success = await fb.rebootBootloader();
    setPendingOperation(null);
    return success;
  }, [getFastboot, setPendingOperation]);

  const rebootRecovery = useCallback(async () => {
    const fb = getFastboot();
    setPendingOperation('reboot-recovery');
    const success = await fb.rebootRecovery();
    setPendingOperation(null);
    if (success) {
      await disconnect();
    }
    return success;
  }, [getFastboot, setPendingOperation, disconnect]);

  return {
    connect,
    disconnect,
    unlockBootloader,
    lockBootloader,
    flashPartition,
    erasePartition,
    reboot,
    rebootBootloader,
    rebootRecovery,
    isConnected: fastbootRef.current?.isConnected ?? false,
  };
}
```

---

## UI Components

### ADR-014: Mode Selector Component

```tsx
// src/components/layout/ModeSelector.tsx

import { useDeviceStore, DeviceMode } from '@/stores/deviceStore';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Smartphone, Terminal, Zap } from 'lucide-react';

const modes: { id: DeviceMode; labelKey: string; icon: typeof Smartphone }[] = [
  { id: 'edl', labelKey: 'mode.edl', icon: Zap },
  { id: 'adb', labelKey: 'mode.adb', icon: Terminal },
  { id: 'fastboot', labelKey: 'mode.fastboot', icon: Smartphone },
];

export function ModeSelector() {
  const { t } = useTranslation();
  const { currentMode, setMode, isConnected } = useDeviceStore();

  return (
    <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1">
      {modes.map(({ id, labelKey, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setMode(id)}
          disabled={isConnected}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            currentMode === id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-zinc-700/50',
            isConnected && currentMode !== id && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Icon className="h-4 w-4" />
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
```

### ADR-015: Page Routing

```tsx
// Update src/router.ts

import { ADBPage } from '@/pages/ADBPage';
import { FastbootPage } from '@/pages/FastbootPage';

// Add to routes:
{
  path: '/adb',
  element: <ADBPage />,
},
{
  path: '/fastboot',
  element: <FastbootPage />,
},
```

---

## Data Flow

### Connection Flow

```
User selects mode → Mode stored → Navigate to mode page
                                         ↓
                               Click "Connect"
                                         ↓
              ┌─────────────────────────────────────────────┐
              │           WebUSB requestDevice()            │
              │  with mode-specific VID/PID filters         │
              └─────────────────────────────────────────────┘
                                         ↓
              ┌─────────────────────────────────────────────┐
              │         Protocol-specific handshake          │
              │  EDL: Sahara → Firehose                      │
              │  ADB: RSA Key Exchange → Shell               │
              │  Fastboot: Direct command                    │
              └─────────────────────────────────────────────┘
                                         ↓
                    Store updated → UI reflects connection
                                         ↓
                         User performs operations
```

### Command Flow

```
User clicks button → Hook function called
                            ↓
              Protocol method executed
                            ↓
        ┌───────────────────────────────────┐
        │   Terminal log updated (onLog)    │
        └───────────────────────────────────┘
                            ↓
                ┌───────────────────┐
                │   Store updated   │
                └───────────────────┘
                            ↓
                     UI re-renders
```

---

## Security Considerations

### WebUSB Security

| Concern | Mitigation |
|---------|------------|
| HTTPS required | Already deployed on HTTPS |
| User permission | WebUSB requires explicit user grant |
| Device access | Only one app can access device at a time |
| RSA keys (ADB) | Stored in browser localStorage, not exported |

### Bootloader Operations

```typescript
// Always show warning dialogs before dangerous operations
const DANGEROUS_OPERATIONS = [
  'flashing unlock',
  'flashing lock',
  'erase',
  'flash',
];

// Require confirmation for destructive actions
async function confirmDangerousOperation(operation: string): Promise<boolean> {
  // Show AlertDialog with clear warning
  return new Promise((resolve) => {
    // UI confirmation
  });
}
```

---

## Implementation Phases

### Phase 1.1: Foundation (Week 1)

| Task | Files | Effort |
|------|-------|--------|
| Install dependencies | package.json | 0.5h |
| Create ADBProtocol.ts | src/core/ | 4h |
| Create FastbootProtocol.ts | src/core/ | 4h |
| Create stores | src/stores/ | 2h |
| Create hooks | src/hooks/ | 3h |

### Phase 1.2: UI Integration (Week 2)

| Task | Files | Effort |
|------|-------|--------|
| Mode Selector component | src/components/layout/ | 2h |
| Update Header/Navigation | src/components/layout/ | 2h |
| ADBPage with all buttons | src/pages/ | 6h |
| FastbootPage with all buttons | src/pages/ | 6h |
| i18n translations | src/i18n/ | 2h |

### Phase 1.3: Polish (Week 3)

| Task | Files | Effort |
|------|-------|--------|
| Flash file picker | src/components/features/fastboot/ | 4h |
| Error handling | All | 3h |
| Testing on real devices | - | 8h |
| Documentation | docs/ | 2h |

---

## Testing Strategy

### Manual Testing Matrix

| Mode | Device | Action | Expected Result |
|------|--------|--------|-----------------|
| ADB | Pixel 7 | Connect | Shows device info |
| ADB | Pixel 7 | Reboot EDL | Device enters 9008 mode |
| ADB | Pixel 7 | Reboot Fastboot | Device enters fastboot |
| Fastboot | Pixel 7 | Connect | Shows variables |
| Fastboot | Pixel 7 | Unlock | User prompted on device |
| Fastboot | Pixel 7 | Flash boot | Boot partition written |

### Browser Compatibility

| Browser | WebUSB | ADB | Fastboot | Notes |
|---------|--------|-----|----------|-------|
| Chrome 120+ | ✅ | ✅ | ✅ | Primary target |
| Edge 120+ | ✅ | ✅ | ✅ | Chromium-based |
| Firefox | ❌ | ❌ | ❌ | No WebUSB support |
| Safari | ❌ | ❌ | ❌ | No WebUSB support |

---

## Open Questions

1. **RSA Key Storage:** Should we persist ADB RSA keys across sessions? (Current: Yes via localStorage)

2. **Multi-device:** Should we support connecting multiple devices? (Current: No, Phase 2)

3. **OEM Commands:** Should we support device-specific OEM fastboot commands? (Current: No, Phase 2)

4. **Recovery Sideload:** Should ADB sideload be included in MVP? (Current: No, Phase 2)

---

_Generated by BMAD Architecture Workflow v1.0_  
_Date: 2025-12-30_  
_For: Nguyen_
