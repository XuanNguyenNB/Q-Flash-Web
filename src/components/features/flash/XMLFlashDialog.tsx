/**
 * XML Flash Dialog
 * 
 * Allows users to flash/write partitions based on a rawprogram XML file.
 * This is useful for flashing partitions that may not be in the partition table.
 */

import { useState, useCallback, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, FolderOpen, Zap, AlertCircle, CheckCircle2, AlertTriangle, X, CheckCheck, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface XMLFlashDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (xmlFile: File, imagesDir: FileSystemDirectoryHandle, selectedFilenames: string[]) => Promise<void>;
}

interface ParsedPartition {
    label: string;
    filename: string;
    num_partition_sectors: string;
    start_sector?: string;
    physical_partition_number?: string;
    fileExists?: boolean; // Track if file exists in folder
}

export function XMLFlashDialog({ open, onOpenChange, onConfirm }: XMLFlashDialogProps) {
    const { t } = useTranslation();
    const [xmlFile, setXmlFile] = useState<File | null>(null);
    const [imagesDir, setImagesDir] = useState<FileSystemDirectoryHandle | null>(null);
    const [partitions, setPartitions] = useState<ParsedPartition[]>([]);
    const [selectedPartitions, setSelectedPartitions] = useState<Set<number>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isCheckingFiles, setIsCheckingFiles] = useState(false);

    // Reset state when dialog closes
    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (!newOpen) {
            setXmlFile(null);
            setImagesDir(null);
            setPartitions([]);
            setSelectedPartitions(new Set());
            setParseError(null);
            setIsCheckingFiles(false);
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
                        physical_partition_number: physicalPartition || undefined,
                        fileExists: undefined // Will be set after folder selection
                    });
                }
            });

            console.log('Parsed partitions:', parsed);

            if (parsed.length === 0) {
                throw new Error('No valid partitions with filename found in XML');
            }

            setPartitions(parsed);
            // Clear selections until folder is checked
            setSelectedPartitions(new Set());

            return parsed;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to parse XML';
            setParseError(message);
            setPartitions([]);
            throw error;
        }
    }, []);

    // Check files existence when folder is selected
    const checkFilesInFolder = useCallback(async (dirHandle: FileSystemDirectoryHandle, partitionList: ParsedPartition[]) => {
        setIsCheckingFiles(true);
        const updatedPartitions: ParsedPartition[] = [];
        const newSelected = new Set<number>();

        for (let i = 0; i < partitionList.length; i++) {
            const partition = partitionList[i];
            let exists = false;

            try {
                await dirHandle.getFileHandle(partition.filename);
                exists = true;
                // Auto-select partitions with existing files
                newSelected.add(i);
            } catch {
                exists = false;
            }

            updatedPartitions.push({
                ...partition,
                fileExists: exists
            });
        }

        setPartitions(updatedPartitions);
        setSelectedPartitions(newSelected);
        setIsCheckingFiles(false);

        // Count missing files
        const missingCount = updatedPartitions.filter(p => !p.fileExists).length;
        const existingCount = updatedPartitions.filter(p => p.fileExists).length;

        if (existingCount === 0) {
            setParseError(t('xml_flash.no_files_found', 'No matching files found in selected folder'));
        } else if (missingCount > 0) {
            setParseError(null); // Clear error, show warning instead
        }

        return updatedPartitions;
    }, [t]);

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
            setImagesDir(null); // Reset folder when new XML is selected
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

            // Check files in folder
            if (partitions.length > 0) {
                await checkFilesInFolder(dirHandle, partitions);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Failed to select directory:', error);
        }
    }, [partitions, checkFilesInFolder]);

    // Toggle partition selection
    const togglePartition = useCallback((idx: number) => {
        const partition = partitions[idx];
        // Only allow selection if file exists
        if (!partition.fileExists) return;

        setSelectedPartitions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(idx)) {
                newSet.delete(idx);
            } else {
                newSet.add(idx);
            }
            return newSet;
        });
    }, [partitions]);

    // Select all available
    const selectAllAvailable = useCallback(() => {
        const newSet = new Set<number>();
        partitions.forEach((p, idx) => {
            if (p.fileExists) {
                newSet.add(idx);
            }
        });
        setSelectedPartitions(newSet);
    }, [partitions]);

    // Deselect all
    const deselectAll = useCallback(() => {
        setSelectedPartitions(new Set());
    }, []);

    // Handle confirm
    const handleConfirm = useCallback(async () => {
        if (!xmlFile || !imagesDir) return;

        // Filter only selected partitions
        const selectedParts = partitions.filter((_, idx) => selectedPartitions.has(idx));

        if (selectedParts.length === 0) {
            setParseError(t('xml_flash.select_at_least_one', 'Please select at least one partition to flash'));
            return;
        }

        setIsProcessing(true);
        // Close dialog immediately when starting flash
        handleOpenChange(false);
        try {
            // Get filenames of selected partitions
            const selectedFilenames = selectedParts.map(p => p.filename).filter(Boolean);

            await onConfirm(xmlFile, imagesDir, selectedFilenames);
        } catch (error) {
            console.error('Flash failed:', error);
        } finally {
            setIsProcessing(false);
        }

    }, [xmlFile, imagesDir, partitions, selectedPartitions, onConfirm, handleOpenChange, t]);

    // Computed values
    const existingFilesCount = partitions.filter(p => p.fileExists).length;
    const missingFilesCount = partitions.filter(p => p.fileExists === false).length;
    const selectedCount = selectedPartitions.size;
    const canProceed = xmlFile && imagesDir && selectedCount > 0 && !parseError && !isCheckingFiles;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        {t('xml_flash.title', 'Flash by XML')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('xml_flash.description', 'Select a rawprogram XML file and folder containing partition images to flash.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
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

                        {xmlFile && partitions.length > 0 && !imagesDir && (
                            <div className="flex items-start gap-2 text-xs text-green-500 bg-green-500/10 p-2 rounded border border-green-500/20">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>
                                    {t('xml_flash.found_partitions', 'Found {{count}} partitions', { count: partitions.length })}
                                </span>
                            </div>
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

                    {/* File Check Status */}
                    {imagesDir && !isCheckingFiles && (
                        <div className="space-y-2">
                            {/* Summary */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {existingFilesCount > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>{existingFilesCount} {t('xml_flash.files_found', 'files found')}</span>
                                    </div>
                                )}
                                {missingFilesCount > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>{missingFilesCount} {t('xml_flash.files_missing', 'files missing')}</span>
                                    </div>
                                )}
                                {selectedCount > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                                        <Zap className="w-3 h-3" />
                                        <span>{selectedCount} {t('xml_flash.selected_to_flash', 'selected to flash')}</span>
                                    </div>
                                )}
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={selectAllAvailable}
                                >
                                    <CheckCheck className="w-3 h-3" />
                                    {t('xml_flash.select_all', 'Select All')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={deselectAll}
                                >
                                    <Square className="w-3 h-3" />
                                    {t('xml_flash.deselect_all', 'Deselect All')}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Loading state */}
                    {isCheckingFiles && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            {t('xml_flash.checking_files', 'Checking files...')}
                        </div>
                    )}

                    {/* Error Display */}
                    {parseError && (
                        <div className="flex items-start gap-2 text-xs text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{parseError}</span>
                        </div>
                    )}

                    {/* Partition List with Checkboxes */}
                    {imagesDir && partitions.length > 0 && !isCheckingFiles && (
                        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                            <label className="text-sm font-medium mb-2 flex items-center gap-2">
                                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                    3
                                </span>
                                {t('xml_flash.select_partitions', 'Select Partitions to Flash')}
                            </label>
                            <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
                                <div className="divide-y">
                                    {partitions.map((p, idx) => {
                                        const sizeInMB = (parseInt(p.num_partition_sectors) * 4096 / 1024 / 1024);
                                        const sizeStr = sizeInMB >= 1024
                                            ? `${(sizeInMB / 1024).toFixed(2)} GB`
                                            : `${sizeInMB.toFixed(2)} MB`;

                                        const isSelected = selectedPartitions.has(idx);
                                        const isAvailable = p.fileExists === true;
                                        const isMissing = p.fileExists === false;

                                        return (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "px-3 py-2 text-sm flex items-center gap-3 transition-colors",
                                                    isAvailable && "hover:bg-muted/50 cursor-pointer",
                                                    isMissing && "bg-red-500/5 opacity-60",
                                                    isSelected && isAvailable && "bg-primary/5"
                                                )}
                                                onClick={() => togglePartition(idx)}
                                            >
                                                {/* Checkbox */}
                                                <Checkbox
                                                    checked={isSelected}
                                                    disabled={!isAvailable}
                                                    onCheckedChange={() => togglePartition(idx)}
                                                    className={cn(
                                                        isMissing && "opacity-50"
                                                    )}
                                                />

                                                {/* Status Icon */}
                                                {isAvailable ? (
                                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                ) : (
                                                    <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                )}

                                                {/* Partition Info */}
                                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                                    <span className={cn(
                                                        "font-mono text-xs truncate",
                                                        isMissing && "text-muted-foreground"
                                                    )}>
                                                        {p.label}
                                                    </span>
                                                    <span className={cn(
                                                        "text-xs truncate",
                                                        isMissing ? "text-red-500" : "text-muted-foreground"
                                                    )}>
                                                        {p.filename}
                                                        {isMissing && ` (${t('xml_flash.not_found', 'not found')})`}
                                                    </span>
                                                </div>

                                                {/* Size */}
                                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                                    {sizeStr}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-shrink-0">
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
                            : selectedCount > 0
                                ? t('xml_flash.flash_selected', 'Flash {{count}} Partitions', { count: selectedCount })
                                : t('xml_flash.start_flash', 'Start Flash')
                        }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
