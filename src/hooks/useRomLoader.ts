/**
 * useRomLoader Hook
 *
 * React hook for loading ROM files from a directory using the File System Access API.
 * Scans for rawprogram*.xml files, parses partition entries, validates file existence,
 * and detects sparse images.
 *
 * Story: 4.6 - ROM File Loading
 */

import { useCallback } from 'react';
import { useTerminalStore } from '@/stores/terminalStore';
import { useRomStore } from '@/stores/romStore';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * ROM file information with handle for reading
 */
export interface RomFile {
    name: string;
    handle: FileSystemFileHandle;
    size: number;
}

/**
 * Parsed partition entry from rawprogram XML
 */
export interface RomPartitionEntry {
    /** Partition name/label (e.g., abl_a, boot) */
    label: string;
    /** File name in ROM folder (e.g., abl.elf) */
    filename: string;
    /** File handle for reading - undefined if file doesn't exist */
    fileHandle?: FileSystemFileHandle;
    /** Actual file size in bytes */
    fileSize: number;
    /** Start sector from XML */
    startSector: number;
    /** Number of sectors from XML */
    numSectors: number;
    /** Sector size in bytes (usually 4096 for UFS) */
    sectorSize: number;
    /** Whether image is sparse format */
    isSparse: boolean;
    /** Physical partition number */
    physicalPartition: number;
    /** Whether file exists in folder */
    exists: boolean;
    /** Source XML file name */
    sourceXml: string;
}

/**
 * Result of ROM loading operation
 */
export interface RomLoadResult {
    /** Directory name */
    directoryName: string;
    /** Directory handle for re-scanning */
    directoryHandle: FileSystemDirectoryHandle;
    /** All parsed partition entries */
    entries: RomPartitionEntry[];
    /** Total size of all existing files in bytes */
    totalSize: number;
    /** List of patch files (patch0.xml, etc.) */
    patchFiles: RomFile[];
    /** List of filenames that are missing */
    missingFiles: string[];
    /** Time taken to load in milliseconds */
    loadTime: number;
    /** Number of XML files processed */
    xmlFilesCount: number;
}

/**
 * Progress callback type
 */
export type RomLoadProgress = (percent: number, message: string) => void;

// ============================================================================
// Constants
// ============================================================================

/** Sparse image magic header (little-endian) */
const SPARSE_MAGIC = 0xed26ff3a;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a file is a sparse image by reading its header
 */
async function isSparseImage(file: File): Promise<boolean> {
    try {
        if (file.size < 4) return false;

        const header = await file.slice(0, 4).arrayBuffer();
        const view = new DataView(header);
        const magic = view.getUint32(0, true); // little-endian

        return magic === SPARSE_MAGIC;
    } catch {
        return false;
    }
}

/**
 * Parse a single rawprogram XML file and extract partition entries
 */
function parseRawprogramXml(xmlContent: string, sourceXml: string): Partial<RomPartitionEntry>[] {
    const entries: Partial<RomPartitionEntry>[] = [];

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, 'text/xml');

        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML parse error');
        }

        // Find all <program> elements
        const programs = doc.querySelectorAll('program');

        for (const program of programs) {
            const filename = program.getAttribute('filename');

            // Skip entries without filename or with empty filename
            if (!filename || filename.trim() === '') {
                continue;
            }

            const label = program.getAttribute('label') || filename.replace(/\.[^.]+$/, '');
            const startSector = parseInt(program.getAttribute('start_sector') || '0', 10);
            const numSectors = parseInt(program.getAttribute('num_partition_sectors') || '0', 10);
            const sectorSize = parseInt(program.getAttribute('SECTOR_SIZE_IN_BYTES') || '4096', 10);
            const physicalPartition = parseInt(program.getAttribute('physical_partition_number') || '0', 10);
            const sparseAttr = program.getAttribute('sparse');

            entries.push({
                label,
                filename: filename.trim(),
                startSector,
                numSectors,
                sectorSize,
                physicalPartition,
                isSparse: sparseAttr === 'true',
                sourceXml,
            });
        }
    } catch (error) {
        console.error(`Error parsing ${sourceXml}:`, error);
    }

    return entries;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Return type for useRomLoader hook
 */
export interface UseRomLoaderReturn {
    /** Load ROM from a directory using File System Access API */
    loadRomFromDirectory: (onProgress?: RomLoadProgress) => Promise<RomLoadResult | null>;
    /** Check if browser supports File System Access API */
    isSupported: boolean;
}

/**
 * Hook for loading ROM files from a directory
 */
export function useRomLoader(): UseRomLoaderReturn {
    const { log } = useTerminalStore.getState();
    const { setRomData, setLoading, setError, setProgress } = useRomStore.getState();

    // Check if File System Access API is supported
    const isSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

    /**
     * Main function to load ROM from a directory
     */
    const loadRomFromDirectory = useCallback(async (
        onProgress?: RomLoadProgress
    ): Promise<RomLoadResult | null> => {
        if (!isSupported) {
            log('error', 'File System Access API is not supported in this browser');
            setError('File System Access API not supported');
            return null;
        }

        const startTime = Date.now();
        setLoading(true);
        setError(null);

        try {
            // Step 1: Request directory access
            log('info', 'Opening ROM folder picker...');
            onProgress?.(0, 'Selecting folder...');

            const directoryHandle = await window.showDirectoryPicker({
                mode: 'read',
            });

            const directoryName = directoryHandle.name;
            log('info', `Selected ROM folder: ${directoryName}`);
            onProgress?.(5, `Scanning ${directoryName}...`);

            // Step 2: Scan for rawprogram*.xml files - with recursive subdirectory search
            let xmlFiles: RomFile[] = [];
            let patchFiles: RomFile[] = [];
            let allFiles = new Map<string, FileSystemFileHandle>();
            let workingDirectory = directoryHandle;

            log('info', 'Scanning for rawprogram*.xml and patch*.xml files...');
            setProgress(10);

            // Helper function to scan a directory
            async function scanDirectory(dirHandle: FileSystemDirectoryHandle): Promise<{
                xmlFiles: RomFile[];
                patchFiles: RomFile[];
                allFiles: Map<string, FileSystemFileHandle>;
            }> {
                const foundXmlFiles: RomFile[] = [];
                const foundPatchFiles: RomFile[] = [];
                const foundAllFiles = new Map<string, FileSystemFileHandle>();

                for await (const [name, handle] of dirHandle.entries()) {
                    if (handle.kind === 'file') {
                        const fileHandle = handle as FileSystemFileHandle;
                        foundAllFiles.set(name.toLowerCase(), fileHandle);

                        // Check for rawprogram*.xml pattern
                        if (/^rawprogram\d*\.xml$/i.test(name)) {
                            const file = await fileHandle.getFile();
                            foundXmlFiles.push({
                                name,
                                handle: fileHandle,
                                size: file.size,
                            });
                        }
                        // Check for patch*.xml pattern
                        else if (/^patch\d*\.xml$/i.test(name)) {
                            const file = await fileHandle.getFile();
                            foundPatchFiles.push({
                                name,
                                handle: fileHandle,
                                size: file.size,
                            });
                        }
                    }
                }

                return { xmlFiles: foundXmlFiles, patchFiles: foundPatchFiles, allFiles: foundAllFiles };
            }

            // First, scan the selected directory
            const rootScan = await scanDirectory(directoryHandle);
            xmlFiles = rootScan.xmlFiles;
            patchFiles = rootScan.patchFiles;
            allFiles = rootScan.allFiles;

            // If no XML files found, search common subdirectories
            if (xmlFiles.length === 0) {
                log('info', 'No rawprogram*.xml in root, searching subdirectories...');

                // Common directory names where ROM files are stored
                const commonSubdirs = ['images', 'Images', 'IMAGES', 'firmware', 'Firmware', 'FIRMWARE', 'flash', 'Flash', 'FLASH'];

                for await (const [name, handle] of directoryHandle.entries()) {
                    if (handle.kind === 'directory') {
                        const subDirHandle = handle as FileSystemDirectoryHandle;

                        // Check common subdirectories first
                        if (commonSubdirs.includes(name)) {
                            log('info', `  Checking ${name}/...`);
                            onProgress?.(10, `Checking ${name}...`);

                            const subScan = await scanDirectory(subDirHandle);
                            if (subScan.xmlFiles.length > 0) {
                                log('success', `  Found ${subScan.xmlFiles.length} rawprogram, ${subScan.patchFiles.length} patches in ${name}/`);
                                xmlFiles = subScan.xmlFiles;
                                patchFiles = subScan.patchFiles;
                                allFiles = subScan.allFiles;
                                workingDirectory = subDirHandle;
                                break;
                            }
                        }
                    }
                }

                // If still not found, do a deeper search (max 2 levels)
                if (xmlFiles.length === 0) {
                    log('info', 'Searching all subdirectories (1 level deep)...');

                    for await (const [name, handle] of directoryHandle.entries()) {
                        if (handle.kind === 'directory') {
                            const subDirHandle = handle as FileSystemDirectoryHandle;
                            log('info', `  Checking ${name}/...`);

                            const subScan = await scanDirectory(subDirHandle);
                            if (subScan.xmlFiles.length > 0) {
                                log('success', `  Found ${subScan.xmlFiles.length} rawprogram, ${subScan.patchFiles.length} patches in ${name}/`);
                                xmlFiles = subScan.xmlFiles;
                                patchFiles = subScan.patchFiles;
                                allFiles = subScan.allFiles;
                                workingDirectory = subDirHandle;
                                break;
                            }
                        }
                    }
                }
            }

            // Log found XML files
            for (const xmlFile of xmlFiles) {
                log('info', `Found: ${xmlFile.name} (${formatBytes(xmlFile.size)})`);
            }
            for (const patchFile of patchFiles) {
                log('info', `Found: ${patchFile.name} (${formatBytes(patchFile.size)})`);
            }

            onProgress?.(20, `Found ${xmlFiles.length} RawProgram, ${patchFiles.length} Patch files`);
            setProgress(20);

            // Check if any XML files were found (patches are optional but good to have)
            if (xmlFiles.length === 0) {
                log('error', 'No rawprogram*.xml files found in this folder or subdirectories');
                log('info', 'Make sure you select a ROM folder containing rawprogram*.xml files');
                setError('No rawprogram*.xml files found');
                setLoading(false);
                return null;
            }

            log('success', `Found ${xmlFiles.length} rawprogram*.xml and ${patchFiles.length} patch*.xml file(s)`);

            // Step 3: Parse XML files
            const allEntries: Partial<RomPartitionEntry>[] = [];
            const progressPerXml = 30 / xmlFiles.length;

            for (let i = 0; i < xmlFiles.length; i++) {
                const xmlFile = xmlFiles[i];
                log('info', `Parsing ${xmlFile.name}...`);
                onProgress?.(20 + (i * progressPerXml), `Parsing ${xmlFile.name}...`);
                setProgress(20 + Math.round(i * progressPerXml));

                try {
                    const file = await xmlFile.handle.getFile();
                    const content = await file.text();
                    const entries = parseRawprogramXml(content, xmlFile.name);
                    allEntries.push(...entries);
                    log('info', `  Parsed ${entries.length} partition entries`);
                } catch (error) {
                    log('warning', `Failed to parse ${xmlFile.name}: ${error}`);
                }
            }

            log('success', `Total: ${allEntries.length} partition entries from ${xmlFiles.length} XML files`);
            onProgress?.(50, 'Validating files...');
            setProgress(50);

            // Step 4: Validate file existence and detect sparse images
            const finalEntries: RomPartitionEntry[] = [];
            const missingFiles: string[] = [];
            let totalSize = 0;
            const progressPerEntry = 40 / allEntries.length;

            // Deduplicate entries by label (keep first occurrence)
            const seenLabels = new Set<string>();
            const uniqueEntries = allEntries.filter(entry => {
                if (!entry.label || seenLabels.has(entry.label)) {
                    return false;
                }
                seenLabels.add(entry.label);
                return true;
            });

            for (let i = 0; i < uniqueEntries.length; i++) {
                const entry = uniqueEntries[i];
                const filename = entry.filename?.toLowerCase() || '';
                const fileHandle = allFiles.get(filename);

                if (i % 10 === 0) {
                    onProgress?.(50 + (i * progressPerEntry), `Checking ${entry.label}...`);
                    setProgress(50 + Math.round(i * progressPerEntry));
                }

                if (fileHandle) {
                    // File exists - get size and check if sparse
                    try {
                        const file = await fileHandle.getFile();
                        const isSparse = await isSparseImage(file);

                        if (isSparse) {
                            log('info', `  ${entry.label}: Sparse image (${formatBytes(file.size)})`);
                        }

                        finalEntries.push({
                            label: entry.label!,
                            filename: entry.filename!,
                            fileHandle,
                            fileSize: file.size,
                            startSector: entry.startSector || 0,
                            numSectors: entry.numSectors || 0,
                            sectorSize: entry.sectorSize || 4096,
                            isSparse,
                            physicalPartition: entry.physicalPartition || 0,
                            exists: true,
                            sourceXml: entry.sourceXml || '',
                        });

                        totalSize += file.size;
                    } catch (error) {
                        log('warning', `Failed to read ${entry.filename}: ${error}`);
                        missingFiles.push(entry.filename!);
                        finalEntries.push({
                            label: entry.label!,
                            filename: entry.filename!,
                            fileHandle: undefined,
                            fileSize: 0,
                            startSector: entry.startSector || 0,
                            numSectors: entry.numSectors || 0,
                            sectorSize: entry.sectorSize || 4096,
                            isSparse: false,
                            physicalPartition: entry.physicalPartition || 0,
                            exists: false,
                            sourceXml: entry.sourceXml || '',
                        });
                    }
                } else {
                    // File doesn't exist
                    missingFiles.push(entry.filename!);
                    finalEntries.push({
                        label: entry.label!,
                        filename: entry.filename!,
                        fileHandle: undefined,
                        fileSize: 0,
                        startSector: entry.startSector || 0,
                        numSectors: entry.numSectors || 0,
                        sectorSize: entry.sectorSize || 4096,
                        isSparse: false,
                        physicalPartition: entry.physicalPartition || 0,
                        exists: false,
                        sourceXml: entry.sourceXml || '',
                    });
                }
            }

            onProgress?.(95, 'Finalizing...');
            setProgress(95);

            // Log missing files as warnings
            if (missingFiles.length > 0) {
                log('warning', `${missingFiles.length} file(s) missing from ROM folder:`);
                missingFiles.slice(0, 10).forEach(f => log('warning', `  - ${f}`));
                if (missingFiles.length > 10) {
                    log('warning', `  ... and ${missingFiles.length - 10} more`);
                }
            }

            const loadTime = Date.now() - startTime;
            const result: RomLoadResult = {
                directoryName,
                directoryHandle,
                entries: finalEntries,
                patchFiles, // Add patchFiles
                totalSize,
                missingFiles,
                loadTime,
                xmlFilesCount: xmlFiles.length,
            };

            // Update store with results
            setRomData(result);
            setLoading(false);
            setProgress(100);

            log('success', `ROM loaded successfully in ${loadTime}ms`);
            log('success', `  ${finalEntries.length} partitions, ${formatBytes(totalSize)} total`);
            if (missingFiles.length > 0) {
                log('warning', `  ${missingFiles.length} files missing`);
            }

            onProgress?.(100, 'ROM loaded successfully');

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // User cancelled the picker
            if (errorMessage.includes('aborted')) {
                log('info', 'ROM folder selection cancelled');
                setLoading(false);
                return null;
            }

            log('error', `Failed to load ROM: ${errorMessage}`);
            setError(errorMessage);
            setLoading(false);
            return null;
        }
    }, [isSupported, log, setRomData, setLoading, setError, setProgress]);

    return {
        loadRomFromDirectory,
        isSupported,
    };
}
