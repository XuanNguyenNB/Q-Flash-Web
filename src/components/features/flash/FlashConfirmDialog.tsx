/**
 * FlashConfirmDialog Component
 * 
 * Confirmation dialog for flash operations with critical partition warnings.
 * Uses shadcn/ui AlertDialog for dangerous action pattern (ADR-005).
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle, Zap } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/**
 * Partition info interface
 */
interface PartitionInfo {
    name: string;
    size: number;
    lun: number;
}

/**
 * FlashConfirmDialog props
 */
interface FlashConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    partitions: PartitionInfo[];
    onConfirm: () => void;
}

/**
 * Critical partitions that need warning
 * These partitions can brick the device if flashed incorrectly.
 */
const CRITICAL_PARTITIONS = [
    'abl', 'boot', 'system', 'vendor', 'vbmeta', 'dtbo',
    'xbl', 'hyp', 'tz', 'rpm', 'aop', 'devcfg', 'cmnlib',
    'keymaster', 'modem', 'dsp', 'bluetooth', 'logfs',
    'persist'
];

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if partition is critical
 */
function isCritical(partitionName: string): boolean {
    const lowerName = partitionName.toLowerCase();
    return CRITICAL_PARTITIONS.some(cp => lowerName.includes(cp));
}

/**
 * FlashConfirmDialog Component
 * 
 * Shows confirmation dialog with partition list and warnings before flash operation.
 */
export function FlashConfirmDialog({
    open,
    onOpenChange,
    partitions,
    onConfirm
}: FlashConfirmDialogProps) {
    const { t } = useTranslation();

    // Calculate total size
    const totalSize = partitions.reduce((sum, p) => sum + p.size, 0);

    // Count critical partitions
    const criticalCount = partitions.filter(p => isCritical(p.name)).length;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        {t('flash.confirm.title', '⚠️ Confirm Flash Operation')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('flash.confirm.message', {
                            count: partitions.length,
                            defaultValue: `You are about to flash ${partitions.length} partition(s). This will overwrite existing data on your device.`
                        })}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {/* Partition list */}
                <ScrollArea className="max-h-60 rounded-md border p-2">
                    <div className="space-y-1">
                        {partitions.map(partition => (
                            <div
                                key={`${partition.lun}-${partition.name}`}
                                className={cn(
                                    "flex items-center justify-between text-sm py-1 px-2 rounded",
                                    isCritical(partition.name)
                                        ? "bg-red-500/10 text-red-500"
                                        : "text-muted-foreground"
                                )}
                            >
                                <span className="flex items-center gap-2">
                                    {isCritical(partition.name) && (
                                        <AlertTriangle className="h-3 w-3" />
                                    )}
                                    <span className="font-medium">{partition.name}</span>
                                </span>
                                <span className="text-xs opacity-70">
                                    {formatBytes(partition.size)}
                                </span>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                {/* Summary */}
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between font-medium">
                        <span>{t('flash.confirm.totalSize', 'Total size:')}</span>
                        <span>{formatBytes(totalSize)}</span>
                    </div>

                    {criticalCount > 0 && (
                        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs">
                                {t('flash.confirm.criticalPartition', {
                                    count: criticalCount,
                                    defaultValue: `${criticalCount} critical partition(s) - flash with caution`
                                })}
                            </span>
                        </div>
                    )}

                    <div className="text-xs text-muted-foreground bg-yellow-500/10 p-2 rounded">
                        ⚠️ {t('flash.confirm.warning', 'This action cannot be undone. Make sure you have selected the correct partitions.')}
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel>
                        {t('common.cancel', 'Cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        <Zap className="h-4 w-4 mr-2" />
                        {t('flash.confirm.proceed', 'Confirm Flash')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
