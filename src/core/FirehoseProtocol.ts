/**
 * Firehose Protocol Handler
 * 
 * Implements the Qualcomm Firehose XML protocol for device operations.
 * This is used after Sahara uploads the programmer and VIP auth completes.
 */

import type { WebUSBManager } from './WebUSBManager';
import type { FirehoseConfig, FirehoseResponse, PartitionInfo } from '../types';
import { buildXmlCommand, parseXmlResponse, bytesToString, stringToBytes } from '../utils/xml';

// Read buffer size for responses
const READ_BUFFER_SIZE = 4096;

// Default Firehose configuration
const DEFAULT_CONFIG: FirehoseConfig = {
    memoryName: 'ufs',
    maxPayloadSizeToTargetInBytes: 1048576, // 1MB
    maxPayloadSizeFromTargetInBytes: 8192,
};

// GPT constants
const GPT_SIGNATURE = 'EFI PART';
const SECTOR_SIZE_UFS = 4096; // UFS uses 4KB sectors
const SECTOR_SIZE_EMMC = 512; // eMMC uses 512B sectors

export class FirehoseProtocol {
    private usb: WebUSBManager;
    private config: FirehoseConfig = DEFAULT_CONFIG;
    private onLog: (message: string, level?: 'info' | 'debug' | 'error' | 'success') => void;
    private isConfigured: boolean = false; // Track if Firehose has been configured

    constructor(usb: WebUSBManager, logger?: (message: string, level?: 'info' | 'debug' | 'error' | 'success') => void) {
        this.usb = usb;
        this.onLog = logger || ((msg) => console.log('[Firehose]', msg));
    }

    /**
     * Get current configuration
     */
    get currentConfig(): FirehoseConfig {
        return { ...this.config };
    }

    /**
     * Configure Firehose with desired settings
     */
    async configure(config?: Partial<FirehoseConfig>): Promise<FirehoseResponse> {
        // NOTE: We don't check isConnected here because it can be unreliable
        // (device may be null or device.opened may be false even when device is still functional)
        // Instead, we let the actual USB transfer fail if device is truly disconnected

        const newConfig = { ...DEFAULT_CONFIG, ...config };

        const command = buildXmlCommand('configure', {
            MemoryName: newConfig.memoryName,
            MaxPayloadSizeToTargetInBytes: newConfig.maxPayloadSizeToTargetInBytes,
            MaxPayloadSizeFromTargetInBytes: newConfig.maxPayloadSizeFromTargetInBytes || 8192,
            ZLPAwareHost: newConfig.zlpAwareHost ? 1 : 0,
        });

        this.onLog(`Configuring Firehose: ${newConfig.memoryName}, MaxPayload=${newConfig.maxPayloadSizeToTargetInBytes}`);
        this.onLog(`TX: ${command}`, 'debug');

        const response = await this.sendCommand(command);

        if (response.success) {
            this.config = newConfig;
            this.isConfigured = true; // Mark as configured
            this.onLog(`Firehose configured successfully`, 'success');
        } else {
            // Try fallback with smaller payload size
            this.onLog('Configure failed, trying with smaller payload...', 'debug');
            const fallbackConfig = { ...newConfig, maxPayloadSizeToTargetInBytes: 4096 };
            const fallbackCommand = buildXmlCommand('configure', {
                MemoryName: fallbackConfig.memoryName,
                MaxPayloadSizeToTargetInBytes: fallbackConfig.maxPayloadSizeToTargetInBytes,
            });

            const fallbackResponse = await this.sendCommand(fallbackCommand);
            if (fallbackResponse.success) {
                this.config = fallbackConfig;
                this.isConfigured = true; // Mark as configured
                this.onLog(`Firehose configured with fallback settings (4KB payload)`, 'success');
                return fallbackResponse;
            }
        }

        return response;
    }

    /**
     * Get partition table (GPT) from device
     * Uses 'read' command directly since Oppo doesn't support 'getgpt'
     */
    async getPartitions(physicalPartition = 0): Promise<{ success: boolean; partitions?: PartitionInfo[]; error?: string }> {
        this.onLog(`Reading partition table from LUN ${physicalPartition}...`);

        // Oppo devices don't support getgpt, use read command directly
        // This avoids timeout waiting for unsupported command response
        const result = await this.readGptDirect(physicalPartition);
        return result;
    }
    /**
     * Read GPT directly using 'read' command
     * From native tool log: reads 6 sectors from location 0 (24KB for UFS)
     */
    private async readGptDirect(physicalPartition: number): Promise<{ success: boolean; partitions?: PartitionInfo[]; error?: string }> {
        // For UFS: sector size is 4096 bytes
        // Native tool reads 6 sectors = 24KB which contains GPT header + partition entries
        const sectorSize = this.config.memoryName === 'ufs' ? SECTOR_SIZE_UFS : SECTOR_SIZE_EMMC;
        const numSectors = 6; // From native tool log
        const totalBytes = numSectors * sectorSize;

        // Create read command matching native tool format
        // Native: <read SECTOR_SIZE_IN_BYTES="4096" filename="gpt_main0.bin" physical_partition_number="0" label="PrimaryGPT" start_sector="0" num_partition_sectors="6" />
        const command = buildXmlCommand('read', {
            SECTOR_SIZE_IN_BYTES: sectorSize,
            filename: `gpt_main${physicalPartition}.bin`,
            physical_partition_number: physicalPartition,
            label: 'PrimaryGPT',
            start_sector: 0,
            num_partition_sectors: numSectors,
        });

        this.onLog(`TX: ${command}`, 'debug');

        const sendResult = await this.usb.transferOut(stringToBytes(command));
        if (!sendResult.success) {
            return { success: false, error: sendResult.error };
        }

        // Step 1: Keep reading until we get ACK with rawmode="true" or NAK
        // Device may send multiple INFO log messages before the ACK
        let responseText = '';
        let gotRawModeTrue = false;

        for (let attempts = 0; attempts < 10; attempts++) {
            const result = await this.usb.transferIn(READ_BUFFER_SIZE);
            if (!result.success || !result.data) {
                break;
            }

            const chunk = bytesToString(result.data);
            responseText += chunk;
            this.onLog(`Response chunk ${attempts + 1}: ${chunk.substring(0, 100)}...`, 'debug');

            // Check for NAK or "Not Support"
            if (chunk.includes('NAK') || chunk.includes('Not Support')) {
                return { success: false, error: 'Read command not supported' };
            }

            // Check for rawmode="true" which means binary data will follow
            if (chunk.includes('rawmode="true"') || chunk.includes("rawmode='true'")) {
                gotRawModeTrue = true;
                this.onLog('Got rawmode=true ACK - binary data follows', 'debug');
                break;
            }

            // If we got INFO logs, continue reading
            if (!chunk.includes('<response')) {
                continue;
            }
        }

        if (!gotRawModeTrue) {
            this.onLog(`Never got rawmode=true. Response: ${responseText.substring(0, 300)}`, 'debug');
            return { success: false, error: 'Did not receive rawmode=true ACK' };
        }

        // Step 2: Read binary GPT data
        const gptChunks: Uint8Array[] = [];
        let bytesRead = 0;

        while (bytesRead < totalBytes) {
            const readResult = await this.usb.transferIn(8192); // Match native tool buffer size
            if (!readResult.success || !readResult.data || readResult.data.length === 0) {
                break;
            }

            // Check if we got final ACK (rawmode="false")
            const text = bytesToString(readResult.data.slice(0, 50));
            if (text.includes('rawmode="false"') || text.includes("rawmode='false'")) {
                this.onLog('Got rawmode=false - transfer complete', 'debug');
                break;
            }

            gptChunks.push(readResult.data);
            bytesRead += readResult.data.length;
        }

        // Step 3: Read final ACK if not already received
        const finalResult = await this.usb.transferIn(READ_BUFFER_SIZE);
        if (finalResult.success && finalResult.data) {
            const finalResponse = bytesToString(finalResult.data);
            this.onLog(`Final response: ${finalResponse.substring(0, 100)}`, 'debug');
        }

        this.onLog(`Read ${bytesRead} bytes from GPT`, 'debug');

        // Combine GPT data
        if (gptChunks.length === 0 || bytesRead === 0) {
            return { success: false, error: 'No GPT data received' };
        }

        const gptData = new Uint8Array(bytesRead);
        let offset = 0;
        for (const chunk of gptChunks) {
            gptData.set(chunk, offset);
            offset += chunk.length;
        }

        // Parse GPT
        const partitions = this.parseGPT(gptData, sectorSize);
        if (partitions.length > 0) {
            this.onLog(`Found ${partitions.length} partitions`, 'success');
            return { success: true, partitions };
        }

        return { success: false, error: 'Failed to parse GPT' };
    }

    /**
     * Get partitions from all LUNs (0-5)
     * Reconfigures between each LUN to maintain connection
     */
    async getAllPartitions(): Promise<{ success: boolean; partitions?: PartitionInfo[]; error?: string }> {
        const allPartitions: PartitionInfo[] = [];
        const NUM_LUNS = 6;

        for (let lun = 0; lun < NUM_LUNS; lun++) {
            this.onLog(`Reading LUN ${lun}...`);

            // For LUN > 0, reconfigure to reset device state
            if (lun > 0) {
                // Drain any pending data first
                await this.drainBuffer();

                // Reconfigure to reset device state
                this.onLog(`Reconfiguring before LUN ${lun}...`, 'debug');
                const configResult = await this.configure();
                if (!configResult.success) {
                    this.onLog(`Reconfigure failed for LUN ${lun}, skipping`, 'debug');
                    continue;
                }
                await this.drainBuffer();
            }

            const result = await this.readGptDirect(lun);

            if (result.success && result.partitions && result.partitions.length > 0) {
                // Tag each partition with its LUN
                for (const p of result.partitions) {
                    (p as any).lun = lun;
                }
                allPartitions.push(...result.partitions);
                this.onLog(`LUN ${lun}: ${result.partitions.length} partitions`, 'debug');
            } else {
                this.onLog(`LUN ${lun}: ${result.error || 'No partitions'}`, 'debug');
                // If first LUN after 0 fails, all others will likely fail too
                if (lun === 1 && !result.success) {
                    this.onLog('Multi-LUN read not supported, returning LUN 0 only', 'debug');
                    break;
                }
            }
        }

        if (allPartitions.length > 0) {
            return { success: true, partitions: allPartitions };
        }

        return { success: false, error: 'No partitions found on any LUN' };
    }

    /**
     * Read/backup a partition
     * @param lun - Physical partition number (LUN)
     * @param startSector - Start sector of the partition
     * @param numSectors - Number of sectors to read
     * @param partitionName - Name of the partition (for logging)
     * @param onProgress - Progress callback (0-100)
     */
    async readPartition(
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        onProgress?: (percent: number) => void
    ): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
        const sectorSize = this.getSectorSize();
        const totalBytes = Number(numSectors) * sectorSize;

        this.onLog(`Reading partition "${partitionName}" (LUN ${lun}): ${numSectors} sectors, ${this.formatSize(BigInt(totalBytes))}`);

        // ALWAYS reconfigure before each read - device requires this to reset Firehose state
        // The skipConfigure optimization was causing "Bulk OUT transfer timeout" errors
        // because the device's state wasn't properly reset between operations
        await this.drainBuffer();
        const configResult = await this.configure();
        if (!configResult.success) {
            return { success: false, error: 'Failed to configure before read' };
        }
        await this.drainBuffer();

        // Build read command
        // Use PrimaryGPT label to bypass permission check
        // NOTE: This has ~1.8GB limit per session - device limitation
        const command = buildXmlCommand('read', {
            SECTOR_SIZE_IN_BYTES: sectorSize,
            file_sector_offset: 0,
            filename: `${partitionName}.bin`,
            physical_partition_number: lun,
            label: 'PrimaryGPT',  // Use PrimaryGPT instead of BackupGPT to avoid "forbidden" errors
            start_sector: startSector.toString(),
            num_partition_sectors: numSectors.toString(),
            partofsingleimage: 'true',
            readbackverify: 'false',
            sparse: 'false',
        });

        this.onLog(`TX: ${command}`, 'debug');

        // Send command
        const sendResult = await this.usb.transferOut(stringToBytes(command));
        if (!sendResult.success) {
            return { success: false, error: `Send failed: ${sendResult.error}` };
        }

        // Wait for rawmode=true ACK
        let gotRawMode = false;
        for (let i = 0; i < 10; i++) {
            const response = await this.usb.transferIn(READ_BUFFER_SIZE);
            if (response.success && response.data) {
                const text = bytesToString(response.data);
                this.onLog(`Response: ${text.substring(0, 100)}...`, 'debug');

                if (text.includes('rawmode="true"')) {
                    gotRawMode = true;
                    break;
                }
                if (text.includes('NAK') || text.includes('ERROR')) {
                    return { success: false, error: `Device rejected read: ${text}` };
                }
            }
        }

        if (!gotRawMode) {
            return { success: false, error: 'Never received rawmode=true ACK' };
        }

        this.onLog('Got rawmode=true, reading binary data...', 'debug');

        // Read binary data in chunks
        const dataChunks: Uint8Array[] = [];
        let bytesRead = 0;
        const maxChunkSize = 1048576; // 1MB per read
        // Much longer timeout for large partitions (60s for >100MB, 120s for >1GB)
        const readTimeout = totalBytes > 1024 * 1024 * 1024 ? 120000 :
            totalBytes > 100 * 1024 * 1024 ? 60000 : 30000;
        let consecutiveEmptyReads = 0;
        const maxEmptyReads = 10; // More retries for large files

        while (bytesRead < totalBytes) {
            const result = await this.usb.transferInQuick(maxChunkSize, readTimeout);

            if (!result.success || !result.data || result.data.length === 0) {
                consecutiveEmptyReads++;

                // Log progress on empty reads
                if (consecutiveEmptyReads % 3 === 0) {
                    this.onLog(`Waiting for data... (${consecutiveEmptyReads}/${maxEmptyReads})`, 'debug');
                }

                // Check if we got all expected data
                if (bytesRead >= totalBytes) break;

                // Give up after too many empty reads
                if (consecutiveEmptyReads >= maxEmptyReads) {
                    this.onLog(`Transfer stopped at ${bytesRead} bytes`, 'info');
                    break;
                }

                continue;
            }

            consecutiveEmptyReads = 0; // Reset counter on successful read

            // Check if this chunk contains XML (end marker)
            const text = bytesToString(result.data);

            // CRITICAL FIX: Only treat as end-of-data if we found explicit end marker OR we have read enough bytes
            // Prevents false positives where binary data looks like XML (common in large partitions)
            const isExplicitEnd = text.includes('rawmode="false"') || (text.includes('<?xml') && text.includes('</data>'));

            // STRICTER ERROR CHECK: Only match specific XML error patterns
            // Binary data often contains the string "ERROR" (e.g. inside logs/files in the image)
            const isError = text.includes('<log value="ERROR') || text.includes('value="NAK"');

            if (isError) {
                this.onLog(`Device reported error: ${text.substring(0, 100)}`, 'error');
                return { success: false, error: `Device Error: ${text}` };
            }

            if (isExplicitEnd) {
                // If checking strictly for completion:
                if (bytesRead < totalBytes && !text.includes('rawmode="false"')) {
                    // We found XML-like data (e.g. <log>) but we aren't done yet, and it's not the final generic ACK.
                    // This could be a false positive (binary data looking like XML) or a mid-stream log.
                    // We'll treat it as data unless it's the specific rawmode="false" terminator.
                    this.onLog('Warning: Detected XML-like data but transfer incomplete - treating as binary', 'debug');
                } else {
                    this.onLog('Detected end-of-data in response', 'debug');
                    // Extract binary data before XML if any
                    const xmlStart = result.data.indexOf(0x3C); // '<'
                    if (xmlStart > 0) {
                        dataChunks.push(result.data.slice(0, xmlStart));
                        bytesRead += xmlStart;
                    }
                    break;
                }
            }

            dataChunks.push(result.data);
            bytesRead += result.data.length;

            // Report progress
            if (onProgress) {
                const percent = Math.min(100, Math.round((bytesRead / totalBytes) * 100));
                onProgress(percent);
            }

            if (bytesRead % (50 * 1024 * 1024) === 0) { // Log every 50MB
                this.onLog(`Read ${this.formatSize(BigInt(bytesRead))} / ${this.formatSize(BigInt(totalBytes))}`, 'debug');
            }
        }

        // Read final ACK
        const finalResult = await this.usb.transferIn(READ_BUFFER_SIZE);
        if (finalResult.success && finalResult.data) {
            const finalText = bytesToString(finalResult.data);
            this.onLog(`Final: ${finalText.substring(0, 100)}`, 'debug');
        }

        this.onLog(`Read complete: ${bytesRead} bytes`, 'success');

        // Combine chunks
        const data = new Uint8Array(bytesRead);
        let offset = 0;
        for (const chunk of dataChunks) {
            data.set(chunk, offset);
            offset += chunk.length;
        }

        return { success: true, data };
    }

    /**
     * Read entire partition with a SINGLE read command and stream directly to file.
     * This matches native tool behavior that can read 16GB+ without chunking.
     * 
     * Key difference from readPartitionToFile:
     * - Sends ONE read command for the entire partition
     * - Streams data directly to file as it arrives
     * - No intermediate chunking or re-configuration
     */
    async readPartitionStreamToFile(
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        fileHandle: FileSystemFileHandle,
        onProgress?: (percent: number) => void
    ): Promise<{ success: boolean; bytesWritten: number; error?: string }> {
        const sectorSize = this.getSectorSize();
        const totalBytes = Number(numSectors) * sectorSize;

        this.onLog(`Streaming partition "${partitionName}" (LUN ${lun})`);
        this.onLog(`Total: ${numSectors} sectors (${this.formatSize(BigInt(totalBytes))})`);
        this.onLog('Using single-command streaming (native tool mode)');

        // Configure once before starting
        await this.drainBuffer();
        const configResult = await this.configure();
        if (!configResult.success) {
            return { success: false, bytesWritten: 0, error: 'Failed to configure' };
        }
        await this.drainBuffer();

        // Build read command for ENTIRE partition (like native tool)
        const command = buildXmlCommand('read', {
            SECTOR_SIZE_IN_BYTES: sectorSize,
            file_sector_offset: 0,
            filename: `${partitionName}.bin`,
            physical_partition_number: lun,
            label: 'PrimaryGPT',  // Try PrimaryGPT like native tool uses for GPT reads
            start_sector: startSector.toString(),
            num_partition_sectors: numSectors.toString(),
            partofsingleimage: 'true',
            readbackverify: 'false',
            sparse: 'false',
        });

        this.onLog(`TX: ${command}`, 'debug');

        // Send the single read command
        const sendResult = await this.usb.transferOut(stringToBytes(command));
        if (!sendResult.success) {
            return { success: false, bytesWritten: 0, error: `Send failed: ${sendResult.error}` };
        }

        // Wait for rawmode=true ACK
        let gotRawMode = false;
        for (let i = 0; i < 10; i++) {
            const response = await this.usb.transferIn(READ_BUFFER_SIZE);
            if (response.success && response.data) {
                const text = bytesToString(response.data);
                this.onLog(`Response: ${text.substring(0, 100)}...`, 'debug');

                if (text.includes('rawmode="true"')) {
                    gotRawMode = true;
                    break;
                }
                if (text.includes('NAK') || text.includes('ERROR')) {
                    return { success: false, bytesWritten: 0, error: `Device rejected read: ${text}` };
                }
            }
        }

        if (!gotRawMode) {
            return { success: false, bytesWritten: 0, error: 'Never received rawmode=true ACK' };
        }

        this.onLog('Got rawmode=true, streaming binary data to file...', 'debug');

        // Open file for writing
        const writable = await fileHandle.createWritable();
        let totalBytesWritten = 0;
        let consecutiveEmptyReads = 0;
        const maxEmptyReads = 20; // More tolerance for large files
        const maxChunkSize = 1048576; // 1MB per USB read
        let lastProgressLog = 0;

        try {
            while (totalBytesWritten < totalBytes) {
                // Long timeout for large transfers - device may buffer
                const result = await this.usb.transferInQuick(maxChunkSize, 60000);

                if (!result.success || !result.data || result.data.length === 0) {
                    consecutiveEmptyReads++;

                    if (consecutiveEmptyReads >= maxEmptyReads) {
                        this.onLog(`Transfer stopped at ${this.formatSize(BigInt(totalBytesWritten))}`, 'info');
                        break;
                    }
                    continue;
                }

                consecutiveEmptyReads = 0;

                // Check for end-of-transfer marker
                let dataToWrite = result.data;
                const text = bytesToString(result.data);

                const isExplicitEnd = text.includes('rawmode="false"') || (text.includes('<?xml') && text.includes('</data>'));

                // STRICTER ERROR CHECK: Only match specific XML error patterns
                // Binary data often contains the string "ERROR" (e.g. inside logs/files in the image)
                const isError = text.includes('<log value="ERROR') || text.includes('value="NAK"');

                if (isError) {
                    await writable.close();
                    return { success: false, bytesWritten: totalBytesWritten, error: `Device Error: ${text}` };
                }

                if (isExplicitEnd) {
                    // CRITICAL FIX: Only stop if we really are done or explicit stop command
                    // If we haven't read enough bytes, this "XML" is likely binary data false positive
                    if (totalBytesWritten < totalBytes && !text.includes('rawmode="false"')) {
                        this.onLog('Warning: Detected XML-like data but transfer incomplete - treating as binary', 'debug');
                        // Treat as pure data, do NOT strip header
                    } else {
                        this.onLog('Detected end-of-transfer marker', 'debug');
                        // Extract binary data before XML if any
                        const xmlStart = result.data.indexOf(0x3C); // '<'
                        if (xmlStart > 0) {
                            dataToWrite = result.data.slice(0, xmlStart);
                        } else {
                            dataToWrite = new Uint8Array(0);
                        }
                    }
                }

                if (dataToWrite.length > 0) {
                    // Write directly to file (streaming)
                    const buffer = new ArrayBuffer(dataToWrite.length);
                    new Uint8Array(buffer).set(dataToWrite);
                    await writable.write(buffer);
                    totalBytesWritten += dataToWrite.length;
                }

                // Report progress
                if (onProgress) {
                    const percent = Math.min(100, Math.round((totalBytesWritten / totalBytes) * 100));
                    onProgress(percent);
                }

                // Log progress every 500MB
                const currentMB = Math.floor(totalBytesWritten / (500 * 1024 * 1024));
                if (currentMB > lastProgressLog) {
                    lastProgressLog = currentMB;
                    this.onLog(`Streamed ${this.formatSize(BigInt(totalBytesWritten))} / ${this.formatSize(BigInt(totalBytes))}`, 'debug');
                }

                // Check if we hit end marker (only if we processed it as such)
                // If we treated it as binary, we continue
                if (isExplicitEnd && (totalBytesWritten >= totalBytes || text.includes('rawmode="false"'))) {
                    break;
                }
            }

            // Try to read final ACK with short timeout (device may not send anything more)
            try {
                const finalResult = await this.usb.transferInQuick(READ_BUFFER_SIZE, 1000);
                if (finalResult.success && finalResult.data) {
                    const finalText = bytesToString(finalResult.data);
                    this.onLog(`Final: ${finalText.substring(0, 100)}`, 'debug');
                }
            } catch {
                // Ignore - device may not send final ACK
            }

            // Inform user that disk write may take time
            this.onLog('Finalizing file to disk... (this may take a moment for large files)', 'info');
            await writable.close();

            this.onLog(`Stream complete: ${this.formatSize(BigInt(totalBytesWritten))}`, 'success');
            return { success: true, bytesWritten: totalBytesWritten };

        } catch (error) {
            await writable.close();
            return { success: false, bytesWritten: totalBytesWritten, error: String(error) };
        }
    }

    /**
     * Write/flash data to a partition
     * @param lun - Physical partition number (LUN)
     * @param startSector - Start sector of the partition
     * @param numSectors - Number of sectors to write
     * @param partitionName - Name of the partition (for logging)
     * @param data - Binary data to write
     * @param onProgress - Progress callback (0-100)
     * @param _skipConfigure - DEPRECATED: Device requires reconfigure between writes
     * @param filename - Optional: actual filename from XML (defaults to partitionName.bin if not specified)
     * @param partofsingleimage - Optional: 'true' for single image writes, 'false' for partition writes (from XML)
     * @param sparse - Optional: 'true' for sparse images, 'false' for raw images (from XML)
     * @param spoofLabel - Optional: fake label for bypassing protected partitions
     * @param spoofFilename - Optional: fake filename for spoof mode
     */
    async writePartition(
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        data: Uint8Array,
        onProgress?: (percent: number) => void,
        _skipConfigure = false,  // Kept for API compatibility, but ignored
        filename?: string,  // NEW: Optional filename from XML
        partofsingleimage = false,  // Default to false for normal partition writes (true only for GPT)
        sparse = false,  // NEW: sparse format flag from XML
        spoofLabel?: string,      // For protected partitions: use "BackupGPT"
        spoofFilename?: string    // For protected partitions: use "gpt_backup0.bin"
    ): Promise<{ success: boolean; bytesWritten: number; error?: string }> {
        const sectorSize = this.getSectorSize();
        const totalBytes = data.length;
        const expectedBytes = Number(numSectors) * sectorSize;

        this.onLog(`Writing partition "${partitionName}" (LUN ${lun}): ${this.formatSize(BigInt(totalBytes))}`);

        // Validate data size (skip if numSectors is 0 - means dynamic partition like userdata)
        if (expectedBytes > 0 && totalBytes > expectedBytes) {
            return {
                success: false,
                bytesWritten: 0,
                error: `Data size (${totalBytes}) exceeds partition size (${expectedBytes})`
            };
        }

        // ALWAYS reconfigure before each write - device requires this to reset Firehose state
        // The skipConfigure optimization was causing "Bulk OUT transfer timeout" errors
        // because the device's state wasn't properly reset between writes
        await this.drainBuffer();
        const configResult = await this.configure();
        if (!configResult.success) {
            return { success: false, bytesWritten: 0, error: 'Failed to configure before write' };
        }
        await this.drainBuffer();

        // Calculate actual number of sectors needed for the file
        // IMPORTANT: Use file size, not partition size, to tell device exactly how much data
        const actualSectors = Math.ceil(totalBytes / sectorSize);

        // Pad data to sector boundary - device requires writes to be multiples of sector size
        // Error "Read non multiple sector size value from USB" occurs if not padded
        const paddedSize = actualSectors * sectorSize;
        let dataToSend = data;
        if (totalBytes !== paddedSize) {
            this.onLog(`Padding ${totalBytes} bytes to ${paddedSize} bytes (sector aligned)`, 'debug');
            dataToSend = new Uint8Array(paddedSize);
            dataToSend.set(data);
            // Remaining bytes are zero-filled by default
        }

        // Build program command
        // SPOOF MODE: For protected partitions, device rejects writes with real label.
        // If spoofLabel/spoofFilename are provided, use them to bypass protection.
        // Otherwise, use normal filename logic:
        // 1. If filename is provided from XML, ALWAYS use it (e.g., "gpt_main0.bin" for GPT)
        // 2. If no filename AND partofsingleimage=true: device expects "${label}.img" format
        // 3. If no filename AND partofsingleimage=false: fallback to "${label}.bin"
        let finalFilename: string;
        let finalLabel: string;

        if (spoofLabel && spoofFilename) {
            // SPOOF MODE: Use fake label/filename to bypass device protection
            finalFilename = spoofFilename;
            finalLabel = spoofLabel;
        } else if (filename) {
            // XML provided a specific filename - ALWAYS use it
            // This is critical for GPT tables (gpt_main0.bin, etc.)
            finalFilename = filename;
            finalLabel = partitionName;
        } else if (partofsingleimage) {
            // No filename but partofsingleimage=true: use label.img format
            finalFilename = `${partitionName}.img`;
            finalLabel = partitionName;
        } else {
            // No filename and normal mode: use label.bin
            finalFilename = `${partitionName}.bin`;
            finalLabel = partitionName;
        }

        const command = buildXmlCommand('program', {
            SECTOR_SIZE_IN_BYTES: sectorSize,
            file_sector_offset: 0,
            filename: finalFilename,
            physical_partition_number: lun,
            label: finalLabel,  // May be spoofed for protected partitions
            start_sector: startSector.toString(),
            num_partition_sectors: actualSectors.toString(),
            // In spoof mode, omit partofsingleimage (device thinks it's BackupGPT)
            ...(!(spoofLabel && spoofFilename) && { partofsingleimage: partofsingleimage ? 'true' : 'false' }),
            sparse: sparse ? 'true' : 'false',
        });

        this.onLog(`TX: ${command}`, 'debug');

        // Send command
        const sendResult = await this.usb.transferOut(stringToBytes(command));
        if (!sendResult.success) {
            return { success: false, bytesWritten: 0, error: `Send failed: ${sendResult.error}` };
        }

        // Wait for rawmode=true ACK
        let gotRawMode = false;
        for (let i = 0; i < 10; i++) {
            const response = await this.usb.transferIn(READ_BUFFER_SIZE);
            if (response.success && response.data) {
                const text = bytesToString(response.data);
                this.onLog(`Response: ${text.substring(0, 100)}...`, 'debug');

                if (text.includes('rawmode="true"')) {
                    gotRawMode = true;
                    break;
                }
                if (text.includes('NAK') || text.includes('ERROR')) {
                    return { success: false, bytesWritten: 0, error: `Device rejected write: ${text}` };
                }
            }
        }

        if (!gotRawMode) {
            return { success: false, bytesWritten: 0, error: 'Never received rawmode=true ACK' };
        }

        this.onLog('Got rawmode=true, sending binary data...', 'debug');

        // Send binary data in 16MB chunks (like native tool)
        // Using subarray instead of slice to avoid memory copy
        let bytesWritten = 0;
        const chunkSize = 16 * 1024 * 1024; // 16MB USB transfer size (under 32MB WebUSB limit)
        const totalToSend = dataToSend.length;

        while (bytesWritten < totalToSend) {
            const remaining = totalToSend - bytesWritten;
            const currentChunkSize = Math.min(chunkSize, remaining);
            // subarray() returns a view without copying memory
            const chunk = dataToSend.subarray(bytesWritten, bytesWritten + currentChunkSize);

            const writeResult = await this.usb.transferOut(chunk);
            if (!writeResult.success) {
                return {
                    success: false,
                    bytesWritten,
                    error: `Transfer failed at ${bytesWritten} bytes: ${writeResult.error}`
                };
            }

            bytesWritten += currentChunkSize;

            // Report progress (use original totalBytes for user-facing progress)
            if (onProgress) {
                const percent = Math.min(100, Math.round((bytesWritten / totalToSend) * 100));
                onProgress(percent);
            }

            // Log progress every 50MB
            if (bytesWritten % (50 * 1024 * 1024) < chunkSize) {
                this.onLog(`Written ${this.formatSize(BigInt(bytesWritten))} / ${this.formatSize(BigInt(totalToSend))}`, 'debug');
            }
        }

        // Wait longer for ACK to ensure device finishes processing before next write
        // Native tool waits for full ACK before continuing with next partition
        const response = await this.usb.transferInQuick(READ_BUFFER_SIZE, 2000);
        if (response.success && response.data && response.data.length > 0) {
            const text = bytesToString(response.data);
            this.onLog(`RX: ${text.substring(0, 100)}...`, 'debug');
            if (text.includes('NAK') || text.includes('ERROR')) {
                return { success: false, bytesWritten, error: `Write failed: ${text}` };
            }
            // ACK received - good
        }

        // Drain any remaining responses to ensure clean state for next operation
        await this.drainBuffer();

        this.onLog(`Write complete: ${this.formatSize(BigInt(bytesWritten))}`, 'success');
        return { success: true, bytesWritten };
    }

    /**
     * Write/flash data to a partition by streaming from a File object.
     * Use this for large files (>1GB) that cannot be loaded into memory.
     * @param lun - Physical partition number (LUN)
     * @param startSector - Start sector of the partition
     * @param numSectors - Number of sectors to write
     * @param partitionName - Name of the partition (for logging)
     * @param file - File object to stream from
     * @param onProgress - Progress callback (0-100)
     * @param filename - Optional: actual filename from XML (defaults to partitionName.bin if not specified)
     * @param partofsingleimage - Optional: 'true' for single image writes, 'false' for partition writes (from XML)
     * @param sparse - Optional: 'true' for sparse images, 'false' for raw images (from XML)
     */
    async writePartitionFromFile(
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        file: File,
        onProgress?: (percent: number) => void,
        filename?: string,  // NEW: Optional filename from XML
        partofsingleimage = false,  // Default to false for normal partition writes (true only for GPT)
        sparse = false  // NEW: sparse format flag from XML
    ): Promise<{ success: boolean; bytesWritten: number; error?: string }> {
        const sectorSize = this.getSectorSize();
        const totalBytes = file.size;
        const expectedBytes = Number(numSectors) * sectorSize;

        this.onLog(`Streaming partition "${partitionName}" (LUN ${lun}): ${this.formatSize(BigInt(totalBytes))}`);
        this.onLog('Using file streaming for large file', 'debug');

        // Validate file size (skip if numSectors is 0 - means dynamic partition like userdata)
        if (expectedBytes > 0 && totalBytes > expectedBytes) {
            return {
                success: false,
                bytesWritten: 0,
                error: `File size (${totalBytes}) exceeds partition size (${expectedBytes})`
            };
        }

        // ALWAYS reconfigure before each write
        await this.drainBuffer();
        const configResult = await this.configure();
        if (!configResult.success) {
            return { success: false, bytesWritten: 0, error: 'Failed to configure before write' };
        }
        await this.drainBuffer();

        // Calculate actual number of sectors needed for the file
        const actualSectors = Math.ceil(totalBytes / sectorSize);
        const paddedSize = actualSectors * sectorSize;
        const needsPadding = totalBytes !== paddedSize;

        if (needsPadding) {
            this.onLog(`Will pad ${totalBytes} bytes to ${paddedSize} bytes (sector aligned)`, 'debug');
        }

        // Build program command
        // CRITICAL: Filename logic (same as writePartition):
        // 1. If filename is provided from XML, ALWAYS use it
        // 2. If no filename AND partofsingleimage=true: use label.img format
        // 3. If no filename AND partofsingleimage=false: use label.bin
        let finalFilename: string;
        if (filename) {
            finalFilename = filename;
        } else if (partofsingleimage) {
            finalFilename = `${partitionName}.img`;
        } else {
            finalFilename = `${partitionName}.bin`;
        }

        const command = buildXmlCommand('program', {
            SECTOR_SIZE_IN_BYTES: sectorSize,
            file_sector_offset: 0,
            filename: finalFilename,
            physical_partition_number: lun,
            label: partitionName,
            start_sector: startSector.toString(),
            num_partition_sectors: actualSectors.toString(),
            partofsingleimage: partofsingleimage ? 'true' : 'false',
            sparse: sparse ? 'true' : 'false',
        });

        this.onLog(`TX: ${command}`, 'debug');

        // Send command
        const sendResult = await this.usb.transferOut(stringToBytes(command));
        if (!sendResult.success) {
            return { success: false, bytesWritten: 0, error: `Send failed: ${sendResult.error}` };
        }

        // Wait for rawmode=true ACK
        let gotRawMode = false;
        for (let i = 0; i < 10; i++) {
            const response = await this.usb.transferIn(READ_BUFFER_SIZE);
            if (response.success && response.data) {
                const text = bytesToString(response.data);
                this.onLog(`Response: ${text.substring(0, 100)}...`, 'debug');

                if (text.includes('rawmode="true"')) {
                    gotRawMode = true;
                    break;
                }
                if (text.includes('NAK') || text.includes('ERROR')) {
                    return { success: false, bytesWritten: 0, error: `Device rejected write: ${text}` };
                }
            }
        }

        if (!gotRawMode) {
            return { success: false, bytesWritten: 0, error: 'Never received rawmode=true ACK' };
        }

        this.onLog('Got rawmode=true, streaming file data...', 'debug');

        // Stream file in 16MB chunks (like native tool)
        let bytesWritten = 0;
        const chunkSize = 16 * 1024 * 1024; // 16MB chunks for streaming (under 32MB WebUSB limit)
        let offset = 0;

        while (offset < file.size) {
            const end = Math.min(offset + chunkSize, file.size);
            const blob = file.slice(offset, end);
            const chunk = new Uint8Array(await blob.arrayBuffer());

            const writeResult = await this.usb.transferOut(chunk);
            if (!writeResult.success) {
                return {
                    success: false,
                    bytesWritten,
                    error: `Transfer failed at ${bytesWritten} bytes: ${writeResult.error}`
                };
            }

            bytesWritten += chunk.length;
            offset = end;

            // Report progress
            if (onProgress) {
                const percent = Math.min(100, Math.round((bytesWritten / paddedSize) * 100));
                onProgress(percent);
            }

            // Log progress every 100MB
            if (bytesWritten % (100 * 1024 * 1024) < chunkSize) {
                this.onLog(`Streamed ${this.formatSize(BigInt(bytesWritten))} / ${this.formatSize(BigInt(file.size))}`, 'debug');
            }
        }

        // Send padding if needed
        if (needsPadding) {
            const paddingNeeded = paddedSize - file.size;
            const paddingData = new Uint8Array(paddingNeeded); // Zero-filled
            const writeResult = await this.usb.transferOut(paddingData);
            if (!writeResult.success) {
                return { success: false, bytesWritten, error: `Padding transfer failed: ${writeResult.error}` };
            }
            bytesWritten += paddingNeeded;
            this.onLog(`Sent ${paddingNeeded} bytes padding`, 'debug');
        }

        // Wait for ACK
        const response = await this.usb.transferInQuick(READ_BUFFER_SIZE, 5000);
        if (response.success && response.data && response.data.length > 0) {
            const text = bytesToString(response.data);
            this.onLog(`RX: ${text.substring(0, 100)}...`, 'debug');
            if (text.includes('NAK') || text.includes('ERROR')) {
                return { success: false, bytesWritten, error: `Write failed: ${text}` };
            }
        }

        await this.drainBuffer();

        this.onLog(`Stream complete: ${this.formatSize(BigInt(bytesWritten))}`, 'success');
        return { success: true, bytesWritten };
    }

    /**
     * Apply an XML patch/command to the device.
     */
    async applyPatch(xmlContent: string): Promise<{ success: boolean; error?: string }> {
        // Extract all <patch> tags
        const patchRegex = /<patch\s+[^>]*\/>/gi;
        const patches = xmlContent.match(patchRegex);

        const xmlWithoutComments = xmlContent.replace(/<!--[\s\S]*?-->/g, '').trim();

        if (!patches || patches.length === 0) {
            // Fallback to sending raw logic if no individual tags found
            let cleanXml = xmlWithoutComments.replace(/<\?xml.*?\?>/is, '').trim();
            cleanXml = cleanXml.replace(/<patches[^>]*>/i, '').replace(/<\/patches>/i, '').trim();

            if (!cleanXml.startsWith('<data>')) {
                cleanXml = `<?xml version="1.0" ?><data>${cleanXml}</data>`;
            } else {
                cleanXml = `<?xml version="1.0" ?>${cleanXml}`;
            }

            // Try sending raw
            const res = await this.sendCommand(cleanXml);
            if (res.success) {
                this.onLog('Patch file applied successfully', 'success');
                return { success: true };
            }
            return { success: false, error: res.error };
        }

        // Processing individual patches
        // Use debug log to avoid spamming the user, making it feel like "one operation"
        this.onLog(`Processing patches...`, 'info');

        for (let i = 0; i < patches.length; i++) {
            const patch = patches[i];
            const command = `<?xml version="1.0" ?><data>${patch}</data>`;

            // Debug only - hidden from normal view
            this.onLog(`Cmd ${i + 1}/${patches.length}`, 'debug');

            const result = await this.sendCommand(command);

            if (!result.success) {
                this.onLog(`Failed to apply patch command ${i + 1}: ${result.error}`, 'error');
                return { success: false, error: result.error };
            }
        }

        this.onLog(`Patch file applied successfully`, 'success');
        return { success: true };
    }

    /**
     * Send reset command to reboot the device.
     * Wrapper for power('reset').
     */
    async reset(): Promise<FirehoseResponse> {
        return this.power('reset');
    }
    /**
     * Write/flash a large file using chunked writes like native tool.
     * This method sends a SEPARATE program command for each 64MB chunk,
     * which is how the native tool successfully flashes large files like super.img.
     * 
     * From native tool log for super.img (14.28 GB):
     * - Total chunks: 229 x 64MB chunks
     * - Each chunk takes ~1 second to write
     * - Device is reconfigured between chunks automatically
     * 
     * @param lun - Physical partition number (LUN)
     * @param startSector - Start sector of the partition
     * @param numSectors - Number of sectors (unused, calculated from file)
     * @param partitionName - Name of the partition
     * @param file - File object to stream from
     * @param onProgress - Progress callback (0-100)
     * @param chunkProgress - Called for each chunk (chunkIndex, totalChunks)
     * @param filename - Optional: actual filename from XML
     * @param partofsingleimage - Optional: true for name-based matching after GPT reload
     * @param spoofLabel - Optional: fake label for bypassing protected partitions (e.g., "BackupGPT")
     * @param spoofFilename - Optional: fake filename for spoof mode (e.g., "gpt_backup0.bin")
     */
    async writePartitionChunked(
        lun: number,
        startSector: bigint,
        _numSectors: bigint,
        partitionName: string,
        file: File,
        onProgress?: (percent: number) => void,
        chunkProgress?: (chunkIndex: number, totalChunks: number, chunkSize: number) => void,
        filename?: string,
        partofsingleimage = true,  // Default true for post-GPT flash operations
        spoofLabel?: string,       // For protected partitions: use "BackupGPT"
        spoofFilename?: string     // For protected partitions: use "gpt_backup0.bin"
    ): Promise<{ success: boolean; bytesWritten: number; error?: string }> {
        const sectorSize = this.getSectorSize();
        const totalBytes = file.size;

        // Use 512MB chunks to reduce Firehose reconfigure overhead
        // Each 512MB chunk is split into 16MB USB transfers (under WebUSB 32MB limit)
        const CHUNK_SIZE = 512 * 1024 * 1024; // 512MB per chunk
        const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

        this.onLog(`Chunked write partition "${partitionName}" (LUN ${lun}): ${this.formatSize(BigInt(totalBytes))}`);
        this.onLog(`Strategy: ${totalChunks} chunks × 512 MB`, 'info');

        let bytesWritten = 0;
        let currentSector = startSector;

        try {
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const chunkStart = chunkIndex * CHUNK_SIZE;
                const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalBytes);
                const chunkBytes = chunkEnd - chunkStart;
                const chunkSectors = Math.ceil(chunkBytes / sectorSize);

                this.onLog(`Processing chunk ${chunkIndex + 1}/${totalChunks}`, 'debug');

                // Log progress for each chunk
                if (chunkProgress) {
                    chunkProgress(chunkIndex + 1, totalChunks, Math.round(chunkBytes / (1024 * 1024)));
                }

                // Reconfigure before each chunk (like native tool)
                await this.drainBuffer();
                const configResult = await this.configure();
                if (!configResult.success) {
                    this.onLog(`Configure failed at chunk ${chunkIndex + 1}`, 'error');
                    return {
                        success: false,
                        bytesWritten,
                        error: `Failed to configure before chunk ${chunkIndex + 1}`
                    };
                }
                await this.drainBuffer();

                // Pad chunk data to sector boundary
                const paddedChunkSize = chunkSectors * sectorSize;

                // Build program command for this chunk
                // SPOOF MODE: For protected partitions like 'super', device rejects writes with real label.
                // Native tool uses "BackupGPT" label + "gpt_backup0.bin" filename to bypass protection.
                // The start_sector is still the REAL partition sector, so data goes to correct location.
                // 
                // If spoofLabel/spoofFilename are provided, use them to spoof the device.
                // Otherwise use normal logic.
                let finalFilename: string;
                let finalLabel: string;

                if (spoofLabel && spoofFilename) {
                    // SPOOF MODE: Pretend to be writing GPT backup, but actually write to partition sector
                    finalFilename = spoofFilename;  // e.g., "gpt_backup0.bin"
                    finalLabel = spoofLabel;        // e.g., "BackupGPT"
                } else if (filename) {
                    finalFilename = filename;
                    finalLabel = partitionName;
                } else if (partofsingleimage) {
                    finalFilename = `${partitionName}.img`;
                    finalLabel = partitionName;
                } else {
                    finalFilename = `${partitionName}.bin`;
                    finalLabel = partitionName;
                }

                const command = buildXmlCommand('program', {
                    SECTOR_SIZE_IN_BYTES: sectorSize,
                    file_sector_offset: 0,
                    filename: finalFilename,
                    physical_partition_number: lun,
                    label: finalLabel,  // Use spoofed or real label
                    start_sector: currentSector.toString(),
                    num_partition_sectors: chunkSectors.toString(),
                    // Note: In spoof mode, partofsingleimage is not needed since we're faking BackupGPT
                    sparse: 'false',
                });

                this.onLog(`TX: ${command}`, 'debug');

                // Send command
                const sendResult = await this.usb.transferOut(stringToBytes(command));
                if (!sendResult.success) {
                    this.onLog(`Send command failed: ${sendResult.error}`, 'error');
                    return {
                        success: false,
                        bytesWritten,
                        error: `Send failed at chunk ${chunkIndex + 1}: ${sendResult.error}`
                    };
                }

                // Wait for rawmode=true ACK
                let gotRawMode = false;
                for (let i = 0; i < 10; i++) {
                    const response = await this.usb.transferIn(READ_BUFFER_SIZE);
                    if (response.success && response.data) {
                        const text = bytesToString(response.data);
                        if (text.includes('rawmode="true"')) {
                            gotRawMode = true;
                            break;
                        }
                        if (text.includes('NAK') || text.includes('ERROR')) {
                            this.onLog(`Device rejected chunk: ${text}`, 'error');
                            return {
                                success: false,
                                bytesWritten,
                                error: `Device rejected chunk ${chunkIndex + 1}: ${text}`
                            };
                        }
                    }
                }

                if (!gotRawMode) {
                    this.onLog('Never got rawmode=true ACK', 'error');
                    return {
                        success: false,
                        bytesWritten,
                        error: `No rawmode ACK for chunk ${chunkIndex + 1}`
                    };
                }

                // Read chunk data from file
                // Note: file.slice returns a Blob. reading it is async.
                const blob = file.slice(chunkStart, chunkEnd);
                const chunkData = new Uint8Array(await blob.arrayBuffer());

                // Pad to sector boundary if needed
                let dataToSend = chunkData;
                if (chunkData.length < paddedChunkSize) {
                    dataToSend = new Uint8Array(paddedChunkSize);
                    dataToSend.set(chunkData);
                }

                // Send chunk data in 16MB USB transfers (must stay under WebUSB 32MB limit)
                // Using 16MB instead of 1MB = 16x fewer await calls = much faster
                const USB_CHUNK = 16 * 1024 * 1024; // 16MB USB transfer size
                let chunkOffset = 0;
                while (chunkOffset < dataToSend.length) {
                    const usbEnd = Math.min(chunkOffset + USB_CHUNK, dataToSend.length);
                    // Use subarray instead of slice to avoid memory copy
                    const usbData = dataToSend.subarray(chunkOffset, usbEnd);

                    const writeResult = await this.usb.transferOut(usbData);
                    if (!writeResult.success) {
                        this.onLog(`USB transfer failed: ${writeResult.error}`, 'error');
                        return {
                            success: false,
                            bytesWritten,
                            error: `USB transfer failed at chunk ${chunkIndex + 1}: ${writeResult.error}`
                        };
                    }
                    chunkOffset = usbEnd;
                }

                // Wait for ACK
                const ackResponse = await this.usb.transferInQuick(READ_BUFFER_SIZE, 5000);
                if (ackResponse.success && ackResponse.data && ackResponse.data.length > 0) {
                    const text = bytesToString(ackResponse.data);
                    this.onLog(`RX: ${text.substring(0, 100)}...`, 'debug');
                    if (text.includes('NAK') || text.includes('ERROR')) {
                        this.onLog(`Write failed: ${text}`, 'error');
                        return {
                            success: false,
                            bytesWritten,
                            error: `Chunk ${chunkIndex + 1} write error: ${text}`
                        };
                    }
                }

                await this.drainBuffer();

                bytesWritten += chunkBytes;
                currentSector += BigInt(chunkSectors);

                // Report overall progress
                if (onProgress) {
                    const percent = Math.min(100, Math.round((bytesWritten / totalBytes) * 100));
                    onProgress(percent);
                }

                if (chunkIndex % 5 === 0) {
                    this.onLog(`Chunk ${chunkIndex + 1}/${totalChunks} complete`, 'debug');
                }
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.onLog(`Exception in chunked write: ${msg}`, 'error');
            return { success: false, bytesWritten, error: msg };
        }

        await this.drainBuffer();
        this.onLog(`Chunked write complete: ${this.formatSize(BigInt(bytesWritten))}`, 'success');
        return { success: true, bytesWritten };
    }

    /**
     * Read large partition in chunks (for partitions > 1GB)
     * Writes directly to file using File System Access API
     * 
     * IMPORTANT: Oppo devices have a ~1.8GB per-session limit.
     * We need to re-authenticate VIP after every ~1.5GB to reset the session.
     * The reAuthenticateVip callback should perform the full VIP handshake again.
     */
    async readPartitionToFile(
        lun: number,
        startSector: bigint,
        numSectors: bigint,
        partitionName: string,
        fileHandle: FileSystemFileHandle,
        onProgress?: (percent: number) => void,
        reAuthenticateVip?: () => Promise<boolean>
    ): Promise<{ success: boolean; bytesWritten: number; error?: string }> {
        const sectorSize = this.getSectorSize();
        const totalBytes = Number(numSectors) * sectorSize;

        // Chunk size: ~400MB (100000 sectors) - safely under 1.8GB limit
        const chunkSectors = 100000n;
        let currentSector = startSector;
        let totalBytesWritten = 0;

        // Re-authenticate after every 4 chunks (~1.6GB) to avoid 1.8GB session limit
        const CHUNKS_PER_SESSION = 4;
        let chunksInCurrentSession = 0;

        this.onLog(`Reading large partition "${partitionName}" in chunks...`);
        this.onLog(`Total: ${numSectors} sectors (${this.formatSize(BigInt(totalBytes))})`);

        if (reAuthenticateVip) {
            this.onLog(`VIP re-authentication enabled (every ${CHUNKS_PER_SESSION} chunks)`, 'debug');
        }

        // Open file for writing
        const writable = await fileHandle.createWritable();

        try {
            let chunkNum = 0;
            while (currentSector < startSector + numSectors) {
                chunkNum++;
                chunksInCurrentSession++;
                const remainingSectors = (startSector + numSectors) - currentSector;
                const sectorsToRead = remainingSectors < chunkSectors ? remainingSectors : chunkSectors;

                this.onLog(`Chunk ${chunkNum}: Reading sectors ${currentSector} - ${currentSector + sectorsToRead - 1n}`, 'debug');

                // Read this chunk
                const result = await this.readPartition(
                    lun,
                    currentSector,
                    sectorsToRead,
                    `${partitionName}_chunk${chunkNum}`,
                    undefined
                );

                if (!result.success || !result.data) {
                    // Check if this is a session limit issue and we have re-auth capability
                    if (reAuthenticateVip && result.error?.includes('Failed to configure')) {
                        this.onLog(`Session limit reached at chunk ${chunkNum}, attempting VIP re-authentication...`, 'info');

                        const reAuthSuccess = await reAuthenticateVip();
                        if (reAuthSuccess) {
                            this.onLog(`VIP re-authenticated successfully, retrying chunk ${chunkNum}...`, 'success');
                            chunksInCurrentSession = 0;

                            // Retry this chunk
                            const retryResult = await this.readPartition(
                                lun,
                                currentSector,
                                sectorsToRead,
                                `${partitionName}_chunk${chunkNum}`,
                                undefined
                            );

                            if (retryResult.success && retryResult.data) {
                                // Write retry chunk to file
                                const retryBuffer = new ArrayBuffer(retryResult.data.length);
                                new Uint8Array(retryBuffer).set(retryResult.data);
                                await writable.write(retryBuffer);
                                totalBytesWritten += retryResult.data.length;

                                this.onLog(`Chunk ${chunkNum}: Wrote ${retryResult.data.length} bytes (after re-auth)`, 'debug');

                                // Update progress
                                if (onProgress) {
                                    const percent = Math.round((totalBytesWritten / totalBytes) * 100);
                                    onProgress(percent);
                                }

                                // Move to next chunk
                                currentSector += BigInt(Math.floor(retryResult.data.length / sectorSize));
                                chunksInCurrentSession++;

                                // Small delay between chunks
                                await new Promise(r => setTimeout(r, 500));
                                continue;
                            } else {
                                this.onLog(`Chunk ${chunkNum} failed after re-auth: ${retryResult.error}`, 'error');
                                break;
                            }
                        } else {
                            this.onLog(`VIP re-authentication failed`, 'error');
                            break;
                        }
                    }

                    this.onLog(`Chunk ${chunkNum} failed: ${result.error}`, 'error');
                    break;
                }

                // Write chunk to file (copy to new buffer to satisfy TypeScript)
                const chunkBuffer = new ArrayBuffer(result.data.length);
                new Uint8Array(chunkBuffer).set(result.data);
                await writable.write(chunkBuffer);
                totalBytesWritten += result.data.length;

                this.onLog(`Chunk ${chunkNum}: Wrote ${result.data.length} bytes`, 'debug');

                // Update progress
                if (onProgress) {
                    const percent = Math.round((totalBytesWritten / totalBytes) * 100);
                    onProgress(percent);
                }

                // Move to next chunk
                currentSector += BigInt(Math.floor(result.data.length / sectorSize));

                // Small delay between chunks
                await new Promise(r => setTimeout(r, 500));

                // Proactively re-authenticate before hitting session limit
                if (reAuthenticateVip && chunksInCurrentSession >= CHUNKS_PER_SESSION) {
                    // Check if there are more chunks to read
                    if (currentSector < startSector + numSectors) {
                        this.onLog(`Proactive VIP re-authentication (${chunksInCurrentSession} chunks, ~${this.formatSize(BigInt(chunksInCurrentSession * 100000 * sectorSize))} transferred)...`, 'info');

                        const reAuthSuccess = await reAuthenticateVip();
                        if (reAuthSuccess) {
                            this.onLog(`VIP session refreshed`, 'success');
                            chunksInCurrentSession = 0;
                        } else {
                            this.onLog(`VIP refresh failed, continuing with current session...`, 'debug');
                        }
                    }
                }
            }

            await writable.close();

            this.onLog(`Total written: ${this.formatSize(BigInt(totalBytesWritten))}`, 'success');
            return { success: true, bytesWritten: totalBytesWritten };

        } catch (error) {
            await writable.close();
            return { success: false, bytesWritten: totalBytesWritten, error: String(error) };
        }
    }

    /**
     * Drain all pending data from IN buffer
     */
    private async drainBuffer(): Promise<void> {
        for (let i = 0; i < 5; i++) {
            // OPTIMIZATION: Shortened timeout from 200ms to 10ms
            // If buffer is empty (normal case), this was wasting 200ms per call.
            // We call this multiple times per op, so this saves seconds/minutes total.
            const result = await this.usb.transferInQuick(READ_BUFFER_SIZE, 10);
            if (!result.success || !result.data || result.data.length === 0) {
                break;
            }
        }
    }

    /**
     * Send a raw XML command
     */
    async sendRawCommand(xml: string): Promise<FirehoseResponse> {
        return this.sendCommand(xml);
    }

    /**
     * Apply a patch command - writes specific bytes at specific offsets
     * Used after flashing to fix up GPT entries, CRCs, etc.
     * 
     * @param lun - Physical partition number (LUN)
     * @param startSector - Start sector where the patch applies
     * @param byteOffset - Byte offset within the sector
     * @param size - Size of the patch data in bytes  
     * @param value - The value to write (as hex string or number)
     */
    async patch(
        lun: number,
        startSector: string | number,
        byteOffset: string | number,
        size: string | number,
        value: string
    ): Promise<FirehoseResponse> {
        const sectorSize = this.getSectorSize();

        // Drain buffer before sending patch to avoid issues
        await this.drainBuffer();

        const command = buildXmlCommand('patch', {
            SECTOR_SIZE_IN_BYTES: sectorSize,
            byte_offset: byteOffset.toString(),
            filename: 'DISK',
            physical_partition_number: lun,
            size_in_bytes: size.toString(),
            start_sector: startSector.toString(),
            value: value,
        });

        this.onLog(`TX: ${command}`, 'debug');

        const result = await this.usb.transferOut(stringToBytes(command));
        if (!result.success) {
            return { success: false, error: result.error };
        }

        // Wait for response with timeout
        const response = await this.usb.transferInQuick(READ_BUFFER_SIZE, 2000);
        if (response.success && response.data) {
            const text = bytesToString(response.data);
            this.onLog(`RX: ${text.substring(0, 100)}...`, 'debug');

            if (text.includes('NAK') || text.includes('ERROR')) {
                return { success: false, error: text };
            }
            // ACK or log message = success
        }

        // Small delay between patches
        await new Promise(r => setTimeout(r, 50));

        return { success: true };
    }

    /**
     * Set which LUN is bootable
     * Native tool sends: <setbootablestoragedrive value="1" />
     * 
     * @param value - 1 = LUN A, 2 = LUN B (typically 1 for slot A)
     */
    async setBootableDrive(value: number = 1): Promise<FirehoseResponse> {
        const command = buildXmlCommand('setbootablestoragedrive', {
            value: value,
        });

        this.onLog(`Setting bootable drive to ${value}...`);
        this.onLog(`TX: ${command}`, 'debug');

        const result = await this.usb.transferOut(stringToBytes(command));
        if (!result.success) {
            return { success: false, error: result.error };
        }

        // Read response
        const response = await this.usb.transferIn(READ_BUFFER_SIZE);
        if (response.success && response.data) {
            const text = bytesToString(response.data);
            this.onLog(`RX: ${text.substring(0, 150)}...`, 'debug');

            if (text.includes('ACK')) {
                this.onLog('Bootable drive set successfully', 'success');
                return { success: true };
            }
            if (text.includes('NAK') || text.includes('ERROR')) {
                return { success: false, error: text };
            }
        }

        return { success: true };
    }



    /**
     * Power off/reboot the device
     * @param mode - 'reset' for reboot to system, 'edl' for stay in EDL, 'off' for power off
     * 
     * Native tool uses: <power DelayInSeconds="0" value="reset" />
     * With --skip_configure flag (no reconfiguration before power command)
     */
    async power(mode: 'reset' | 'edl' | 'off' = 'reset'): Promise<FirehoseResponse> {
        // Firehose power command with different values
        const valueMap = {
            'reset': 'reset',    // Reboot to normal system
            'edl': 'edl',        // Stay in EDL mode
            'off': 'off',        // Power off device
        };

        // Match native tool format: <power DelayInSeconds="0" value="reset" />
        const command = buildXmlCommand('power', {
            DelayInSeconds: 0,
            value: valueMap[mode],
        });

        this.onLog(`Sending power command (${mode})...`);
        this.onLog(`TX: ${command}`, 'debug');

        // Drain any pending data first (like native tool does)
        await this.drainBuffer();

        // Send command - device may disconnect immediately
        const result = await this.usb.transferOut(stringToBytes(command));
        if (!result.success) {
            return { success: false, error: result.error };
        }

        // Try to read response but device may already be rebooting
        // Read ALL responses until device resets/disconnects
        // Native tool reads multiple log messages before device actually resets
        let allResponses = '';
        let sawResetAck = false;

        for (let i = 0; i < 15; i++) {
            try {
                const readResult = await this.usb.transferInQuick(READ_BUFFER_SIZE, 1000);
                if (readResult.success && readResult.data && readResult.data.length > 0) {
                    const response = bytesToString(readResult.data);
                    allResponses += response;
                    this.onLog(`RX: ${response.substring(0, 150)}`, 'debug');

                    if (response.includes('handler for power')) {
                        this.onLog('Device acknowledged power command', 'success');
                    }
                    if (response.includes('Will issue reset')) {
                        this.onLog('Device will reset...', 'info');
                    }
                    if (response.includes('bsp_target_reset')) {
                        this.onLog('Device resetting...', 'success');
                        sawResetAck = true;
                        // DON'T break - keep reading until device actually disconnects
                        // This is important - native tool keeps reading
                    }
                } else {
                    // No more data - if we saw reset ack, device might be resetting
                    if (sawResetAck) {
                        this.onLog('No more data from device, waiting for reset...', 'debug');
                        // Wait a bit then try reading again
                        await this.delay(500);
                    } else {
                        break;
                    }
                }
            } catch (e) {
                // Device disconnected - this is the expected behavior after reset!
                this.onLog('Device disconnected - reset complete!', 'success');
                sawResetAck = true;
                break;
            }
        }

        return { success: true, rawXml: allResponses };
    }

    /**
     * Send NOP command (heartbeat/test)
     */
    async nop(): Promise<FirehoseResponse> {
        const command = buildXmlCommand('nop');
        return this.sendCommand(command);
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    /**
     * Send command and read response
     */
    private async sendCommand(command: string): Promise<FirehoseResponse> {
        const sendResult = await this.usb.transferOut(stringToBytes(command));
        if (!sendResult.success) {
            return { success: false, error: sendResult.error };
        }

        // Read response(s)
        // Increased retries for first configure after Sahara (device may be slow to respond)
        let fullResponse = '';
        const MAX_RETRIES = 50; // 50 * 100ms = 5 seconds max wait
        const RETRY_DELAY = 100; // 100ms between retries

        for (let i = 0; i < MAX_RETRIES; i++) {
            const result = await this.usb.transferIn(READ_BUFFER_SIZE);
            if (!result.success || !result.data || result.data.length === 0) {
                // Log every 10 retries to show we're still waiting
                if (i > 0 && i % 10 === 0) {
                    this.onLog(`Waiting for response... (${i * RETRY_DELAY}ms)`, 'debug');
                }
                await this.delay(RETRY_DELAY);
                continue;
            }

            fullResponse += bytesToString(result.data);

            // Check if we have a complete response
            if (fullResponse.includes('ACK') || fullResponse.includes('NAK')) {
                break;
            }
        }

        this.onLog(`RX: ${fullResponse}`, 'debug');

        const parsed = parseXmlResponse(fullResponse);
        return {
            success: parsed.success,
            rawXml: fullResponse,
            value: parsed.value,
            error: parsed.error,
        };
    }

    /**
     * Get sector size based on memory type
     */
    private getSectorSize(): number {
        return this.config.memoryName === 'ufs' ? SECTOR_SIZE_UFS : SECTOR_SIZE_EMMC;
    }

    /**
     * Parse GPT data into partition info
     */
    private parseGPT(data: Uint8Array, sectorSize: number): PartitionInfo[] {
        try {
            // GPT Header starts at LBA 1 (sector 1)
            const headerOffset = sectorSize;

            // Check GPT signature
            const signature = bytesToString(data.slice(headerOffset, headerOffset + 8));
            if (signature !== GPT_SIGNATURE) {
                this.onLog(`Invalid GPT signature at offset ${headerOffset}: ${signature}`, 'debug');
                // Try offset 0 (some devices put header at start)
                const altSignature = bytesToString(data.slice(0, 8));
                if (altSignature === GPT_SIGNATURE) {
                    return this.parseGPTFromOffset(data, 0, sectorSize);
                }
                return [];
            }

            return this.parseGPTFromOffset(data, headerOffset, sectorSize);

        } catch (error) {
            this.onLog(`GPT parse error: ${error}`, 'error');
            return [];
        }
    }

    /**
     * Parse GPT from a specific offset
     */
    private parseGPTFromOffset(data: Uint8Array, headerOffset: number, sectorSize: number): PartitionInfo[] {
        const partitions: PartitionInfo[] = [];
        const headerView = new DataView(data.buffer, headerOffset);

        // Parse GPT header
        const partitionEntryLBA = headerView.getBigUint64(72, true);
        const partitionEntryCount = headerView.getUint32(80, true);
        const partitionEntrySize = headerView.getUint32(84, true);

        this.onLog(`GPT: ${partitionEntryCount} entries, entry size ${partitionEntrySize}`, 'debug');

        // Partition entries start at specified LBA
        const entriesOffset = Number(partitionEntryLBA) * sectorSize;

        for (let i = 0; i < partitionEntryCount; i++) {
            const entryOffset = entriesOffset + (i * partitionEntrySize);
            if (entryOffset + partitionEntrySize > data.length) break;

            const entryView = new DataView(data.buffer, entryOffset);

            // Check if partition type GUID is all zeros (empty entry)
            const typeGuidBytes = data.slice(entryOffset, entryOffset + 16);
            if (typeGuidBytes.every(b => b === 0)) continue;

            // Parse partition entry
            const startLBA = entryView.getBigUint64(32, true);
            const endLBA = entryView.getBigUint64(40, true);
            const attributes = entryView.getBigUint64(48, true);

            // Parse partition name (UTF-16LE, 72 bytes starting at offset 56)
            const nameBytes = data.slice(entryOffset + 56, entryOffset + 128);
            let name = '';
            for (let j = 0; j < nameBytes.length; j += 2) {
                const charCode = nameBytes[j] | (nameBytes[j + 1] << 8);
                if (charCode === 0) break;
                name += String.fromCharCode(charCode);
            }

            if (name) {
                const sizeInSectors = endLBA - startLBA + 1n;
                const sizeInBytes = sizeInSectors * BigInt(sectorSize);

                partitions.push({
                    name,
                    lun: 0, // Will be updated by caller if needed
                    startSector: startLBA,
                    endSector: endLBA,
                    sizeInSectors,
                    size: Number(sizeInBytes),
                    sizeFormatted: this.formatSize(sizeInBytes),
                    typeGuid: this.bytesToGuid(typeGuidBytes),
                    uniqueGuid: this.bytesToGuid(data.slice(entryOffset + 16, entryOffset + 32)),
                    attributes,
                });
            }
        }

        return partitions;
    }

    /**
     * Convert GUID bytes to string format
     */
    private bytesToGuid(bytes: Uint8Array): string {
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
        // GUID is stored in mixed-endian format
        return [
            hex.slice(0, 4).reverse().join(''),
            hex.slice(4, 6).reverse().join(''),
            hex.slice(6, 8).reverse().join(''),
            hex.slice(8, 10).join(''),
            hex.slice(10, 16).join(''),
        ].join('-');
    }

    /**
     * Format size in human-readable format
     */
    private formatSize(bytes: bigint): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = Number(bytes);
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
