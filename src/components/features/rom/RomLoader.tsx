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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// Icons
import {
    FolderOpen,
    Trash2,
    Loader2,
    Package,
    HardDrive,
    FileWarning,
    Info,
    ExternalLink,
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
    const [showGuideDialog, setShowGuideDialog] = useState(false);

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

    // Build the content based on state
    const renderContent = () => {
        // Loading state
        if (isLoading) {
            return (
                <div className={cn('space-y-3', className)}>
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">
                            {loadingMessage || t('rom.loading') || 'Loading ROM...'}
                        </span>
                    </div>
                    <Progress value={progress} className="h-1" />
                </div>
            );
        }

        // No ROM loaded - show load button with info
        if (!romLoaded) {
            return (
                <div className={cn('space-y-2', className)}>
                    <div className="flex items-center gap-1">
                        <Button
                            onClick={handleLoadRom}
                            variant="outline"
                            size="sm"
                            className="flex-1 justify-start text-xs h-8 overflow-hidden"
                        >
                            <FolderOpen className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                            <span className="truncate">{t('rom.domesticFlash', 'Flash theo ROM gốc')}</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => setShowGuideDialog(true)}
                            title={t('rom.guide', 'Hướng dẫn')}
                        >
                            <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>
            );
        }

        // Compact view
        if (compact) {
            return (
                <div className={cn('space-y-2', className)}>
                    {/* ROM loaded info */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Package className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-xs font-medium truncate" title={romDirectory || ''}>
                                {romDirectory}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">
                                {romEntries.length} files
                            </span>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setShowGuideDialog(true)}
                                title={t('rom.guide', 'Hướng dẫn')}
                            >
                                <Info className="h-3 w-3" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={handleClearRom}
                                title={t('rom.clear') || 'Clear ROM'}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Missing files warning */}
                    {missingFiles.length > 0 && (
                        <MissingFilesWarning
                            missingFiles={missingFiles}
                            compact
                        />
                    )}
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
                        <div className="flex items-center gap-1">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setShowGuideDialog(true)}
                                title={t('rom.guide', 'Hướng dẫn')}
                            >
                                <Info className="h-4 w-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={handleClearRom}
                                title={t('rom.clear') || 'Clear ROM'}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            <span>{formatBytes(totalSize)}</span>
                        </div>
                        <div>
                            {romEntries.length} {t('rom.files') || 'files'}
                        </div>
                    </div>
                </div>

                {/* Missing files warning */}
                {missingFiles.length > 0 && (
                    <MissingFilesWarning missingFiles={missingFiles} />
                )}

                {/* Reload button */}
                <Button
                    onClick={handleLoadRom}
                    variant="outline"
                    size="sm"
                    className="w-full"
                >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    {t('rom.reload') || 'Reload ROM'}
                </Button>
            </div>
        );
    };

    return (
        <>
            {renderContent()}

            {/* Guide Dialog */}
            <Dialog open={showGuideDialog} onOpenChange={setShowGuideDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-primary" />
                            {t('rom.guideTitle', 'Hướng dẫn Flash ROM gốc')}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Guide Image */}
                        <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                            <img
                                src="/images/rom-guide.png"
                                alt="ROM Folder Guide"
                                className="w-full h-auto"
                                onError={(e) => {
                                    // Hide image if not found
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>

                        {/* Instructions */}
                        <div className="space-y-3">
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
                                    1
                                </span>
                                <div className="text-sm">
                                    <p className="font-medium">{t('rom.guideStep1Title', 'Giải nén ROM')}</p>
                                    <p className="text-muted-foreground text-xs mt-1">
                                        {t('rom.guideStep1Desc', 'Giải nén file ROM (.zip/.rar) ra thư mục chứa rawprogram.xml')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
                                    2
                                </span>
                                <div className="text-sm">
                                    <p className="font-medium">{t('rom.guideStep2Title', 'Build super.img (nếu cần)')}</p>
                                    <p className="text-muted-foreground text-xs mt-1">
                                        {t('rom.guideStep2Desc', 'Dùng Q-Flash Forge để build super.img từ các partition')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
                                    3
                                </span>
                                <div className="text-sm">
                                    <p className="font-medium">{t('rom.guideStep3Title', 'Chọn thư mục ROM')}</p>
                                    <p className="text-muted-foreground text-xs mt-1">
                                        {t('rom.guideStep3Desc', 'Nhấn nút và chọn thư mục chứa file rawprogram.xml')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Q-Forge Link */}
                        <a
                            href="https://github.com/nicenightcc/Q-Flash-Forge"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-sm font-medium"
                        >
                            <ExternalLink className="h-4 w-4" />
                            {t('rom.openForge', 'Mở Q-Flash Forge')}
                        </a>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
