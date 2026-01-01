/**
 * ADB Protocol Wrapper
 * 
 * Provides a TypeScript wrapper around the @yume-chan/adb library
 * for use in React components. Follows the Tango ADB pattern.
 */

import { Adb, AdbDaemonTransport, LinuxFileType } from '@yume-chan/adb';
import { AdbDaemonWebUsbDeviceManager, AdbDaemonWebUsbDevice } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';
import { MaybeConsumable, ReadableStream as YumeReadableStream } from '@yume-chan/stream-extra';

// Helper to convert Uint8Array to ReadableStream for sync.write
function uint8ArrayToStream(data: Uint8Array): YumeReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(data);
            controller.close();
        }
    }) as unknown as YumeReadableStream<Uint8Array>;
}

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Device information retrieved via ADB shell commands
 */
export interface ADBDeviceInfo {
    model: string;
    androidVersion: string;
    buildNumber: string;
    serialNumber: string;
    manufacturer: string;
    device: string;
    batteryLevel?: string;
    batteryStatus?: string;
    storageUsage?: string;
    memoryUsage?: string;
    ipAddress?: string;
    wifiStatus?: string;
}

export interface ADBFileEntry {
    name: string;
    path: string;
    type: 'file' | 'directory' | 'link';
    size: number;
    mtime: Date;
}

export interface ADBAppEntry {
    package: string;
    path: string;
    enabled: boolean;
    type: 'user' | 'system';
}

type LogCallback = (message: string, level?: 'info' | 'debug' | 'error' | 'success' | 'warning') => void;

// ============================================================================
// ADB Protocol Class
// ============================================================================

export class ADBProtocol {
    private static instance: ADBProtocol | null = null;
    private adb: Adb | null = null;
    private device: AdbDaemonWebUsbDevice | null = null;
    private credentialStore: AdbWebCredentialStore;
    private onLog: LogCallback;
    private connectionPromise: Promise<boolean> | null = null;
    private onConnectionChange: ((connected: boolean) => void) | null = null;
    private _lastError: string | null = null;

    /**
     * Get the last connection error (if any)
     */
    get lastError(): string | null {
        return this._lastError;
    }

    /**
     * Check if last error was "device in use" type
     */
    get isDeviceInUseError(): boolean {
        if (!this._lastError) return false;
        const lower = this._lastError.toLowerCase();
        return lower.includes('in use') ||
            lower.includes('used by') ||
            lower.includes('another program') ||
            lower.includes('claimed') ||
            lower.includes('busy');
    }

    /**
     * Get the singleton instance of ADBProtocol
     */
    static getInstance(logger?: LogCallback): ADBProtocol {
        if (!ADBProtocol.instance) {
            ADBProtocol.instance = new ADBProtocol(logger);
        } else if (logger) {
            ADBProtocol.instance.onLog = logger;
        }
        return ADBProtocol.instance;
    }

    /**
     * Set a listener for connection status changes
     */
    setConnectionChangeListener(listener: (connected: boolean) => void) {
        this.onConnectionChange = listener;
    }

    /**
     * WebUSB device filters for ADB mode
     */
    static getFilters(): USBDeviceFilter[] {
        return [
            { vendorId: 0x18D1 },  // Google
            { vendorId: 0x05C6 },  // Qualcomm
            { vendorId: 0x2A70 },  // OnePlus
            { vendorId: 0x22D9 },  // OPPO
            { vendorId: 0x2717 },  // Xiaomi
            { vendorId: 0x04E8 },  // Samsung
            { vendorId: 0x0BB4 },  // HTC
            { vendorId: 0x12D1 },  // Huawei
            { vendorId: 0x2AE5 },  // Realme
            { vendorId: 0x2D95 },  // Vivo
            { vendorId: 0x339B },  // Honor
            { vendorId: 0x22B8 },  // Motorola
            { vendorId: 0x0FCE },  // Sony
            { vendorId: 0x1004 },  // LG
            { vendorId: 0x0B05 },  // ASUS
        ];
    }

    private constructor(logger?: LogCallback) {
        this.onLog = logger || ((msg) => console.log('[ADB]', msg));
        // Use 'Tango' as name to share keys with Tango App (app.tangoapp.dev)
        // This allows users who have already authorized Tango to skip re-authorization
        this.credentialStore = new AdbWebCredentialStore('Tango');
    }

    // ============================================================================
    // Connection State
    // ============================================================================

    get isConnected(): boolean {
        return this.adb !== null;
    }

    get adbInstance(): Adb | null {
        return this.adb;
    }

    // ============================================================================
    // Connection Methods
    // ============================================================================

    /**
     * Get count of paired devices
     */
    async getPairedDevicesCount(): Promise<number> {
        const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
        if (!manager) return 0;
        try {
            const devices = await manager.getDevices();
            return devices.length;
        } catch {
            return 0;
        }
    }

    /**
     * Check if a specific USB device matches our current ADB device
     */
    isCurrentDevice(usbDevice: USBDevice): boolean {
        if (!this.device) return false;
        const currentRaw = this.device.raw;
        if (currentRaw && (currentRaw as USBDevice).serialNumber === usbDevice.serialNumber) {
            return true;
        }
        return false;
    }

    /**
     * Restore connection to a previously paired device
     */
    async restoreConnection(): Promise<boolean> {
        if (this.adb) return true;

        const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
        if (!manager) return false;

        try {
            const devices = await manager.getDevices();
            if (devices.length > 0) {
                this.onLog('Found previously paired device, attempting to reconnect...', 'info');
                return await this.connectToDevice(devices[0]);
            }
        } catch (error) {
            this.onLog(`Auto-reconnect failed: ${error}`, 'debug');
        }

        return false;
    }

    /**
     * Connect to an ADB device via WebUSB
     */
    async connect(specificDevice?: AdbDaemonWebUsbDevice): Promise<boolean> {
        const manager = AdbDaemonWebUsbDeviceManager.BROWSER;
        if (!manager) {
            this.onLog('WebUSB not supported in this browser', 'error');
            return false;
        }

        try {
            if (specificDevice) {
                return await this.connectToDevice(specificDevice);
            }

            this.onLog('Requesting ADB device...', 'info');
            const device = await manager.requestDevice({
                filters: ADBProtocol.getFilters()
            });

            if (!device) {
                this.onLog('No device selected', 'info');
                return false;
            }

            return await this.connectToDevice(device);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const lowerMessage = message.toLowerCase();

            this._lastError = message; // Store last error

            if (message.includes('No device selected')) {
                this._lastError = null; // User cancelled, not an error
                this.onLog('Connection cancelled by user', 'info');
            } else if (lowerMessage.includes('in use') ||
                lowerMessage.includes('used') ||
                lowerMessage.includes('busy') ||
                lowerMessage.includes('claimed') ||
                lowerMessage.includes('another program')) {
                // Device is being used by another program
                this.onLog(`❌ Connection failed: ${message}`, 'error');
                this.onLog('⚠️ Device is being used by another program. Try:', 'warning');
                this.onLog('   1. Disconnect and reconnect the USB cable', 'info');
                this.onLog('   2. Open Terminal/CMD and run: adb kill-server', 'info');
                this.onLog('   3. Close apps using ADB: Android Studio, Scrcpy, etc.', 'info');
            } else {
                this.onLog(`Connection failed: ${message}`, 'error');
            }
            return false;
        }
    }

    /**
     * Internal: Connect to a specific device with retry logic
     */
    private async connectToDevice(device: AdbDaemonWebUsbDevice): Promise<boolean> {
        // Prevent concurrent connection attempts
        if (this.connectionPromise) {
            this.onLog('Connection already in progress, waiting...', 'debug');
            return this.connectionPromise;
        }

        this.connectionPromise = (async () => {
            this.device = device;
            this.onLog(`Device selected: ${device.name || 'Unknown Device'}`, 'debug');

            const maxRetries = 10;
            const retryDelay = 2000;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    if (attempt > 1) {
                        this.onLog(`Connection attempt ${attempt}/${maxRetries}...`, 'info');
                    } else {
                        this.onLog('Establishing ADB connection...', 'info');
                    }

                    const connection = await device.connect();

                    // Log authentication attempt
                    this.onLog('Authenticating with stored RSA keys...', 'debug');

                    const transport = await AdbDaemonTransport.authenticate({
                        serial: device.serial,
                        connection,
                        credentialStore: this.credentialStore,
                    });

                    this.adb = new Adb(transport);
                    this.onLog(`Connected to ${device.name || 'Device'}`, 'success');

                    if (this.onConnectionChange) {
                        this.onConnectionChange(true);
                    }

                    return true;

                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    const lowerMessage = message.toLowerCase();

                    // Check for device in use by another program (not retryable)
                    if (lowerMessage.includes('in use') ||
                        lowerMessage.includes('used by') ||
                        lowerMessage.includes('another program') ||
                        lowerMessage.includes('claimed')) {
                        this._lastError = message; // Store for useADB to check
                        this.onLog(`❌ Connection failed: ${message}`, 'error');
                        this.onLog('⚠️ Device is being used by another program. Try:', 'warning');
                        this.onLog('   1. Disconnect and reconnect the USB cable', 'info');
                        this.onLog('   2. Open Terminal/CMD and run: adb kill-server', 'info');
                        this.onLog('   3. Close apps using ADB: Android Studio, Scrcpy, etc.', 'info');
                        break; // Don't retry for this error
                    }

                    if (message.includes('No authenticator') ||
                        message.includes('Authentication failed') ||
                        message.includes('closed') ||
                        message.includes('busy') ||
                        message.includes('in progress')) {

                        if (message.includes('in progress') || message.includes('busy')) {
                            this.onLog('Device is busy (another tab/process?), retrying...', 'warning');
                        } else {
                            this.onLog('⚠️  Please check your phone screen and ALLOW USB debugging!', 'info');
                            this.onLog('💡 Tip: Check "Always allow from this computer" to skip this next time', 'info');
                        }

                        if (attempt === maxRetries) {
                            this.onLog(`❌ Failed to connect after ${maxRetries * (retryDelay / 1000)}s.`, 'error');
                            // Show guidance if it was a "busy" type error
                            if (message.includes('busy') || message.includes('in progress')) {
                                this.onLog('⚠️ Device may still be in use. Try:', 'warning');
                                this.onLog('   1. Disconnect and reconnect the USB cable', 'info');
                                this.onLog('   2. Run: adb kill-server', 'info');
                            }
                            break;
                        }

                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }

                    this.onLog(`Failed to connect: ${message}`, 'error');
                    break;
                }
            }

            this.device = null;
            this.adb = null;
            return false;
        })();

        try {
            return await this.connectionPromise;
        } finally {
            this.connectionPromise = null;
        }
    }

    /**
     * Disconnect from the current ADB device
     */
    async disconnect(): Promise<void> {
        try {
            if (this.adb) {
                await this.adb.close();
                this.onLog('ADB disconnected', 'info');
                if (this.onConnectionChange) {
                    this.onConnectionChange(false);
                }
            }
        } catch (error) {
            this.onLog(`Disconnect error: ${error}`, 'debug');
        } finally {
            this.adb = null;
            this.device = null;
            this.connectionPromise = null;
        }
    }

    // ============================================================================
    // Shell Commands
    // ============================================================================

    /**
     * Run a shell command on the device
     */
    async runShellCommand(command: string): Promise<string> {
        if (!this.adb) {
            throw new Error('Not connected to device');
        }

        try {
            // Use createSocketAndWait for shell commands
            const result = await this.adb.createSocketAndWait(`shell:${command}`);
            return result;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Shell command failed: ${message}`, 'error');
            throw error;
        }
    }

    /**
     * Check if device is ready for complex operations (like scrcpy)
     * This verifies that the device is not only connected but actually responsive
     */
    async checkDeviceReadiness(): Promise<boolean> {
        if (!this.adb) {
            console.log('[ADB] checkDeviceReadiness: No ADB instance');
            return false;
        }

        try {
            // Try a simple command to check if device is responsive
            // Using 'echo' is lightweight and safe
            console.log('[ADB] checkDeviceReadiness: Running echo command...');
            const result = await this.runShellCommand('echo ready');
            const isReady = result.trim() === 'ready';
            console.log('[ADB] checkDeviceReadiness: Result =', result.trim(), ', isReady =', isReady);
            return isReady;
        } catch (error) {
            console.log('[ADB] checkDeviceReadiness: Error =', error);
            this.onLog('Device not ready yet...', 'debug');
            return false;
        }
    }

    // ============================================================================
    // Device Information
    // ============================================================================

    /**
     * Get device information
     */
    async getDeviceInfo(): Promise<ADBDeviceInfo | null> {
        if (!this.adb) {
            this.onLog('Not connected - cannot get device info', 'error');
            return null;
        }

        try {
            const getProp = async (prop: string): Promise<string> => {
                try {
                    const result = await this.adb!.getProp(prop);
                    return result?.trim() || 'Unknown';
                } catch {
                    return 'Unknown';
                }
            };

            const safeShellCommand = async (cmd: string): Promise<string> => {
                try {
                    return await this.runShellCommand(cmd);
                } catch {
                    return '';
                }
            };

            const [model, androidVersion, buildNumber, manufacturer, device, batteryRaw, dfRaw, meminfoRaw, ipRaw, wifiRaw] =
                await Promise.all([
                    getProp('ro.product.model'),
                    getProp('ro.build.version.release'),
                    getProp('ro.build.display.id'),
                    getProp('ro.product.manufacturer'),
                    getProp('ro.product.device'),
                    safeShellCommand('dumpsys battery'),
                    safeShellCommand('df -h /data'),
                    safeShellCommand('cat /proc/meminfo'),
                    safeShellCommand('ip -4 addr show wlan0'),
                    safeShellCommand('settings get global wifi_on'),
                ]);

            // Parse battery
            let batteryLevel = 'Unknown';
            let batteryStatus = 'Unknown';
            if (batteryRaw) {
                const levelMatch = batteryRaw.match(/level: (\d+)/);
                const statusMatch = batteryRaw.match(/status: (\d+)/);
                if (levelMatch) batteryLevel = `${levelMatch[1]}%`;
                if (statusMatch) {
                    const s = parseInt(statusMatch[1]);
                    batteryStatus = s === 2 ? 'Charging' : s === 5 ? 'Full' : 'Discharging';
                    if (s === 2) batteryLevel += ' (Charging)';
                }
            }

            // Parse storage
            let storageUsage = 'Unknown';
            if (dfRaw) {
                const lines = dfRaw.trim().split('\n');
                if (lines.length >= 2) {
                    const dataLine = lines.find(l => l.trim().endsWith('/data')) || lines[lines.length - 1];
                    const parts = dataLine.trim().split(/\s+/);
                    if (parts.length >= 5) {
                        storageUsage = `${parts[2]} / ${parts[1]}`;
                    }
                }
            }

            // Parse memory
            let memoryUsage = 'Unknown';
            if (meminfoRaw) {
                const totalMatch = meminfoRaw.match(/MemTotal:\s+(\d+)\s+kB/);
                const freeMatch = meminfoRaw.match(/MemAvailable:\s+(\d+)\s+kB/);
                if (totalMatch && freeMatch) {
                    const total = parseInt(totalMatch[1]) / 1024 / 1024;
                    const available = parseInt(freeMatch[1]) / 1024 / 1024;
                    const used = total - available;
                    memoryUsage = `${used.toFixed(1)} GB / ${total.toFixed(1)} GB`;
                }
            }

            // Parse network
            let ipAddress = 'Not Connected';
            let wifiStatus = 'Not Connected';
            if (wifiRaw && wifiRaw.trim() === '1') {
                wifiStatus = 'Enabled';
            }
            if (ipRaw) {
                const match = ipRaw.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
                if (match) {
                    ipAddress = match[1];
                    wifiStatus = 'Connected';
                }
            }

            const serialNumber = this.device?.serial || 'Unknown';

            const info: ADBDeviceInfo = {
                model, androidVersion, buildNumber, serialNumber, manufacturer, device,
                batteryLevel, batteryStatus, storageUsage, memoryUsage, ipAddress, wifiStatus
            };

            this.onLog(`Device: ${manufacturer} ${model} (Android ${androidVersion})`, 'success');
            return info;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.onLog(`Failed to get device info: ${message}`, 'error');
            return null;
        }
    }

    // ============================================================================
    // Reboot Commands
    // ============================================================================

    async reboot(): Promise<boolean> {
        if (!this.adb) return false;
        try {
            await this.runShellCommand('reboot');
            this.onLog('Rebooting device...', 'success');
            await this.disconnect();
            return true;
        } catch (error) {
            this.onLog(`Reboot failed: ${error}`, 'error');
            return false;
        }
    }

    async rebootToRecovery(): Promise<boolean> {
        if (!this.adb) return false;
        try {
            await this.runShellCommand('reboot recovery');
            this.onLog('Rebooting to recovery...', 'success');
            await this.disconnect();
            return true;
        } catch (error) {
            this.onLog(`Reboot to recovery failed: ${error}`, 'error');
            return false;
        }
    }

    async rebootToBootloader(): Promise<boolean> {
        if (!this.adb) return false;
        try {
            await this.runShellCommand('reboot bootloader');
            this.onLog('Rebooting to bootloader...', 'success');
            await this.disconnect();
            return true;
        } catch (error) {
            this.onLog(`Reboot to bootloader failed: ${error}`, 'error');
            return false;
        }
    }

    async rebootToFastbootD(): Promise<boolean> {
        if (!this.adb) return false;
        try {
            await this.runShellCommand('reboot fastboot');
            this.onLog('Rebooting to fastbootd...', 'success');
            await this.disconnect();
            return true;
        } catch (error) {
            this.onLog(`Reboot to fastbootd failed: ${error}`, 'error');
            return false;
        }
    }

    async rebootToEDL(): Promise<boolean> {
        if (!this.adb) return false;
        try {
            await this.runShellCommand('reboot edl');
            this.onLog('Rebooting to EDL mode...', 'success');
            await this.disconnect();
            return true;
        } catch (error) {
            this.onLog(`Reboot to EDL failed: ${error}`, 'error');
            return false;
        }
    }

    async shutdown(): Promise<boolean> {
        if (!this.adb) return false;
        try {
            await this.runShellCommand('reboot -p');
            this.onLog('Shutting down device...', 'success');
            await this.disconnect();
            return true;
        } catch (error) {
            this.onLog(`Shutdown failed: ${error}`, 'error');
            return false;
        }
    }

    // ============================================================================
    // App Management
    // ============================================================================

    async listPackages(systemApps: boolean = false): Promise<string[]> {
        if (!this.adb) return [];
        try {
            const flag = systemApps ? '-s' : '-3';
            const result = await this.runShellCommand(`pm list packages ${flag}`);
            return result.split('\n')
                .map(line => line.replace('package:', '').trim())
                .filter(pkg => pkg.length > 0);
        } catch {
            return [];
        }
    }

    async getPackagePath(packageName: string): Promise<string | null> {
        if (!this.adb) return null;
        try {
            const result = await this.runShellCommand(`pm path ${packageName}`);
            const match = result.match(/package:(.+)/);
            return match ? match[1].trim() : null;
        } catch {
            return null;
        }
    }

    async installAPK(apkData: Uint8Array, packageName?: string): Promise<boolean> {
        if (!this.adb) return false;
        try {
            const tempPath = `/data/local/tmp/${packageName || 'temp'}.apk`;
            const sync = await this.adb.sync();
            await sync.write({
                filename: tempPath,
                file: uint8ArrayToStream(apkData),
            });
            await this.runShellCommand(`pm install -r "${tempPath}"`);
            await this.runShellCommand(`rm "${tempPath}"`);
            this.onLog(`Installed APK successfully`, 'success');
            return true;
        } catch (error) {
            this.onLog(`Install failed: ${error}`, 'error');
            return false;
        }
    }

    // Alias for compatibility
    async installApk(apkData: Uint8Array, packageName?: string): Promise<boolean> {
        return this.installAPK(apkData, packageName);
    }

    async uninstallPackage(packageName: string): Promise<boolean> {
        if (!this.adb) return false;
        try {
            await this.runShellCommand(`pm uninstall ${packageName}`);
            this.onLog(`Uninstalled ${packageName}`, 'success');
            return true;
        } catch (error) {
            this.onLog(`Uninstall failed: ${error}`, 'error');
            return false;
        }
    }

    // ============================================================================
    // File Operations
    // ============================================================================

    async listDirectory(path: string): Promise<ADBFileEntry[]> {
        if (!this.adb) return [];
        try {
            const sync = await this.adb.sync();
            const entries: ADBFileEntry[] = [];

            for await (const entry of sync.opendir(path)) {
                let fileType: 'file' | 'directory' | 'link' = 'file';
                if (entry.type === LinuxFileType.Directory) {
                    fileType = 'directory';
                } else if (entry.type === LinuxFileType.Link) {
                    fileType = 'link';
                }

                entries.push({
                    name: entry.name,
                    path: `${path}/${entry.name}`,
                    type: fileType,
                    size: Number(entry.size),
                    mtime: new Date(Number(entry.mtime) * 1000),
                });
            }

            return entries;
        } catch (error) {
            this.onLog(`List directory failed: ${error}`, 'error');
            return [];
        }
    }

    async readFile(path: string): Promise<Uint8Array> {
        if (!this.adb) throw new Error('Not connected');
        const sync = await this.adb.sync();
        const chunks: Uint8Array[] = [];

        for await (const chunk of sync.read(path)) {
            chunks.push(chunk);
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    }

    async pullFile(remotePath: string): Promise<Uint8Array> {
        return this.readFile(remotePath);
    }

    async writeFile(remotePath: string, data: Uint8Array): Promise<boolean> {
        if (!this.adb) return false;
        try {
            const sync = await this.adb.sync();
            await sync.write({
                filename: remotePath,
                file: uint8ArrayToStream(data),
            });
            this.onLog(`File written: ${remotePath}`, 'success');
            return true;
        } catch (error) {
            this.onLog(`Write file failed: ${error}`, 'error');
            return false;
        }
    }

    async pushFile(localData: Uint8Array, remotePath: string): Promise<boolean> {
        return this.writeFile(remotePath, localData);
    }

    /**
     * Push a file using streaming - for large files (10GB+)
     * This avoids loading the entire file into memory
     */
    async pushFileStream(
        file: File,
        remotePath: string,
        onProgress?: (bytesWritten: number, totalBytes: number) => void
    ): Promise<boolean> {
        if (!this.adb) return false;

        const totalSize = file.size;
        let bytesWritten = 0;

        try {
            this.onLog(`Starting stream upload: ${file.name} (${(totalSize / 1024 / 1024).toFixed(2)} MB)`, 'info');

            const sync = await this.adb.sync();

            // Create a transform stream that tracks progress
            const fileStream = file.stream();
            const reader = fileStream.getReader();

            // Create a new ReadableStream that reports progress
            const progressStream = new ReadableStream<Uint8Array>({
                async pull(controller) {
                    const { done, value } = await reader.read();
                    if (done) {
                        controller.close();
                        return;
                    }
                    bytesWritten += value.length;
                    if (onProgress) {
                        onProgress(bytesWritten, totalSize);
                    }
                    controller.enqueue(value);
                },
                cancel() {
                    reader.cancel();
                }
            });

            await sync.write({
                filename: remotePath,
                file: progressStream as unknown as YumeReadableStream<MaybeConsumable<Uint8Array>>,
            });

            this.onLog(`Upload complete: ${remotePath}`, 'success');
            return true;
        } catch (error) {
            this.onLog(`Stream upload failed: ${error}`, 'error');
            return false;
        }
    }

    async deleteFile(path: string): Promise<boolean> {
        if (!this.adb) return false;
        try {
            await this.runShellCommand(`rm -rf "${path}"`);
            this.onLog(`Deleted: ${path}`, 'success');
            return true;
        } catch (error) {
            this.onLog(`Delete failed: ${error}`, 'error');
            return false;
        }
    }

    async createDirectory(path: string): Promise<boolean> {
        if (!this.adb) return false;
        try {
            await this.runShellCommand(`mkdir -p "${path}"`);
            this.onLog(`Created directory: ${path}`, 'success');
            return true;
        } catch (error) {
            this.onLog(`Create directory failed: ${error}`, 'error');
            return false;
        }
    }
}

export default ADBProtocol;
