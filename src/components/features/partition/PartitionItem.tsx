/**
 * PartitionItem Component
 * 
 * Displays a single partition with checkbox, name, size, and warning icon for dangerous partitions.
 */

import { useCallback } from 'react';
import { AlertTriangle, Fingerprint } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { usePartitionStore } from '@/stores/partitionStore';
import { isDangerousPartition, isFrpPartition, formatPartitionSize } from '@/lib/partition-utils';
import { cn } from '@/lib/utils';
import type { PartitionInfo } from '@/types';

interface PartitionItemProps {
    partition: PartitionInfo;
    className?: string;
}

export function PartitionItem({ partition, className }: PartitionItemProps) {
    // Hooks
    const { t } = useTranslation();
    const { selectedPartitions, toggleSelection } = usePartitionStore();

    // Derived state
    const isSelected = selectedPartitions.has(partition.name);
    const isDangerous = isDangerousPartition(partition.name);
    const isFrp = isFrpPartition(partition.name);

    // Use pre-calculated size from PartitionInfo (correctly calculated by FirehoseProtocol with actual sector size)
    const formattedSize = formatPartitionSize(partition.size);

    // Handlers
    const handleToggle = useCallback(() => {
        toggleSelection(partition.name);
    }, [partition.name, toggleSelection]);

    return (
        <div
            className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                'hover:bg-accent/50',
                isSelected && 'bg-accent border-primary',
                !isSelected && 'border-border',
                isFrp && !isSelected && 'border-cyan-500/50 bg-cyan-500/5',
                isFrp && isSelected && 'border-cyan-500 bg-cyan-500/20',
                className
            )}
        >
            <Checkbox
                checked={isSelected}
                onCheckedChange={handleToggle}
                aria-label={t('partition.item.select', { name: partition.name })}
            />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        'font-medium text-sm truncate',
                        isFrp && 'text-cyan-500'
                    )}>
                        {partition.name}
                    </span>
                    {isFrp && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-500 font-medium">
                            <Fingerprint className="w-3 h-3" />
                            FRP
                        </span>
                    )}
                    {isDangerous && !isFrp && (
                        <AlertTriangle
                            className="w-4 h-4 text-amber-500 flex-shrink-0"
                            aria-label={t('partition.item.dangerous')}
                        />
                    )}
                </div>
                <div className="text-xs text-muted-foreground">
                    {formattedSize}
                </div>
            </div>
        </div>
    );
}
