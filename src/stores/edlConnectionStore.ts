/**
 * EDL Connection Store
 * 
 * Zustand store to persist EDL connection state across navigation.
 * This solves the problem of losing connection status when navigating
 * between pages.
 */

import { create } from 'zustand';
import type { ConnectionFlowState, ConnectionError } from '@/hooks/useConnectionFlow';

interface EDLConnectionState {
    /** Current connection flow state */
    status: ConnectionFlowState;
    /** Error object if status is 'error' */
    error: ConnectionError | null;
    /** Set connection status */
    setStatus: (status: ConnectionFlowState) => void;
    /** Set error */
    setError: (error: ConnectionError | null) => void;
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

    setStatus: (status) => set({ status }),

    setError: (error) => set({ error }),

    reset: () => set({ status: 'idle', error: null }),
}));
