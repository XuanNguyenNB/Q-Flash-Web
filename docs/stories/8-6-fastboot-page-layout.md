# Story 8.6: Fastboot Page Layout

## Story Info
- **Epic:** Epic 8 - Fastboot Mode Features
- **Priority:** P0 (Must have)
- **Estimated Effort:** 4 hours
- **Status:** backlog
- **Dependencies:** Stories 8.2, 8.3, 8.4, 8.5

---

## User Story

As a **user**,  
I want **a well-organized Fastboot page with all Fastboot features**,  
So that **I can easily perform Fastboot operations**.

---

## Acceptance Criteria

### AC1: Page Layout
- [ ] Page accessible at `/fastboot` route
- [ ] Header with Connection status
- [ ] Device Variables panel
- [ ] Bootloader Actions panel
- [ ] Flash Partitions panel
- [ ] Reboot Actions panel
- [ ] Terminal Log at bottom

### AC2: Component Integration
- [ ] `FastbootConnectionStatus` in header
- [ ] `FastbootDeviceInfo` in left column
- [ ] `BootloaderActions` in right column (top)
- [ ] `FastbootFlashPanel` spanning both columns
- [ ] Existing `LogPanel` at bottom

### AC3: Reboot Buttons
- [ ] "Reboot System" button
- [ ] "Reboot Bootloader" button
- [ ] "Reboot Recovery" button

### AC4: Responsive Design
- [ ] Desktop: Multi-column layout
- [ ] Tablet: Stack vertically
- [ ] Mobile: "Desktop Required" warning

### AC5: Page Title
- [ ] Browser title: "Q-Flash - Fastboot Mode"
- [ ] Page heading: "Fastboot Mode"

### AC6: i18n
- [ ] All text translated (EN/VI)

---

## Technical Notes

### Page Structure

```tsx
// src/pages/FastbootPage.tsx
export function FastbootPage() {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <header>
        <h1 className="text-2xl font-bold">{t('fastboot.title')}</h1>
      </header>
      
      {/* Connection */}
      <FastbootConnectionStatus />
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FastbootDeviceInfo />
        <BootloaderActions />
      </div>
      
      {/* Flash Panel */}
      <FastbootFlashPanel />
      
      {/* Reboot Actions */}
      <FastbootRebootActions />
      
      {/* Terminal Log */}
      <LogPanel />
    </div>
  );
}
```

### Reboot Actions Component

```tsx
// src/components/features/fastboot/FastbootRebootActions.tsx
export function FastbootRebootActions() {
  const { reboot, rebootBootloader, rebootRecovery } = useFastboot();
  const { isConnected } = useDeviceStore();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reboot</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-3 flex-wrap">
        <Button onClick={reboot} disabled={!isConnected}>
          <RefreshCw className="mr-2" /> Reboot System
        </Button>
        <Button onClick={rebootBootloader} disabled={!isConnected}>
          <Wrench className="mr-2" /> Reboot Bootloader
        </Button>
        <Button onClick={rebootRecovery} disabled={!isConnected}>
          <RefreshCw className="mr-2" /> Reboot Recovery
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## Tasks

- [ ] Task 1: Create `src/pages/FastbootPage.tsx`
- [ ] Task 2: Add page header with title
- [ ] Task 3: Integrate FastbootConnectionStatus
- [ ] Task 4: Create 2-column grid for info & bootloader
- [ ] Task 5: Integrate FastbootDeviceInfo
- [ ] Task 6: Integrate BootloaderActions
- [ ] Task 7: Integrate FastbootFlashPanel
- [ ] Task 8: Create FastbootRebootActions component
- [ ] Task 9: Add LogPanel at bottom
- [ ] Task 10: Add responsive breakpoints
- [ ] Task 11: Update browser title
- [ ] Task 12: Add all i18n translations
- [ ] Task 13: Test complete page flow

---

## UI Mockup

```
┌────────────────────────────────────────────────────────────────┐
│  🔷 Q-Flash    [EDL] [ADB] [Fastboot ▼]  │  Guide  Downloads   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Fastboot Mode                                                 │
│                                                                │
│  ┌─ Connection ────────────────────────────────────────────┐  │
│  │  [🔧 Connect Fastboot]        Status: ● Disconnected    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Device Variables ─────┐ ┌─ Bootloader ────────────────┐  │
│  │                        │ │                              │  │
│  │  Product:    —         │ │  Status: [🔒 Unknown]        │  │
│  │  Serial:     —         │ │                              │  │
│  │  Bootloader: —         │ │  [🔓 Unlock]                 │  │
│  │  ...                   │ │  [🔒 Lock]                   │  │
│  │                        │ │                              │  │
│  └────────────────────────┘ └──────────────────────────────┘  │
│                                                                │
│  ┌─ Flash Partitions ──────────────────────────────────────┐  │
│  │  [📦 Flash Boot] [📦 Flash Recovery] [📦 Flash Vbmeta] │  │
│  │  [🗑️ Erase Partition ▼]                                 │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Reboot ────────────────────────────────────────────────┐  │
│  │  [🔄 Reboot System] [🔧 Reboot Bootloader] [🔄 Recovery]│  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Terminal Log ─────────────────────────── [Copy] [Clear]┐  │
│  │  [11:35:00] Welcome to Fastboot Mode                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Definition of Done

- [ ] Fastboot page renders at /fastboot
- [ ] All child components integrated
- [ ] Reboot buttons work
- [ ] Layout responsive
- [ ] i18n translations complete
- [ ] Page title updates
- [ ] Story marked as `done` in sprint-status.yaml

---

## References

- [UX Design - Fastboot Page](../ux-design-adb-fastboot.md#fastboot-mode-page-design)
