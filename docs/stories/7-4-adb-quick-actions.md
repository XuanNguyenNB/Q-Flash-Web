# Story 7.4: ADB Quick Actions (Reboot Buttons)

## Story Info
- **Epic:** Epic 7 - ADB Mode Features
- **Priority:** P0 (Must have)
- **Estimated Effort:** 3 hours
- **Status:** review
- **Dependencies:** Story 7.1 (ADB Store & Hook)

---

## User Story

As a **user**,  
I want **buttons to reboot my device to different modes**,  
So that **I can quickly switch between EDL, Fastboot, and Recovery**.

---

## Acceptance Criteria

### AC1: Button List
- [x] ⚡ "Reboot EDL" button
- [x] 🔧 "Reboot Fastboot" button
- [x] 🔄 "Reboot Recovery" button
- [x] 🔄 "Reboot System" button
- [x] ⏻ "Power Off" button (styled differently)

### AC2: Button State
- [x] All buttons disabled when no device connected
- [x] Loading spinner on button during operation
- [x] Buttons disabled during operation

### AC3: Execution
- [x] Clicking sends corresponding reboot command
- [x] Terminal logs command execution
- [x] Toast notification on success/failure
- [x] Device auto-disconnects after reboot commands

### AC4: Power Off Confirmation
- [x] Power Off requires confirmation dialog
- [x] Dialog asks "Are you sure you want to power off?"
- [x] Cancel and Confirm buttons

### AC5: Mode Switch Hint
- [x] Info text: "After reboot, switch to the appropriate mode tab"

---

## Technical Notes

### Component Structure

```tsx
// src/components/features/adb/ADBQuickActions.tsx
const actions = [
  { id: 'edl', label: 'Reboot EDL', icon: Zap, action: 'rebootToEDL' },
  { id: 'fastboot', label: 'Reboot Fastboot', icon: Wrench, action: 'rebootToBootloader' },
  { id: 'recovery', label: 'Reboot Recovery', icon: RefreshCw, action: 'rebootToRecovery' },
  { id: 'system', label: 'Reboot System', icon: RefreshCw, action: 'reboot' },
  { id: 'shutdown', label: 'Power Off', icon: Power, action: 'shutdown', danger: true },
  ];
```

---

## Tasks

- [x] Task 1: Create `ADBQuickActions.tsx` component
- [x] Task 2: Add all 5 action buttons
- [x] Task 3: Style Power Off differently
- [x] Task 4: Add disabled state when disconnected
- [x] Task 5: Add loading state during operation
- [x] Task 6: Implement confirmation dialog for Power Off
- [x] Task 7: Add mode switch hint text
- [x] Task 8: Add toast notifications
- [x] Task 9: Add i18n translations

---

## Definition of Done

- [x] All 5 buttons displayed
- [x] Buttons disabled when disconnected
- [x] Commands execute correctly
- [x] Power Off shows confirmation
- [x] Toast notifications work
- [x] i18n translations added
- [ ] Story marked as `done` in sprint-status.yaml

---

## File List

### Created Files
- `src/components/features/adb/ADBQuickActions.tsx` - Quick Actions Component

### Modified Files
- `src/components/features/adb/index.ts` - Added export
- `src/components/layout/Sidebar.tsx` - Integrated component logic
- `src/i18n/translations/en.json` - Added translations
- `src/i18n/translations/vi.json` - Added translations

---

## Dev Agent Record

### Debug Log
- N/A - Implementation was straightforward using existing hooks.

### Completion Notes
- Integrated into Sidebar for easy access.
- Implemented full i18n support.
- Using Shadcn UI components for buttons and confirmation dialog.
- Responsive design with loading states.

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Initial implementation of ADB Quick Actions | Dev Agent |

---

## References

- [UX Design - Quick Actions](../ux-design-adb-fastboot.md#quick-action-buttons)
