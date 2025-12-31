/**
 * MissingFilesWarning Component
 *
 * Displays a collapsible warning for missing ROM files.
 * Shows count badge and tooltip with file names.
 *
 * Story: 4.6 - ROM File Loading
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Components
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

// Icons
import {
    AlertTriangle,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

// Utils
import { cn } from '@/lib/utils';

interface MissingFilesWarningProps {
    missingFiles: string[];
    compact?: boolean;
    className?: string;
    onRescan?: () => void;
}

/**
 * Warning component for missing ROM files
 */
export function MissingFilesWarning({
    missingFiles,
    compact = false,
    className,
    onRescan,
}: MissingFilesWarningProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    if (missingFiles.length === 0) {
        return null;
    }

    // Compact mode - just icon with tooltip
    if (compact) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className={cn(
                            'inline-flex items-center gap-1 text-warning cursor-help',
                            className
                        )}>
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-xs">{missingFiles.length}</span>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                        <p className="font-medium mb-1">
                            {t('rom.missingFiles', { count: missingFiles.length })}
                        </p>
                        <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
                            {missingFiles.slice(0, 10).map((file, i) => (
                                <li key={i} className="text-muted-foreground truncate">
                                    • {file}
                                </li>
                            ))}
                            {missingFiles.length > 10 && (
                                <li className="text-muted-foreground italic">
                                    ... and {missingFiles.length - 10} more
                                </li>
                            )}
                        </ul>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Full mode - collapsible list
    return (
        <div className={cn('rounded-md bg-warning/10 border border-warning/30', className)}>
            {/* Header */}
            <button
                className="w-full flex items-center justify-between p-2 text-left hover:bg-warning/5 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium">
                        {t('rom.missingFiles', { count: missingFiles.length })}
                    </span>
                </div>
                {expanded ? (
                    <ChevronUp className="h-4 w-4 text-warning/70" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-warning/70" />
                )}
            </button>

            {/* Expanded content */}
            {expanded && (
                <div className="px-2 pb-2 space-y-2">
                    <ul className="text-xs space-y-0.5 max-h-32 overflow-y-auto pl-6">
                        {missingFiles.map((file, i) => (
                            <li key={i} className="text-warning/80 truncate" title={file}>
                                • {file}
                            </li>
                        ))}
                    </ul>

                    {onRescan && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-7 text-xs text-warning hover:text-warning hover:bg-warning/10"
                            onClick={onRescan}
                        >
                            {t('rom.rescan') || 'Re-scan folder'}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
