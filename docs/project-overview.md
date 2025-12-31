# Q-Flash-Web - Project Overview

> **Generated:** 2025-12-29 | **Scan Level:** Exhaustive

---

## Executive Summary

**Q-Flash-Web** is a browser-based **Universal Qualcomm Flash Tool** that leverages the **WebUSB API** to communicate directly with Qualcomm devices in **EDL (Emergency Download Mode - 9008)**. This eliminates the need for native desktop applications, allowing users to flash firmware, backup partitions, and recover bricked devices using only a modern web browser.

### Key Features

| Feature | Description |
|---------|-------------|
| 🔓 **WebUSB Flashing** | Direct USB communication without native apps |
| 📱 **Multi-Brand Support** | Oppo, OnePlus, Realme (Qualcomm-based) |
| 💾 **Partition Operations** | Read, write, backup individual or batch partitions |
| 🔐 **VIP Authentication** | Oppo-specific security handshake support |
| 🌐 **Multilingual** | Vietnamese & English UI |
| 🤖 **AI Assistant** | Built-in AI chat for technical support |
| ⬇️ **ROM Downloads** | Curated firmware download library |

---

## Target Users

1. **Device Repair Technicians** - Flash firmware to recover bricked devices
2. **Developers** - Test custom ROMs and modifications
3. **Advanced Users** - Backup/restore device partitions
4. **ROM Developers** - Distribute firmware via web-based tool

---

## Technical Architecture

### High-Level Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Browser   │────▶│   WebUSB    │────▶│  Qualcomm 9008  │
│ (Q-Flash)   │◀────│    API      │◀────│  (EDL Device)   │
└─────────────┘     └─────────────┘     └─────────────────┘
       │                                        │
       │                                        ▼
       │                               ┌─────────────────┐
       │                               │ Sahara Protocol │
       │                               │ (Upload Loader) │
       │                               └────────┬────────┘
       │                                        │
       │                                        ▼
       │                               ┌─────────────────┐
       ├───────────────────────────────│ Firehose Proto  │
       │         XML Commands          │ (Flash/Read)    │
       └──────────────────────────────▶└─────────────────┘
```

### Protocol Stack

| Layer | Protocol | Purpose |
|-------|----------|---------|
| **Transport** | WebUSB (Bulk IN/OUT) | Raw USB data transfer |
| **Stage 1** | Sahara | Upload Firehose programmer to device RAM |
| **Stage 2** | Firehose | XML-based partition operations |
| **Security** | VIP Auth | Oppo OEM authentication (digest + signature) |

---

## Module Architecture

### Core Protocol Modules

```
src/core/
├── WebUSBManager.ts    # USB device abstraction
│   └── Methods: connect, disconnect, transferIn, transferOut
│
├── SaharaProtocol.ts   # Bootloader upload protocol
│   └── Methods: execute, loadProgrammer, receiveHello
│
└── FirehoseProtocol.ts # Main flash protocol
    └── Methods: configure, getPartitions, readPartition, writePartition
```

### Application Modules

```
src/
├── main.ts          # App bootstrap & route registration
├── router.ts        # Hash-based SPA navigation
├── tool.ts          # Main flash tool orchestration
├── presets.ts       # Device preset binary imports
├── components/      # Reusable UI components
├── pages/           # Route-based pages
├── services/        # Business logic (device config)
├── types/           # TypeScript interfaces
├── i18n/            # Internationalization
└── ui/              # UI utilities (Terminal)
```

---

## State Management

The application uses a simple **module-level state pattern**:

```typescript
// src/tool.ts
interface AppState {
  stage: AppStage;
  programmerData: Uint8Array | null;
  digestData: Uint8Array | null;
  signatureData: Uint8Array | null;
  isConnected: boolean;
}

const state: AppState = { ... };
```

### Application Stages

| Stage | Value | Description |
|-------|-------|-------------|
| `IDLE` | 0 | Initial state |
| `CONNECTING` | 1 | USB connection in progress |
| `SAHARA` | 2 | Uploading programmer |
| `VIP_HANDSHAKE` | 3 | Authentication in progress |
| `FIREHOSE_CONFIG` | 4 | Configuring Firehose |
| `READY` | 5 | Ready for partition operations |

---

## Configuration System

### Device Profiles (`/configs/devices.json`)

```json
{
  "id": "oppo-find-x7-ultra",
  "brand": "oppo",
  "name": "Find X7 Ultra",
  "codename": "PHY110",
  "chipset": "SM8650",
  "chipsetName": "Snapdragon 8 Gen 3",
  "status": "tested",
  "authMethod": "oppo_vip",
  "presetId": "8Gen3",
  "firehose": {
    "programmerUrl": "/firehose/x7ultra/programmer.melf",
    "digestUrl": "/firehose/x7ultra/digest.elf",
    "signatureUrl": "/firehose/x7ultra/signature.bin"
  }
}
```

### Firehose Files Structure

| File | Size | Purpose |
|------|------|---------|
| `programmer.melf` | ~1-3MB | EDL programmer binary |
| `digest.elf` | ~30-40KB | VIP authentication digest |
| `signature.bin` | ~3-5KB | VIP authentication signature |

---

## Internationalization (i18n)

Supports **Vietnamese (vi)** and **English (en)**:

```typescript
// Usage
import { t } from './i18n/i18n';

const label = t('partition.selectAll'); // Returns translated string
```

### Translation Structure

```json
{
  "header": { "title": "Q-Flash" },
  "buttons": { "connect": "Kết nối thiết bị" },
  "partition": { "selectAll": "Chọn tất cả" },
  "aiPanel": { "title": "AI Assistant" }
}
```

---

## Security Model

### VIP Authentication Flow (Oppo)

```
1. Load programmer.melf → Upload via Sahara
2. Load digest.elf → Send via Firehose VIP command
3. Load signature.bin → Complete handshake
4. Device unlocked for partition operations
```

### Protected Partitions

| LUN | Partitions | Risk Level |
|-----|------------|------------|
| LUN0-4 | System, Boot, Super | Medium - Safe to modify |
| **LUN5** | IMEI, Calibration, Persist | **CRITICAL - Never flash!** |

---

## Browser Compatibility

| Browser | WebUSB Support | Status |
|---------|----------------|--------|
| Chrome 61+ | ✅ Full | Recommended |
| Edge 79+ | ✅ Full | Supported |
| Opera 48+ | ✅ Full | Supported |
| Firefox | ❌ None | Not supported |
| Safari | ❌ None | Not supported |

---

## Known Limitations

1. **Browser-only** - Requires WebUSB-capable browser
2. **Windows driver** - User must install WinUSB driver for EDL devices
3. **Session limits** - Oppo devices have ~1.8GB per-session transfer limit
4. **Large files** - Files >1GB require streaming approach

---

## Future Roadmap

Based on `bmm-workflow-status.yaml`:

1. ⬇️ **Download Driver** - Auto-download driver packages
2. 📱 **Device List** - Expanded device support database
3. 💰 **Ads Integration** - Optional monetization
4. ⚡ **Performance** - Optimized large file handling
