/**
 * Device Presets - Binary files embedded as base64
 * 
 * Files are imported at build time using Vite's ?url feature
 * This avoids IDM/download managers intercepting the fetch
 */

// Import binary files as URLs (Vite handles this)
import programmer8Gen3Url from '../public/presets/8Gen3/programmer.melf?url';
import digest8Gen3Url from '../public/presets/8Gen3/digest.elf?url';
import signature8Gen3Url from '../public/presets/8Gen3/signature.bin?url';

export interface PresetConfig {
    name: string;
    available: boolean;
    files?: {
        programmer: string;
        digest: string;
        signature: string;
    };
}

export const DEVICE_PRESETS: Record<string, PresetConfig> = {
    '8Gen3': {
        name: 'Snapdragon 8 Gen 3 (Find X7 Ultra)',
        available: true,
        files: {
            programmer: programmer8Gen3Url,
            digest: digest8Gen3Url,
            signature: signature8Gen3Url,
        },
    },
    '8Gen2': {
        name: 'Snapdragon 8 Gen 2',
        available: false,
    },
};

/**
 * Load a binary file from URL, avoiding IDM interception
 */
export async function loadBinaryFile(url: string): Promise<Uint8Array> {
    // Use XMLHttpRequest with specific settings to avoid IDM
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';

        // These headers help avoid download manager interception
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Accept', 'application/octet-stream');

        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(new Uint8Array(xhr.response));
            } else {
                reject(new Error(`Failed to load: ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send();
    });
}
