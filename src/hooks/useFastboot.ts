/**
 * useFastboot Hook
 * 
 * React hook that wraps the FastbootProtocol class for Fastboot
 * operations like flashing, erasing partitions, and bootloader commands.
 * Syncs state with Zustand stores and logs operations to terminal.
 * 
 * Features:
 * - Singleton pattern for FastbootProtocol instance
 * - Automatic state sync with deviceStore and fastbootStore
 * - Terminal logging for all operations
 * - Flash progress tracking
 */

import { useRef, useCallback } from 'react';
import { FastbootProtocol, type FastbootDeviceInfo } from '@/core/FastbootProtocol';
import { useFastbootStore } from '@/stores/fastbootStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { useTerminalStore } from '@/stores/terminalStore';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Return type for useFastboot hook.
 */
export interface UseFastbootReturn {
    // Protocol instance access
    getInstance: () => FastbootProtocol;

    // Connection methods
    connect: () => Promise<boolean>;
    disconnect: () => Promise<void>;

    // Device info
    getDeviceInfo: () => Promise<FastbootDeviceInfo | null>;

    // Bootloader commands
    unlockBootloader: () => Promise<boolean>;
    lockBootloader: () => Promise<boolean>;

    // Flash operations
    flashPartition: (partition: string, file: File, onProgress?: (percent: number) => void) => Promise<boolean>;
    erasePartition: (partition: string) => Promise<boolean>;

    // Reboot commands
    reboot: () => Promise<boolean>;
    rebootBootloader: () => Promise<boolean>;
    rebootRecovery: () => Promise<boolean>;
    rebootFastbootd: () => Promise<boolean>;

    // Partition operations
    getPartitionList: () => Promise<string[]>;

    // State access (convenience)
    deviceInfo: FastbootDeviceInfo | null;
    isConnecting: boolean;
    flashProgress: { partition: string; progress: number } | null;
    pendingOperation: string | null;

    // Store reset
    reset: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook wrapping FastbootProtocol for Fastboot operations.
 * 
 * Features:
 * - Singleton pattern for FastbootProtocol instance
 * - Automatic state sync with deviceStore and fastbootStore
 * - Terminal logging for all operations
 * - Flash progress tracking
 * 
 * @example
 * ```tsx
 * const { connect, flashPartition, reboot, deviceInfo } = useFastboot();
 * 
 * const handleFlash = async () => {
 *   const connected = await connect();
 *   if (connected) {
 *     await flashPartition('boot', bootFile, (progress) => {
 *       console.log(`Flashing: ${progress}%`);
 *     });
 *     await reboot();
 *   }
 * };
 * ```
 */
// ============================================================================
// Singleton Instance
// ============================================================================

// Global instance to ensure connection state is shared across all components
let globalProtocol: FastbootProtocol | null = null;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * React hook wrapping FastbootProtocol for Fastboot operations.
 * 
 * Features:
 * - Singleton pattern for FastbootProtocol instance (Shared across app)
 * - Automatic state sync with deviceStore and fastbootStore
 * - Terminal logging for all operations
 * - Flash progress tracking
 */
export function useFastboot(): UseFastbootReturn {
    // Store hooks
    const fastbootStore = useFastbootStore();
    const deviceStore = useDeviceStore();
    const terminalStore = useTerminalStore();

    // ========================================================================
    // Logger Callback
    // ========================================================================

    const logToTerminal = useCallback((message: string, level?: 'info' | 'debug' | 'error' | 'success') => {
        // Map protocol log levels to terminal store levels
        const terminalLevel = level === 'success' ? 'success' :
            level === 'error' ? 'error' :
                level === 'debug' ? 'debug' : 'info';

        terminalStore.log(terminalLevel, `[Fastboot] ${message}`);
    }, [terminalStore]);

    // ========================================================================
    // Protocol Instance Management
    // ========================================================================

    const getInstance = useCallback((): FastbootProtocol => {
        if (!globalProtocol) {
            // Create singleton instance with a logger that accesses the store state directly
            // This ensures logging works even if this specific hook instance is unmounted
            globalProtocol = new FastbootProtocol((message, level) => {
                const terminalLevel = level === 'success' ? 'success' :
                    level === 'error' ? 'error' :
                        level === 'debug' ? 'debug' : 'info';

                // Use getState() to log without React loop dependency
                useTerminalStore.getState().log(terminalLevel, `[Fastboot] ${message}`);
            });
        }
        return globalProtocol;
    }, []);

    // ========================================================================
    // Connection Methods
    // ========================================================================

    const connect = useCallback(async (): Promise<boolean> => {
        const protocol = getInstance();

        // Prevent multiple simultaneous connect attempts
        if (fastbootStore.isConnecting) {
            console.log('[useFastboot] Connect already in progress, skipping...');
            return false;
        }

        // Already connected
        if (protocol.isConnected) {
            console.log('[useFastboot] Already connected');
            return true;
        }

        try {
            fastbootStore.setConnecting(true);
            fastbootStore.setPendingOperation('Connecting to Fastboot device...');

            const success = await protocol.connect();

            if (success) {
                // Update connection state
                deviceStore.setConnected(true);

                // Fetch and store device info
                const info = await protocol.getDeviceInfo();
                fastbootStore.setDeviceInfo(info);

                logToTerminal('Fastboot device connected and ready', 'success');
            } else {
                deviceStore.setConnected(false);
                fastbootStore.setDeviceInfo(null);
            }

            return success;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Connection failed: ${message}`, 'error');
            deviceStore.setConnected(false);
            fastbootStore.setDeviceInfo(null);
            return false;

        } finally {
            fastbootStore.setConnecting(false);
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, deviceStore, logToTerminal]);

    const disconnect = useCallback(async (): Promise<void> => {
        const protocol = getInstance();

        try {
            fastbootStore.setPendingOperation('Disconnecting...');
            await protocol.disconnect();

            // Reset all state
            deviceStore.setConnected(false);
            fastbootStore.reset();

            logToTerminal('Fastboot device disconnected', 'info');

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Disconnect error: ${message}`, 'error');

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, deviceStore, logToTerminal]);

    // ========================================================================
    // Device Info
    // ========================================================================

    const getDeviceInfo = useCallback(async (): Promise<FastbootDeviceInfo | null> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot get device info', 'error');
            return null;
        }

        try {
            fastbootStore.setPendingOperation('Reading device info...');
            const info = await protocol.getDeviceInfo();
            fastbootStore.setDeviceInfo(info);
            return info;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Failed to get device info: ${message}`, 'error');
            return null;

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, logToTerminal]);

    // ========================================================================
    // Bootloader Commands
    // ========================================================================

    const unlockBootloader = useCallback(async (): Promise<boolean> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot unlock bootloader', 'error');
            return false;
        }

        try {
            fastbootStore.setPendingOperation('Unlocking bootloader...');
            const success = await protocol.unlockBootloader();

            if (success) {
                // After unlock, device typically reboots and disconnects
                // Reset state immediately to reflect disconnection
                logToTerminal('Bootloader unlocked! Device will reboot.', 'success');
                deviceStore.setConnected(false);
                fastbootStore.reset();
            }

            return success;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Unlock bootloader failed: ${message}`, 'error');
            // Device may have disconnected during unlock
            deviceStore.setConnected(false);
            fastbootStore.reset();
            return false;

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, deviceStore, logToTerminal]);


    const lockBootloader = useCallback(async (): Promise<boolean> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot lock bootloader', 'error');
            return false;
        }

        try {
            fastbootStore.setPendingOperation('Locking bootloader...');
            const success = await protocol.lockBootloader();

            if (success) {
                // Refresh device info to get updated lock status
                const info = await protocol.getDeviceInfo();
                fastbootStore.setDeviceInfo(info);
            }

            return success;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Lock bootloader failed: ${message}`, 'error');
            return false;

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, logToTerminal]);

    // ========================================================================
    // Flash Operations
    // ========================================================================

    const flashPartition = useCallback(async (
        partition: string,
        file: File,
        onProgress?: (percent: number) => void
    ): Promise<boolean> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot flash partition', 'error');
            return false;
        }

        try {
            fastbootStore.setPendingOperation(`Flashing ${partition}...`);
            fastbootStore.setFlashProgress({ partition, progress: 0 });

            const success = await protocol.flashPartition(partition, file, (progress) => {
                const total = file.size;
                const transferred = Math.floor(total * progress);

                fastbootStore.setFlashProgress({
                    partition,
                    progress,
                    transferred,
                    total
                });

                if (onProgress) {
                    onProgress(progress);
                }
            });

            return success;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Flash ${partition} failed: ${message}`, 'error');
            return false;

        } finally {
            fastbootStore.setFlashProgress(null);
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, logToTerminal]);

    const erasePartition = useCallback(async (partition: string): Promise<boolean> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot erase partition', 'error');
            return false;
        }

        try {
            fastbootStore.setPendingOperation(`Erasing ${partition}...`);
            const success = await protocol.erasePartition(partition);
            return success;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Erase ${partition} failed: ${message}`, 'error');
            return false;

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, logToTerminal]);

    // ========================================================================
    // Reboot Commands
    // ========================================================================

    const reboot = useCallback(async (): Promise<boolean> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot reboot', 'error');
            return false;
        }

        try {
            fastbootStore.setPendingOperation('Rebooting device...');
            const success = await protocol.reboot();

            if (success) {
                // Device will disconnect after reboot
                deviceStore.setConnected(false);
                fastbootStore.reset();
            }

            return success;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Reboot failed: ${message}`, 'error');
            return false;

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, deviceStore, logToTerminal]);

    const rebootBootloader = useCallback(async (): Promise<boolean> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot reboot to bootloader', 'error');
            return false;
        }

        try {
            fastbootStore.setPendingOperation('Rebooting to bootloader...');
            const success = await protocol.rebootBootloader();
            return success;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Reboot to bootloader failed: ${message}`, 'error');
            return false;

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, logToTerminal]);

    const rebootRecovery = useCallback(async (): Promise<boolean> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot reboot to recovery', 'error');
            return false;
        }

        try {
            fastbootStore.setPendingOperation('Rebooting to recovery...');
            const success = await protocol.rebootRecovery();

            if (success) {
                // Device will disconnect after reboot to recovery
                deviceStore.setConnected(false);
                fastbootStore.reset();
            }

            return success;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Reboot to recovery failed: ${message}`, 'error');
            return false;

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, deviceStore, logToTerminal]);

    const rebootFastbootd = useCallback(async (): Promise<boolean> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot reboot to FastbootD', 'error');
            return false;
        }

        try {
            fastbootStore.setPendingOperation('Rebooting to FastbootD...');
            const success = await protocol.rebootFastbootd();

            if (success) {
                // Device will reconnect in fastbootd mode
                deviceStore.setConnected(false);
                fastbootStore.reset();
            }

            return success;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Reboot to FastbootD failed: ${message}`, 'error');
            return false;

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, deviceStore, logToTerminal]);

    const getPartitionList = useCallback(async (): Promise<string[]> => {
        const protocol = getInstance();

        if (!protocol.isConnected) {
            logToTerminal('Not connected - cannot get partition list', 'error');
            return [];
        }

        try {
            fastbootStore.setPendingOperation('Fetching partitions...');
            const partitions = await protocol.getPartitionList();
            return partitions;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logToTerminal(`Failed to get partitions: ${message}`, 'error');
            return [];

        } finally {
            fastbootStore.setPendingOperation(null);
        }
    }, [getInstance, fastbootStore, logToTerminal]);

    // ========================================================================
    // Store Reset
    // ========================================================================

    const reset = useCallback((): void => {
        deviceStore.setConnected(false);
        fastbootStore.reset();
        globalProtocol = null;
    }, [deviceStore, fastbootStore]);

    // ========================================================================
    // Return Hook Interface
    // ========================================================================

    return {
        // Protocol instance access
        getInstance,

        // Connection methods
        connect,
        disconnect,

        // Device info
        getDeviceInfo,

        // Bootloader commands
        unlockBootloader,
        lockBootloader,

        // Flash operations
        flashPartition,
        erasePartition,

        // Reboot commands
        reboot,
        rebootBootloader,
        rebootRecovery,
        rebootFastbootd,

        // Partition operations
        getPartitionList,

        // State access (convenience)
        deviceInfo: fastbootStore.deviceInfo,
        isConnecting: fastbootStore.isConnecting,
        flashProgress: fastbootStore.flashProgress,
        pendingOperation: fastbootStore.pendingOperation,

        // Store reset
        reset,
    };
}
