# Story 2.2: DeviceSelector Component

**Status:** review  
**Epic:** Epic 2 - Device Management & Connection  
**Created:** 2025-12-29  
**Story Key:** 2-2-device-selector-component

---

## Story

As a **user**,  
I want **a searchable dropdown to select my device grouped by chipset**,  
so that **I can easily find my device**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | Device selector dropdown displays all devices from `devices.json` | Open dropdown → verify all devices visible |
| AC2 | Devices are visually grouped by chipset family (e.g., SD 8 Gen 3, SD 888) | Verify group headers for each chipset |
| AC3 | Search/filter functionality filters devices by name, codename, or chipset | Type search term → verify filtering works |
| AC4 | Selecting a device updates `deviceStore.selectedDevice` | Select device → verify store state |
| AC5 | Selected device is displayed with device name and chipset name | Verify display shows "OnePlus 12 - Snapdragon 8 Gen 3" |
| AC6 | Selection is persisted in `settingsStore.lastDeviceId` and restored on reload | Select → reload page → verify device still selected |
| AC7 | Dropdown has proper UX: loading state, empty state, keyboard navigation | Test all states |
| AC8 | Component is fully translated (EN/VI) | Switch language → verify all text translated |

---

## Tasks / Subtasks

- [x] **Task 1: Create DeviceSelector component structure** (AC: 1, 2)
  - [x] 1.1 Create `src/components/features/device/DeviceSelector.tsx`
  - [x] 1.2 Import shadcn/ui Command or Combobox component
  - [x] 1.3 Create interface `DeviceSelectorProps` for component props
  - [x] 1.4 Set up basic component skeleton with proper TypeScript types

- [x] **Task 2: Load devices data** (AC: 1)
  - [x] 2.1 Create custom hook `useDevices` in `src/hooks/useDevices.ts` (nếu chưa có)
  - [x] 2.2 Fetch and parse `public/configs/devices.json`
  - [x] 2.3 Handle loading, error, and empty states
  - [x] 2.4 Store devices in deviceStore hoặc local state

- [x] **Task 3: Implement grouped display** (AC: 2)
  - [x] 3.1 Group devices by `chipsetName` field
  - [x] 3.2 Create group headers in dropdown (e.g., "Snapdragon 8 Gen 3")
  - [x] 3.3 Display device name, codename, and status badge within each group
  - [x] 3.4 Add status indicator: ✅ tested, 🔸 beta, 🔜 coming

- [x] **Task 4: Implement search/filter** (AC: 3)
  - [x] 4.1 Add search input at top of dropdown
  - [x] 4.2 Implement filter logic: match against name, codename, chipset, chipsetName
  - [x] 4.3 Case-insensitive search
  - [x] 4.4 Show "No results found" when no matches

- [x] **Task 5: Integrate with deviceStore** (AC: 4, 5)
  - [x] 5.1 On device selection, call `deviceStore.setDevice(device)`
  - [x] 5.2 Display selected device info: "{name} - {chipsetName}"
  - [x] 5.3 Show placeholder "Select a device..." when no device selected
  - [x] 5.4 Add clear selection button (X icon)

- [x] **Task 6: Implement persistence** (AC: 6)
  - [x] 6.1 On selection, save device ID to `settingsStore.lastDeviceId`
  - [x] 6.2 On component mount, read `lastDeviceId` from settingsStore
  - [x] 6.3 Auto-select device matching `lastDeviceId` on mount
  - [x] 6.4 Handle case where saved device no longer exists

- [x] **Task 7: Add UX polish** (AC: 7)
  - [x] 7.1 Loading skeleton while devices are fetching
  - [x] 7.2 Empty state with message when no devices configured
  - [x] 7.3 Keyboard navigation: Arrow keys, Enter to select, Escape to close
  - [x] 7.4 Focus management on open/close
  - [x] 7.5 Smooth open/close animation (use shadcn/ui defaults)

- [x] **Task 8: Add i18n translations** (AC: 8)
  - [x] 8.1 Add translation keys to `src/i18n/en.json`:
    - `device.selector.placeholder`: "Select a device..."
    - `device.selector.search`: "Search devices..."
    - `device.selector.noResults`: "No devices found"
    - `device.selector.loading`: "Loading devices..."
    - `device.status.tested`: "Tested"
    - `device.status.beta`: "Beta"
    - `device.status.coming`: "Coming soon"
  - [x] 8.2 Add Vietnamese translations to `src/i18n/vi.json`
  - [x] 8.3 Use `useTranslation()` hook in component

- [x] **Task 9: Integrate into Sidebar** (AC: 1-8)
  - [x] 9.1 Import DeviceSelector into `Sidebar.tsx`
  - [x] 9.2 Place DeviceSelector at top of sidebar (above device card)
  - [x] 9.3 Style to match sidebar width and theme

- [x] **Task 10: Testing and verification** (AC: 1-8)
  - [x] 10.1 Run `npm run dev` and verify no TypeScript errors
  - [x] 10.2 Test all devices appear in dropdown
  - [x] 10.3 Test search filtering works correctly
  - [x] 10.4 Test selection persists across page reload
  - [x] 10.5 Test language switching works
  - [x] 10.6 Test keyboard navigation

---

## Dev Notes

### Architecture Context

Đây là **first React component for Epic 2** Device Management. Component này sử dụng:
- **shadcn/ui Command** hoặc **Combobox** component cho dropdown functionality
- **deviceStore** (Zustand) để lưu selected device
- **settingsStore** (persisted) để lưu last selected device ID

**Design Pattern:** Component wrapper pattern theo architecture.md

### Component Structure

```typescript
// src/components/features/device/DeviceSelector.tsx
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useDeviceStore } from '@/stores/deviceStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DeviceEntry {
  id: string;
  brand: string;
  name: string;
  codename: string;
  chipset: string;
  chipsetName: string;
  status: 'tested' | 'beta' | 'coming';
}

interface DeviceSelectorProps {
  className?: string;
}

export function DeviceSelector({ className }: DeviceSelectorProps) {
  // Implementation
}
```

### Grouping Logic

```typescript
// Group devices by chipsetName
const groupedDevices = useMemo(() => {
  const groups: Record<string, DeviceEntry[]> = {};
  devices.forEach(device => {
    const key = device.chipsetName;
    if (!groups[key]) groups[key] = [];
    groups[key].push(device);
  });
  return groups;
}, [devices]);
```

### shadcn/ui Components Required

Cần cài đặt các components sau nếu chưa có:
```bash
npx shadcn@latest add command
npx shadcn@latest add popover
```

### Data Flow

```
devices.json → useDevices hook → DeviceSelector component
                                       ↓
                    deviceStore.setDevice() → DeviceCard displays
                                       ↓
                    settingsStore.lastDeviceId → localStorage (persist)
```

### Status Badge Colors

```typescript
const statusStyles = {
  tested: 'bg-green-500/10 text-green-500 border-green-500/20',
  beta: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  coming: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};
```

### References

- [Source: docs/architecture.md#component-pattern] - Component structure pattern
- [Source: docs/epics.md#Story-2.2] - Story definition and AC
- [Source: docs/ux-design-specification.md] - Design system and colors
- [Source: docs/stories/2-1-device-configuration-update.md] - Device JSON schema

---

## Learnings from Previous Story

**From Story 2-1-device-configuration-update (Status: drafted)**

- **Device Schema**: `devices.json` schema đã được định nghĩa với các fields:
  - `id`, `brand`, `name`, `codename`, `chipset`, `chipsetName`
  - `status`: 'tested' | 'beta' | 'coming'
  - `authMethod`, `presetId`, `firehose` URLs
- **Chipset Grouping**: Dùng `chipsetName` field để group (e.g., "Snapdragon 8 Gen 3")
- **Data Location**: `public/configs/devices.json`
- **Target**: 40+ devices across 13 chipset folders

**Key patterns from Epic 1:**
- React 19 + Vite setup complete (Story 1.1 - review)
- Tailwind CSS v4 + shadcn/ui configured (Story 1.2 - review)  
- Zustand stores created: `deviceStore`, `settingsStore` (Story 1.3 - review)
- i18n với react-i18next setup (Story 1.4 - review)
- Core logic wrapper hooks available (Story 1.5 - in-progress)
- App shell với Sidebar ready (Story 1.6 - in-progress)

[Source: stories/2-1-device-configuration-update.md]

---

## Prerequisites

- **Story 1.6** (App Shell Layout) - Sidebar component where DeviceSelector will be placed
- **Story 2.1** (Device Config Update) - `devices.json` with all device entries

**Note:** Story 1.6 đang in-progress, nên DeviceSelector có thể được develop song song và integrate khi Sidebar ready.

---

## Dev Agent Record

### Context Reference

- `docs/stories/2-2-device-selector-component.context.xml` - Generated 2025-12-29

### Agent Model Used

Gemini 2.5 Pro (Antigravity)

### Debug Log References

- TypeScript compilation: No errors
- Browser verification: All ACs passed (device selector visible, search works, grouping correct, persistence confirmed)

### Completion Notes List

1. **Implementation approach**: Used shadcn/ui Command + Popover pattern for searchable dropdown with CMDK under the hood
2. **Dependencies added**: `cmdk`, `@radix-ui/react-popover` - installed via npm
3. **Components created**: 
   - `command.tsx` - shadcn/ui Command wrapper for cmdk
   - `popover.tsx` - shadcn/ui Popover wrapper for Radix
   - `DeviceSelector.tsx` - Main feature component with full functionality
4. **Hook created**: `useDevices` hook fetches and caches devices.json with sorting by chipset generation
5. **Store integration**: 
   - `deviceStore.setDevice()` called on selection
   - `settingsStore.lastDeviceId` persisted and restored on mount
6. **i18n**: Added `device.selector.*` and `device.status.*` keys to both EN/VI translation files
7. **Sidebar integration**: DeviceSelector placed at top of sidebar, device card now reflects selected device

### File List

- [x] NEW: `src/components/features/device/DeviceSelector.tsx` - Main DeviceSelector component
- [x] NEW: `src/hooks/useDevices.ts` - Custom hook for loading devices
- [x] NEW: `src/components/ui/command.tsx` - shadcn/ui Command component
- [x] NEW: `src/components/ui/popover.tsx` - shadcn/ui Popover component
- [x] MODIFIED: `src/components/layout/Sidebar.tsx` - Integrated DeviceSelector
- [x] MODIFIED: `src/hooks/index.ts` - Added useDevices export
- [x] MODIFIED: `src/i18n/translations/en.json` - Added device.selector and device.status keys
- [x] MODIFIED: `src/i18n/translations/vi.json` - Added Vietnamese translations

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
| 2025-12-29 | Dev Agent | Implementation complete - all 10 tasks done, all ACs verified |

