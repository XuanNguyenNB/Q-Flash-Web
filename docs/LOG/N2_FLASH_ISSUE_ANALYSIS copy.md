# Analysis: "Cannot Match a Partition Info" Error

## Current Status
I've reverted all my attempted fixes. After deeper analysis, I now understand the real root cause.

## What I Tried (FAILED)
1. ❌ Forced `partofsingleimage=true` for all batch flash → Broke GPT flashing
2. ❌ Changed filename to `${label}.img` when `partofsingleimage=true` → Broke everything

## The Real Root Cause

Looking at your N2 ROM structure, the issue is that **the ROM XML files have filename/label mismatches that can't work with Find N2's partition table expectations.**

From your original log, these partitions failed:
- `super`: XML has `filename="super.img"` + `label="super"` + `partofsingleimage="false"`
- `splash_odm`: XML has `filename="splash.img"` + `label="splash_odm"` + `partofsingleimage="false"`  
- `vm-bootsys_a`: XML has `filename="vm-bootsys.img"` + `label="vm-bootsys_a"` + `partofsingleimage="false"`

**The XMLs from the ROM are WRONG for Find N2!** They have mismatched filename/label combinations.

## Why This Happens

The domestic N2 ROM you have (`PGU110domestic_11_14.0.0.713CN01_2024102919240220`) appears to be configured for a different flashing tool or device variant. The filenames in the XML don't match what's physically in the folder.

## Solutions

### Option 1: Use Native Tools (Recommended)
The N2 ROM is designed for native Qualcomm flashing tools (like MiFlash, QPST, etc), which handle these mismatches differently.

### Option 2: ROM Converter Tool
You mentioned having QFlashForge. This tool should be able to:
1. Extract the ROM
2. Fix the XML filename/label mismatches 
3. Convert to a format that works with Q-Flash-Web

### Option 3: Manual XML Fix (Technical)
You could manually edit the rawprogram XML files to fix the filename/label mismatches, but this is error-prone and time-consuming.

## Why X7 Ultra Works But N2 Doesn't

The X7 Ultra ROM you tested earlier has properly matching filename/label pairs in its XML files. The N2 domestic ROM doesn't, suggesting it's packaged differently by the manufacturer.

## What the Error Really Means

When the Firehose device says "Cannot match a partition info by splash_odm:splash.img", it means:
- The device is looking for a partition entry that has BOTH name="splash_odm" AND expects filename="splash.img"
- But in the partition table (which was just freshly flashed via GPT), there's no such combination
- The partition table might have "splash_odm" but expect a different filename

This is NOT a bug in Q-Flash-Web - it's a ROM packaging incompatibility.

## Recommended Action

Try using QFlashForge to process the N2 ROM before flashing with Q-Flash-Web. QFlashForge should:
1. Convert sparse images to raw
2. Build a proper super.img if needed
3. Generate corrected XML files with matching filename/label pairs

Then use the QFlashForge output folder with Q-Flash-Web instead of the original ROM folder.
