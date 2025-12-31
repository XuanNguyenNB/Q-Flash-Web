/**
 * Q-Flash-Web Stores
 * 
 * Central export for all Zustand stores.
 * Import stores from this file: import { useDeviceStore, useSettingsStore } from '@/stores';
 */

// Device Store
export { useDeviceStore } from './deviceStore';
export type { DeviceState, DeviceProfile } from './deviceStore';

// Partition Store
export { usePartitionStore } from './partitionStore';
export type { PartitionState } from './partitionStore';

// Flash Store
export { useFlashStore } from './flashStore';
export type { FlashState, FlashStatus, AppError } from './flashStore';

// Terminal Store
export { useTerminalStore } from './terminalStore';
export type { TerminalState, TerminalLogEntry, TerminalLogLevel } from './terminalStore';

// Settings Store
export { useSettingsStore } from './settingsStore';
export type { SettingsState, Language } from './settingsStore';

// Fastboot Store
export { useFastbootStore } from './fastbootStore';
export type { FastbootState, FastbootFlashProgress } from './fastbootStore';

// EDL Connection Store
export { useEDLConnectionStore } from './edlConnectionStore';
