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
 * Return type for useBackup hook.
 */
export interface UseBackupReturn {
    /** Start backup operation for selected partitions */
    startBackup: (
        usb: WebUSBManager,
        partitions: PartitionInfo[],
        directoryHandle: FileSystemDirectoryHandle
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
        directoryHandle: FileSystemDirectoryHandle
    ): Promise<{ success: boolean; error?: string }> => {
        cancelledRef.current = false;
        const savePath = directoryHandle.name;

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
