# Story 7.1: ADB Store & Hook

## Story Info
- **Epic:** Epic 7 - ADB Mode Features
- **Priority:** P0 (Must have)
- **Estimated Effort:** 4 hours
- **Status:** review
- **Dependencies:** Story 6.2 (ADB Protocol Wrapper)

---

## User Story

As a **developer**,  
I want **Zustand store and React hook for ADB operations**,  
So that **ADB page components can access ADB functionality**.

---

## Acceptance Criteria

### AC1: ADB Store (`src/stores/adbStore.ts`)
- [x] Store exports `useADBStore` hook
- [x] State includes `deviceInfo: ADBDeviceInfo | null`
- [x] State includes `isConnecting: boolean`
- [x] State includes `pendingOperation: string | null`
- [x] Actions: `setDeviceInfo`, `setConnecting`, `setPendingOperation`, `reset`

### AC2: useADB Hook (`src/hooks/useADB.ts`)
- [x] Hook exports `useADB` function
- [x] `connect()` - connects device and fetches info
- [x] `disconnect()` - disconnects and resets store
- [x] `rebootToEDL()` - reboots to EDL mode
- [x] `rebootToBootloader()` - reboots to Fastboot
- [x] `rebootToRecovery()` - reboots to recovery
- [x] `reboot()` - normal reboot
- [x] `shutdown()` - powers off device

### AC3: State Sync
- [x] All methods update `deviceStore.isConnected`
- [x] All methods log to `terminalStore`
- [x] Failed operations show error in terminal
- [x] Pending operations tracked in store

### AC4: Protocol Singleton
- [x] Uses `useRef` for ADBProtocol instance
- [x] Instance preserved across re-renders
- [x] Uses `useCallback` for memoized methods

---

## Technical Notes

### Store Implementation

```typescript
// src/stores/adbStore.ts
import { create } from 'zustand';
import type { ADBDeviceInfo } from '@/core/ADBProtocol';

interface ADBState {
  deviceInfo: ADBDeviceInfo | null;
  isConnecting: boolean;
  pendingOperation: string | null;
  
  setDeviceInfo: (info: ADBDeviceInfo | null) => void;
  setConnecting: (connecting: boolean) => void;
  setPendingOperation: (op: string | null) => void;
  reset: () => void;
}

export const useADBStore = create<ADBState>((set) => ({
  deviceInfo: null,
  isConnecting: false,
  pendingOperation: null,
  
  setDeviceInfo: (info) => set({ deviceInfo: info }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setPendingOperation: (op) => set({ pendingOperation: op }),
  reset: () => set({
    deviceInfo: null,
    isConnecting: false,
    pendingOperation: null,
  }),
}));
```

### Hook Pattern

```typescript
// src/hooks/useADB.ts
import { useRef, useCallback } from 'react';
import { ADBProtocol } from '@/core/ADBProtocol';
import { useDeviceStore } from '@/stores/deviceStore';
import { useADBStore } from '@/stores/adbStore';
import { useTerminalStore } from '@/stores/terminalStore';

export function useADB() {
  const adbRef = useRef<ADBProtocol | null>(null);
  // ... implementation following pattern from useFirehose.ts
}
```

---

## Tasks

- [x] Task 1: Create `src/stores/adbStore.ts`
- [x] Task 2: Define ADBState interface
- [x] Task 3: Implement store with all actions
- [x] Task 4: Create `src/hooks/useADB.ts`
- [x] Task 5: Implement `connect()` with logging
- [x] Task 6: Implement `disconnect()` with reset
- [x] Task 7: Implement `rebootToEDL()`
- [x] Task 8: Implement `rebootToBootloader()`
- [x] Task 9: Implement `rebootToRecovery()`
- [x] Task 10: Implement `reboot()`
- [x] Task 11: Implement `shutdown()`
- [x] Task 12: Sync with deviceStore.isConnected
- [x] Task 13: Test hook functionality (TypeScript compile passed)

---

## Definition of Done

- [x] ADB store created and functional
- [x] useADB hook created and functional
- [x] All methods log to terminal
- [x] TypeScript compiles without errors
- [ ] Story marked as `done` in sprint-status.yaml

---

## File List

### Created Files
- `src/stores/adbStore.ts` - ADB Zustand store with device info, connecting state, and pending operation tracking
- `src/hooks/useADB.ts` - React hook wrapping ADBProtocol with full operations (connect, disconnect, reboot variants, shutdown)

---

## Dev Agent Record

### Debug Log
- Analyzed existing patterns from `useFirehose.ts` and `deviceStore.ts`
- Implemented ADB store with Zustand following project conventions
- Created useADB hook with singleton pattern using useRef
- All methods sync with deviceStore.isConnected and log to terminalStore

### Completion Notes
- Implementation follows existing patterns from useFirehose.ts
- Uses useRef for ADBProtocol singleton to preserve state across re-renders
- All methods use useCallback for proper memoization
- Emoji-prefixed log messages for better visual feedback
- Failed operations properly log errors to terminal

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Initial implementation of ADB store and hook | Dev Agent |

---

## References

- [Architecture - ADB Store](../architecture-usb-adb-fastboot.md#adr-010-adb-store)
- [Architecture - useADB Hook](../architecture-usb-adb-fastboot.md#adr-012-useadb-hook)
- [Existing useFirehose.ts pattern](../../src/hooks/useFirehose.ts)

