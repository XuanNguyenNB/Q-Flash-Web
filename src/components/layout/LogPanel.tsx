/**
 * LogPanel Component
 * 
 * Right panel displaying terminal/console logs with color-coded entries.
 * Features: copy button for errors, filter by level, search, auto-scroll.
 * Part of the App Shell layout.
 */

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// Stores
import { useTerminalStore, type TerminalLogLevel, type TerminalFilterLevel, type TerminalLogEntry } from '@/stores/terminalStore';

// Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Icons
import { Trash2, Terminal, ChevronLeft, ChevronRight, Copy, Search, X, Filter } from 'lucide-react';

// Utils
import { cn } from '@/lib/utils';

/**
 * Color mapping for log levels
 */
const levelColors: Record<TerminalLogLevel, string> = {
    info: 'text-zinc-400',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    debug: 'text-purple-400',
};

/**
 * Filter level options for dropdown
 */
const FILTER_OPTIONS: { value: TerminalFilterLevel; labelKey: string }[] = [
    { value: 'all', labelKey: 'terminal.filter.all' },
    { value: 'info', labelKey: 'terminal.filter.info' },
    { value: 'success', labelKey: 'terminal.filter.success' },
    { value: 'warning', labelKey: 'terminal.filter.warning' },
    { value: 'error', labelKey: 'terminal.filter.error' },
];

/**
 * Format timestamp to [HH:mm:ss]
 */
function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

interface LogPanelProps {
    className?: string;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
    variant?: 'fixed' | 'static';
}

/**
 * LogPanel component displaying terminal logs with auto-scroll
 */
export function LogPanel({ className, collapsed = false, onToggleCollapse, variant = 'fixed' }: LogPanelProps) {
    const { t } = useTranslation();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Terminal store
    const logs = useTerminalStore((state) => state.logs);
    const clear = useTerminalStore((state) => state.clear);
    const filterLevel = useTerminalStore((state) => state.filterLevel);
    const searchQuery = useTerminalStore((state) => state.searchQuery);
    const setFilterLevel = useTerminalStore((state) => state.setFilterLevel);
    const setSearchQuery = useTerminalStore((state) => state.setSearchQuery);

    // Debounced search (simple implementation)
    const [localSearch, setLocalSearch] = useState('');
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Handle search input change with debounce
    const handleSearchChange = useCallback((value: string) => {
        setLocalSearch(value);
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            setSearchQuery(value);
        }, 200);
    }, [setSearchQuery]);

    // Clear search
    const handleClearSearch = useCallback(() => {
        setLocalSearch('');
        setSearchQuery('');
    }, [setSearchQuery]);

    // Filter and search logs
    const filteredLogs = useMemo(() => {
        let result = logs;

        // Filter by level
        if (filterLevel !== 'all') {
            result = result.filter(log => log.level === filterLevel);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(log =>
                log.message.toLowerCase().includes(query)
            );
        }

        return result;
    }, [logs, filterLevel, searchQuery]);

    // Count logs by level (for filter badges)
    const levelCounts = useMemo(() => {
        const counts: Record<TerminalFilterLevel, number> = {
            all: logs.length,
            info: 0,
            success: 0,
            warning: 0,
            error: 0,
            debug: 0,
        };
        logs.forEach(log => {
            counts[log.level]++;
        });
        return counts;
    }, [logs]);

    // Copy log entry to clipboard
    const handleCopy = useCallback(async (entry: TerminalLogEntry) => {
        const text = `[${formatTime(entry.timestamp)}] ${entry.message}`;
        try {
            await navigator.clipboard.writeText(text);
            toast.success(t('terminal.copied'));
        } catch {
            // Fallback for older browsers
            console.error('Failed to copy to clipboard');
        }
    }, [t]);

    // Auto-scroll to bottom when new logs are added
    useEffect(() => {
        if (scrollRef.current && !collapsed) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [filteredLogs, collapsed]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    const isFixed = variant === 'fixed';

    return (
        <>
            <aside
                className={cn(
                    isFixed
                        ? "fixed right-0 top-14 bottom-0 z-40 border-l border-border transition-all duration-300"
                        : "w-full h-full border rounded-md", // Default static styles
                    "flex flex-col bg-background",
                    isFixed && (collapsed ? "w-16" : "w-[320px]"),
                    className
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    {!collapsed && (
                        <>
                            <div className="flex items-center gap-2">
                                <Terminal className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">
                                    {t('terminal.title')}
                                </span>
                                {logs.length > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                        ({filteredLogs.length}{filterLevel !== 'all' || searchQuery ? `/${logs.length}` : ''})
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                    title={t('terminal.filter.all')}
                                    className={cn(
                                        "text-muted-foreground hover:text-foreground",
                                        (filterLevel !== 'all' || searchQuery) && "text-primary"
                                    )}
                                >
                                    <Filter className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={clear}
                                    title={t('terminal.clear')}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                {/* Filter & Search Bar */}
                {!collapsed && showFilters && (
                    <div className="px-3 py-2 border-b border-border space-y-2">
                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder={t('terminal.search.placeholder')}
                                value={localSearch}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="h-7 pl-7 pr-7 text-xs"
                            />
                            {localSearch && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        {/* Filter Buttons */}
                        <div className="flex flex-wrap gap-1">
                            {FILTER_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setFilterLevel(option.value)}
                                    className={cn(
                                        "px-2 py-0.5 text-xs rounded-md transition-colors",
                                        filterLevel === option.value
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted hover:bg-muted/80 text-muted-foreground",
                                        option.value !== 'all' && levelCounts[option.value] === 0 && "opacity-50"
                                    )}
                                >
                                    {t(option.labelKey)}
                                    {option.value !== 'all' && levelCounts[option.value] > 0 && (
                                        <span className="ml-1 opacity-70">({levelCounts[option.value]})</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Log Entries */}
                {!collapsed && (
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
                    >
                        {filteredLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
                                <Terminal className="h-8 w-8 mb-2" />
                                <span className="text-sm">
                                    {searchQuery || filterLevel !== 'all'
                                        ? t('terminal.search.noResults')
                                        : t('terminal.empty')
                                    }
                                </span>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredLogs.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className={cn(
                                            "flex gap-2 group relative",
                                            levelColors[entry.level]
                                        )}
                                    >
                                        <span className="text-zinc-500 shrink-0">
                                            [{formatTime(entry.timestamp)}]
                                        </span>
                                        <span className="break-all flex-1">
                                            {entry.message}
                                        </span>
                                        {/* Copy button for error logs */}
                                        {entry.level === 'error' && (
                                            <button
                                                onClick={() => handleCopy(entry)}
                                                className="opacity-0 group-hover:opacity-100 shrink-0 p-1 hover:bg-muted rounded transition-opacity"
                                                title={t('terminal.copy')}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Collapse Button */}
                <div className="p-2 border-t border-border">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "w-full justify-center text-muted-foreground hover:text-foreground",
                            collapsed && "p-2"
                        )}
                        onClick={onToggleCollapse}
                    >
                        {collapsed ? (
                            <ChevronLeft className="h-4 w-4" />
                        ) : (
                            <>
                                <ChevronRight className="h-4 w-4 mr-2" />
                                <span className="text-xs">{t('sidebar.collapse')}</span>
                            </>
                        )}
                    </Button>
                </div>
            </aside>

            {/* Expand Tab - Visual indicator when collapsed */}
            {collapsed && (
                <button
                    onClick={onToggleCollapse}
                    className="fixed right-16 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-6 h-16 bg-primary/10 hover:bg-primary/20 border border-r-0 border-border rounded-l-lg transition-all duration-200 group"
                    title={t('terminal.expand') || 'Expand console'}
                    aria-label="Expand console"
                >
                    <ChevronLeft className="h-4 w-4 text-primary group-hover:text-primary/80 transition-transform group-hover:-translate-x-0.5" />
                </button>
            )}
        </>
    );
}
