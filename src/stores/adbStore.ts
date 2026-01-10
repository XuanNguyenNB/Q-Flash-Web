/**
 * Q-Flash-Web ADB Store
 *
 * Manages ADB device state and pending operations.
 * Uses Zustand for lightweight state management with persist middleware.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ADBDeviceInfo } from '@/core/ADBProtocol';

/**
 * ADB store state interface.
 */
export interface ADBState {
    // State
    deviceInfo: ADBDeviceInfo | null;
    isConnecting: boolean;
    isDeviceReady: boolean; // Tracks if device is ready for complex operations (scrcpy, etc)
    pendingOperation: string | null;
    operationProgress: number | null;
    showDeviceInUseDialog: boolean; // Show dialog when device is in use by another program
    showUserGestureDialog: boolean; // Show dialog when user gesture is required
    showAuthorizationDialog: boolean; // Show dialog when waiting for USB debugging authorization

    // Actions
    setDeviceInfo: (info: ADBDeviceInfo | null) => void;
    setConnecting: (connecting: boolean) => void;
    setDeviceReady: (ready: boolean) => void;
    setPendingOperation: (op: string | null) => void;
    setOperationProgress: (progress: number | null) => void;
    setShowDeviceInUseDialog: (show: boolean) => void;
    setShowUserGestureDialog: (show: boolean) => void;
    setShowAuthorizationDialog: (show: boolean) => void;
    reset: () => void;
}

/**
 * Initial state for ADB store.
 */
const initialState = {
    deviceInfo: null,
    isConnecting: false,
    isDeviceReady: false,
    pendingOperation: null,
    operationProgress: null,
    showDeviceInUseDialog: false,
    showUserGestureDialog: false,
    showAuthorizationDialog: false,
};

/**
 * ADB store hook.
 * Manages ADB device info, connection state, and pending operations.
 * State persists in memory (not localStorage) to survive navigation within session.
 */
export const useADBStore = create<ADBState>()(
    persist(
        (set) => ({
            // Initial state
            ...initialState,

            // Actions
            setDeviceInfo: (info) => set({ deviceInfo: info }),

            setConnecting: (connecting) => set({ isConnecting: connecting }),

            setDeviceReady: (ready) => set({ isDeviceReady: ready }),

            setPendingOperation: (op) => set({ pendingOperation: op }),

            setOperationProgress: (progress) => set({ operationProgress: progress }),

            setShowDeviceInUseDialog: (show) => set({ showDeviceInUseDialog: show }),

            setShowUserGestureDialog: (show) => set({ showUserGestureDialog: show }),

            setShowAuthorizationDialog: (show) => set({ showAuthorizationDialog: show }),

            reset: () => set(initialState),
        }),
        {
            name: 'q-flash-adb-state',
            // Only persist certain fields (not dialogs or transient state)
            partialize: (state) => ({
                deviceInfo: state.deviceInfo,
                isDeviceReady: state.isDeviceReady,
                // Don't persist: isConnecting, pendingOperation, operationProgress, dialogs
            }),
        }
    )
);
