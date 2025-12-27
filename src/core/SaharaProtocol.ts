/**
 * Sahara Protocol Handler
 * 
 * Implements the Qualcomm Sahara protocol for uploading the Firehose programmer
 * to the device. This is the first step after connecting to EDL mode.
 * 
 * Protocol Flow:
 * 1. Device sends HELLO packet
 * 2. Host responds with HELLO_RESPONSE
 * 3. Device sends READ_DATA requests for programmer chunks
 * 4. Host sends requested data chunks
 * 5. Device sends END_TRANSFER when done
 * 6. Host sends DONE
 * 7. Device responds with DONE_RESPONSE
 */

import type { WebUSBManager } from './WebUSBManager';
import { SaharaCommand, SaharaState, type SaharaResult, type SaharaHelloPacket, type SaharaReadDataPacket, type SaharaEndTransferPacket } from '../types';

// Sahara protocol constants
const SAHARA_HELLO_LENGTH = 48;

// Sahara mode values
const SAHARA_MODE_IMAGE_TX_PENDING = 0x00;
const SAHARA_MODE_COMMAND = 0x03;

// Maximum packet size for reads
const MAX_READ_SIZE = 0x1000; // 4KB

export class SaharaProtocol {
    private usb: WebUSBManager;
    private programmerData: Uint8Array | null = null;
    private state: SaharaState = SaharaState.IDLE;
    private onLog: (message: string, level?: 'info' | 'debug' | 'error') => void;

    constructor(usb: WebUSBManager, logger?: (message: string, level?: 'info' | 'debug' | 'error') => void) {
        this.usb = usb;
        this.onLog = logger || ((msg) => console.log('[Sahara]', msg));
    }

    /**
     * Get current state
     */
    get currentState(): SaharaState {
        return this.state;
    }

    /**
     * Load programmer file into memory
     */
    loadProgrammer(data: Uint8Array): void {
        this.programmerData = data;
        this.onLog(`Programmer loaded: ${data.length} bytes`);
    }

    /**
     * Execute the Sahara protocol to upload programmer and switch to Firehose mode
     */
    async execute(): Promise<SaharaResult> {
        if (!this.programmerData) {
            return { success: false, state: SaharaState.ERROR, error: 'Programmer file not loaded' };
        }

        try {
            this.state = SaharaState.WAIT_HELLO;

            // Step 1: Wait for HELLO from device
            this.onLog('Waiting for Sahara HELLO...');
            const helloPacket = await this.receiveHello();
            if (!helloPacket) {
                return { success: false, state: SaharaState.ERROR, error: 'Failed to receive HELLO packet' };
            }
            this.onLog(`Received HELLO: version=${helloPacket.version}, mode=${helloPacket.mode}`);

            // Step 2: Send HELLO response
            this.onLog('Sending HELLO response...');
            await this.sendHelloResponse(helloPacket);
            this.state = SaharaState.HELLO_RECEIVED;

            // Step 3: Handle data transfer loop
            this.onLog('Starting programmer upload...');
            this.state = SaharaState.UPLOADING;

            let totalBytesSent = 0;
            let done = false;

            while (!done) {
                // Read next packet from device
                const result = await this.usb.transferIn(MAX_READ_SIZE);
                if (!result.success || !result.data || result.data.length < 8) {
                    return { success: false, state: SaharaState.ERROR, error: 'Failed to read device command' };
                }

                const commandId = new DataView(result.data.buffer).getUint32(0, true);

                switch (commandId) {
                    case SaharaCommand.READ_DATA: {
                        const readPacket = this.parseReadDataPacket(result.data);
                        this.onLog(`READ_DATA: offset=${readPacket.offset}, length=${readPacket.dataLength}`, 'debug');

                        // Send requested data chunk
                        const chunk = this.programmerData.slice(readPacket.offset, readPacket.offset + readPacket.dataLength);
                        const sendResult = await this.usb.transferOut(chunk);
                        if (!sendResult.success) {
                            return { success: false, state: SaharaState.ERROR, error: 'Failed to send data chunk' };
                        }
                        totalBytesSent += chunk.length;

                        // Log progress every 100KB
                        if (totalBytesSent % (100 * 1024) < 1024) {
                            const percent = Math.round((totalBytesSent / this.programmerData.length) * 100);
                            this.onLog(`Uploading: ${percent}% (${totalBytesSent} / ${this.programmerData.length} bytes)`);
                        }
                        break;
                    }

                    case SaharaCommand.READ_DATA_64: {
                        // 64-bit variant: uses BigInt for offset and length
                        const readPacket64 = this.parseReadDataPacket64(result.data);
                        this.onLog(`READ_DATA_64: offset=${readPacket64.offset}, length=${readPacket64.dataLength}`, 'debug');

                        // Send requested data chunk
                        const offset = Number(readPacket64.offset);
                        const length = Number(readPacket64.dataLength);
                        const chunk = this.programmerData.slice(offset, offset + length);
                        const sendResult = await this.usb.transferOut(chunk);
                        if (!sendResult.success) {
                            return { success: false, state: SaharaState.ERROR, error: 'Failed to send data chunk' };
                        }
                        totalBytesSent += chunk.length;

                        // Log progress every 100KB
                        if (totalBytesSent % (100 * 1024) < 1024) {
                            const percent = Math.round((totalBytesSent / this.programmerData.length) * 100);
                            this.onLog(`Uploading: ${percent}% (${totalBytesSent} / ${this.programmerData.length} bytes)`);
                        }
                        break;
                    }

                    case SaharaCommand.END_TRANSFER: {
                        const endPacket = this.parseEndTransferPacket(result.data);
                        if (endPacket.status !== 0) {
                            const errorName = this.getSaharaErrorName(endPacket.status);
                            return {
                                success: false,
                                state: SaharaState.ERROR,
                                error: `Sahara error ${endPacket.status} (0x${endPacket.status.toString(16)}): ${errorName}`
                            };
                        }
                        this.onLog(`Upload complete: ${totalBytesSent} bytes sent`);
                        done = true;
                        break;
                    }

                    case SaharaCommand.CMD_READY: {
                        this.onLog('Device ready for command mode');
                        done = true;
                        break;
                    }

                    default:
                        this.onLog(`Unknown command: 0x${commandId.toString(16)}`, 'debug');
                }
            }

            this.state = SaharaState.UPLOAD_COMPLETE;

            // Step 4: Send DONE
            this.onLog('Sending DONE...');
            await this.sendDone();

            // Step 5: Wait for DONE response
            const doneResult = await this.usb.transferIn(MAX_READ_SIZE);
            if (!doneResult.success || !doneResult.data) {
                // Some devices don't send DONE_RESP, so we accept this
                this.onLog('No DONE response (may be normal for some devices)', 'debug');
            } else {
                const doneCommandId = new DataView(doneResult.data.buffer).getUint32(0, true);
                if (doneCommandId === SaharaCommand.DONE_RESP) {
                    this.onLog('Received DONE response');
                }
            }

            this.state = SaharaState.DONE;
            this.onLog('Sahara protocol complete - Device switching to Firehose mode');

            return { success: true, state: SaharaState.DONE };

        } catch (error) {
            this.state = SaharaState.ERROR;
            return {
                success: false,
                state: SaharaState.ERROR,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * Receive and parse HELLO packet from device
     * Includes retry logic since device may have already sent HELLO
     */
    private async receiveHello(): Promise<SaharaHelloPacket | null> {
        const maxRetries = 5;
        const retryDelayMs = 500;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (attempt > 0) {
                this.onLog(`Retry ${attempt}/${maxRetries - 1}: Waiting for HELLO...`, 'debug');
            }

            const result = await this.usb.transferIn(SAHARA_HELLO_LENGTH);

            if (!result.success) {
                // Transfer failed, wait and retry
                await this.delay(retryDelayMs);
                continue;
            }

            if (!result.data || result.data.length === 0) {
                // No data, wait and retry
                await this.delay(retryDelayMs);
                continue;
            }

            // Check if we got enough data
            if (result.data.length < 8) {
                this.onLog(`Received ${result.data.length} bytes, too short`, 'debug');
                await this.delay(retryDelayMs);
                continue;
            }

            const view = new DataView(result.data.buffer);
            const command = view.getUint32(0, true);

            if (command !== SaharaCommand.HELLO) {
                this.onLog(`Expected HELLO (0x01), got 0x${command.toString(16)}`, 'debug');
                // Might be leftover data, flush and retry
                await this.delay(retryDelayMs);
                continue;
            }

            // We got a valid HELLO!
            if (result.data.length < SAHARA_HELLO_LENGTH) {
                this.onLog(`HELLO packet too short: ${result.data.length} bytes`, 'error');
                return null;
            }

            return {
                command: SaharaCommand.HELLO,
                length: view.getUint32(4, true),
                version: view.getUint32(8, true),
                versionSupported: view.getUint32(12, true),
                maxCommandPacketSize: view.getUint32(16, true),
                mode: view.getUint32(20, true),
                reserved: new Uint8Array(result.data.buffer, 24, 24),
            };
        }

        return null;
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Send HELLO response to device
     */
    private async sendHelloResponse(hello: SaharaHelloPacket): Promise<void> {
        const buffer = new ArrayBuffer(48);
        const view = new DataView(buffer);

        view.setUint32(0, SaharaCommand.HELLO_RESP, true);  // command
        view.setUint32(4, 48, true);                         // length
        view.setUint32(8, hello.version, true);              // version
        view.setUint32(12, hello.versionSupported, true);    // version_supported
        view.setUint32(16, 0, true);                         // status (0 = success)
        // mode: keep same mode or switch to image tx
        view.setUint32(20, hello.mode === SAHARA_MODE_COMMAND ? SAHARA_MODE_COMMAND : SAHARA_MODE_IMAGE_TX_PENDING, true);
        // reserved bytes (24-47) are already 0

        const result = await this.usb.transferOut(new Uint8Array(buffer));
        if (!result.success) {
            throw new Error('Failed to send HELLO response');
        }
    }

    /**
     * Parse READ_DATA packet (32-bit)
     */
    private parseReadDataPacket(data: Uint8Array): SaharaReadDataPacket {
        const view = new DataView(data.buffer);
        return {
            command: SaharaCommand.READ_DATA,
            length: view.getUint32(4, true),
            imageId: view.getUint32(8, true),
            offset: view.getUint32(12, true),
            dataLength: view.getUint32(16, true),
        };
    }

    /**
     * Parse READ_DATA_64 packet (64-bit offsets)
     * Format: command(4) + length(4) + imageId(8) + offset(8) + dataLength(8)
     */
    private parseReadDataPacket64(data: Uint8Array): { offset: bigint; dataLength: bigint } {
        const view = new DataView(data.buffer);
        return {
            offset: view.getBigUint64(16, true),
            dataLength: view.getBigUint64(24, true),
        };
    }

    /**
     * Parse END_TRANSFER packet
     */
    private parseEndTransferPacket(data: Uint8Array): SaharaEndTransferPacket {
        const view = new DataView(data.buffer);
        return {
            command: SaharaCommand.END_TRANSFER,
            length: view.getUint32(4, true),
            imageId: view.getUint32(8, true),
            status: view.getUint32(12, true),
        };
    }

    /**
     * Send DONE packet to device
     */
    private async sendDone(): Promise<void> {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);

        view.setUint32(0, SaharaCommand.DONE, true);  // command
        view.setUint32(4, 8, true);                    // length

        const result = await this.usb.transferOut(new Uint8Array(buffer));
        if (!result.success) {
            throw new Error('Failed to send DONE');
        }
    }

    /**
     * Get human-readable Sahara error name
     */
    private getSaharaErrorName(status: number): string {
        const errors: Record<number, string> = {
            0x00: 'Success',
            0x01: 'Invalid command',
            0x02: 'Protocol mismatch',
            0x03: 'Invalid target protocol',
            0x04: 'Invalid host protocol',
            0x05: 'Invalid packet size',
            0x06: 'Unexpected image ID',
            0x07: 'Invalid header size',
            0x08: 'Invalid data size',
            0x09: 'Invalid image type',
            0x0A: 'Invalid TX length',
            0x0B: 'Invalid RX length',
            0x0C: 'General TX/RX error',
            0x0D: 'Unsupported number of program headers',
            0x0E: 'Invalid program header size',
            0x0F: 'Multiple shared segments',
            0x10: 'Uninitialized program header location',
            0x11: 'Invalid destination address',
            0x12: 'Invalid image header data size',
            0x13: 'Invalid ELF header',
            0x14: 'Unknown host error',
            0x15: 'Timeout receiving',
            0x16: 'Timeout transmitting',
            0x17: 'Invalid host mode',
            0x18: 'Invalid memory read',
            0x19: 'Invalid data size request',
            0x1A: 'Memory debug not supported',
            0x1B: 'Invalid mode switch',
            0x1C: 'Command execution failure',
            0x1D: 'Invalid command parameter',
            0x1E: 'Command unsupported',
            0x1F: 'Invalid client command',
            0x20: 'Hash table auth failure',
            0x21: 'HASH VERIFICATION FAILURE - Programmer signature invalid for this device',
            0x22: 'Hash table not found',
            0x23: 'Target init failure',
            0x24: 'Image auth failure',
        };
        return errors[status] || `Unknown error (0x${status.toString(16)})`;
    }
}
