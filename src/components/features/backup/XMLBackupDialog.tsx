/**
 * XML Backup Dialog
 * 
 * Allows users to backup partitions based on a rawprogram XML file.
 * This is useful for backing up partitions that may not be in the partition table.
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, FolderOpen, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface XMLBackupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (xmlFile: File, outputDir: FileSystemDirectoryHandle) => Promise<void>;
}

interface ParsedPartition {
    label: string;
    num_partition_sectors: string;
    start_sector?: string;
}

export function XMLBackupDialog({ open, onOpenChange, onConfirm }: XMLBackupDialogProps) {
    const { t } = useTranslation();
    const [xmlFile, setXmlFile] = useState<File | null>(null);
    const [outputDir, setOutputDir] = useState<FileSystemDirectoryHandle | null>(null);
    const [partitions, setPartitions] = useState<ParsedPartition[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);

    // Reset state when dialog closes
    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (!newOpen) {
            setXmlFile(null);
            setOutputDir(null);
            setPartitions([]);
            setParseError(null);
        }
        onOpenChange(newOpen);
    }, [onOpenChange]);

    // Parse XML file to extract partition info
    const parseXML = useCallback(async (file: File) => {
        try {
            setParseError(null);
            const text = await file.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');

            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('Invalid XML format');
            }

            // Find all program tags
            const programTags = xmlDoc.querySelectorAll('program');
            const parsed: ParsedPartition[] = [];

            programTags.forEach((tag) => {
                const label = tag.getAttribute('label');
                const numSectors = tag.getAttribute('num_partition_sectors');
                const startSector = tag.getAttribute('start_sector');

                if (label && numSectors && numSectors !== '0') {
                    parsed.push({
                        label,
                        num_partition_sectors: numSectors,
                        start_sector: startSector || '0'
                    });
                }
            });

            if (parsed.length === 0) {
                throw new Error('No valid partitions found in XML');
            }

            setPartitions(parsed);
            return parsed;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to parse XML';
            setParseError(message);
            setPartitions([]);
            throw error;
        }
    }, []);

    // Handle XML file selection
    const handleSelectXML = useCallback(async () => {
        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: 'XML Files',
                        accept: {
                            'text/xml': ['.xml']
                        }
                    }
                ],
                multiple: false
            });

            const file = await fileHandle.getFile();
            setXmlFile(file);
            await parseXML(file);
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Failed to select XML:', error);
        }
    }, [parseXML]);

    // Handle output directory selection
    const handleSelectOutputDir = useCallback(async () => {
        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'downloads',
            });
            setOutputDir(dirHandle);
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Failed to select directory:', error);
        }
    }, []);

    // Handle confirm
    const handleConfirm = useCallback(async () => {
        if (!xmlFile || !outputDir) return;

        setIsProcessing(true);
        // Close dialog immediately when starting backup
        handleOpenChange(false);
        try {
            await onConfirm(xmlFile, outputDir);
        } catch (error) {
            console.error('Backup failed:', error);
        } finally {
            setIsProcessing(false);
        }
    }, [xmlFile, outputDir, onConfirm, handleOpenChange]);


    const canProceed = xmlFile && outputDir && partitions.length > 0 && !parseError;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        {t('xml_backup.title', 'Backup by XML')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('xml_backup.description', 'Select a rawprogram XML file and output folder to backup partitions defined in the XML.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Step 1: Select XML File */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                1
                            </span>
                            {t('xml_backup.select_xml', 'Select XML File')}
                        </label>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={handleSelectXML}
                        >
                            <FileText className="w-4 h-4" />
                            {xmlFile ? xmlFile.name : t('xml_backup.choose_xml', 'Choose XML...')}
                        </Button>

                        {parseError && (
                            <div className="flex items-start gap-2 text-xs text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{parseError}</span>
                            </div>
                        )}

                        {xmlFile && partitions.length > 0 && (
                            <div className="flex items-start gap-2 text-xs text-green-500 bg-green-500/10 p-2 rounded border border-green-500/20">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>
                                    {t('xml_backup.found_partitions', 'Found {{count}} partitions', { count: partitions.length })}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Select Output Folder */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                2
                            </span>
                            {t('xml_backup.select_folder', 'Select Output Folder')}
                        </label>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={handleSelectOutputDir}
                            disabled={!xmlFile || partitions.length === 0}
                        >
                            <FolderOpen className="w-4 h-4" />
                            {outputDir ? outputDir.name : t('xml_backup.choose_folder', 'Choose Folder...')}
                        </Button>
                    </div>

                    {/* Partition Preview */}
                    {partitions.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {t('xml_backup.partitions_preview', 'Partitions to Backup')}
                            </label>
                            <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                                <div className="divide-y">
                                    {partitions.slice(0, 10).map((p, idx) => {
                                        // Calculate size: sectors * 4096 (UFS sector size) / 1024 / 1024 for MB
                                        const sizeInMB = (parseInt(p.num_partition_sectors) * 4096 / 1024 / 1024);
                                        const sizeStr = sizeInMB >= 1024
                                            ? `${(sizeInMB / 1024).toFixed(2)} GB`
                                            : `${sizeInMB.toFixed(2)} MB`;

                                        return (
                                            <div
                                                key={idx}
                                                className="px-3 py-2 text-sm flex items-center justify-between hover:bg-muted/50"
                                            >
                                                <span className="font-mono">{p.label}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {sizeStr}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {partitions.length > 10 && (
                                        <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                                            {t('xml_backup.and_more', '...and {{count}} more', { count: partitions.length - 10 })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isProcessing}
                    >
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!canProceed || isProcessing}
                        className="gap-2"
                    >
                        <Download className="w-4 h-4" />
                        {isProcessing
                            ? t('xml_backup.processing', 'Processing...')
                            : t('xml_backup.start_backup', 'Start Backup')
                        }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
