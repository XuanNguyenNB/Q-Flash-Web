/**
 * Q-Flash-Web Device Store
 * 
 * Manages device selection, connection state, and mode selection.
 * Uses Zustand for lightweight state management with persist middleware.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Device mode type - EDL, ADB, or Fastboot
 */
export type DeviceMode = 'edl' | 'adb' | 'fastboot';

/**
 * Device profile interface representing a supported Qualcomm device.
 * Extends the device configuration with firehose URLs.
 */
export interface DeviceProfile {
    id: string;
    brand: string;
    name: string;
    codename?: string;
    chipset: string;
    chipsetName?: string;
    chipsetFolder: string;
    authMethod?: 'oppo_vip' | 'none';
    presetId?: string | null;
    firehoseUrls?: {
        programmer: string;
        digest?: string;
        signature?: string;
    };
    status: 'tested' | 'beta' | 'coming';
}

/**
 * Per-mode connection states to prevent cross-mode state leakage
 */
interface ModeConnectionStates {
    edl: boolean;
    adb: boolean;
    fastboot: boolean;
}

/**
 * Device store state interface.
 */
export interface DeviceState {
    // Mode state
    currentMode: DeviceMode;

    // Device state
    selectedDevice: DeviceProfile | null;
    isConnected: boolean;
    connectionError: string | null;
    firehoseLoaded: boolean;

    // Per-mode connection states
    modeConnections: ModeConnectionStates;

    // Mode actions
    setMode: (mode: DeviceMode) => void;

    // Device actions
    setDevice: (device: DeviceProfile | null) => void;
    setConnected: (connected: boolean) => void;
    setModeConnected: (mode: DeviceMode, connected: boolean) => void;
    setFirehoseLoaded: (loaded: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
}

/**
 * Initial state for device store.
 */
const initialState = {
    currentMode: 'edl' as DeviceMode,
    selectedDevice: null,
    isConnected: false,
    connectionError: null,
    firehoseLoaded: false,
    modeConnections: {
        edl: false,
        adb: false,
        fastboot: false,
    },
};

/**
 * Device store hook.
 * Manages device selection, connection status, firehose loading state, and mode.
 * Mode is persisted to localStorage.
 */
export const useDeviceStore = create<DeviceState>()(
    persist(
        (set, get) => ({
            // Initial state
            ...initialState,

            // Mode actions
            setMode: (mode) => {
                const currentState = get();
                // Only update if mode actually changed
                if (currentState.currentMode === mode) {
                    return;
                }

                const currentModeConnection = currentState.modeConnections[mode];
                set({
                    currentMode: mode,
                    // Restore per-mode connection state
                    isConnected: currentModeConnection,
                    connectionError: null,
                    // Keep EDL-specific state (selectedDevice, firehoseLoaded) when switching modes
                    // This allows users to switch to ADB/Fastboot and back without losing EDL config
                });
            },

            // Device actions
            setDevice: (device) => set({ selectedDevice: device }),

            setConnected: (connected) => {
                const currentMode = get().currentMode;
                set((state) => ({
                    isConnected: connected,
                    modeConnections: {
                        ...state.modeConnections,
                        [currentMode]: connected,
                    },
                }));
            },

            setModeConnected: (mode, connected) => set((state) => ({
                modeConnections: {
                    ...state.modeConnections,
                    [mode]: connected,
                },
                // Update global isConnected if this is the current mode
                isConnected: state.currentMode === mode ? connected : state.isConnected,
            })),

            setFirehoseLoaded: (loaded) => set({ firehoseLoaded: loaded }),

            setError: (error) => set({ connectionError: error }),

            reset: () => set({
                ...initialState,
                // Preserve currentMode when resetting
                currentMode: undefined as unknown as DeviceMode,
            }),
        }),
        {
            name: 'q-flash-device-mode',
            // Only persist the currentMode field
            partialize: (state) => ({ currentMode: state.currentMode }),
        }
    )
);
