import { useTranslation } from 'react-i18next';
import { useADBStore } from '@/stores/adbStore';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalADBProgress() {
    const { t } = useTranslation();
    const pendingOperation = useADBStore((state) => state.pendingOperation);
    const operationProgress = useADBStore((state) => state.operationProgress);

    // Only show if there is an active operation AND it involves progress
    // Operations that typically have progress: 'uploading', 'downloading', 'installing'
    // Other operations like 'connecting' might just show a spinner without progress value.

    if (!pendingOperation) return null;

    // Define user-friendly loading text based on operation
    let label = '';
    let description = '';

    switch (pendingOperation) {
        case 'uploading':
            label = t('adb.files.uploading', 'Uploading File');
            description = t('adb.files.uploadingDesc', 'Please wait...');
            break;
        case 'downloading':
            label = t('adb.files.downloading', 'Downloading File');
            description = t('adb.files.downloadingDesc', 'Please wait...');
            break;
        case 'installing':
            label = t('adb.apps.installing', 'Installing APK');
            description = t('adb.apps.installingDesc', 'Creating session...');
            break;
        case 'uninstalling':
            label = t('adb.apps.uninstalling', 'Uninstalling Package');
            break;
        default:
            // Don't show overlay for quick/status ops unless they block UI?
            // Actually, only show if we have progress OR it's a long running known op
            if (operationProgress === null) return null;
            label = pendingOperation;
    }

    return (
        <div className="fixed bottom-6 right-6 z-[100] w-80 animate-in slide-in-from-bottom-5 fade-in duration-200">
            <Card className="p-4 shadow-xl border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="font-semibold text-sm">{label}</span>
                        </div>
                        {operationProgress !== null && (
                            <span className="text-xs font-mono text-muted-foreground">
                                {Math.round(operationProgress)}%
                            </span>
                        )}
                    </div>

                    {operationProgress !== null ? (
                        <Progress value={operationProgress} className="h-2 w-full transition-all" />
                    ) : (
                        <div className="h-1 w-full bg-primary/20 overflow-hidden rounded-full">
                            <div className="h-full bg-primary w-1/3 animate-running-bar rounded-full" />
                        </div>
                    )}

                    {description && (
                        <p className="text-xs text-muted-foreground truncate">{description}</p>
                    )}
                </div>
            </Card>
        </div>
    );
}
