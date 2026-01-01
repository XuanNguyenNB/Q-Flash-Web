/**
 * XML Flash Dialog
 * 
 * Allows users to flash/write partitions based on a rawprogram XML file.
 * This is useful for flashing partitions that may not be in the partition table.
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
import { FileText, FolderOpen, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface XMLFlashDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (xmlFile: File, imagesDir: FileSystemDirectoryHandle) => Promise<void>;
}

interface ParsedPartition {
    label: string;
    filename?: string;
    num_partition_sectors: string;
    start_sector?: string;
    physical_partition_number?: string;
}

export function XMLFlashDialog({ open, onOpenChange, onConfirm }: XMLFlashDialogProps) {
    const { t } = useTranslation();
    const [xmlFile, setXmlFile] = useState<File | null>(null);
    const [imagesDir, setImagesDir] = useState<FileSystemDirectoryHandle | null>(null);
    const [partitions, setPartitions] = useState<ParsedPartition[]>([]);
    const [selectedPartitions, setSelectedPartitions] = useState<Set<number>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);

    // Reset state when dialog closes
    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (!newOpen) {
            setXmlFile(null);
            setImagesDir(null);
            setPartitions([]);
            setSelectedPartitions(new Set());
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
                const filename = tag.getAttribute('filename');
                const numSectors = tag.getAttribute('num_partition_sectors');
                const startSector = tag.getAttribute('start_sector');
                const physicalPartition = tag.getAttribute('physical_partition_number');

                // Debug log
                console.log('XML Entry:', { label, filename, numSectors, startSector, lun: physicalPartition });

                if (label && numSectors && numSectors !== '0' && filename) {
                    parsed.push({
                        label,
                        filename,
                        num_partition_sectors: numSectors,
                        start_sector: startSector || undefined,
                        physical_partition_number: physicalPartition || undefined
                    });
                }
            });

            console.log('Parsed partitions:', parsed);

            // No need to filter duplicates - filename-based mapping handles this
            const filtered = parsed;

            if (filtered.length === 0) {
                throw new Error('No valid partitions with filename found in XML');
            }

            setPartitions(filtered);

            // Auto-select all partitions
            setSelectedPartitions(new Set(filtered.map((_, idx) => idx)));

            return filtered;
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

    // Handle images directory selection
    const handleSelectImagesDir = useCallback(async () => {
        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'read',
            });
            setImagesDir(dirHandle);
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Failed to select directory:', error);
        }
    }, []);

    // Handle confirm
    const handleConfirm = useCallback(async () => {
        if (!xmlFile || !imagesDir) return;

        // Filter only selected partitions
        const selectedParts = partitions.filter((_, idx) => selectedPartitions.has(idx));

        if (selectedParts.length === 0) {
            setParseError('Please select at least one partition to flash');
            return;
        }

        setIsProcessing(true);
        // Close dialog immediately when starting flash
        handleOpenChange(false);
        try {
            // Create a temporary XML with only selected partitions
            // For now, pass all and let hook handle it (we'll update hook next)
            await onConfirm(xmlFile, imagesDir);
        } catch (error) {
            console.error('Flash failed:', error);
        } finally {
            setIsProcessing(false);
        }

    }, [xmlFile, imagesDir, partitions, selectedPartitions, onConfirm, handleOpenChange]);

    const canProceed = xmlFile && imagesDir && partitions.length > 0 && selectedPartitions.size > 0 && !parseError;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        {t('xml_flash.title', 'Flash by XML')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('xml_flash.description', 'Select a rawprogram XML file and folder containing partition images to flash.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Step 1: Select XML File */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                1
                            </span>
                            {t('xml_flash.select_xml', 'Select XML File')}
                        </label>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={handleSelectXML}
                        >
                            <FileText className="w-4 h-4" />
                            {xmlFile ? xmlFile.name : t('xml_flash.choose_xml', 'Choose XML...')}
                        </Button>

                        {parseError && (
                            <div className="flex items-start gap-2 text-xs text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{parseError}</span>
                            </div>
                        )}

                        {xmlFile && partitions.length > 0 && (
                            <>
                                <div className="flex items-start gap-2 text-xs text-green-500 bg-green-500/10 p-2 rounded border border-green-500/20">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        {t('xml_flash.found_partitions', 'Found {{count}} partitions', { count: partitions.length })}
                                    </span>
                                </div>


                            </>
                        )}
                    </div>

                    {/* Step 2: Select Images Folder */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                2
                            </span>
                            {t('xml_flash.select_images_folder', 'Select Images Folder')}
                        </label>
                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={handleSelectImagesDir}
                            disabled={!xmlFile || partitions.length === 0}
                        >
                            <FolderOpen className="w-4 h-4" />
                            {imagesDir ? imagesDir.name : t('xml_flash.choose_folder', 'Choose Folder...')}
                        </Button>
                    </div>

                    {/* Partition Preview */}
                    {partitions.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {t('xml_flash.partitions_preview', 'Partitions to Flash')}
                            </label>
                            <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                                <div className="divide-y">
                                    {partitions.slice(0, 10).map((p, idx) => {
                                        const sizeInMB = (parseInt(p.num_partition_sectors) * 4096 / 1024 / 1024);
                                        const sizeStr = sizeInMB >= 1024
                                            ? `${(sizeInMB / 1024).toFixed(2)} GB`
                                            : `${sizeInMB.toFixed(2)} MB`;

                                        return (
                                            <div
                                                key={idx}
                                                className="px-3 py-2 text-sm flex items-center justify-between hover:bg-muted/50"
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-mono text-xs">{p.label}</span>
                                                    <span className="text-xs text-muted-foreground">{p.filename}</span>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {sizeStr}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {partitions.length > 10 && (
                                        <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                                            {t('xml_flash.and_more', '...and {{count}} more', { count: partitions.length - 10 })}
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
                        <Zap className="w-4 h-4" />
                        {isProcessing
                            ? t('xml_flash.processing', 'Processing...')
                            : t('xml_flash.start_flash', 'Start Flash')
                        }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
