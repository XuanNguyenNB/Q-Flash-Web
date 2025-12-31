# Story 4.4: Flash Flow with Confirmation

**Status:** review  
**Epic:** Epic 4 - Partition Operations UI  
**Created:** 2025-12-29  
**Story Key:** 4-4-flash-flow-with-confirmation

---

## Story

As a **user**,  
I want **to flash selected partitions with proper confirmation**,  
So that **I don't accidentally flash wrong partitions**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | When ROM files are loaded and partitions selected, a "Flash" button is enabled | Load ROM → select partitions → verify "Flash" button is clickable |
| AC2 | Clicking "Flash" opens a confirmation dialog showing selected partitions | Click "Flash" → verify dialog shows partition list with warnings |
| AC3 | Critical partitions (abl, boot, system, vendor) are highlighted with warning icons | View dialog → verify critical partitions have ⚠️ icon |
| AC4 | User can confirm to proceed with flash operation | Click "Confirm" → verify flash starts |
| AC5 | Flash progress shows: current partition, bytes/total, percentage, ETA | Monitor flash → verify all progress metrics update |
| AC6 | Each partition status updates: pending → in-progress → done | Monitor flash → verify status changes for each partition |
| AC7 | Errors during flash are logged to terminal and shown to user | Simulate error → verify terminal log and error toast |
| AC8 | Success toast shows with flash summary after completion | Complete flash → verify success message with summary |
| AC9 | Flash can be cancelled mid-operation | Start flash → click cancel → verify graceful stop |
| AC10 | Progress persists across component re-renders | Start flash → navigate away → return → verify progress continues |

---

## Tasks / Subtasks

- [ ] **Task 1: Create FlashConfirmDialog component** (AC: 2, 3)
  - [ ] 1.1 Create `src/components/features/flash/FlashConfirmDialog.tsx`
  - [ ] 1.2 Use shadcn/ui AlertDialog component for dangerous action pattern
  - [ ] 1.3 Display list of selected partitions with names and sizes
  - [ ] 1.4 Highlight critical partitions with ⚠️ warning icon and red text
  - [ ] 1.5 Show total flash size calculation
  - [ ] 1.6 Add warning message about data loss risk
  - [ ] 1.7 Add "Cancel" and "Confirm Flash" buttons
  - [ ] 1.8 Integrate with partitionStore to get selected partitions
  - [ ] 1.9 Style with Linear Violet theme (destructive variant for confirm button)

- [ ] **Task 2: Create FlashProgress component** (AC: 5, 6, 10)
  - [ ] 2.1 Create `src/components/features/flash/FlashProgress.tsx`
  - [ ] 2.2 Use shadcn/ui Progress component for overall progress bar
  - [ ] 2.3 Display current partition being flashed
  - [ ] 2.4 Show bytes written / total bytes with formatBytes utility
  - [ ] 2.5 Display percentage (0-100%)
  - [ ] 2.6 Calculate and show ETA (estimated time remaining)
  - [ ] 2.7 Show partition-by-partition status list with icons:
    - Pending: Clock icon (gray)
    - In-progress: Loader icon (animated, violet)
    - Done: CheckCircle icon (green)
    - Error: XCircle icon (red)
  - [ ] 2.8 Add "Cancel Flash" button
  - [ ] 2.9 Read progress from flashStore

- [ ] **Task 3: Enhance flashStore for flash operations** (AC: 5, 6, 9, 10)
  - [ ] 3.1 Add flash-specific state to `src/stores/flashStore.ts`:
    - `flashStatus: 'idle' | 'preparing' | 'flashing' | 'success' | 'error' | 'cancelled'`
    - `currentFlashPartition: string | null`
    - `flashProgress: number` (0-100)
    - `flashBytesWritten: number`
    - `flashTotalBytes: number`
    - `flashPartitionStatuses: Map<string, 'pending' | 'in-progress' | 'done' | 'error'>`
    - `flashError: AppError | null`
    - `flashStartTime: number | null`
    - `flashETA: number | null` (seconds remaining)
  - [ ] 3.2 Add actions:
    - `startFlash(partitions: string[])`
    - `updateFlashProgress(partition: string, bytesWritten: number, totalBytes: number)`
    - `setFlashPartitionStatus(partition: string, status: PartitionStatus)`
    - `completeFlash()`
    - `cancelFlash()`
    - `resetFlash()`
  - [ ] 3.3 Ensure state updates trigger re-renders

- [ ] **Task 4: Create useFlash hook** (AC: 4, 5, 6, 7, 8, 9)
  - [ ] 4.1 Create `src/hooks/useFlash.ts`
  - [ ] 4.2 Wrap FirehoseProtocol write operations (DO NOT modify core logic)
  - [ ] 4.3 Implement `startFlash(partitions: PartitionInfo[], romFiles: Map<string, File>)` method:
    - Calculate total bytes from partition sizes
    - Set flashStore.flashStatus = 'preparing'
    - Initialize partition statuses to 'pending'
    - Record start time for ETA calculation
    - Loop through each partition:
      - Set status to 'in-progress'
      - Get ROM file for partition from romFiles map
      - Call FirehoseProtocol.writePartition()
      - Write partition data to device
      - Update progress after each chunk
      - Calculate ETA based on elapsed time and remaining bytes
      - Set status to 'done' on success, 'error' on failure
    - Set flashStore.flashStatus = 'success'
  - [ ] 4.4 Implement `cancelFlash()` method:
    - Set cancellation flag
    - Stop current write operation gracefully
    - Set flashStore.flashStatus = 'cancelled'
  - [ ] 4.5 Log all operations to terminalStore:
    - "Starting flash of X partitions..."
    - "Flashing partition: {name} ({size})"
    - "Progress: {percentage}% ({bytes}/{total}) - ETA: {eta}"
    - "Flash completed: {name}"
    - "Flash cancelled by user"
    - "Flash failed: {error}"
  - [ ] 4.6 Handle errors gracefully:
    - Catch write errors
    - Update partition status to 'error'
    - Log to terminal
    - Continue with next partition or stop based on error severity
  - [ ] 4.7 Use useRef for cancellation flag and protocol instance

- [ ] **Task 5: Integrate flash flow into PartitionGrid** (AC: 1, 2)
  - [ ] 5.1 Add "Flash Selected" button to PartitionGrid header
  - [ ] 5.2 Button is disabled when no partitions selected OR no ROM loaded
  - [ ] 5.3 Button shows count: "Flash ({count})"
  - [ ] 5.4 Clicking button opens FlashConfirmDialog
  - [ ] 5.5 Pass selected partitions from partitionStore to dialog
  - [ ] 5.6 Pass ROM files map to flash hook

- [ ] **Task 6: Add barrel exports** (AC: all)
  - [ ] 6.1 Create `src/components/features/flash/index.ts`
  - [ ] 6.2 Export FlashConfirmDialog and FlashProgress
  - [ ] 6.3 Update `src/hooks/index.ts` to export useFlash

- [ ] **Task 7: Add i18n translations** (AC: all)
  - [ ] 7.1 Add English translations to `src/i18n/translations/en.json`:
    - `flash.button`: "Flash Selected"
    - `flash.confirm.title`: "⚠️ Confirm Flash Operation"
    - `flash.confirm.message`: "You are about to flash {{count}} partition(s). This will overwrite existing data on your device."
    - `flash.confirm.warning`: "This action cannot be undone. Make sure you have selected the correct partitions."
    - `flash.confirm.criticalPartition`: "Critical partition - flash with caution"
    - `flash.confirm.totalSize`: "Total size: {{size}}"
    - `flash.confirm.proceed`: "Confirm Flash"
    - `flash.progress.title`: "Flash in Progress"
    - `flash.progress.current`: "Flashing: {{partition}}"
    - `flash.progress.bytes`: "{{written}} / {{total}}"
    - `flash.progress.percentage`: "{{percent}}%"
    - `flash.progress.eta`: "ETA: {{time}}"
    - `flash.progress.cancel`: "Cancel Flash"
    - `flash.status.pending`: "Pending"
    - `flash.status.inProgress`: "In Progress"
    - `flash.status.done`: "Done"
    - `flash.status.error`: "Error"
    - `flash.success.title`: "Flash Completed"
    - `flash.success.message`: "{{count}} partition(s) flashed successfully"
    - `flash.error.title`: "Flash Failed"
    - `flash.error.message`: "Failed to flash partitions: {{error}}"
    - `flash.error.noRom`: "No ROM files loaded. Please load ROM first."
    - `flash.cancelled.title`: "Flash Cancelled"
    - `flash.cancelled.message`: "Flash operation was cancelled"
  - [ ] 7.2 Add Vietnamese translations to `src/i18n/translations/vi.json`:
    - `flash.button`: "Flash đã chọn"
    - `flash.confirm.title`: "⚠️ Xác nhận Flash"
    - `flash.confirm.message`: "Bạn sắp flash {{count}} phân vùng. Thao tác này sẽ ghi đè dữ liệu hiện có trên thiết bị."
    - `flash.confirm.warning`: "Thao tác này không thể hoàn tác. Hãy chắc chắn bạn đã chọn đúng phân vùng."
    - `flash.confirm.criticalPartition`: "Phân vùng quan trọng - flash cẩn thận"
    - `flash.confirm.totalSize`: "Tổng dung lượng: {{size}}"
    - `flash.confirm.proceed`: "Xác nhận Flash"
    - `flash.progress.title`: "Đang Flash"
    - `flash.progress.current`: "Đang flash: {{partition}}"
    - `flash.progress.bytes`: "{{written}} / {{total}}"
    - `flash.progress.percentage`: "{{percent}}%"
    - `flash.progress.eta`: "Thời gian còn lại: {{time}}"
    - `flash.progress.cancel`: "Hủy Flash"
    - `flash.status.pending`: "Chờ xử lý"
    - `flash.status.inProgress`: "Đang xử lý"
    - `flash.status.done`: "Hoàn thành"
    - `flash.status.error`: "Lỗi"
    - `flash.success.title`: "Flash thành công"
    - `flash.success.message`: "Đã flash {{count}} phân vùng thành công"
    - `flash.error.title`: "Flash thất bại"
    - `flash.error.message`: "Không thể flash phân vùng: {{error}}"
    - `flash.error.noRom`: "Chưa tải ROM. Vui lòng tải ROM trước."
    - `flash.cancelled.title`: "Đã hủy Flash"
    - `flash.cancelled.message`: "Thao tác flash đã bị hủy"

- [ ] **Task 8: Testing and verification** (AC: 1-10)
  - [ ] 8.1 Run `npm run dev` and verify no TypeScript errors
  - [ ] 8.2 Test flash flow with device connected and ROM loaded:
    - Load ROM files
    - Select 2-3 partitions
    - Click "Flash Selected"
    - Verify confirmation dialog shows correct partitions
    - Verify critical partitions are highlighted
  - [ ] 8.3 Test confirmation dialog:
    - Verify warning message is clear
    - Verify total size is correct
    - Test "Cancel" button
    - Test "Confirm Flash" button
  - [ ] 8.4 Test flash progress:
    - Start flash
    - Verify progress bar updates
    - Verify current partition name updates
    - Verify bytes/total updates
    - Verify ETA calculation and display
    - Verify partition status icons change (pending → in-progress → done)
  - [ ] 8.5 Test flash completion:
    - Wait for flash to complete
    - Verify success toast appears
    - Verify terminal logs all operations
  - [ ] 8.6 Test flash cancellation:
    - Start flash
    - Click "Cancel Flash" mid-operation
    - Verify flash stops gracefully
    - Verify cancelled toast appears
  - [ ] 8.7 Test error handling:
    - Simulate write error (disconnect device mid-flash)
    - Verify error toast and terminal log
    - Verify partition status shows error
  - [ ] 8.8 Test with large partitions (e.g., super.img 2GB+):
    - Verify progress updates smoothly
    - Verify ETA is accurate
    - Verify no memory issues
  - [ ] 8.9 Test i18n:
    - Switch to Vietnamese
    - Verify all flash UI text is translated
  - [ ] 8.10 Test state persistence:
    - Start flash
    - Navigate to another page
    - Return to Tool page
    - Verify flash progress continues

---

## Dev Notes

### Architecture Context

Story 4.4 implements the **flash flow** for the Q-Flash-Web tool, allowing users to write ROM partition data to their device. This story is the counterpart to Story 4.3 (Backup Flow) and follows a similar pattern with confirmation, progress tracking, and error handling.

**Pattern:** This story implements a **dangerous operation flow** with:
1. Confirmation dialog with critical partition warnings (ADR-005: Simple Yes/No confirm)
2. Progress tracking with per-partition status and ETA
3. Error handling and cancellation support
4. Safety measures to prevent accidental flashing

### Component Structure

```typescript
// src/components/features/flash/FlashConfirmDialog.tsx
interface FlashConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partitions: PartitionInfo[];
  onConfirm: () => void;
}

// Critical partitions that need warning
const CRITICAL_PARTITIONS = ['abl', 'boot', 'system', 'vendor', 'vbmeta', 'dtbo'];

export function FlashConfirmDialog({ open, onOpenChange, partitions, onConfirm }: FlashConfirmDialogProps) {
  const { t } = useTranslation();
  const totalSize = partitions.reduce((sum, p) => sum + p.size, 0);
  
  const isCritical = (partitionName: string) => 
    CRITICAL_PARTITIONS.some(cp => partitionName.toLowerCase().includes(cp));
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('flash.confirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('flash.confirm.message', { count: partitions.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {partitions.map(partition => (
            <div 
              key={partition.name} 
              className={cn(
                "flex items-center justify-between text-sm",
                isCritical(partition.name) && "text-red-500"
              )}
            >
              <span className="flex items-center gap-2">
                {isCritical(partition.name) && <AlertTriangle className="h-4 w-4" />}
                {partition.name}
              </span>
              <span className="text-muted-foreground">{formatBytes(partition.size)}</span>
            </div>
          ))}
        </div>
        
        <div className="text-sm font-semibold">
          {t('flash.confirm.totalSize', { size: formatBytes(totalSize) })}
        </div>
        
        <div className="text-sm text-yellow-600 dark:text-yellow-500">
          ⚠️ {t('flash.confirm.warning')}
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            {t('flash.confirm.proceed')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Flash Hook Implementation

```typescript
// src/hooks/useFlash.ts
import { useCallback, useRef } from 'react';
import { useFlashStore } from '@/stores/flashStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useFirehose } from './useFirehose';
import type { PartitionInfo } from '@/types';

export function useFlash() {
  const { getProtocol } = useFirehose();
  const { log } = useTerminalStore();
  const { 
    startFlash: startFlashStore,
    updateFlashProgress,
    setFlashPartitionStatus,
    completeFlash,
    cancelFlash: cancelFlashStore,
  } = useFlashStore();
  
  const cancelledRef = useRef(false);
  
  const startFlash = useCallback(async (
    partitions: PartitionInfo[],
    romFiles: Map<string, File>
  ) => {
    cancelledRef.current = false;
    const protocol = getProtocol();
    
    const totalBytes = partitions.reduce((sum, p) => sum + p.size, 0);
    const startTime = Date.now();
    
    startFlashStore(partitions.map(p => p.name));
    log('info', `Starting flash of ${partitions.length} partition(s)...`);
    
    try {
      for (const partition of partitions) {
        if (cancelledRef.current) {
          log('warning', 'Flash cancelled by user');
          cancelFlashStore();
          return;
        }
        
        setFlashPartitionStatus(partition.name, 'in-progress');
        log('info', `Flashing partition: ${partition.name} (${formatBytes(partition.size)})`);
        
        try {
          // Get ROM file for this partition
          const romFile = romFiles.get(partition.name);
          if (!romFile) {
            throw new Error(`ROM file not found for partition: ${partition.name}`);
          }
          
          // Read file data
          const fileData = await romFile.arrayBuffer();
          const data = new Uint8Array(fileData);
          
          // Write partition data to device
          let bytesWritten = 0;
          const chunkSize = 1024 * 1024; // 1MB chunks
          
          // Call core Firehose protocol (DO NOT MODIFY)
          await protocol.writePartition(partition.name, data, (progress: number) => {
            if (cancelledRef.current) {
              throw new Error('Cancelled');
            }
            
            bytesWritten = Math.floor((progress / 100) * partition.size);
            updateFlashProgress(partition.name, bytesWritten, partition.size);
            
            // Calculate ETA
            const elapsed = (Date.now() - startTime) / 1000; // seconds
            const bytesPerSecond = bytesWritten / elapsed;
            const remainingBytes = totalBytes - bytesWritten;
            const eta = Math.ceil(remainingBytes / bytesPerSecond);
            
            // Log progress every 10%
            if (progress % 10 === 0) {
              log('info', `Progress: ${progress}% (${formatBytes(bytesWritten)}/${formatBytes(partition.size)}) - ETA: ${formatTime(eta)}`);
            }
          });
          
          setFlashPartitionStatus(partition.name, 'done');
          log('success', `Flash completed: ${partition.name}`);
          
        } catch (error) {
          if (error.message === 'Cancelled') {
            throw error;
          }
          
          setFlashPartitionStatus(partition.name, 'error');
          log('error', `Failed to flash ${partition.name}: ${error.message}`);
          // Continue with next partition
        }
      }
      
      completeFlash();
      log('success', `Flash completed successfully`);
      toast.success(t('flash.success.message', { count: partitions.length }));
      
    } catch (error) {
      if (error.message === 'Cancelled') {
        return;
      }
      
      log('error', `Flash failed: ${error.message}`);
      toast.error(t('flash.error.message', { error: error.message }));
    }
  }, [getProtocol, log, startFlashStore, updateFlashProgress, setFlashPartitionStatus, completeFlash, cancelFlashStore]);
  
  const cancelFlash = useCallback(() => {
    cancelledRef.current = true;
    log('warning', 'Cancelling flash...');
  }, [log]);
  
  return {
    startFlash,
    cancelFlash,
  };
}
```

### Enhanced flashStore

```typescript
// src/stores/flashStore.ts (additions for flash)
interface FlashStore {
  // ... existing backup state
  
  // Flash state
  flashStatus: 'idle' | 'preparing' | 'flashing' | 'success' | 'error' | 'cancelled';
  currentFlashPartition: string | null;
  flashProgress: number;
  flashBytesWritten: number;
  flashTotalBytes: number;
  flashPartitionStatuses: Map<string, 'pending' | 'in-progress' | 'done' | 'error'>;
  flashError: AppError | null;
  flashStartTime: number | null;
  flashETA: number | null;
  
  // Flash actions
  startFlash: (partitions: string[]) => void;
  updateFlashProgress: (partition: string, bytesWritten: number, totalBytes: number) => void;
  setFlashPartitionStatus: (partition: string, status: PartitionStatus) => void;
  completeFlash: () => void;
  cancelFlash: () => void;
  resetFlash: () => void;
}

export const useFlashStore = create<FlashStore>((set, get) => ({
  // ... existing state
  
  // Flash initial state
  flashStatus: 'idle',
  currentFlashPartition: null,
  flashProgress: 0,
  flashBytesWritten: 0,
  flashTotalBytes: 0,
  flashPartitionStatuses: new Map(),
  flashError: null,
  flashStartTime: null,
  flashETA: null,
  
  // Flash actions
  startFlash: (partitions) => {
    const statuses = new Map<string, PartitionStatus>();
    partitions.forEach(p => statuses.set(p, 'pending'));
    
    set({
      flashStatus: 'flashing',
      flashPartitionStatuses: statuses,
      flashProgress: 0,
      flashBytesWritten: 0,
      flashError: null,
      flashStartTime: Date.now(),
    });
  },
  
  updateFlashProgress: (partition, bytesWritten, totalBytes) => {
    const { flashTotalBytes, flashStartTime } = get();
    const overallProgress = Math.floor((bytesWritten / flashTotalBytes) * 100);
    
    // Calculate ETA
    const elapsed = (Date.now() - flashStartTime!) / 1000;
    const bytesPerSecond = bytesWritten / elapsed;
    const remainingBytes = flashTotalBytes - bytesWritten;
    const eta = Math.ceil(remainingBytes / bytesPerSecond);
    
    set({
      currentFlashPartition: partition,
      flashBytesWritten: bytesWritten,
      flashProgress: overallProgress,
      flashETA: eta,
    });
  },
  
  setFlashPartitionStatus: (partition, status) => {
    const { flashPartitionStatuses } = get();
    const newStatuses = new Map(flashPartitionStatuses);
    newStatuses.set(partition, status);
    
    set({ flashPartitionStatuses: newStatuses });
  },
  
  completeFlash: () => set({ flashStatus: 'success' }),
  
  cancelFlash: () => set({ flashStatus: 'cancelled' }),
  
  resetFlash: () => set({
    flashStatus: 'idle',
    currentFlashPartition: null,
    flashProgress: 0,
    flashBytesWritten: 0,
    flashTotalBytes: 0,
    flashPartitionStatuses: new Map(),
    flashError: null,
    flashStartTime: null,
    flashETA: null,
  }),
}));
```

### Critical Partition Detection

**Critical partitions** are those that can brick the device if flashed incorrectly:
- `abl` - Android Bootloader
- `boot` - Boot image
- `system` - System partition
- `vendor` - Vendor partition
- `vbmeta` - Verified Boot Metadata
- `dtbo` - Device Tree Blob Overlay

These partitions are highlighted with ⚠️ icon and red text in the confirmation dialog.

### ETA Calculation

ETA (Estimated Time Remaining) is calculated using:
```typescript
const elapsed = (Date.now() - startTime) / 1000; // seconds
const bytesPerSecond = bytesWritten / elapsed;
const remainingBytes = totalBytes - bytesWritten;
const eta = Math.ceil(remainingBytes / bytesPerSecond);
```

Format: "ETA: 2m 30s" or "ETA: 45s"

### Performance Considerations

**Large File Handling:**
- Stream data in 1MB chunks to avoid memory issues
- Update progress every 1% or 1MB (whichever is larger)
- Use efficient write operations from FirehoseProtocol
- Close streams properly to prevent memory leaks

**Progress Updates:**
- Debounce progress updates to prevent excessive re-renders
- Use percentage-based updates for consistency
- Log to terminal every 10% for detailed tracking
- Update ETA every progress update

**Cancellation:**
- Use ref-based flag for immediate cancellation
- Gracefully stop current write operation
- Clean up resources on cancel

### Project Structure Notes

New files added:
- `src/components/features/flash/FlashConfirmDialog.tsx` - Confirmation dialog with warnings
- `src/components/features/flash/FlashProgress.tsx` - Progress display with ETA
- `src/components/features/flash/index.ts` - Barrel export
- `src/hooks/useFlash.ts` - Flash operation hook

Modified files:
- `src/stores/flashStore.ts` - Add flash state and actions
- `src/components/features/partition/PartitionGrid.tsx` - Add "Flash Selected" button
- `src/i18n/translations/en.json` - Add flash translations
- `src/i18n/translations/vi.json` - Add flash translations

### References

- [Source: docs/epics.md#Story-4.4] - Story definition and acceptance criteria
- [Source: docs/architecture.md#Hook-Wrapper-Pattern] - Hook implementation pattern
- [Source: docs/architecture.md#Flash-Operation-State-Machine] - State management pattern
- [Source: docs/architecture.md#ADR-005] - Simple confirm dialog pattern
- [Source: docs/architecture.md#Dangerous-Action-Pattern] - AlertDialog usage
- [Source: docs/PRD.md#F6-Partition-Operations] - Flash requirements

---

## Learnings from Previous Story

**From Story 4-3-backup-flow-with-progress (Status: ready-for-dev)**

- **flashStore Structure**: Story 4.3 added backup state to flashStore - this story adds flash state to the same store (separate state for parallel operations)
- **Component Pattern**: BackupConfirmDialog and BackupProgress components provide excellent templates for FlashConfirmDialog and FlashProgress
- **Hook Pattern**: useBackup hook demonstrates the wrapper pattern - useFlash follows the same structure
- **File System Access API**: Story 4.3 uses showDirectoryPicker for backup - flash doesn't need this as ROM files are already loaded
- **Progress Tracking**: Story 4.3 implements comprehensive progress tracking - flash reuses the same pattern with ETA addition

**Key patterns to reuse:**
- **Store Pattern**: Follow same Zustand pattern for flash state in flashStore (parallel to backup state)
- **Component Pattern**: FlashConfirmDialog and FlashProgress follow same structure as backup components
- **Hook Pattern**: useFlash wraps core Firehose protocol without modifying it (ADR-002)
- **Error Handling**: Log to terminal + show toast for user feedback
- **Cancellation**: Use ref-based flag for graceful cancellation

**Differences from backup:**
- **Confirmation**: Flash uses AlertDialog (dangerous action) vs Dialog (backup)
- **Critical Partitions**: Flash highlights dangerous partitions with warnings
- **ETA Calculation**: Flash adds ETA display (backup doesn't need this)
- **No File Picker**: Flash uses pre-loaded ROM files, no directory selection needed

**Integration notes:**
- This story EXTENDS PartitionGrid component with flash functionality (parallel to backup button)
- "Flash Selected" button will be added to PartitionGrid's header section
- Flash flow uses selected partitions from partitionStore.selectedPartitions
- Flash requires ROM files to be loaded first (Story 4.6)
- Progress tracking uses flashStore (separate from backup operations)

**Technical Considerations:**
- Flash is more dangerous than backup - requires clear warnings
- Critical partitions must be highlighted to prevent bricking
- ETA is important for large partitions (2GB+ super.img)
- Cancellation must be graceful - stop write operation properly
- Error handling is critical - device can be bricked if flash fails mid-operation

[Source: stories/4-3-backup-flow-with-progress.md#Dev-Notes]

---

## Prerequisites

- **Story 4.1** (PartitionGrid Component) - Provides partition selection UI
- **Story 4.6** (ROM File Loading) - Provides ROM files for flashing
- **Story 1.5** (Core Logic Wrapper Hooks) - Provides useFirehose hook
- **Story 1.3** (Zustand State Management) - Provides flashStore base
- **Story 1.2** (shadcn/ui Setup) - Provides AlertDialog and Progress components
- **Story 1.4** (i18n Setup) - Provides translation support

**Note:** This story can be implemented in parallel with Story 4.3 (Backup Flow) as they use separate state in flashStore. However, Story 4.6 (ROM File Loading) should be completed first to provide ROM files for testing.

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
