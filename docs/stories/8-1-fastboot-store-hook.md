# Story 8.1: Fastboot Store & Hook

## Story Info
- **Epic:** Epic 8 - Fastboot Mode Features
- **Priority:** P0 (Must have)
- **Estimated Effort:** 4 hours
- **Status:** review
- **Dependencies:** Story 6.3 (Fastboot Protocol Wrapper)

---

## User Story

As a **developer**,  
I want **Zustand store and React hook for Fastboot operations**,  
So that **Fastboot page components can access Fastboot functionality**.

---

## Acceptance Criteria

### AC1: Fastboot Store (`src/stores/fastbootStore.ts`)
- [x] Store exports `useFastbootStore` hook
- [x] State includes `deviceInfo: FastbootDeviceInfo | null`
- [x] State includes `isConnecting: boolean`
- [x] State includes `flashProgress: { partition: string; progress: number } | null`
- [x] State includes `pendingOperation: string | null`
- [x] Actions: `setDeviceInfo`, `setConnecting`, `setFlashProgress`, `setPendingOperation`, `reset`

### AC2: useFastboot Hook (`src/hooks/useFastboot.ts`)
- [x] `connect()` - connects and fetches device variables
- [x] `disconnect()` - disconnects and resets store
- [x] `unlockBootloader()` - sends unlock command
- [x] `lockBootloader()` - sends lock command
- [x] `flashPartition(partition, file)` - flashes with progress
- [x] `erasePartition(partition)` - erases partition
- [x] `reboot()` - reboots to system
- [x] `rebootBootloader()` - reboots to bootloader
- [x] `rebootRecovery()` - reboots to recovery

### AC3: State Sync
- [x] All methods update `deviceStore.isConnected`
- [x] All methods log to `terminalStore`
- [x] Flash progress updates during flash operation

### AC4: Protocol Singleton
- [x] Uses `useRef` for FastbootProtocol instance
- [x] Uses `useCallback` for memoized methods

---

## Technical Notes

### Store Implementation

```typescript
// src/stores/fastbootStore.ts
import { create } from 'zustand';
import type { FastbootDeviceInfo } from '@/core/FastbootProtocol';

interface FastbootState {
  deviceInfo: FastbootDeviceInfo | null;
  isConnecting: boolean;
  flashProgress: { partition: string; progress: number } | null;
  pendingOperation: string | null;
  
  setDeviceInfo: (info: FastbootDeviceInfo | null) => void;
  setConnecting: (connecting: boolean) => void;
  setFlashProgress: (progress: { partition: string; progress: number } | null) => void;
  setPendingOperation: (op: string | null) => void;
  reset: () => void;
}

export const useFastbootStore = create<FastbootState>((set) => ({
  deviceInfo: null,
  isConnecting: false,
  flashProgress: null,
  pendingOperation: null,
  
  setDeviceInfo: (info) => set({ deviceInfo: info }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setFlashProgress: (progress) => set({ flashProgress: progress }),
  setPendingOperation: (op) => set({ pendingOperation: op }),
  reset: () => set({
    deviceInfo: null,
    isConnecting: false,
    flashProgress: null,
    pendingOperation: null,
  }),
}));
```

### Flash with Progress

```typescript
const flashPartition = useCallback(async (partition: string, file: File) => {
  setFlashProgress({ partition, progress: 0 });
  
  const success = await fb.flashPartition(partition, file, (progress) => {
    setFlashProgress({ partition, progress });
  });
  
  setFlashProgress(null);
  return success;
}, []);
```

---

## Tasks

- [x] Task 1: Create `src/stores/fastbootStore.ts`
- [x] Task 2: Define FastbootState interface with flashProgress
- [x] Task 3: Implement store with all actions
- [x] Task 4: Create `src/hooks/useFastboot.ts`
- [x] Task 5: Implement `connect()` with logging
- [x] Task 6: Implement `disconnect()` with reset
- [x] Task 7: Implement `unlockBootloader()`
- [x] Task 8: Implement `lockBootloader()`
- [x] Task 9: Implement `flashPartition()` with progress
- [x] Task 10: Implement `erasePartition()`
- [x] Task 11: Implement reboot methods
- [x] Task 12: Sync with deviceStore.isConnected
- [x] Task 13: Test hook functionality

---

## Definition of Done

- [x] Fastboot store created and functional
- [x] useFastboot hook created and functional
- [x] Flash progress updates correctly
- [x] TypeScript compiles without errors
- [x] Story marked as `done` in sprint-status.yaml

---

## File List

### New Files
- `src/stores/fastbootStore.ts` - Zustand store for Fastboot state management
- `src/hooks/useFastboot.ts` - React hook wrapping FastbootProtocol

### Modified Files
- `src/stores/index.ts` - Export fastbootStore
- `src/hooks/index.ts` - Export useFastboot hook

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Created fastbootStore with state and actions | AI Dev Agent |
| 2025-12-30 | Created useFastboot hook with all protocol methods | AI Dev Agent |
| 2025-12-30 | Updated store/hook indexes for exports | AI Dev Agent |

---

## Dev Agent Record

### Debug Log
- Analyzed existing patterns from useFirehose and deviceStore
- Created fastbootStore following Zustand patterns
- Implemented useFastboot hook with singleton pattern using useRef
- All methods use useCallback for memoization
- Synced with deviceStore.isConnected and terminalStore for logging

### Completion Notes
✅ Story 8.1 implementation complete
- Fastboot store provides state management for device info, connection status, flash progress
- useFastboot hook wraps FastbootProtocol with full functionality
- All acceptance criteria met
- TypeScript compiles without errors

---

## References

- [Architecture - Fastboot Store](../architecture-usb-adb-fastboot.md#adr-011-fastboot-store)
- [Architecture - useFastboot Hook](../architecture-usb-adb-fastboot.md#adr-013-usefastboot-hook)

