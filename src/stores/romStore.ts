/**
 * Q-Flash-Web ROM Store
 *
 * Manages ROM loading state, partition entries from rawprogram XML,
 * and provides computed selectors for valid/missing entries.
 *
 * Story: 4.6 - ROM File Loading
 */

import { create } from 'zustand';
import type { RomPartitionEntry, RomLoadResult, RomFile } from '@/hooks/useRomLoader';

/**
 * ROM store state interface
 */
export interface RomState {
    // State
    isLoading: boolean;
    progress: number; // 0-100
    romEntries: RomPartitionEntry[];
    patchFiles: RomFile[]; // New: Store patch files
    romDirectory: string | null;
    directoryHandle: FileSystemDirectoryHandle | null;
    totalSize: number;
    missingFiles: string[];
    loadTime: number;
    xmlFilesCount: number;
    error: string | null;

    // Actions
    setRomData: (result: RomLoadResult) => void;
    clearRom: () => void;
    setLoading: (loading: boolean) => void;
    setProgress: (progress: number) => void;
    setError: (error: string | null) => void;

    // Computed selectors
    getValidEntries: () => RomPartitionEntry[];
    getMissingEntries: () => RomPartitionEntry[];
    getRomSummary: () => RomSummary;
    hasRom: () => boolean;
    getEntryByLabel: (label: string) => RomPartitionEntry | undefined;
}

/**
 * ROM summary for UI display
 */
export interface RomSummary {
    directoryName: string | null;
    totalPartitions: number;
    validPartitions: number;
    missingPartitions: number;
    totalSize: number;
    totalSizeFormatted: string;
    loadTime: number;
    xmlFilesCount: number;
    patchFilesCount: number; // New
}

/**
 * Initial state for ROM store
 */
const initialState = {
    isLoading: false,
    progress: 0,
    romEntries: [] as RomPartitionEntry[],
    patchFiles: [] as RomFile[], // New
    romDirectory: null as string | null,
    directoryHandle: null as FileSystemDirectoryHandle | null,
    totalSize: 0,
    missingFiles: [] as string[],
    loadTime: 0,
    xmlFilesCount: 0,
    error: null as string | null,
};

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * ROM store hook
 * Manages ROM loading state and provides computed selectors.
 */
export const useRomStore = create<RomState>()((set, get) => ({
    // Initial state
    ...initialState,

    // Actions
    setRomData: (result) => set({
        romEntries: result.entries,
        patchFiles: result.patchFiles, // New
        romDirectory: result.directoryName,
        directoryHandle: result.directoryHandle,
        totalSize: result.totalSize,
        missingFiles: result.missingFiles,
        loadTime: result.loadTime,
        xmlFilesCount: result.xmlFilesCount,
        error: null,
        isLoading: false,
        progress: 100,
    }),

    clearRom: () => set({
        ...initialState,
    }),

    setLoading: (loading) => set({ isLoading: loading }),

    setProgress: (progress) => set({ progress }),

    setError: (error) => set({ error, isLoading: false }),

    // Computed selectors
    getValidEntries: () => {
        const { romEntries } = get();
        return romEntries.filter(entry => entry.exists);
    },

    getMissingEntries: () => {
        const { romEntries } = get();
        return romEntries.filter(entry => !entry.exists);
    },

    getRomSummary: () => {
        const { romEntries, patchFiles, romDirectory, totalSize, loadTime, xmlFilesCount } = get();
        const validPartitions = romEntries.filter(e => e.exists).length;
        const missingPartitions = romEntries.filter(e => !e.exists).length;

        return {
            directoryName: romDirectory,
            totalPartitions: romEntries.length,
            validPartitions,
            missingPartitions,
            totalSize,
            totalSizeFormatted: formatBytes(totalSize),
            loadTime,
            xmlFilesCount,
            patchFilesCount: patchFiles.length, // New
        };
    },

    hasRom: () => {
        const { romEntries, romDirectory } = get();
        return romDirectory !== null && romEntries.length > 0;
    },

    getEntryByLabel: (label) => {
        const { romEntries } = get();
        return romEntries.find(entry =>
            entry.label.toLowerCase() === label.toLowerCase()
        );
    },
}));
