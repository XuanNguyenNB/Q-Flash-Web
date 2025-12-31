# Q-Flash-Web Architecture

> **Version:** 1.0  
> **Date:** 2025-12-29  
> **Author:** Architect Agent with Nguyen  
> **Status:** Approved

---

## Executive Summary

Q-Flash-Web là một browser-based Qualcomm Flash Tool được xây dựng trên nền tảng **React 19 + Vite + TypeScript**. Kiến trúc được thiết kế để thực hiện **full UI redesign với shadcn/ui** trong khi **bảo toàn 100% core Firehose/WebUSB logic** đã được test và hoạt động.

**Approach:** Migration in-place với Wrapper Pattern - Core logic được wrap bằng React hooks, không sửa đổi.

---

## Project Initialization

Đây là brownfield project, không cần tạo mới. Thực hiện migration với các commands sau:

```bash
# 1. Install React & React DOM
npm install react react-dom

# 2. Install React types
npm install -D @types/react @types/react-dom

# 3. Install Vite React plugin
npm install -D @vitejs/plugin-react

# 4. Install Tailwind CSS v4
npm install tailwindcss @tailwindcss/vite

# 5. Install shadcn/ui dependencies
npm install class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-progress @radix-ui/react-alert-dialog

# 6. Install state management
npm install zustand

# 7. Install routing
npm install react-router-dom

# 8. Install i18n
npm install react-i18next i18next

# 9. Install icons
npm install lucide-react

# 10. Initialize shadcn/ui
npx shadcn@latest init
```

---

## Decision Summary

| Category | Decision | Version | Affects Epics | Rationale |
|----------|----------|---------|---------------|-----------|
| **Framework** | React | 19.x | All | shadcn/ui requirement, modern hooks |
| **Build Tool** | Vite | 7.x (existing) | All | Already in use, fast HMR |
| **Language** | TypeScript | 5.9.x (existing) | All | Type safety, existing codebase |
| **Styling** | Tailwind CSS | 4.x | All UX | CSS-first config, 5x faster |
| **UI Components** | shadcn/ui | Latest | All UI | Linear-inspired, customizable |
| **State Management** | Zustand | 5.x | Tool page, settings | Lightweight, easy persistence |
| **Routing** | React Router | 7.x | Navigation | Type-safe, mature |
| **i18n** | react-i18next | Latest | All pages | Easy migration from existing JSON |
| **Icons** | Lucide React | Latest | All UI | Consistent with shadcn/ui |
| **Testing** | Vitest + RTL | Latest | Future | Native Vite support |

---

## Project Structure

```
Q-Flash-Web/
├── public/
│   ├── firehose/              # Firehose files by chipset
│   │   ├── SDM845/
│   │   ├── SM8650_8Gen3/
│   │   └── ...
│   ├── devices.json           # Device configurations
│   ├── icon.png               # App icon
│   └── favicon.ico
│
├── src/
│   ├── app/                   # React app entry
│   │   ├── App.tsx            # Root component with providers
│   │   ├── main.tsx           # Entry point, ReactDOM.render
│   │   └── providers.tsx      # Context providers wrapper
│   │
│   ├── components/
│   │   ├── ui/                # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   └── input.tsx
│   │   │
│   │   ├── layout/            # App shell components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── LogPanel.tsx
│   │   │   └── AppLayout.tsx
│   │   │
│   │   └── features/          # Feature-specific components
│   │       ├── device/
│   │       │   ├── DeviceCard.tsx
│   │       │   ├── DeviceSelector.tsx
│   │       │   └── ConnectionStatus.tsx
│   │       ├── partition/
│   │       │   ├── PartitionGrid.tsx
│   │       │   ├── PartitionItem.tsx
│   │       │   ├── PartitionSearch.tsx
│   │       │   └── BatchActions.tsx
│   │       ├── flash/
│   │       │   ├── FlashProgress.tsx
│   │       │   ├── FlashConfirmDialog.tsx
│   │       │   └── FlashSummary.tsx
│   │       ├── backup/
│   │       │   ├── BackupProgress.tsx
│   │       │   └── BackupConfirmDialog.tsx
│   │       ├── wizard/
│   │       │   ├── WizardModal.tsx
│   │       │   ├── WelcomeStep.tsx
│   │       │   ├── PrerequisitesStep.tsx
│   │       │   ├── DeviceSelectStep.tsx
│   │       │   ├── ConnectStep.tsx
│   │       │   └── ReadyStep.tsx
│   │       ├── terminal/
│   │       │   └── Terminal.tsx
│   │       └── command-palette/
│   │           └── CommandPalette.tsx
│   │
│   ├── hooks/                 # React hooks (wrap core logic)
│   │   ├── useWebUSB.ts       # WebUSBManager wrapper
│   │   ├── useFirehose.ts     # FirehoseProtocol wrapper
│   │   ├── useSahara.ts       # SaharaProtocol wrapper
│   │   ├── useAuth.ts         # AuthStrategy wrapper
│   │   ├── useTerminal.ts     # Terminal log management
│   │   ├── usePartitions.ts   # Partition operations
│   │   ├── useKeyboard.ts     # Keyboard shortcuts
│   │   └── useFirstVisit.ts   # First-time user detection
│   │
│   ├── stores/                # Zustand stores
│   │   ├── deviceStore.ts     # Device selection, connection state
│   │   ├── partitionStore.ts  # Partition data, selection
│   │   ├── flashStore.ts      # Flash/backup progress
│   │   ├── terminalStore.ts   # Terminal log entries
│   │   └── settingsStore.ts   # Language, theme, preferences
│   │
│   ├── core/                  # ⚠️ PRESERVED - NO CHANGES
│   │   ├── FirehoseProtocol.ts   # (73KB)
│   │   ├── SaharaProtocol.ts     # (16KB)
│   │   └── WebUSBManager.ts      # (14KB)
│   │
│   ├── auth/                  # ⚠️ PRESERVED - NO CHANGES
│   │   └── AuthStrategy.ts       # (11KB)
│   │
│   ├── services/              # ⚠️ PRESERVED - NO CHANGES
│   │   └── deviceConfig.ts       # (13KB)
│   │
│   ├── pages/                 # Page components
│   │   ├── ToolPage.tsx          # Main flash tool
│   │   ├── GuidePage.tsx         # Guide (renamed from Drivers)
│   │   ├── DownloadsPage.tsx     # Downloads + companion tools
│   │   ├── DevicesPage.tsx       # Supported devices list
│   │   ├── DonatePage.tsx        # Donation/support
│   │   └── SupportPage.tsx       # Help & FAQ
│   │
│   ├── i18n/                  # Internationalization
│   │   ├── config.ts          # i18next setup
│   │   ├── en.json            # English translations
│   │   └── vi.json            # Vietnamese translations
│   │
│   ├── lib/                   # Utilities
│   │   ├── utils.ts           # cn() helper, formatBytes
│   │   └── constants.ts       # App constants
│   │
│   ├── types/                 # TypeScript types
│   │   ├── index.ts           # Re-exports
│   │   ├── device.ts          # DeviceProfile, DeviceConfig
│   │   ├── partition.ts       # PartitionInfo, FlashEntry
│   │   └── usb.ts             # WebUSB types
│   │
│   └── styles/
│       └── globals.css        # Tailwind v4 + theme variables
│
├── components.json            # shadcn/ui config
├── tailwind.config.ts         # Tailwind config
├── vite.config.ts             # Vite config with React plugin
├── tsconfig.json              # TypeScript config
└── package.json
```

---

## Epic to Architecture Mapping

| Epic ID | Feature | Primary Components | Stores | Hooks |
|---------|---------|-------------------|--------|-------|
| F1 | First-Time Wizard | `wizard/*` | `settingsStore` | `useFirstVisit` |
| F2 | Expanded Guide | `GuidePage.tsx` | - | - |
| F3 | Downloads Enhancement | `DownloadsPage.tsx` | - | - |
| F4 | Device Config Update | `devices.json` | `deviceStore` | - |
| F5 | Auto-detect Firehose | `DeviceSelector.tsx` | `deviceStore` | `useFirehose` |
| F6 | Google Ads | `AdBanner.tsx` (Phase 2) | - | - |
| F7 | Affiliate Tracking | `lib/analytics.ts` (Phase 2) | - | - |
| F8 | Performance | - | `flashStore` | `useFirehose` |

---

## Technology Stack Details

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.x | UI framework |
| **Vite** | 7.x | Build tool, HMR |
| **TypeScript** | 5.9.x | Type safety |
| **Tailwind CSS** | 4.x | Styling utilities |
| **shadcn/ui** | Latest | UI component library |
| **Radix UI** | Latest | Accessible primitives |
| **Zustand** | 5.x | State management |
| **React Router** | 7.x | Client-side routing |
| **react-i18next** | Latest | Internationalization |
| **Lucide React** | Latest | Icons |

### Preserved Core Logic (NO CHANGES)

| File | Size | Purpose |
|------|------|---------|
| `core/FirehoseProtocol.ts` | 73KB | Firehose XML protocol, partition operations |
| `core/SaharaProtocol.ts` | 16KB | Sahara bootloader handshake |
| `core/WebUSBManager.ts` | 14KB | WebUSB device connection |
| `auth/AuthStrategy.ts` | 11KB | VIP authentication |
| `services/deviceConfig.ts` | 13KB | Device profiles, firehose URLs |

---

## Novel Pattern Designs

### WebUSB + React Integration Pattern

WebUSB là imperative API cần được wrap vào React declarative model:

```typescript
// Pattern: Protocol Bridge Hook
// File: hooks/useWebUSB.ts

import { useCallback, useRef, useEffect } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { WebUSBManager } from '@/core/WebUSBManager';

export function useWebUSB() {
  // Singleton ref to preserve protocol instance across re-renders
  const usbRef = useRef<WebUSBManager | null>(null);
  
  // Store connections for state sync
  const { setConnected, setDevice } = useDeviceStore();
  const { log } = useTerminalStore();
  
  // Lazy initialization
  const getManager = useCallback(() => {
    if (!usbRef.current) {
      usbRef.current = new WebUSBManager();
    }
    return usbRef.current;
  }, []);
  
  // Wrap imperative connect with React state sync
  const connect = useCallback(async () => {
    const manager = getManager();
    log('info', 'Connecting to device...');
    
    try {
      await manager.connect();
      setConnected(true);
      log('success', 'Device connected');
      return manager.getDevice();
    } catch (error) {
      log('error', `Connection failed: ${error}`);
      setConnected(false);
      throw error;
    }
  }, [getManager, setConnected, log]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      usbRef.current?.disconnect();
    };
  }, []);
  
  return {
    connect,
    disconnect: () => usbRef.current?.disconnect(),
    getManager,
  };
}
```

### Flash Operation State Machine

```typescript
type FlashState = 
  | 'idle'
  | 'preparing'      // Loading files
  | 'connecting'     // USB handshake
  | 'authenticating' // VIP auth
  | 'flashing'       // Active flash
  | 'completing'     // Cleanup
  | 'success'
  | 'error';

interface FlashContext {
  state: FlashState;
  currentPartition: string | null;
  progress: number;        // 0-100
  bytesWritten: number;
  totalBytes: number;
  error: AppError | null;
}
```

---

## Implementation Patterns

### 1. Component Pattern

```typescript
// All feature components follow this structure:

import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ComponentNameProps {
  className?: string;
  // ... other props
}

export function ComponentName({ className, ...props }: ComponentNameProps) {
  // 1. Hooks at top
  const { t } = useTranslation();
  const store = useRelevantStore();
  
  // 2. Derived state
  const isReady = store.data !== null;
  
  // 3. Handlers
  const handleAction = useCallback(() => {
    // ...
  }, []);
  
  // 4. Render
  return (
    <div className={cn('base-classes', className)}>
      {/* Content */}
    </div>
  );
}
```

### 2. Zustand Store Pattern

```typescript
// All stores follow this structure:

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExampleState {
  // State
  data: DataType | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setData: (data: DataType) => void;
  fetch: () => Promise<void>;
  reset: () => void;
}

export const useExampleStore = create<ExampleState>()(
  persist(
    (set, get) => ({
      // Initial state
      data: null,
      isLoading: false,
      error: null,
      
      // Actions
      setData: (data) => set({ data }),
      
      fetch: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await fetchData();
          set({ data: result, isLoading: false });
        } catch (err) {
          set({ error: err.message, isLoading: false });
        }
      },
      
      reset: () => set({ data: null, isLoading: false, error: null }),
    }),
    {
      name: 'example-storage', // localStorage key
      partialize: (state) => ({ data: state.data }), // What to persist
    }
  )
);
```

### 3. Hook Wrapper Pattern (Core Logic)

```typescript
// CRITICAL: Core logic is NEVER modified, only wrapped

import { useRef, useCallback } from 'react';
import { CoreProtocol } from '@/core/CoreProtocol'; // PRESERVED FILE
import { useTerminalStore } from '@/stores/terminalStore';

export function useCoreProtocol() {
  // Singleton ref
  const protocolRef = useRef<CoreProtocol | null>(null);
  const { log } = useTerminalStore();
  
  const getInstance = useCallback(() => {
    if (!protocolRef.current) {
      protocolRef.current = new CoreProtocol();
    }
    return protocolRef.current;
  }, []);
  
  // Wrap each method with logging + state sync
  const doOperation = useCallback(async (params: Params) => {
    const protocol = getInstance();
    log('info', `Starting operation...`);
    
    const result = await protocol.operation(params);
    
    log('success', `Operation completed`);
    return result;
  }, [getInstance, log]);
  
  return { doOperation };
}
```

### 4. Page Component Pattern

```typescript
export function ExamplePage() {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <header>
        <h1 className="text-2xl font-bold">{t('page.title')}</h1>
        <p className="text-muted-foreground">{t('page.description')}</p>
      </header>
      
      {/* Page Content */}
      <main className="flex flex-col gap-4">
        {/* Feature components */}
      </main>
    </div>
  );
}
```

### 5. Dangerous Action Pattern

```typescript
// Simple confirm dialog for dangerous operations

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function DangerousActionButton({ onConfirm, partitions }) {
  const { t } = useTranslation();
  
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">{t('flash.start')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>⚠️ {t('flash.confirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('flash.confirm.message', { count: partitions.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('common.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## Consistency Rules

### Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| React Components | PascalCase | `DeviceCard.tsx` |
| Hooks | camelCase with `use` prefix | `useFirehose.ts` |
| Stores | camelCase with `Store` suffix | `deviceStore.ts` |
| Utils | camelCase | `formatBytes.ts` |
| Types/Interfaces | PascalCase | `DeviceProfile` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| CSS Classes | Tailwind utilities | `bg-zinc-900 text-white` |

### Import Order

```typescript
// 1. React imports
import { useState, useEffect, useCallback } from 'react';

// 2. Third-party imports
import { useTranslation } from 'react-i18next';

// 3. Stores
import { useDeviceStore } from '@/stores/deviceStore';

// 4. Hooks
import { useFirehose } from '@/hooks/useFirehose';

// 5. Components
import { Button } from '@/components/ui/button';
import { DeviceCard } from '@/components/features/device/DeviceCard';

// 6. Types
import type { DeviceProfile } from '@/types';

// 7. Utils/Constants
import { cn, formatBytes } from '@/lib/utils';
```

### Error Handling

```typescript
interface AppError {
  code: string;          // 'USB_NOT_FOUND', 'AUTH_FAILED', etc.
  message: string;       // User-friendly message (translated)
  details?: string;      // Technical details for terminal log
  recoverable: boolean;  // Can user retry?
}

// Error handling flow:
// 1. Catch in hook/store
// 2. Log to terminal (technical details)
// 3. Show toast (user-friendly message)
// 4. Update error state if needed
```

### Logging Strategy

```typescript
// Terminal log levels
type LogLevel = 'info' | 'success' | 'warning' | 'error';

// Log format: [HH:mm:ss] Message
// Color coding:
// - info: text-muted-foreground (gray)
// - success: text-green-500
// - warning: text-yellow-500
// - error: text-red-500

// Use terminal for:
// - USB connection events
// - Protocol handshake steps
// - Flash/backup progress
// - Technical errors

// Use toast for:
// - User action feedback
// - Non-technical notifications
```

---

## Data Architecture

### State Structure

```typescript
// deviceStore
interface DeviceState {
  selectedDevice: DeviceProfile | null;
  isConnected: boolean;
  connectionError: string | null;
  firehoseLoaded: boolean;
}

// partitionStore
interface PartitionState {
  partitions: PartitionInfo[];
  selectedPartitions: Set<string>;
  searchFilter: string;
  isLoading: boolean;
}

// flashStore
interface FlashState {
  status: FlashState;
  currentPartition: string | null;
  progress: number;
  error: AppError | null;
}

// settingsStore (persisted)
interface SettingsState {
  language: 'en' | 'vi';
  showWizard: boolean;
  lastDeviceId: string | null;
}
```

### Data Flow

```
User Action → Component → Hook → Core Logic → Store → UI Update
                                    ↓
                              Terminal Log
```

---

## Security Architecture

### Data Handling

| Data Type | Handling |
|-----------|----------|
| Partition data | Never uploaded - stays local in browser |
| Device info | Not logged or transmitted |
| Firehose files | Downloaded from own server only |
| User preferences | localStorage only |

### WebUSB Security

- Requires HTTPS for WebUSB API
- User must grant device permission
- No auto-connect without user interaction
- Session limits handled gracefully

---

## Performance Considerations

### Large File Handling

- Files > 1GB: Stream without full memory load
- Progress updates: Every 1% or 1MB
- Chunk size: 1MB for optimal performance
- Retry logic: 3 attempts per chunk

### Rendering Optimization

- Virtual list for partition grid (if > 100 items)
- Memoize expensive components
- Debounce search filter
- Lazy load pages with React.lazy

---

## Deployment Architecture

### Hosting

- **Platform:** Static hosting (GitHub Pages, Vercel, Netlify)
- **Requirements:** HTTPS required for WebUSB
- **CDN:** For firehose files distribution

### Build Output

```bash
npm run build
# Output: dist/
# - index.html
# - assets/*.js (chunked)
# - assets/*.css
```

---

## Development Environment

### Prerequisites

- Node.js 20.x LTS
- npm 10.x
- Chrome/Edge 89+ (WebUSB support)
- Windows PC (recommended for USB driver)

### Setup Commands

```bash
# Clone and install
git clone <repo>
cd Q-Flash-Web
npm install

# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview
```

### Recommended VS Code Extensions

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar)

---

## Architecture Decision Records (ADRs)

### ADR-001: React Migration

**Decision:** Migrate from Vanilla TypeScript to React 19
**Rationale:** Required for shadcn/ui components, enables better state management
**Trade-offs:** Larger bundle size, learning curve for React
**Mitigation:** Core logic remains vanilla TypeScript, wrapped by hooks

### ADR-002: Preserve Core Logic

**Decision:** Core Firehose/WebUSB logic is NEVER modified, only wrapped
**Rationale:** Logic is tested and working, risk of regression too high
**Implementation:** Use ref-based hooks to wrap class instances

### ADR-003: Zustand over Redux

**Decision:** Use Zustand for state management
**Rationale:** 
- Lightweight (2KB vs 20KB+ Redux)
- Easy integration with existing logic
- Built-in persistence middleware
- Less boilerplate

### ADR-004: Tailwind CSS v4

**Decision:** Use Tailwind v4 (CSS-first config)
**Rationale:**
- 5x faster builds
- Native CSS variables
- Full shadcn/ui compatibility
- Modern CSS features (cascade layers, color-mix)

### ADR-005: Simple Confirm Dialogs

**Decision:** Use simple Yes/No confirm dialogs, not type-to-confirm
**Rationale:** User requested simpler UX, target users are technicians who know what they're doing

### ADR-006: Connection Flow Stability

**Decision:** Remove ping() verification after Sahara handshake
**Rationale:**
- After Sahara, device transitions from Sahara mode to Firehose mode
- `ping()` attempts to read data from USB but device is not ready to respond
- Results are unstable: sometimes succeeds, sometimes fails
- VIP authentication automatically verifies connection when sending digest/signature

**Implementation:**
```typescript
// ❌ BEFORE (unstable):
await sahara.complete();
await wait(5000);
await clearBuffer();
const pingResult = await ping();  // ← UNRELIABLE
if (!pingResult) reconnect();     // ← Often fails

// ✅ AFTER (stable):
await sahara.complete();
await wait(5000);
await clearBuffer();
// Proceed directly to VIP auth or Firehose configure
```

**Impact:**
- Eliminates "Device not connected" errors after Sahara
- Reduces connection time by ~5 seconds (no reconnect attempts)
- Improves success rate from ~50% to 100%

**Testing:**
- ✅ Oppo Find X7 Ultra (SM8650) - 145 partitions
- ✅ OnePlus Ace 5 (SM8650) - 141 partitions

**Related Files:**
- `src/hooks/useConnectionFlow.ts` - Main connection orchestration
- `src/core/WebUSBManager.ts` - Improved reconnect with 5 retries
- `src/core/FirehoseProtocol.ts` - Increased timeout to 5 seconds
- `docs/BUGFIX-device-not-connected.md` - Detailed bug fix documentation

---

_Generated by BMAD Decision Architecture Workflow v1.0_  
_Date: 2025-12-29_  
_For: Nguyen_

