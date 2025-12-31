# Story 2.3: Auto-detect Firehose by Chipset

**Status:** review  
**Epic:** Epic 2 - Device Management & Connection  
**Created:** 2025-12-29  
**Story Key:** 2-3-auto-detect-firehose-by-chipset

---

## Story

As a **user**,  
I want **the tool to automatically load firehose files when I select a device**,  
so that **I don't have to manually select files**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | When a device is selected, firehose URLs are constructed from `chipsetFolder` | Select device → verify URLs constructed correctly |
| AC2 | `programmer.melf`, `digest.elf`, `signature.bin` are automatically fetched | Select device → verify all 3 files fetched |
| AC3 | Loading progress is shown in the UI with clear status | Select device → verify loading indicator visible |
| AC4 | Errors are logged to terminal and shown in toast notification | Force error → verify terminal log + toast |
| AC5 | If auto-load fails, a popup offers manual file selection | Force failure → verify popup appears |
| AC6 | Loaded firehose is cached in memory for the session | Select device → switch → switch back → verify no re-fetch |
| AC7 | `deviceStore.firehoseLoaded` is set to `true` when complete | Verify store state after load |
| AC8 | Progress indicator is shown during fetch with percentage/status | Observe loading UI |

---

## Tasks / Subtasks

- [x] **Task 1: Create useFirehoseLoader hook** (AC: 1, 2, 6, 7)
  - [x] 1.1 Create `src/hooks/useFirehoseLoader.ts`
  - [x] 1.2 Define interface `FirehoseFiles { programmer: ArrayBuffer, digest: ArrayBuffer, signature: ArrayBuffer }`
  - [x] 1.3 Create session cache Map for loaded firehose files keyed by `chipsetFolder`
  - [x] 1.4 Implement `loadFirehose(device: DeviceProfile)` function
  - [x] 1.5 Construct URLs from device.chipsetFolder: `/firehose/{chipsetFolder}/programmer.melf`, etc.
  - [x] 1.6 Fetch all 3 files in parallel with Promise.all
  - [x] 1.7 Update `deviceStore.firehoseLoaded = true` on success
  - [x] 1.8 Return cached data if already loaded for this chipset

- [x] **Task 2: Implement loading progress tracking** (AC: 3, 8)
  - [x] 2.1 Create loading state in hook: `idle | loading | success | error`
  - [x] 2.2 Track progress: `{ status, loaded: number, total: number, files: string[] }`
  - [x] 2.3 Update progress as each file completes
  - [x] 2.4 Expose `progress` state from hook for UI consumption

- [x] **Task 3: Create FirehoseLoadingIndicator component** (AC: 3, 8)
  - [x] 3.1 Create `src/components/features/device/FirehoseLoadingIndicator.tsx`
  - [x] 3.2 Display loading spinner/progress when fetching
  - [x] 3.3 Show file names being loaded
  - [x] 3.4 Show success checkmark when complete
  - [x] 3.5 Style with shadcn/ui components (Spinner, Progress)

- [x] **Task 4: Implement error handling** (AC: 4)
  - [x] 4.1 Catch fetch errors and network failures
  - [x] 4.2 Log detailed error to `terminalStore.log('error', ...)`
  - [x] 4.3 Show user-friendly toast with error message
  - [x] 4.4 Set `deviceStore.firehoseLoaded = false` on error
  - [x] 4.5 Store error in hook state for UI display

- [x] **Task 5: Create ManualFirehosePopup component** (AC: 5)
  - [x] 5.1 Create `src/components/features/device/ManualFirehosePopup.tsx`
  - [x] 5.2 Use shadcn/ui Dialog component
  - [x] 5.3 Add file input for each firehose file (programmer, digest, signature)
  - [x] 5.4 Show which files failed to auto-load
  - [x] 5.5 Allow user to browse and select files manually
  - [x] 5.6 "Skip" option to continue without firehose (for manual selection later)
  - [x] 5.7 On submit, pass files to `useFirehose` hook

- [x] **Task 6: Integrate auto-load trigger on device selection** (AC: 1-7)
  - [x] 6.1 In DeviceSelector or DeviceCard, call `loadFirehose()` when device changes
  - [x] 6.2 Use `useEffect` to watch `deviceStore.selectedDevice` changes
  - [x] 6.3 Show FirehoseLoadingIndicator in Sidebar during load
  - [x] 6.4 Show ManualFirehosePopup on failure

- [x] **Task 7: Add i18n translations** (AC: all)
  - [x] 7.1 Add translation keys to `src/i18n/en.json`:
    - `firehose.loading`: "Loading firehose files..."
    - `firehose.loading.programmer`: "Downloading programmer.melf..."
    - `firehose.loading.digest`: "Downloading digest.elf..."
    - `firehose.loading.signature`: "Downloading signature.bin..."
    - `firehose.success`: "Firehose loaded successfully"
    - `firehose.error.title`: "Failed to load firehose"
    - `firehose.error.message`: "Could not download firehose files for {device}"
    - `firehose.manual.title`: "Manual File Selection"
    - `firehose.manual.description`: "Auto-load failed. Please select firehose files manually."
    - `firehose.manual.skip`: "Skip for now"
    - `firehose.manual.browse`: "Browse..."
  - [x] 7.2 Add Vietnamese translations to `src/i18n/vi.json`

- [x] **Task 8: Testing and verification** (AC: 1-8)
  - [x] 8.1 Run `npm run dev` and verify no TypeScript errors
  - [x] 8.2 Test auto-load with valid device (OnePlus 12 - SM8650_Gen3)
  - [x] 8.3 Test error handling by using invalid URL
  - [x] 8.4 Test manual popup appears on failure
  - [x] 8.5 Test session cache (select device, switch, switch back)
  - [x] 8.6 Test terminal logging for all events
  - [x] 8.7 Test toast notifications

---

## Dev Notes

### Architecture Context

Story 2.3 implements **automatic firehose file loading** as described in **PRD F5**. This is a critical UX improvement that eliminates manual file selection for most users.

**Pattern:** This story introduces a new hook `useFirehoseLoader` that:
1. Constructs URLs from device's `chipsetFolder` field
2. Fetches firehose files from `/firehose/{chipsetFolder}/` directory
3. Caches loaded files in memory (session-level)
4. Falls back to manual selection popup on failure

### Data Flow

```
DeviceSelector selects device
        ↓
useFirehoseLoader.loadFirehose(device)
        ↓
Construct URLs: /firehose/{chipsetFolder}/programmer.melf
        ↓
Fetch all 3 files in parallel
        ↓
  Success:                    Failure:
    ↓                           ↓
Store in cache          Show ManualFirehosePopup
deviceStore.firehoseLoaded = true        ↓
                        User selects files manually
                                ↓
                        Pass to useFirehose hook
```

### URL Construction

Based on PRD F5 and devices.json schema from Story 2.1:

```typescript
// Device entry example:
{
  "id": "oneplus-12",
  "chipsetFolder": "SM8650_Gen3",
  // ...
}

// Firehose URLs:
const baseUrl = `/firehose/${device.chipsetFolder}`;
const urls = {
  programmer: `${baseUrl}/programmer.melf`,
  digest: `${baseUrl}/digest.elf`,
  signature: `${baseUrl}/signature.bin`,
};
```

### Session Caching Strategy

```typescript
// Cache loaded firehose by chipset folder (not device ID)
// because multiple devices can share the same chipset
const firehoseCache = new Map<string, FirehoseFiles>();

// Check cache before fetching
const cached = firehoseCache.get(device.chipsetFolder);
if (cached) {
  return cached; // Skip network request
}
```

### Integration with useFirehose Hook

From Story 1.5, `useFirehose.ts` wraps `FirehoseProtocol`. This story's `useFirehoseLoader` provides the files, then:

```typescript
// After loading files with useFirehoseLoader:
const { setFirehoseFiles } = useFirehose();
setFirehoseFiles(programmer, digest, signature);
```

### Component Structure

```typescript
// src/hooks/useFirehoseLoader.ts
interface FirehoseLoaderState {
  status: 'idle' | 'loading' | 'success' | 'error';
  progress: { loaded: number; total: number; currentFile: string };
  error: string | null;
}

export function useFirehoseLoader() {
  // Cache, loading logic, error handling
  return {
    loadFirehose,
    status,
    progress,
    error,
    showManualPopup,
  };
}
```

### References

- [Source: docs/PRD.md#F5] - Auto-detect Firehose by Device Chipset
- [Source: docs/architecture.md#Hook-Wrapper-Pattern] - Hook pattern for core logic
- [Source: docs/epics.md#Story-2.3] - Story definition and AC
- [Source: docs/stories/2-2-device-selector-component.md] - Device selection implementation
- [Source: docs/stories/2-1-device-configuration-update.md] - Device JSON schema with chipsetFolder

---

## Learnings from Previous Story

**From Story 2-2-device-selector-component (Status: drafted)**

- **DeviceSelector pattern**: Uses shadcn/ui Command/Combobox with grouped display by chipset
- **deviceStore integration**: Selection updates `deviceStore.selectedDevice`
- **settingsStore persistence**: `lastDeviceId` saved for reload restore
- **Device schema**: `chipsetFolder` field contains the folder name for firehose URLs
- **shadcn/ui components**: Command, Popover already available

**Key patterns from Epic 1:**
- **useFirehose hook** (Story 1.5) - wraps FirehoseProtocol, provides `setFirehoseFiles()` method
- **terminalStore** (Story 1.3) - use `log('info', ...)` for progress, `log('error', ...)` for failures
- **Toast notifications** - use shadcn/ui Toast for user feedback

[Source: stories/2-2-device-selector-component.md]

---

## Prerequisites

- **Story 2.2** (DeviceSelector Component) - Device selection that triggers auto-load
- **Story 2.1** (Device Configuration) - `devices.json` with `chipsetFolder` field
- **Story 1.5** (Core Logic Wrapper Hooks) - `useFirehose` hook to receive loaded files

**Note:** Stories 2.1 and 2.2 are drafted. Story 1.5 is in review. This story can be developed once 2.2 provides device selection UI.

---

## Dev Agent Record

### Context Reference

- `docs/stories/2-3-auto-detect-firehose-by-chipset.context.xml` - Generated 2025-12-29

### Agent Model Used

Gemini 2.5 Pro (Antigravity Dev Agent)

### Debug Log References

- TypeScript compile: `npx tsc --noEmit` - Passed (no errors)
- Browser test: http://localhost:5175 - All acceptance criteria verified

### Completion Notes List

- **useFirehoseLoader hook**: Implemented with module-level caching by chipset, progress tracking, and error handling
- **FirehoseLoadingIndicator**: Shows loading spinner, current file, success/error states with i18n
- **ManualFirehosePopup**: shadcn/ui Dialog with file inputs for programmer, digest, signature
- **DevicePanel**: Wrapper component integrating DeviceSelector with auto firehose loading
- **Caching verified**: Switching between devices sharing same chipset correctly uses cached files
- **Error handling verified**: 404 errors trigger ManualFirehosePopup dialog
- **i18n**: Both English and Vietnamese translations added

### File List

- [x] NEW: src/hooks/useFirehoseLoader.ts
- [x] NEW: src/components/features/device/FirehoseLoadingIndicator.tsx
- [x] NEW: src/components/features/device/ManualFirehosePopup.tsx
- [x] NEW: src/components/features/device/DevicePanel.tsx
- [x] NEW: src/components/ui/dialog.tsx
- [x] MODIFIED: src/components/layout/Sidebar.tsx (replaced DeviceSelector with DevicePanel)
- [x] MODIFIED: src/hooks/index.ts (added useFirehoseLoader export)
- [x] MODIFIED: src/i18n/translations/en.json (added firehose translations)
- [x] MODIFIED: src/i18n/translations/vi.json (added firehose translations)

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
| 2025-12-29 | Dev Agent | Implemented all 8 tasks, all ACs verified, ready for review |
