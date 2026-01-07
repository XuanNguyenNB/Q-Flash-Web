/**
 * useDevices Hook
 * 
 * Fetches and caches devices from devices.json.
 * Provides loading, error states and device data.
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Device entry as defined in devices.json
 */
export interface DeviceEntry {
    id: string;
    brand: 'oppo' | 'oneplus' | 'realme' | 'lg';
    name: string;
    codename: string;
    chipset: string;
    chipsetName: string;
    status: 'tested' | 'beta' | 'coming';
    authMethod: 'oppo_vip' | 'standard' | null;
    presetId: string | null;
    firehose: {
        programmerUrl: string;
        digestUrl?: string;
        signatureUrl?: string;
    };
}

interface UseDevicesResult {
    devices: DeviceEntry[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

// Cache for devices data
let cachedDevices: DeviceEntry[] | null = null;

/**
 * Hook to load devices from devices.json
 */
export function useDevices(): UseDevicesResult {
    const [devices, setDevices] = useState<DeviceEntry[]>(cachedDevices || []);
    const [isLoading, setIsLoading] = useState(!cachedDevices);
    const [error, setError] = useState<string | null>(null);

    const fetchDevices = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/configs/devices.json');
            if (!response.ok) {
                throw new Error(`Failed to load devices: ${response.status}`);
            }
            const data: DeviceEntry[] = await response.json();

            // Sort by chipsetName (newest first) and then by name
            const sorted = [...data].sort((a, b) => {
                // Sort by chipset generation (8 Elite > 8 Gen 3 > 8 Gen 2, etc.)
                const chipsetOrder = [
                    'Snapdragon 8 Elite',
                    'Snapdragon 8s Gen 4',
                    'Snapdragon 8 Gen 3',
                    'Snapdragon 8 Gen 2',
                    'Snapdragon 8+ Gen 1',
                    'Snapdragon 7+ Gen 3',
                    'Snapdragon 888',
                    'Snapdragon 870',
                    'Snapdragon 865',
                    'Snapdragon 855',
                    'Snapdragon 845',
                    'Snapdragon 835',
                    'Snapdragon 765G',
                    'Snapdragon 695',
                    'Snapdragon 680',
                ];
                const aOrder = chipsetOrder.indexOf(a.chipsetName);
                const bOrder = chipsetOrder.indexOf(b.chipsetName);
                const aIdx = aOrder === -1 ? 999 : aOrder;
                const bIdx = bOrder === -1 ? 999 : bOrder;

                if (aIdx !== bIdx) return aIdx - bIdx;
                return a.name.localeCompare(b.name);
            });

            cachedDevices = sorted;
            setDevices(sorted);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load devices';
            setError(message);
            console.error('Error loading devices:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!cachedDevices) {
            fetchDevices();
        }
    }, [fetchDevices]);

    return {
        devices,
        isLoading,
        error,
        refetch: fetchDevices,
    };
}

/**
 * Group devices by chipsetName
 */
export function groupDevicesByChipset(devices: DeviceEntry[]): Record<string, DeviceEntry[]> {
    const groups: Record<string, DeviceEntry[]> = {};

    devices.forEach(device => {
        const key = device.chipsetName;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(device);
    });

    return groups;
}
