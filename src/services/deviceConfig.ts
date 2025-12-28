/**
 * Device Configuration Service
 * 
 * Manages device profiles with dynamic loading from JSON config
 * and ability to fetch firehose files from GitHub.
 */

import { loadBinaryFile } from '../presets';

// ============================================================================
// Types
// ============================================================================

export type BrandType = 'oppo' | 'oneplus' | 'realme' | 'qualcomm';
export type DeviceStatus = 'tested' | 'beta' | 'coming';
export type AuthMethod = 'oppo_vip' | 'oneplus_vip' | 'standard';

export interface FirehoseUrls {
    programmerUrl?: string;
    digestUrl?: string;
    signatureUrl?: string;
}

export interface DeviceProfile {
    id: string;
    brand: BrandType;
    name: string;
    codename: string;
    chipset: string;
    chipsetName: string;
    status: DeviceStatus;
    authMethod: AuthMethod;
    presetId: string | null;
    firehose?: FirehoseUrls;
}

export interface FirehoseFiles {
    programmer: Uint8Array;
    digest: Uint8Array;
    signature: Uint8Array;
}

export interface LoadResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// ============================================================================
// Cache
// ============================================================================

let cachedDevices: DeviceProfile[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Device Config Functions
// ============================================================================

/**
 * Load device configurations from local JSON
 * With caching to avoid repeated fetches
 */
export async function loadDeviceConfigs(): Promise<LoadResult<DeviceProfile[]>> {
    // Return cached if still valid
    if (cachedDevices && Date.now() - cacheTimestamp < CACHE_DURATION) {
        return { success: true, data: cachedDevices };
    }

    try {
        const response = await fetch('/configs/devices.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const devices = await response.json() as DeviceProfile[];

        // Validate structure
        if (!Array.isArray(devices)) {
            throw new Error('Invalid config format: expected array');
        }

        // Update cache
        cachedDevices = devices;
        cacheTimestamp = Date.now();

        return { success: true, data: devices };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Failed to load device configs:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Get a specific device by ID
 */
export async function getDeviceById(id: string): Promise<DeviceProfile | null> {
    const result = await loadDeviceConfigs();
    if (!result.success || !result.data) return null;
    return result.data.find(d => d.id === id) || null;
}

/**
 * Get devices filtered by status
 */
export async function getDevicesByStatus(status: DeviceStatus): Promise<DeviceProfile[]> {
    const result = await loadDeviceConfigs();
    if (!result.success || !result.data) return [];
    return result.data.filter(d => d.status === status);
}

/**
 * Get devices that have firehose available (either local preset or remote URLs)
 */
export async function getAvailableDevices(): Promise<DeviceProfile[]> {
    const result = await loadDeviceConfigs();
    if (!result.success || !result.data) return [];
    return result.data.filter(d =>
        d.status === 'tested' ||
        d.status === 'beta' ||
        d.presetId !== null ||
        (d.firehose && d.firehose.programmerUrl)
    );
}

// ============================================================================
// Firehose Loading Functions
// ============================================================================

/**
 * Load a binary file from a remote URL (GitHub, etc.)
 * Uses XMLHttpRequest to avoid download manager interception
 */
async function loadRemoteBinaryFile(
    url: string,
    onProgress?: (loaded: number, total: number) => void
): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';

        // Headers to avoid download manager interception
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Accept', 'application/octet-stream');

        xhr.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(e.loaded, e.total);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(new Uint8Array(xhr.response));
            } else {
                reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error loading remote file'));
        xhr.ontimeout = () => reject(new Error('Timeout loading remote file'));

        xhr.timeout = 60000; // 60 second timeout
        xhr.send();
    });
}

/**
 * Convert GitHub blob URL to raw content URL
 * github.com/user/repo/blob/main/file.ext -> raw.githubusercontent.com/user/repo/main/file.ext
 */
function toRawGitHubUrl(url: string): string {
    // Already a raw URL
    if (url.includes('raw.githubusercontent.com') || url.includes('cdn.jsdelivr.net')) {
        return url;
    }

    // Convert blob URL to raw
    const blobPattern = /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/;
    const match = url.match(blobPattern);
    if (match) {
        const [, owner, repo, branch, path] = match;
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    }

    return url;
}

export interface FirehoseLoadProgress {
    file: 'programmer' | 'digest' | 'signature';
    loaded: number;
    total: number;
}

/**
 * Load firehose files for a device
 * Supports both local paths (/firehose/...) and remote URLs (GitHub, etc.)
 */
export async function loadFirehoseForDevice(
    device: DeviceProfile,
    onProgress?: (progress: FirehoseLoadProgress) => void,
    onLog?: (message: string, level: 'info' | 'success' | 'error' | 'warning') => void
): Promise<LoadResult<FirehoseFiles>> {
    const log = onLog || (() => { });

    // Check if firehose URLs are available
    if (device.firehose?.programmerUrl && device.firehose?.digestUrl && device.firehose?.signatureUrl) {
        // Detect if local or remote
        const isLocal = device.firehose.programmerUrl.startsWith('/');

        if (isLocal) {
            log(`📦 Loading firehose from local for ${device.name}...`, 'info');
        } else {
            log(`📡 Loading firehose from remote for ${device.name}...`, 'info');
        }

        try {
            // For remote GitHub URLs, convert to raw format
            const programmerUrl = isLocal ? device.firehose.programmerUrl : toRawGitHubUrl(device.firehose.programmerUrl);
            const digestUrl = isLocal ? device.firehose.digestUrl : toRawGitHubUrl(device.firehose.digestUrl);
            const signatureUrl = isLocal ? device.firehose.signatureUrl : toRawGitHubUrl(device.firehose.signatureUrl);

            // Load programmer
            log('Downloading programmer...', 'info');
            const programmer = await loadRemoteBinaryFile(programmerUrl, (loaded, total) => {
                onProgress?.({ file: 'programmer', loaded, total });
            });
            log(`✓ Programmer: ${formatBytes(programmer.length)}`, 'success');

            // Load digest
            log('Downloading digest...', 'info');
            const digest = await loadRemoteBinaryFile(digestUrl, (loaded, total) => {
                onProgress?.({ file: 'digest', loaded, total });
            });
            log(`✓ Digest: ${formatBytes(digest.length)}`, 'success');

            // Load signature
            log('Downloading signature...', 'info');
            const signature = await loadRemoteBinaryFile(signatureUrl, (loaded, total) => {
                onProgress?.({ file: 'signature', loaded, total });
            });
            log(`✓ Signature: ${formatBytes(signature.length)}`, 'success');

            return {
                success: true,
                data: { programmer, digest, signature }
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log(`⚠️ Remote load failed: ${errorMsg}`, 'warning');
            log('Trying local preset fallback...', 'info');
        }
    }

    // Fallback to local preset
    if (device.presetId) {
        log(`📦 Loading from local preset: ${device.presetId}`, 'info');

        try {
            // Import presets dynamically to get URLs
            const { DEVICE_PRESETS } = await import('../presets');
            const preset = DEVICE_PRESETS[device.presetId];

            if (!preset?.available || !preset.files) {
                return {
                    success: false,
                    error: `Local preset '${device.presetId}' not available`
                };
            }

            // Load from local URLs
            log('Loading programmer...', 'info');
            const programmer = await loadBinaryFile(preset.files.programmer);
            log(`✓ Programmer: ${formatBytes(programmer.length)}`, 'success');

            log('Loading digest...', 'info');
            const digest = await loadBinaryFile(preset.files.digest);
            log(`✓ Digest: ${formatBytes(digest.length)}`, 'success');

            log('Loading signature...', 'info');
            const signature = await loadBinaryFile(preset.files.signature);
            log(`✓ Signature: ${formatBytes(signature.length)}`, 'success');

            return {
                success: true,
                data: { programmer, digest, signature }
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return { success: false, error: `Local preset load failed: ${errorMsg}` };
        }
    }

    return {
        success: false,
        error: 'No firehose source available (no remote URLs or local preset)'
    };
}

// ============================================================================
// Utilities
// ============================================================================

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Clear the device config cache
 */
export function clearDeviceCache(): void {
    cachedDevices = null;
    cacheTimestamp = 0;
}
