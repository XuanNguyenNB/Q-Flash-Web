/**
 * EDL Connection Store
 *
 * Zustand store to persist EDL connection state across navigation.
 * This solves the problem of losing connection status when navigating
 * between pages.
 */

import { create } from 'zustand';
import type { ConnectionFlowState, ConnectionError } from '@/hooks/useConnectionFlow';

export type BrandGroup = 'oppo' | 'lg';

interface ManualFirehoseFiles {
    programmer: { data: ArrayBuffer; size: number } | null;
    digest: { data: ArrayBuffer; size: number } | null;
    signature: { data: ArrayBuffer; size: number } | null;
}

interface EDLConnectionState {
    /** Current connection flow state */
    status: ConnectionFlowState;
    /** Error object if status is 'error' */
    error: ConnectionError | null;
    /** Selected brand group (persists across tab switches) */
    selectedBrandGroup: BrandGroup;
    /** Manually loaded firehose files (persists across tab switches) */
    manualFirehoseFiles: ManualFirehoseFiles;
    /** Firehose loaded flag (persists across tab switches) */
    firehoseLoaded: boolean;
    /** Set connection status */
    setStatus: (status: ConnectionFlowState) => void;
    /** Set error */
    setError: (error: ConnectionError | null) => void;
    /** Set selected brand group */
    setSelectedBrandGroup: (group: BrandGroup) => void;
    /** Set manual firehose file */
    setManualFirehoseFile: (fileType: 'programmer' | 'digest' | 'signature', data: ArrayBuffer, size: number) => void;
    /** Clear manual firehose files */
    clearManualFirehoseFiles: () => void;
    /** Set firehose loaded flag */
    setFirehoseLoaded: (loaded: boolean) => void;
    /** Reset to idle state */
    reset: () => void;
}

/**
 * EDL Connection Store
 *
 * Persists EDL connection state in memory (not localStorage).
 * State survives navigation but resets on page refresh (which is desired
 * since USB connections don't persist across refreshes).
 */
export const useEDLConnectionStore = create<EDLConnectionState>((set) => ({
    status: 'idle',
    error: null,
    selectedBrandGroup: 'oppo',
    firehoseLoaded: false,
    manualFirehoseFiles: {
        programmer: null,
        digest: null,
        signature: null,
    },

    setStatus: (status) => set({ status }),

    setError: (error) => set({ error }),

    setSelectedBrandGroup: (group) => set({ selectedBrandGroup: group }),

    setManualFirehoseFile: (fileType, data, size) => set((state) => ({
        manualFirehoseFiles: {
            ...state.manualFirehoseFiles,
            [fileType]: { data, size },
        },
    })),

    clearManualFirehoseFiles: () => set({
        firehoseLoaded: false,
        manualFirehoseFiles: {
            programmer: null,
            digest: null,
            signature: null,
        },
    }),

    setFirehoseLoaded: (loaded) => set({ firehoseLoaded: loaded }),

    reset: () => set({ status: 'idle', error: null, firehoseLoaded: false }),
}));
