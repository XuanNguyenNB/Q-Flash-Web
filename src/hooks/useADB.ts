/**
 * useADB Hook
 * 
 * React hook that wraps the ADBProtocol class for ADB operations.
 * Provides connection management, device info retrieval, and reboot commands.
 * Syncs state with Zustand stores and logs operations to terminal.
 * 
 * CRITICAL: This hook WRAPS the core logic - it does NOT modify it.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ADBProtocol,
    type ADBDeviceInfo,
    type ADBFileEntry,
    type ADBAppEntry
} from '@/core/ADBProtocol';
import { useDeviceStore } from '@/stores/deviceStore';
import { useADBStore } from '@/stores/adbStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { toast } from 'sonner';

/**
 * Return type for useADB hook.
 */
export interface UseADBReturn {
    /** Get or create the ADBProtocol instance */
    getInstance: () => ADBProtocol;
    /** Connect to an ADB device */
    connect: () => Promise<boolean>;
    /** Disconnect from the current device */
    disconnect: () => Promise<void>;
    /** Get device information */
    getDeviceInfo: () => Promise<ADBDeviceInfo | null>;
    /** Reboot to EDL mode */
    rebootToEDL: () => Promise<boolean>;
    /** Reboot to bootloader (Fastboot) */
    rebootToBootloader: () => Promise<boolean>;
    /** Reboot to FastbootD */
    rebootToFastbootD: () => Promise<boolean>;
    /** Reboot to recovery mode */
    rebootToRecovery: () => Promise<boolean>;
    /** Normal reboot */
    reboot: () => Promise<boolean>;
    /** Power off the device */
    shutdown: () => Promise<boolean>;
    /** List installed packages */
    listPackages: (filter?: 'user' | 'system' | 'enabled' | 'disabled') => Promise<ADBAppEntry[]>;
    /** Install an APK file */
    installAPK: (file: File, progressCallback?: (percent: number) => void) => Promise<boolean>;
    /** Uninstall a package */
    uninstallPackage: (packageName: string) => Promise<boolean>;
    /** Get package path for pull */
    getPackagePath: (packageName: string) => Promise<string | null>;
    /** List directory contents */
    listDirectory: (path: string) => Promise<ADBFileEntry[]>;
    /** Push file to device */
    pushFile: (file: File, remotePath: string, progressCallback?: (percent: number) => void) => Promise<boolean>;
    /** Pull file from device */
    pullFile: (remotePath: string) => Promise<Blob | null>;
    /** Delete file/folder */
    deleteFile: (path: string) => Promise<boolean>;
    /** Create directory */
    createDirectory: (path: string) => Promise<boolean>;


    /** Run a shell command */
    runCommand: (command: string) => Promise<string | null>;
    /** Reset the ADB instance */
    reset: () => void;
    /** Current device info from store */
    deviceInfo: ADBDeviceInfo | null;
    /** Whether currently connecting */
    isConnecting: boolean;
    /** Current pending operation */
    pendingOperation: string | null;
}

/**
 * React hook wrapping ADBProtocol for ADB operations.
 * 
 * Features:
 * - Singleton pattern with useRef for instance preservation
 * - Automatic state sync with deviceStore and adbStore
 * - Terminal logging for all operations
 * - Pending operation tracking
 * 
 * @example
 * ```tsx
 * const { connect, disconnect, rebootToEDL, deviceInfo } = useADB();
 * 
 * const handleConnect = async () => {
 *   const success = await connect();
 *   if (success) {
 *     console.log('Connected:', deviceInfo);
 *   }
 * };
 * ```
 */
export function useADB(): UseADBReturn {
    const { t } = useTranslation();

    // Store connections for state sync
    const { setDeviceInfo, setConnecting, setDeviceReady, setPendingOperation, pendingOperation, setOperationProgress, setShowDeviceInUseDialog, setShowUserGestureDialog } = useADBStore();
    const deviceInfo = useADBStore((state) => state.deviceInfo);
    const isConnecting = useADBStore((state) => state.isConnecting);

    const { isConnected, setConnected } = useDeviceStore();
    const addLog = useTerminalStore((state) => state.log);

    // Helper to log to terminal
    const log = useCallback((level: 'info' | 'error' | 'success' | 'warning', message: string) => {
        addLog(level, message);
    }, [addLog]);

    // Check if operation is locked
    const checkLock = useCallback((actionName: string) => {
        if (pendingOperation) {
            toast.warning(`Cannot ${actionName}: ${pendingOperation} in progress`);
            return false;
        }
        return true;
    }, [pendingOperation]);

    /**
     * Create a logger function for ADBProtocol.
     */
    const createLogger = useCallback(() => {
        return (message: string, level?: 'info' | 'debug' | 'error' | 'success' | 'warning') => {
            // Map levels for terminal store
            let terminalLevel: 'info' | 'error' | 'success' | 'warning' = 'info';
            if (level === 'error') terminalLevel = 'error';
            else if (level === 'success') terminalLevel = 'success';
            else if (level === 'warning') terminalLevel = 'warning';
            // Debug maps to info

            log(terminalLevel, message);
        };
    }, [log]);

    /**
     * Get or create the ADBProtocol instance.
     * Uses static singleton to preserve connection state across components.
     */
    const getInstance = useCallback((): ADBProtocol => {
        return ADBProtocol.getInstance(createLogger());
    }, [createLogger]);

    // Sync Store with Protocol State on Mount & Register Listener
    useEffect(() => {
        const adb = getInstance();

        // Register listener for robust state sync
        adb.setConnectionChangeListener((connected) => {
            setConnected(connected);
            if (connected) {
                // Fetch info with a slight delay to ensure device is ready
                setTimeout(() => {
                    adb.getDeviceInfo().then(info => {
                        if (info) setDeviceInfo(info);
                    }).catch(console.error);
                }, 500);
            } else {
                setDeviceInfo(null);
            }
        });

        // Initial check on mount
        if (adb.isConnected && !isConnected) {
            setConnected(true);
            adb.getDeviceInfo().then(info => {
                if (info) setDeviceInfo(info);
            }).catch(console.error);
        }
    }, [getInstance, isConnected, setConnected, setDeviceInfo]);

    /**
     * Connect to an ADB device via WebUSB.
     * Updates deviceStore.isConnected and fetches device info on success.
     */
    const connect = useCallback(async (): Promise<boolean> => {
        const adb = getInstance();
        if (adb.isConnected || isConnecting) return true; // Prevent double actions

        log('info', '🔌 Connecting to ADB device...');
        setConnecting(true);
        setPendingOperation('connecting');

        try {
            const success = await adb.connect();

            if (success) {
                // Update connection state
                setConnected(true);
                log('success', '✅ ADB device connected');

                // Fetch device info
                log('info', '📱 Fetching device info...');
                const info = await adb.getDeviceInfo();

                if (info) {
                    setDeviceInfo(info);
                    log('success', `📱 ${info.manufacturer} ${info.model} (Android ${info.androidVersion})`);
                }

                // Mark device as ready immediately - let Scrcpy handle any early-click errors
                setDeviceReady(true);
            } else {
                setConnected(false);

                // Check if the failure was due to "device in use" error
                if (adb.isDeviceInUseError) {
                    setShowDeviceInUseDialog(true);
                } else if (!adb.lastError) {
                    // User cancelled or no device selected
                    log('info', 'ℹ️ Connection cancelled or no device selected');
                }
            }

            return success;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ ADB connection failed: ${message}`);

            const lowerMessage = message.toLowerCase();

            // Check for "device in use" error
            if (lowerMessage.includes('already in use') ||
                lowerMessage.includes('in use') ||
                lowerMessage.includes('busy') ||
                lowerMessage.includes('claimed')) {
                setShowDeviceInUseDialog(true);
            }
            // Check for "user gesture" error (auto-connect without user click)
            else if (lowerMessage.includes('user gesture') || lowerMessage.includes('permission request')) {
                log('warning', '⚠️ Please click the "Connect ADB" button to connect');
                setShowUserGestureDialog(true);
            }

            setConnected(false);
            setDeviceReady(false);
            return false;
        } finally {
            setConnecting(false);
            setPendingOperation(null);
        }
    }, [getInstance, log, setConnected, setConnecting, setDeviceInfo, setDeviceReady, setPendingOperation, setShowDeviceInUseDialog, setShowUserGestureDialog, t]);

    /**
     * Disconnect from the current ADB device.
     * Resets both adbStore and deviceStore connection states.
     */
    const disconnect = useCallback(async (): Promise<void> => {
        const adb = getInstance();

        log('info', '🔌 Disconnecting ADB device...');
        setPendingOperation('disconnecting');

        try {
            await adb.disconnect();
            setConnected(false);
            useADBStore.getState().reset(); // Changed to reset the store
            log('info', '✅ ADB disconnected');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ Disconnect error: ${message}`);
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setConnected, setPendingOperation]);

    /**
     * Get device information from connected device.
     */
    const getDeviceInfo = useCallback(async (): Promise<ADBDeviceInfo | null> => {
        const adb = getInstance();

        if (!adb.isConnected) {
            log('error', '❌ Not connected - cannot get device info');
            return null;
        }

        log('info', '📱 Fetching device info...');
        setPendingOperation('getDeviceInfo');

        try {
            const info = await adb.getDeviceInfo();

            if (info) {
                setDeviceInfo(info);
                log('success', `📱 ${info.manufacturer} ${info.model} (Android ${info.androidVersion})`);
            }

            return info;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ Failed to get device info: ${message}`);
            return null;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setDeviceInfo, setPendingOperation]);

    /**
     * Reboot device to EDL (Emergency Download) mode.
     * Note: Requires unlocked bootloader on most devices.
     */
    const rebootToEDL = useCallback(async (): Promise<boolean> => {
        if (!checkLock('reboot to EDL')) return false;
        const adb = getInstance();

        if (!adb.isConnected) {
            log('error', '❌ Not connected - cannot reboot to EDL');
            return false;
        }

        log('info', '🔄 Rebooting to EDL mode...');
        setPendingOperation('rebootToEDL');

        try {
            const success = await adb.rebootToEDL();

            if (success) {
                // Device will reboot, connection will be lost
                setConnected(false);
                useADBStore.getState().reset(); // Changed to reset the store
                log('success', '✅ Device rebooting to EDL mode');
            } else {
                log('error', '❌ Failed to reboot to EDL');
            }

            return success;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ Reboot to EDL failed: ${message}`);
            return false;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setConnected, setPendingOperation, checkLock]);

    /**
     * Reboot device to bootloader (Fastboot) mode.
     */
    const rebootToBootloader = useCallback(async (): Promise<boolean> => {
        if (!checkLock('reboot to bootloader')) return false;
        const adb = getInstance();

        if (!adb.isConnected) {
            log('error', '❌ Not connected - cannot reboot to bootloader');
            return false;
        }

        log('info', '🔄 Rebooting to bootloader (Fastboot)...');
        setPendingOperation('rebootToBootloader');

        try {
            const success = await adb.rebootToBootloader();

            if (success) {
                setConnected(false);
                useADBStore.getState().reset(); // Changed to reset the store
                log('success', '✅ Device rebooting to bootloader');
            } else {
                log('error', '❌ Failed to reboot to bootloader');
            }

            return success;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ Reboot to bootloader failed: ${message}`);
            return false;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setConnected, setPendingOperation, checkLock]);

    /**
     * Reboot device to FastbootD mode.
     */
    const rebootToFastbootD = useCallback(async (): Promise<boolean> => {
        if (!checkLock('reboot to FastbootD')) return false;
        const adb = getInstance();

        if (!adb.isConnected) {
            log('error', '❌ Not connected - cannot reboot to FastbootD');
            return false;
        }

        log('info', '🔄 Rebooting to FastbootD...');
        setPendingOperation('rebootToFastbootD');

        try {
            const success = await adb.rebootToFastbootD();

            if (success) {
                setConnected(false);
                useADBStore.getState().reset(); // Changed to reset the store
                log('success', '✅ Device rebooting to FastbootD');
            } else {
                log('error', '❌ Failed to reboot to FastbootD');
            }

            return success;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ Reboot to FastbootD failed: ${message}`);
            return false;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setConnected, setPendingOperation, checkLock]);

    /**
     * Reboot device to recovery mode.
     */
    const rebootToRecovery = useCallback(async (): Promise<boolean> => {
        if (!checkLock('reboot to recovery')) return false;
        const adb = getInstance();

        if (!adb.isConnected) {
            log('error', '❌ Not connected - cannot reboot to recovery');
            return false;
        }

        log('info', '🔄 Rebooting to recovery...');
        setPendingOperation('rebootToRecovery');

        try {
            const success = await adb.rebootToRecovery();

            if (success) {
                setConnected(false);
                useADBStore.getState().reset(); // Changed to reset the store
                log('success', '✅ Device rebooting to recovery');
            } else {
                log('error', '❌ Failed to reboot to recovery');
            }

            return success;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ Reboot to recovery failed: ${message}`);
            return false;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setConnected, setPendingOperation, checkLock]);

    /**
     * Normal reboot.
     */
    const reboot = useCallback(async (): Promise<boolean> => {
        if (!checkLock('reboot')) return false;
        const adb = getInstance();

        if (!adb.isConnected) {
            log('error', '❌ Not connected - cannot reboot');
            return false;
        }

        log('info', '🔄 Rebooting device...');
        setPendingOperation('reboot');

        try {
            const success = await adb.reboot();

            if (success) {
                setConnected(false);
                useADBStore.getState().reset(); // Changed to reset the store
                log('success', '✅ Device rebooting');
            } else {
                log('error', '❌ Failed to reboot');
            }

            return success;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ Reboot failed: ${message}`);
            return false;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setConnected, setPendingOperation, checkLock]);

    /**
     * Power off the device.
     */
    const shutdown = useCallback(async (): Promise<boolean> => {
        if (!checkLock('shutdown')) return false;
        const adb = getInstance();

        if (!adb.isConnected) {
            log('error', '❌ Not connected - cannot shutdown');
            return false;
        }

        log('info', '⏻ Shutting down device...');
        setPendingOperation('shutdown');

        try {
            const success = await adb.shutdown();

            if (success) {
                setConnected(false);
                useADBStore.getState().reset(); // Changed to reset the store
                log('success', '✅ Device shutting down');
            } else {
                log('error', '❌ Failed to shutdown');
            }

            return success;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ Shutdown failed: ${message}`);
            return false;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setConnected, setPendingOperation, checkLock]);

    /**
     * Reset the ADB instance.
     */
    const reset = useCallback(() => {
        const adb = getInstance();
        if (adb.isConnected) {
            // Best effort disconnect
            adb.disconnect().catch(() => { });
        }
        useADBStore.getState().reset(); // Reset store
        setConnected(false);
    }, [getInstance, setConnected]);

    /**
     * Run a raw shell command.
     */
    const runCommand = useCallback(async (command: string): Promise<string | null> => {
        const adb = getInstance();

        if (!adb.isConnected) {
            log('error', '❌ Not connected - cannot run command');
            return null;
        }

        // Allow concurrent small commands like ls, but blocks if dangerous?
        // For strict "no other commands", check lock.
        if (pendingOperation && pendingOperation !== 'running command') {
            // Optional: Allow read-only commands? For now block all as requested.
            // But wait, listPackages uses this. If we block everything, progress polling might fail if implemented via polling.
            // Our progress is via callback, so safe.
            // Block.
            if (!checkLock('run command')) return null;
        }

        log('info', `> ${command}`);
        setPendingOperation('running command'); // Added from snippet
        try {
            const result = await adb.runShellCommand(command);

            if (result !== null) {
                // Log output lines for better readability
                const lines = result.trim().split('\n');
                lines.forEach(line => log('info', line));
            }
            return result;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, pendingOperation, checkLock, setPendingOperation]);

    /**
     * App Management Wrappers
     */
    const listPackages = useCallback(async (filter: 'user' | 'system' | 'enabled' | 'disabled' = 'user'): Promise<ADBAppEntry[]> => {
        const adb = getInstance();
        if (!adb.isConnected) return [];
        if (pendingOperation) return [];

        // Convert filter to boolean for ADBProtocol.listPackages
        const systemApps = filter === 'system';
        const packages = await adb.listPackages(systemApps);

        // Convert string[] to ADBAppEntry[]
        return packages.map(pkg => ({
            package: pkg,
            path: '',
            enabled: filter !== 'disabled',
            type: systemApps ? 'system' : 'user'
        } as ADBAppEntry));
    }, [getInstance, pendingOperation]);

    const installAPK = useCallback(async (file: File, progressCallback?: (percent: number) => void): Promise<boolean> => {
        if (!checkLock('install')) return false;
        const adb = getInstance();
        if (!adb.isConnected) return false;

        log('info', `📦 Installing ${file.name}...`);
        setPendingOperation('installing');
        setOperationProgress(0);
        try {
            // Convert File to Uint8Array
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);

            // Note: ADBProtocol.installAPK doesn't support progress callback
            // We simulate 50% before install and 100% after
            if (progressCallback) progressCallback(50);

            const success = await adb.installAPK(data, file.name.replace('.apk', ''));

            if (progressCallback) progressCallback(100);
            setOperationProgress(100);
            return success;
        } finally {
            setPendingOperation(null);
            setOperationProgress(null);
        }
    }, [getInstance, log, setPendingOperation, setOperationProgress, checkLock]);

    const uninstallPackage = useCallback(async (packageName: string): Promise<boolean> => {
        if (!checkLock('uninstall')) return false;
        const adb = getInstance();
        if (!adb.isConnected) return false;

        log('info', `🗑️ Uninstalling ${packageName}...`);
        setPendingOperation('uninstalling');
        try {
            const success = await adb.uninstallPackage(packageName);
            return success;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setPendingOperation, checkLock]);

    const getPackagePath = useCallback(async (packageName: string): Promise<string | null> => {
        const adb = getInstance();
        if (!adb.isConnected) return null;
        return await adb.getPackagePath(packageName);
    }, [getInstance]);

    /**
     * File Management Wrappers
     */
    const listDirectory = useCallback(async (path: string): Promise<ADBFileEntry[]> => {
        const adb = getInstance();
        if (!adb.isConnected) return [];
        // Allow list only if no op?
        if (pendingOperation) return [];
        return await adb.listDirectory(path);
    }, [getInstance, pendingOperation]);

    const pushFile = useCallback(async (file: File, remotePath: string, progressCallback?: (percent: number) => void): Promise<boolean> => {
        if (!checkLock('upload')) return false;
        const adb = getInstance();
        if (!adb.isConnected) return false;

        const fileSizeMB = file.size / 1024 / 1024;
        log('info', `📤 Uploading ${file.name} (${fileSizeMB.toFixed(2)} MB) to ${remotePath}...`);
        setPendingOperation('uploading');
        setOperationProgress(0);

        try {
            // Use streaming for all files (better for large files, no performance penalty for small ones)
            const success = await adb.pushFileStream(file, remotePath, (bytesWritten, totalBytes) => {
                const percent = Math.round((bytesWritten / totalBytes) * 100);
                setOperationProgress(percent);
                if (progressCallback) progressCallback(percent);
            });

            if (success) log('success', `✅ Upload complete: ${file.name}`);
            return success;
        } catch (error) {
            log('error', `❌ Upload failed: ${error}`);
            return false;
        } finally {
            setPendingOperation(null);
            setOperationProgress(null);
        }
    }, [getInstance, log, setPendingOperation, setOperationProgress, checkLock]);

    const pullFile = useCallback(async (remotePath: string): Promise<Blob | null> => {
        if (!checkLock('download')) return null;
        const adb = getInstance();
        if (!adb.isConnected) return null;

        log('info', `📥 Downloading ${remotePath}...`);
        setPendingOperation('downloading');
        try {
            const data = await adb.pullFile(remotePath);
            // Convert Uint8Array to Blob - copy to ensure correct typing
            return new Blob([new Uint8Array(data)]);
        } catch {
            return null;
        } finally {
            setPendingOperation(null);
        }
    }, [getInstance, log, setPendingOperation, checkLock]);

    const deleteFile = useCallback(async (path: string): Promise<boolean> => {
        if (!checkLock('delete')) return false;
        const adb = getInstance();
        if (!adb.isConnected) return false;
        return await adb.deleteFile(path);
    }, [getInstance, checkLock]);

    const createDirectory = useCallback(async (path: string): Promise<boolean> => {
        if (!checkLock('create directory')) return false;
        const adb = getInstance();
        if (!adb.isConnected) return false;
        return await adb.createDirectory(path);
    }, [getInstance, checkLock]);

    return {
        getInstance,
        connect,
        disconnect,
        getDeviceInfo,
        rebootToEDL,
        rebootToBootloader,
        rebootToFastbootD,
        rebootToRecovery,
        reboot,
        shutdown,
        runCommand, // Exported
        // App Manager
        listPackages,
        installAPK,
        uninstallPackage,
        getPackagePath,
        // File Manager
        listDirectory,
        pushFile,
        pullFile,
        deleteFile,
        createDirectory,

        reset,
        deviceInfo,
        isConnecting,
        pendingOperation, // Global state
    };
}
