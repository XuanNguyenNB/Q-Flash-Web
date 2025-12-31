# Q-Flash-Web - Component Inventory

> **Generated:** 2025-12-29 | **Scan Level:** Exhaustive

---

## Overview

This document catalogs all UI components in the Q-Flash-Web application.

| Category | Count |
|----------|-------|
| **Pages** | 6 |
| **Reusable Components** | 3 |
| **UI Utilities** | 1 |

---

## Pages (`src/pages/`)

### 1. Tool Page (`tool.ts`)

**Purpose:** Main flash tool interface - the core functionality of the application.

**Size:** 3,042 lines | 107KB

**Key Functions:**
| Function | Lines | Description |
|----------|-------|-------------|
| `createToolHTML()` | 50-156 | Generates main tool UI HTML |
| `initTool()` | 162-205 | Initialize tool after DOM ready |
| `setupEventListeners()` | 211-226 | Bind all UI event handlers |
| `handleConnect()` | 723-754 | USB device connection flow |
| `handleStartUnlockFlow()` | 785-919 | Main authentication flow |
| `handleReadPartitions()` | 925-946 | Read partition table from device |
| `renderPartitionTable()` | 948-1114 | Display partition list with selection |
| `handleBackupSelected()` | ~1200+ | Backup selected partitions |
| `handleFlashFromXml()` | ~1500+ | Flash from rawprogram XML |
| `showFirehoseFilesPopup()` | 587-717 | Modal for manual file selection |

**State Management:**
```typescript
interface AppState {
  stage: AppStage;
  programmerData: Uint8Array | null;
  digestData: Uint8Array | null;
  signatureData: Uint8Array | null;
  isConnected: boolean;
}
```

---

### 2. Downloads Page (`downloads.ts`)

**Purpose:** Display available ROMs, tools, and utilities for download.

**Size:** 327 lines | 11.7KB

**Key Functions:**
| Function | Description |
|----------|-------------|
| `renderDownloadsPage()` | Main page renderer |
| `renderRomCard(rom)` | Individual ROM card component |
| `renderFilterBar(roms)` | Filter controls (brand, android, region) |
| `filterRoms(roms)` | Apply current filters to ROM list |
| `initFilterListeners(roms)` | Set up filter change handlers |

**Data Interfaces:**
```typescript
interface RomInfo {
  id: string;
  device: string;
  brand: string;
  version: string;
  android: string;
  region: string;
  size: string;
  format: 'extracted' | 'ozip' | 'zip';
  status: 'verified' | 'untested';
  links: { onedrive?: string; gdrive?: string; mega?: string };
}
```

**UI Features:**
- ✅ Search input
- ✅ Brand filter dropdown
- ✅ Android version filter
- ✅ Region filter
- ✅ ROM cards with badges

---

### 3. Devices Page (`devices.ts`)

**Purpose:** Display supported device list with status indicators.

**Size:** 108 lines | 4KB

**Key Functions:**
| Function | Description |
|----------|-------------|
| `renderDevicesPage()` | Main renderer, fetches device configs |

**UI Features:**
- ✅ Status legend (Tested/Beta/Coming)
- ✅ Device table with brand icons
- ✅ Chipset information
- ✅ Request device support section

---

### 4. Drivers Page (`drivers.ts`)

**Purpose:** Guide for installing USB drivers.

**Size:** 88 lines | 3.4KB

**Content:**
- WinUSB driver installation guide
- Zadig tool instructions
- Troubleshooting tips

---

### 5. Donate Page (`donate.ts`)

**Purpose:** Donation options for supporting development.

**Size:** 42 lines | 1.4KB

**Features:**
- MoMo QR code display
- Social media links

---

### 6. Support Page (`support.ts`)

**Purpose:** FAQ and support contact information.

**Size:** 88 lines | 3.2KB

**Features:**
- FAQ accordion
- Contact links (Telegram, Facebook)

---

## Reusable Components (`src/components/`)

### 1. Sidebar (`sidebar.ts`)

**Purpose:** Navigation sidebar with logo and menu items.

**Size:** 89 lines | 2.5KB

**Exports:**
| Function | Description |
|----------|-------------|
| `renderSidebar()` | Generate sidebar HTML |
| `updateSidebarActive(route)` | Update active state on navigation |
| `toggleSidebar()` | Expand/collapse sidebar |

**Configuration:**
```typescript
const NAV_ITEMS: NavItem[] = [
  { route: 'tool', icon: '📱', label: 'Flash Tool' },
  { route: 'downloads', icon: '⬇️', label: 'Downloads' },
  { route: 'drivers', icon: '🔧', label: 'Drivers' },
  { route: 'devices', icon: '📋', label: 'Devices' },
  { route: 'donate', icon: '☕', label: 'Donate' },
  { route: 'support', icon: '❓', label: 'Support' },
];
```

---

### 2. AI Chat Panel (`ai-chat.ts`)

**Purpose:** Integrated AI assistant for technical support.

**Size:** 363 lines | 12KB

**Exports:**
| Function | Description |
|----------|-------------|
| `renderAiChatPanel()` | Generate chat panel HTML |
| `initAiChat()` | Set up event handlers |

**Internal Functions:**
| Function | Description |
|----------|-------------|
| `handleSendMessage()` | Send user message to AI |
| `fetchAiResponse()` | Call CLI Proxy API |
| `addMessage()` | Add message to chat UI |
| `addMessageWithTypingEffect()` | Animated text reveal |
| `formatMessageContent()` | Basic markdown parsing |

**Configuration:**
```typescript
const AI_CONFIG = {
  apiUrl: 'http://34.177.106.101:8317/v1/chat/completions',
  apiKey: 'mitomtreem',
  model: 'gemini-3-flash-preview',
};
```

**Features:**
- ✅ Real-time AI responses
- ✅ Typing effect animation
- ✅ Markdown formatting (code, bold)
- ✅ Vietnamese language specialist

---

### 3. Presets (`presets.ts`)

**Purpose:** Device preset configurations with embedded binary imports.

**Size:** 65 lines | 2KB

**Exports:**
| Export | Description |
|--------|-------------|
| `DEVICE_PRESETS` | Record of preset configurations |
| `loadBinaryFile(url)` | Load binary file avoiding IDM |

**Preset Structure:**
```typescript
interface PresetConfig {
  name: string;
  available: boolean;
  files?: {
    programmer: string;
    digest: string;
    signature: string;
  };
}
```

---

## UI Utilities (`src/ui/`)

### Terminal (`Terminal.ts`)

**Purpose:** CLI-style logging terminal component.

**Size:** 200 lines | 7KB

**Class: Terminal**

| Method | Description |
|--------|-------------|
| `constructor(containerId)` | Create terminal in container |
| `log(message, level)` | Add log entry |
| `info(message)` | Log info level |
| `success(message)` | Log success level |
| `warning(message)` | Log warning level |
| `error(message)` | Log error level |
| `debug(message)` | Log debug level (hidden by default) |
| `clear()` | Clear all logs |
| `separator()` | Add visual separator line |
| `showPartitionTable(partitions)` | Render ASCII partition table |

**Features:**
- ✅ Color-coded log levels
- ✅ Timestamp display
- ✅ Auto-scroll to bottom
- ✅ Debug log toggle
- ✅ Max 10,000 entries

---

## Services (`src/services/`)

### DeviceConfig (`deviceConfig.ts`)

**Purpose:** Device configuration loading and firehose file fetching.

**Size:** 371 lines | 13KB

**Exports:**
| Function | Description |
|----------|-------------|
| `loadDeviceConfigs()` | Load devices.json with caching |
| `getDeviceById(id)` | Get specific device profile |
| `getDevicesByStatus(status)` | Filter by status |
| `getAvailableDevices()` | Get devices with firehose files |
| `loadFirehoseForDevice(device, onProgress, onLog)` | Load firehose files |
| `clearDeviceCache()` | Clear cached device list |

**Caching:**
- 5 minute cache duration
- Automatic invalidation

---

## Type Definitions (`src/types/index.ts`)

**Size:** 257 lines | 6.5KB

**Type Categories:**

| Category | Types |
|----------|-------|
| **USB** | `USBDeviceFilter`, `TransferResult`, `USBEndpoints`, `DeviceInfo` |
| **Sahara** | `SaharaCommand`, `SaharaState`, `SaharaHelloPacket`, `SaharaResult` |
| **Firehose** | `FirehoseCommand`, `FirehoseConfig`, `FirehoseResponse` |
| **Partition** | `PartitionInfo`, `GPTHeader` |
| **VIP Auth** | `VipAuthConfig`, `VipAuthStep`, `VipAuthResult` |
| **UI** | `LogLevel`, `LogEntry`, `AppStage`, `AppState`, `StatusUpdate` |
| **Events** | `AppEvents` |
| **Validation** | `FileValidation`, `ExpectedFileSizes` |

---

## Router (`router.ts`)

**Purpose:** Hash-based SPA navigation.

**Size:** 119 lines | 3.1KB

**Class: Router**

| Method | Description |
|--------|-------------|
| `register(config)` | Add route configuration |
| `init(containerId, onChange?)` | Initialize with content container |
| `navigate(route)` | Navigate to route |
| `getCurrentRoute()` | Get current route |
| `getRoutes()` | Get all registered routes |

**Route Type:**
```typescript
type Route = 'tool' | 'downloads' | 'drivers' | 'devices' | 'donate' | 'support';
```

---

## i18n System (`src/i18n/`)

### i18n.ts

**Size:** 79 lines | 2.2KB

**Exports:**
| Function | Description |
|----------|-------------|
| `initI18n()` | Load saved language from localStorage |
| `getCurrentLanguage()` | Get current language ('vi' or 'en') |
| `setLanguage(lang)` | Set language and persist |
| `t(key, variables?)` | Translate key with optional interpolation |

**Translation Structure:**
```typescript
// Nested keys supported: 'header.title'
// Variable interpolation: t('msg.count', { count: 5 })
```

### Translation Files

| File | Size | Language |
|------|------|----------|
| `en.json` | 5.5KB | English |
| `vi.json` | 6.2KB | Vietnamese |
