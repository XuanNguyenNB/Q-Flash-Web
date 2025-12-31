/**
 * useFirehoseLoader Hook
 * 
 * Automatically loads firehose files when a device is selected.
 * Uses device's firehose URLs from devices.json, caches files by chipset,
 * and syncs state with deviceStore.
 * 
 * @story 2-3-auto-detect-firehose-by-chipset
 */

import { useState, useCallback, useRef } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';
import { useTerminalStore } from '@/stores/terminalStore';
import type { DeviceEntry } from '@/hooks/useDevices';

/**
 * Firehose files loaded for a device.
 */
export interface FirehoseFiles {
    programmer: ArrayBuffer;
    digest: ArrayBuffer;
    signature: ArrayBuffer;
}

/**
 * Loading status for firehose loader.
 */
export type FirehoseLoaderStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Progress tracking for firehose loading.
 */
export interface FirehoseProgress {
    loaded: number;
    total: number;
    currentFile: string;
    files: string[];
}

/**
 * Return type for useFirehoseLoader hook.
 */
export interface UseFirehoseLoaderReturn {
    /** Load firehose files for a device */
    loadFirehose: (device: DeviceEntry) => Promise<FirehoseFiles | null>;
    /** Current loading status */
    status: FirehoseLoaderStatus;
    /** Loading progress details */
    progress: FirehoseProgress;
    /** Error message if loading failed */
    error: string | null;
    /** Whether to show manual file selection popup */
    showManualPopup: boolean;
    /** Toggle manual popup visibility */
    setShowManualPopup: (show: boolean) => void;
    /** Get cached firehose files for a chipset */
    getCached: (chipset: string) => FirehoseFiles | undefined;
    /** Clear all cached firehose files */
    clearCache: () => void;
}

// Module-level cache for firehose files, keyed by chipset
// Persists across component re-renders and re-mounts
const firehoseCache = new Map<string, FirehoseFiles>();

/**
 * Initial progress state.
 */
const initialProgress: FirehoseProgress = {
    loaded: 0,
    total: 3,
    currentFile: '',
    files: [],
};

/**
 * Hook to automatically load firehose files for a selected device.
 * 
 * Features:
 * - Fetches programmer.melf, digest.elf, signature.bin
 * - Caches files by chipset to avoid re-fetching
 * - Logs progress and errors to terminal
 * - Provides fallback to manual file selection
 * 
 * @example
 * ```typescript
 * const { loadFirehose, status, progress, showManualPopup } = useFirehoseLoader();
 * 
 * useEffect(() => {
 *   if (selectedDevice) {
 *     loadFirehose(selectedDevice);
 *   }
 * }, [selectedDevice]);
 * ```
 */
export function useFirehoseLoader(): UseFirehoseLoaderReturn {
    // State
    const [status, setStatus] = useState<FirehoseLoaderStatus>('idle');
    const [progress, setProgress] = useState<FirehoseProgress>(initialProgress);
    const [error, setError] = useState<string | null>(null);
    const [showManualPopup, setShowManualPopup] = useState(false);

    // Track current loading to prevent duplicate requests
    const loadingRef = useRef<string | null>(null);

    // Store actions
    const setFirehoseLoaded = useDeviceStore((state) => state.setFirehoseLoaded);
    const log = useTerminalStore((state) => state.log);

    /**
     * Fetch a single firehose file with progress tracking.
     */
    const fetchFile = useCallback(async (
        url: string,
        fileName: string
    ): Promise<ArrayBuffer> => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${fileName}: ${response.status} ${response.statusText}`);
        }
        return response.arrayBuffer();
    }, []);

    /**
     * Load firehose files for a device.
     * Uses cached files if available for the same chipset.
     */
    const loadFirehose = useCallback(async (
        device: DeviceEntry
    ): Promise<FirehoseFiles | null> => {
        const chipset = device.chipset;

        // Check cache first
        const cached = firehoseCache.get(chipset);
        if (cached) {
            log('info', `Using cached firehose for ${device.chipsetName}`);
            setStatus('success');
            setFirehoseLoaded(true);
            setProgress({
                loaded: 3,
                total: 3,
                currentFile: '',
                files: ['programmer.melf', 'digest.elf', 'signature.bin'],
            });
            return cached;
        }

        // Prevent duplicate loading for same chipset
        if (loadingRef.current === chipset) {
            log('debug', `Already loading firehose for ${chipset}`);
            return null;
        }

        loadingRef.current = chipset;
        setStatus('loading');
        setError(null);
        setShowManualPopup(false);
        setProgress({ ...initialProgress, files: [] });

        const { programmerUrl, digestUrl, signatureUrl } = device.firehose;

        log('info', `Loading firehose files for ${device.name} (${device.chipsetName})...`);

        try {
            // Track files as they complete
            const completedFiles: string[] = [];

            // Fetch programmer
            setProgress(prev => ({
                ...prev,
                loaded: 0,
                currentFile: 'programmer.melf',
            }));
            log('info', `Downloading programmer.melf...`);
            const programmer = await fetchFile(programmerUrl, 'programmer.melf');
            completedFiles.push('programmer.melf');
            setProgress(prev => ({
                ...prev,
                loaded: 1,
                files: [...completedFiles],
            }));
            log('success', `Downloaded programmer.melf (${(programmer.byteLength / 1024).toFixed(1)} KB)`);

            // Fetch digest
            setProgress(prev => ({ ...prev, currentFile: 'digest.elf' }));
            log('info', `Downloading digest.elf...`);
            const digest = await fetchFile(digestUrl, 'digest.elf');
            completedFiles.push('digest.elf');
            setProgress(prev => ({
                ...prev,
                loaded: 2,
                files: [...completedFiles],
            }));
            log('success', `Downloaded digest.elf (${(digest.byteLength / 1024).toFixed(1)} KB)`);

            // Fetch signature
            setProgress(prev => ({ ...prev, currentFile: 'signature.bin' }));
            log('info', `Downloading signature.bin...`);
            const signature = await fetchFile(signatureUrl, 'signature.bin');
            completedFiles.push('signature.bin');
            setProgress({
                loaded: 3,
                total: 3,
                currentFile: '',
                files: completedFiles,
            });
            log('success', `Downloaded signature.bin (${(signature.byteLength / 1024).toFixed(1)} KB)`);

            // Create firehose files object
            const files: FirehoseFiles = { programmer, digest, signature };

            // Cache by chipset (multiple devices can share same chipset)
            firehoseCache.set(chipset, files);

            // Update store state
            setFirehoseLoaded(true);
            setStatus('success');
            loadingRef.current = null;

            log(
                'success',
                `Firehose loaded successfully for ${device.chipsetName}`
            );

            return files;

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error loading firehose';

            log('error', `Failed to load firehose: ${message}`);
            setError(message);
            setStatus('error');
            setFirehoseLoaded(false);
            setShowManualPopup(true);
            loadingRef.current = null;

            return null;
        }
    }, [fetchFile, log, setFirehoseLoaded]);

    /**
     * Get cached firehose files for a chipset.
     */
    const getCached = useCallback((chipset: string): FirehoseFiles | undefined => {
        return firehoseCache.get(chipset);
    }, []);

    /**
     * Clear all cached firehose files.
     */
    const clearCache = useCallback(() => {
        firehoseCache.clear();
        log('info', 'Firehose cache cleared');
    }, [log]);

    return {
        loadFirehose,
        status,
        progress,
        error,
        showManualPopup,
        setShowManualPopup,
        getCached,
        clearCache,
    };
}
