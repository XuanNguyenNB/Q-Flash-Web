/**
 * useWebUSB Hook
 * 
 * React hook that wraps the WebUSBManager class for connecting to
 * Qualcomm 9008 EDL mode devices. Syncs state with Zustand stores
 * and logs operations to terminal.
 * 
 * CRITICAL: This hook WRAPS the core logic - it does NOT modify it.
 */

import { useCallback } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { WebUSBManager } from '@/core/WebUSBManager';
import type { DeviceInfo } from '@/types';

// Singleton instance - shared across all hook calls
// This ensures the SAME WebUSBManager is used throughout the app
let usbSingleton: WebUSBManager | null = null;

/**
 * Return type for useWebUSB hook.
 */
export interface UseWebUSBReturn {
    /** Connect to a Qualcomm 9008 device via WebUSB */
    connect: () => Promise<DeviceInfo>;
    /** Disconnect from the device */
    disconnect: (forceRelease?: boolean) => Promise<void>;
    /** Get the underlying WebUSBManager instance (for advanced usage) */
    getManager: () => WebUSBManager;
    /** Check if WebUSB is supported in this browser */
    isSupported: () => boolean;
    /** Check if device is currently connected */
    isConnected: () => boolean;
}

/**
 * React hook wrapping WebUSBManager for device connection.
 * 
 * Features:
 * - Singleton pattern - GLOBAL instance shared across all components
 * - Lazy initialization
 * - Automatic state sync with deviceStore
 * - Terminal logging for all operations
 * - Cleanup on unmount
 * 
 * @example
 * ```tsx
 * const { connect, disconnect, isSupported } = useWebUSB();
 * 
 * const handleConnect = async () => {
 *   if (!isSupported()) return;
 *   try {
 *     const device = await connect();
 *     console.log('Connected to:', device);
 *   } catch (error) {
 *     console.error('Connection failed:', error);
 *   }
 * };
 * ```
 */
export function useWebUSB(): UseWebUSBReturn {
    // Store connections for state sync
    const setConnected = useDeviceStore((state) => state.setConnected);
    const setError = useDeviceStore((state) => state.setError);
    const log = useTerminalStore((state) => state.log);

    /**
     * Get or create the WebUSBManager instance.
     * Uses GLOBAL singleton to share across all components.
     */
    const getManager = useCallback((): WebUSBManager => {
        if (!usbSingleton) {
            usbSingleton = new WebUSBManager();
        }
        return usbSingleton;
    }, []);

    /**
     * Check if WebUSB is supported in this browser.
     */
    const isSupported = useCallback((): boolean => {
        return WebUSBManager.isSupported();
    }, []);

    /**
     * Check if device is currently connected.
     */
    const isConnected = useCallback((): boolean => {
        return usbSingleton?.isConnected ?? false;
    }, []);

    /**
     * Connect to a Qualcomm 9008 device.
     * Logs progress to terminal and syncs state with deviceStore.
     */
    const connect = useCallback(async (): Promise<DeviceInfo> => {
        const manager = getManager();
        log('info', 'Connecting to device...');
        setError(null);

        try {
            const deviceInfo = await manager.connect();
            setConnected(true);
            log('success', 'Device connected successfully');
            log('info', `Device: Vendor ${deviceInfo.vendorId.toString(16)}, Product ${deviceInfo.productId.toString(16)}`);
            return deviceInfo;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Connection failed: ${errorMessage}`);
            setConnected(false);
            setError(errorMessage);
            throw error;
        }
    }, [getManager, setConnected, setError, log]);

    /**
     * Disconnect from the device.
     * @param forceRelease - If true, also forgets the device permission
     */
    const disconnect = useCallback(async (forceRelease = false): Promise<void> => {
        if (!usbSingleton) return;

        try {
            log('info', 'Disconnecting from device...');
            await usbSingleton.disconnect(forceRelease);
            setConnected(false);
            log('success', 'Device disconnected');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Disconnect error: ${errorMessage}`);
            // Still set disconnected even on error
            setConnected(false);
        }
    }, [setConnected, log]);

    // NOTE: No cleanup effect for singleton - we want to preserve connection across component lifecycle

    return {
        connect,
        disconnect,
        getManager,
        isSupported,
        isConnected,
    };
}
