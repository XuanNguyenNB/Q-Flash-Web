/**
 * BrandGroupSelector Component
 * 
 * Allows users to select which brand group they want to use for EDL flashing.
 * - Oppo/OnePlus/Realme: Uses VIP authentication firehose
 * - LG: Uses dedicated LG firehose
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Smartphone, Zap } from 'lucide-react';

export type BrandGroup = 'oppo' | 'lg';

interface BrandGroupSelectorProps {
    selectedGroup: BrandGroup;
    onGroupChange: (group: BrandGroup) => void;
    disabled?: boolean;
}

interface BrandGroupOption {
    id: BrandGroup;
    titleKey: string;
    descKey: string;
    icon: typeof Smartphone;
    color: string;
    bgColor: string;
    borderColor: string;
}

const brandGroups: BrandGroupOption[] = [
    {
        id: 'oppo',
        titleKey: 'tool.edl.brandGroup.oppoGroup',
        descKey: 'tool.edl.brandGroup.oppoGroupDesc',
        icon: Smartphone,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
    },
    {
        id: 'lg',
        titleKey: 'tool.edl.brandGroup.lgGroup',
        descKey: 'tool.edl.brandGroup.lgGroupDesc',
        icon: Zap,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
    },
];

export function BrandGroupSelector({ selectedGroup, onGroupChange, disabled }: BrandGroupSelectorProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
                {t('tool.edl.brandGroup.title', 'Select Brand Group')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {brandGroups.map((group) => {
                    const Icon = group.icon;
                    const isSelected = selectedGroup === group.id;

                    return (
                        <button
                            key={group.id}
                            onClick={() => onGroupChange(group.id)}
                            disabled={disabled}
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                                "hover:scale-[1.02] active:scale-[0.98]",
                                isSelected
                                    ? `${group.borderColor} ${group.bgColor} ring-2 ring-offset-2 ring-offset-background`
                                    : "border-border bg-card hover:border-muted-foreground/30",
                                isSelected && group.id === 'oppo' && "ring-green-500/50",
                                isSelected && group.id === 'lg' && "ring-red-500/50",
                                disabled && "opacity-50 cursor-not-allowed hover:scale-100"
                            )}
                        >
                            <div className={cn(
                                "h-12 w-12 shrink-0 rounded-lg flex items-center justify-center",
                                isSelected ? group.bgColor : "bg-muted"
                            )}>
                                <Icon className={cn(
                                    "h-6 w-6",
                                    isSelected ? group.color : "text-muted-foreground"
                                )} />
                            </div>
                            <div className="text-left">
                                <p className={cn(
                                    "font-semibold",
                                    isSelected ? group.color : "text-foreground"
                                )}>
                                    {t(group.titleKey)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {t(group.descKey)}
                                </p>
                            </div>
                            {isSelected && (
                                <div className={cn(
                                    "ml-auto h-5 w-5 rounded-full flex items-center justify-center",
                                    group.bgColor
                                )}>
                                    <div className={cn(
                                        "h-2.5 w-2.5 rounded-full",
                                        group.id === 'oppo' ? "bg-green-500" : "bg-red-500"
                                    )} />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
