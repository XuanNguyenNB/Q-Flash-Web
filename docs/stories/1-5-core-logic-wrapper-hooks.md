# Story 1.5: Core Logic Wrapper Hooks

**Status:** review  
**Epic:** Epic 1 - Foundation - React Migration Setup  
**Created:** 2025-12-29  
**Story Key:** 1-5-core-logic-wrapper-hooks

---

## Story

As a **developer**,  
I want **React hooks that wrap the existing WebUSB, Firehose, Sahara, and Auth protocols**,  
so that **React components can use core flash logic without modifying it**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | `useWebUSB.ts` exists and wraps `WebUSBManager` | Hook exports `connect()`, `disconnect()`, `getManager()` |
| AC2 | `useFirehose.ts` exists and wraps `FirehoseProtocol` | Hook provides firehose operations callable from React |
| AC3 | `useSahara.ts` exists and wraps `SaharaProtocol` | Hook handles Sahara handshake protocol |
| AC4 | `useAuth.ts` exists and wraps `AuthStrategy` | Hook provides VIP authentication for Oppo/OnePlus/Realme |
| AC5 | All hooks sync state with Zustand stores | `deviceStore.isConnected` updates when `useWebUSB.connect()` succeeds |
| AC6 | All hooks log operations to `terminalStore` | Terminal shows logs like "Connecting to device...", "Device connected" |
| AC7 | ZERO changes to files in `src/core/`, `src/auth/`, `src/services/` | Git diff shows no modifications to preserved directories |
| AC8 | `npm run dev` runs without TypeScript errors | Dev server starts successfully |

---

## Tasks / Subtasks

- [x] **Task 1: Review core logic interfaces** (AC: 7)
  - [x] 1.1 Study `src/core/WebUSBManager.ts` public methods and types
  - [x] 1.2 Study `src/core/FirehoseProtocol.ts` public methods and types
  - [x] 1.3 Study `src/core/SaharaProtocol.ts` public methods and types
  - [x] 1.4 Study `src/auth/AuthStrategy.ts` public methods and types
  - [x] 1.5 Document interface signatures for wrapper design
  - [x] 1.6 Identify callback patterns and event handling

- [x] **Task 2: Create useWebUSB hook** (AC: 1, 5, 6)
  - [x] 2.1 Create `src/hooks/useWebUSB.ts`
  - [x] 2.2 Use `useRef` to hold singleton `WebUSBManager` instance
  - [x] 2.3 Implement `getManager()` with lazy initialization
  - [x] 2.4 Implement `connect()` that:
    - Logs "Connecting to device..." to terminalStore
    - Calls `manager.connect()`
    - Updates `deviceStore.setConnected(true)` on success
    - Logs "Device connected" to terminalStore
    - Handles errors with logging and state update
  - [x] 2.5 Implement `disconnect()` that:
    - Calls `manager.disconnect()`
    - Updates `deviceStore.setConnected(false)`
    - Logs "Device disconnected" to terminalStore
  - [x] 2.6 Add `useEffect` cleanup to disconnect on unmount
  - [x] 2.7 Type all functions with proper TypeScript types

- [x] **Task 3: Create useFirehose hook** (AC: 2, 5, 6)
  - [x] 3.1 Create `src/hooks/useFirehose.ts`
  - [x] 3.2 Use `useRef` to hold singleton `FirehoseProtocol` instance
  - [x] 3.3 Implement `getInstance()` with lazy initialization
  - [x] 3.4 Wrap key operations:
    - `configure()` - Configure firehose session
    - `readPartitionTable()` - Read GPT and update `partitionStore`
    - `readPartition()` - Read partition data with progress
    - `writePartition()` - Write partition data with progress
  - [x] 3.5 Sync partition data with `partitionStore.setPartitions()`
  - [x] 3.6 Sync progress with `flashStore.setProgress()`
  - [x] 3.7 Log all operations to terminalStore

- [x] **Task 4: Create useSahara hook** (AC: 3, 5, 6)
  - [x] 4.1 Create `src/hooks/useSahara.ts`
  - [x] 4.2 Use `useRef` to hold singleton `SaharaProtocol` instance
  - [x] 4.3 Implement `getInstance()` with lazy initialization
  - [x] 4.4 Wrap key operations:
    - `handshake()` - Initial Sahara handshake
    - `uploadFirehose()` - Upload programmer to device
  - [x] 4.5 Log handshake steps to terminalStore:
    - "Sahara handshake starting..."
    - "Hello packet received"
    - "Uploading firehose..."
    - "Sahara complete, entering Firehose mode"
  - [x] 4.6 Update deviceStore connection state appropriately

- [x] **Task 5: Create useAuth hook** (AC: 4, 5, 6)
  - [x] 5.1 Create `src/hooks/useAuth.ts`
  - [x] 5.2 Use `useRef` to hold singleton `AuthStrategy` instance
  - [x] 5.3 Implement `getInstance()` with lazy initialization
  - [x] 5.4 Wrap key operations:
    - `authenticate()` - Perform VIP auth handshake
    - `loadCredentials()` - Load digest and signature files
  - [x] 5.5 Log authentication steps to terminalStore:
    - "VIP authentication starting..."
    - "Loading credentials..."
    - "VIP authentication successful"
  - [x] 5.6 Handle auth errors with clear messages

- [x] **Task 6: Create useTerminal hook** (AC: 6)
  - [x] 6.1 Create `src/hooks/useTerminal.ts`
  - [x] 6.2 Provide convenience wrapper around `terminalStore`
  - [x] 6.3 Export `log(level, message)` function
  - [x] 6.4 Format timestamp as `[HH:mm:ss]`
  - [x] 6.5 Ensure log entries have correct level types

- [x] **Task 7: Create hooks barrel export** (AC: 1-6)
  - [x] 7.1 Create `src/hooks/index.ts`
  - [x] 7.2 Export all hooks for clean imports

- [x] **Task 8: Verify implementation** (AC: 7, 8)
  - [x] 8.1 Run `npm run dev` and verify no TypeScript errors
  - [x] 8.2 Git diff to confirm no changes to core/, auth/, services/
  - [x] 8.3 Test importing hooks in App.tsx or test component
  - [x] 8.4 Verify hooks can be called without errors

---



## Dev Notes

### Architecture Context

Story này là CRITICAL vì nó implement **Protocol Bridge Hook pattern** từ architecture.md. Đây là cầu nối giữa React và core logic đã được test.

**Key Principle:** Core logic là **read-only** - chỉ wrap, KHÔNG sửa đổi!

### Technical Decisions

| Decision | Rationale | Source |
|----------|-----------|--------|
| Use `useRef` for singleton instances | Protocol objects cần persist across re-renders | [architecture.md#Novel-Pattern-Designs] |
| Lazy initialization | Không tạo protocol instance cho đến khi cần | Performance optimization |
| `useCallback` for memoized methods | Tránh re-create functions trên mỗi render | React best practices |
| Cleanup on unmount | Đảm bảo disconnect khi component unmount | Resource management |

### Hook Wrapper Pattern (From Architecture)

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

### Core Files to Wrap (READ-ONLY)

| File | Size | Key Methods to Wrap |
|------|------|---------------------|
| `core/WebUSBManager.ts` | 14KB | `connect()`, `disconnect()`, `getDevice()` |
| `core/FirehoseProtocol.ts` | 73KB | `configure()`, `readPartitionTable()`, `readPartition()`, `writePartition()` |
| `core/SaharaProtocol.ts` | 16KB | `handshake()`, `uploadFirehose()` |
| `auth/AuthStrategy.ts` | 11KB | `authenticate()`, `loadCredentials()` |

### Store Dependencies

Hooks cần các stores từ Story 1.3 đã ready-for-dev:

| Store | Hook Usage |
|-------|------------|
| `deviceStore` | `useWebUSB` - `setConnected`, `setDevice` |
| `partitionStore` | `useFirehose` - `setPartitions`, `setSelectedPartitions` |
| `flashStore` | `useFirehose` - `setProgress`, `setCurrentPartition`, `setStatus` |
| `terminalStore` | All hooks - `log()` |

### Project Structure Notes

After this story:

```
src/
├── hooks/                     # NEW DIRECTORY
│   ├── index.ts               # NEW - barrel export
│   ├── useWebUSB.ts           # NEW - WebUSBManager wrapper
│   ├── useFirehose.ts         # NEW - FirehoseProtocol wrapper
│   ├── useSahara.ts           # NEW - SaharaProtocol wrapper
│   ├── useAuth.ts             # NEW - AuthStrategy wrapper
│   └── useTerminal.ts         # NEW - Terminal log helper
│
├── core/                      # ⚠️ UNCHANGED - PRESERVED
│   ├── FirehoseProtocol.ts    # READ-ONLY
│   ├── SaharaProtocol.ts      # READ-ONLY
│   └── WebUSBManager.ts       # READ-ONLY
│
├── auth/                      # ⚠️ UNCHANGED - PRESERVED
│   └── AuthStrategy.ts        # READ-ONLY
│
├── services/                  # ⚠️ UNCHANGED - PRESERVED
│   └── deviceConfig.ts        # READ-ONLY
│
├── stores/                    # FROM STORY 1.3
│   ├── deviceStore.ts
│   ├── partitionStore.ts
│   ├── flashStore.ts
│   ├── terminalStore.ts
│   └── settingsStore.ts
│
└── app/                       # FROM STORY 1.1
    ├── App.tsx
    └── main.tsx
```

### References

- [Source: docs/architecture.md#Novel-Pattern-Designs] - Protocol Bridge Hook pattern
- [Source: docs/architecture.md#Hook-Wrapper-Pattern] - Implementation details
- [Source: docs/architecture.md#ADR-002] - Preserve Core Logic decision
- [Source: docs/epics.md#Story-1.5] - Story definition and acceptance criteria
- [Source: docs/architecture.md#Preserved-Core-Logic] - Files that must not be modified

---

## Learnings from Previous Story

**From Story 1-4-react-router-i18n-setup (Status: drafted)**

- **Not yet implemented** - Story 1-4 is currently in drafted status
- **Key patterns established**:
  - React 19 with Vite setup (Story 1.1)
  - Zustand stores with persist middleware (Story 1.3 ready-for-dev)
- **Path alias**: Use `@/` path alias configured in Story 1.1
- **Store access pattern**: `useXxxStore((state) => state.property)` for selective subscription

**Dependencies:**

- **Story 1.1** (review): React installation complete - React 19, Vite React plugin ready
- **Story 1.3** (ready-for-dev): Zustand stores available - `deviceStore`, `partitionStore`, `flashStore`, `terminalStore`

**If stores not complete:**

- Hooks can be created with store imports
- Test with mock stores if needed
- Full integration testing after stores are implemented

[Source: stories/1-4-react-router-i18n-setup.md]

---

## Dev Agent Record

### Context Reference

- `docs/stories/1-5-core-logic-wrapper-hooks.context.xml`

### Agent Model Used

Antigravity (Gemini Pro)

### Debug Log References

- Reviewed WebUSBManager: static `isSupported()`, getter `isConnected`, getter `deviceInfo`
- Reviewed FirehoseProtocol: 28+ methods for partition operations
- Reviewed SaharaProtocol: `loadProgrammer()`, `execute()`, `currentState()`
- Reviewed OppoVipAuth: VIP handshake with digest/signature

### Completion Notes List

- ✅ Created Protocol Bridge Hook pattern implementation per architecture.md
- ✅ All hooks use `useRef` for singleton instances, `useCallback` for memoization
- ✅ State sync with Zustand stores (deviceStore, partitionStore, flashStore, terminalStore)
- ✅ Terminal logging with appropriate levels (info, success, error)
- ✅ Fixed lint errors: isSupported now correctly calls static method
- ✅ Fixed lint errors: isConnected accessed as getter, not method
- ✅ Fixed lint errors: SaharaResult requires state property
- ✅ ZERO changes to core/, auth/, services/ (confirmed via git status)
- ✅ npm run dev compiles successfully without TypeScript errors

### File List

- [x] NEW: src/hooks/index.ts (1.0 KB) - Barrel export for all hooks
- [x] NEW: src/hooks/useWebUSB.ts (5.2 KB) - WebUSBManager wrapper hook
- [x] NEW: src/hooks/useFirehose.ts (11.1 KB) - FirehoseProtocol wrapper hook
- [x] NEW: src/hooks/useSahara.ts (5.5 KB) - SaharaProtocol wrapper hook
- [x] NEW: src/hooks/useAuth.ts (6.0 KB) - OppoVipAuth wrapper hook
- [x] NEW: src/hooks/useTerminal.ts (4.2 KB) - Terminal logging convenience hook

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
| 2025-12-29 | Dev Agent | Implemented all 8 tasks, created 6 hook files |

