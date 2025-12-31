/**
 * RomLoader Component
 *
 * UI component for loading ROM files from a directory.
 * Shows load button, loading state, and ROM summary after loading.
 *
 * Story: 4.6 - ROM File Loading
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// Components
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MissingFilesWarning } from './MissingFilesWarning';

// Icons
import {
    FolderOpen,
    Trash2,
    Loader2,
    Package,
    HardDrive,
    FileWarning,
} from 'lucide-react';

// Hooks and stores
import { useRomLoader } from '@/hooks/useRomLoader';
import { useRomStore } from '@/stores/romStore';
import { usePartitionStore } from '@/stores/partitionStore';

// Utils
import { cn } from '@/lib/utils';

interface RomLoaderProps {
    className?: string;
    compact?: boolean;
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

/**
 * ROM Loader component for selecting and loading ROM folders
 */
export function RomLoader({ className, compact = false }: RomLoaderProps) {
    const { t } = useTranslation();
    const { loadRomFromDirectory, isSupported } = useRomLoader();
    const {
        isLoading,
        progress,
        romDirectory,
        romEntries,
        totalSize,
        missingFiles,
        clearRom,
        hasRom,
    } = useRomStore();
    const { setRomMapping, clearRomMapping, selectAvailableRomPartitions } = usePartitionStore();

    const [loadingMessage, setLoadingMessage] = useState('');

    const romLoaded = hasRom();

    /**
     * Handle Load ROM button click
     */
    const handleLoadRom = useCallback(async () => {
        const result = await loadRomFromDirectory((percent, message) => {
            setLoadingMessage(message);
        });

        if (result) {
            // Sync ROM entries to partition store for display
            setRomMapping(result.entries);

            // Auto select available partitions that match ROM files
            selectAvailableRomPartitions();

            toast.success(t('rom.loaded'), {
                description: `${result.entries.length} ${t('rom.partitionCount', { count: result.entries.length })}`,
            });
        }
    }, [loadRomFromDirectory, t, setRomMapping, selectAvailableRomPartitions]);

    /**
     * Handle Clear ROM button click
     */
    const handleClearRom = useCallback(() => {
        clearRom();
        clearRomMapping();
        toast.info(t('rom.cleared') || 'ROM cleared');
    }, [clearRom, clearRomMapping, t]);

    // Not supported
    if (!isSupported) {
        return (
            <div className={cn('p-3 rounded-lg bg-destructive/10 text-destructive text-sm', className)}>
                <FileWarning className="h-4 w-4 inline-block mr-2" />
                {t('rom.error.notSupported') || 'File System Access API not supported'}
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className={cn('space-y-2', className)}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{loadingMessage || t('rom.loading')}</span>
                </div>
                <Progress value={progress} className="h-1.5" />
            </div>
        );
    }

    // ROM loaded - show summary
    if (romLoaded) {
        const validCount = romEntries.filter(e => e.exists).length;
        const missingCount = missingFiles.length;

        if (compact) {
            return (
                <div className={cn('space-y-2', className)}>
                    {/* Compact summary */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                            <Package className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm font-medium truncate" title={romDirectory || ''}>
                                {romDirectory}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={handleClearRom}
                            title={t('rom.clearButton')}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {validCount} partitions
                        </span>
                        <span>{formatBytes(totalSize)}</span>
                        {missingCount > 0 && (
                            <MissingFilesWarning
                                missingFiles={missingFiles}
                                compact
                            />
                        )}
                    </div>
                </div>
            );
        }

        // Full summary
        return (
            <div className={cn('space-y-3', className)}>
                {/* ROM info card */}
                <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                    {/* Directory name */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <Package className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm font-medium truncate" title={romDirectory || ''}>
                                {romDirectory}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={handleClearRom}
                            title={t('rom.clearButton')}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <HardDrive className="h-3 w-3" />
                            <span>{t('rom.partitionCount', { count: validCount })}</span>
                        </div>
                        <div className="text-muted-foreground">
                            {t('rom.totalSize', { size: formatBytes(totalSize) })}
                        </div>
                    </div>

                    {/* Missing files warning */}
                    {missingCount > 0 && (
                        <MissingFilesWarning missingFiles={missingFiles} />
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleLoadRom}
                    >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        {t('rom.changeFolder') || 'Change Folder'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={handleClearRom}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    // No ROM loaded - show load button
    return (
        <div className={cn('space-y-2', className)}>
            <Button
                variant="outline"
                className={cn(
                    'w-full justify-start gap-2',
                    compact && 'h-9'
                )}
                onClick={handleLoadRom}
            >
                <FolderOpen className="h-4 w-4" />
                <span>{t('rom.loadButton')}</span>
            </Button>
            <p className="text-xs text-muted-foreground">
                {t('rom.selectFolder')}
            </p>
        </div>
    );
}
