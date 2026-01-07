/**
 * useBackup Hook
 * 
 * React hook for backup operations using FirehoseProtocol.
 * Wraps core read operations with File System Access API for saving files.
 * 
 * CRITICAL: This hook WRAPS the core logic - it does NOT modify it.
 */

import { useCallback, useRef } from 'react';
import { useFlashStore } from '@/stores/flashStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useFirehose } from './useFirehose';
import type { WebUSBManager } from '@/core/WebUSBManager';
import type { PartitionInfo } from '@/types';

/**
 * Backup options
 */
export interface BackupOptions {
    /** Include GPT backup and XML generation */
    includeGptBackup?: boolean;
}

/**
 * Return type for useBackup hook.
 */
export interface UseBackupReturn {
    /** Start backup operation for selected partitions */
    startBackup: (
        usb: WebUSBManager,
        partitions: PartitionInfo[],
        directoryHandle: FileSystemDirectoryHandle,
        options?: BackupOptions
    ) => Promise<{ success: boolean; error?: string }>;
    /** Cancel ongoing backup operation */
    cancelBackup: () => void;
}

/**
 * React hook for partition backup operations.
 * 
 * Features:
 * - File System Access API integration
 * - Progress tracking via flashStore
 * - Per-partition status updates
 * - Metadata XML generation
 * - Cancellation support
 * 
 * @example
 * ```tsx
 * const { startBackup, cancelBackup } = useBackup();
 * const { getManager } = useWebUSB();
 * 
 * const handleBackup = async (partitions, dirHandle) => {
 *   const usb = getManager();
 *   const result = await startBackup(usb, partitions, dirHandle);
 *   if (result.success) {
 *     console.log('Backup completed!');
 *   }
 * };
 * ```
 */
export function useBackup(): UseBackupReturn {
    // Cancellation flag
    const cancelledRef = useRef(false);

    // Store connections
    const {
        startBackup: startBackupStore,
        updateBackupProgress,
        setBackupPartitionStatus,
        completeBackup,
        cancelBackup: cancelBackupStore,
        resetBackup,
    } = useFlashStore();
    const log = useTerminalStore((state) => state.log);

    // Get Firehose operations
    const { getInstance, readPartition, readPartitionStreamToFile } = useFirehose();

    // Threshold for switching to streaming mode (32MB)
    const STREAMING_THRESHOLD = 32 * 1024 * 1024;

    /**
     * Start backup operation.
     */
    const startBackup = useCallback(async (
        usb: WebUSBManager,
        partitions: PartitionInfo[],
        directoryHandle: FileSystemDirectoryHandle,
        options?: BackupOptions
    ): Promise<{ success: boolean; error?: string }> => {
        cancelledRef.current = false;
        const savePath = directoryHandle.name;
        const includeGptBackup = options?.includeGptBackup ?? false;

        // Initialize backup state
        const totalBackupSize = partitions.reduce((sum, p) => sum + p.size, 0);
        startBackupStore(partitions.map(p => p.name), savePath, totalBackupSize);
        log('info', `Starting backup of ${partitions.length} partition(s) (${Math.ceil(totalBackupSize / 1024 / 1024)} MB)...`);

        // Group metadata entries by LUN for rawprogram{LUN}.xml format
        const metadataByLun = new Map<number, Array<{
            name: string;
            startSector: bigint;
            numSectors: bigint;
            size: number;
        }>>();
        let successCount = 0;
        let errorCount = 0;
        let accumulatedBytes = 0;

        // Collect unique LUNs from partitions
        const uniqueLuns = [...new Set(partitions.map(p => p.lun ?? 0))];

        // Pre-backup GPT for all LUNs BEFORE partition backups (USB connection is fresh)
        // Only if user selected the GPT backup option
        const gptDataByLun = new Map<number, {
            gptData?: Uint8Array;
            backupGptData?: Uint8Array;
            numDiskSectors?: bigint;
            lastPartitionIndex?: number;
            lastPartitionName?: string;
            lastPartitionEndOffset?: number;
            partitionArraySize?: number;
        }>();

        const firehose = getInstance(usb);

        if (includeGptBackup) {
            log('info', `Pre-reading GPT from ${uniqueLuns.length} LUN(s)...`);

            // GPT read timeout - skip if device doesn't respond in 10 seconds
            const GPT_READ_TIMEOUT = 10000;

            for (const lun of uniqueLuns) {
                try {
                    log('info', `Reading GPT for LUN ${lun}...`);

                    // Race between GPT read and timeout
                    const gptPromise = firehose.getGptInfo(lun);
                    const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) =>
                        setTimeout(() => resolve({ success: false, error: 'GPT read timeout (10s)' }), GPT_READ_TIMEOUT)
                    );

                    const gptInfo = await Promise.race([gptPromise, timeoutPromise]);

                    if (gptInfo.success && gptInfo.gptData && gptInfo.numDiskSectors) {
                        const lunData: typeof gptDataByLun extends Map<number, infer V> ? V : never = {
                            gptData: gptInfo.gptData,
                            numDiskSectors: gptInfo.numDiskSectors,
                            lastPartitionIndex: gptInfo.lastPartitionIndex,
                            lastPartitionName: gptInfo.lastPartitionName,
                            lastPartitionEndOffset: gptInfo.lastPartitionEndOffset,
                            partitionArraySize: gptInfo.partitionArraySize,
                        };

                        // Also read backup GPT (with timeout)
                        const backupPromise = firehose.readBackupGpt(lun, gptInfo.numDiskSectors);
                        const backupTimeoutPromise = new Promise<{ success: false }>((resolve) =>
                            setTimeout(() => resolve({ success: false }), GPT_READ_TIMEOUT)
                        );
                        const backupGpt = await Promise.race([backupPromise, backupTimeoutPromise]);

                        if (backupGpt.success && 'data' in backupGpt && backupGpt.data) {
                            lunData.backupGptData = backupGpt.data;
                        }

                        gptDataByLun.set(lun, lunData);
                        log('success', `GPT for LUN ${lun} read successfully`);
                    } else {
                        log('warning', `Could not read GPT for LUN ${lun}: ${gptInfo.error || 'Unknown error'}`);
                    }
                } catch (gptError) {
                    log('warning', `GPT read error for LUN ${lun}: ${gptError}`);
                }
            }
        } // End if (includeGptBackup)

        try {
            for (const partition of partitions) {
                // Check cancellation
                if (cancelledRef.current) {
                    log('warning', 'Backup cancelled by user');
                    cancelBackupStore();
                    return { success: false, error: 'Cancelled by user' };
                }

                // Update status to in-progress
                setBackupPartitionStatus(partition.name, 'in-progress');
                log('info', `Backing up partition: ${partition.name} (${partition.size} bytes)`);

                try {
                    // Create file handle
                    const fileHandle = await directoryHandle.getFileHandle(
                        `${partition.name}.img`,
                        { create: true }
                    );

                    // HYBRID STRATEGY:
                    // Use memory buffer for small files (faster, simpler)
                    // Use streaming for large files (prevents OOM, handles 16GB+ files)
                    const numSectors = partition.numSectors || partition.sizeInSectors;

                    if (partition.size < STREAMING_THRESHOLD) {
                        // SMALL FILE: Memory Buffer Mode
                        const result = await readPartition(
                            usb,
                            partition.lun,
                            partition.startSector,
                            numSectors,
                            partition.name,
                            (percent) => {
                                const currentBytes = Math.floor((percent / 100) * partition.size);
                                updateBackupProgress(partition.name, accumulatedBytes + currentBytes, totalBackupSize);
                            }
                        );

                        if (!result.success || !result.data) {
                            throw new Error(result.error || 'Failed to read partition');
                        }

                        // Write to file at once
                        const writable = await fileHandle.createWritable();
                        await writable.write(result.data as any);
                        await writable.close();

                    } else {
                        // LARGE FILE: Streaming Mode
                        const result = await readPartitionStreamToFile(
                            usb,
                            partition.lun,
                            partition.startSector,
                            numSectors,
                            partition.name,
                            fileHandle,
                            (percent) => {
                                const currentBytes = Math.floor((percent / 100) * partition.size);
                                updateBackupProgress(partition.name, accumulatedBytes + currentBytes, totalBackupSize);
                            }
                        );

                        if (!result.success) {
                            throw new Error(result.error || 'Failed to read partition');
                        }
                    }

                    // Mark as done
                    setBackupPartitionStatus(partition.name, 'done');
                    log('success', `Backup completed: ${partition.name}`);
                    successCount++;
                    accumulatedBytes += partition.size;
                    // Ensure detailed progress marks current partition as fully done in bytes
                    updateBackupProgress(partition.name, accumulatedBytes, totalBackupSize);

                    // Add to metadata grouped by LUN
                    const lun = partition.lun ?? 0;
                    if (!metadataByLun.has(lun)) {
                        metadataByLun.set(lun, []);
                    }
                    metadataByLun.get(lun)!.push({
                        name: partition.name,
                        startSector: partition.startSector,
                        numSectors: numSectors,
                        size: partition.size,
                    });

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    // CHECK FOR PROTECTED PARTITIONS (Expected Failures)
                    // Partitions like ssd, xbl, uefi are often protected by the device (VIP/Firehose policy).
                    // "not allowed on external network" is the standard error for this.
                    if (errorMessage.includes('not allowed on external network')) {
                        log('warning', `Skipped protected partition: ${partition.name} (Device locked this partition)`);
                        // Treat as "success" for the flow (don't fail the batch), but don't add to metadata/file
                        setBackupPartitionStatus(partition.name, 'done');
                        continue;
                    }

                    setBackupPartitionStatus(partition.name, 'error');
                    errorCount++;

                    // CRITICAL ERROR CHECK:
                    // Stop the entire backup if the device disconnects or connection is lost.
                    // Continuing would just spam errors for every remaining partition.
                    const isCriticalError =
                        errorMessage.includes('Device not connected') ||
                        errorMessage.includes('Device not opened') ||
                        errorMessage.includes('The device was disconnected') ||
                        errorMessage.includes('NetworkError') ||
                        errorMessage.includes('Transfer failed'); // Usually implies lost connection

                    if (isCriticalError) {
                        log('error', `Critical failure during ${partition.name} backup: Connection lost.`);
                        log('warning', 'Aborting remaining backups due to device disconnection.');
                        break; // Stop processing remaining partitions
                    }

                    // For non-critical errors (e.g. read permission, hash error), log and continue
                    log('error', `Failed to backup ${partition.name}: ${errorMessage}`);
                }
            }

            // Generate rawprogram{LUN}.xml and patch{LUN}.xml for each LUN
            const sectorSize = 4096; // UFS standard
            const createdFiles: string[] = [];

            for (const [lun, entries] of metadataByLun) {
                // Build program entries for this LUN
                const programEntries = entries.map(entry => {
                    const startByteHex = `0x${(entry.startSector * BigInt(sectorSize)).toString(16)}`;
                    const sizeInKB = (entry.size / 1024).toFixed(1);
                    return (
                        `  <program SECTOR_SIZE_IN_BYTES="${sectorSize}" ` +
                        `file_sector_offset="0" ` +
                        `filename="${entry.name}.img" ` +
                        `label="${entry.name}" ` +
                        `num_partition_sectors="${entry.numSectors}" ` +
                        `partofsingleimage="false" ` +
                        `physical_partition_number="${lun}" ` +
                        `readbackverify="false" ` +
                        `size_in_KB="${sizeInKB}" ` +
                        `sparse="false" ` +
                        `start_byte_hex="${startByteHex}" ` +
                        `start_sector="${entry.startSector}"/>`
                    );
                });

                // Create rawprogram{LUN}.xml
                const rawprogramXML =
                    `<?xml version="1.0" ?>\n` +
                    `<data>\n` +
                    `  <!--NOTE: This is an ** Autogenerated file **-->\n` +
                    `  <!--NOTE: Sector size is ${sectorSize}bytes-->\n` +
                    `${programEntries.join('\n')}\n` +
                    `</data>`;

                const rawprogramHandle = await directoryHandle.getFileHandle(
                    `rawprogram${lun}.xml`,
                    { create: true }
                );
                const rawprogramWritable = await rawprogramHandle.createWritable();
                await rawprogramWritable.write(rawprogramXML);
                await rawprogramWritable.close();
                createdFiles.push(`rawprogram${lun}.xml`);

                // Use pre-read GPT data (read before partition backups when USB was fresh)
                const preReadGpt = gptDataByLun.get(lun);

                if (preReadGpt && preReadGpt.gptData && preReadGpt.numDiskSectors) {
                    // Save gpt_main{LUN}.bin
                    const gptMainHandle = await directoryHandle.getFileHandle(
                        `gpt_main${lun}.bin`,
                        { create: true }
                    );
                    const gptMainWritable = await gptMainHandle.createWritable();
                    // Copy to standard ArrayBuffer for TS compatibility
                    const gptMainBuffer = preReadGpt.gptData.buffer.slice(
                        preReadGpt.gptData.byteOffset,
                        preReadGpt.gptData.byteOffset + preReadGpt.gptData.byteLength
                    ) as ArrayBuffer;
                    await gptMainWritable.write(gptMainBuffer);
                    await gptMainWritable.close();
                    createdFiles.push(`gpt_main${lun}.bin`);
                    log('success', `GPT saved: gpt_main${lun}.bin`);

                    // Save backup GPT if available
                    if (preReadGpt.backupGptData) {
                        const gptBackupHandle = await directoryHandle.getFileHandle(
                            `gpt_backup${lun}.bin`,
                            { create: true }
                        );
                        const gptBackupWritable = await gptBackupHandle.createWritable();
                        const gptBackupBuffer = preReadGpt.backupGptData.buffer.slice(
                            preReadGpt.backupGptData.byteOffset,
                            preReadGpt.backupGptData.byteOffset + preReadGpt.backupGptData.byteLength
                        ) as ArrayBuffer;
                        await gptBackupWritable.write(gptBackupBuffer);
                        await gptBackupWritable.close();
                        createdFiles.push(`gpt_backup${lun}.bin`);
                        log('success', `Backup GPT saved: gpt_backup${lun}.bin`);
                    }

                    // Calculate partition array size and byte offset for last partition
                    const lastPartIndex = preReadGpt.lastPartitionIndex ?? 0;
                    const partArraySize = preReadGpt.partitionArraySize ?? 4096;
                    const lastPartEndOffset = preReadGpt.lastPartitionEndOffset ?? 0;

                    // Create patch{LUN}.xml with full GPT patching rules
                    const patchEntries = [
                        // Update last partition endLBA in Primary GPT
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="${lastPartEndOffset}" filename="gpt_main${lun}.bin" physical_partition_number="${lun}" size_in_bytes="8" start_sector="2" value="NUM_DISK_SECTORS-6." what="Update last partition ${lastPartIndex} '${preReadGpt.lastPartitionName}' with actual size in Primary Header."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="${lastPartEndOffset}" filename="DISK" physical_partition_number="${lun}" size_in_bytes="8" start_sector="2" value="NUM_DISK_SECTORS-6." what="Update last partition ${lastPartIndex} '${preReadGpt.lastPartitionName}' with actual size in Primary Header."/>`,
                        // Update last partition endLBA in Backup GPT
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="${lastPartEndOffset}" filename="gpt_backup${lun}.bin" physical_partition_number="${lun}" size_in_bytes="8" start_sector="0" value="NUM_DISK_SECTORS-6." what="Update last partition ${lastPartIndex} '${preReadGpt.lastPartitionName}' with actual size in Backup Header."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="${lastPartEndOffset}" filename="DISK" physical_partition_number="${lun}" size_in_bytes="8" start_sector="NUM_DISK_SECTORS-5." value="NUM_DISK_SECTORS-6." what="Update last partition ${lastPartIndex} '${preReadGpt.lastPartitionName}' with actual size in Backup Header."/>`,
                        // Update LastUsableLBA in Primary GPT
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="48" filename="gpt_main${lun}.bin" physical_partition_number="${lun}" size_in_bytes="8" start_sector="1" value="NUM_DISK_SECTORS-6." what="Update Primary Header with LastUseableLBA."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="48" filename="DISK" physical_partition_number="${lun}" size_in_bytes="8" start_sector="1" value="NUM_DISK_SECTORS-6." what="Update Primary Header with LastUseableLBA."/>`,
                        // Update LastUsableLBA in Backup GPT
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="48" filename="gpt_backup${lun}.bin" physical_partition_number="${lun}" size_in_bytes="8" start_sector="4" value="NUM_DISK_SECTORS-6." what="Update Backup Header with LastUseableLBA."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="48" filename="DISK" physical_partition_number="${lun}" size_in_bytes="8" start_sector="NUM_DISK_SECTORS-1." value="NUM_DISK_SECTORS-6." what="Update Backup Header with LastUseableLBA."/>`,
                        // Update BackupGPT Header Location in Primary GPT
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="32" filename="gpt_main${lun}.bin" physical_partition_number="${lun}" size_in_bytes="8" start_sector="1" value="NUM_DISK_SECTORS-1." what="Update Primary Header with BackupGPT Header Location."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="32" filename="DISK" physical_partition_number="${lun}" size_in_bytes="8" start_sector="1" value="NUM_DISK_SECTORS-1." what="Update Primary Header with BackupGPT Header Location."/>`,
                        // Update CurrentLBA in Backup GPT
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="24" filename="gpt_backup${lun}.bin" physical_partition_number="${lun}" size_in_bytes="8" start_sector="4" value="NUM_DISK_SECTORS-1." what="Update Backup Header with CurrentLBA."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="24" filename="DISK" physical_partition_number="${lun}" size_in_bytes="8" start_sector="NUM_DISK_SECTORS-1." value="NUM_DISK_SECTORS-1." what="Update Backup Header with CurrentLBA."/>`,
                        // Update Partition Array Location in Backup GPT
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="72" filename="gpt_backup${lun}.bin" physical_partition_number="${lun}" size_in_bytes="8" start_sector="4" value="NUM_DISK_SECTORS-5." what="Update Backup Header with Partition Array Location."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="72" filename="DISK" physical_partition_number="${lun}" size_in_bytes="8" start_sector="NUM_DISK_SECTORS-1" value="NUM_DISK_SECTORS-5." what="Update Backup Header with Partition Array Location."/>`,
                        // Update CRC of Partition Array in Primary GPT
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="88" filename="gpt_main${lun}.bin" physical_partition_number="${lun}" size_in_bytes="4" start_sector="1" value="CRC32(2,${partArraySize})" what="Update Primary Header with CRC of Partition Array."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="88" filename="DISK" physical_partition_number="${lun}" size_in_bytes="4" start_sector="1" value="CRC32(2,${partArraySize})" what="Update Primary Header with CRC of Partition Array."/>`,
                        // Update CRC of Partition Array in Backup GPT
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="88" filename="gpt_backup${lun}.bin" physical_partition_number="${lun}" size_in_bytes="4" start_sector="4" value="CRC32(0,${partArraySize})" what="Update Backup Header with CRC of Partition Array."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="88" filename="DISK" physical_partition_number="${lun}" size_in_bytes="4" start_sector="NUM_DISK_SECTORS-1." value="CRC32(NUM_DISK_SECTORS-5.,${partArraySize})" what="Update Backup Header with CRC of Partition Array."/>`,
                        // Zero out and update CRC of Primary Header
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="16" filename="gpt_main${lun}.bin" physical_partition_number="${lun}" size_in_bytes="4" start_sector="1" value="0" what="Zero Out Header CRC in Primary Header."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="16" filename="gpt_main${lun}.bin" physical_partition_number="${lun}" size_in_bytes="4" start_sector="1" value="CRC32(1,92)" what="Update Primary Header with CRC of Primary Header."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="16" filename="DISK" physical_partition_number="${lun}" size_in_bytes="4" start_sector="1" value="0" what="Zero Out Header CRC in Primary Header."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="16" filename="DISK" physical_partition_number="${lun}" size_in_bytes="4" start_sector="1" value="CRC32(1,92)" what="Update Primary Header with CRC of Primary Header."/>`,
                        // Zero out and update CRC of Backup Header
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="16" filename="gpt_backup${lun}.bin" physical_partition_number="${lun}" size_in_bytes="4" start_sector="4" value="0" what="Zero Out Header CRC in Backup Header."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="16" filename="gpt_backup${lun}.bin" physical_partition_number="${lun}" size_in_bytes="4" start_sector="4" value="CRC32(4,92)" what="Update Backup Header with CRC of Backup Header."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="16" filename="DISK" physical_partition_number="${lun}" size_in_bytes="4" start_sector="NUM_DISK_SECTORS-1." value="0" what="Zero Out Header CRC in Backup Header."/>`,
                        `  <patch SECTOR_SIZE_IN_BYTES="${sectorSize}" byte_offset="16" filename="DISK" physical_partition_number="${lun}" size_in_bytes="4" start_sector="NUM_DISK_SECTORS-1." value="CRC32(NUM_DISK_SECTORS-1.,92)" what="Update Backup Header with CRC of Backup Header."/>`,
                    ];

                    const patchXML =
                        `<?xml version="1.0" ?>\n` +
                        `<patches>\n` +
                        `  <!--NOTE: This is an ** Autogenerated file **-->\n` +
                        `  <!--NOTE: Patching is in little endian format, i.e. 0xAABBCCDD will look like DD CC BB AA in the file or on disk-->\n` +
                        `  <!--NOTE: This file is used by Trace32 - So make sure to add decimals, i.e. 0x10-10=0, *but* 0x10-10.=6.-->\n` +
                        `${patchEntries.join('\n')}\n` +
                        `</patches>`;

                    const patchHandle = await directoryHandle.getFileHandle(
                        `patch${lun}.xml`,
                        { create: true }
                    );
                    const patchWritable = await patchHandle.createWritable();
                    await patchWritable.write(patchXML);
                    await patchWritable.close();
                    createdFiles.push(`patch${lun}.xml`);
                } else {
                    // Fallback: Create empty patch file if GPT was not pre-read
                    log('warning', `No pre-read GPT data for LUN ${lun}, creating empty patch file`);
                    const patchXML =
                        `<?xml version="1.0" ?>\n` +
                        `<patches>\n` +
                        `  <!--NOTE: This is an ** Autogenerated file **-->\n` +
                        `  <!--NOTE: Empty patch file - GPT info not available-->\n` +
                        `</patches>`;

                    const patchHandle = await directoryHandle.getFileHandle(
                        `patch${lun}.xml`,
                        { create: true }
                    );
                    const patchWritable = await patchHandle.createWritable();
                    await patchWritable.write(patchXML);
                    await patchWritable.close();
                    createdFiles.push(`patch${lun}.xml`);
                }
            }

            if (createdFiles.length > 0) {
                log('success', `Metadata XML created: ${createdFiles.join(', ')}`);
            }

            // Complete backup
            completeBackup();
            log('success', `Backup completed: ${successCount} success, ${errorCount} failed`);

            return {
                success: errorCount === 0,
                error: errorCount > 0 ? `${errorCount} partition(s) failed` : undefined
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Backup failed: ${errorMessage}`);
            resetBackup();
            return { success: false, error: errorMessage };
        }
    }, [
        startBackupStore,
        updateBackupProgress,
        setBackupPartitionStatus,
        completeBackup,
        cancelBackupStore,
        resetBackup,
        log,
        getInstance,
        readPartition,
        readPartitionStreamToFile,
    ]);

    /**
     * Cancel backup operation.
     */
    const cancelBackup = useCallback(() => {
        cancelledRef.current = true;
        log('warning', 'Cancelling backup...');
    }, [log]);

    return {
        startBackup,
        cancelBackup,
    };
}
