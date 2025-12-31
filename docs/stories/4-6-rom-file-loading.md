# Story 4.6: ROM File Loading

**Status:** review  
**Epic:** Epic 4 - Partition Operations UI  
**Created:** 2025-12-30  
**Story Key:** 4-6-rom-file-loading

---

## Story

As a **user**,  
I want **to load ROM files and have them parsed automatically**,  
So that **I can flash partitions from a ROM**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | When device is connected and I click "Load ROM" and select a folder, rawprogram*.xml files are detected | Select ROM folder → verify rawprogram XML files are found and listed |
| AC2 | Partition entries are parsed from rawprogram XML files | Load ROM → verify partition entries with name, file path, start sector, size are extracted |
| AC3 | Partition grid shows ROM partitions with sizes | Load ROM → verify partitions appear in grid with correct file sizes |
| AC4 | Missing files are marked (e.g., super.img not found) | Load ROM with missing file → verify missing indicator appears |
| AC5 | Errors are logged to terminal | Load invalid ROM → verify error appears in terminal log |
| AC6 | ROM loading progress indicator is shown during folder scan | Select large ROM folder → verify progress indicator appears |
| AC7 | Sparse vs raw image types are identified | Load ROM with sparse images → verify correct image type detection |
| AC8 | "Clear ROM" button removes loaded ROM data | Click clear → verify ROM data is cleared and partition grid resets |
| AC9 | ROM files summary shows total size and partition count | Load ROM → verify summary displays total size and count |
| AC10 | Multiple rawprogram*.xml files are merged correctly | Load OFP ROM with multiple rawprogram files → verify all partitions merged |

---

## Tasks / Subtasks

- [x] **Task 1: Create ROM loading hook (useRomLoader)** (AC: 1, 2, 5, 6, 7, 10)
  - [x] 1.1 Create `src/hooks/useRomLoader.ts`
  - [x] 1.2 Define interfaces: `RomFile`, `RomPartitionEntry`, `RomLoadResult`
  - [x] 1.3 Implement `loadRomFromDirectory()` using File System Access API (`showDirectoryPicker()`)
  - [x] 1.4 Scan directory for `rawprogram*.xml` files (rawprogram0.xml, rawprogram1.xml, etc.)
  - [x] 1.5 Parse XML files to extract partition entries using DOMParser
  - [x] 1.6 Extract partition info: label, filename, start_sector, num_partition_sectors, physical_partition_number
  - [x] 1.7 Validate file existence for each partition entry
  - [x] 1.8 Detect sparse images by reading first 28 bytes for magic header (0xed26ff3a)
  - [x] 1.9 Calculate file sizes and total ROM size
  - [x] 1.10 Handle multiple rawprogram XML files and merge entries
  - [x] 1.11 Log all operations to terminalStore
  - [x] 1.12 Track loading progress with percentage

- [x] **Task 2: Create ROM store (romStore)** (AC: 3, 8, 9)
  - [x] 2.1 Create `src/stores/romStore.ts`
  - [x] 2.2 Define state: `isLoading`, `romEntries`, `romDirectory`, `totalSize`, `missingFiles`, `error`
  - [x] 2.3 Add action `setRomData(result: RomLoadResult)` 
  - [x] 2.4 Add action `clearRom()` to reset all ROM data
  - [x] 2.5 Add computed selector `getValidEntries()` for entries with existing files
  - [x] 2.6 Add computed selector `getMissingEntries()` for entries with missing files
  - [x] 2.7 Add computed selector `getRomSummary()` for total size and count

- [x] **Task 3: Create ROM Loader UI component** (AC: 1, 6, 8, 9)
  - [x] 3.1 Create `src/components/features/rom/RomLoader.tsx`
  - [x] 3.2 Add "Load ROM" button with folder icon
  - [x] 3.3 Show loading spinner during directory scan
  - [x] 3.4 Display ROM summary card after loading (partition count, total size, missing files count)
  - [x] 3.5 Add "Clear ROM" button with trash icon
  - [x] 3.6 Show directory path of loaded ROM
  - [x] 3.7 Responsive layout: inline on desktop, stacked on mobile

- [x] **Task 4: Integrate ROM partitions with PartitionGrid** (AC: 3, 4)
  - [x] 4.1 Modify `partitionStore` to accept ROM partition mapping
  - [x] 4.2 Add `setRomMapping(mapping: Map<string, RomPartitionEntry>)` action
  - [x] 4.3 Update PartitionGrid to show ROM file indicator (📦 icon) when ROM file exists
  - [x] 4.4 Update PartitionGrid to show missing file warning (⚠️) when ROM file missing
  - [x] 4.5 Add ROM Source tooltip to partition display
  - [x] 4.6 Show file size from ROM instead of partition size when ROM loaded

- [x] **Task 5: Create Missing Files Warning component** (AC: 4)
  - [x] 5.1 Create `src/components/features/rom/MissingFilesWarning.tsx`
  - [x] 5.2 Show collapsible list of missing files
  - [x] 5.3 Warning icon with count badge
  - [x] 5.4 Tooltip with missing file names
  - [x] 5.5 Link to re-scan ROM folder option

- [x] **Task 6: XML Parser improvements** (AC: 2, 10)
  - [x] 6.1 Review existing XML parsing in core logic (if any)
  - [x] 6.2 Create robust rawprogram XML parser handling:
    - Standard OFP format: `<program ... />`
    - Legacy format with different attribute names
    - Multiple physical partition numbers
  - [x] 6.3 Handle encoding issues (UTF-8, UTF-16) - using DOMParser which handles encoding
  - [x] 6.4 Parse `rawprogram*.xml` files (patch*.xml deferred to future)
  - [x] 6.5 Merge and deduplicate entries from multiple files

- [x] **Task 7: Sparse image handling** (AC: 7)
  - [x] 7.1 Create helper function `isSparseImage(file: File): Promise<boolean>`
  - [x] 7.2 Read first 28 bytes to check for sparse header magic (0xed26ff3a)
  - [x] 7.3 Add `isSparse: boolean` flag to RomPartitionEntry
  - [x] 7.4 Display sparse indicator in tooltip
  - [x] 7.5 Log sparse image detection to terminal

- [x] **Task 8: Add i18n translations** (AC: all)
  - [x] 8.1 Add English translations to `src/i18n/translations/en.json` - all rom.* keys added
  - [x] 8.2 Add Vietnamese translations to `src/i18n/translations/vi.json` - all rom.* keys added

- [x] **Task 9: Integrate RomLoader into Sidebar** (AC: all)
  - [x] 9.1 Add RomLoader component to Sidebar below device selection
  - [x] 9.2 Conditionally show RomLoader when device is connected
  - [x] 9.3 Update PartitionGrid to sync with romStore
  - [x] 9.4 Added romMapping to partitionStore for PartitionGrid integration

- [x] **Task 10: Testing and verification** (AC: 1-10)
  - [x] 10.1 Run `npm run dev` and verify no TypeScript errors - PASSED
  - [ ] 10.2 Test loading ROM folder with valid rawprogram*.xml (requires manual test with real ROM)
  - [ ] 10.3 Test missing files detection (requires manual test)
  - [ ] 10.4 Test sparse image detection (requires manual test)
  - [ ] 10.5 Test multiple rawprogram files (requires manual test)
  - [ ] 10.6 Test clear ROM (requires manual test)
  - [ ] 10.7 Test error handling (requires manual test)
  - [ ] 10.8 Test i18n (requires manual test)
  - [ ] 10.9 Test integration with PartitionGrid (requires manual test)

---

## Dev Notes

### Architecture Context

Story 4.6 implements ROM file loading functionality that allows users to select a ROM folder and have the tool automatically:
1. Scan for `rawprogram*.xml` files
2. Parse partition entries from XML
3. Validate existence of referenced files
4. Map ROM files to device partitions for flashing

This is a **critical prerequisite** for the flash workflow - without ROM loading, users cannot flash partitions.

### File System Access API

The implementation uses the modern File System Access API for folder selection:

```typescript
// Request directory access
const directoryHandle = await window.showDirectoryPicker({
  mode: 'read',
  startIn: 'downloads'
});

// Scan for files
for await (const [name, handle] of directoryHandle.entries()) {
  if (handle.kind === 'file' && name.match(/^rawprogram\d*\.xml$/)) {
    const file = await handle.getFile();
    // Parse XML...
  }
}
```

### rawprogram XML Format

Standard Qualcomm rawprogram format:

```xml
<?xml version="1.0" ?>
<data>
  <program SECTOR_SIZE_IN_BYTES="4096" 
           file_sector_offset="0" 
           filename="abl.elf" 
           label="abl_a" 
           num_partition_sectors="32768" 
           physical_partition_number="0" 
           size_in_KB="131072.0" 
           sparse="false" 
           start_byte_hex="0x2A000000" 
           start_sector="688128"/>
  <!-- More entries... -->
</data>
```

### Sparse Image Detection

Sparse images have a specific header:

```typescript
const SPARSE_MAGIC = 0xed26ff3a;
const SPARSE_HEADER_SIZE = 28;

async function isSparseImage(file: File): Promise<boolean> {
  const header = await file.slice(0, 4).arrayBuffer();
  const view = new DataView(header);
  return view.getUint32(0, true) === SPARSE_MAGIC;
}
```

### Integration with Flash Flow

ROM loading integrates with the flash workflow:

```
[User loads ROM] → romStore populated
[User selects partitions] → partitionStore selection
[User clicks Flash] → FlashConfirmDialog shows ROM sources
[User confirms] → useFirehose reads from ROM file handles
```

### Error Handling Strategy

| Error Type | User Message | Recovery |
|------------|--------------|----------|
| No XML found | "No rawprogram*.xml files found in this folder" | Select different folder |
| Invalid XML | "Failed to parse XML file" | Check ROM integrity |
| Missing files | Warning with list | Continue with available files |
| Permission denied | "Folder access denied" | Re-select with permission |

### Project Structure Notes

**New files:**
- `src/hooks/useRomLoader.ts` - ROM loading hook
- `src/stores/romStore.ts` - ROM state store
- `src/components/features/rom/RomLoader.tsx` - UI component
- `src/components/features/rom/MissingFilesWarning.tsx` - Warning component
- `src/components/features/rom/index.ts` - Barrel export

**Modified files:**
- `src/stores/partitionStore.ts` - Add ROM mapping support
- `src/components/features/partition/PartitionItem.tsx` - ROM indicators
- `src/components/layout/Sidebar.tsx` - Add RomLoader component
- `src/i18n/translations/en.json` - New translations
- `src/i18n/translations/vi.json` - New translations

### Type Definitions

```typescript
interface RomPartitionEntry {
  label: string;               // Partition name (abl_a, boot, etc.)
  filename: string;            // File name in ROM folder
  fileHandle?: FileSystemFileHandle;  // File handle for reading
  fileSize: number;            // Actual file size in bytes
  startSector: number;         // Start sector from XML
  numSectors: number;          // Number of sectors from XML
  isSparse: boolean;           // Whether image is sparse format
  physicalPartition: number;   // Physical partition number
  exists: boolean;             // Whether file exists in folder
}

interface RomLoadResult {
  directoryName: string;
  directoryHandle: FileSystemDirectoryHandle;
  entries: RomPartitionEntry[];
  totalSize: number;
  missingFiles: string[];
  loadTime: number;
}
```

### Performance Considerations

- **Async iteration**: Use `for await` for non-blocking directory scan
- **Parallel processing**: Process XML files in parallel with `Promise.all`
- **Lazy file reading**: Only read file headers for sparse detection, defer full read
- **Progress tracking**: Update progress at each file to show user feedback

### References

- [Source: docs/epics.md#Story-4.6] - Story definition and acceptance criteria
- [Source: docs/architecture.md#Data-Flow] - Data flow architecture
- [Source: docs/architecture.md#Performance-Considerations] - Handling large files
- [Source: src/core/FirehoseProtocol.ts] - Existing flash implementation (reference only)
- [Source: MDN File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)

---

## Learnings from Previous Story

**From Story 4-5-terminal-log-panel (Status: ready-for-dev)**

- **Terminal Logging Enhanced**: Story 4.5 adds advanced logging features (filter, search, copy) that will benefit ROM loading feedback
- **Log Levels**: Use appropriate levels - info (scanning), success (loaded), warning (missing files), error (failures)
- **Virtual List Ready**: If ROM has 100+ partitions, the enhanced LogPanel can handle large log volumes

**Key patterns to note:**
- terminalStore.log() for all operations
- Progress tracking with percentage updates
- Error messages include technical details for debugging

**Integration notes:**
- ROM loading should log every step: folder selected, XML found, parsing, validation
- Missing files should be logged as warnings, not errors (operation can continue)
- Use toast for user-facing success/error, terminal for technical details

[Source: stories/4-5-terminal-log-panel.md]

---

## Prerequisites

- **Story 4.1** (PartitionGrid Component) - Provides partition display ✅ COMPLETE
- **Story 1.5** (Core Logic Wrapper Hooks) - Provides useFirehose ✅ COMPLETE
- **Story 1.6** (App Shell Layout Components) - Provides layout integration ✅ COMPLETE

**Optional but recommended:**
- Story 4.4 (Flash Flow) and 4.5 (Terminal Log Panel) enhance the ROM loading experience

---

## Dev Agent Record

### Context Reference

- [docs/stories/4-6-rom-file-loading.context.xml](./4-6-rom-file-loading.context.xml)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

1. **useRomLoader hook** - Full implementation with File System Access API, XML parsing, sparse detection, and progress tracking
2. **romStore** - Zustand store with all state, actions, and computed selectors
3. **RomLoader component** - UI component with compact and full modes, syncs with partitionStore
4. **MissingFilesWarning component** - Collapsible warning with tooltip for missing files
5. **PartitionGrid integration** - ROM entries displayed with 📦 icon for existing files, ⚠️ for missing
6. **i18n complete** - English and Vietnamese translations for all rom.* keys
7. **TypeScript compilation** - No errors ✅

### File List

**New Files:**
- `src/hooks/useRomLoader.ts` - ROM loading hook with File System Access API
- `src/stores/romStore.ts` - Zustand store for ROM state
- `src/components/features/rom/RomLoader.tsx` - ROM loader UI component
- `src/components/features/rom/MissingFilesWarning.tsx` - Missing files warning component
- `src/components/features/rom/index.ts` - Barrel export

**Modified Files:**
- `src/stores/partitionStore.ts` - Added romMapping, setRomMapping, clearRomMapping, getRomEntry, hasRomMapping
- `src/components/layout/Sidebar.tsx` - Added RomLoader component when connected
- `src/components/features/partition/PartitionGrid.tsx` - Added ROM indicators and file size display
- `src/hooks/index.ts` - Added useRomLoader export
- `src/i18n/translations/en.json` - Added rom.* translation keys
- `src/i18n/translations/vi.json` - Added Vietnamese rom.* translations

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-30 | SM Agent | Story drafted from epics.md |
| 2025-12-30 | Dev Agent | Implemented all tasks - useRomLoader, romStore, RomLoader UI, MissingFilesWarning, PartitionGrid integration, i18n |
