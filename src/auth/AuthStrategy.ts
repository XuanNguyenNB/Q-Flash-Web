/**
 * Oppo VIP Authentication Strategy
 * 
 * Implements the proprietary VIP handshake for Oppo devices.
 * This authentication is required before Firehose commands will work.
 * 
 * Flow from fh_loader debug log:
 * 1. Send digest file (raw binary) → Device responds with INFO messages
 * 2. Send verify XML command → Device responds with ACK  
 * 3. Send signature file (raw binary) → Device responds with "verify passed"
 * 4. Send sha256init XML → Device responds with ACK
 * 
 * Note: Device shows "VIP is enabled" from loader - no init_config needed.
 */

import type { WebUSBManager } from '../core/WebUSBManager';
import type { VipAuthResult } from '../types';
import { bytesToString, stringToBytes } from '../utils/xml';

// Read buffer size - match native tool
const READ_BUFFER_SIZE = 8192;

export interface AuthStrategy {
    execute(usb: WebUSBManager): Promise<VipAuthResult>;
}

export class OppoVipAuth implements AuthStrategy {
    private digestData: Uint8Array;
    private signatureData: Uint8Array;
    private onLog: (message: string, level?: 'info' | 'debug' | 'error' | 'success') => void;

    constructor(
        digestData: Uint8Array,
        signatureData: Uint8Array,
        logger?: (message: string, level?: 'info' | 'debug' | 'error' | 'success') => void
    ) {
        this.digestData = digestData;
        this.signatureData = signatureData;
        this.onLog = logger || ((msg) => console.log('[VIP]', msg));
    }

    /**
     * Execute the full VIP handshake
     */
    async execute(usb: WebUSBManager): Promise<VipAuthResult> {
        try {
            this.onLog('Starting VIP handshake...');

            // CRITICAL: Drain all pending IN data FIRST
            this.onLog('Draining device buffer...', 'debug');
            await this.drainBuffer(usb);

            // Step 1: Send digest file (raw binary like fh_loader --signeddigests)
            this.onLog('Step 1/4: Sending Digest file...');
            const digestResult = await this.sendDigest(usb);
            if (!digestResult.success) {
                return digestResult;
            }

            // Step 2: Send verify command
            this.onLog('Step 2/4: Sending Verify...');
            const verifyResult = await this.sendVerify(usb);
            if (!verifyResult.success) {
                return verifyResult;
            }

            // Step 3: Send signature file (raw binary)
            this.onLog('Step 3/4: Sending Signature file...');
            const signatureResult = await this.sendSignature(usb);
            if (!signatureResult.success) {
                return signatureResult;
            }

            // Step 4: Send sha256init command to finalize
            this.onLog('Step 4/4: Sending SHA256Init...');
            const sha256Result = await this.sendSha256Init(usb);
            if (!sha256Result.success) {
                return sha256Result;
            }

            this.onLog('VIP Handshake complete!', 'success');
            return { success: true };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // =========================================================================
    // Handshake Steps
    // =========================================================================

    /**
     * Step 1: Send digest file as raw binary
     */
    private async sendDigest(usb: WebUSBManager): Promise<VipAuthResult> {
        const digestSize = this.digestData.byteLength;
        this.onLog(`Sending digest: ${digestSize} bytes`, 'debug');

        const result = await usb.transferOut(this.digestData);
        if (!result.success) {
            return { success: false, step: 'digest', error: result.error };
        }
        this.onLog(`Digest sent (${result.bytesTransferred} bytes)`, 'debug');

        // Read device response (quick - device often doesn't respond)
        const response = await this.readResponse(usb, 300, 'digest');

        if (response.length > 0) {
            if (response.includes('VIP is enabled')) {
                this.onLog('VIP enabled confirmed', 'success');
            }
            if (response.includes('Signature')) {
                this.onLog('Signature banner received', 'success');
            }
            this.onLog(`RX (${response.length} bytes): ${response.substring(0, 300)}`, 'debug');
        } else {
            this.onLog('RX: (no response)', 'debug');
        }

        if (response.includes('ERROR') && !response.includes('VIP')) {
            return { success: false, step: 'digest', error: 'Digest rejected' };
        }

        return { success: true };
    }

    /**
     * Step 2: Send verify command
     */
    private async sendVerify(usb: WebUSBManager): Promise<VipAuthResult> {
        const command = '<?xml version="1.0"?><data><verify value="ping" EnableVip="1"/></data>';
        this.onLog(`TX: ${command}`, 'debug');

        const result = await usb.transferOut(stringToBytes(command));
        if (!result.success) {
            return { success: false, step: 'verify', error: result.error };
        }

        const response = await this.readResponse(usb, 200, 'verify');
        this.onLog(`RX (${response.length} bytes): ${response.substring(0, 200) || '(no response)'}`, 'debug');

        if (response.includes('ACK') || response.includes('Calling handler for verify')) {
            this.onLog('Verify accepted', 'success');
        }

        if (response.includes('NAK') && response.includes('ERROR')) {
            return { success: false, step: 'verify', error: 'Verification failed' };
        }

        return { success: true };
    }

    /**
     * Step 3: Send signature file as raw binary
     */
    private async sendSignature(usb: WebUSBManager): Promise<VipAuthResult> {
        const signSize = this.signatureData.byteLength;
        this.onLog(`Sending signature: ${signSize} bytes`, 'debug');

        const result = await usb.transferOut(this.signatureData);
        if (!result.success) {
            return { success: false, step: 'signature', error: result.error };
        }
        this.onLog('Signature sent', 'debug');

        const response = await this.readResponse(usb, 200, 'signature');
        this.onLog(`RX (${response.length} bytes): ${response.substring(0, 200) || '(no response)'}`, 'debug');

        if (response.includes('verify passed')) {
            this.onLog('Signature verified!', 'success');
        }
        if (response.includes('firehose work')) {
            this.onLog('Firehose ready', 'success');
        }

        if (response.includes('NAK') && !response.includes('verify passed')) {
            return { success: false, step: 'signature', error: 'Signature rejected' };
        }

        return { success: true };
    }

    /**
     * Step 4: Send SHA256Init to finalize handshake
     */
    private async sendSha256Init(usb: WebUSBManager): Promise<VipAuthResult> {
        const command = '<?xml version="1.0"?><data><sha256init Verbose="1"/></data>';
        this.onLog(`TX: ${command}`, 'debug');

        const result = await usb.transferOut(stringToBytes(command));
        if (!result.success) {
            return { success: false, step: 'sha256init', error: result.error };
        }

        const response = await this.readResponse(usb, 200, 'sha256init');
        this.onLog(`RX (${response.length} bytes): ${response.substring(0, 200) || '(no response)'}`, 'debug');

        if (response.includes('ACK') || response.includes('Calling handler for sha256init')) {
            this.onLog('SHA256 init done', 'success');
        }

        if (response.includes('NAK') && response.includes('ERROR')) {
            return { success: false, step: 'sha256init', error: 'SHA256 init failed' };
        }

        return { success: true };
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    /**
     * Read response with retry
     */
    private async readResponse(usb: WebUSBManager, maxWaitMs: number, step: string): Promise<string> {
        let fullResponse = '';
        let noDataCount = 0;
        const startTime = Date.now();
        const readTimeout = 100; // Quick read - device often silent

        this.onLog(`Reading response for ${step}...`, 'debug');

        while (Date.now() - startTime < maxWaitMs) {
            const result = await usb.transferInQuick(READ_BUFFER_SIZE, readTimeout);

            if (!result.success || !result.data || result.data.length === 0) {
                noDataCount++;
                if (noDataCount >= 2) break; // Quick exit - device is silent
                continue;
            }

            noDataCount = 0;
            const chunk = bytesToString(result.data);
            fullResponse += chunk;
            this.onLog(`Got ${result.data.length} bytes`, 'debug');

            // Terminal conditions
            if (chunk.includes('ACK') || chunk.includes('NAK') || chunk.includes('Signature')) {
                await this.delay(100);
                // Read any trailing data
                for (let i = 0; i < 3; i++) {
                    const more = await usb.transferInQuick(READ_BUFFER_SIZE, 300);
                    if (more.success && more.data && more.data.length > 0) {
                        fullResponse += bytesToString(more.data);
                    } else {
                        break;
                    }
                }
                break;
            }
        }

        return fullResponse;
    }

    /**
     * Drain all pending data from device IN buffer
     */
    private async drainBuffer(usb: WebUSBManager): Promise<string> {
        let totalBytes = 0;
        let emptyCount = 0;
        let allContent = '';
        const maxBytes = 100 * 1024;

        while (totalBytes < maxBytes && emptyCount < 3) {
            const result = await usb.transferInQuick(READ_BUFFER_SIZE, 300);
            if (!result.success || !result.data || result.data.length === 0) {
                emptyCount++;
                continue;
            }

            emptyCount = 0;
            totalBytes += result.data.length;
            const chunk = bytesToString(result.data);
            allContent += chunk;

            if (chunk.includes('VIP is enabled')) {
                this.onLog('Device: VIP is enabled', 'success');
            }
            if (chunk.includes('bin version')) {
                const match = chunk.match(/bin version:\s*(\S+)/);
                if (match) {
                    this.onLog(`Device version: ${match[1]}`, 'debug');
                }
            }
        }

        this.onLog(`Drained ${totalBytes} bytes from device`, 'debug');
        return allContent;
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
