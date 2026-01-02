/**
 * FastbootFlashPanel Component
 * 
 * Provides UI for flashing partitions.
 * Fetches available partitions from device via getvar.
 * Inline progress display instead of modal dialogs.
 * 
 * Story: 8.5 - Fastboot Flash Partitions
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, FileUp, Check, ChevronsUpDown, RefreshCw, Loader2, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { trackEvent } from '@/services/analytics';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { useFastbootStore } from '@/stores/fastbootStore';

// Hooks
import { useFastboot } from '@/hooks/useFastboot';

// Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface FastbootFlashPanelProps {
    className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ============================================================================
// Main Component
// ============================================================================

export function FastbootFlashPanel({ className }: FastbootFlashPanelProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Partition List State
    const [availablePartitions, setAvailablePartitions] = useState<string[]>([]);
    const [isLoadingPartitions, setIsLoadingPartitions] = useState(false);
    const [flashPopoverOpen, setFlashPopoverOpen] = useState(false);

    // Flash State
    const [selectedPartition, setSelectedPartition] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showConfirmFlash, setShowConfirmFlash] = useState(false);

    // Store State
    const { isConnected } = useDeviceStore();
    const { flashProgress, deviceInfo } = useFastbootStore();

    // Hooks
    const { flashPartition, getPartitionList } = useFastboot();

    // Check bootloader status
    const isBootloaderLocked = !deviceInfo?.unlocked;

    // ========================================================================
    // Fetch Partitions on Connect
    // ========================================================================

    useEffect(() => {
        if (isConnected && availablePartitions.length === 0) {
            fetchPartitions();
        }
    }, [isConnected]);

    const fetchPartitions = async () => {
        setIsLoadingPartitions(true);
        try {
            const partitions = await getPartitionList();
            setAvailablePartitions(partitions);
            // Don't toast on auto-fetch, only manual
        } catch (error) {
            console.error('Failed to fetch partitions:', error);
        } finally {
            setIsLoadingPartitions(false);
        }
    };

    const handleManualRefresh = async () => {
        setIsLoadingPartitions(true);
        try {
            const partitions = await getPartitionList();
            setAvailablePartitions(partitions);
            if (partitions.length > 0) {
                toast.success(t('fastboot.flash.partitionsLoaded', `Found ${partitions.length} partitions`));
            } else {
                toast.info(t('common.noResult', 'No partitions found'));
            }
        } finally {
            setIsLoadingPartitions(false);
        }
    };

    // ========================================================================
    // Flash Handlers
    // ========================================================================

    const handleSelectPartitionAndFile = () => {
        if (!selectedPartition || !isConnected) return;
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setShowConfirmFlash(true);
        }
    };

    const confirmAndFlash = async () => {
        if (!selectedFile || !selectedPartition) return;

        setShowConfirmFlash(false);
        try {
            const success = await flashPartition(selectedPartition, selectedFile);
            if (success) {
                toast.success(t('fastboot.flash.success', 'Flash completed successfully'));
                trackEvent('fastboot', 'flash_partition', selectedPartition, selectedFile.size);
            } else {
                toast.error(t('fastboot.flash.failed', 'Flash failed'));
                trackEvent('fastboot', 'flash_failed', selectedPartition);
            }
        } catch (error) {
            toast.error(t('fastboot.flash.failed', 'Flash failed') + ': ' + (error instanceof Error ? error.message : String(error)));
            trackEvent('fastboot', 'flash_error', selectedPartition);
        } finally {
            setSelectedFile(null);
            setSelectedPartition('');
        }
    };

    // ========================================================================
    // Default partitions (fallback when no getvar data)
    // ========================================================================

    const defaultPartitions = ['boot', 'recovery', 'vbmeta', 'dtbo', 'vendor_boot', 'system', 'vendor', 'super', 'userdata', 'metadata'];
    const partitionsToShow = availablePartitions.length > 0 ? availablePartitions : defaultPartitions;

    return (
        <Card className={cn(className)}>
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".img,.bin"
                onChange={onFileChange}
            />

            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileUp className="h-5 w-5 text-primary" />
                            {t('fastboot.flash.title', 'Flash Partitions')}
                            {isBootloaderLocked && isConnected && (
                                <Badge variant="destructive" className="ml-2 text-xs">
                                    🔒 {t('fastboot.flash.locked', 'Locked')}
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            {isBootloaderLocked && isConnected
                                ? t('fastboot.flash.lockedDesc', 'Unlock bootloader first to flash partitions')
                                : t('fastboot.flash.description', 'Flash images to device partitions.')}
                        </CardDescription>
                    </div>
                    {/* Refresh Partitions Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleManualRefresh}
                        disabled={!isConnected || isLoadingPartitions}
                    >
                        {isLoadingPartitions ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* 
                    Main Content Switch:
                    If flashing -> Show Progress UI
                    If idle -> Show Selection UI
                */}
                {flashProgress ? (
                    <div className="space-y-4 py-2 animate-in fade-in-50 bg-muted/30 p-4 rounded-lg border border-primary/20">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm flex items-center gap-2 text-primary">
                                <Activity className="h-4 w-4 animate-pulse" />
                                {t('fastboot.flash.progressTitle', 'Flashing {{partition}}...', { partition: flashProgress?.partition })}
                            </h4>
                            <span className="text-xs font-mono font-bold">
                                {Math.round(flashProgress.progress * 100)}%
                            </span>
                        </div>

                        <Progress value={flashProgress.progress * 100} className="h-2" />

                        <div className="flex justify-between text-xs text-muted-foreground font-mono">
                            <span className="flex items-center gap-1">
                                <FileUp className="h-3 w-3" />
                                {flashProgress.transferred ? formatBytes(flashProgress.transferred) : '0 B'}
                            </span>
                            <span className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                {flashProgress.total ? formatBytes(flashProgress.total) : 'Total'}
                            </span>
                        </div>

                        <div className="text-xs text-center text-amber-500/80 pt-1 flex items-center justify-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('fastboot.flash.progressDesc', 'Please do not disconnect the device.')}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Flash Controls */}
                        <div className={cn(
                            "flex flex-col sm:flex-row gap-3 transition-opacity",
                            isBootloaderLocked && "opacity-50"
                        )}>
                            {/* Partition Selector */}
                            <Popover open={flashPopoverOpen} onOpenChange={setFlashPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={flashPopoverOpen}
                                        className="w-full sm:w-[200px] justify-between font-mono"
                                        disabled={!isConnected}
                                    >
                                        {selectedPartition || t('fastboot.flash.selectPartition', 'Select partition...')}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0">
                                    <Command>
                                        <CommandInput placeholder={t('fastboot.flash.searchPartition', 'Search...')} />
                                        <CommandList>
                                            <CommandEmpty>{t('common.noResult', 'No results.')}</CommandEmpty>
                                            <CommandGroup heading={availablePartitions.length > 0 ? t('fastboot.flash.devicePartitions', 'Device Partitions') : t('fastboot.flash.commonPartitions', 'Common')}>
                                                {partitionsToShow.map((partition) => (
                                                    <CommandItem
                                                        key={partition}
                                                        value={partition}
                                                        onSelect={(value) => {
                                                            setSelectedPartition(value);
                                                            setFlashPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedPartition === partition ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <HardDrive className="mr-2 h-4 w-4 text-muted-foreground" />
                                                        {partition}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>

                            {/* Custom Partition Input */}
                            <Input
                                placeholder={t('fastboot.flash.customPartition', 'Or type name')}
                                value={selectedPartition}
                                onChange={(e) => setSelectedPartition(e.target.value)}
                                className="flex-1 font-mono"
                                disabled={!isConnected}
                            />

                            {/* Flash Button */}
                            <Button
                                onClick={handleSelectPartitionAndFile}
                                disabled={!isConnected || !selectedPartition || isBootloaderLocked}
                                className="sm:w-32"
                            >
                                <FileUp className="mr-2 h-4 w-4" />
                                {t('fastboot.flash.selectFile', 'Flash')}
                            </Button>
                        </div>

                        {/* Partition Count Info */}
                        {availablePartitions.length > 0 && (
                            <p className="text-xs text-muted-foreground text-right">
                                {t('fastboot.flash.partitionCount', '{{count}} partitions detected from device', { count: availablePartitions.length })}
                            </p>
                        )}
                    </>
                )}
            </CardContent>

            {/* Flash Confirmation Dialog */}
            <AlertDialog open={showConfirmFlash} onOpenChange={setShowConfirmFlash}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('fastboot.flash.confirmTitle', 'Confirm Flash')}</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                            <div className="flex flex-col gap-2 p-3 bg-muted rounded-md text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('fastboot.flash.file', 'File')}:</span>
                                    <span className="font-mono font-medium truncate max-w-[200px]">{selectedFile?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('fastboot.flash.size', 'Size')}:</span>
                                    <span className="font-mono">{selectedFile ? formatBytes(selectedFile.size) : '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('fastboot.flash.target', 'Target Partition')}:</span>
                                    <span className="font-bold text-primary">{selectedPartition.toUpperCase()}</span>
                                </div>
                            </div>
                            <p className="text-destructive font-medium">
                                {t('fastboot.flash.warning', 'This will overwrite the current partition. Ensure the image is correct for your device.')}
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setSelectedFile(null);
                        }}>
                            {t('common.cancel', 'Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={confirmAndFlash}>
                            {t('fastboot.flash.button', 'Flash Now')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
