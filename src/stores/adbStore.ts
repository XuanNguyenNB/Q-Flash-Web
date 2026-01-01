/**
 * Q-Flash-Web ADB Store
 * 
 * Manages ADB device state and pending operations.
 * Uses Zustand for lightweight state management.
 */

import { create } from 'zustand';
import type { ADBDeviceInfo } from '@/core/ADBProtocol';

/**
 * ADB store state interface.
 */
export interface ADBState {
    // State
    deviceInfo: ADBDeviceInfo | null;
    isConnecting: boolean;
    isDeviceReady: boolean; // NEW: Tracks if device is ready for complex operations (scrcpy, etc)
    pendingOperation: string | null;
    operationProgress: number | null;

    // Actions
    setDeviceInfo: (info: ADBDeviceInfo | null) => void;
    setConnecting: (connecting: boolean) => void;
    setDeviceReady: (ready: boolean) => void; // NEW: Set device readiness
    setPendingOperation: (op: string | null) => void;
    setOperationProgress: (progress: number | null) => void;
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
};

/**
 * ADB store hook.
 * Manages ADB device info, connection state, and pending operations.
 */
export const useADBStore = create<ADBState>()((set) => ({
    // Initial state
    ...initialState,

    // Actions
    setDeviceInfo: (info) => set({ deviceInfo: info }),

    setConnecting: (connecting) => set({ isConnecting: connecting }),

    setDeviceReady: (ready) => set({ isDeviceReady: ready }),

    setPendingOperation: (op) => set({ pendingOperation: op }),

    setOperationProgress: (progress) => set({ operationProgress: progress }),

    reset: () => set(initialState),
}));
