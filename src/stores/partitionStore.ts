/**
 * Q-Flash-Web Partition Store
 * 
 * Manages partition data, selection state, and filtering.
 * Uses Zustand for lightweight state management.
 * 
 * Updated: Story 4.6 - Added ROM mapping support
 */

import { create } from 'zustand';
import type { PartitionInfo } from '@/types';
import type { RomPartitionEntry } from '@/hooks/useRomLoader';

/**
 * Partition store state interface.
 */
export interface PartitionState {
    // State
    partitions: PartitionInfo[];
    selectedPartitions: Set<string>;
    searchFilter: string;
    isLoading: boolean;
    romMapping: Map<string, RomPartitionEntry>; // Maps partition name to ROM entry

    // Actions
    setPartitions: (partitions: PartitionInfo[]) => void;
    toggleSelection: (name: string) => void;
    selectAll: () => void;
    deselectAll: () => void;
    setSearchFilter: (filter: string) => void;
    clearSearchFilter: () => void;
    setLoading: (loading: boolean) => void;
    setRomMapping: (entries: RomPartitionEntry[]) => void;
    clearRomMapping: () => void;
    selectAvailableRomPartitions: () => void;
    reset: () => void;

    // Computed selectors
    filteredPartitions: () => PartitionInfo[];
    getRomEntry: (partitionName: string) => RomPartitionEntry | undefined;
    hasRomMapping: () => boolean;
}

/**
 * Initial state for partition store.
 */
const initialState = {
    partitions: [] as PartitionInfo[],
    selectedPartitions: new Set<string>(),
    searchFilter: '',
    isLoading: false,
    romMapping: new Map<string, RomPartitionEntry>(),
};

/**
 * Partition store hook.
 * Manages partition data and selection for backup/flash operations.
 */
export const usePartitionStore = create<PartitionState>()((set, get) => ({
    // Initial state
    ...initialState,

    // Actions
    setPartitions: (partitions) => set({ partitions }),

    toggleSelection: (name) => set((state) => {
        const newSelected = new Set(state.selectedPartitions);
        if (newSelected.has(name)) {
            newSelected.delete(name);
        } else {
            newSelected.add(name);
        }
        return { selectedPartitions: newSelected };
    }),

    selectAll: () => set((state) => {
        const allNames = state.partitions.map((p) => p.name);
        return { selectedPartitions: new Set(allNames) };
    }),

    deselectAll: () => set({ selectedPartitions: new Set<string>() }),

    setSearchFilter: (filter) => set({ searchFilter: filter }),

    clearSearchFilter: () => set({ searchFilter: '' }),

    setLoading: (loading) => set({ isLoading: loading }),

    setRomMapping: (entries) => set(() => {
        const mapping = new Map<string, RomPartitionEntry>();
        for (const entry of entries) {
            // Map by FILENAME (without extension) to avoid duplicate label issues
            // E.g. both misc.img and gpt_backup3.bin may have label="BackupGPT"
            const filenameWithoutExt = entry.filename.replace(/\.[^.]+$/, ''); // Remove extension

            // Primary mapping: filename basename
            mapping.set(filenameWithoutExt.toLowerCase(), entry);

            // Secondary mapping: also map by label for backward compatibility
            if (!mapping.has(entry.label.toLowerCase())) {
                mapping.set(entry.label.toLowerCase(), entry);
            }

            // Handle _a/_b suffixes
            const baseName = filenameWithoutExt.replace(/_[ab]$/i, '');
            if (baseName !== filenameWithoutExt && !mapping.has(baseName.toLowerCase())) {
                mapping.set(baseName.toLowerCase(), entry);
            }
        }
        return { romMapping: mapping };
    }),

    clearRomMapping: () => set({ romMapping: new Map<string, RomPartitionEntry>() }),

    reset: () => set({
        ...initialState,
        selectedPartitions: new Set<string>(),
        romMapping: new Map<string, RomPartitionEntry>(),
    }),

    // Computed selector for filtered partitions
    filteredPartitions: () => {
        const { partitions, searchFilter } = get();
        if (!searchFilter.trim()) return partitions;

        const lowerFilter = searchFilter.toLowerCase();
        return partitions.filter((partition) =>
            partition.name.toLowerCase().includes(lowerFilter)
        );
    },

    // Get ROM entry for a partition name
    getRomEntry: (partitionName) => {
        const { romMapping } = get();
        // Try exact match first
        const exact = romMapping.get(partitionName.toLowerCase());
        if (exact) return exact;
        // Try without _a/_b suffix
        const baseName = partitionName.replace(/_[ab]$/i, '');
        return romMapping.get(baseName.toLowerCase());
    },

    // Check if any ROM mapping exists
    hasRomMapping: () => {
        const { romMapping } = get();
        return romMapping.size > 0;
    },

    // Auto-select partitions that have valid ROM files
    selectAvailableRomPartitions: () => set((state) => {
        const newSelected = new Set<string>();
        const { romMapping } = state;

        for (const partition of state.partitions) {
            const pName = partition.name.toLowerCase();

            // 1. Try exact match
            let entry = romMapping.get(pName);

            // 2. Try stripping _a/_b suffix from device partition name
            // Example: Device has 'boot_a', ROM has 'boot'
            if (!entry) {
                const baseName = pName.replace(/_[ab]$/i, '');
                entry = romMapping.get(baseName);
            }

            // 3. Try handling implicit AB mapping if ROM has specific slot but device shows base? 
            // (Unlikely in current PartitionGrid context which shows actual partitions)

            // If entry found and file exists, select it
            // CRITICAL: specific partitions like 'persist' should NEVER be auto-selected
            if (entry && entry.exists) {
                // Skip sensitive partitions that should not be flashed automatically
                if (pName.includes('persist')) {
                    continue;
                }
                newSelected.add(partition.name);
            }
        }

        return { selectedPartitions: newSelected };
    }),
}));
