# Q-Flash-Web Fixes - Native Tool Compatibility

## ✅ Implemented Changes (Based on Native Tool Log Analysis)

### 1. **Chunked Write 64MB** (`FirehoseProtocol.ts`)
Added new `writePartitionChunked()` method that matches native tool behavior:
- Sends SEPARATE program commands for each 64MB chunk
- Reconfigures device between chunks automatically  
- Native tool flashes super.img (14.28 GB) in 229 chunks × 64MB
- Much more reliable for large files than single streaming write

```
Native Log:
  Writing chunk 1/229 (64 MB)...
  Writing chunk 2/229 (64 MB)...
  ...
  Writing chunk 229/229 (26 MB)...
[Success] super written successfully
```

### 2. **LUN5 Auto-Protection** (`tool.ts`)
Added automatic LUN5 skip (calibration data protection):
- All partitions in LUN5 are automatically skipped
- patch5.xml is automatically skipped
- Matches native tool: `[Protect LUN5] Skipping 5 partition(s) in LUN5`

```typescript
const LUN5_PROTECTED = true;  // Set to false to allow LUN5 flashing (DANGEROUS!)
```

### 3. **Improved Flash Strategy**
- Files >64MB now use chunked writes (was >500MB)
- Proper chunk progress logging matching native tool format
- Better error handling for each chunk

### 4. **Auto-Reboot After Flash**
Added automatic device reboot after successful flash:
- Sets bootable storage drive (LUN 1)
- Sends reboot command automatically
- Matches native tool flow

### 5. **Improved Logging Format**
Updated log messages to match native tool style:
```
[Flash] Writing super (LUN0, 14.28 GB)...
[Strategy] Chunked write enabled (14618 MB)
  Writing chunk 1/229 (64 MB)...
[Success] super written successfully
[Protect LUN5] Skipping patch5.xml
Patch application completed: 5/5 successful
```

## 📁 Files Modified

1. **`src/core/FirehoseProtocol.ts`**
   - Added `writePartitionChunked()` method (lines 934-1104)

2. **`src/tool.ts`**
   - Added LUN5_PROTECTED constant (line 1236)
   - Added LUN5 partition filtering (lines 1927-1942)
   - Updated regular partition flash to use chunked writes (lines 2049-2118)
   - Added patch5.xml skip (lines 2162-2174)
   - Added auto-reboot after flash (lines 2255-2271)

## 🔄 Native Tool Compatibility

| Feature | Native Tool | Web Tool (Before) | Web Tool (After) |
|---------|-------------|-------------------|------------------|
| Chunked Write | ✅ 64MB | ❌ Single stream | ✅ 64MB |
| LUN5 Protection | ✅ Auto-skip | ❌ Manual | ✅ Auto-skip |
| Patch5 Skip | ✅ Auto-skip | ❌ Manual | ✅ Auto-skip |
| Auto Reboot | ✅ Yes | ❌ Manual | ✅ Yes |
| Progress Logging | ✅ Per-chunk | ❌ Percentage only | ✅ Per-chunk |

## 🎯 Expected Flash Flow (Matching Native Tool)

1. **Reset device state** for clean GPT flash
2. **Flash GPT tables** (PrimaryGPT for LUN0-4, skip LUN5)
3. **Wait 2s + Reconfigure** to reload partition tables
4. **Flash partitions** using chunked writes (64MB per chunk)
   - Skip all LUN5 partitions automatically
5. **Apply patches** (patch0-4.xml, skip patch5.xml)
6. **Set bootable drive** (value=1)
7. **Auto reboot device**

## ⚠️ Important Notes

- **LUN5 Protection**: LUN5 contains calibration data. Flashing it may cause hardware issues!
- **Chunked Write**: Each chunk is a separate program command, more reliable but slightly slower
- **Auto Reboot**: Device will automatically reboot after flash. No manual action needed.

## 🧪 Testing Checklist

- [ ] Flash main ROM group (rawprogram0-5.xml)
- [ ] Verify LUN5 partitions are skipped
- [ ] Verify patch5.xml is skipped  
- [ ] Verify super.img uses chunked writes (should show chunk progress)
- [ ] Verify device auto-reboots after flash
- [ ] Verify device boots successfully
