# Q-Flash-Web Development Session Log
**Date:** 2025-12-29  
**Duration:** ~4 hours  

---

## 🎯 Session Objectives

1. Enhance Log Management UI (debug toggle + capacity)
2. Resolve protected partition read failures during backup
3. Fix `vm-bootsys_a` flash failure
4. Fix device hang when flashing after reading partition table

---

## ✅ Completed Tasks

### 1. Log Management Improvements

#### Debug Log Toggle
- Added checkbox "Show DEBUG logs" above terminal log area
- Default: Debug logs hidden (cleaner UI)
- Toggle dynamically shows/hides `[DEBUG]` entries without clearing log

**Location:** `src/ui/Terminal.ts`
```typescript
private showDebug = false;
// createDebugToggle() - creates checkbox
// refreshVisibility() - updates display of debug lines
```

#### Increased Log Capacity
- Changed `maxEntries` from 1000 → **10,000** entries
- Preserves more log history for debugging

---

### 2. Backup (Read) Failure Fixes

#### Protected Partition Skip List
**Problem:** `ALIGN_TO_*` partitions and bootloader partitions fail to read with error:
```
ERROR: operation 0 on PrimaryGPT:6:26 is forbidden on external network
```

**Solution:** Skip these partitions during backup and show informative message:

**Location:** `src/tool.ts` - `handleBatchBackup()`
```typescript
const protectedPartitions = ['ssd', 'xbl_a', 'xbl_b', 'uefi_a', 'uefi_b'];

if (partition.name.startsWith('ALIGN_TO_')) {
  skippedAlignment.push(partition.name);
  terminal.info(`⏭️ Skipped: ${partition.name} (alignment padding)`);
  continue;
}
if (protectedPartitions.includes(partition.name)) {
  skippedProtected.push(partition.name);
  terminal.info(`⏭️ Skipped: ${partition.name} (protected bootloader)`);
  continue;
}
```

#### User-Friendly Summary at End of Backup
```
✅ Batch backup complete: 126 succeeded, 0 failed

ℹ️ 7 partition(s) were skipped (not errors):
   • Protected bootloader (5): ssd, xbl_a, xbl_b, uefi_a, uefi_b
     → Device security prevents reading. No unique data - can use from official ROM
   • Alignment padding (2): ALIGN_TO_128K_1, ALIGN_TO_128K_2
     → Empty padding areas, not needed for backup
```

---

### 3. Device Hang Fix (Flash After Read)

**Problem:** After reading partition table, clicking "Flash ROM" caused device to hang at:
```
🔄 Attempting to reset device state for clean GPT flash...
Sending reset command...
```

**Root Cause:** 
- `firehose.reset()` causes device to become unresponsive
- `firehose.configure()` after reading also hangs

**Solution:** Remove reset and configure calls before flashing since Firehose is already configured:

**Location:** `src/tool.ts` - before `handleFlashFromXml()`
```typescript
// Before (BROKEN):
await firehose.reset();      // Device hangs!
await firehose.configure();  // Also hangs!

// After (FIXED):
// Firehose is already configured from reading partition table - no need to reconfigure
terminal.separator();
terminal.success('✅ Firehose ready for flashing');
```

---

### 4. vm-bootsys Flash Failure Fix

**Problem:** `vm-bootsys_a` and `vm-bootsys_b` fail with:
```
ERROR: Cannot match a parition info by vm-bootsys_a:vm-bootsys.img
```

**Root Cause:** These are protected partitions that need **Spoof Mode** like `super` and `splash_odm`.

**Solution:** Add to `PROTECTED_PARTITIONS` list in **BOTH** code paths:

#### Path 1: XML Batch Flash (`handleFlashFromXml`)
**Location:** `src/tool.ts` line ~2039
```typescript
const PROTECTED_PARTITIONS = ['super', 'splash_odm', 'vm-bootsys_a', 'vm-bootsys_b'];
```

#### Path 2: Single Partition Flash (`handleFlashSelectedPartitions`)
**Location:** `src/tool.ts` line ~1591
```typescript
// SPOOF MODE: Some partitions are protected and need BackupGPT spoof
const PROTECTED_PARTITIONS = ['super', 'splash_odm', 'vm-bootsys_a', 'vm-bootsys_b'];
const isProtected = PROTECTED_PARTITIONS.includes(partition.name.toLowerCase());

let spoofLabel: string | undefined;
let spoofFilename: string | undefined;

if (isProtected) {
  terminal.info(`[Spoof Mode] ${partition.name} is protected, using BackupGPT spoof`);
  spoofLabel = 'BackupGPT';
  spoofFilename = `gpt_backup${lun}.bin`;
}

const result = await firehose.writePartition(
  lun,
  partition.startSector,
  partition.sizeInSectors,
  partition.name,
  data,
  progressCallback,
  skipConfigure,
  file.name,
  false,  // partofsingleimage
  false,  // sparse
  spoofLabel,    // NEW: "BackupGPT" for protected
  spoofFilename  // NEW: "gpt_backup0.bin" for protected
);
```

---

## 🔧 Spoof Mode Explained

### Why It's Needed
Some partitions like `super`, `splash_odm`, and `vm-bootsys_*` are **protected by device firmware**. The device rejects direct writes to these partitions.

### How It Works
Instead of sending:
```xml
<program label="vm-bootsys_a" filename="vm-bootsys.img" ... />
```

We send:
```xml
<program label="BackupGPT" filename="gpt_backup4.bin" ... />
```

But we still use the **real sector address** (e.g., `start_sector="164858"`), so the data goes to the correct location. Device thinks it's a GPT backup operation (which is allowed) but actually writes to the protected partition.

### Implementation in FirehoseProtocol.ts
```typescript
if (spoofLabel && spoofFilename) {
  // SPOOF MODE: Use fake label/filename to bypass device protection
  finalFilename = spoofFilename;  // e.g., "gpt_backup0.bin"
  finalLabel = spoofLabel;        // e.g., "BackupGPT"
} else {
  finalFilename = filename || `${partitionName}.img`;
  finalLabel = partitionName;
}
```

---

## 📋 Protected Partition Lists

### For Backup (Read) - Skip These
| Partition | Reason |
|-----------|--------|
| `ALIGN_TO_*` | Empty alignment padding |
| `ssd` | Secure Storage Daemon |
| `xbl_a`, `xbl_b` | eXtensible Bootloader |
| `uefi_a`, `uefi_b` | UEFI firmware |

### For Flash (Write) - Spoof These
| Partition | Spoof Label | Spoof Filename |
|-----------|-------------|----------------|
| `super` | `BackupGPT` | `gpt_backup0.bin` |
| `splash_odm` | `BackupGPT` | `gpt_backup0.bin` |
| `vm-bootsys_a` | `BackupGPT` | `gpt_backup4.bin` |
| `vm-bootsys_b` | `BackupGPT` | `gpt_backup4.bin` |

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `src/ui/Terminal.ts` | Debug toggle checkbox, maxEntries 10000 |
| `src/tool.ts` | Protected partition skip, spoof mode 2 locations, remove reset/configure |
| `src/core/FirehoseProtocol.ts` | spoofLabel/spoofFilename parameters |

---

## 🚀 Performance Notes from Previous Sessions

- **CHUNK_SIZE:** 512MB (was smaller)
- **USB_CHUNK:** 16MB for WebUSB transfers
- **TRANSFER_TIMEOUT_MS:** 300,000ms (5 minutes)
- Use `subarray()` instead of `slice()` to avoid memory copy

---

## 📝 Lessons Learned

1. **Multiple Code Paths:** Single partition flash vs XML batch flash have different code - need to apply fixes to both
2. **Device Protection:** Modern Qualcomm devices protect certain partitions - spoof mode bypasses this
3. **Firehose State:** After reading partition table, Firehose is already configured - don't reset/reconfigure
4. **User Communication:** Show clear messages about skipped partitions to avoid confusion
5. **Protected Bootloader Data:** Partitions like `xbl_a`, `uefi_a` contain generic firmware, not unique device data - safe to skip during backup
