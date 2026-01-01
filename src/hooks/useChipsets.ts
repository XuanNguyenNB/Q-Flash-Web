/**
 * useChipsets Hook
 * 
 * Loads and provides chipset configurations.
 * Simpler alternative to useDevices - select by chipset instead of phone model.
 */

import { useState, useEffect } from 'react';

export interface ChipsetEntry {
    id: string;
    name: string;
    codename: string;
    authMethod: string;
    presetId?: string | null;
    firehose: {
        programmerUrl: string;
        digestUrl: string;
        signatureUrl: string;
    };
    examples: string[];
}

interface UseChipsetsReturn {
    chipsets: ChipsetEntry[];
    loading: boolean;
    error: string | null;
}

/**
 * Hook to load chipset configurations from chipsets.json
 */
export function useChipsets(): UseChipsetsReturn {
    const [chipsets, setChipsets] = useState<ChipsetEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadChipsets() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('/configs/chipsets.json');
                if (!response.ok) {
                    throw new Error(`Failed to load chipsets: ${response.statusText}`);
                }

                const data: ChipsetEntry[] = await response.json();
                setChipsets(data);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error loading chipsets';
                setError(message);
                console.error('Error loading chipsets:', err);
            } finally {
                setLoading(false);
            }
        }

        loadChipsets();
    }, []);

    return { chipsets, loading, error };
}
