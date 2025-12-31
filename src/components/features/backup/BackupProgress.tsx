/**
 * BackupProgress Component
 * 
 * Progress display for backup operations with ETA, partition status, and cancellation.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Loader2, CheckCircle2, XCircle, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFlashStore } from '@/stores/flashStore';
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
 * BackupProgress props
 */
interface BackupProgressProps {
    onCancel: () => void;
    onClose?: () => void;
}

/**
 * BackupProgress Component
 * 
 * Shows backup operation progress with:
 * - Overall progress bar
 * - Current partition being backed up
 * - Bytes written / total
 * - ETA
 * - Per-partition status list
 * - Cancel button
 * - Minimize/expand toggle
 */
export function BackupProgress({ onCancel, onClose }: BackupProgressProps) {
    const { t } = useTranslation();
    const [isMinimized, setIsMinimized] = useState(false);

    // Get backup state from store
    const {
        backupStatus,
        currentBackupPartition,
        backupProgress,
        backupBytesWritten,
        backupTotalBytes,
        backupPartitionStatuses,
        backupETA,
    } = useFlashStore();

    // Check if operation is active
    const isActive = backupStatus === 'backing-up';
    const isComplete = backupStatus === 'success';
    const isError = backupStatus === 'error';
    const isCancelled = backupStatus === 'cancelled';

    // Get partition list from statuses
    const partitions = Array.from(backupPartitionStatuses.entries());

    // Count success and error partitions
    const successCount = partitions.filter(([, status]) => status === 'done').length;
    const errorCount = partitions.filter(([, status]) => status === 'error').length;
    const hasErrors = errorCount > 0;

    // Don't render if idle
    if (backupStatus === 'idle') {
        return null;
    }

    // Minimized view - compact progress bar
    if (isMinimized) {
        return (
            <div className="p-2 rounded-lg border bg-card shadow-lg">
                <div className="flex items-center gap-2">
                    {/* Status icon */}
                    {isActive && <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />}
                    {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                    {isError && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                    {isCancelled && <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}

                    {/* Mini progress bar */}
                    <div className="flex-1 min-w-0">
                        <Progress value={backupProgress} className="h-2" />
                    </div>

                    {/* Percentage */}
                    <span className="text-xs text-muted-foreground w-10 text-right">{backupProgress}%</span>

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
                    {isActive && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                    {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    {isError && <XCircle className="h-5 w-5 text-red-500" />}
                    {isCancelled && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                    {t('backup.progress.title', 'Đang Backup')}
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
                            {t('backup.progress.cancel', 'Hủy')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
                <Progress value={backupProgress} className="h-3" />
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{backupProgress}%</span>
                    <span>
                        {formatBytes(backupBytesWritten)} / {formatBytes(backupTotalBytes)}
                    </span>
                </div>
            </div>

            {/* Current partition and ETA */}
            {isActive && currentBackupPartition && (
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                        {t('backup.progress.current', { partition: currentBackupPartition })}
                    </span>
                    <span className="text-muted-foreground">
                        {t('backup.progress.eta', { time: formatTime(backupETA) })}
                    </span>
                </div>
            )}

            {/* Partition status list */}
            <ScrollArea className="max-h-40">
                <div className="space-y-1">
                    {partitions.map(([name, status]) => (
                        <div
                            key={name}
                            className={cn(
                                "flex items-center justify-between text-sm py-1 px-2 rounded",
                                status === 'in-progress' && "bg-blue-500/10",
                                status === 'done' && "bg-green-500/5",
                                status === 'error' && "bg-red-500/10"
                            )}
                        >
                            <span className="flex items-center gap-2">
                                <StatusIcon status={status} />
                                <span className={cn(
                                    status === 'in-progress' && "font-medium text-blue-500",
                                    status === 'done' && "text-muted-foreground",
                                    status === 'error' && "text-red-500"
                                )}>
                                    {name}
                                </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {t(`backup.status.${status}`, status)}
                            </span>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Completion message - check for mixed results */}
            {isComplete && !hasErrors && (
                <div className="text-sm text-green-600 dark:text-green-400 bg-green-500/10 p-2 rounded">
                    {t('backup.progress.success_all', { count: successCount })}
                </div>
            )}

            {isComplete && hasErrors && (
                <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 p-2 rounded">
                    {t('backup.progress.success_mixed', { success: successCount, error: errorCount })}
                </div>
            )}

            {isCancelled && (
                <div className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 p-2 rounded">
                    {t('backup.progress.cancelled')}
                </div>
            )}

            {isError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 p-2 rounded">
                    {t('backup.progress.failed', { count: errorCount })}
                </div>
            )}
        </div>
    );
}
