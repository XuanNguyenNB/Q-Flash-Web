import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatBytes } from '@/lib/utils';
import type { PartitionInfo } from '@/types';

export interface BackupOptions {
    includeGptBackup: boolean;
}

interface BackupConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    partitions: PartitionInfo[];
    onConfirm: (directoryHandle: FileSystemDirectoryHandle, options: BackupOptions) => void;
}

export function BackupConfirmDialog({
    open,
    onOpenChange,
    partitions,
    onConfirm,
}: BackupConfirmDialogProps) {
    const { t } = useTranslation();
    const [isSelecting, setIsSelecting] = useState(false);
    const [includeGptBackup, setIncludeGptBackup] = useState(false);

    // Calculate total backup size - use pre-calculated size from PartitionInfo
    const totalSize = partitions.reduce((sum, p) => {
        // size is already calculated correctly by FirehoseProtocol with proper sector size
        return sum + p.size;
    }, 0);

    const handleChooseLocation = async () => {
        setIsSelecting(true);
        try {
            // Use File System Access API to select directory
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'downloads',
            });

            // Call onConfirm with the directory handle and options
            onConfirm(dirHandle, { includeGptBackup });
            onOpenChange(false);
        } catch (error: any) {
            // User cancelled the picker
            if (error.name === 'AbortError') {
                console.log('User cancelled directory selection');
                return;
            }

            // Permission denied or other errors
            console.error('Failed to select directory:', error);

            // Show error to user (will be handled by parent component)
            if (error.name === 'NotAllowedError') {
                // Permission error will be shown via toast in parent
            }
        } finally {
            setIsSelecting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t('backup.confirm.title')}</DialogTitle>
                    <DialogDescription>
                        {t('backup.confirm.message', { count: partitions.length })}
                    </DialogDescription>
                </DialogHeader>

                {/* Partition list */}
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3 bg-muted/30">
                    {partitions.map((partition) => (
                        <div
                            key={partition.name}
                            className="flex justify-between items-center text-sm py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                        >
                            <span className="font-medium">{partition.name}</span>
                            <span className="text-muted-foreground tabular-nums">
                                {formatBytes(partition.size)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Total size */}
                <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm font-semibold">
                        {t('backup.confirm.totalSize', { size: formatBytes(totalSize) })}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                        {partitions.length} {partitions.length === 1 ? 'partition' : 'partitions'}
                    </span>
                </div>

                {/* GPT Backup Option */}
                <div className="flex items-start space-x-3 pt-2 border-t">
                    <Checkbox
                        id="gpt-backup"
                        checked={includeGptBackup}
                        onCheckedChange={(checked) => setIncludeGptBackup(checked === true)}
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label
                            htmlFor="gpt-backup"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                            {t('backup.includeGpt', 'Include GPT & XML (for full restore)')}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            {t('backup.includeGptDesc', 'Creates rawprogram.xml, patch.xml and gpt_*.bin files')}
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSelecting}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleChooseLocation}
                        disabled={isSelecting}
                        className="gap-2"
                    >
                        {isSelecting ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                {t('backup.confirm.selecting')}
                            </>
                        ) : (
                            t('backup.confirm.chooseLocation')
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

