/**
 * Oppo Find X7 Ultra WebUSB Unlock Tool - Type Definitions
 * 
 * This file contains all TypeScript interfaces and types used throughout the application.
 */

// ============================================================================
// USB Types
// ============================================================================

export interface USBDeviceFilter {
    vendorId: number;
    productId: number;
}

export interface TransferResult {
    success: boolean;
    data?: Uint8Array;
    bytesTransferred?: number;
    error?: string;
}

export interface USBEndpoints {
    in: number;
    out: number;
}

export interface DeviceInfo {
    vendorId: number;
    productId: number;
    productName: string;
    serialNumber?: string;
    firmwareVersion?: string;
}

// ============================================================================
// Sahara Protocol Types
// ============================================================================

export enum SaharaCommand {
    HELLO = 0x01,
    HELLO_RESP = 0x02,
    READ_DATA = 0x03,
    END_TRANSFER = 0x04,
    DONE = 0x05,
    DONE_RESP = 0x06,
    RESET = 0x07,
    RESET_RESP = 0x08,
    MEMORY_DEBUG = 0x09,
    MEMORY_READ = 0x0A,
    CMD_READY = 0x0B,
    CMD_SWITCH_MODE = 0x0C,
    CMD_EXEC = 0x0D,
    CMD_EXEC_RESP = 0x0E,
    CMD_EXEC_DATA = 0x0F,
    // 64-bit variants
    MEMORY_DEBUG_64 = 0x10,
    MEMORY_READ_64 = 0x11,
    READ_DATA_64 = 0x12,
}

export enum SaharaState {
    IDLE = 'IDLE',
    WAIT_HELLO = 'WAIT_HELLO',
    HELLO_RECEIVED = 'HELLO_RECEIVED',
    UPLOADING = 'UPLOADING',
    UPLOAD_COMPLETE = 'UPLOAD_COMPLETE',
    SWITCHING_MODE = 'SWITCHING_MODE',
    DONE = 'DONE',
    ERROR = 'ERROR',
}

export interface SaharaHelloPacket {
    command: SaharaCommand.HELLO;
    length: number;
    version: number;
    versionSupported: number;
    maxCommandPacketSize: number;
    mode: number;
    reserved: Uint8Array;
}

export interface SaharaReadDataPacket {
    command: SaharaCommand.READ_DATA;
    length: number;
    imageId: number;
    offset: number;
    dataLength: number;
}

export interface SaharaEndTransferPacket {
    command: SaharaCommand.END_TRANSFER;
    length: number;
    imageId: number;
    status: number;
}

export interface SaharaResult {
    success: boolean;
    state: SaharaState;
    error?: string;
}

// ============================================================================
// Firehose Protocol Types
// ============================================================================

export enum FirehoseCommand {
    CONFIGURE = 'configure',
    GETGPT = 'getgpt',
    READ = 'read',
    PROGRAM = 'program',
    ERASE = 'erase',
    PATCH = 'patch',
    RESET = 'reset',
    NOP = 'nop',
}

export interface FirehoseConfig {
    memoryName: 'ufs' | 'emmc' | 'spinor';
    maxPayloadSizeToTargetInBytes: number;
    maxPayloadSizeFromTargetInBytes: number;
    targetName?: string;
    zlpAwareHost?: boolean;
}

export interface FirehoseResponse {
    success: boolean;
    rawXml?: string;
    value?: string;
    error?: string;
}

// ============================================================================
// Partition Types
// ============================================================================

export interface PartitionInfo {
    name: string;
    startSector: bigint;
    endSector: bigint;
    sizeInSectors: bigint;
    sizeFormatted: string;
    typeGuid: string;
    uniqueGuid: string;
    attributes: bigint;
}

export interface GPTHeader {
    signature: string;
    revision: number;
    headerSize: number;
    crc32: number;
    currentLBA: bigint;
    backupLBA: bigint;
    firstUsableLBA: bigint;
    lastUsableLBA: bigint;
    diskGuid: string;
    partitionEntryLBA: bigint;
    partitionEntryCount: number;
    partitionEntrySize: number;
}

// ============================================================================
// VIP Auth Types
// ============================================================================

export interface VipAuthConfig {
    digestFile: Uint8Array;
    signatureFile: Uint8Array;
}

export interface VipAuthStep {
    name: string;
    command: string;
    expectResponse: boolean;
}

export interface VipAuthResult {
    success: boolean;
    step?: string;
    error?: string;
}

// ============================================================================
// UI Types
// ============================================================================

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    data?: unknown;
}

export enum AppStage {
    IDLE = 0,
    CONNECTING = 1,
    SAHARA = 2,
    VIP_HANDSHAKE = 3,
    FIREHOSE_CONFIG = 4,
    READY = 5,
}

export interface AppState {
    stage: AppStage;
    deviceConnected: boolean;
    programmerLoaded: boolean;
    digestLoaded: boolean;
    signatureLoaded: boolean;
    partitions: PartitionInfo[];
    lastError?: string;
}

export interface StatusUpdate {
    stage: AppStage;
    message: string;
    progress?: number; // 0-100
}

// ============================================================================
// Event Types
// ============================================================================

export interface AppEvents {
    'log': LogEntry;
    'status': StatusUpdate;
    'connected': DeviceInfo;
    'disconnected': void;
    'error': Error;
    'partitions': PartitionInfo[];
}

// ============================================================================
// File Validation Types
// ============================================================================

export interface FileValidation {
    isValid: boolean;
    warning?: string;
    error?: string;
}

export interface ExpectedFileSizes {
    programmer: { min: number; max: number }; // 1-3MB
    digest: { min: number; max: number };     // 30-40KB
    signature: { min: number; max: number };  // 3-5KB
}

export const EXPECTED_FILE_SIZES: ExpectedFileSizes = {
    programmer: { min: 1 * 1024 * 1024, max: 3 * 1024 * 1024 },
    digest: { min: 30 * 1024, max: 40 * 1024 },
    signature: { min: 3 * 1024, max: 5 * 1024 },
};
