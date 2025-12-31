# AGENTS.md - Q-Flash Web

> Guidelines for AI agents working in this repository

## Project Overview

**Q-Flash Web** is a browser-based WebUSB tool for flashing Qualcomm EDL (Emergency Download) mode devices, specifically targeting Oppo/OnePlus/Realme phones with Qualcomm Snapdragon chipsets.

**Core functionality:**
- Connect to Qualcomm 9008 EDL mode devices via WebUSB
- Upload programmer files via Sahara protocol
- Authenticate using Oppo VIP handshake
- Read/write partitions via Firehose protocol
- Flash ROM images from rawprogram XML files

**Tech stack:** TypeScript, Vite, vanilla DOM (no framework)

---

## Essential Commands

```bash
# Development
npm run dev      # Start Vite dev server (hot reload)

# Build
npm run build    # TypeScript check + Vite production build

# Preview production build
npm run preview  # Serve the dist/ folder locally

# Type checking only
npx tsc --noEmit  # Check TypeScript without emitting
```

**No test framework is configured** - testing is done manually via browser.

---

## Code Organization

```
src/
├── main.ts                 # Entry point, app shell, route registration
├── router.ts               # Hash-based SPA router
├── tool.ts                 # Main flash tool logic (2000+ lines)
├── presets.ts              # Local preset file loaders
├── style.css               # All CSS styles
│
├── core/                   # Protocol implementations
│   ├── WebUSBManager.ts    # USB device connection, bulk transfers
│   ├── SaharaProtocol.ts   # Qualcomm Sahara upload protocol
│   └── FirehoseProtocol.ts # Qualcomm Firehose XML protocol (read/write)
│
├── auth/
│   └── AuthStrategy.ts     # Oppo VIP authentication handshake
│
├── types/
│   └── index.ts            # All TypeScript interfaces and enums
│
├── utils/
│   └── xml.ts              # XML command building and parsing
│
├── services/
│   └── deviceConfig.ts     # Device profile loading, firehose fetching
│
├── ui/
│   └── Terminal.ts         # CLI-style log display component
│
├── components/
│   ├── sidebar.ts          # Navigation sidebar
│   └── ai-chat.ts          # AI chat panel component
│
├── pages/                  # Route page renderers
│   ├── tool.ts             # Flash tool page wrapper
│   ├── downloads.ts
│   ├── drivers.ts
│   ├── devices.ts
│   ├── donate.ts
│   └── support.ts
│
└── i18n/
    ├── i18n.ts             # Internationalization service
    └── translations/
        ├── en.json
        └── vi.json
```

### Public Assets

```
public/
├── configs/
│   └── devices.json        # Device profiles (chipsets, firehose URLs)
│
└── firehose/               # Bundled firehose files by chipset
    ├── SM8650_8Gen3/       # Snapdragon 8 Gen 3
    ├── SM8550_8Gen2/       # Snapdragon 8 Gen 2
    ├── SM8475_8+Gen1/      # Snapdragon 8+ Gen 1
    └── SM8750_8Elite/      # Snapdragon 8 Elite
```

---

## Architecture Patterns

### Protocol Layer Stack

```
┌──────────────────────┐
│      tool.ts         │  Application logic, UI state
├──────────────────────┤
│   FirehoseProtocol   │  XML commands (read/write/erase)
├──────────────────────┤
│   SaharaProtocol     │  Programmer upload
├──────────────────────┤
│   OppoVipAuth        │  Device authentication
├──────────────────────┤
│   WebUSBManager      │  USB bulk transfers
└──────────────────────┘
```

### Connection Flow

1. **User selects device** → Loads firehose files (programmer + digest + signature)
2. **Connect to USB** → `WebUSBManager.connect()` claims Qualcomm 9008 device
3. **Sahara upload** → `SaharaProtocol.execute()` uploads programmer
4. **VIP handshake** → `OppoVipAuth.execute()` authenticates with digest + signature
5. **Configure Firehose** → `FirehoseProtocol.configure()` sets up XML protocol
6. **Ready for operations** → Read partitions, backup, flash

### State Management

Application state is managed via a plain object in `tool.ts`:

```typescript
const state: AppState = {
  stage: AppStage.IDLE,        // Current operation stage
  programmerData: null,         // Loaded firehose programmer
  digestData: null,             // Loaded digest file
  signatureData: null,          // Loaded signature file
  isConnected: false,           // USB connection status
};
```

Global state for partitions is stored on `window`:
- `(window as any).__partitions` - Loaded partition table
- `(window as any).__selectedPartitions` - Set of selected partition indices
- `(window as any).__flashFiles` - Map of partition index to flash file

---

## Code Conventions

### TypeScript Patterns

- **Strict mode enabled** - All code must pass strict TypeScript checks
- **ES2022 target** - Modern JavaScript features like BigInt are used
- **Module imports** - Use `.ts` extensions in imports (Vite bundler mode)
- **Type imports** - Use `import type` for type-only imports

```typescript
// Good
import type { PartitionInfo, DeviceInfo } from '../types';
import { WebUSBManager } from './WebUSBManager';

// Bad - don't mix type and value imports without type keyword
import { PartitionInfo, WebUSBManager } from '../types';
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `WebUSBManager`, `FirehoseProtocol` |
| Interfaces/Types | PascalCase | `DeviceInfo`, `TransferResult` |
| Functions | camelCase | `handleConnect`, `renderPartitionTable` |
| Constants | UPPER_SNAKE | `QUALCOMM_VID`, `EDL_PID` |
| Enums | PascalCase values | `AppStage.IDLE`, `SaharaCommand.HELLO` |
| Files | kebab-case or camelCase | `device-config.ts`, `WebUSBManager.ts` |

### Async Patterns

All USB operations are async. Use proper error handling:

```typescript
async function handleConnect(): Promise<void> {
  try {
    const deviceInfo = await usb.connect();
    terminal.success(`Connected: ${deviceInfo.productName}`);
  } catch (error) {
    terminal.error(`Connection failed: ${error instanceof Error ? error.message : error}`);
  }
}
```

### Logging

Use the `Terminal` class for user-visible logging:

```typescript
terminal.info('Starting operation...');     // Blue
terminal.success('Operation complete!');    // Green
terminal.warning('Something might be wrong'); // Yellow
terminal.error('Operation failed!');        // Red
terminal.debug('Debug info...');            // Gray (hidden by default)
```

Protocol classes accept logger callbacks:

```typescript
const firehose = new FirehoseProtocol(usb, (msg, level) => {
  switch (level) {
    case 'debug': terminal.debug(msg); break;
    case 'error': terminal.error(msg); break;
    case 'success': terminal.success(msg); break;
    default: terminal.info(msg);
  }
});
```

---

## Key Files to Understand

### `src/tool.ts`
Main application logic. ~2500 lines. Contains:
- State management
- Event handlers
- Partition table rendering
- Flash operations (single partition, batch, XML-based)
- Connection flow orchestration

### `src/core/FirehoseProtocol.ts`
The largest protocol file (~1700 lines). Implements:
- `configure()` - Initialize Firehose with memory type and payload size
- `getPartitions()` / `getAllPartitions()` - Read GPT partition table
- `readPartition()` / `readPartitionToFile()` - Backup partitions
- `writePartition()` / `writePartitionChunked()` - Flash partitions
- `patch()` - Write specific bytes at offsets
- `power()` / `reset()` - Device power control

### `src/core/WebUSBManager.ts`
USB abstraction layer:
- `connect()` / `disconnect()` - Device connection
- `transferIn()` / `transferOut()` - Bulk data transfer
- `reconnect()` - Re-establish connection after device reset

### `src/auth/AuthStrategy.ts`
Oppo VIP authentication:
1. Send digest file (raw binary)
2. Send verify command (XML)
3. Send signature file (raw binary)
4. Send sha256init command (XML)

---

## Important Gotchas

### WebUSB Requirements

- **HTTPS required** - WebUSB only works on HTTPS or localhost
- **Chrome/Edge only** - Firefox doesn't support WebUSB
- **WinUSB driver** - Users must install WinUSB driver via Zadig on Windows
- **32MB transfer limit** - WebUSB has max 32MB per transfer, code uses 16MB chunks

### Qualcomm Protocol Specifics

- **Sector sizes**: UFS = 4096 bytes, eMMC = 512 bytes
- **LUN5 protection**: Calibration data - always skip flashing
- **Session limit**: ~1.8GB per session, need VIP re-auth for larger reads
- **GPT first**: When flashing ROMs, GPT tables must be flashed before partitions

### BigInt Usage

Partition offsets and sizes use `bigint` for 64-bit values:

```typescript
const startSector: bigint = partition.startSector;
const sizeInBytes = Number(partition.sizeInSectors) * 4096;
```

### Protected Partitions

Some partitions need "spoof mode" to bypass device protection:

```typescript
const PROTECTED_PARTITIONS = ['super', 'splash_odm', 'vm-bootsys_a', 'vm-bootsys_b'];
// Use spoofLabel: 'BackupGPT', spoofFilename: 'gpt_backup0.bin'
```

### File Padding

All writes must be sector-aligned:

```typescript
const paddedSize = Math.ceil(fileSize / sectorSize) * sectorSize;
if (fileSize !== paddedSize) {
  // Pad data with zeros
}
```

---

## i18n System

Translations in `src/i18n/translations/{en,vi}.json`.

```typescript
import { t, getCurrentLanguage, setLanguage } from './i18n/i18n';

// Usage
t('sidebar.devicePreset');                    // Simple key
t('partition.count', { count: 5 });           // With variables: "{{count}} partitions"
setLanguage('en');                            // Switch language
```

---

## Device Configuration

Device profiles in `public/configs/devices.json`:

```json
{
  "id": "x7_ultra",
  "brand": "oppo",
  "name": "Find X7 Ultra",
  "chipset": "SM8650",
  "chipsetName": "Snapdragon 8 Gen 3",
  "status": "tested",
  "authMethod": "oppo_vip",
  "firehose": {
    "programmerUrl": "https://...",
    "digestUrl": "https://...",
    "signatureUrl": "https://..."
  }
}
```

Firehose files can be loaded from:
1. Remote URLs (GitHub raw)
2. Local presets (`public/firehose/...`)

---

## Common Tasks

### Adding a New Device

1. Add device profile to `public/configs/devices.json`
2. Add firehose files to `public/firehose/{chipset}/` or provide URLs
3. Test connection and flashing

### Modifying Flash Behavior

Look in `tool.ts`:
- `handleFlashSelected()` - Single partition flash
- `handleFlashFromXml()` - XML batch flash
- `showFlashConfirmDialog()` - Flash confirmation UI

### Adding a New Protocol Command

In `FirehoseProtocol.ts`:

```typescript
async newCommand(params: any): Promise<FirehoseResponse> {
  const command = buildXmlCommand('newcommand', {
    param1: params.value,
  });
  return this.sendCommand(command);
}
```

### Debugging Protocol Issues

1. Enable debug logs: Check "Show DEBUG logs" in terminal
2. Check browser DevTools console for raw USB data
3. Protocol responses are logged as `RX: ...`

---

## Build & Deploy

```bash
# Production build
npm run build

# Output in dist/
# Can be deployed to any static hosting (GitHub Pages, Netlify, etc.)
```

Build output:
- `dist/index.html`
- `dist/assets/` - JS, CSS bundles
- `dist/firehose/` - Bundled firehose files
- `dist/configs/` - Device configuration

---

## Dependencies

**Dev Dependencies only** - No runtime dependencies:
- `typescript` - Type checking
- `vite` - Build tool and dev server
- `@types/w3c-web-usb` - WebUSB type definitions

---

## File Size Guidelines

| File Type | Expected Size |
|-----------|---------------|
| Programmer (.melf) | 1-3 MB |
| Digest (.elf) | 30-40 KB |
| Signature (.bin) | 3-5 KB |

---

## Security Notes

- **Never commit firehose files** for devices you don't own
- **Protected partitions** exist for a reason - warn users about brick risks
- **LUN5 calibration data** - Never flash, can cause hardware issues
- **Critical partitions** (boot, recovery, frp) - Extra confirmation required
