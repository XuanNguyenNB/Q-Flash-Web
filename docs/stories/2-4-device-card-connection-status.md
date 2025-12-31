# Story 2.4: Device Card & Connection Status

**Status:** review  
**Epic:** Epic 2 - Device Management & Connection  
**Created:** 2025-12-29  
**Story Key:** 2-4-device-card-connection-status

---

## Story

As a **user**,  
I want **to see my device connection status and connect/disconnect**,  
so that **I know when my device is ready**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | When a device is selected, Device Card shows device name and chipset | Select device → verify name and chipset displayed |
| AC2 | Connection status dot reflects current state (gray=disconnected, pulsing=connecting, green=connected, red=error) | Observe dot changes through connection flow |
| AC3 | Disconnected state shows gray dot and "Connect Device" button | Not connected → verify gray dot + connect button |
| AC4 | Connecting state shows pulsing animation | Initiate connection → verify pulse animation |
| AC5 | Connected state shows green dot, device info, and "Disconnect" button | Connect → verify green dot + disconnect button |
| AC6 | Error state shows red dot and error message | Force error → verify red dot + message |
| AC7 | Connect button triggers `useWebUSB.connect()` | Click connect → verify useWebUSB called |
| AC8 | Connection status syncs with `deviceStore.isConnected` | Verify store state matches UI |

---

## Tasks / Subtasks

- [x] **Task 1: Create DeviceCard component** (AC: 1, 2, 3, 5, 6)
  - [x] 1.1 Create `src/components/features/device/DeviceCard.tsx`
  - [x] 1.2 Display device name from `deviceStore.selectedDevice.name`
  - [x] 1.3 Display chipset from `deviceStore.selectedDevice.chipset`
  - [x] 1.4 Create card layout with shadcn/ui Card component
  - [x] 1.5 Conditionally render based on device selected state
  - [x] 1.6 Show placeholder when no device selected

- [x] **Task 2: Create ConnectionStatusDot component** (AC: 2, 3, 4, 5, 6)
  - [x] 2.1 Create `src/components/features/device/ConnectionStatusDot.tsx`
  - [x] 2.2 Accept `status` prop: `'disconnected' | 'connecting' | 'connected' | 'error'`
  - [x] 2.3 Disconnected: gray dot (`bg-zinc-500`)
  - [x] 2.4 Connecting: pulsing animation (`animate-pulse bg-yellow-500`)
  - [x] 2.5 Connected: green dot (`bg-green-500`)
  - [x] 2.6 Error: red dot (`bg-red-500`)
  - [x] 2.7 Use CSS keyframes for smooth pulse animation

- [x] **Task 3: Implement connection actions** (AC: 3, 5, 7)
  - [x] 3.1 Add "Connect Device" button for disconnected state
  - [x] 3.2 Add "Disconnect" button for connected state
  - [x] 3.3 Wire connect button to `useWebUSB.connect()`
  - [x] 3.4 Wire disconnect button to `useWebUSB.disconnect()`
  - [x] 3.5 Disable buttons during connecting state
  - [x] 3.6 Use shadcn/ui Button component with appropriate variants

- [x] **Task 4: Implement connection state management** (AC: 4, 8)
  - [x] 4.1 Create local connection status state: `'disconnected' | 'connecting' | 'connected' | 'error'`
  - [x] 4.2 Sync with `deviceStore.isConnected`
  - [x] 4.3 Set 'connecting' when connection starts
  - [x] 4.4 Set 'connected' on success
  - [x] 4.5 Set 'error' on failure
  - [x] 4.6 Store error message for display

- [x] **Task 5: Display error state** (AC: 6)
  - [x] 5.1 Show red status dot on error
  - [x] 5.2 Display error message below device info
  - [x] 5.3 Style error message with `text-red-500`
  - [x] 5.4 Add "Retry" button that calls connect again
  - [x] 5.5 Log error to `terminalStore`

- [x] **Task 6: Integrate DeviceCard into Sidebar** (AC: 1-8)
  - [x] 6.1 Replace placeholder in `Sidebar.tsx` with `<DeviceCard />`
  - [x] 6.2 Position at top of sidebar
  - [x] 6.3 Ensure proper spacing and styling
  - [x] 6.4 Export DeviceCard from component barrel

- [x] **Task 7: Add i18n translations** (AC: all)
  - [x] 7.1 Add translation keys to `src/i18n/translations/en.json`:
    - `device.card.noDevice`: "No device selected"
    - `device.card.selectDevice`: "Select a device to begin"
    - `device.card.chipset`: "Chipset"
    - `device.status.disconnected`: "Disconnected"
    - `device.status.connecting`: "Connecting..."
    - `device.status.connected`: "Connected"
    - `device.status.error`: "Connection Error"
    - `device.action.connect`: "Connect Device"
    - `device.action.disconnect`: "Disconnect"
    - `device.action.retry`: "Retry"
  - [x] 7.2 Add Vietnamese translations to `src/i18n/translations/vi.json`

- [x] **Task 8: Testing and verification** (AC: 1-8)
  - [x] 8.1 Run `npm run dev` and verify no TypeScript errors
  - [x] 8.2 Test DeviceCard displays selected device info
  - [x] 8.3 Test status dot colors for all states
  - [x] 8.4 Test pulse animation during connecting
  - [x] 8.5 Test connect/disconnect button functionality
  - [x] 8.6 Test error state display
  - [x] 8.7 Test UI responds to store changes

---

## Dev Notes

### Architecture Context

Story 2.4 implements the **Device Card** component for the sidebar, providing visual feedback for device connection status. This is a critical UX element that users will constantly reference during flash operations.

**Pattern:** This component uses the **Hook Wrapper Pattern** from architecture.md, calling `useWebUSB` hook which wraps the core `WebUSBManager`.

### Component Structure

```typescript
// DeviceCard.tsx - Main component
interface DeviceCardProps {
  className?: string;
}

export function DeviceCard({ className }: DeviceCardProps) {
  const { selectedDevice, isConnected } = useDeviceStore();
  const { connect, disconnect } = useWebUSB();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  // Handle connect/disconnect
  const handleConnect = async () => {
    setStatus('connecting');
    try {
      await connect();
      setStatus('connected');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };
  
  // Render card content based on status
  return (
    <Card className={cn("...", className)}>
      {selectedDevice ? (
        <>
          <DeviceInfo device={selectedDevice} />
          <ConnectionStatusDot status={status} />
          <ConnectionActions status={status} onConnect={handleConnect} />
          {error && <ErrorMessage message={error} />}
        </>
      ) : (
        <EmptyState />
      )}
    </Card>
  );
}
```

### Status Dot Animation (CSS)

```css
/* Pulse animation for connecting state */
@keyframes connection-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.status-dot-connecting {
  animation: connection-pulse 1.5s ease-in-out infinite;
}
```

### Integration with useWebUSB Hook

From Story 1.5, `useWebUSB.ts` provides:
- `connect()` - Initiates WebUSB connection, updates deviceStore
- `disconnect()` - Closes connection, updates deviceStore
- Connection state synced to `deviceStore.isConnected`

```typescript
// Usage in DeviceCard
const { connect, disconnect } = useWebUSB();
const { isConnected } = useDeviceStore();

// Status derived from isConnected + local state
const status = isConnected ? 'connected' : 
               isConnecting ? 'connecting' : 
               hasError ? 'error' : 'disconnected';
```

### State Flow

```
User clicks "Connect Device"
        ↓
setStatus('connecting')
        ↓
useWebUSB.connect() called
        ↓
   Success:                    Failure:
     ↓                           ↓
deviceStore.isConnected=true   setError(message)
setStatus('connected')         setStatus('error')
Log to terminalStore           Show error in UI + log
```

### Visual Design

Based on UX Design Specification:
- Card uses `bg-zinc-900` with `border border-zinc-800`
- Status dot: 8px circle with subtle glow effect
- Device name: `text-sm font-medium text-zinc-100`
- Chipset: `text-xs text-zinc-400`
- Connect button: Default variant
- Disconnect button: Outline variant

### References

- [Source: docs/architecture.md#Hook-Wrapper-Pattern] - useWebUSB pattern
- [Source: docs/architecture.md#Data-Architecture] - deviceStore structure
- [Source: docs/epics.md#Story-2.4] - Story definition and AC
- [Source: docs/stories/2-2-device-selector-component.md] - Device selection context
- [Source: docs/stories/1-5-core-logic-wrapper-hooks.md] - useWebUSB hook

---

## Learnings from Previous Story

**From Story 2-3-auto-detect-firehose-by-chipset (Status: ready-for-dev)**

- **useFirehoseLoader hook**: Created for auto-loading firehose files by chipset
- **Loading states pattern**: `idle | loading | success | error` pattern established
- **Session caching**: Map-based caching keyed by chipsetFolder
- **Error handling flow**: terminalStore.log() + toast notification pattern
- **i18n key pattern**: `firehose.{action}.{state}` naming convention

**Key patterns to reuse:**
- **Status state machine**: Use similar pattern for connection status
- **Error handling**: Log to terminal + show toast + display in UI
- **Button disable during loading**: Prevent duplicate actions
- **Animation patterns**: CSS keyframes for pulse effect

**Component integration:**
- DeviceCard should trigger firehose loading after successful connection
- Status flow: Device selected → Firehose loaded → USB connected → Ready

[Source: stories/2-3-auto-detect-firehose-by-chipset.md]

---

## Prerequisites

- **Story 2.2** (DeviceSelector Component) - Provides selected device info
- **Story 2.3** (Auto-detect Firehose) - Firehose loading that precedes connection
- **Story 1.5** (Core Logic Wrapper Hooks) - `useWebUSB` hook for connection

**Note:** Story 2.3 is ready-for-dev. This story should be developed after 2.3 completes so DeviceCard can show firehose loading status alongside connection status.

---

## Dev Agent Record

### Context Reference

- `docs/stories/2-4-device-card-connection-status.context.xml` - Generated 2025-12-29

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

<!-- To be filled during implementation -->

### Completion Notes List

- ✅ Created DeviceCard component with full connection state management
- ✅ Implemented ConnectionStatusDot with 4 states (disconnected, connecting, connected, error)
- ✅ Integrated useWebUSB hook for connect/disconnect functionality
- ✅ Added error handling with retry button and terminal logging
- ✅ Replaced inline device card in Sidebar with new DeviceCard component
- ✅ Added comprehensive i18n support (EN + VI)
- ✅ All acceptance criteria met - component displays device info, status dot changes color/animation based on state, buttons work correctly
- ✅ Dev server running without TypeScript errors

### File List

- [x] NEW: src/components/features/device/DeviceCard.tsx
- [x] NEW: src/components/features/device/ConnectionStatusDot.tsx
- [x] NEW: src/components/features/device/index.ts
- [x] MODIFIED: src/components/layout/Sidebar.tsx
- [x] MODIFIED: src/i18n/translations/en.json
- [x] MODIFIED: src/i18n/translations/vi.json

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
