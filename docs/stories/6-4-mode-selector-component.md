# Story 6.4: Mode Selector Component & Device Store Enhancement

## Story Info
- **Epic:** Epic 6 - Mode Selection & Core Infrastructure
- **Priority:** P0 (Must have)
- **Estimated Effort:** 4 hours
- **Status:** review
- **Dependencies:** Epic 1, Epic 2 complete

---

## User Story

As a **user**,  
I want **to select device mode (EDL/ADB/Fastboot) from the navigation bar**,  
So that **I can work with devices in different modes**.

---

## Acceptance Criteria

### AC1: Mode Selector UI
- [x] Mode selector component visible in Header/Navigation
- [x] 3 mode options displayed: EDL, ADB, Fastboot
- [x] Each mode has icon: ⚡ EDL, 📱 ADB, 🔧 Fastboot
- [x] Current mode has visual highlight (different background, text color)
- [x] Hover states on non-selected modes

### AC2: Mode Switching
- [x] Clicking a mode navigates to that mode's page
- [x] EDL → `/` or `/tool`
- [x] ADB → `/adb`
- [x] Fastboot → `/fastboot`

### AC3: Mode Persistence
- [x] Selected mode saved to localStorage
- [x] Mode restored on page reload

### AC4: Connected Device Lock
- [x] When device is connected, other modes are disabled
- [x] Disabled modes have `opacity-50` and `cursor-not-allowed`
- [x] Tooltip on disabled modes: "Disconnect device to change mode"

### AC5: Device Store Enhancement
- [x] `deviceStore.currentMode` stores 'edl' | 'adb' | 'fastboot'
- [x] `deviceStore.setMode(mode)` updates mode and resets connection
- [x] Mode persisted via Zustand persist middleware

### AC6: Routing
- [x] Route `/adb` exists and renders placeholder
- [x] Route `/fastboot` exists and renders placeholder
- [x] Routes accessible from browser URL

---

## Technical Notes

### Mode Selector Design (Tab Pills)

```tsx
// src/components/layout/ModeSelector.tsx
const modes = [
  { id: 'edl', label: 'EDL', icon: Zap, path: '/' },
  { id: 'adb', label: 'ADB', icon: Smartphone, path: '/adb' },
  { id: 'fastboot', label: 'Fastboot', icon: Wrench, path: '/fastboot' },
];
```

### Device Store Enhancement

```typescript
// Update src/stores/deviceStore.ts
export type DeviceMode = 'edl' | 'adb' | 'fastboot';

interface DeviceState {
  currentMode: DeviceMode;
  setMode: (mode: DeviceMode) => void;
  // ... existing properties
}
```

### Routes to Add

```typescript
// Update src/router.ts or App.tsx
{ path: '/adb', element: <ADBPage /> }
{ path: '/fastboot', element: <FastbootPage /> }
```

### i18n Keys

```json
{
  "mode": {
    "edl": "EDL",
    "adb": "ADB",
    "fastboot": "Fastboot",
    "switchDisabled": "Disconnect device to change mode"
  }
}
```

---

## Tasks

- [x] Task 1: Update `deviceStore.ts` with `currentMode` and `setMode`
- [x] Task 2: Add persist middleware for mode
- [x] Task 3: Create `ModeSelector.tsx` component
- [x] Task 4: Style ModeSelector with Tailwind
- [x] Task 5: Add disabled state when device connected
- [x] Task 6: Integrate ModeSelector into Header
- [x] Task 7: Create placeholder ADBPage
- [x] Task 8: Create placeholder FastbootPage
- [x] Task 9: Add routes to router
- [x] Task 10: Add i18n translations (EN/VI)
- [x] Task 11: Test mode switching and persistence

---

## UI Mockup

```
┌────────────────────────────────────────────────────────────────┐
│  🔷 Q-Flash    [⚡ EDL] [📱 ADB] [🔧 Fastboot]  │  Guide  ...  │
└────────────────────────────────────────────────────────────────┘
                    ↑ Selected (primary bg)
```

---

## Definition of Done

- [x] Mode selector visible and functional
- [x] All 3 modes navigate correctly
- [x] Mode persisted across reloads
- [x] Disabled when device connected
- [x] ADB and Fastboot placeholder pages exist
- [x] i18n translations added
- [ ] Story marked as `done` in sprint-status.yaml

---

## File List

### New Files
- `src/components/layout/ModeSelector.tsx` - Mode selector tab pills component
- `src/pages/ADBPage.tsx` - ADB mode placeholder page
- `src/pages/FastbootPage.tsx` - Fastboot mode placeholder page

### Modified Files
- `src/stores/deviceStore.ts` - Added DeviceMode type, currentMode state, setMode action, persist middleware
- `src/components/layout/Header.tsx` - Integrated ModeSelector component
- `src/components/layout/index.ts` - Added ModeSelector export
- `src/app/routes.tsx` - Added ADB and Fastboot routes
- `src/i18n/translations/en.json` - Added mode, adb, fastboot translation keys
- `src/i18n/translations/vi.json` - Added mode, adb, fastboot translation keys (Vietnamese)

---

## Change Log

| Date | Change Description |
|------|-------------------|
| 2025-12-30 | Initial implementation - Mode selector, store enhancement, routes, i18n |

---

## Dev Agent Record

### Debug Log
- Implemented DeviceMode type and currentMode/setMode in deviceStore with Zustand persist middleware
- Created ModeSelector component with 3 mode pills (EDL/ADB/Fastboot) with icons from lucide-react
- Added disabled state when isConnected=true to prevent mode switching during active session
- Integrated ModeSelector between Logo and Navigation in Header
- Created ADBPage and FastbootPage placeholder pages with coming soon message and feature preview cards
- Added routes /adb and /fastboot to router
- Added complete i18n translations for EN and VI

### Completion Notes
✅ All tasks completed successfully
- TypeScript compiles without errors
- Mode selector is now visible in Header with clean tab pills design
- Clicking modes navigates to respective pages
- Mode is persisted to localStorage via Zustand persist middleware
- Disabled states work correctly when device is connected

---

## References

- [UX Design - Mode Selector](../ux-design-adb-fastboot.md#mode-selector-component)
- [Architecture - Device Store Enhancement](../architecture-usb-adb-fastboot.md#adr-009-device-store-enhancement)
