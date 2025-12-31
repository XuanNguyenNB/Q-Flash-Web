# Story 7.3: ADB Device Info Panel

## Story Info
- **Epic:** Epic 7 - ADB Mode Features
- **Priority:** P0 (Must have)
- **Estimated Effort:** 2 hours
- **Status:** review
- **Dependencies:** Story 7.2 (ADB Connection UI)

---

## User Story

As a **user**,  
I want **to see my device information after connecting via ADB**,  
So that **I can verify the correct device is connected**.

---

## Acceptance Criteria

### AC1: Device Info Display
- [x] Panel shows after device connected
- [x] Displays: Model, Android Version, Build Number, Serial, Manufacturer, Device codename

### AC2: Empty State
- [x] Shows "Connect device to view info" when disconnected
- [x] Uses muted text styling

### AC3: Refresh Button
- [x] "Refresh" button in panel header
- [x] Clicking re-fetches device info
- [x] Shows loading state during refresh

### AC4: Styling
- [x] Card component with header
- [x] Label-value pairs layout
- [x] Labels in muted color
- [x] Values in foreground color

---

## Technical Notes

### Component Structure

```tsx
// src/components/features/adb/ADBDeviceInfo.tsx
export function ADBDeviceInfo() {
  const { deviceInfo } = useADBStore();
  const { isConnected } = useDeviceStore();
  
  if (!isConnected) {
    return <EmptyState />;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Information</CardTitle>
        <Button size="icon" onClick={refresh}>
          <RefreshCw />
        </Button>
      </CardHeader>
      <CardContent>
        <InfoRow label="Model" value={deviceInfo?.model} />
        <InfoRow label="Android" value={deviceInfo?.androidVersion} />
        {/* ... */}
      </CardContent>
    </Card>
  );
}
```

### Info Row Component

```tsx
function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground font-medium">{value || '—'}</span>
    </div>
  );
}
```

---

## Tasks

- [x] Task 1: Create `ADBDeviceInfo.tsx` component
- [x] Task 2: Create `InfoRow` subcomponent
- [x] Task 3: Add empty state for disconnected
- [x] Task 4: Add refresh button with icon
- [x] Task 5: Style with Card from shadcn/ui
- [x] Task 6: Add i18n translations

---

## UI Mockup

**Connected:**
```
┌─ Device Information ─────────────────────── [🔄] ─┐
│                                                   │
│  Model             Pixel 7 Pro                    │
│  ───────────────────────────────────────────────  │
│  Android           14                             │
│  ───────────────────────────────────────────────  │
│  Build             AP2A.240805.005                │
│  ───────────────────────────────────────────────  │
│  Serial            XXXXXXXXXXXX                   │
│  ───────────────────────────────────────────────  │
│  Manufacturer      Google                         │
│  ───────────────────────────────────────────────  │
│  Device            cheetah                        │
│                                                   │
└───────────────────────────────────────────────────┘
```

**Disconnected:**
```
┌─ Device Information ─────────────────────────────┐
│                                                   │
│      📱 Connect device to view information        │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Definition of Done

- [x] Device info displays correctly when connected
- [x] Empty state shows when disconnected
- [x] Refresh button works
- [x] i18n translations added
- [ ] Story marked as `done` in sprint-status.yaml

---

## File List

### Created Files
- `src/components/features/adb/ADBDeviceInfo.tsx` - Device Info Panel
- `src/components/features/adb/index.ts` - Barrel export (updated)

### Modified Files
- `src/i18n/translations/en.json` - Added Device Info labels
- `src/i18n/translations/vi.json` - Added Vietnamese Device Info labels

---

## Dev Agent Record

### Debug Log
- Corrected property names in ADBDeviceInfo.tsx (`id` -> `buildNumber`, `serialId` -> `serialNumber`) to match ADBProtocol interface
- Added comprehensive i18n support for all labels

### Completion Notes
- Implemented as a reusable Card component
- Includes loading state for refresh action
- Followed UX design for empty state
- Fully localized in English and Vietnamese

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Initial implementation of ADB Device Info Panel | Dev Agent |

---

## References

- [UX Design - Device Info Panel](../ux-design-adb-fastboot.md#device-info-panel)
