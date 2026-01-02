/**
 * useFlash Hook
 * 
 * React hook for flash write operations.
 * Wraps FirehoseProtocol write operations without modifying core logic (ADR-002).
 */

import { useCallback, useRef } from 'react';
import { useFlashStore } from '@/stores/flashStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useRomStore } from '@/stores/romStore';
import { toast } from 'sonner';
import type { PartitionInfo } from '@/types';

/**
 * ROM file map type
 */
type RomFilesMap = Map<string, File>;

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format seconds to human-readable time
 */
function formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * useFlash hook for flash write operations
 */
export function useFlash() {
    const { log } = useTerminalStore();
    const {
        startFlashWrite,
        updateFlashWriteProgress,
        setFlashWritePartitionStatus,
        completeFlashWrite,
        cancelFlashWrite,
        setFlashWriteError,
        resetFlashWrite,
        flashWriteStatus,
    } = useFlashStore();

    // Cancellation flag using ref for immediate access
    const cancelledRef = useRef(false);

    /**
     * Start flash operation
     */
    const startFlash = useCallback(async (
        partitions: PartitionInfo[],
        romFiles: RomFilesMap,
        firehoseProtocol: {
            writePartition: (
                name: string,
                lun: number,
                startSector: number,
                data: Uint8Array,
                onProgress?: (bytesWritten: number, totalBytes: number) => void
            ) => Promise<boolean>;
            writePartitionChunked?: (
                name: string,
                lun: number,
                startSector: bigint,
                numSectors: bigint,
                file: Blob,
                onProgress?: (percent: number) => void,
                spoofLabel?: string,
                spoofFilename?: string
            ) => Promise<boolean>;
            applyPatch?: (xmlContent: string) => Promise<boolean>;
            reset?: () => Promise<boolean>;
            configure?: () => Promise<boolean>;
        } | null
    ) => {

        // Reset cancellation flag
        cancelledRef.current = false;

        // Protected partitions that require spoofing to bypass "not allowed on external network"
        const PROTECTED_PARTITIONS = ['super', 'system', 'vendor', 'product', 'odm', 'driver'];

        // Validate inputs
        if (!firehoseProtocol) {
            log('error', 'Firehose protocol not initialized');
            toast.error('Firehose not connected');
            return false;
        }

        if (partitions.length === 0) {
            log('error', 'No partitions selected for flash');
            toast.error('No partitions selected');
            return false;
        }

        // Helper to get ROM file case-insensitively
        const getRomFile = (name: string) => {
            return romFiles.get(name) || romFiles.get(name.toLowerCase());
        };

        // Calculate total bytes based on FILES, not partitions
        // This ensures the progress bar reflects the actual data being transferred
        // (e.g. 2.8MB userdata image instead of 200GB partition)
        const totalBytes = partitions.reduce((sum, p) => {
            const file = getRomFile(p.name);
            return sum + (file ? file.size : 0);
        }, 0);

        log('info', `Starting flash of ${partitions.length} partition(s) (${formatBytes(totalBytes)})...`);

        // Initialize store state
        startFlashWrite(partitions.map(p => p.name), totalBytes);

        let successCount = 0;
        let errorCount = 0;
        let bytesFlashed = 0;
        const startTime = Date.now();

        try {
            for (const partition of partitions) {
                // Check for cancellation
                if (cancelledRef.current) {
                    log('warning', 'Flash cancelled by user');
                    cancelFlashWrite();
                    toast.info('Flash operation cancelled');
                    return false;
                }

                // Get ROM file for this partition
                const romFile = getRomFile(partition.name);
                if (!romFile) {
                    log('warning', `Skipping ${partition.name}: No ROM file loaded`);
                    setFlashWritePartitionStatus(partition.name, 'error');
                    errorCount++;
                    continue;
                }

                // Update status to in-progress
                setFlashWritePartitionStatus(partition.name, 'in-progress');
                log('info', `Flashing partition: ${partition.name} (${formatBytes(romFile.size)})`);

                try {
                    // Track progress for this partition
                    const partitionStartBytes = bytesFlashed;
                    let success = false;

                    // Determine if spoofing is needed
                    const isProtected = PROTECTED_PARTITIONS.includes(partition.name.toLowerCase());
                    const spoofLabel = isProtected ? 'BackupGPT' : undefined;
                    const spoofFilename = isProtected ? 'gpt_backup0.bin' : undefined;

                    if (isProtected) {
                        log('warning', `Activating Spoof Mode for protected partition: ${partition.name}`);
                    }

                    // SMART ROUTING: Choose optimal write method based on file size
                    // - Small files (< 100MB): Use writePartition (1 configure, faster for small files)
                    // - Large files (>= 100MB): Use writePartitionChunked (chunked transfer, required for large files)
                    // This avoids the ~5 second overhead per partition for small files
                    const SMALL_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
                    const useChunkedWrite = romFile.size >= SMALL_FILE_THRESHOLD || isProtected;

                    if (useChunkedWrite && firehoseProtocol.writePartitionChunked) {
                        // Large file or protected partition: use chunked write
                        if (isProtected) {
                            log('debug', `Using chunked flash with spoofing for ${partition.name}`);
                        } else {
                            log('debug', `Using chunked flash for large file: ${partition.name}`);
                        }

                        success = await firehoseProtocol.writePartitionChunked(
                            partition.name,
                            partition.lun,
                            partition.startSector, // Pass BigInt directly
                            partition.numSectors || BigInt(Math.ceil(partition.size / 4096)), // Fallback numSectors
                            romFile,
                            (percent) => {
                                // Check for cancellation during write
                                if (cancelledRef.current) {
                                    throw new Error('Cancelled');
                                }

                                const written = Math.floor((percent / 100) * romFile.size);
                                const total = romFile.size;

                                // Update overall progress
                                const currentTotalWritten = partitionStartBytes + written;
                                updateFlashWriteProgress(partition.name, currentTotalWritten, total);
                            },
                            spoofLabel,
                            spoofFilename
                        );
                    } else {
                        // Small file: use single writePartition (faster, less overhead)
                        log('debug', `Using fast single-write for small file: ${partition.name}`);
                        const fileData = await romFile.arrayBuffer();
                        const data = new Uint8Array(fileData);

                        success = await firehoseProtocol.writePartition(
                            partition.name,
                            partition.lun,
                            Number(partition.startSector), // Convert bigint to number for legacy
                            data,
                            (written, total) => {
                                // Check for cancellation during write
                                if (cancelledRef.current) {
                                    throw new Error('Cancelled');
                                }

                                // Update overall progress
                                const currentTotalWritten = partitionStartBytes + written;
                                updateFlashWriteProgress(partition.name, currentTotalWritten, total);
                            }
                        );
                    }

                    if (success) {
                        bytesFlashed += romFile.size;
                        setFlashWritePartitionStatus(partition.name, 'done');
                        log('success', `Flash completed: ${partition.name}`);
                        successCount++;
                    } else {
                        setFlashWritePartitionStatus(partition.name, 'error');
                        log('error', `Flash failed: ${partition.name}`);
                        errorCount++;
                    }
                } catch (error) {
                    if ((error as Error).message === 'Cancelled') {
                        throw error;
                    }

                    setFlashWritePartitionStatus(partition.name, 'error');
                    log('error', `Failed to flash ${partition.name}: ${(error as Error).message}`);
                    errorCount++;
                    // Continue with next partition
                }
            }

            // CRITICAL: Re-configure device after flashing all partitions
            // This is REQUIRED for device to properly recognize new partition data
            // before applying patches. Without this, device may not boot properly.
            if (firehoseProtocol.configure) {
                log('info', 'Re-configuring device after partition flash...');
                try {
                    await firehoseProtocol.configure();
                    log('success', 'Device re-configured successfully');
                } catch (e) {
                    log('error', `Failed to re-configure device: ${e}`);
                    // Continue anyway as this is best-effort
                }
            } else {
                log('warning', 'configure() not available - device may not boot properly');
            }

            // Apply Patches (patch0.xml, etc.) AFTER re-configuring device
            if (errorCount === 0 && firehoseProtocol.applyPatch) {
                const { patchFiles } = useRomStore.getState();

                if (patchFiles && patchFiles.length > 0) {
                    log('info', `Found ${patchFiles.length} patch file(s). Applying...`);

                    // Sort patches by name (patch0.xml, patch1.xml, ...)
                    const sortedPatches = [...patchFiles].sort((a, b) =>
                        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                    );

                    for (const patchFile of sortedPatches) {
                        try {
                            log('info', `Applying patch: ${patchFile.name}...`);
                            const file = await patchFile.handle.getFile();
                            const content = await file.text();

                            const success = await firehoseProtocol.applyPatch(content);
                            if (success) {
                                log('success', `Patch applied: ${patchFile.name}`);
                            } else {
                                log('error', `Failed to apply patch: ${patchFile.name}`);
                                errorCount++;
                                toast.error(`Failed to apply patch: ${patchFile.name}`);
                            }
                        } catch (e) {
                            log('error', `Error reading patch ${patchFile.name}: ${e}`);
                            errorCount++;
                        }
                    }
                }
            }

            // Don't auto-reboot - let user decide
            // Store reboot callback for later use by UI
            const resetFn = firehoseProtocol.reset;
            if (errorCount === 0 && resetFn) {
                log('info', '✅ Flash complete! Device is ready for reboot.');
                log('info', '💡 Click "Reboot Device" button when ready.');
                // Store the reset function for later use
                useFlashStore.getState().setRebootCallback(async () => {
                    log('info', 'Rebooting device...');
                    await resetFn();
                    log('success', 'Reboot command sent!');
                });
            }


            // Complete operation
            completeFlashWrite();

            // Update final progress
            updateFlashWriteProgress('', totalBytes, totalBytes);

            // Show summary
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            if (errorCount === 0) {
                log('success', `✅ All ${successCount} partition(s) flashed successfully in ${elapsed}s!`);
                toast.success(`${successCount} partition(s) flashed successfully`, {
                    description: `Completed in ${elapsed}s`
                });
            } else {
                log('warning', `Flash complete: ${successCount} success, ${errorCount} failed in ${elapsed}s`);
                toast.warning(`Flash: ${successCount} success, ${errorCount} failed`, {
                    description: `Completed in ${elapsed}s`
                });
            }

            return errorCount === 0;

        } catch (error) {
            if ((error as Error).message === 'Cancelled') {
                return false;
            }

            setFlashWriteError({
                code: 'FLASH_ERROR',
                message: (error as Error).message,
                recoverable: true
            });
            log('error', `Flash failed: ${(error as Error).message}`);
            toast.error('Flash operation failed', {
                description: (error as Error).message
            });
            return false;
        }
    }, [
        log,
        startFlashWrite,
        updateFlashWriteProgress,
        setFlashWritePartitionStatus,
        completeFlashWrite,
        cancelFlashWrite,
        setFlashWriteError
    ]);

    /**
     * Cancel flash operation
     */
    const cancelFlash = useCallback(() => {
        cancelledRef.current = true;
        log('warning', 'Cancelling flash...');
    }, [log]);

    /**
     * Reset flash state
     */
    const reset = useCallback(() => {
        cancelledRef.current = false;
        resetFlashWrite();
    }, [resetFlashWrite]);

    return {
        startFlash,
        cancelFlash,
        reset,
        isFlashing: flashWriteStatus === 'flashing',
        isComplete: flashWriteStatus === 'success',
        isError: flashWriteStatus === 'error',
        isCancelled: flashWriteStatus === 'cancelled',
    };
}
