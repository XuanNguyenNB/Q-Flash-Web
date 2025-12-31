# Story 1.3: Zustand State Management Setup

**Status:** review  
**Epic:** Epic 1 - Foundation - React Migration Setup  
**Created:** 2025-12-29  
**Story Key:** 1-3-zustand-state-management-setup

---

## Story

As a **developer**,  
I want **Zustand stores configured for device, partition, flash, terminal, and settings state**,  
so that **React components can access and update app state in a predictable, type-safe manner**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | Zustand is installed as a dependency | `npm list zustand` shows 5.x |
| AC2 | deviceStore.ts exists with: `selectedDevice`, `isConnected`, `setDevice`, `setConnected` | File exists with correct interface and actions |
| AC3 | partitionStore.ts exists with: `partitions`, `selectedPartitions`, `toggleSelection`, `selectAll`, `deselectAll` | File exists with correct interface and actions |
| AC4 | flashStore.ts exists with: `status`, `progress`, `currentPartition`, `setProgress`, `reset` | File exists with correct interface and actions |
| AC5 | terminalStore.ts exists with: `logs`, `log()`, `clear()` | File exists with log function accepting level and message |
| AC6 | settingsStore.ts exists with: `language`, `showWizard`, `lastDeviceId`, persisted to localStorage | File uses `persist` middleware, data survives page reload |
| AC7 | TypeScript interfaces are defined for all state shapes | All stores have proper type definitions |
| AC8 | `npm run dev` runs without TypeScript errors | Dev server starts successfully |

---

## Tasks / Subtasks

- [x] **Task 1: Install Zustand** (AC: 1)
  - [x] 1.1 Run `npm install zustand`
  - [x] 1.2 Verify zustand version 5.x in package.json
  - [x] 1.3 Ensure no peer dependency warnings

- [x] **Task 2: Create stores directory structure** (AC: 7)
  - [x] 2.1 Create `src/stores/` directory
  - [x] 2.2 Create `src/stores/index.ts` for re-exports
  - [x] 2.3 Define TypeScript interfaces for all state shapes

- [x] **Task 3: Create deviceStore** (AC: 2, 7)
  - [x] 3.1 Create `src/stores/deviceStore.ts`
  - [x] 3.2 Define `DeviceState` interface with:
    - `selectedDevice: DeviceProfile | null`
    - `isConnected: boolean`
    - `connectionError: string | null`
    - `firehoseLoaded: boolean`
  - [x] 3.3 Implement actions: `setDevice`, `setConnected`, `setError`, `reset`
  - [x] 3.4 Export `useDeviceStore` hook

- [x] **Task 4: Create partitionStore** (AC: 3, 7)
  - [x] 4.1 Create `src/stores/partitionStore.ts`
  - [x] 4.2 Define `PartitionState` interface with:
    - `partitions: PartitionInfo[]`
    - `selectedPartitions: Set<string>`
    - `searchFilter: string`
    - `isLoading: boolean`
  - [x] 4.3 Implement actions: `setPartitions`, `toggleSelection`, `selectAll`, `deselectAll`, `setSearchFilter`
  - [x] 4.4 Export `usePartitionStore` hook

- [x] **Task 5: Create flashStore** (AC: 4, 7)
  - [x] 5.1 Create `src/stores/flashStore.ts`
  - [x] 5.2 Define `FlashState` type and `FlashContext` interface with:
    - `status: FlashState` (idle, preparing, connecting, authenticating, flashing, completing, success, error)
    - `currentPartition: string | null`
    - `progress: number` (0-100)
    - `bytesWritten: number`
    - `totalBytes: number`
    - `error: AppError | null`
  - [x] 5.3 Implement actions: `setStatus`, `setProgress`, `setCurrentPartition`, `setError`, `reset`
  - [x] 5.4 Export `useFlashStore` hook

- [x] **Task 6: Create terminalStore** (AC: 5, 7)
  - [x] 6.1 Create `src/stores/terminalStore.ts`
  - [x] 6.2 Define `LogEntry` interface with:
    - `id: string`
    - `timestamp: Date`
    - `level: 'info' | 'success' | 'warning' | 'error'`
    - `message: string`
  - [x] 6.3 Define `TerminalState` with `logs: LogEntry[]`
  - [x] 6.4 Implement actions: `log(level, message)`, `clear()`
  - [x] 6.5 Generate unique id for each log entry
  - [x] 6.6 Export `useTerminalStore` hook

- [x] **Task 7: Create settingsStore with persistence** (AC: 6, 7)
  - [x] 7.1 Create `src/stores/settingsStore.ts`
  - [x] 7.2 Import `persist` middleware from `zustand/middleware`
  - [x] 7.3 Define `SettingsState` interface with:
    - `language: 'en' | 'vi'`
    - `showWizard: boolean`
    - `lastDeviceId: string | null`
  - [x] 7.4 Implement actions: `setLanguage`, `setShowWizard`, `setLastDeviceId`
  - [x] 7.5 Configure persist middleware with localStorage key `'qflash-settings'`
  - [x] 7.6 Export `useSettingsStore` hook

- [x] **Task 8: Create index.ts for exports** (AC: 7)
  - [x] 8.1 Update `src/stores/index.ts` to export all stores
  - [x] 8.2 Export all TypeScript interfaces

- [x] **Task 9: Verify implementation** (AC: 8)
  - [x] 9.1 Run `npm run dev` and verify no TypeScript errors
  - [x] 9.2 Test settingsStore persistence: change language, reload page, verify value persists
  - [x] 9.3 Verify all stores can be imported from `@/stores`

---

## Dev Notes

### Architecture Context

Story này thiết lập state management foundation cho toàn bộ ứng dụng:

1. **Zustand** - Lightweight state management (2KB), không cần Provider wrapper
2. **persist middleware** - Lưu settings vào localStorage
3. **TypeScript interfaces** - Định nghĩa rõ ràng structure của mỗi store

### Technical Decisions

| Decision | Rationale | Source |
|----------|-----------|--------|
| Zustand over Redux | Lightweight (2KB vs 20KB+), less boilerplate | [architecture.md#ADR-003] |
| Persist middleware | Built-in localStorage support, no extra deps | [architecture.md#Zustand-Store-Pattern] |
| Set for selectedPartitions | O(1) lookup for large partition lists | Performance consideration |

### Store Pattern Reference

```typescript
// Pattern từ architecture.md
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ExampleState {
  // State
  data: DataType | null;
  
  // Actions
  setData: (data: DataType) => void;
  reset: () => void;
}

export const useExampleStore = create<ExampleState>()(
  (set, get) => ({
    data: null,
    setData: (data) => set({ data }),
    reset: () => set({ data: null }),
  })
);
```

### Type Definitions

```typescript
// src/types/device.ts (reference existing or create)
interface DeviceProfile {
  id: string;
  name: string;
  chipset: string;
  chipsetFolder: string;
  firehoseUrls?: {
    programmer: string;
    digest?: string;
    signature?: string;
  };
  status: 'tested' | 'beta' | 'coming';
}

// src/types/partition.ts
interface PartitionInfo {
  name: string;
  label: string;
  startSector: number;
  numSectors: number;
  sizeBytes: number;
  lun: number;
  isDangerous?: boolean;
}

// src/types/error.ts
interface AppError {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
}
```

### Project Structure Notes

After this story:

```
src/
├── stores/                    # NEW - Zustand stores
│   ├── index.ts               # NEW - Re-exports
│   ├── deviceStore.ts         # NEW - Device selection, connection
│   ├── partitionStore.ts      # NEW - Partition data, selection
│   ├── flashStore.ts          # NEW - Flash/backup progress
│   ├── terminalStore.ts       # NEW - Terminal log entries
│   └── settingsStore.ts       # NEW - Language, theme, preferences (persisted)
├── types/                     # May need to extend
│   ├── device.ts              # DeviceProfile interface
│   ├── partition.ts           # PartitionInfo interface
│   └── error.ts               # AppError interface
├── app/                       # UNCHANGED
├── components/                # UNCHANGED
├── core/                      # UNCHANGED - PRESERVED
├── auth/                      # UNCHANGED - PRESERVED
└── services/                  # UNCHANGED - PRESERVED
```

### localStorage Key

Settings store sử dụng key: `qflash-settings`

Structure lưu trữ:
```json
{
  "state": {
    "language": "en",
    "showWizard": true,
    "lastDeviceId": null
  },
  "version": 0
}
```

### References

- [Source: docs/architecture.md#ADR-003] - Zustand over Redux decision
- [Source: docs/architecture.md#Zustand-Store-Pattern] - Store implementation pattern
- [Source: docs/architecture.md#Data-Architecture] - State structure definitions
- [Source: docs/epics.md#Story-1.3] - Story definition and acceptance criteria

---

## Learnings from Previous Story

**From Story 1-2-tailwind-css-v4-shadcn-ui-setup (Status: drafted)**

- **Not yet implemented** - Story 1-2 is currently in drafted status
- **Expected setup**: Tailwind CSS v4, shadcn/ui, globals.css, cn() utility
- **Path alias**: `@/` should be configured pointing to `src/`

**Dependency Note:**
- This story has a prerequisite of Story 1.1 (React installation)
- Story 1.2 is NOT a hard dependency - Zustand can be installed independently
- However, path aliases (`@/lib/utils`, `@/stores`) require tsconfig setup from Story 1.1

[Source: stories/1-2-tailwind-css-v4-shadcn-ui-setup.md]

---

## Dev Agent Record

### Context Reference

- [1-3-zustand-state-management-setup.context.xml](./1-3-zustand-state-management-setup.context.xml)

### Agent Model Used

Gemini 2.5 (Antigravity)

### Debug Log References

- Installed zustand 5.0.9 successfully with no peer dependency warnings
- Created 5 store files following Zustand pattern from architecture.md
- Added path alias `@/*` -> `src/*` in tsconfig.json for TypeScript resolution
- Verified HMR update works with store imports in App.tsx
- Dev server running on port 5175 without TypeScript errors

### Completion Notes List

- ✅ All 5 Zustand stores created: deviceStore, partitionStore, flashStore, terminalStore, settingsStore
- ✅ settingsStore uses persist middleware with localStorage key 'qflash-settings'
- ✅ All stores export TypeScript interfaces alongside hooks
- ✅ Central index.ts re-exports all stores and types
- ✅ App.tsx updated to demo store usage with language toggle button
- ✅ Path alias configured in tsconfig.json for @/ imports
- ⚠️ Reused existing PartitionInfo from src/types/index.ts via import
- 📝 terminalStore includes maxLogs (1000) limit to prevent memory issues

### File List

- [x] NEW: src/stores/index.ts
- [x] NEW: src/stores/deviceStore.ts
- [x] NEW: src/stores/partitionStore.ts
- [x] NEW: src/stores/flashStore.ts
- [x] NEW: src/stores/terminalStore.ts
- [x] NEW: src/stores/settingsStore.ts
- [x] MODIFIED: package.json (add zustand dependency)
- [x] MODIFIED: tsconfig.json (add baseUrl and paths for @/ alias)
- [x] MODIFIED: src/app/App.tsx (add Zustand demo with store imports)

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
| 2025-12-29 | Dev Agent | Implemented all 9 tasks - Zustand stores complete |
