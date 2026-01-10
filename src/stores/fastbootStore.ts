/**
 * Q-Flash-Web Fastboot Store
 *
 * Manages Fastboot device state, connection status, and flash progress.
 * Uses Zustand for lightweight state management with persist middleware.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FastbootDeviceInfo } from '@/core/FastbootProtocol';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Flash progress state
 */
export interface FastbootFlashProgress {
    partition: string;
    progress: number;
    transferred?: number;
    total?: number;
}

/**
 * Fastboot store state interface
 */
export interface FastbootState {
    // Device state
    deviceInfo: FastbootDeviceInfo | null;
    isConnecting: boolean;
    flashProgress: FastbootFlashProgress | null;
    pendingOperation: string | null;
    manuallyDisconnected: boolean; // Flag to prevent auto-reconnect after manual disconnect

    // Actions
    setDeviceInfo: (info: FastbootDeviceInfo | null) => void;
    setConnecting: (connecting: boolean) => void;
    setFlashProgress: (progress: FastbootFlashProgress | null) => void;
    setPendingOperation: (op: string | null) => void;
    setManuallyDisconnected: (disconnected: boolean) => void;
    reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
    deviceInfo: null,
    isConnecting: false,
    flashProgress: null,
    pendingOperation: null,
    manuallyDisconnected: false,
};

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Fastboot store hook.
 * Manages Fastboot device state, connection, and flash progress.
 * State persists in memory (not localStorage) to survive navigation within session.
 */
export const useFastbootStore = create<FastbootState>()(
    persist(
        (set) => ({
            // Initial state
            ...initialState,

            // Actions
            setDeviceInfo: (info) => set({ deviceInfo: info }),

            setConnecting: (connecting) => set({ isConnecting: connecting }),

            setFlashProgress: (progress) => set({ flashProgress: progress }),

            setPendingOperation: (op) => set({ pendingOperation: op }),

            setManuallyDisconnected: (disconnected) => set({ manuallyDisconnected: disconnected }),

            reset: () => set({
                ...initialState,
            }),
        }),
        {
            name: 'q-flash-fastboot-state',
            // Only persist certain fields (not transient state)
            partialize: (state) => ({
                deviceInfo: state.deviceInfo,
                manuallyDisconnected: state.manuallyDisconnected,
                // Don't persist: isConnecting, flashProgress, pendingOperation
            }),
        }
    )
);
