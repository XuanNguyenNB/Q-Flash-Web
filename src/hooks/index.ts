/**
 * Q-Flash-Web Hooks
 * 
 * Central export for all React hooks that wrap core protocol logic.
 * Import hooks from this file: import { useWebUSB, useFirehose } from '@/hooks';
 * 
 * CRITICAL: These hooks WRAP the core logic - they do NOT modify it.
 * All core files in src/core/, src/auth/, src/services/ remain UNCHANGED.
 */

// WebUSB Hook - Device connection
export { useWebUSB } from './useWebUSB';
export type { UseWebUSBReturn } from './useWebUSB';

// Firehose Hook - Partition operations
export { useFirehose } from './useFirehose';
export type { UseFirehoseReturn } from './useFirehose';

// Sahara Hook - Bootloader handshake
export { useSahara } from './useSahara';
export type { UseSaharaReturn } from './useSahara';

// Auth Hook - VIP authentication
export { useAuth } from './useAuth';
export type { UseAuthReturn, VipCredentials } from './useAuth';

// Terminal Hook - Logging convenience
export { useTerminal } from './useTerminal';
export type { UseTerminalReturn } from './useTerminal';

// Devices Hook - Device data loading
export { useDevices, groupDevicesByChipset } from './useDevices';
export type { DeviceEntry } from './useDevices';

// Firehose Loader Hook - Auto-load firehose files
export { useFirehoseLoader } from './useFirehoseLoader';
export type {
    UseFirehoseLoaderReturn,
    FirehoseFiles,
    FirehoseLoaderStatus,
    FirehoseProgress,
} from './useFirehoseLoader';

// Connection Flow Hook - Orchestrates complete connection sequence
export { useConnectionFlow } from './useConnectionFlow';
export type {
    UseConnectionFlowReturn,
    ConnectionFlowState,
    ConnectionError,
} from './useConnectionFlow';

// First Visit Hook - Detects first-time visitors for wizard display
export { useFirstVisit } from './useFirstVisit';
export type { UseFirstVisitReturn } from './useFirstVisit';

// Backup Hook - Partition backup operations with File System Access API
export { useBackup } from './useBackup';
export type { UseBackupReturn } from './useBackup';

// Flash Hook - Partition flash/write operations
export { useFlash } from './useFlash';

// ROM Loader Hook - ROM folder loading and XML parsing
export { useRomLoader } from './useRomLoader';
export type {
    UseRomLoaderReturn,
    RomFile,
    RomPartitionEntry,
    RomLoadResult,
    RomLoadProgress,
} from './useRomLoader';

// Fastboot Hook - Fastboot device operations
export { useFastboot } from './useFastboot';
export type { UseFastbootReturn } from './useFastboot';

// XML Backup Hook - Backup partitions by XML file
export { useXMLBackup } from './useXMLBackup';

// XML Flash Hook - Flash partitions by XML file
export { useXMLFlash } from './useXMLFlash';

