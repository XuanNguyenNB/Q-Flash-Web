/**
 * useAuth Hook
 * 
 * React hook that wraps the AuthStrategy (OppoVipAuth) class for
 * Oppo/OnePlus/Realme VIP authentication handshake. Logs operations to terminal.
 * 
 * CRITICAL: This hook WRAPS the core logic - it does NOT modify it.
 */

import { useCallback, useRef } from 'react';
import { useTerminalStore } from '@/stores/terminalStore';
import { OppoVipAuth } from '@/auth/AuthStrategy';
import type { WebUSBManager } from '@/core/WebUSBManager';
import type { VipAuthResult } from '@/types';

/**
 * Credentials for VIP authentication.
 */
export interface VipCredentials {
    /** Digest file binary data */
    digestData: Uint8Array;
    /** Signature file binary data */
    signatureData: Uint8Array;
}

/**
 * Return type for useAuth hook.
 */
export interface UseAuthReturn {
    /** Load credentials from files */
    loadCredentials: (digestData: Uint8Array, signatureData: Uint8Array) => void;
    /** Execute VIP authentication handshake */
    authenticate: (usb: WebUSBManager) => Promise<VipAuthResult>;
    /** Load credentials and authenticate in one call */
    authenticateWithCredentials: (
        usb: WebUSBManager,
        credentials: VipCredentials
    ) => Promise<VipAuthResult>;
    /** Check if credentials are loaded */
    hasCredentials: () => boolean;
    /** Reset the auth instance */
    reset: () => void;
}

/**
 * React hook wrapping OppoVipAuth for device authentication.
 * 
 * Features:
 * - Credential storage for reuse
 * - Terminal logging for all auth steps
 * - Convenience method for authenticate with credentials
 * 
 * @example
 * ```tsx
 * const { authenticateWithCredentials } = useAuth();
 * const { getManager } = useWebUSB();
 * 
 * const handleAuth = async (digest: Uint8Array, signature: Uint8Array) => {
 *   const usb = getManager();
 *   const result = await authenticateWithCredentials(usb, { digestData: digest, signatureData: signature });
 *   if (result.success) {
 *     console.log('VIP authentication successful');
 *   }
 * };
 * ```
 */
export function useAuth(): UseAuthReturn {
    // Store credentials for reuse
    const credentialsRef = useRef<VipCredentials | null>(null);
    // Store auth instance
    const authRef = useRef<OppoVipAuth | null>(null);

    // Store connections for state sync
    const log = useTerminalStore((state) => state.log);

    /**
     * Create a logger function for OppoVipAuth.
     */
    const createLogger = useCallback(() => {
        return (message: string, level?: 'info' | 'debug' | 'error' | 'success') => {
            // Map 'debug' to 'info' for terminal store
            const terminalLevel = level === 'debug' ? 'info' : level || 'info';
            log(terminalLevel, message);
        };
    }, [log]);

    /**
     * Load credentials from binary data.
     */
    const loadCredentials = useCallback((digestData: Uint8Array, signatureData: Uint8Array): void => {
        log('info', `Loading VIP credentials... (digest: ${(digestData.length / 1024).toFixed(1)} KB, signature: ${(signatureData.length / 1024).toFixed(1)} KB)`);

        credentialsRef.current = {
            digestData,
            signatureData,
        };

        // Create new auth instance with credentials
        authRef.current = new OppoVipAuth(digestData, signatureData, createLogger());

        log('success', 'VIP credentials loaded');
    }, [log, createLogger]);

    /**
     * Check if credentials are loaded.
     */
    const hasCredentials = useCallback((): boolean => {
        return credentialsRef.current !== null && authRef.current !== null;
    }, []);

    /**
     * Execute VIP authentication handshake.
     */
    const authenticate = useCallback(async (usb: WebUSBManager): Promise<VipAuthResult> => {
        if (!authRef.current) {
            log('error', 'No credentials loaded for VIP authentication');
            return { success: false, error: 'Credentials not loaded' };
        }

        log('info', 'VIP authentication starting...');

        try {
            const result = await authRef.current.execute(usb);

            if (result.success) {
                log('success', 'VIP authentication successful');
            } else {
                log('error', `VIP authentication failed: ${result.error}`);
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `VIP auth error: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    }, [log]);

    /**
     * Convenience method: Load credentials and authenticate in one call.
     */
    const authenticateWithCredentials = useCallback(async (
        usb: WebUSBManager,
        credentials: VipCredentials
    ): Promise<VipAuthResult> => {
        log('info', 'Starting VIP authentication sequence...');

        try {
            // Load credentials
            loadCredentials(credentials.digestData, credentials.signatureData);

            // Execute authentication
            const result = await authenticate(usb);

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log('error', `Authentication with credentials failed: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    }, [loadCredentials, authenticate, log]);

    /**
     * Reset the auth instance and credentials.
     */
    const reset = useCallback(() => {
        credentialsRef.current = null;
        authRef.current = null;
    }, []);

    return {
        loadCredentials,
        authenticate,
        authenticateWithCredentials,
        hasCredentials,
        reset,
    };
}
