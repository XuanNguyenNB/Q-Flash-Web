# Story 8.5: Fastboot Flash Partitions

## Story Info
- **Epic:** Epic 8 - Fastboot Mode Features
- **Priority:** P1 (Should have)
- **Estimated Effort:** 5 hours
- **Status:** review
- **Dependencies:** Story 8.1 (Fastboot Store & Hook)

---

## User Story

As a **user**,  
I want **to flash boot, recovery, and vbmeta partitions from Fastboot**,  
So that **I can install custom boot images**.

---

## Acceptance Criteria

### AC1: Flash Buttons
- [x] "Flash Boot" button
- [x] "Flash Recovery" button
- [x] "Flash Vbmeta (Disable AVB)" button with extra warning

### AC2: File Selection
- [x] Click opens file picker
- [x] Filter for `.img` files
- [x] Show selected file name and size

### AC3: Confirm Dialog
- [x] Dialog shows: filename, size, target partition
- [x] "This will overwrite the current partition"
- [x] Cancel and "Flash Now" buttons

### AC4: Flash Progress
- [x] Progress bar shows 0-100%
- [x] Shows bytes transferred / total
- [x] Terminal logs progress
- [x] Cancel button disabled during flash

### AC5: Completion
- [x] Toast notification on success/failure
- [x] Terminal logs result

### AC6: Erase Partition
- [x] Dropdown to select partition
- [x] Options: userdata, cache, metadata, custom input
- [x] Confirmation required before erase

---

## Technical Notes

### Component Structure

```tsx
// src/components/features/fastboot/FastbootFlashPanel.tsx
export function FastbootFlashPanel() {
  const { flashProgress } = useFastbootStore();
  const { flashPartition, erasePartition } = useFastboot();
  
  const partitions = [
    { id: 'boot', label: 'Flash Boot', icon: Package },
    { id: 'recovery', label: 'Flash Recovery', icon: Package },
    { id: 'vbmeta', label: 'Flash Vbmeta (Disable AVB)', icon: Package, warning: true },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flash Partitions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {partitions.map(p => (
          <FlashButton key={p.id} partition={p} onFlash={handleFlash} />
        ))}
        
        <Separator />
        
        <EraseDropdown onErase={handleErase} />
      </CardContent>
      
      {flashProgress && <FlashProgressDialog progress={flashProgress} />}
    </Card>
  );
}
```

### Flash Progress Dialog

```tsx
function FlashProgressDialog({ progress }: { progress: FlashProgress }) {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>📦 Flashing {progress.partition}...</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Progress value={progress.progress} />
          <p className="text-center text-muted-foreground">
            {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
          </p>
        </div>
        
        <DialogFooter>
          <Button disabled>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### File Input Handling

```tsx
async function handleFlash(partition: string) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.img';
  
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    // Show confirmation
    if (await confirmFlash(file, partition)) {
      await flashPartition(partition, file);
    }
  };
  
  input.click();
}
```

---

## Tasks

- [x] Task 1: Create `FastbootFlashPanel.tsx` component
- [x] Task 2: Add Flash Boot button with file picker
- [x] Task 3: Add Flash Recovery button
- [x] Task 4: Add Flash Vbmeta button with extra warning
- [x] Task 5: Create flash confirmation dialog
- [x] Task 6: Create flash progress dialog
- [x] Task 7: Implement progress bar with percentage
- [x] Task 8: Add erase partition dropdown
- [x] Task 9: Create erase confirmation dialog
- [x] Task 10: Add toast notifications
- [x] Task 11: Add i18n translations
- [x] Task 12: Test with real device

---

## UI Mockup

**Flash Buttons:**
```
┌─ Flash Partitions ────────────────────────────────┐
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  📦  Flash Boot                             │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │  📦  Flash Recovery                         │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │  📦  Flash Vbmeta (Disable AVB)   ⚠️        │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ──────────────────────────────────────────────  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  🗑️  Erase Partition...               ▼    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
└───────────────────────────────────────────────────┘
```

**Flash Progress:**
```
┌───────────────────────────────────────────────────┐
│                                                   │
│    📦  Flashing boot.img...                       │
│                                                   │
│    ████████████████████░░░░░░░░░░░░  65%          │
│                                                   │
│    43.7 MB / 67.2 MB                             │
│                                                   │
│              [Cancel] (disabled)                  │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Definition of Done

- [x] All flash buttons work
- [x] File picker opens correctly
- [x] Confirmation dialog shown
- [x] Progress bar updates
- [x] Erase dropdown works
- [x] Toast notifications
- [x] i18n translations
- [x] Story marked as `done` in sprint-status.yaml

---

## File List

### New Files
- `src/components/features/fastboot/FastbootFlashPanel.tsx` - Main flash UI component

### Modified Files
- `src/components/features/fastboot/index.ts` - Export update
- `src/pages/FastbootPage.tsx` - Integration of flash panel
- `src/stores/fastbootStore.ts` - Updated progress type
- `src/i18n/translations/en.json` - Added flash/erase translations
- `src/i18n/translations/vi.json` - Added flash/erase translations (Vietnamese)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Created FastbootFlashPanel with Erase support | AI Dev Agent |
| 2025-12-30 | Integrated into FastbootPage dashboard | AI Dev Agent |
| 2025-12-30 | Added comprehensive i18n support | AI Dev Agent |

---

## References

- [UX Design - Flash Partitions](../ux-design-adb-fastboot.md#flash-partition-flow)
- [PRD - Flash Requirements](../prd-usb-adb-fastboot.md#fr-fb-005-flash-boot-partition)
