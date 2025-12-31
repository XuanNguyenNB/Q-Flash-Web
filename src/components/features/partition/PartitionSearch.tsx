/**
 * PartitionSearch Component
 * 
 * Search and filter component for partition list.
 * Features debounced search input with clear button and filtered count display.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePartitionStore } from '@/stores/partitionStore';
import { cn } from '@/lib/utils';

interface PartitionSearchProps {
    totalCount: number;
    filteredCount: number;
    className?: string;
}

export function PartitionSearch({ totalCount, filteredCount, className }: PartitionSearchProps) {
    // Hooks
    const { t } = useTranslation();
    const { searchFilter, setSearchFilter, clearSearchFilter } = usePartitionStore();

    // Handlers
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchFilter(e.target.value);
    }, [setSearchFilter]);

    const handleClear = useCallback(() => {
        clearSearchFilter();
    }, [clearSearchFilter]);

    return (
        <div className={cn('flex items-center gap-3', className)}>
            {/* Search input with icons */}
            <div className="relative flex-1 min-w-[200px] max-w-[400px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                    type="text"
                    placeholder={t('partition.search.placeholder')}
                    value={searchFilter}
                    onChange={handleChange}
                    className="pl-9 pr-9"
                    aria-label={t('partition.search.placeholder')}
                />
                {searchFilter && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={t('partition.search.clear')}
                        type="button"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Filtered count display */}
            <span className="text-sm text-muted-foreground whitespace-nowrap">
                {t('partition.search.count', { filtered: filteredCount, total: totalCount })}
            </span>
        </div>
    );
}
