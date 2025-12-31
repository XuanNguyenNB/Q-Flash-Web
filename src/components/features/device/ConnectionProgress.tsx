/**
 * ConnectionProgress Component
 * 
 * Visual progress indicator for EDL connection flow.
 * Shows step-by-step progress with animated indicators.
 * 
 * Story: Connection Flow Progress Visualization
 */

import { useTranslation } from 'react-i18next';
import { Check, Loader2, Circle, Zap, Upload, Shield, HardDrive, Settings } from 'lucide-react';
import { useConnectionFlow, type ConnectionFlowState } from '@/hooks/useConnectionFlow';
import { cn } from '@/lib/utils';

interface ConnectionProgressProps {
    className?: string;
    compact?: boolean;
}

interface Step {
    id: ConnectionFlowState;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

/**
 * Get step status based on current flow state
 */
function getStepStatus(stepId: ConnectionFlowState, currentStatus: ConnectionFlowState): 'pending' | 'active' | 'complete' | 'error' {
    const stepOrder: ConnectionFlowState[] = [
        'connecting',
        'sahara',
        'uploading', // Actually used for Firehose configure
        'authenticating',
        'reading-partitions',
        'connected'
    ];

    const currentIndex = stepOrder.indexOf(currentStatus);
    const stepIndex = stepOrder.indexOf(stepId);

    if (currentStatus === 'error') {
        // Mark steps up to error point
        if (stepIndex < currentIndex) return 'complete';
        if (stepIndex === currentIndex) return 'error';
        return 'pending';
    }

    if (currentStatus === 'idle') return 'pending';
    if (currentStatus === 'connected') return 'complete';

    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
}

/**
 * Calculate overall progress percentage
 */
function getProgressPercent(status: ConnectionFlowState): number {
    switch (status) {
        case 'idle': return 0;
        case 'connecting': return 10;
        case 'sahara': return 25;
        case 'uploading': return 50;
        case 'authenticating': return 65;
        case 'reading-partitions': return 80;
        case 'connected': return 100;
        case 'error': return 0;
        default: return 0;
    }
}

/**
 * ConnectionProgress - Visual step-by-step progress for EDL connection
 */
export function ConnectionProgress({ className, compact = false }: ConnectionProgressProps) {
    const { t } = useTranslation();
    const { status } = useConnectionFlow();

    const steps: Step[] = [
        { id: 'connecting', label: t('connection.step.usb', 'USB Connect'), icon: Zap },
        { id: 'sahara', label: t('connection.step.sahara', 'Sahara Handshake'), icon: Upload },
        { id: 'uploading', label: t('connection.step.firehose', 'Firehose Setup'), icon: Settings },
        { id: 'authenticating', label: t('connection.step.auth', 'VIP Auth'), icon: Shield },
        { id: 'reading-partitions', label: t('connection.step.partitions', 'Read Partitions'), icon: HardDrive },
    ];

    const progress = getProgressPercent(status);
    const isActive = status !== 'idle' && status !== 'connected' && status !== 'error';

    // Don't render if idle or connected
    if (status === 'idle' || status === 'connected') {
        return null;
    }

    if (compact) {
        // Compact mode - just progress bar with percentage
        return (
            <div className={cn("space-y-2", className)}>
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                        {t('connection.progress', 'Connecting...')}
                    </span>
                    <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-500 ease-out",
                            status === 'error' ? "bg-destructive" : "bg-primary"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        );
    }

    // Full mode - step-by-step with icons
    return (
        <div className={cn("space-y-4", className)}>
            {/* Progress Bar */}
            <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">
                        {t('connection.flowProgress', 'Connection Progress')}
                    </span>
                    <span className="font-bold text-primary">{progress}%</span>
                </div>
                <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden shadow-inner">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-700 ease-out",
                            status === 'error'
                                ? "bg-gradient-to-r from-destructive/80 to-destructive"
                                : "bg-gradient-to-r from-primary/80 to-primary"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-5 gap-1">
                {steps.map((step) => {
                    const stepStatus = getStepStatus(step.id, status);
                    const Icon = step.icon;

                    return (
                        <div
                            key={step.id}
                            className="flex flex-col items-center gap-1.5"
                        >
                            {/* Icon Circle */}
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                                stepStatus === 'complete' && "bg-green-500/20 text-green-500 ring-2 ring-green-500/30",
                                stepStatus === 'active' && "bg-primary/20 text-primary ring-2 ring-primary/50 animate-pulse",
                                stepStatus === 'pending' && "bg-muted text-muted-foreground",
                                stepStatus === 'error' && "bg-destructive/20 text-destructive ring-2 ring-destructive/30"
                            )}>
                                {stepStatus === 'complete' ? (
                                    <Check className="w-4 h-4" />
                                ) : stepStatus === 'active' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Icon className="w-4 h-4" />
                                )}
                            </div>

                            {/* Label */}
                            <span className={cn(
                                "text-[10px] text-center leading-tight font-medium",
                                stepStatus === 'complete' && "text-green-500",
                                stepStatus === 'active' && "text-primary",
                                stepStatus === 'pending' && "text-muted-foreground",
                                stepStatus === 'error' && "text-destructive"
                            )}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Current Status Text */}
            {isActive && (
                <div className="text-center text-xs text-muted-foreground animate-pulse">
                    {status === 'connecting' && t('connection.flow.connecting', 'Connecting to USB device...')}
                    {status === 'sahara' && t('connection.flow.sahara', 'Uploading programmer...')}
                    {status === 'uploading' && t('connection.flow.firehose', 'Configuring Firehose protocol...')}
                    {status === 'authenticating' && t('connection.flow.auth', 'Authenticating with OEM server...')}
                    {status === 'reading-partitions' && t('connection.flow.reading', 'Reading partition table...')}
                </div>
            )}
        </div>
    );
}
