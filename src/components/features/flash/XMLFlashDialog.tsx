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
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, FolderOpen, Zap, AlertCircle, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface XMLFlashDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (xmlFile: File, imagesDir: FileSystemDirectoryHandle, selectedFilenames: string[]) => Promise<void>;
}

interface ParsedPartition {
    label: string;
    filename?: string;
    num_partition_sectors: string;
    start_sector?: string;
    physical_partition_number?: string;
    fileExists?: boolean; // Track if file exists in selected folder
    fileSize?: number; // Actual file size
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
                        fileExists: undefined, // Will be checked when folder is selected
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

    // Check if files exist in selected folder
    const checkFilesExist = useCallback(async (dirHandle: FileSystemDirectoryHandle, partitionList: ParsedPartition[]) => {
        console.log('[XMLFlashDialog] Checking files...', partitionList.length, 'partitions');
        setIsCheckingFiles(true);
        const updatedPartitions = [...partitionList];
        const newSelected = new Set<number>();

        for (let i = 0; i < updatedPartitions.length; i++) {
            const p = updatedPartitions[i];
            if (p.filename) {
                try {
                    const fileHandle = await dirHandle.getFileHandle(p.filename);
                    const file = await fileHandle.getFile();
                    updatedPartitions[i] = {
                        ...p,
                        fileExists: true,
                        fileSize: file.size
                    };
                    newSelected.add(i); // Auto-select files that exist
                    console.log(`[XMLFlashDialog] ✅ Found: ${p.filename}`);
                } catch {
                    updatedPartitions[i] = {
                        ...p,
                        fileExists: false,
                        fileSize: undefined
                    };
                    console.log(`[XMLFlashDialog] ❌ Missing: ${p.filename}`);
                }
            }
        }

        console.log('[XMLFlashDialog] Check complete. Found:', newSelected.size, 'files');
        setPartitions(updatedPartitions);
        setSelectedPartitions(newSelected);
        setIsCheckingFiles(false);
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
            setImagesDir(null); // Reset folder when new XML is selected
            const parsed = await parseXML(file);

            // If there was a previously selected dir, re-check
            // This won't run since we reset imagesDir
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
            // Check files immediately after selecting folder
            if (partitions.length > 0) {
                await checkFilesExist(dirHandle, partitions);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error('Failed to select directory:', error);
        }
    }, [partitions, checkFilesExist]);

    // Toggle partition selection
    const togglePartition = useCallback((idx: number) => {
        setSelectedPartitions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(idx)) {
                newSet.delete(idx);
            } else {
                newSet.add(idx);
            }
            return newSet;
        });
    }, []);

    // Select all / Deselect all
    const selectAll = useCallback(() => {
        const existingIndices = partitions
            .map((p, idx) => (p.fileExists !== false ? idx : -1))
            .filter(idx => idx >= 0);
        setSelectedPartitions(new Set(existingIndices));
    }, [partitions]);

    const deselectAll = useCallback(() => {
        setSelectedPartitions(new Set());
    }, []);

    // Handle confirm
    const handleConfirm = useCallback(async () => {
        if (!xmlFile || !imagesDir) return;

        // Filter only selected partitions
        const selectedParts = partitions.filter((_, idx) => selectedPartitions.has(idx));

        if (selectedParts.length === 0) {
            setParseError(t('xml_flash.error_no_selection', 'Please select at least one partition to flash'));
            return;
        }

        // Check if any selected partition has missing file or unchecked status
        const invalidParts = selectedParts.filter(p => p.fileExists !== true);
        if (invalidParts.length > 0) {
            const missingNames = invalidParts.map(p => p.filename).join(', ');
            setParseError(t('xml_flash.error_missing_files', 'Cannot flash - missing files: {{files}}', { files: missingNames }));
            return;
        }

        setIsProcessing(true);
        // Close dialog immediately when starting flash
        handleOpenChange(false);
        try {
            // Get selected partition filenames
            const selectedFilenames = selectedParts
                .filter(p => p.filename)
                .map(p => p.filename as string);

            await onConfirm(xmlFile, imagesDir, selectedFilenames);
        } catch (error) {
            console.error('Flash failed:', error);
        } finally {
            setIsProcessing(false);
        }

    }, [xmlFile, imagesDir, partitions, selectedPartitions, onConfirm, handleOpenChange, t]);

    // Calculate stats
    const existingCount = partitions.filter(p => p.fileExists === true).length;
    const missingCount = partitions.filter(p => p.fileExists === false).length;
    const selectedCount = selectedPartitions.size;

    // Check if all selected partitions have existing files
    const selectedPartsWithFiles = partitions.filter((p, idx) =>
        selectedPartitions.has(idx) && p.fileExists === true
    ).length;
    const allSelectedHaveFiles = selectedCount > 0 && selectedPartsWithFiles === selectedCount;

    const canProceed = xmlFile && imagesDir && partitions.length > 0 && selectedCount > 0 && allSelectedHaveFiles && !parseError && !isCheckingFiles;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        {t('xml_flash.title', 'Flash by XML')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('xml_flash.description', 'Select a rawprogram XML file and folder containing partition images to flash.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4 flex-1 overflow-y-auto">
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

                        {/* File status summary */}
                        {imagesDir && !isCheckingFiles && (
                            <div className="flex items-center gap-3 text-xs">
                                <span className="flex items-center gap-1 text-green-500">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {existingCount} {t('xml_flash.files_found', 'found')}
                                </span>
                                {missingCount > 0 && (
                                    <span className="flex items-center gap-1 text-amber-500">
                                        <AlertTriangle className="w-3 h-3" />
                                        {missingCount} {t('xml_flash.files_missing', 'missing')}
                                    </span>
                                )}
                            </div>
                        )}
                        {isCheckingFiles && (
                            <div className="text-xs text-muted-foreground">
                                {t('xml_flash.checking_files', 'Checking files...')}
                            </div>
                        )}
                    </div>

                    {/* Partition Preview with Checkboxes - show when partitions exist */}
                    {partitions.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">
                                    {t('xml_flash.partitions_preview', 'Partitions to Flash')} ({selectedCount}/{partitions.length})
                                </label>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                                        {t('common.selectAll', 'Select All')}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-7">
                                        {t('common.deselectAll', 'Deselect All')}
                                    </Button>
                                </div>
                            </div>
                            <div className="max-h-[250px] overflow-y-auto border rounded-lg">
                                <div className="divide-y">
                                    {partitions.map((p, idx) => {
                                        const sizeInMB = (parseInt(p.num_partition_sectors) * 4096 / 1024 / 1024);
                                        const sizeStr = sizeInMB >= 1024
                                            ? `${(sizeInMB / 1024).toFixed(2)} GB`
                                            : `${sizeInMB.toFixed(2)} MB`;
                                        const isSelected = selectedPartitions.has(idx);
                                        const fileStatus = p.fileExists;

                                        return (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "px-3 py-2 text-sm flex items-center gap-3 hover:bg-muted/50 cursor-pointer",
                                                    fileStatus === false && "opacity-60 bg-red-500/5"
                                                )}
                                                onClick={() => fileStatus !== false && togglePartition(idx)}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    disabled={fileStatus === false}
                                                    onCheckedChange={() => togglePartition(idx)}
                                                />
                                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs">{p.label}</span>
                                                        {fileStatus === true && (
                                                            <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                                        )}
                                                        {fileStatus === false && (
                                                            <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                    <span className={cn(
                                                        "text-xs truncate",
                                                        fileStatus === false ? "text-red-400" : "text-muted-foreground"
                                                    )}>
                                                        {p.filename}
                                                        {fileStatus === false && ` (${t('xml_flash.file_not_found', 'not found')})`}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
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
