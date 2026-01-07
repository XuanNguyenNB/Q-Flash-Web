/**
 * useConnectionFlow Hook
 * 
 * Orchestrates the complete device connection flow:
 * USB → Sahara → Firehose → VIP Auth → Read Partitions
 * 
 * This hook sequences multiple protocol hooks in the correct order,
 * tracks step-by-step progress, logs all operations, and handles errors
 * with recovery options.
 */

import { useCallback, useRef, useEffect } from 'react';
import { useWebUSB } from './useWebUSB';
import { useSahara } from './useSahara';
import { useFirehose } from './useFirehose';
import { useAuth } from './useAuth';
import { useFirehoseLoader } from './useFirehoseLoader';
import { getManualFirehose } from '@/components/features/firehose/ManualFirehoseLoader';
import { useDeviceStore, type DeviceProfile } from '@/stores/deviceStore';
import { usePartitionStore } from '@/stores/partitionStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useEDLConnectionStore } from '@/stores/edlConnectionStore';
import { trackEvent } from '@/services/analytics';

/**
 * Connection flow state machine.
 * Represents the current step in the connection sequence.
 */
export type ConnectionFlowState =
    | 'idle'              // Not connected, ready to start
    | 'connecting'        // USB connection in progress
    | 'sahara'            // Sahara handshake in progress
    | 'uploading'         // Firehose upload in progress
    | 'authenticating'    // VIP auth in progress (if needed)
    | 'reading-partitions'// Reading partition table
    | 'connected'         // Fully connected and ready
    | 'error';            // Error occurred, can retry

/**
 * Connection error with step context.
 */
export interface ConnectionError {
    step: ConnectionFlowState;
    code: 'USB_ERROR' | 'SAHARA_ERROR' | 'FIREHOSE_ERROR' | 'VIP_ERROR' | 'PARTITION_ERROR';
    message: string;
    details?: string;
}

/**
 * Return type for useConnectionFlow hook.
 */
export interface UseConnectionFlowReturn {
    /** Current connection flow state */
    status: ConnectionFlowState;
    /** Error object if status is 'error' */
    error: ConnectionError | null;
    /** Start the connection flow */
    connect: () => Promise<void>;
    /** Disconnect from device */
    disconnect: () => Promise<void>;
    /** Retry connection after error */
    retry: () => void;
}

/**
 * Detect if device requires VIP authentication.
 * VIP auth is needed for Oppo/OnePlus/Realme devices.
 */
function deviceNeedsVIP(device: DeviceProfile | null): boolean {
    if (!device) return false;

    // Check authMethod field first (most reliable)
    if (device.authMethod === 'oppo_vip') {
        return true;
    }

    // Fallback: check brand field
    const oemBrands = ['oppo', 'oneplus', 'realme'];
    if (device.brand && oemBrands.includes(device.brand.toLowerCase())) {
        return true;
    }

    // Last fallback: check device name
    return oemBrands.some(brand =>
        device.name.toLowerCase().includes(brand)
    );
}

/**
 * React hook for orchestrating the complete connection flow.
 * 
 * Features:
 * - 8-state machine tracking connection progress
 * - Sequential protocol execution
 * - Terminal logging for all steps
 * - Error handling with retry capability
 * - VIP auth detection for OEM devices
 * - Persistent state via EDL connection store
 * 
 * @example
 * ```tsx
 * const { connect, status, error, retry } = useConnectionFlow();
 * 
 * const handleConnect = async () => {
 *   try {
 *     await connect();
 *     console.log('Device ready for operations');
 *   } catch (err) {
 *     console.error('Connection failed:', err);
 *   }
 * };
 * ```
 */
export function useConnectionFlow(): UseConnectionFlowReturn {
    // Protocol hooks
    const { connect: usbConnect, disconnect: usbDisconnect, getManager: getUSBManager } = useWebUSB();
    const { uploadProgrammer } = useSahara();
    const { configure: configureFirehose, readPartitionTable } = useFirehose();
    const { authenticateWithCredentials } = useAuth();
    const { getCached: getCachedFirehose } = useFirehoseLoader();

    // Store connections
    const selectedDevice = useDeviceStore((state) => state.selectedDevice);
    const firehoseLoaded = useDeviceStore((state) => state.firehoseLoaded);
    const setConnected = useDeviceStore((state) => state.setConnected);
    const setPartitions = usePartitionStore((state) => state.setPartitions);
    const log = useTerminalStore((state) => state.log);

    // EDL Connection Store (persists across navigation)
    const status = useEDLConnectionStore((state) => state.status);
    const error = useEDLConnectionStore((state) => state.error);
    const setStatus = useEDLConnectionStore((state) => state.setStatus);
    const setError = useEDLConnectionStore((state) => state.setError);

    // Ref to track current status (avoids stale closure in error handlers)
    const statusRef = useRef<ConnectionFlowState>(status);

    // Update ref whenever status changes
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Sync status from WebUSB singleton on mount (restore after navigation)
    useEffect(() => {
        const manager = getUSBManager();
        if (manager.isConnected && status === 'idle') {
            console.log('[useConnectionFlow] Restoring connected status from singleton');
            setStatus('connected');
            setConnected(true);
        }
    }, [getUSBManager, setConnected, status, setStatus]); // Only run on mount

    /**
     * Parse error into ConnectionError format.
     */
    const parseError = useCallback((err: unknown, step: ConnectionFlowState): ConnectionError => {
        const message = err instanceof Error ? err.message : String(err);

        let code: ConnectionError['code'];
        switch (step) {
            case 'connecting':
                code = 'USB_ERROR';
                break;
            case 'sahara':
                code = 'SAHARA_ERROR';
                break;
            case 'uploading':
                code = 'FIREHOSE_ERROR';
                break;
            case 'authenticating':
                code = 'VIP_ERROR';
                break;
            case 'reading-partitions':
                code = 'PARTITION_ERROR';
                break;
            default:
                code = 'USB_ERROR';
        }

        return {
            step,
            code,
            message,
            details: err instanceof Error ? err.stack : undefined,
        };
    }, []);

    /**
     * Execute the complete connection flow.
     */
    const connect = useCallback(async (): Promise<void> => {
        try {
            // Validate prerequisites - support manual mode
            let firehoseFiles: { programmer: ArrayBuffer; digest?: ArrayBuffer; signature?: ArrayBuffer } | null = null;
            let isManualMode = false;

            // Try to get firehose files from device preset first
            if (selectedDevice && firehoseLoaded) {
                firehoseFiles = getCachedFirehose(selectedDevice.chipset) ?? null;
            }

            // Fallback to manual firehose if no device preset
            if (!firehoseFiles) {
                firehoseFiles = getManualFirehose();
                isManualMode = true;
            }

            if (!firehoseFiles) {
                throw new Error('Firehose files not loaded. Please select a device preset or load files manually.');
            }

            log('info', isManualMode ? '[Mode] Using manually loaded firehose files' : `[Mode] Using preset for ${selectedDevice?.name}`);

            // Step 1: USB Connection
            setStatus('connecting');
            setError(null);
            setPartitions([]); // Clear previous partitions
            log('info', '[USB] Connecting to device...');

            await usbConnect();
            const usbManager = getUSBManager();

            log('success', '[USB] Device connected');
            trackEvent('edl', 'connection_step', 'usb_connected');

            // Step 2: Sahara Handshake & Firehose Upload
            setStatus('sahara');
            log('info', '[Sahara] Initiating handshake...');

            // Convert ArrayBuffer to Uint8Array for Sahara
            const programmerData = new Uint8Array(firehoseFiles.programmer);
            const saharaResult = await uploadProgrammer(usbManager, programmerData);

            if (!saharaResult.success) {
                throw new Error(saharaResult.error || 'Sahara handshake failed');
            }

            log('success', '[Sahara] Handshake complete');
            trackEvent('edl', 'connection_step', 'sahara_complete');

            // CRITICAL: Wait for device to settle after Sahara
            // Device transitions from Sahara mode to Firehose mode
            log('info', '[USB] Waiting for device to settle...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s for mode transition

            // Read and log any initial messages from device after Sahara
            // LG and other devices often send INFO messages when entering Firehose mode
            // Device sends ~20+ messages including: build date, serial, 14 supported functions, end marker
            log('info', '[USB] Reading device startup messages...');
            let messagesRead = 0;
            let foundEndMarker = false;
            for (let i = 0; i < 50; i++) {
                try {
                    const result = await usbManager.transferInQuick(4096, 100); // Fast 100ms timeout
                    if (result.success && result.data && result.data.length > 0) {
                        const text = new TextDecoder().decode(result.data);
                        messagesRead++;
                        log('info', `[Device] ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);

                        // Check for end marker
                        if (text.includes('End of supported functions')) {
                            foundEndMarker = true;
                            log('info', '[USB] Device startup complete');
                            break;
                        }
                    } else {
                        // No more data - wait a bit and try one more time
                        if (i > 3) break; // Only retry a few times at the start
                    }
                } catch {
                    break;
                }
            }
            log('info', `[USB] Read ${messagesRead} startup messages${foundEndMarker ? ' (complete)' : ''}`);

            log('success', '[USB] Ready for Firehose protocol');

            // Step 3: VIP Authentication (if needed)
            // CRITICAL: Must run BEFORE configure for OEM devices (Oppo/OnePlus/Realme)
            // Device will reject configure command if not authenticated first
            // In manual mode, we check if digest/signature files are provided
            const needsVIP = isManualMode
                ? (!!firehoseFiles.digest && !!firehoseFiles.signature)
                : deviceNeedsVIP(selectedDevice);

            log('info', `[VIP] Device: ${selectedDevice?.name ?? 'Manual Mode'}, Brand: ${selectedDevice?.brand ?? 'Unknown'}, AuthMethod: ${(selectedDevice as any)?.authMethod ?? 'manual'}, NeedsVIP: ${needsVIP}`);

            if (needsVIP) {
                if (!firehoseFiles.digest || !firehoseFiles.signature) {
                    throw new Error('VIP authentication required but digest/signature files are missing');
                }

                setStatus('authenticating');
                log('info', '[VIP] Authenticating with OEM server...');

                // Convert ArrayBuffer to Uint8Array for VIP auth
                const digestData = new Uint8Array(firehoseFiles.digest);
                const signatureData = new Uint8Array(firehoseFiles.signature);

                const authResult = await authenticateWithCredentials(usbManager, {
                    digestData,
                    signatureData,
                });

                if (!authResult.success) {
                    throw new Error(authResult.error || 'VIP authentication failed');
                }

                log('success', '[VIP] Authentication successful');
                trackEvent('edl', 'connection_step', 'vip_authenticated');
            } else {
                log('info', '[VIP] Not required for this device');
            }

            // Step 4: Configure Firehose Protocol
            // Now safe to configure after VIP auth (if needed)
            setStatus('uploading');
            log('info', '[Firehose] Configuring protocol...');

            const configResult = await configureFirehose(usbManager);

            if (!configResult.success) {
                throw new Error(configResult.error || 'Firehose configuration failed');
            }

            log('success', '[Firehose] Protocol configured, ready for operations');
            trackEvent('edl', 'connection_step', 'firehose_configured');

            // Step 5: Read Partition Table
            setStatus('reading-partitions');
            log('info', '[Partitions] Reading partition table...');

            const partitionResult = await readPartitionTable(usbManager);

            if (!partitionResult.success || !partitionResult.partitions) {
                throw new Error(partitionResult.error || 'Failed to read partition table');
            }

            setPartitions(partitionResult.partitions);
            log('success', `[Partitions] Found ${partitionResult.partitions.length} partitions`);

            // Complete!
            setStatus('connected');
            setConnected(true);
            log('success', '[Connection] Device ready for operations');
            trackEvent('edl', 'connection_complete', selectedDevice?.name || 'manual', partitionResult.partitions.length);

        } catch (err) {
            // Use statusRef.current to get the latest status value
            const connectionError = parseError(err, statusRef.current);
            setStatus('error');
            setError(connectionError);
            log('error', `[ERROR] ${connectionError.code}: ${connectionError.message}`);
            trackEvent('edl', 'connection_error', connectionError.code);
            setConnected(false);
            throw err;
        }
    }, [
        selectedDevice,
        firehoseLoaded,
        getCachedFirehose,
        usbConnect,
        getUSBManager,
        uploadProgrammer,
        configureFirehose,
        authenticateWithCredentials,
        readPartitionTable,
        setPartitions,
        setConnected,
        log,
        parseError,
        setStatus,
        setError,
    ]);

    /**
     * Disconnect from device.
     */
    const disconnect = useCallback(async (): Promise<void> => {
        try {
            await usbDisconnect();
            setStatus('idle');
            setError(null);
            setConnected(false);
        } catch (err) {
            log('error', `Disconnect error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }, [usbDisconnect, log, setStatus, setError, setConnected]);

    /**
     * Retry connection after error.
     * Resets state and starts flow again.
     */
    const retry = useCallback(() => {
        setError(null);
        setStatus('idle');
        connect().catch(() => {
            // Error already handled in connect()
        });
    }, [connect, setError, setStatus]);

    // NOTE: Removed cleanup disconnect on unmount to preserve connection
    // when navigating between pages. User must explicitly disconnect.
    // Connection is maintained by singleton WebUSBManager.

    return {
        status,
        error,
        connect,
        disconnect,
        retry,
    };
}
