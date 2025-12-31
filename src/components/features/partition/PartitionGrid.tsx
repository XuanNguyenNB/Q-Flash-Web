/**
 * PartitionGrid Component
 * 
 * Displays all partitions in a traditional table layout with Flash and Read actions.
 */

import { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, FileUp, Download, HardDrive, Package, X, RefreshCcw } from 'lucide-react';
import { usePartitionStore } from '@/stores/partitionStore';
import { formatPartitionSize, isDangerousPartition } from '@/lib/partition-utils';
import { cn } from '@/lib/utils';
import { PartitionSearch } from './PartitionSearch';
import { BackupConfirmDialog, BackupProgress } from '@/components/features/backup';
import { FlashConfirmDialog, FlashProgress } from '@/components/features/flash';
import { useBackup, useFlash, useWebUSB, useFirehose } from '@/hooks';
import { useConnectionFlow } from '@/hooks/useConnectionFlow';
import { useFlashStore } from '@/stores/flashStore';
import { useRomStore } from '@/stores/romStore';
import { useTerminalStore } from '@/stores/terminalStore';
import type { PartitionInfo } from '@/types';

interface PartitionGridProps {
    className?: string;
    isLoading?: boolean;
}

export function PartitionGrid({ className, isLoading }: PartitionGridProps) {
    // Hooks
    const { t } = useTranslation();
    const { partitions, selectedPartitions, toggleSelection, selectAll, deselectAll, searchFilter, getRomEntry, hasRomMapping } = usePartitionStore();
    const { startBackup, cancelBackup } = useBackup();
    const { startFlash, cancelFlash, reset: resetFlash } = useFlash();
    const { getManager } = useWebUSB();
    const { getInstance: getFirehose } = useFirehose();
    const { disconnect } = useConnectionFlow();
    const { flashWriteStatus, backupStatus, resetBackup } = useFlashStore();
    const romStore = useRomStore();

    // Backup dialog state
    const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);

    // Flash dialog state
    const [isFlashDialogOpen, setIsFlashDialogOpen] = useState(false);

    // Manually picked files for flash (partition name -> File)
    const [manualFiles, setManualFiles] = useState<Map<string, File>>(new Map());

    // Check if ROM is loaded
    const romLoaded = hasRomMapping();


    // Derived state - filter partitions by search
    const filteredPartitions = useMemo(() => {
        if (!searchFilter) return partitions;

        const lowerFilter = searchFilter.toLowerCase();
        return partitions.filter((p) =>
            p.name.toLowerCase().includes(lowerFilter)
        );
    }, [partitions, searchFilter]);

    // Get selected partition objects for backup
    const selectedPartitionObjects = useMemo(() => {
        return partitions.filter((p) => selectedPartitions.has(p.name));
    }, [partitions, selectedPartitions]);

    // Handlers
    const handleSelectAll = useCallback(() => {
        selectAll();
    }, [selectAll]);

    const handleDeselectAll = useCallback(() => {
        deselectAll();
    }, [deselectAll]);

    const handleOpenBackupDialog = useCallback(() => {
        if (selectedPartitions.size === 0) return;
        setIsBackupDialogOpen(true);
    }, [selectedPartitions.size]);

    const handleBackupConfirm = useCallback(async (directoryHandle: FileSystemDirectoryHandle) => {
        setIsBackupDialogOpen(false);
        const { log } = useTerminalStore.getState();

        const usb = getManager();
        if (!usb) {
            log('error', 'USB not connected');
            return;
        }

        await startBackup(usb, selectedPartitionObjects, directoryHandle);
    }, [selectedPartitionObjects, getManager, startBackup]);

    const handleOpenFlashDialog = useCallback(() => {
        if (selectedPartitions.size > 0) {
            setIsFlashDialogOpen(true);
        }
    }, [selectedPartitions.size]);

    const handleFlashConfirm = useCallback(async () => {
        setIsFlashDialogOpen(false);

        const { log } = useTerminalStore.getState();

        // Get USB and firehose
        const usb = getManager();
        if (!usb) {
            log('error', 'USB not connected. Please connect device first.');
            return;
        }

        const firehose = getFirehose(usb);
        if (!firehose) {
            log('error', 'Firehose not initialized. Please connect device first.');
            return;
        }

        // Build combined files map: manual files + ROM files
        // Manual files have priority over ROM files
        const combinedFilesMap = new Map<string, File>();

        // First, add ROM files
        if (romStore.romEntries && romStore.romEntries.length > 0) {
            for (const entry of romStore.romEntries) {
                if (entry.exists && entry.fileHandle) {
                    try {
                        const file = await entry.fileHandle.getFile();
                        combinedFilesMap.set(entry.label.toLowerCase(), file);
                    } catch (e) {
                        log('warning', `Could not get ROM file for ${entry.label}`);
                    }
                }
            }
        }

        // Then, add manual files (override ROM files if same partition)
        for (const [partitionName, file] of manualFiles.entries()) {
            combinedFilesMap.set(partitionName, file);
        }

        // Check which selected partitions have files
        const partitionsWithFiles = selectedPartitionObjects.filter(p =>
            combinedFilesMap.has(p.name.toLowerCase())
        );

        if (partitionsWithFiles.length === 0) {
            log('error', 'No files available for selected partitions. Pick files or load ROM first.');
            return;
        }

        const skipped = selectedPartitionObjects.length - partitionsWithFiles.length;
        if (skipped > 0) {
            log('warning', `${skipped} partition(s) skipped (no file available)`);
        }

        log('info', `Flashing ${partitionsWithFiles.length} partition(s)...`);

        // Wrap firehose for startFlash compatibility
        const firehoseWrapper = {
            writePartition: async (
                name: string,
                lun: number,
                startSector: number,
                data: Uint8Array,
                onProgress?: (bytesWritten: number, totalBytes: number) => void
            ) => {
                const result = await firehose.writePartition(
                    lun,
                    BigInt(startSector),
                    BigInt(Math.ceil(data.length / 512)), // numSectors
                    name,
                    data,
                    (percent) => {
                        if (onProgress) {
                            const written = Math.floor((percent / 100) * data.length);
                            onProgress(written, data.length);
                        }
                    }
                );
                return result.success;
            },
            writePartitionChunked: async (
                name: string,
                lun: number,
                startSector: bigint,
                numSectors: bigint,
                file: Blob,
                onProgress?: (percent: number) => void,
                spoofLabel?: string,
                spoofFilename?: string
            ) => {
                const result = await firehose.writePartitionChunked(
                    lun,
                    startSector,
                    numSectors,
                    name,
                    file as File,
                    onProgress,
                    undefined, // chunkProgress
                    undefined, // filename
                    true,      // partofsingleimage
                    spoofLabel,
                    spoofFilename
                );
                return result.success;
            },
            applyPatch: async (xmlContent: string) => {
                const result = await firehose.applyPatch(xmlContent);
                return result.success;
            },
            reset: async () => {
                const result = await firehose.reset();
                return result.success;
            },
            configure: async () => {
                const result = await firehose.configure(firehose.currentConfig);
                return result.success;
            }
        };

        await startFlash(partitionsWithFiles, combinedFilesMap, firehoseWrapper);
    }, [selectedPartitionObjects, startFlash, getManager, getFirehose, romStore.romEntries, manualFiles]);

    const handleFlashCancel = useCallback(() => {
        cancelFlash();
    }, [cancelFlash]);

    const handleBackupCancel = useCallback(() => {
        cancelBackup();
    }, [cancelBackup]);

    /**
     * Handle picking file for a partition (does NOT flash immediately)
     * File will be flashed when user clicks "Flash Selected"
     */
    const handlePickFile = useCallback(async (partitionName: string) => {
        // Find the partition object
        const partition = partitions.find(p => p.name === partitionName);
        if (!partition) {
            console.error('Partition not found:', partitionName);
            return;
        }

        try {
            // Open file picker for the partition image
            const [fileHandle] = await window.showOpenFilePicker({
                types: [
                    {
                        description: 'Partition Images',
                        accept: {
                            'application/octet-stream': ['.img', '.bin', '.elf', '.mbn', '.melf']
                        }
                    }
                ],
                multiple: false
            });

            const file = await fileHandle.getFile();

            // Log selection
            const { log } = useTerminalStore.getState();
            log('info', `✓ Selected "${file.name}" (${formatPartitionSize(file.size)}) for partition "${partitionName}"`);

            // Check file size vs partition size
            const partitionSize = partition.size;
            if (file.size > partitionSize) {
                log('warning', `⚠️ File size (${formatPartitionSize(file.size)}) exceeds partition size (${formatPartitionSize(partitionSize)})`);
            }

            // Store the file in manualFiles map
            setManualFiles(prev => {
                const newMap = new Map(prev);
                newMap.set(partitionName.toLowerCase(), file);
                return newMap;
            });

            // Auto-select this partition for flashing
            if (!selectedPartitions.has(partitionName)) {
                toggleSelection(partitionName);
            }

        } catch (error: any) {
            // User cancelled
            if (error.name === 'AbortError') {
                return;
            }
            console.error('Failed to pick file:', error);
        }
    }, [partitions, selectedPartitions, toggleSelection]);

    /**
     * Clear picked file for a partition
     */
    const handleClearPickedFile = useCallback((partitionName: string) => {
        setManualFiles(prev => {
            const newMap = new Map(prev);
            newMap.delete(partitionName.toLowerCase());
            return newMap;
        });
        const { log } = useTerminalStore.getState();
        log('info', `Cleared file for partition "${partitionName}"`);
    }, []);


    const handleRead = useCallback(async (partitionName: string) => {
        // Find the partition object
        const partition = partitions.find(p => p.name === partitionName);
        if (!partition) {
            console.error('Partition not found:', partitionName);
            return;
        }

        try {
            // Open directory picker directly for single partition backup
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'downloads',
            });

            // Start backup with single partition
            const usb = getManager();
            await startBackup(usb, [partition], dirHandle);
        } catch (error: any) {
            // User cancelled or permission denied
            if (error.name === 'AbortError') {
                console.log('User cancelled directory selection');
                return;
            }
            console.error('Failed to backup partition:', error);
        }
    }, [partitions, getManager, startBackup]);

    const handleReboot = useCallback(async () => {
        const { log } = useTerminalStore.getState();
        const usb = getManager();
        if (!usb) {
            log('error', 'USB not connected');
            return;
        }

        const firehose = getFirehose(usb);
        if (!firehose) {
            log('error', 'Firehose not initialized');
            return;
        }

        try {
            log('info', 'Sending reboot command...');
            const result = await firehose.reset();
            if (result.success) {
                log('success', 'Reboot command sent successfully');
                // Reset connection state after successful reboot
                // Device will disconnect, so reset UI to waiting state
                log('info', 'Resetting connection state...');
                await disconnect();
                log('info', 'Device rebooting - please reconnect after device boots up');
            } else {
                log('error', `Reboot failed: ${result.error}`);
            }
        } catch (e) {
            log('error', `Reboot error: ${(e as Error).message}`);
            // Still try to reset connection state on error
            try {
                await disconnect();
            } catch {
                // Ignore disconnect errors
            }
        }
    }, [getManager, getFirehose, disconnect]);

    // Loading state
    if (isLoading) {
        return (
            <div className={cn('flex flex-col items-center justify-center p-12 text-center h-64', className)}>
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground animate-pulse">
                        {t('partition.grid.loading')}
                    </p>
                </div>
            </div>
        );
    }

    // Empty state
    if (partitions.length === 0) {
        return (
            <div className={cn('flex flex-col items-center justify-center p-12 text-center', className)}>
                <div className="text-muted-foreground">
                    <p className="text-lg font-medium mb-2">
                        {t('partition.grid.empty')}
                    </p>
                    <p className="text-sm">
                        {t('partition.grid.emptyHint')}
                    </p>
                </div>
            </div>
        );
    }



    return (
        <div className={cn('flex flex-col gap-4', className)}>
            {/* Header with controls */}
            <div className="flex flex-col gap-3">
                {/* Search and Title row - reversed order */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Search component - now on left */}
                    <PartitionSearch
                        totalCount={partitions.length}
                        filteredCount={filteredPartitions.length}
                        className="w-full sm:w-auto sm:max-w-md"
                    />

                    {/* Title - now on right */}
                    <div className="flex items-center gap-2 shrink-0">
                        <h2 className="text-lg font-semibold whitespace-nowrap">
                            {t('partition.grid.title')}
                        </h2>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            ({filteredPartitions.length})
                        </span>
                    </div>
                </div>

                {/* Action buttons row */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                    >
                        {t('partition.grid.selectAll')}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeselectAll}
                    >
                        {t('partition.grid.deselectAll')}
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleOpenBackupDialog}
                        disabled={selectedPartitions.size === 0}
                        className="gap-2"
                    >
                        <HardDrive className="w-4 h-4" />
                        {t('backup.button', { count: selectedPartitions.size })}
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleOpenFlashDialog}
                        disabled={selectedPartitions.size === 0 || flashWriteStatus === 'flashing'}
                        className="gap-2"
                    >
                        <FileUp className="w-4 h-4" />
                        {t('flash.button')} ({selectedPartitions.size})
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReboot}
                        disabled={flashWriteStatus === 'flashing'}
                        className="gap-2 ml-auto"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Reboot Device
                    </Button>
                </div>
            </div>

            {/* Partition table - scrollable container */}
            <div className="rounded-lg border border-border bg-card max-h-[600px] overflow-y-auto">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted border-b border-border sticky top-0 z-10">
                            <tr>
                                <th className="w-12 px-4 py-3 text-left">
                                    <span className="sr-only">{t('partition.table.select')}</span>
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">
                                    {t('partition.table.name')}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold w-24">
                                    {t('partition.table.lun')}
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-semibold">
                                    {t('partition.table.size')}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">
                                    {t('partition.table.flash')}
                                </th>
                                <th className="px-4 py-3 text-center text-sm font-semibold">
                                    {t('partition.table.read')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredPartitions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                        <p className="text-base font-medium mb-1">
                                            {t('partition.grid.noResults')}
                                        </p>
                                        <p className="text-sm">
                                            {t('partition.grid.noResultsHint', { filter: searchFilter })}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPartitions.map((partition) => {
                                    const isSelected = selectedPartitions.has(partition.name);
                                    const isDangerous = isDangerousPartition(partition.name);
                                    const romEntry = getRomEntry(partition.name);
                                    const isLargePartition = partition.size > 500 * 1024 * 1024; // > 500MB

                                    // Use unique key combining name, lun, and startSector to avoid duplicates
                                    const uniqueKey = `${partition.name}-${partition.lun}-${partition.startSector}`;

                                    // Use ROM file size if available, otherwise partition size (already calculated correctly by FirehoseProtocol)
                                    const sizeInBytes = romEntry?.exists
                                        ? romEntry.fileSize
                                        : partition.size;
                                    const formattedSize = formatPartitionSize(sizeInBytes);

                                    return (
                                        <tr
                                            key={uniqueKey}
                                            className={cn(
                                                'transition-colors border-b border-border/50',
                                                isSelected
                                                    ? 'bg-primary/20 hover:bg-primary/25'
                                                    : 'hover:bg-muted/50'
                                            )}
                                        >
                                            <td className="px-4 py-3">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleSelection(partition.name)}
                                                    aria-label={t('partition.item.select', { name: partition.name })}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "font-mono text-sm",
                                                        isSelected && "font-semibold"
                                                    )}>
                                                        {partition.name}
                                                    </span>
                                                    {isDangerous && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <AlertTriangle
                                                                        className="w-4 h-4 text-amber-500 flex-shrink-0 cursor-help"
                                                                    />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{t('partition.item.dangerous')}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                    {/* Persist Special Indicator */}
                                                    {partition.name.toLowerCase().includes('persist') && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="flex items-center text-red-500 cursor-help">
                                                                        <svg
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                            viewBox="0 0 24 24"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            className="w-4 h-4"
                                                                        >
                                                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                                                            <path d="M12 8v4" />
                                                                            <path d="M12 16h.01" />
                                                                        </svg>
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-[250px]">
                                                                    <p className="font-bold text-red-500 mb-1">{t('partition.item.criticalTooltip')}</p>
                                                                    <p className="text-sm whitespace-pre-line">
                                                                        {t('partition.item.criticalDesc')}
                                                                    </p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                    {/* ROM indicator */}
                                                    {romLoaded && romEntry && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    {romEntry.exists ? (
                                                                        <Package
                                                                            className="w-4 h-4 text-primary flex-shrink-0 cursor-help"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-amber-500 text-xs font-bold">⚠️</span>
                                                                    )}
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    {romEntry.exists ? (
                                                                        <div className="space-y-1">
                                                                            <p className="font-medium">{t('rom.sourceIndicator')}: {romEntry.filename}</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {romEntry.isSparse ? t('rom.fileType.sparse') : t('rom.fileType.raw')}
                                                                            </p>
                                                                        </div>
                                                                    ) : (
                                                                        <p>{t('rom.missingFiles', { count: 1 })}: {romEntry.filename}</p>
                                                                    )}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                                    {partition.lun}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={cn(
                                                    isLargePartition && "text-blue-400 font-medium drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]"
                                                )}>
                                                    {formattedSize}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {manualFiles.has(partition.name.toLowerCase()) ? (
                                                    // File already picked - show indicator
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <span className="text-green-500 text-sm font-medium flex items-center gap-1">
                                                                        ✓ {manualFiles.get(partition.name.toLowerCase())?.name.slice(0, 15)}
                                                                        {(manualFiles.get(partition.name.toLowerCase())?.name.length || 0) > 15 && '...'}
                                                                    </span>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-5 w-5 text-muted-foreground hover:text-red-500"
                                                                        onClick={() => handleClearPickedFile(partition.name)}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{manualFiles.get(partition.name.toLowerCase())?.name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {formatPartitionSize(manualFiles.get(partition.name.toLowerCase())?.size || 0)}
                                                                </p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : (
                                                    // No file picked - show pick button
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handlePickFile(partition.name)}
                                                        className="gap-2"
                                                        disabled={flashWriteStatus === 'flashing'}
                                                    >
                                                        <FileUp className="w-4 h-4" />
                                                        {t('partition.table.pickFile')}
                                                    </Button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRead(partition.name)}
                                                    className="gap-2"
                                                    // Disable read if backup in progress (though technically read is simpler)
                                                    disabled={flashWriteStatus === 'flashing'}
                                                >
                                                    <Download className="w-4 h-4" />
                                                    {t('partition.table.save')}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Backup Confirmation Dialog */}
            <BackupConfirmDialog
                open={isBackupDialogOpen}
                onOpenChange={setIsBackupDialogOpen}
                partitions={selectedPartitionObjects}
                onConfirm={handleBackupConfirm}
            />

            {/* Flash Confirmation Dialog */}
            <FlashConfirmDialog
                open={isFlashDialogOpen}
                onOpenChange={setIsFlashDialogOpen}
                partitions={selectedPartitionObjects.map(p => ({
                    name: p.name,
                    size: p.size,  // Use pre-calculated size (correct for both UFS 4096 and eMMC 512 sector sizes)
                    lun: p.lun
                }))}
                onConfirm={handleFlashConfirm}
            />

            {/* Flash Progress - with minimize/expand/close buttons */}
            {flashWriteStatus !== 'idle' && (
                <div className="fixed bottom-4 right-4 z-50 w-96">
                    <FlashProgress onCancel={handleFlashCancel} onClose={resetFlash} />
                </div>
            )}

            {/* Backup Progress */}
            {backupStatus !== 'idle' && (
                <div className="fixed bottom-4 right-4 z-50 w-96">
                    <BackupProgress onCancel={handleBackupCancel} onClose={resetBackup} />
                </div>
            )}
        </div>
    );
}
