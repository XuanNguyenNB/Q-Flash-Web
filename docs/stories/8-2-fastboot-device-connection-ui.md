# Story 8.2: Fastboot Device Connection UI

## Story Info
- **Epic:** Epic 8 - Fastboot Mode Features
- **Priority:** P0 (Must have)
- **Estimated Effort:** 2 hours
- **Status:** review
- **Dependencies:** Story 8.1 (Fastboot Store & Hook)

---

## User Story

As a **user**,  
I want **to connect my device in Fastboot mode via a Connect button**,  
So that **I can perform Fastboot operations**.

---

## Acceptance Criteria

### AC1: Connect Button
- [x] "Connect Fastboot" button visible on Fastboot page
- [x] Button has 🔧 icon
- [x] Button uses orange accent for Fastboot mode

### AC2: Connection Flow
- [x] Click opens WebUSB device picker
- [x] Device picker filtered for Fastboot devices only
- [x] After selection, connection initiated
- [x] Button changes to "Disconnect" when connected

### AC3: Status Indicator
- [x] Status dot visible next to button
- [x] Disconnected: gray dot
- [x] Connecting: pulsing orange dot
- [x] Connected: solid green dot + product name

### AC4: Error Handling
- [x] "Device not found" message: "Ensure device is in Fastboot mode"
- [x] Errors logged to terminal
- [x] Toast notification for errors

---

## Technical Notes

### Component Structure

```tsx
// src/components/features/fastboot/FastbootConnectionStatus.tsx
export function FastbootConnectionStatus() {
  const { isConnecting, deviceInfo } = useFastbootStore();
  const { isConnected } = useDeviceStore();
  const { connect, disconnect } = useFastboot();
  
  return (
    <div className="flex items-center justify-between p-4 bg-card rounded-xl border">
      <Button 
        onClick={isConnected ? disconnect : connect}
        className="bg-orange-500 hover:bg-orange-600"
      >
        <Wrench className="mr-2 h-4 w-4" />
        {isConnected ? 'Disconnect' : 'Connect Fastboot'}
      </Button>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Status:</span>
        <StatusDot status={...} />
        <span>{getStatusText()}</span>
      </div>
    </div>
  );
}
```

---

## Tasks

- [x] Task 1: Create `FastbootConnectionStatus.tsx` component
- [x] Task 2: Add Connect/Disconnect button with orange styling
- [x] Task 3: Implement StatusDot (reuse from ADB)
- [x] Task 4: Show product name when connected
- [x] Task 5: Add error handling
- [x] Task 6: Test connection flow

---

## UI Mockup

**Disconnected:**
```
┌─ Connection ─────────────────────────────────────────────┐
│  [🔧 Connect Fastboot]         Status: ● Disconnected    │
└──────────────────────────────────────────────────────────┘
```

**Connected:**
```
┌─ Connection ─────────────────────────────────────────────┐
│  [🔧 Disconnect]         Status: ● Connected (cheetah)   │
└──────────────────────────────────────────────────────────┘
```

---

## Definition of Done

- [x] Connect button works with WebUSB picker
- [x] Status indicator shows correct state
- [x] Errors handled and logged
- [x] Story marked as `done` in sprint-status.yaml

---

## File List

### New Files
- `src/components/features/fastboot/FastbootConnectionStatus.tsx` - Connection UI component
- `src/components/features/fastboot/index.ts` - Component exports

### Modified Files
- `src/pages/FastbootPage.tsx` - Updated with connection UI and feature cards
- `src/i18n/translations/en.json` - Added Fastboot connection translations
- `src/i18n/translations/vi.json` - Added Fastboot connection translations (Vietnamese)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Created FastbootConnectionStatus component | AI Dev Agent |
| 2025-12-30 | Updated FastbootPage with connection UI | AI Dev Agent |
| 2025-12-30 | Added i18n translations (EN/VI) | AI Dev Agent |

---

## Dev Agent Record

### Debug Log
- Reused ConnectionStatusDot from device features
- Integrated useFastboot hook for connection management
- Added toast notifications via sonner
- Implemented orange styling for Fastboot mode branding

### Completion Notes
✅ Story 8.2 implementation complete
- FastbootConnectionStatus shows connect/disconnect button with orange accent
- Status dot changes based on connection state (gray/orange pulsing/green)
- Product name displayed when connected
- Toast notifications for success/error states
- FastbootPage updated with feature cards showing device info

---

## References

- [UX Design - Fastboot Page](../ux-design-adb-fastboot.md#fastboot-mode-page-design)

