/**
 * useXMLBackup Hook
 * 
 * Handles backing up partitions based on a rawprogram XML file.
 * Parses XML, reads partitions via Firehose, and saves to directory.
 */

import { useCallback } from 'react';
import { useTerminalStore } from '@/stores/terminalStore';
import { useFlashStore } from '@/stores/flashStore';
import { useFirehose } from './useFirehose';

interface XMLProgram {
    label: string;
    num_partition_sectors: string;
    start_sector?: string;
    filename?: string;
    physical_partition_number?: string; // LUN
}

export function useXMLBackup() {
    const { log } = useTerminalStore();
    const { startBackup, updateBackupProgress, setBackupPartitionStatus, completeBackup, resetBackup } = useFlashStore();
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
                const numSectors = tag.getAttribute('num_partition_sectors');
                const startSector = tag.getAttribute('start_sector');
                const filename = tag.getAttribute('filename');
                const physicalPartition = tag.getAttribute('physical_partition_number');

                if (label && numSectors && numSectors !== '0') {
                    programs.push({
                        label,
                        num_partition_sectors: numSectors,
                        start_sector: startSector || undefined,
                        filename: filename || undefined,
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

    const startXMLBackup = useCallback(async (
        usbManager: any,
        xmlFile: File,
        outputDir: FileSystemDirectoryHandle
    ) => {
        if (!usbManager) {
            log('error', 'USB Manager not available');
            return;
        }

        try {
            log('info', `📋 Parsing XML file: ${xmlFile.name}`);

            const programs = await parseXMLFile(xmlFile);

            if (programs.length === 0) {
                throw new Error('No valid partitions found in XML');
            }

            log('success', `✅ Found ${programs.length} partitions in XML`);
            log('info', '📦 Starting XML-based backup...');

            // Calculate total size (use 4096 sector size for UFS)
            const sectorSize = 4096; // UFS sector size
            const totalBytes = programs.reduce((sum, p) => {
                return sum + (BigInt(p.num_partition_sectors) * BigInt(sectorSize));
            }, BigInt(0));

            // Start backup in store
            startBackup(
                programs.map(p => p.label),
                outputDir.name,
                Number(totalBytes)
            );

            // Get Firehose protocol using useFirehose hook
            const firehose = getFirehose(usbManager);
            if (!firehose) {
                throw new Error('Firehose protocol not initialized');
            }

            let successCount = 0;
            let errorCount = 0;
            let bytesProcessed = BigInt(0);

            for (const program of programs) {
                const partitionName = program.label;

                try {
                    log('info', `📥 Backing up "${partitionName}"...`);
                    setBackupPartitionStatus(partitionName, 'in-progress');

                    // Get LUN and start sector from XML
                    // Default to LUN 0 if not specified
                    const lun = program.physical_partition_number ? parseInt(program.physical_partition_number) : 0;
                    const startSector = program.start_sector ? BigInt(program.start_sector) : BigInt(0);
                    const numSectors = BigInt(program.num_partition_sectors);
                    const sectorSize = 4096; // UFS sector size
                    const sizeInBytes = numSectors * BigInt(sectorSize);

                    // Read partition data using readPartition with XML info
                    const result = await firehose.readPartition(
                        lun,
                        startSector,
                        numSectors,
                        partitionName,
                        (percent: number) => {
                            const currentBytes = BigInt(Math.floor((percent / 100) * Number(sizeInBytes)));
                            updateBackupProgress(
                                partitionName,
                                Number(bytesProcessed + currentBytes),
                                Number(totalBytes)
                            );
                        }
                    );

                    if (!result.success || !result.data) {
                        throw new Error(result.error || 'Read failed');
                    }

                    // Save to file
                    const filename = program.filename || `${partitionName}.img`;
                    const fileHandle = await outputDir.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();

                    await writable.write(result.data);
                    await writable.close();

                    bytesProcessed += sizeInBytes;
                    const sizeStr = (Number(sizeInBytes) / 1024 / 1024).toFixed(2);
                    log('success', `✅ Saved "${filename}" (${sizeStr} MB)`);
                    setBackupPartitionStatus(partitionName, 'done');
                    successCount++;

                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    log('error', `❌ Failed to backup "${partitionName}": ${message}`);
                    setBackupPartitionStatus(partitionName, 'error');
                    errorCount++;
                }
            }

            // Complete backup
            completeBackup();

            // Summary
            if (errorCount === 0) {
                log('success', `🎉 XML Backup completed successfully! ${successCount} partitions backed up.`);
            } else if (successCount > 0) {
                log('warning', `⚠️ XML Backup completed with errors: ${successCount} success, ${errorCount} failed`);
            } else {
                log('error', `❌ XML Backup failed: All ${errorCount} partitions failed`);
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log('error', `❌ XML Backup failed: ${message} `);
            resetBackup();
        }
    }, [log, parseXMLFile, startBackup, updateBackupProgress, setBackupPartitionStatus, completeBackup, resetBackup, getFirehose]);

    return {
        startXMLBackup,
        parseXMLFile
    };
}
