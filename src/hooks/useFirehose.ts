/**
 * useFirehose Hook
 * 
 * React hook that wraps the FirehoseProtocol class for Qualcomm Firehose
 * operations like reading/writing partitions. Syncs state with Zustand stores
 * and logs operations to terminal.
 * 
 * CRITICAL: This hook WRAPS the core logic - it does NOT modify it.
 */

import { useCallback, useRef } from 'react';
import { usePartitionStore } from '@/stores/partitionStore';
import { useFlashStore } from '@/stores/flashStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { FirehoseProtocol } from '@/core/FirehoseProtocol';
import type { WebUSBManager } from '@/core/WebUSBManager';
import type { PartitionInfo, FirehoseConfig, FirehoseResponse } from '@/types';

// Singleton refs - shared across all hook instances
// This ensures FirehoseProtocol instance is reused and isConfigured state is preserved
let firehoseSingleton: FirehoseProtocol | null = null;
let currentUsbSingleton: WebUSBManager | null = null;

/**
 * Return type for useFirehose hook.
 */
export interface UseFirehoseReturn {
    /** Get or create the FirehoseProtocol instance */
    getInstance: (usb: WebUSBManager) => FirehoseProtocol;
    /** Configure Firehose session */
    configure: (usb: WebUSBManager, config?: Partial<FirehoseConfig>) => Promise<FirehoseResponse>;
    /** Read partition table from all LUNs and sync with store */
    readPartitionTable: (usb: WebUSBManager) => Promise<{ success: boolean; partitions?: PartitionInfo[]; error?: string }>;
    /** Read/backup a partition with progress */
    readPartition: (
        usb: WebUSBManager,
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        onProgress?: (percent: number) => void
    ) => Promise<{ success: boolean; data?: Uint8Array; error?: string }>;
    /** Write/flash a partition with progress */
    writePartition: (
        usb: WebUSBManager,
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        data: Uint8Array,
        onProgress?: (percent: number) => void
    ) => Promise<{ success: boolean; bytesWritten: number; error?: string }>;
    /** Write/flash using chunked streaming (best for large partitions like super) */
    writePartitionChunked: (
        usb: WebUSBManager,
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        file: Blob,
        onProgress?: (percent: number) => void,
        spoofLabel?: string,
        spoofFilename?: string
    ) => Promise<{ success: boolean; bytesWritten: number; error?: string }>;
    /** Stream partition directly to file (memory efficient for large files) */
    readPartitionStreamToFile: (
        usb: WebUSBManager,
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        fileHandle: FileSystemFileHandle,
        onProgress?: (percent: number) => void
    ) => Promise<{ success: boolean; bytesWritten: number; error?: string }>;
    /** Reset the Firehose instance */
    reset: () => void;
}

/**
 * React hook wrapping FirehoseProtocol for partition operations.
 * 
 * Features:
 * - Singleton pattern per WebUSBManager instance
 * - Automatic state sync with partitionStore and flashStore
 * - Terminal logging for all operations
 * - Progress tracking via flashStore
 * 
 * @example
 * ```tsx
 * const { configure, readPartitionTable } = useFirehose();
 * const { getManager } = useWebUSB();
 * 
 * const handleReadPartitions = async () => {
 *   const usb = getManager();
 *   await configure(usb);
 *   const result = await readPartitionTable(usb);
 *   if (result.success) {
 *     console.log('Found partitions:', result.partitions);
 *   }
 * };
 * ```
 */
export function useFirehose(): UseFirehoseReturn {

    // Store connections for state sync
    const setPartitions = usePartitionStore((state) => state.setPartitions);
    const setPartitionsLoading = usePartitionStore((state) => state.setLoading);
    const setFlashStatus = useFlashStore((state) => state.setStatus);
    const setProgress = useFlashStore((state) => state.setProgress);
    const setCurrentPartition = useFlashStore((state) => state.setCurrentPartition);
    const setFlashError = useFlashStore((state) => state.setError);
    const log = useTerminalStore((state) => state.log);

    /**
     * Create a logger function for FirehoseProtocol.
     */
    const createLogger = useCallback(() => {
        return (message: string, level?: 'info' | 'debug' | 'error' | 'success') => {
            // Map 'debug' to 'info' for terminal store
            const terminalLevel = level === 'debug' ? 'info' : level || 'info';
            log(terminalLevel, message);
        };
    }, [log]);

    /**
     * Get or create the FirehoseProtocol instance.
     * Reuses existing instance to preserve state (isConfigured flag).
     */
    const getInstance = useCallback((usb: WebUSBManager): FirehoseProtocol => {
        // Only create new instance if we don't have one yet
        // Don't check USB reference equality because it can change on re-render
        if (!firehoseSingleton) {
            firehoseSingleton = new FirehoseProtocol(usb, createLogger());
            currentUsbSingleton = usb;
        }
        return firehoseSingleton;
    }, [createLogger]);

    /**
     * Configure Firehose session.
     */
    const configure = useCallback(async (
        usb: WebUSBManager,
        config?: Partial<FirehoseConfig>
    ): Promise<FirehoseResponse> => {
        const firehose = getInstance(usb);
        log('info', 'Configuring Firehose session...');

        try {
            const response = await firehose.configure(config);
            if (response.success) {
                log('success', 'Firehose configured successfully');
            } else {
                log('error', `Firehose configuration failed: ${response.error}`);
            }
            return response;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Firehose configure error: ${errorMessage}`);
            throw error;
        }
    }, [getInstance, log]);

    /**
     * Read partition table from all LUNs.
     */
    const readPartitionTable = useCallback(async (
        usb: WebUSBManager
    ): Promise<{ success: boolean; partitions?: PartitionInfo[]; error?: string }> => {
        const firehose = getInstance(usb);
        log('info', 'Reading partition table...');
        setPartitionsLoading(true);

        try {
            const result = await firehose.getAllPartitions();

            if (result.success && result.partitions) {
                setPartitions(result.partitions);
                log('success', `Found ${result.partitions.length} partitions`);
            } else {
                log('error', `Failed to read partitions: ${result.error}`);
            }

            setPartitionsLoading(false);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Read partition table error: ${errorMessage}`);
            setPartitionsLoading(false);
            return { success: false, error: errorMessage };
        }
    }, [getInstance, log, setPartitions, setPartitionsLoading]);

    /**
     * Read/backup a partition with progress tracking.
     */
    const readPartition = useCallback(async (
        usb: WebUSBManager,
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        onProgress?: (percent: number) => void
    ): Promise<{ success: boolean; data?: Uint8Array; error?: string }> => {
        const firehose = getInstance(usb);
        log('info', `Reading partition: ${partitionName}`);
        setFlashStatus('flashing');
        setCurrentPartition(partitionName);
        setProgress(0);

        try {
            const progressHandler = (percent: number) => {
                setProgress(percent);
                onProgress?.(percent);
            };

            const result = await firehose.readPartition(
                lun,
                startSector,
                numSectors,
                partitionName,
                progressHandler
            );

            if (result.success) {
                log('success', `Partition ${partitionName} read successfully`);
                setFlashStatus('success');
            } else {
                log('error', `Failed to read ${partitionName}: ${result.error}`);
                setFlashStatus('error');
            }

            setCurrentPartition(null);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Read partition error: ${errorMessage}`);
            setFlashStatus('error');
            setFlashError({
                code: 'READ_PARTITION_ERROR',
                message: `Failed to read ${partitionName}`,
                details: errorMessage,
                recoverable: true,
            });
            setCurrentPartition(null);
            return { success: false, error: errorMessage };
        }
    }, [getInstance, log, setFlashStatus, setCurrentPartition, setProgress, setFlashError]);

    /**
     * Write/flash a partition with progress tracking.
     */
    const writePartition = useCallback(async (
        usb: WebUSBManager,
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        data: Uint8Array,
        onProgress?: (percent: number) => void
    ): Promise<{ success: boolean; bytesWritten: number; error?: string }> => {
        const firehose = getInstance(usb);
        log('info', `Writing partition: ${partitionName}`);
        setFlashStatus('flashing');
        setCurrentPartition(partitionName);
        setProgress(0);

        try {
            const progressHandler = (percent: number) => {
                setProgress(percent);
                onProgress?.(percent);
            };

            const result = await firehose.writePartition(
                lun,
                startSector,
                numSectors,
                partitionName,
                data,
                progressHandler
            );

            if (result.success) {
                log('success', `Partition ${partitionName} written successfully (${result.bytesWritten} bytes)`);
                setFlashStatus('success');
            } else {
                log('error', `Failed to write ${partitionName}: ${result.error}`);
                setFlashStatus('error');
            }

            setCurrentPartition(null);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Write partition error: ${errorMessage}`);
            setFlashStatus('error');
            setFlashError({
                code: 'WRITE_PARTITION_ERROR',
                message: `Failed to write ${partitionName}`,
                details: errorMessage,
                recoverable: true,
            });
            setCurrentPartition(null);
            return { success: false, bytesWritten: 0, error: errorMessage };
        }
    }, [getInstance, log, setFlashStatus, setCurrentPartition, setProgress, setFlashError]);

    /**
     * Write/flash a partition using chunked streaming (best for large partitions).
     */
    const writePartitionChunked = useCallback(async (
        usb: WebUSBManager,
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        file: Blob,
        onProgress?: (percent: number) => void,
        spoofLabel?: string,
        spoofFilename?: string
    ): Promise<{ success: boolean; bytesWritten: number; error?: string }> => {
        const firehose = getInstance(usb);
        log('info', `Chunked flash: ${partitionName}`);
        setFlashStatus('flashing');
        setCurrentPartition(partitionName);
        setProgress(0);

        try {
            const progressHandler = (percent: number) => {
                setProgress(percent);
                onProgress?.(percent);
            };

            // Cast Blob to File since writePartitionChunked expects File (for slice)
            // In browser Blob and File are compatible for slice/size
            const result = await firehose.writePartitionChunked(
                lun,
                startSector,
                numSectors,
                partitionName,
                file as File,
                progressHandler,
                undefined, // chunkProgress
                undefined, // filename
                true,      // partofsingleimage
                spoofLabel,
                spoofFilename
            );

            if (result.success) {
                log('success', `Partition ${partitionName} flashed successfully (${result.bytesWritten} bytes)`);
                setFlashStatus('success');
            } else {
                log('error', `Failed to flash ${partitionName}: ${result.error}`);
                setFlashStatus('error');
            }

            setCurrentPartition(null);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Chunked flash error: ${errorMessage}`);
            setFlashStatus('error');
            setFlashError({
                code: 'WRITE_PARTITION_ERROR',
                message: `Failed to flash ${partitionName}`,
                details: errorMessage,
                recoverable: true,
            });
            setCurrentPartition(null);
            return { success: false, bytesWritten: 0, error: errorMessage };
        }
    }, [getInstance, log, setFlashStatus, setCurrentPartition, setProgress, setFlashError]);

    /**
     * Read/backup a partition scaling directly to file.
     */
    const readPartitionStreamToFile = useCallback(async (
        usb: WebUSBManager,
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        fileHandle: FileSystemFileHandle,
        onProgress?: (percent: number) => void
    ): Promise<{ success: boolean; bytesWritten: number; error?: string }> => {
        const firehose = getInstance(usb);
        log('info', `Streaming partition: ${partitionName}`);
        setFlashStatus('flashing');
        setCurrentPartition(partitionName);
        setProgress(0);

        try {
            const progressHandler = (percent: number) => {
                setProgress(percent);
                onProgress?.(percent);
            };

            const result = await firehose.readPartitionStreamToFile(
                lun,
                startSector,
                numSectors,
                partitionName,
                fileHandle,
                progressHandler
            );

            if (result.success) {
                log('success', `Partition ${partitionName} streamed successfully (${result.bytesWritten} bytes)`);
                setFlashStatus('success');
            } else {
                log('error', `Failed to stream ${partitionName}: ${result.error}`);
                setFlashStatus('error');
            }

            setCurrentPartition(null);
            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Stream partition error: ${errorMessage}`);
            setFlashStatus('error');
            setFlashError({
                code: 'READ_PARTITION_ERROR',
                message: `Failed to stream ${partitionName}`,
                details: errorMessage,
                recoverable: true,
            });
            setCurrentPartition(null);
            return { success: false, bytesWritten: 0, error: errorMessage };
        }
    }, [getInstance, log, setFlashStatus, setCurrentPartition, setProgress, setFlashError]);

    /**
     * Reset the Firehose instance.
     */
    const reset = useCallback(() => {
        firehoseSingleton = null;
        currentUsbSingleton = null;
    }, []);

    return {
        getInstance,
        configure,
        readPartitionTable,
        readPartition,
        readPartitionStreamToFile,
        writePartition,
        writePartitionChunked,
        reset,
    };
}
