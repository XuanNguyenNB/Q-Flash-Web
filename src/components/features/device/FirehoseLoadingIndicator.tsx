/**
 * FirehoseLoadingIndicator Component
 * 
 * Displays loading progress when firehose files are being fetched.
 * Shows spinner, file names being loaded, and success/error states.
 * 
 * @story 2-3-auto-detect-firehose-by-chipset
 */

import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FirehoseLoaderStatus, FirehoseProgress } from '@/hooks/useFirehoseLoader';

interface FirehoseLoadingIndicatorProps {
    /** Current loading status */
    status: FirehoseLoaderStatus;
    /** Loading progress details */
    progress: FirehoseProgress;
    /** Error message if loading failed */
    error?: string | null;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Loading indicator for firehose file downloads.
 * 
 * States:
 * - idle: Hidden
 * - loading: Shows spinner with current file name
 * - success: Shows checkmark with success message
 * - error: Shows error icon with message
 */
export function FirehoseLoadingIndicator({
    status,
    progress,
    error,
    className,
}: FirehoseLoadingIndicatorProps) {
    const { t } = useTranslation();

    // Don't show anything when idle
    if (status === 'idle') {
        return null;
    }

    return (
        <div
            className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                status === 'loading' && 'bg-blue-500/10 text-blue-400',
                status === 'success' && 'bg-green-500/10 text-green-400',
                status === 'error' && 'bg-red-500/10 text-red-400',
                className
            )}
        >
            {/* Icon */}
            {status === 'loading' && (
                <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {status === 'success' && (
                <CheckCircle2 className="h-4 w-4" />
            )}
            {status === 'error' && (
                <XCircle className="h-4 w-4" />
            )}

            {/* Message */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                {status === 'loading' && (
                    <>
                        <span className="font-medium">
                            {t('firehose.loading', 'Loading firehose...')}
                        </span>
                        {progress.currentFile && (
                            <span className="text-xs opacity-70 flex items-center gap-1">
                                <Download className="h-3 w-3" />
                                {progress.currentFile}
                            </span>
                        )}
                    </>
                )}

                {status === 'success' && (
                    <span className="font-medium">
                        {t('firehose.success', 'Firehose loaded')}
                    </span>
                )}

                {status === 'error' && (
                    <>
                        <span className="font-medium">
                            {t('firehose.error.title', 'Failed to load')}
                        </span>
                        {error && (
                            <span className="text-xs opacity-70 truncate">
                                {error}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Progress indicator */}
            {status === 'loading' && (
                <span className="text-xs font-mono opacity-70">
                    {progress.loaded}/{progress.total}
                </span>
            )}
        </div>
    );
}
