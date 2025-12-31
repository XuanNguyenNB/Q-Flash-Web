/**
 * Q-Flash-Web Fastboot Store
 * 
 * Manages Fastboot device state, connection status, and flash progress.
 * Uses Zustand for lightweight state management.
 */

import { create } from 'zustand';
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

    // Actions
    setDeviceInfo: (info: FastbootDeviceInfo | null) => void;
    setConnecting: (connecting: boolean) => void;
    setFlashProgress: (progress: FastbootFlashProgress | null) => void;
    setPendingOperation: (op: string | null) => void;
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
};

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Fastboot store hook.
 * Manages Fastboot device state, connection, and flash progress.
 */
export const useFastbootStore = create<FastbootState>()((set) => ({
    // Initial state
    ...initialState,

    // Actions
    setDeviceInfo: (info) => set({ deviceInfo: info }),

    setConnecting: (connecting) => set({ isConnecting: connecting }),

    setFlashProgress: (progress) => set({ flashProgress: progress }),

    setPendingOperation: (op) => set({ pendingOperation: op }),

    reset: () => set({
        ...initialState,
    }),
}));
