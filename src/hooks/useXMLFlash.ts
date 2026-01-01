/**
 * useXMLFlash Hook
 * 
 * Handles flashing/writing partitions based on a rawprogram XML file.
 * Parses XML, loads images from folder, and writes to device via Firehose.
 */

import { useCallback } from 'react';
import { useTerminalStore } from '@/stores/terminalStore';
import { useFlashStore } from '@/stores/flashStore';
import { useFirehose } from './useFirehose';

interface XMLProgram {
    label: string;
    filename: string;
    num_partition_sectors: string;
    start_sector?: string;
    physical_partition_number?: string; // LUN
}

export function useXMLFlash() {
    const { log } = useTerminalStore();
    const { startFlashWrite, updateFlashWriteProgress, setFlashWritePartitionStatus, completeFlashWrite, resetFlashWrite } = useFlashStore();
    const { getInstance: getFirehose } = useFirehose();

    const parseXMLFile = useCallback(async (xmlFile: File): Promise<XMLProgram[]> => {
        try {
            const text = await xmlFile.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');

            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('Invalid XML format');
            }

            const programTags = xmlDoc.querySelectorAll('program');
            const programs: XMLProgram[] = [];

            programTags.forEach((tag) => {
                const label = tag.getAttribute('label');
                const filename = tag.getAttribute('filename');
                const numSectors = tag.getAttribute('num_partition_sectors');
                const startSector = tag.getAttribute('start_sector');
                const physicalPartition = tag.getAttribute('physical_partition_number');

                if (label && filename && numSectors && numSectors !== '0') {
                    programs.push({
                        label,
                        filename,
                        num_partition_sectors: numSectors,
                        start_sector: startSector || undefined,
                        physical_partition_number: physicalPartition || undefined
                    });
                }
            });

            return programs;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to parse XML';
            log('error', `Failed to parse XML: ${message}`);
            throw error;
        }
    }, [log]);

    const startXMLFlash = useCallback(async (
        usbManager: any,
        xmlFile: File,
        imagesDir: FileSystemDirectoryHandle
    ) => {
        if (!usbManager) {
            log('error', 'USB Manager not available');
            return;
        }

        try {
            log('info', `📋 Parsing XML file: ${xmlFile.name}`);

            const programs = await parseXMLFile(xmlFile);

            if (programs.length === 0) {
                throw new Error('No valid partitions with filename found in XML');
            }

            log('success', `✅ Found ${programs.length} partitions in XML`);
            log('info', '⚡ Starting XML-based flash...');

            // Calculate total size
            const sectorSize = 4096; // UFS sector size
            const totalBytes = programs.reduce((sum, p) => {
                return sum + (BigInt(p.num_partition_sectors) * BigInt(sectorSize));
            }, BigInt(0));

            // Start flash in store
            startFlashWrite(
                programs.map(p => p.label),
                Number(totalBytes)
            );

            // Get Firehose protocol
            const firehose = getFirehose(usbManager);
            if (!firehose) {
                throw new Error('Firehose protocol not initialized');
            }

            let successCount = 0;
            let errorCount = 0;
            let bytesProcessed = BigInt(0);

            for (const program of programs) {
                const partitionName = program.label;
                const imageFilename = program.filename;

                try {
                    log('info', `⚡ Flashing "${partitionName}" from "${imageFilename}"...`);
                    setFlashWritePartitionStatus(partitionName, 'in-progress');

                    // Load image file from directory
                    let imageFile: File;
                    try {
                        const fileHandle = await imagesDir.getFileHandle(imageFilename);
                        imageFile = await fileHandle.getFile();
                    } catch (error) {
                        throw new Error(`Image file "${imageFilename}" not found in selected folder`);
                    }

                    // Read image data
                    const arrayBuffer = await imageFile.arrayBuffer();
                    const imageData = new Uint8Array(arrayBuffer);

                    // Get LUN and start sector from XML
                    const lun = program.physical_partition_number ? parseInt(program.physical_partition_number) : 0;
                    const startSector = program.start_sector ? BigInt(program.start_sector) : BigInt(0);
                    const numSectors = BigInt(program.num_partition_sectors);
                    const sectorSize = 4096; // UFS sector size
                    const sizeInBytes = numSectors * BigInt(sectorSize);

                    // Write partition data using writePartition
                    const result = await firehose.writePartition(
                        lun,
                        startSector,
                        imageData,
                        partitionName,
                        (percent: number) => {
                            const currentBytes = BigInt(Math.floor((percent / 100) * Number(sizeInBytes)));
                            updateFlashWriteProgress(
                                partitionName,
                                Number(bytesProcessed + currentBytes),
                                Number(totalBytes)
                            );
                        }
                    );

                    if (!result.success) {
                        throw new Error(result.error || 'Write failed');
                    }

                    bytesProcessed += sizeInBytes;
                    const sizeStr = (Number(sizeInBytes) / 1024 / 1024).toFixed(2);
                    log('success', `✅ Wrote "${partitionName}" (${sizeStr} MB)`);
                    setFlashWritePartitionStatus(partitionName, 'done');
                    successCount++;

                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    log('error', `❌ Failed to flash "${partitionName}": ${message}`);
                    setFlashWritePartitionStatus(partitionName, 'error');
                    errorCount++;
                }
            }

            // Complete flash
            completeFlashWrite();

            // Summary
            if (errorCount === 0) {
                log('success', `🎉 XML Flash completed successfully! ${successCount} partitions flashed.`);
            } else if (successCount > 0) {
                log('warning', `⚠️ XML Flash completed with errors: ${successCount} success, ${errorCount} failed`);
            } else {
                log('error', `❌ XML Flash failed: All ${errorCount} partitions failed`);
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ XML Flash failed: ${message}`);
            resetFlashWrite();
        }
    }, [log, parseXMLFile, startFlashWrite, updateFlashWriteProgress, setFlashWritePartitionStatus, completeFlashWrite, resetFlashWrite, getFirehose]);

    return {
        startXMLFlash,
        parseXMLFile
    };
}
