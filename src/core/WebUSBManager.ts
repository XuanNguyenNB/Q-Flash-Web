/**
 * WebUSB Manager
 * 
 * Handles USB device connection, disconnection, and bulk transfers
 * for the Qualcomm 9008 EDL mode device.
 */

import type { TransferResult, USBEndpoints, DeviceInfo } from '../types';

// Qualcomm EDL Mode identifiers
const QUALCOMM_VID = 0x05C6;
const EDL_PID = 0x9008;

// Default endpoints - store just the endpoint NUMBER (1-15)
// WebUSB transferIn/transferOut expects the number, not the full address
const DEFAULT_EP_OUT = 1;
const DEFAULT_EP_IN = 1;  // Same endpoint number, direction is implicit in the function call

// Transfer timeout in milliseconds
// Increased to 300 seconds to handle large transfers (256MB chunks)
const TRANSFER_TIMEOUT_MS = 300000;

export class WebUSBManager {
    private device: USBDevice | null = null;
    private endpoints: USBEndpoints = { in: DEFAULT_EP_IN, out: DEFAULT_EP_OUT };
    private interfaceNumber = 0;

    /**
     * Check if WebUSB is supported in this browser
     */
    static isSupported(): boolean {
        return 'usb' in navigator;
    }

    /**
     * Check if a device is currently connected
     * NOTE: We only check if device exists, not device.opened
     * because device.opened can sometimes return false even when
     * the device is still connected and functional.
     */
    get isConnected(): boolean {
        return this.device !== null;
    }

    /**
     * Get device information
     */
    get deviceInfo(): DeviceInfo | null {
        if (!this.device) return null;
        return {
            vendorId: this.device.vendorId,
            productId: this.device.productId,
            productName: this.device.productName || 'Unknown Device',
            serialNumber: this.device.serialNumber || undefined,
        };
    }

    /**
     * Connect to a Qualcomm 9008 device
     * @returns DeviceInfo if successful, throws Error otherwise
     */
    async connect(): Promise<DeviceInfo> {
        if (!WebUSBManager.isSupported()) {
            throw new Error('WebUSB is not supported in this browser. Please use Chrome or Edge.');
        }

        try {
            // Request device with filter for Qualcomm 9008
            this.device = await navigator.usb.requestDevice({
                filters: [{ vendorId: QUALCOMM_VID, productId: EDL_PID }],
            });

            // Open the device
            await this.device.open();

            // Select configuration (usually configuration 1)
            if (this.device.configuration === null) {
                await this.device.selectConfiguration(1);
            }

            // Find and claim the interface
            await this.findAndClaimInterface();

            // Detect endpoints
            this.detectEndpoints();

            return this.deviceInfo!;
        } catch (error) {
            this.device = null;
            if (error instanceof Error) {
                if (error.name === 'NotFoundError') {
                    throw new Error('Device not found. Ensure device is in EDL mode and WinUSB driver is installed via Zadig.');
                }
                if (error.name === 'NotAllowedError') {
                    throw new Error('Permission denied. User cancelled the device selection dialog or no device was selected.');
                }
                if (error.name === 'SecurityError') {
                    throw new Error('USB access denied. This page must be served over HTTPS or localhost.');
                }
                if (error.name === 'NetworkError') {
                    throw new Error('USB device unavailable. It may be in use by another program (close other flashing tools).');
                }
                if (error.name === 'InvalidStateError') {
                    throw new Error('Device is in an invalid state. Try unplugging and re-plugging the device.');
                }
                // Log the actual error name for debugging unknown errors
                console.error(`USB connect error: ${error.name} - ${error.message}`);
                throw error;
            }
            throw new Error(`Failed to connect: ${String(error)}`);
        }
    }

    /**
     * Reconnect to the device (useful after device reset/re-enumeration)
     */
    async reconnect(): Promise<boolean> {
        if (!WebUSBManager.isSupported()) return false;

        // Try multiple times as device may take time to re-enumerate
        const MAX_RETRIES = 5;
        const RETRY_DELAY = 1000; // 1 second between retries

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Wait for OS to register the new device state
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));

                // Find device among already permitted devices
                const devices = await navigator.usb.getDevices();
                // Match first Qualcomm 9008 device
                const device = devices.find(d => d.vendorId === QUALCOMM_VID && d.productId === EDL_PID);

                if (!device) {
                    console.log(`Reconnect attempt ${attempt}/${MAX_RETRIES}: Device not found`);
                    continue; // Try again
                }

                // Close old handle if it exists
                if (this.device && this.device.opened) {
                    try {
                        await this.device.close();
                    } catch {
                        // Ignore errors when closing old handle
                    }
                }

                this.device = device;

                await this.device.open();
                if (this.device.configuration === null) {
                    await this.device.selectConfiguration(1);
                }
                await this.findAndClaimInterface();
                this.detectEndpoints();

                console.log(`Reconnect successful on attempt ${attempt}`);
                return true;
            } catch (e) {
                console.error(`Reconnect attempt ${attempt}/${MAX_RETRIES} failed:`, e);
                if (attempt === MAX_RETRIES) {
                    return false;
                }
                // Continue to next attempt
            }
        }

        return false;
    }

    /**
     * Disconnect from the device
     * @param forceRelease - If true, also forget the device permission (needed for reboot)
     */
    async disconnect(forceRelease = false): Promise<void> {
        if (!this.device) return;

        try {
            await this.device.releaseInterface(this.interfaceNumber);
            await this.device.close();

            // Force release: forget the device to fully release USB
            // This is needed when we want the device to actually reset
            if (forceRelease && 'forget' in this.device) {
                await (this.device as any).forget();
            }
        } catch (error) {
            console.warn('Error during disconnect:', error);
        } finally {
            this.device = null;
        }
    }

    /**
     * Send data to the device (Bulk OUT transfer)
     */
    async transferOut(data: Uint8Array): Promise<TransferResult> {
        if (!this.device) {
            return { success: false, error: 'Device not connected' };
        }

        // Check if device is opened
        if (!this.device.opened) {
            return { success: false, error: 'Device not opened - connection lost' };
        }

        try {
            const result = await this.withTimeout(
                this.device.transferOut(this.endpoints.out, data as unknown as BufferSource),
                TRANSFER_TIMEOUT_MS,
                'Bulk OUT transfer timeout'
            );

            return {
                success: result.status === 'ok',
                bytesTransferred: result.bytesWritten,
                error: result.status !== 'ok' ? `Transfer status: ${result.status}` : undefined,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Receive data from the device (Bulk IN transfer)
     */
    async transferIn(length: number): Promise<TransferResult> {
        if (!this.device) {
            return { success: false, error: 'Device not connected' };
        }

        // Check if device is opened
        if (!this.device.opened) {
            return { success: false, error: 'Device not opened - connection lost' };
        }

        try {
            const result = await this.withTimeout(
                this.device.transferIn(this.endpoints.in, length),
                TRANSFER_TIMEOUT_MS,
                'Bulk IN transfer timeout'
            );

            if (result.status === 'ok' && result.data) {
                return {
                    success: true,
                    data: new Uint8Array(result.data.buffer),
                    bytesTransferred: result.data.byteLength,
                };
            }

            return {
                success: false,
                error: `Transfer status: ${result.status}`,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Quick receive with short timeout (for draining buffers)
     */
    async transferInQuick(length: number, timeoutMs: number = 500): Promise<TransferResult> {
        if (!this.device) {
            return { success: false, error: 'Device not connected' };
        }

        try {
            const result = await this.withTimeout(
                this.device.transferIn(this.endpoints.in, length),
                timeoutMs,
                'Quick read timeout'
            );

            if (result.status === 'ok' && result.data) {
                return {
                    success: true,
                    data: new Uint8Array(result.data.buffer),
                    bytesTransferred: result.data.byteLength,
                };
            }

            return {
                success: false,
                error: `Transfer status: ${result.status}`,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Reset the device
     */
    async reset(): Promise<void> {
        if (!this.device) return;
        try {
            await this.device.reset();
        } catch (error) {
            console.warn('Device reset failed:', error);
        }
    }

    /**
     * Clear any stale data in receive buffer
     */
    async clearBuffer(): Promise<void> {
        if (!this.device || !this.device.opened) return;

        // Read any pending data to clear the buffer
        for (let i = 0; i < 5; i++) {
            try {
                const result = await Promise.race([
                    this.device.transferIn(this.endpoints.in, 4096),
                    new Promise<null>(resolve => setTimeout(() => resolve(null), 100))
                ]);
                if (!result || !result.data || result.data.byteLength === 0) {
                    break;
                }
            } catch {
                break;
            }
        }
    }

    /**
     * Reset the USB interface by releasing and reclaiming it.
     * This is needed to "unlock" the device after hitting session limits.
     * Unlike device.reset(), this doesn't cause device re-enumeration.
     */
    async resetInterface(): Promise<boolean> {
        if (!this.device || !this.device.opened) return false;

        try {
            // Release the interface
            await this.device.releaseInterface(this.interfaceNumber);

            // Small delay to let device settle
            await new Promise(resolve => setTimeout(resolve, 200));

            // Reclaim the interface
            await this.device.claimInterface(this.interfaceNumber);

            // Clear any pending data
            await this.clearBuffer();

            return true;
        } catch (error) {
            console.error('Interface reset failed:', error);
            return false;
        }
    }

    /**
     * Check if device is still responding
     */
    async ping(): Promise<boolean> {
        if (!this.device || !this.device.opened) return false;

        // Try a small transfer to verify connection
        try {
            await Promise.race([
                this.device.transferIn(this.endpoints.in, 64),
                new Promise<null>(resolve => setTimeout(() => resolve(null), 500))
            ]);
            return true;
        } catch {
            return false;
        }
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * Find and claim the USB interface
     */
    private async findAndClaimInterface(): Promise<void> {
        if (!this.device || !this.device.configuration) {
            throw new Error('Device not properly initialized');
        }

        // Try to find a suitable interface (vendor-specific or CDC)
        const interfaces = this.device.configuration.interfaces;

        for (const iface of interfaces) {
            for (const alt of iface.alternates) {
                // Look for vendor-specific class (0xFF) or CDC Data (0x0A)
                if (alt.interfaceClass === 0xFF || alt.interfaceClass === 0x0A) {
                    this.interfaceNumber = iface.interfaceNumber;
                    await this.device.claimInterface(this.interfaceNumber);
                    return;
                }
            }
        }

        // Fallback: claim interface 0
        this.interfaceNumber = 0;
        await this.device.claimInterface(0);
    }

    /**
     * Detect bulk IN and OUT endpoints
     */
    private detectEndpoints(): void {
        if (!this.device || !this.device.configuration) return;

        const interfaces = this.device.configuration.interfaces;

        for (const iface of interfaces) {
            if (iface.interfaceNumber !== this.interfaceNumber) continue;

            for (const alt of iface.alternates) {
                for (const endpoint of alt.endpoints) {
                    if (endpoint.type === 'bulk') {
                        if (endpoint.direction === 'in') {
                            // Store just the endpoint number, not the full address
                            this.endpoints.in = endpoint.endpointNumber;
                        } else {
                            this.endpoints.out = endpoint.endpointNumber;
                        }
                    }
                }
            }
        }
    }

    /**
     * Wrap a promise with a timeout
     */
    private async withTimeout<T>(
        promise: Promise<T>,
        timeoutMs: number,
        timeoutMessage: string
    ): Promise<T> {
        let timeoutId: ReturnType<typeof setTimeout>;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        });

        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutId!);
            return result;
        } catch (error) {
            clearTimeout(timeoutId!);
            throw error;
        }
    }
}
