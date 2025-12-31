/**
 * useSahara Hook
 * 
 * React hook that wraps the SaharaProtocol class for Qualcomm Sahara
 * bootloader handshake and programmer upload. Logs operations to terminal.
 * 
 * CRITICAL: This hook WRAPS the core logic - it does NOT modify it.
 */

import { useCallback, useRef } from 'react';
import { useTerminalStore } from '@/stores/terminalStore';
import { SaharaProtocol } from '@/core/SaharaProtocol';
import type { WebUSBManager } from '@/core/WebUSBManager';
import { SaharaState, type SaharaResult } from '@/types';

/**
 * Return type for useSahara hook.
 */
export interface UseSaharaReturn {
    /** Get or create the SaharaProtocol instance */
    getInstance: (usb: WebUSBManager) => SaharaProtocol;
    /** Load programmer binary into memory */
    loadProgrammer: (usb: WebUSBManager, data: Uint8Array) => void;
    /** Execute full Sahara handshake to upload programmer */
    execute: (usb: WebUSBManager) => Promise<SaharaResult>;
    /** Execute Sahara with programmer data in one call */
    uploadProgrammer: (usb: WebUSBManager, programmerData: Uint8Array) => Promise<SaharaResult>;
    /** Reset the Sahara instance */
    reset: () => void;
}

/**
 * React hook wrapping SaharaProtocol for bootloader operations.
 * 
 * Features:
 * - Singleton pattern per WebUSBManager instance
 * - Terminal logging for all handshake steps
 * - Convenience method for upload in one call
 * 
 * @example
 * ```tsx
 * const { uploadProgrammer } = useSahara();
 * const { getManager } = useWebUSB();
 * 
 * const handleUpload = async (programmerFile: Uint8Array) => {
 *   const usb = getManager();
 *   const result = await uploadProgrammer(usb, programmerFile);
 *   if (result.success) {
 *     console.log('Ready for Firehose commands');
 *   }
 * };
 * ```
 */
export function useSahara(): UseSaharaReturn {
    // Singleton ref to preserve SaharaProtocol instance
    const saharaRef = useRef<SaharaProtocol | null>(null);
    const currentUsbRef = useRef<WebUSBManager | null>(null);

    // Store connections for state sync
    const log = useTerminalStore((state) => state.log);

    /**
     * Create a logger function for SaharaProtocol.
     */
    const createLogger = useCallback(() => {
        return (message: string, level?: 'info' | 'debug' | 'error') => {
            // Map 'debug' to 'info' for terminal store
            const terminalLevel = level === 'debug' ? 'info' : level || 'info';
            log(terminalLevel, message);
        };
    }, [log]);

    /**
     * Get or create the SaharaProtocol instance.
     * Creates a new instance if USB manager changes.
     */
    const getInstance = useCallback((usb: WebUSBManager): SaharaProtocol => {
        // Create new instance if USB manager changed or doesn't exist
        if (!saharaRef.current || currentUsbRef.current !== usb) {
            saharaRef.current = new SaharaProtocol(usb, createLogger());
            currentUsbRef.current = usb;
        }
        return saharaRef.current;
    }, [createLogger]);

    /**
     * Load programmer binary into memory.
     */
    const loadProgrammer = useCallback((usb: WebUSBManager, data: Uint8Array): void => {
        const sahara = getInstance(usb);
        log('info', `Loading programmer binary (${(data.length / 1024).toFixed(1)} KB)...`);
        sahara.loadProgrammer(data);
        log('success', 'Programmer loaded into memory');
    }, [getInstance, log]);

    /**
     * Execute full Sahara handshake.
     */
    const execute = useCallback(async (usb: WebUSBManager): Promise<SaharaResult> => {
        const sahara = getInstance(usb);
        log('info', 'Sahara handshake starting...');

        try {
            const result = await sahara.execute();

            if (result.success) {
                log('success', 'Sahara complete, entering Firehose mode');
            } else {
                log('error', `Sahara failed: ${result.error}`);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Sahara error: ${errorMessage}`);
            return { success: false, state: SaharaState.ERROR, error: errorMessage };
        }
    }, [getInstance, log]);

    /**
     * Convenience method: Load programmer and execute in one call.
     */
    const uploadProgrammer = useCallback(async (
        usb: WebUSBManager,
        programmerData: Uint8Array
    ): Promise<SaharaResult> => {
        log('info', 'Starting programmer upload sequence...');

        try {
            // Load programmer into memory
            loadProgrammer(usb, programmerData);

            // Execute Sahara handshake
            const result = await execute(usb);

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Programmer upload failed: ${errorMessage}`);
            return { success: false, state: SaharaState.ERROR, error: errorMessage };
        }
    }, [loadProgrammer, execute, log]);

    /**
     * Reset the Sahara instance.
     */
    const reset = useCallback(() => {
        saharaRef.current = null;
        currentUsbRef.current = null;
    }, []);

    return {
        getInstance,
        loadProgrammer,
        execute,
        uploadProgrammer,
        reset,
    };
}
