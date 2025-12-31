# Fix for "Cannot Match a Partition Info" Error

## Problem Description

When flashing to Find N2 device (and potentially other devices), the tool was encountering errors like:

```
ERROR: Cannot match a parition info by super:super.img
ERROR: Cannot match a parition info by splash_odm:splash.img
```

These errors occurred after:
1. Flashing fresh GPT tables to all LUNs
2. Triggering a partition table reload
3. Attempting to flash regular partitions

## Root Cause Analysis

The error occurs due to how the Firehose protocol handles partition matching when `partofsingleimage="true"`:

### Device Behavior
1. When `partofsingleimage="true"`, the device validates the write command by checking **BOTH**:
   - The partition `label` (e.g., "super", "splash_odm")
   - The `filename` attribute (e.g., "super.img", "splash.img")

2. After flashing a new GPT and reloading the partition table, the device caches partition information including expected filename patterns

3. The device then rejects writes where the `label:filename` combination doesn't match what's in its partition table

### The Issue
The N2 ROM's XML files had mismatched label/filename pairs:
```xml
<program label="splash_odm" filename="splash.img" partofsingleimage="false" />
<program label="super" filename="super.img" partofsingleimage="false" />
```

When we enabled `partofsingleimage="true"` for batch flash (which is necessary for matching partitions after GPT reload), the device tried to find:
- Partition "splash_odm" with filename "splash.img" → ❌ Not found
- Partition "super" with filename "super.img" → ❌ Not found

But the device's partition table (from the freshly flashed GPT) expects filenames that match the partition labels:
- Partition "splash_odm" with filename "splash_odm.img" → ✅ Would match
- Partition "super" with filename "super.img" → ✅ Already matches

## Solutions Implemented

### Fix 1: Force `partofsingleimage=true` for All Batch Flash Operations
**File**: `Q-Flash-Web/src/tool.ts`
**Lines**: 2028, 2047

Changed from:
```typescript
entry.partofsingleimage,  // Pass partofsingleimage setting from XML
```

To:
```typescript
true,  // ALWAYS use partofsingleimage=true for batch flash (device needs to match by name after GPT reload)
```

**Rationale**: After GPT reload, the device MUST match partitions by name, not by sector offset. Setting `partofsingleimage=true` tells the device to use name-based matching.

### Fix 2: Use Label-Based Filename for Partition Table Matching
**File**: `Q-Flash-Web/src/core/FirehoseProtocol.ts`
**Lines**: 658-677, 816-835

Changed from:
```typescript
filename: filename || `${partitionName}.bin`,
```

To:
```typescript
const effectiveFilename = partofsingleimage
    ? `${partitionName}.img`  // Use label-based filename for partition table matching
    : (filename || `${partitionName}.bin`);  // Use XML filename or construct default
```

**Rationale**: When `partofsingleimage=true`, the device performs strict partition table matching using BOTH label and filename. To ensure matching succeeds, we construct the filename from the partition label (e.g., "splash_odm" → "splash_odm.img") rather than using the potentially mismatched XML filename.

## Technical Details

### Why `partofsingleimage` Matters

The `partofsingleimage` attribute controls how the device validates write commands:

| Mode | Label Matching | Filename Matching | Sector Validation |
|------|----------------|-------------------|-------------------|
| `partofsingleimage="false"` | Optional | Ignored | Uses start_sector directly |
| `partofsingleimage="true"` | **Required** | **Required** | Validates against partition table |

### Batch Flash Flow (After Fix)

1. **Phase 1: Flash GPT Tables**
   - Flash `gpt_main0.bin` → LUN0 with `partofsingleimage="true"`, `label="PrimaryGPT"`, `filename="gpt_main0.bin"`
   - Flash `gpt_main1.bin` → LUN1 with `partofsingleimage="true"`, `label="PrimaryGPT"`, `filename="gpt_main1.bin"`
   - ... (repeat for all LUNs)

2. **Trigger Partition Table Reload**
   - Wait 2 seconds for device to process GPT writes
   - Send `configure` command to force device to reload partition tables from disk
   - Device now has fresh partition table info in memory

3. **Phase 2: Flash Regular Partitions**
   - For each partition (e.g., "super", "splash_odm"):
     - Set `partofsingleimage="true"` (forces name-based matching)
     - Set `label` to partition name (e.g., "super")
     - Set `filename` to `${label}.img` (e.g., "super.img") ← **Key fix**
   - Device matches against partition table using label+filename
   - Write succeeds ✅

## Testing Results

### Before Fix (log_n2.txt)
```
17:57:57.084 [ERROR]
❌ super failed: Device rejected write: ERROR: Cannot match a parition info by super:super.img

17:58:08.301 [ERROR]
❌ splash_odm failed: Device rejected write: ERROR: Cannot match a parition info by splash_odm:splash.img
```

### After Fix (Expected)
```
✅ super flashed (14.28 GB)
✅ splash_odm flashed (533 KB)
```

## Compatibility Notes

- **Find X7 Ultra**: Already working before fix (ROM has matching label:filename pairs)
- **Find N2**: Now fixed (ROM had mismatched pairs)
- **Other Oppo/OnePlus/Realme devices**: Should benefit from fix as it makes matching more robust

## Related Issues

This fix resolves the same class of issues encountered in conversations:
- `e235e85b-af37-47a6-9d87-faac8e3ccccb` (Fixing Find N2 Flash)
- `a150d495-8a18-4f70-99b9-983abe4c8331` (Fix GPT Flashing Error)

The core principle: **After GPT flash + reload, always use partition label for both `label` and `filename` (as `label.img`) when `partofsingleimage=true`**.
