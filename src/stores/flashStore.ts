/**
 * Q-Flash-Web Flash Store
 * 
 * Manages flash/backup operation progress and status.
 * Uses Zustand for lightweight state management.
 */

import { create } from 'zustand';

/**
 * Flash operation status type.
 */
export type FlashStatus =
    | 'idle'
    | 'preparing'
    | 'connecting'
    | 'authenticating'
    | 'flashing'
    | 'completing'
    | 'success'
    | 'error';

/**
 * Partition status type for backup/flash operations.
 */
export type PartitionStatus = 'pending' | 'in-progress' | 'done' | 'error';

/**
 * Backup operation status type.
 */
export type BackupStatus =
    | 'idle'
    | 'preparing'
    | 'backing-up'
    | 'success'
    | 'error'
    | 'cancelled';

/**
 * Application error interface.
 */
export interface AppError {
    code: string;
    message: string;
    details?: string;
    recoverable: boolean;
}

/**
 * Flash store state interface.
 */
export interface FlashState {
    // Flash state
    status: FlashStatus;
    currentPartition: string | null;
    progress: number; // 0-100
    bytesWritten: number;
    totalBytes: number;
    error: AppError | null;

    // Flash write operation state (for writing to device)
    flashWriteStatus: 'idle' | 'preparing' | 'flashing' | 'success' | 'error' | 'cancelled';
    currentFlashPartition: string | null;
    flashProgress: number; // 0-100
    flashBytesWritten: number;
    flashTotalBytes: number;
    flashPartitionStatuses: Map<string, PartitionStatus>;
    flashError: AppError | null;
    flashStartTime: number | null;
    flashETA: number | null; // seconds remaining
    lastUpdateTimestamp: number;
    lastBytesWrittenEntry: number;
    smoothedSpeed: number; // bytes per second
    rebootCallback: (() => Promise<void>) | null; // Stored callback for user-triggered reboot

    // Backup state
    backupStatus: BackupStatus;
    currentBackupPartition: string | null;
    backupProgress: number; // 0-100
    backupBytesWritten: number;
    backupTotalBytes: number;
    backupPartitionStatuses: Map<string, PartitionStatus>;
    backupError: AppError | null;
    backupSavePath: string | null;
    backupStartTime: number | null;
    backupETA: number | null;
    backupLastUpdateTimestamp: number;
    backupLastBytesWrittenEntry: number;
    backupSmoothedSpeed: number;

    // Flash actions
    setStatus: (status: FlashStatus) => void;
    setProgress: (progress: number, bytesWritten?: number, totalBytes?: number) => void;
    setCurrentPartition: (partition: string | null) => void;
    setError: (error: AppError | null) => void;
    reset: () => void;

    // Flash write actions
    startFlashWrite: (partitions: string[], totalBytes: number) => void;
    updateFlashWriteProgress: (partition: string, bytesWritten: number, totalBytes: number) => void;
    setFlashWritePartitionStatus: (partition: string, status: PartitionStatus) => void;
    completeFlashWrite: () => void;
    cancelFlashWrite: () => void;
    setFlashWriteError: (error: AppError | null) => void;
    resetFlashWrite: () => void;
    setRebootCallback: (callback: (() => Promise<void>) | null) => void;
    executeReboot: () => Promise<void>;

    // Backup actions
    startBackup: (partitions: string[], savePath: string, totalBytes: number) => void;
    updateBackupProgress: (partition: string, bytesWritten: number, totalBytes: number) => void;
    setBackupPartitionStatus: (partition: string, status: PartitionStatus) => void;
    completeBackup: () => void;
    cancelBackup: () => void;
    resetBackup: () => void;
}

/**
 * Initial state for flash store.
 */
const initialState = {
    // Flash initial state
    status: 'idle' as FlashStatus,
    currentPartition: null,
    progress: 0,
    bytesWritten: 0,
    totalBytes: 0,
    error: null,

    // Flash write operation initial state
    flashWriteStatus: 'idle' as const,
    currentFlashPartition: null as string | null,
    flashProgress: 0,
    flashBytesWritten: 0,
    flashTotalBytes: 0,
    flashPartitionStatuses: new Map<string, PartitionStatus>(),
    flashError: null as AppError | null,
    flashStartTime: null as number | null,
    flashETA: null as number | null,
    lastUpdateTimestamp: 0,
    lastBytesWrittenEntry: 0,
    smoothedSpeed: 0,
    rebootCallback: null as (() => Promise<void>) | null,

    // Backup initial state
    backupStatus: 'idle' as BackupStatus,
    currentBackupPartition: null,
    backupProgress: 0,
    backupBytesWritten: 0,
    backupTotalBytes: 0,
    backupPartitionStatuses: new Map<string, PartitionStatus>(),
    backupError: null,
    backupSavePath: null,
    backupStartTime: null as number | null,
    backupETA: null as number | null,
    backupLastUpdateTimestamp: 0,
    backupLastBytesWrittenEntry: 0,
    backupSmoothedSpeed: 0,
};

/**
 * Flash store hook.
 * Manages flash/backup operation progress and status.
 */
export const useFlashStore = create<FlashState>()((set, get) => ({
    // Initial state
    ...initialState,

    // Flash actions
    setStatus: (status) => set({ status }),

    setProgress: (progress, bytesWritten, totalBytes) => set((state) => ({
        progress,
        bytesWritten: bytesWritten ?? state.bytesWritten,
        totalBytes: totalBytes ?? state.totalBytes,
    })),

    setCurrentPartition: (partition) => set({ currentPartition: partition }),

    setError: (error) => set({
        error,
        status: error ? 'error' : 'idle'
    }),

    reset: () => set({
        status: 'idle' as FlashStatus,
        currentPartition: null,
        progress: 0,
        bytesWritten: 0,
        totalBytes: 0,
        error: null,
    }),

    // Flash write actions
    startFlashWrite: (partitions, totalBytes) => {
        const statuses = new Map<string, PartitionStatus>();
        partitions.forEach(p => statuses.set(p, 'pending'));

        set({
            flashWriteStatus: 'flashing',
            flashPartitionStatuses: statuses,
            flashTotalBytes: totalBytes,
            flashProgress: 0,
            flashBytesWritten: 0,
            flashError: null,
            currentFlashPartition: null,
            flashStartTime: Date.now(),
            flashETA: null,
            lastUpdateTimestamp: Date.now(),
            lastBytesWrittenEntry: 0,
            smoothedSpeed: 0,
        });
    },

    updateFlashWriteProgress: (partition, bytesWritten, totalBytes) => {
        const { flashTotalBytes, lastUpdateTimestamp, lastBytesWrittenEntry, smoothedSpeed } = get();
        const now = Date.now();

        // Calculate overall progress based on total bytes across all partitions
        const overallProgress = flashTotalBytes > 0
            ? Math.min(100, Math.floor((bytesWritten / flashTotalBytes) * 100))
            : 0;

        // Calculate simplified moving average ETA
        // We calculate speed based on the delta since last update
        let newSmoothedSpeed = smoothedSpeed;
        let eta = get().flashETA;

        const timeDelta = (now - lastUpdateTimestamp) / 1000; // seconds

        // Only update speed if enough time has passed (e.g. > 0.5s) to avoid jitter
        // or if it's the first significant update
        if (timeDelta > 0.5 || (smoothedSpeed === 0 && bytesWritten > 0)) {
            const bytesDelta = bytesWritten - lastBytesWrittenEntry;

            if (bytesDelta > 0 && timeDelta > 0) {
                const instantSpeed = bytesDelta / timeDelta;

                if (smoothedSpeed === 0) {
                    newSmoothedSpeed = instantSpeed;
                } else {
                    // Exponential Moving Average (EMA)
                    // NewSpeed = alpha * InstantSpeed + (1 - alpha) * OldSpeed
                    // alpha = 0.3 means 30% weight to new sample (responsive but smooth)
                    const alpha = 0.3;
                    newSmoothedSpeed = (alpha * instantSpeed) + ((1 - alpha) * smoothedSpeed);
                }

                if (newSmoothedSpeed > 0) {
                    const remainingBytes = flashTotalBytes - bytesWritten;
                    eta = Math.ceil(remainingBytes / newSmoothedSpeed);
                }
            }
            // Update timestamp/bytes only when we recalculated speed
            set({
                lastUpdateTimestamp: now,
                lastBytesWrittenEntry: bytesWritten
            });
        }

        set({
            currentFlashPartition: partition,
            flashBytesWritten: bytesWritten,
            flashProgress: overallProgress,
            flashETA: eta,
            smoothedSpeed: newSmoothedSpeed
        });
    },

    setFlashWritePartitionStatus: (partition, status) => {
        const { flashPartitionStatuses } = get();
        const newStatuses = new Map(flashPartitionStatuses);
        newStatuses.set(partition, status);

        set({ flashPartitionStatuses: newStatuses });
    },

    completeFlashWrite: () => set({ flashWriteStatus: 'success' }),

    cancelFlashWrite: () => set({ flashWriteStatus: 'cancelled' }),

    setFlashWriteError: (error) => set({
        flashWriteStatus: 'error',
        flashError: error
    }),

    resetFlashWrite: () => set({
        flashWriteStatus: 'idle',
        currentFlashPartition: null,
        flashProgress: 0,
        flashBytesWritten: 0,
        flashTotalBytes: 0,
        flashPartitionStatuses: new Map(),
        flashError: null,
        flashStartTime: null,
        flashETA: null,
        lastUpdateTimestamp: 0,
        lastBytesWrittenEntry: 0,
        smoothedSpeed: 0,
        rebootCallback: null,
    }),

    setRebootCallback: (callback) => set({ rebootCallback: callback }),

    executeReboot: async () => {
        const { rebootCallback } = get();
        if (rebootCallback) {
            await rebootCallback();
            set({ rebootCallback: null });
        }
    },

    // Backup actions
    startBackup: (partitions, savePath, totalBytes) => {
        const statuses = new Map<string, PartitionStatus>();
        partitions.forEach(p => statuses.set(p, 'pending'));

        set({
            backupStatus: 'backing-up',
            backupPartitionStatuses: statuses,
            backupSavePath: savePath,
            backupProgress: 0,
            backupBytesWritten: 0,
            backupTotalBytes: totalBytes,
            backupError: null,
            currentBackupPartition: null,
            backupStartTime: Date.now(),
            backupETA: null,
            backupLastUpdateTimestamp: Date.now(),
            backupLastBytesWrittenEntry: 0,
            backupSmoothedSpeed: 0,
        });
    },

    updateBackupProgress: (partition, bytesWritten, totalBytes) => {
        const { backupTotalBytes, backupLastUpdateTimestamp, backupLastBytesWrittenEntry, backupSmoothedSpeed } = get();
        const now = Date.now();

        const overallProgress = backupTotalBytes > 0
            ? Math.floor((bytesWritten / backupTotalBytes) * 100)
            : 0;

        // Calculate simplified moving average ETA
        let newSmoothedSpeed = backupSmoothedSpeed;
        let eta = get().backupETA;

        const timeDelta = (now - backupLastUpdateTimestamp) / 1000; // seconds

        if (timeDelta > 0.5 || (backupSmoothedSpeed === 0 && bytesWritten > 0)) {
            const bytesDelta = bytesWritten - backupLastBytesWrittenEntry;

            if (bytesDelta > 0 && timeDelta > 0) {
                const instantSpeed = bytesDelta / timeDelta;

                if (backupSmoothedSpeed === 0) {
                    newSmoothedSpeed = instantSpeed;
                } else {
                    const alpha = 0.3;
                    newSmoothedSpeed = (alpha * instantSpeed) + ((1 - alpha) * backupSmoothedSpeed);
                }

                if (newSmoothedSpeed > 0) {
                    const remainingBytes = backupTotalBytes - bytesWritten;
                    eta = Math.ceil(remainingBytes / newSmoothedSpeed);
                }
            }
            // Update timestamp/bytes only when we recalculated speed
            set({
                backupLastUpdateTimestamp: now,
                backupLastBytesWrittenEntry: bytesWritten
            });
        }

        set({
            currentBackupPartition: partition,
            backupBytesWritten: bytesWritten,
            backupProgress: overallProgress,
            backupETA: eta,
            backupSmoothedSpeed: newSmoothedSpeed
        });
    },

    setBackupPartitionStatus: (partition, status) => {
        const { backupPartitionStatuses } = get();
        const newStatuses = new Map(backupPartitionStatuses);
        newStatuses.set(partition, status);

        set({ backupPartitionStatuses: newStatuses });
    },

    completeBackup: () => set({ backupStatus: 'success' }),

    cancelBackup: () => set({ backupStatus: 'cancelled' }),

    resetBackup: () => set({
        backupStatus: 'idle',
        currentBackupPartition: null,
        backupProgress: 0,
        backupBytesWritten: 0,
        backupTotalBytes: 0,
        backupPartitionStatuses: new Map(),
        backupError: null,
        backupSavePath: null,
        backupStartTime: null,
        backupETA: null,
        backupLastUpdateTimestamp: 0,
        backupLastBytesWrittenEntry: 0,
        backupSmoothedSpeed: 0,
    }),
}));
