/**
 * Partition utility functions
 * 
 * Provides helper functions for partition operations including
 * size formatting and dangerous partition detection.
 */

/**
 * List of protected/dangerous partitions that should be flashed with caution.
 * These are critical system partitions that can brick the device if corrupted.
 */
export const PROTECTED_PARTITIONS = [
    'abl',
    'xbl',
    'boot',
    'recovery',
    'modem',
    'persist',
    'vendor_boot',
    'dtbo',
    'vbmeta',
    'vbmeta_system',
] as const;

/**
 * Checks if a partition is dangerous/protected.
 * 
 * @param name - Partition name to check
 * @returns true if partition is in the protected list
 */
export function isDangerousPartition(name: string): boolean {
    const lowerName = name.toLowerCase();
    return PROTECTED_PARTITIONS.some((protected_name) =>
        lowerName.includes(protected_name.toLowerCase())
    );
}

/**
 * FRP-related partition names.
 * These partitions are related to Factory Reset Protection (Google account lock).
 * Different OEMs use different partition names for FRP data.
 */
export const FRP_PARTITIONS = [
    'frp',           // Standard Android FRP partition
    'config',        // Some devices use 'config' for FRP
    'persistent',    // LG uses 'persistent' for FRP data  
    'laf',           // LG Advanced Flash - related to FRP bypass
    'factory',       // Factory data
    'devinfo',       // Device info (some contain FRP)
    'fsg',           // Factory settings
    'persist',       // Persist partition (can contain FRP data)
] as const;

/**
 * Checks if a partition is FRP (Factory Reset Protection) related.
 * 
 * @param name - Partition name to check
 * @returns true if partition is FRP-related
 */
export function isFrpPartition(name: string): boolean {
    const lowerName = name.toLowerCase();
    return FRP_PARTITIONS.some((frp_name) =>
        lowerName === frp_name ||
        lowerName.includes('frp') ||
        lowerName === 'laf' ||
        lowerName === 'persistent'
    );
}

/**
 * Formats partition size in bytes to human-readable format.
 * 
 * @param bytes - Size in bytes
 * @returns Formatted string with appropriate unit (B, KB, MB, GB)
 * 
 * @example
 * formatPartitionSize(1024) // "1.0 KB"
 * formatPartitionSize(1048576) // "1.0 MB"
 * formatPartitionSize(1073741824) // "1.00 GB"
 */
export function formatPartitionSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
