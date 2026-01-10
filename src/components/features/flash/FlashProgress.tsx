/**
 * FlashProgress Component
 *
 * Progress display for flash operations with ETA, partition status, and cancellation.
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Loader2, CheckCircle2, XCircle, AlertTriangle, X, ChevronDown, ChevronUp, RefreshCcw, Smartphone, FileCode } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useFlashStore } from '@/stores/flashStore';
import { useRomStore } from '@/stores/romStore';
import type { PartitionStatus } from '@/stores/flashStore';
import { cn } from '@/lib/utils';

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
 * Format seconds to human-readable time string
 */
function formatTime(seconds: number | null): string {
    if (seconds === null || seconds <= 0) return '--';

    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
}

/**
 * Status icon component for partition status
 */
function StatusIcon({ status }: { status: PartitionStatus }) {
    switch (status) {
        case 'pending':
            return <Clock className="h-4 w-4 text-muted-foreground" />;
        case 'in-progress':
            return <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />;
        case 'done':
            return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        case 'error':
            return <XCircle className="h-4 w-4 text-red-500" />;
        default:
            return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
}

/**
 * FlashProgress props
 */
interface FlashProgressProps {
    onCancel: () => void;
    onClose?: () => void;
}

/**
 * FlashProgress Component
 * 
 * Shows flash operation progress with:
 * - Overall progress bar
 * - Current partition being flashed
 * - Bytes written / total
 * - ETA
 * - Per-partition status list
 * - Cancel button
 * - Minimize/expand toggle
 */
export function FlashProgress({ onCancel, onClose }: FlashProgressProps) {
    const { t } = useTranslation();
    const [isMinimized, setIsMinimized] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const partitionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const lastInProgressPartition = useRef<string | null>(null);

    // Get flash state from store
    const {
        flashWriteStatus,
        currentFlashPartition,
        flashProgress,
        flashBytesWritten,
        flashTotalBytes,
        flashPartitionStatuses,
        flashPartitionProgress,
        flashETA,
        rebootCallback,
        executeReboot,
    } = useFlashStore();

    // Check if operation is active
    const isActive = flashWriteStatus === 'flashing';
    const isComplete = flashWriteStatus === 'success';
    const isError = flashWriteStatus === 'error';
    const isCancelled = flashWriteStatus === 'cancelled';

    // Get partition list from statuses
    const partitions = Array.from(flashPartitionStatuses.entries());

    // Count success and error partitions
    const successCount = partitions.filter(([, status]) => status === 'done').length;
    const errorCount = partitions.filter(([, status]) => status === 'error').length;
    const hasErrors = errorCount > 0;
    const canReboot = isComplete && !hasErrors && rebootCallback !== null;
    const [isRebooting, setIsRebooting] = useState(false);
    const [showRebootDialog, setShowRebootDialog] = useState(false);

    // Auto-hide dialog after 10 seconds when completed successfully (no errors)
    useEffect(() => {
        if (isComplete && !hasErrors && onClose) {
            const timer = setTimeout(() => {
                onClose();
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [isComplete, hasErrors, onClose]);

    // Auto-scroll to current partition when it changes or completes
    useEffect(() => {
        if (currentFlashPartition && currentFlashPartition !== lastInProgressPartition.current) {
            lastInProgressPartition.current = currentFlashPartition;
            const ref = partitionRefs.current.get(currentFlashPartition);
            if (ref) {
                ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentFlashPartition]);

    // Also scroll when a partition is completed (to show the next one)
    useEffect(() => {
        const inProgressPartition = partitions.find(([, status]) => status === 'in-progress');
        if (inProgressPartition) {
            const ref = partitionRefs.current.get(inProgressPartition[0]);
            if (ref) {
                ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [flashPartitionStatuses]);

    // Don't render if idle
    if (flashWriteStatus === 'idle') {
        return null;
    }

    // Minimized view - compact progress bar
    if (isMinimized) {
        return (
            <div className="p-2 rounded-lg border bg-card shadow-lg">
                <div className="flex items-center gap-2">
                    {/* Status icon */}
                    {isActive && <Loader2 className="h-4 w-4 text-violet-500 animate-spin flex-shrink-0" />}
                    {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                    {isError && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                    {isCancelled && <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}

                    {/* Mini progress bar */}
                    <div className="flex-1 min-w-0">
                        <Progress value={flashProgress} className="h-2" />
                    </div>

                    {/* Percentage */}
                    <span className="text-xs text-muted-foreground w-10 text-right">{flashProgress}%</span>

                    {/* Expand button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => setIsMinimized(false)}
                        title="Mở rộng"
                    >
                        <ChevronUp className="h-4 w-4" />
                    </Button>

                    {/* Close button - show when complete */}
                    {(isComplete || isError || isCancelled) && onClose && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={onClose}
                            title="Đóng"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 rounded-lg border bg-card shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    {isActive && <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />}
                    {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    {isError && <XCircle className="h-5 w-5 text-red-500" />}
                    {isCancelled && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                    {t('flash.progress.title', 'Đang Flash')}
                </h3>

                <div className="flex items-center gap-1">
                    {/* Minimize button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setIsMinimized(true)}
                        title="Thu gọn"
                    >
                        <ChevronDown className="h-4 w-4" />
                    </Button>

                    {/* Close button - show when complete */}
                    {(isComplete || isError || isCancelled) && onClose && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={onClose}
                            title="Đóng"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}

                    {isActive && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            className="text-muted-foreground hover:text-red-500"
                        >
                            <X className="h-4 w-4 mr-1" />
                            {t('flash.progress.cancel', 'Hủy')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
                <Progress value={flashProgress} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{flashProgress}%</span>
                    <span>
                        {formatBytes(flashBytesWritten)} / {formatBytes(flashTotalBytes)}
                    </span>
                </div>
            </div>

            {/* Partition status list */}
            <ScrollArea className="h-48 rounded-md border p-2" ref={scrollAreaRef}>
                <div className="space-y-1">
                    {partitions.map(([name, status]) => {
                        const progress = flashPartitionProgress.get(name);
                        const isPatchFile = name.startsWith('patch') && name.endsWith('.xml');
                        const partitionPercent = progress && progress.totalBytes > 0
                            ? Math.floor((progress.bytesWritten / progress.totalBytes) * 100)
                            : 0;

                        return (
                            <div
                                key={name}
                                ref={(el) => {
                                    if (el) partitionRefs.current.set(name, el);
                                }}
                                className={cn(
                                    "text-sm py-2 px-3 rounded transition-all",
                                    status === 'in-progress' && "bg-violet-500/10 ring-2 ring-violet-500/30 shadow-sm",
                                    status === 'done' && "bg-green-500/5",
                                    status === 'error' && "bg-red-500/10"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        {isPatchFile ? (
                                            <FileCode className={cn(
                                                "h-4 w-4",
                                                status === 'pending' && "text-muted-foreground",
                                                status === 'in-progress' && "text-violet-500",
                                                status === 'done' && "text-green-500",
                                                status === 'error' && "text-red-500"
                                            )} />
                                        ) : (
                                            <StatusIcon status={status} />
                                        )}
                                        <span className={cn(
                                            "font-medium",
                                            status === 'in-progress' && "text-violet-500 animate-pulse",
                                            status === 'done' && "text-muted-foreground",
                                            status === 'error' && "text-red-500"
                                        )}>
                                            {name}
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        {/* Show progress for partition */}
                                        {progress && progress.totalBytes > 0 && (
                                            <span className={cn(
                                                "text-xs",
                                                status === 'in-progress' && "text-violet-500",
                                                status === 'done' && "text-green-500",
                                                status === 'pending' && "text-muted-foreground"
                                            )}>
                                                {formatBytes(progress.bytesWritten)} / {formatBytes(progress.totalBytes)}
                                            </span>
                                        )}
                                        <span className={cn(
                                            "text-xs font-medium min-w-[60px] text-right",
                                            status === 'in-progress' && "text-violet-500",
                                            status === 'done' && "text-green-500",
                                            status === 'error' && "text-red-500",
                                            status === 'pending' && "text-muted-foreground"
                                        )}>
                                            {t(`flash.status.${status}`, status)}
                                        </span>
                                    </span>
                                </div>
                                {/* Per-partition progress bar when in progress */}
                                {status === 'in-progress' && progress && progress.totalBytes > 0 && (
                                    <div className="mt-2">
                                        <Progress value={partitionPercent} className="h-1.5" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>

            {/* Completion message - check for mixed results */}
            {isComplete && !hasErrors && (
                <div className="space-y-2">
                    <div className="text-sm text-green-600 dark:text-green-400 bg-green-500/10 p-2 rounded">
                        {t('flash.progress.success_all', { count: successCount })}
                    </div>
                    {canReboot && (
                        <Button
                            variant="default"
                            size="sm"
                            className="w-full gap-2"
                            disabled={isRebooting}
                            onClick={() => setShowRebootDialog(true)}
                        >
                            {isRebooting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCcw className="h-4 w-4" />
                            )}
                            {isRebooting ? t('flash.progress.rebooting', 'Đang khởi động lại...') : t('flash.progress.reboot', 'Khởi động lại thiết bị')}
                        </Button>
                    )}

                    {/* Reboot Confirmation Dialog */}
                    <AlertDialog open={showRebootDialog} onOpenChange={setShowRebootDialog}>
                        <AlertDialogContent className="max-w-md">
                            <AlertDialogHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20">
                                        <RefreshCcw className="w-6 h-6 text-primary" />
                                    </div>
                                    <AlertDialogTitle className="text-xl">
                                        {t('flash.reboot.title', 'Khởi động lại thiết bị?')}
                                    </AlertDialogTitle>
                                </div>
                                <AlertDialogDescription className="text-base text-muted-foreground">
                                    {t('flash.reboot.description', 'Thiết bị sẽ khởi động lại về hệ thống. Đảm bảo bạn đã hoàn tất tất cả các thao tác cần thiết.')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>

                            <div className="py-3">
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <Smartphone className="w-5 h-5 text-amber-500 mt-0.5" />
                                    <div className="text-sm text-muted-foreground">
                                        <p className="font-medium text-amber-600 dark:text-amber-400 mb-1">
                                            {t('flash.reboot.note_title', 'Lưu ý')}
                                        </p>
                                        <p>{t('flash.reboot.note_desc', 'Kết nối USB có thể bị mất sau khi khởi động lại. Bạn sẽ cần kết nối lại nếu muốn tiếp tục thao tác.')}</p>
                                    </div>
                                </div>
                            </div>

                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel', 'Hủy')}</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={async () => {
                                        setShowRebootDialog(false);
                                        setIsRebooting(true);
                                        try {
                                            await executeReboot();
                                            // Clear ROM store after reboot since device will disconnect
                                            useRomStore.getState().clearRom();
                                        } finally {
                                            setIsRebooting(false);
                                        }
                                    }}
                                    className="gap-2"
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                    {t('flash.reboot.confirm', 'Khởi động lại')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}

            {isComplete && hasErrors && (
                <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 p-2 rounded">
                    {t('flash.progress.success_mixed', { success: successCount, error: errorCount })}
                </div>
            )}

            {isCancelled && (
                <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 p-2 rounded">
                    {t('flash.progress.cancelled')}
                </div>
            )}

            {isError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded">
                    {t('flash.progress.failed', { count: errorCount })}
                </div>
            )}
        </div>
    );
}
