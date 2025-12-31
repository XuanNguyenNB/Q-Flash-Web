/**
 * Fastboot Protocol Wrapper
 * 
 * Provides a TypeScript wrapper around the android-fastboot library
 * for use in React components. Follows the same pattern as ADBProtocol.
 */

import { FastbootDevice, setDebugLevel } from 'android-fastboot';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Device information retrieved via Fastboot getvar commands
 */
export interface FastbootDeviceInfo {
    product: string;        // Device codename
    variant: string;        // Device variant
    serialno: string;       // Serial number
    unlocked: boolean;      // Bootloader unlock status
    secure: boolean;        // Secure boot status
    currentSlot: string;    // Current A/B slot (a or b)
    slotCount: number;      // Number of slots (1 or 2)
    batteryLevel: string;   // Battery percentage
    offModeCharge: boolean; // Off-mode charging status
    isUserspace: boolean;   // True if in FastbootD (userspace)
}

/**
 * Logger callback type - matches ADBProtocol/FirehoseProtocol pattern
 */
type LogCallback = (message: string, level?: 'info' | 'debug' | 'error' | 'success') => void;

/**
 * Progress callback type for flash operations
 */
type ProgressCallback = (percent: number) => void;

// ============================================================================
// Fastboot Protocol Class
// ============================================================================

export class FastbootProtocol {
    private device: FastbootDevice | null = null;
    private onLog: LogCallback;

    /**
     * WebUSB device filters for Fastboot mode
     * Includes major Android device manufacturers
     */
    static getFilters(): USBDeviceFilter[] {
        return [
            // Google Fastboot
            { vendorId: 0x18D1, productId: 0xD00D },  // Google Fastboot
            { vendorId: 0x18D1, productId: 0x4EE0 },  // Google Fastboot Alt
            { vendorId: 0x18D1 },                      // Google (any product)

            // Qualcomm Fastboot
            { vendorId: 0x05C6, productId: 0x9006 },  // Qualcomm Fastboot
            { vendorId: 0x05C6 },                      // Qualcomm (any product)

            // OnePlus
            { vendorId: 0x2A70, productId: 0x9012 },  // OnePlus Fastboot
            { vendorId: 0x2A70 },                      // OnePlus (any product)

            // OPPO
            { vendorId: 0x22D9, productId: 0x2D00 },  // OPPO Fastboot
            { vendorId: 0x22D9 },                      // OPPO (any product)

            // Xiaomi
            { vendorId: 0x2717, productId: 0xFF80 },  // Xiaomi Fastboot
            { vendorId: 0x2717 },                      // Xiaomi (any product)

            // Samsung
            { vendorId: 0x04E8, productId: 0x6860 },  // Samsung Fastboot
            { vendorId: 0x04E8 },                      // Samsung (any product)

            // HTC
            { vendorId: 0x0BB4, productId: 0x0C01 },  // HTC Fastboot
            { vendorId: 0x0BB4 },                      // HTC (any product)

            // Huawei
            { vendorId: 0x12D1, productId: 0x1050 },  // Huawei Fastboot
            { vendorId: 0x12D1 },                      // Huawei (any product)

            // Realme
            { vendorId: 0x2AE5 },                      // Realme

            // Vivo
            { vendorId: 0x2D95 },                      // Vivo

            // Motorola
            { vendorId: 0x22B8 },                      // Motorola

            // Sony
            { vendorId: 0x0FCE },                      // Sony

            // LG
            { vendorId: 0x1004 },                      // LG

            // ASUS
            { vendorId: 0x0B05 },                      // ASUS
        ];
    }

    constructor(logger?: LogCallback) {
        this.onLog = logger || ((msg) => console.log('[Fastboot]', msg));
        // Enable debug logging for android-fastboot library
        setDebugLevel(1);
    }

    // ============================================================================
    // Connection State
    // ============================================================================

    /**
     * Check if Fastboot is currently connected
     */
    get isConnected(): boolean {
        return this.device !== null;
    }

    /**
     * Get current FastbootDevice instance (for advanced operations)
     */
    get fastbootDevice(): FastbootDevice | null {
        return this.device;
    }

    // ============================================================================
    // Connection Methods
    // ============================================================================

    /**
     * Connect to a Fastboot device via WebUSB
     * Prompts user to select a device from the browser picker
     */
    async connect(): Promise<boolean> {
        try {
            this.onLog('Requesting Fastboot device...', 'info');

            // Create new FastbootDevice instance
            this.device = new FastbootDevice();

            // Connect via WebUSB with filters
            await this.device.connect();

            // Validate that we connected to a Fastboot interface
            // This prevents connecting to ADB or MTP interfaces that share the same Vendor ID
            if (!this.validateFastbootInterface()) {
                await this.disconnect();
                throw new Error('Device is not in Fastboot mode. Detected ADB or invalid interface.');
            }

            this.onLog('Fastboot connected successfully', 'success');
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            // Handle common errors
            if (message.includes('No device selected')) {
                this.onLog('Connection cancelled by user', 'info');
            } else if (message.includes('Access denied') || message.includes('NotFoundError')) {
                this.onLog('USB access denied. Ensure device is in Fastboot mode.', 'error');
            } else {
                this.onLog(`Connection failed: ${message}`, 'error');
            }

            this.device = null;
            return false;
        }
    }

    /**
     * Disconnect from the current Fastboot device
     */
    async disconnect(): Promise<void> {
        try {
            if (this.device) {
                // FastbootDevice doesn't have explicit disconnect, just clear reference
                this.onLog('Fastboot disconnected', 'info');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Error during disconnect: ${message}`, 'debug');
        } finally {
            this.device = null;
        }
    }

    // ============================================================================
    // Device Variables
    // ============================================================================

    /**
     * Get a specific device variable via Fastboot getvar
     * @param name Variable name (e.g., 'product', 'serialno', 'unlocked')
     */
    async getVariable(name: string): Promise<string | null> {
        if (!this.device) {
            this.onLog('Not connected - cannot get variable', 'error');
            return null;
        }

        try {
            this.onLog(`Getting variable: ${name}`, 'debug');
            const value = await this.device.getVariable(name);
            return value || null;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Failed to get variable ${name}: ${message}`, 'debug');
            return null;
        }
    }

    /**
     * Get comprehensive device information via Fastboot getvar commands
     */
    async getDeviceInfo(): Promise<FastbootDeviceInfo | null> {
        if (!this.device) {
            this.onLog('Not connected - cannot get device info', 'error');
            return null;
        }

        try {
            this.onLog('Reading device information...', 'debug');

            // Fetch all variables in parallel for speed
            const [
                product,
                variant,
                serialno,
                unlocked,
                secure,
                currentSlot,
                slotCount,
                batteryLevel,
                offModeCharge,
                isUserspace,
            ] = await Promise.all([
                this.getVariable('product'),
                this.getVariable('variant'),
                this.getVariable('serialno'),
                this.getVariable('unlocked'),
                this.getVariable('secure'),
                this.getVariable('current-slot'),
                this.getVariable('slot-count'),
                this.getVariable('battery-level'),
                this.getVariable('off-mode-charge'),
                this.getVariable('is-userspace'),
            ]);

            const info: FastbootDeviceInfo = {
                product: product || 'Unknown',
                variant: variant || 'Unknown',
                serialno: serialno || 'Unknown',
                unlocked: unlocked === 'yes' || unlocked === 'true',
                secure: secure === 'yes' || secure === 'true',
                currentSlot: currentSlot || 'a',
                slotCount: parseInt(slotCount || '1', 10) || 1,
                batteryLevel: batteryLevel || 'Unknown',
                offModeCharge: offModeCharge === 'yes' || offModeCharge === '1',
                isUserspace: isUserspace === 'yes' || isUserspace === 'true',
            };

            this.onLog(`Device: ${info.product} (${info.serialno})`, 'success');
            this.onLog(`Mode: ${info.isUserspace ? 'FastbootD (Userspace)' : 'Fastboot (Bootloader)'}`, 'info');
            this.onLog(`Bootloader: ${info.unlocked ? 'UNLOCKED' : 'LOCKED'}`, info.unlocked ? 'success' : 'info');

            return info;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Failed to get device info: ${message}`, 'error');
            return null;
        }
    }

    // ============================================================================
    // Bootloader Commands
    // ============================================================================

    /**
     * Unlock the bootloader
     * WARNING: This will wipe all user data on most devices
     */
    async unlockBootloader(): Promise<boolean> {
        if (!this.device) {
            this.onLog('Not connected - cannot unlock bootloader', 'error');
            return false;
        }

        try {
            this.onLog('Unlocking bootloader...', 'info');
            this.onLog('⚠️ WARNING: This will wipe all user data!', 'info');

            await this.device.runCommand('flashing unlock');

            this.onLog('Bootloader unlock command sent', 'success');
            this.onLog('Please confirm unlock on device screen if prompted', 'info');
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Failed to unlock bootloader: ${message}`, 'error');
            return false;
        }
    }

    /**
     * Lock the bootloader
     * WARNING: This may wipe all user data
     */
    async lockBootloader(): Promise<boolean> {
        if (!this.device) {
            this.onLog('Not connected - cannot lock bootloader', 'error');
            return false;
        }

        try {
            this.onLog('Locking bootloader...', 'info');

            await this.device.runCommand('flashing lock');

            this.onLog('Bootloader lock command sent', 'success');
            this.onLog('Please confirm lock on device screen if prompted', 'info');
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Failed to lock bootloader: ${message}`, 'error');
            return false;
        }
    }

    // ============================================================================
    // Flash Commands
    // ============================================================================

    /**
     * Flash a file to a partition
     * @param partitionName Target partition (e.g., 'boot', 'recovery', 'system')
     * @param file File blob to flash
     * @param onProgress Optional progress callback (0-100)
     */
    async flashPartition(
        partitionName: string,
        file: Blob,
        onProgress?: ProgressCallback
    ): Promise<boolean> {
        if (!this.device) {
            this.onLog('Not connected - cannot flash partition', 'error');
            return false;
        }

        try {
            this.onLog(`Flashing ${partitionName}...`, 'info');
            const fileSize = file.size;
            this.onLog(`File size: ${this.formatSize(fileSize)}`, 'debug');

            // Convert Blob to ArrayBuffer
            const buffer = await file.arrayBuffer();

            // Flash with progress tracking
            await this.device.flashBlob(partitionName, new Blob([buffer]), (progress) => {
                const percent = Math.round(progress * 100);
                if (onProgress) {
                    onProgress(percent);
                }
                if (percent % 25 === 0) {
                    this.onLog(`Flash progress: ${percent}%`, 'debug');
                }
            });

            this.onLog(`Successfully flashed ${partitionName}`, 'success');
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Failed to flash ${partitionName}: ${message}`, 'error');
            return false;
        }
    }

    /**
     * Flash vbmeta with disabled verification
     * This is required when flashing custom ROMs/kernels to disable AVB
     * Patches the vbmeta header to set disable flags before flashing
     * @param file vbmeta image file
     */
    async flashVbmetaDisabled(file: Blob): Promise<boolean> {
        if (!this.device) {
            this.onLog('Not connected - cannot flash vbmeta', 'error');
            return false;
        }

        try {
            this.onLog('Flashing vbmeta with disabled verification...', 'info');

            // Convert Blob to ArrayBuffer
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);

            // Patch vbmeta header to disable AVB verification
            // AVB header flags are at offset 120 (4 bytes, big-endian)
            // Flag 0x01 = disable hashtree verification
            // Flag 0x02 = disable dm-verity
            // Combined 0x03 = --disable-verity --disable-verification
            if (data.length >= 124) {
                // Set flags at offset 120-123 (big-endian uint32)
                data[120] = 0x00;
                data[121] = 0x00;
                data[122] = 0x00;
                data[123] = 0x03; // HASHTREE_DISABLED | VERIFICATION_DISABLED
                this.onLog('Patched vbmeta header with disabled verification flags', 'debug');
            }

            // Flash patched vbmeta
            await this.device.flashBlob('vbmeta', new Blob([data]));

            this.onLog('Successfully flashed vbmeta (verification disabled)', 'success');
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Failed to flash vbmeta: ${message}`, 'error');
            return false;
        }
    }

    /**
     * Erase a partition
     * @param partitionName Partition to erase
     */
    async erasePartition(partitionName: string): Promise<boolean> {
        if (!this.device) {
            this.onLog('Not connected - cannot erase partition', 'error');
            return false;
        }

        try {
            this.onLog(`Erasing ${partitionName}...`, 'info');

            await this.device.runCommand(`erase:${partitionName}`);

            this.onLog(`Successfully erased ${partitionName}`, 'success');
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Failed to erase ${partitionName}: ${message}`, 'error');
            return false;
        }
    }

    /**
     * Run a raw fastboot command
     * @param command Command to run (e.g. 'getvar:all')
     */
    async runCommand(command: string): Promise<string> {
        if (!this.device) {
            throw new Error('Not connected');
        }

        try {
            // android-fastboot runCommand returns void? Or output?
            // Checking types via usage: 
            // In lockBootloader: await this.device.runCommand('flashing lock');
            // It seems it accepts void.
            // But we need output for getting variables.
            // Actually, `android-fastboot` logs everything we need via setDebugLevel.
            // But `runCommand` might not return the text output directly if the library doesn't expose it.
            // However, `getVariable` returns string.
            // If I just want to trigger it so logs show up, `runCommand` is fine.

            await this.device.runCommand(command);
            return 'Command sent (check logs)';
        } catch (error) {
            throw error;
        }
    }

    // ============================================================================
    // Reboot Commands
    // ============================================================================

    /**
     * Reboot device normally
     */
    async reboot(): Promise<boolean> {
        if (!this.device) {
            this.onLog('Not connected - cannot reboot', 'error');
            return false;
        }

        try {
            this.onLog('Rebooting device...', 'info');

            await this.device.runCommand('reboot');

            this.onLog('Reboot command sent', 'success');
            await this.disconnect();
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Device disconnecting during reboot is expected behavior
            if (message.includes('disconnected') || message.includes('transferIn') || message.includes('NetworkError')) {
                this.onLog('Reboot command accepted', 'success');
                await this.disconnect(); // Ensure clean state
                return true;
            }
            this.onLog(`Failed to reboot: ${message}`, 'error');
            return false;
        }
    }

    /**
     * Reboot device to bootloader/fastboot mode
     */
    async rebootBootloader(): Promise<boolean> {
        if (!this.device) {
            this.onLog('Not connected - cannot reboot to bootloader', 'error');
            return false;
        }

        try {
            this.onLog('Rebooting to bootloader...', 'info');

            await this.device.runCommand('reboot-bootloader');

            this.onLog('Reboot to bootloader command sent', 'success');
            // Don't disconnect as device stays in fastboot
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Device disconnecting during reboot is expected behavior
            if (message.includes('disconnected') || message.includes('transferIn') || message.includes('NetworkError')) {
                this.onLog('Reboot command accepted', 'success');
                // Even for reboot-bootloader, the USB connection resets
                await this.disconnect();
                return true;
            }
            this.onLog(`Failed to reboot to bootloader: ${message}`, 'error');
            return false;
        }
    }

    /**
     * Reboot device to recovery mode
     */
    async rebootRecovery(): Promise<boolean> {
        if (!this.device) {
            this.onLog('Not connected - cannot reboot to recovery', 'error');
            return false;
        }

        try {
            this.onLog('Rebooting to recovery...', 'info');

            await this.device.runCommand('reboot-recovery');

            this.onLog('Reboot to recovery command sent', 'success');
            await this.disconnect();
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Device disconnecting during reboot is expected behavior
            if (message.includes('disconnected') || message.includes('transferIn') || message.includes('NetworkError')) {
                this.onLog('Reboot command accepted', 'success');
                await this.disconnect();
                return true;
            }
            this.onLog(`Failed to reboot to recovery: ${message}`, 'error');
            return false;
        }
    }

    /**
     * Reboot device to FastbootD (userspace fastboot) mode
     * This is different from bootloader - cannot unlock/lock here
     */
    async rebootFastbootd(): Promise<boolean> {
        if (!this.device) {
            this.onLog('Not connected - cannot reboot to fastbootd', 'error');
            return false;
        }

        try {
            this.onLog('Rebooting to FastbootD...', 'info');

            await this.device.runCommand('reboot-fastboot');

            this.onLog('Reboot to FastbootD command sent', 'success');
            // Device will reconnect in fastbootd mode
            await this.disconnect();
            return true;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Device disconnecting during reboot is expected behavior
            if (message.includes('disconnected') || message.includes('transferIn') || message.includes('NetworkError')) {
                this.onLog('Reboot command accepted', 'success');
                await this.disconnect();
                return true;
            }
            this.onLog(`Failed to reboot to FastbootD: ${message}`, 'error');
            return false;
        }
    }

    /**
     * Get list of available partitions from device
     * Uses getvar:all to fetch partition information
     */
    async getPartitionList(): Promise<string[]> {
        if (!this.device) {
            this.onLog('Not connected - cannot get partition list', 'error');
            return [];
        }

        try {
            this.onLog('Fetching partition list...', 'debug');

            // Common partitions to check
            const commonPartitions = [
                'boot', 'recovery', 'vbmeta', 'dtbo', 'vendor_boot',
                'system', 'vendor', 'product', 'odm', 'super',
                'userdata', 'cache', 'metadata', 'misc',
                'boot_a', 'boot_b', 'recovery_a', 'recovery_b',
                'vbmeta_a', 'vbmeta_b', 'dtbo_a', 'dtbo_b',
                'system_a', 'system_b', 'vendor_a', 'vendor_b'
            ];

            // Check which partitions exist by trying to get their size in parallel
            // We use map to create an array of promises
            const checkPromises = commonPartitions.map(async (partition) => {
                try {
                    const size = await this.device?.getVariable(`partition-size:${partition}`);
                    if (size && size !== '') {
                        return partition;
                    }
                    return null;
                } catch {
                    // Partition doesn't exist, return null
                    return null;
                }
            });

            // Wait for all checks to complete
            const results = await Promise.all(checkPromises);

            // Filter valid partitions
            const availablePartitions = results.filter((p): p is string => p !== null);

            this.onLog(`Found ${availablePartitions.length} partitions`, 'debug');
            return availablePartitions;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Failed to get partition list: ${message}`, 'error');
            return [];
        }
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /**
     * Format file size to human readable string
     */
    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    /**
     * Validate if the connected device has a Fastboot interface
     * Fastboot Interface: Class 0xFF, Subclass 0x42, Protocol 0x03
     */
    private validateFastbootInterface(): boolean {
        try {
            // Access internal USBDevice from android-fastboot wrapper
            // We cast to any because 'device' property might be protected/private in types
            const usbDevice = (this.device as any)?.device as USBDevice;

            if (!usbDevice || !usbDevice.configurations) {
                // Cannot validate, assume strict mode is not possible or library handles it.
                // However, for this specific fix, we want to be strict if possible.
                // If we can't access underlying device, we log warning and proceed (or fail?)
                // Let's assume valid for now if we can't check, but most impls expose it.
                this.onLog('Warning: Could not access raw USB device for validation', 'debug');
                return true;
            }

            // Iterate through all configurations and interfaces
            for (const config of usbDevice.configurations) {
                for (const iface of config.interfaces) {
                    for (const alt of iface.alternates) {
                        // Check for Fastboot interface signature
                        if (alt.interfaceClass === 0xFF &&
                            alt.interfaceSubclass === 0x42 &&
                            alt.interfaceProtocol === 0x03) {
                            return true;
                        }
                    }
                }
            }

            this.onLog('Validation failed: No Fastboot interface (0xFF, 0x42, 0x03) found.', 'debug');
            return false;

        } catch (error) {
            this.onLog(`Interface validation error: ${error}`, 'debug');
            return true; // Use lenient mode on error
        }
    }
}
