# Story 8.4: Bootloader Unlock/Lock Buttons

## Story Info
- **Epic:** Epic 8 - Fastboot Mode Features
- **Priority:** P0 (Must have)
- **Estimated Effort:** 4 hours
- **Status:** review
- **Dependencies:** Story 8.1 (Fastboot Store & Hook)

---

## User Story

As a **user**,  
I want **buttons to unlock and lock the bootloader**,  
So that **I can prepare my device for custom ROMs**.

---

## Acceptance Criteria

### AC1: Unlock Button
- [x] 🔓 "Unlock Bootloader" button visible
- [x] Styled as warning (orange/amber)
- [x] **Confirmation dialog required** before execution

### AC2: Lock Button
- [x] 🔒 "Lock Bootloader" button visible
- [x] Styled as danger (red)
- [x] **Confirmation dialog required** before execution

### AC3: Unlock Confirmation Dialog
- [x] Title: "⚠️ Unlock Bootloader"
- [x] Warning: "This will ERASE ALL DATA on your device!"
- [x] Bullet points:
  - All apps and data will be deleted
  - Device will factory reset
  - You must confirm on the device screen
- [x] Cancel and "Unlock Bootloader" buttons

### AC4: Lock Confirmation Dialog
- [x] Similar warning about data erasure
- [x] Warning about custom ROM prevention

### AC5: Button States
- [x] Disabled when no device connected
- [x] Unlock disabled if already unlocked
- [x] Lock disabled if already locked
- [x] Loading state during operation

### AC6: After Operation
- [x] Terminal logs operation
- [x] Shows message: "Please confirm on device screen"
- [x] Auto-refreshes device variables
- [x] Toast notification on completion

---

## Technical Notes

### Component Structure

```tsx
// src/components/features/fastboot/BootloaderActions.tsx
export function BootloaderActions() {
  const { deviceInfo } = useFastbootStore();
  const { unlockBootloader, lockBootloader } = useFastboot();
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  
  const isUnlocked = deviceInfo?.unlocked;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bootloader</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <BootloaderStatus unlocked={isUnlocked} />
        
        <Button
          onClick={() => setShowUnlockDialog(true)}
          disabled={isUnlocked}
          className="w-full bg-amber-500 hover:bg-amber-600"
        >
          <Unlock className="mr-2" /> Unlock Bootloader
        </Button>
        
        <Button
          onClick={() => setShowLockDialog(true)}
          disabled={!isUnlocked}
          variant="destructive"
          className="w-full"
        >
          <Lock className="mr-2" /> Lock Bootloader
        </Button>
        
        <UnlockConfirmDialog 
          open={showUnlockDialog} 
          onConfirm={handleUnlock} 
        />
        <LockConfirmDialog 
          open={showLockDialog} 
          onConfirm={handleLock} 
        />
      </CardContent>
    </Card>
  );
}
```

### Unlock Dialog Content

```tsx
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>⚠️ Unlock Bootloader</AlertDialogTitle>
      <AlertDialogDescription>
        <div className="space-y-4">
          <p className="text-destructive font-semibold">
            WARNING: This will ERASE ALL DATA on your device!
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>All apps and data will be deleted</li>
            <li>Device will factory reset</li>
            <li>You must confirm on the device screen</li>
            <li>Device security features may be affected</li>
          </ul>
        </div>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-amber-500">
        Unlock Bootloader
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Tasks

- [x] Task 1: Create `BootloaderActions.tsx` component
- [x] Task 2: Add Unlock button with warning styling
- [x] Task 3: Add Lock button with danger styling
- [x] Task 4: Create Unlock confirmation dialog
- [x] Task 5: Create Lock confirmation dialog
- [x] Task 6: Implement unlock flow with useFastboot
- [x] Task 7: Implement lock flow with useFastboot
- [x] Task 8: Add button disabled states
- [x] Task 9: Add loading states
- [x] Task 10: Add "confirm on device" message
- [x] Task 11: Auto-refresh after operation
- [x] Task 12: Add i18n translations

---

## UI Mockup

**Locked Device:**
```
┌─ Bootloader ──────────────────────────────────────┐
│                                                   │
│  Status: [🔒 Locked]  (red badge)                 │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │  🔓  Unlock Bootloader        (amber bg)  │   │
│  └───────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────┐   │
│  │  🔒  Lock Bootloader        (disabled)    │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ⚠️ These actions will erase all device data     │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Definition of Done

- [x] Both buttons work correctly
- [x] Confirmation dialogs shown before execution
- [x] Button states correct (disabled when appropriate)
- [x] Terminal logs operations
- [x] Device variables refresh after operation
- [x] i18n translations added
- [x] Story marked as `done` in sprint-status.yaml

---

## File List

### New Files
- `src/components/features/fastboot/BootloaderActions.tsx` - Bootloader Unlock/Lock UI with confirmation dialogs

### Modified Files
- `src/components/features/fastboot/index.ts` - Component exports
- `src/pages/FastbootPage.tsx` - Intergrated BootloaderActions
- `src/i18n/translations/en.json` - Added bootloader warning translations
- `src/i18n/translations/vi.json` - Added bootloader warning translations (Vietnamese)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Created BootloaderActions component | AI Dev Agent |
| 2025-12-30 | Implemented Unlock/Lock flows with confirmation | AI Dev Agent |
| 2025-12-30 | Added data wipe warnings i18n | AI Dev Agent |

---

## Dev Agent Record

### Debug Log
- Utilized `AlertDialog` from shadcn/ui for critical warnings
- Implemented state logic to disable Lock/Unlock depending on current status
- Added auto-refresh delay (5s) after commands to allow device time to process
- Handled error cases with toast notifications

### Completion Notes
✅ Story 8.4 implementation complete
- Fully functional Unlock/Lock buttons
- Proper safety warnings provided to user
- States (loading, disabled) handled correctly
- Integrated seamlessly into FastbootPage

---

## References

- [UX Design - Bootloader Actions](../ux-design-adb-fastboot.md#bootloader-unlock-confirmation-dialog)
- [PRD - Unlock/Lock Requirements](../prd-usb-adb-fastboot.md#fr-fb-003-unlock-bootloader)
