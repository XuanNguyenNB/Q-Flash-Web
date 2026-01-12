/**
 * Sidebar Component
 *
 * Unified left sidebar with tabs: Device/Actions and Logs.
 * Combines previous Sidebar and LogPanel into a single panel.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableModelSelect } from '@/components/ui/searchable-model-select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DevicePanel } from '@/components/features/device/DevicePanel';
import { DeviceCard } from '@/components/features/device/DeviceCard';
import { ConnectionProgress } from '@/components/features/device/ConnectionProgress';
import { RomLoader } from '@/components/features/rom';
import { ADBConnectionStatus } from '@/components/features/adb';
import { FastbootConnectionStatus, FastbootDeviceInfo } from '@/components/features/fastboot';
import { ManualFirehosePopup } from '@/components/features/device/ManualFirehosePopup';
import { XMLBackupDialog } from '@/components/features/backup';
import { XMLFlashDialog } from '@/components/features/flash';

// Icons
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Zap,
    Trash2,
    Smartphone,
    Check,
    Terminal,
    Filter,
    Search,
    X,
    Copy,
    Settings,
} from 'lucide-react';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { usePartitionStore } from '@/stores/partitionStore';
import { useTerminalStore, type TerminalLogLevel, type TerminalFilterLevel, type TerminalLogEntry } from '@/stores/terminalStore';
import { useWorkflowStore } from '@/stores/workflowStore';

// Data
import { BRAND_OPTIONS } from '@/data/workflowPresets';

// Hooks
import { useWebUSB, useXMLBackup, useXMLFlash, useFirehose } from '@/hooks';

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

interface SidebarProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

/**
 * Sidebar component with tabs for Device/Actions and Logs
 */
export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
    const { t } = useTranslation();
    const { isConnected, currentMode } = useDeviceStore();
    const [showManualPopup, setShowManualPopup] = useState(false);
    const [showXMLBackupDialog, setShowXMLBackupDialog] = useState(false);
    const [showXMLFlashDialog, setShowXMLFlashDialog] = useState(false);
    const [activeTab, setActiveTab] = useState('device');

    // Hooks
    const { getManager } = useWebUSB();
    const { startXMLBackup } = useXMLBackup();
    const { startXMLFlash } = useXMLFlash();
    const { getInstance } = useFirehose();
    const partitions = usePartitionStore((state) => state.partitions);
    const isLoadingPartitions = usePartitionStore((state) => state.isLoading);
    const terminalLog = useTerminalStore((state) => state.log);

    // Terminal store for Logs tab
    const logs = useTerminalStore((state) => state.logs);
    const clearLogs = useTerminalStore((state) => state.clear);
    const filterLevel = useTerminalStore((state) => state.filterLevel);
    const searchQuery = useTerminalStore((state) => state.searchQuery);
    const setFilterLevel = useTerminalStore((state) => state.setFilterLevel);
    const setSearchQuery = useTerminalStore((state) => state.setSearchQuery);

    // Log panel state
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [localSearch, setLocalSearch] = useState('');
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Check if partitions are loaded
    const hasPartitions = partitions.length > 0;
    const canUseQuickActions = hasPartitions && !isLoadingPartitions;

    // FRP Remove state
    const [isRemovingFRP, setIsRemovingFRP] = useState(false);

    // Automation mode - device selection state
    const { deviceFilter, setDeviceFilter } = useWorkflowStore();
    const [tempBrand, setTempBrand] = useState<string>(deviceFilter.brand || '');
    const [tempModel, setTempModel] = useState<string>(deviceFilter.model || '');
    const [tempOS, setTempOS] = useState<string>(deviceFilter.osVersion || '');

    // Sync temp state with deviceFilter when it changes (e.g., from auto-detect)
    useEffect(() => {
        if (deviceFilter.brand && deviceFilter.brand !== tempBrand) {
            setTempBrand(deviceFilter.brand);
        }
        if (deviceFilter.model && deviceFilter.model !== 'auto' && deviceFilter.model !== tempModel) {
            setTempModel(deviceFilter.model);
        }
    }, [deviceFilter.brand, deviceFilter.model]);

    // Get selected brand/model data for dropdowns
    const selectedBrandData = BRAND_OPTIONS.find((b) => b.id === tempBrand);
    const models = selectedBrandData?.models || [];
    const selectedModelData = models.find((m) => m.id === tempModel);
    const osVersions = selectedModelData?.osVersions || [];

    const canConfirmDevice = tempBrand && tempModel && tempOS;
    const isDeviceConfirmed = deviceFilter.brand === tempBrand && deviceFilter.model === tempModel && deviceFilter.osVersion === tempOS && deviceFilter.brand !== '';

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
        if (filterLevel !== 'all') {
            result = result.filter(log => log.level === filterLevel);
        }
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(log => log.message.toLowerCase().includes(query));
        }
        return result;
    }, [logs, filterLevel, searchQuery]);

    // Count logs by level
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
            console.error('Failed to copy to clipboard');
        }
    }, [t]);

    // Auto-scroll to bottom when new logs are added
    useEffect(() => {
        if (scrollRef.current && !collapsed && activeTab === 'logs') {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [filteredLogs, collapsed, activeTab]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    const handleBrandChange = (brandId: string) => {
        setTempBrand(brandId);
        setTempModel('');
        setTempOS('');
    };

    const handleModelChange = (modelId: string) => {
        setTempModel(modelId);
        setTempOS('');
    };

    const handleConfirmDevice = () => {
        setDeviceFilter({
            brand: tempBrand,
            model: tempModel,
            osVersion: tempOS,
        });
    };

    // Handle XML Backup
    const handleXMLBackupConfirm = async (xmlFile: File, outputDir: FileSystemDirectoryHandle) => {
        const usbManager = getManager();
        if (usbManager) {
            await startXMLBackup(usbManager, xmlFile, outputDir);
        }
    };

    // Handle XML Flash
    const handleXMLFlashConfirm = async (xmlFile: File, imagesDir: FileSystemDirectoryHandle, selectedFilenames: string[]) => {
        const usbManager = getManager();
        if (usbManager) {
            await startXMLFlash(usbManager, xmlFile, imagesDir, selectedFilenames);
        }
    };

    // Handle Remove FRP
    const handleRemoveFRP = async () => {
        const usbManager = getManager();
        if (!usbManager) {
            terminalLog('error', 'USB not connected');
            return;
        }

        const frpPartition = partitions.find(p => p.name.toLowerCase() === 'frp');
        if (!frpPartition) {
            terminalLog('error', t('flash.frp.notFound'));
            return;
        }

        const confirmed = window.confirm(
            `${t('flash.frp.title')}\n\n` +
            `${t('flash.frp.description')}\n` +
            `${t('flash.frp.warning')}\n\n` +
            `${t('flash.frp.confirm')}`
        );
        if (!confirmed) return;

        setIsRemovingFRP(true);
        terminalLog('info', t('flash.frp.removing'));

        try {
            const firehose = getInstance(usbManager);
            const configResult = await firehose.configure();
            if (!configResult.success) {
                throw new Error('Failed to configure Firehose');
            }

            const frpSize = frpPartition.size || 512 * 1024;
            const emptyFrpData = new Uint8Array(frpSize);
            terminalLog('info', `Writing empty FRP data (${Math.ceil(frpSize / 1024)} KB)...`);

            const result = await firehose.writePartition(
                frpPartition.lun || 0,
                frpPartition.startSector,
                frpPartition.sizeInSectors || BigInt(Math.ceil(frpSize / 4096)),
                'frp',
                emptyFrpData
            );

            if (result.success) {
                terminalLog('success', t('flash.frp.success'));
            } else {
                throw new Error(result.error || 'Failed to write FRP partition');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            terminalLog('error', `${t('flash.frp.failed')}: ${errorMsg}`);
        } finally {
            setIsRemovingFRP(false);
        }
    };

    return (
        <>
            <aside
                className={cn(
                    "fixed left-0 top-14 bottom-0 z-40 flex flex-col border-r border-border bg-sidebar transition-all duration-300",
                    collapsed ? "w-16" : "w-[340px]"
                )}
            >
                {!collapsed && (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                        {/* Tab Headers */}
                        <div className="px-3 py-2 border-b border-border">
                            <TabsList className="w-full grid grid-cols-2 h-8">
                                <TabsTrigger value="device" className="text-xs gap-1.5">
                                    <Settings className="w-3.5 h-3.5" />
                                    Device
                                </TabsTrigger>
                                <TabsTrigger value="logs" className="text-xs gap-1.5">
                                    <Terminal className="w-3.5 h-3.5" />
                                    Logs
                                    {logs.length > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary/20 rounded-full">
                                            {logs.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Device Tab */}
                        <TabsContent value="device" className="flex-1 overflow-y-auto mt-0 data-[state=inactive]:hidden">
                            {/* Device Panel with Selector & Device Card */}
                            <div className="p-4 border-b border-border space-y-3">
                                {/* EDL Mode */}
                                {currentMode === 'edl' && (
                                    <>
                                        <DevicePanel />
                                        <DeviceCard />
                                        <ConnectionProgress className="mt-3" />
                                    </>
                                )}

                                {/* ADB Mode */}
                                {currentMode === 'adb' && (
                                    <ADBConnectionStatus variant="card" />
                                )}

                                {/* Fastboot Mode */}
                                {currentMode === 'fastboot' && (
                                    <>
                                        <FastbootConnectionStatus variant="card" />
                                        <FastbootDeviceInfo className="border-0 shadow-none p-0 bg-transparent" />
                                    </>
                                )}

                                {/* Automation Mode */}
                                {currentMode === 'automation' && (
                                    <>
                                        <ADBConnectionStatus variant="card" />
                                        <div className="space-y-3 mt-3">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <Smartphone className="w-3.5 h-3.5" />
                                                Chọn Thiết Bị
                                            </p>

                                            {/* Brand */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground">Hãng</label>
                                                <Select value={tempBrand} onValueChange={handleBrandChange}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Chọn hãng..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {BRAND_OPTIONS.map((brand) => (
                                                            <SelectItem key={brand.id} value={brand.id} className="text-xs">
                                                                {brand.icon} {brand.nameVi}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Model */}
                                            {tempBrand && (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-medium text-muted-foreground">Model</label>
                                                    <SearchableModelSelect
                                                        models={models}
                                                        value={tempModel}
                                                        onValueChange={handleModelChange}
                                                        placeholder="Chọn model..."
                                                        searchPlaceholder="Tìm model..."
                                                        emptyText="Không tìm thấy model."
                                                    />
                                                </div>
                                            )}

                                            {/* OS Version */}
                                            {tempModel && (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-medium text-muted-foreground">Hệ điều hành</label>
                                                    <Select value={tempOS} onValueChange={setTempOS}>
                                                        <SelectTrigger className="h-8 text-xs">
                                                            <SelectValue placeholder="Chọn OS..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {osVersions.map((os) => (
                                                                <SelectItem key={os.id} value={os.id} className="text-xs">
                                                                    {os.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}

                                            {/* Confirm Button */}
                                            <Button
                                                onClick={handleConfirmDevice}
                                                disabled={!canConfirmDevice}
                                                className={cn('w-full gap-1.5 h-8 text-xs', isDeviceConfirmed && 'bg-green-600 hover:bg-green-700')}
                                                size="sm"
                                            >
                                                {isDeviceConfirmed && <Check className="w-3 h-3" />}
                                                {isDeviceConfirmed ? 'Đã xác nhận' : 'Xác nhận'}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Quick Actions */}
                            {currentMode !== 'adb' && (
                                <div className="p-4">
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                            {t('sidebar.quickActions')}
                                        </p>

                                        {!isConnected && (
                                            <div className="text-sm text-muted-foreground/50 italic">
                                                {t('sidebar.connectFirst')}
                                            </div>
                                        )}

                                        {isConnected && currentMode === 'edl' && (
                                            <div className="space-y-2">
                                                <RomLoader compact disabled={!canUseQuickActions} />

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full justify-start gap-2"
                                                    onClick={() => setShowXMLBackupDialog(true)}
                                                    disabled={!canUseQuickActions}
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    {t('xml_backup.button')}
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full justify-start gap-2"
                                                    onClick={() => setShowXMLFlashDialog(true)}
                                                    disabled={!canUseQuickActions}
                                                >
                                                    <Zap className="w-4 h-4" />
                                                    {t('xml_flash.button')}
                                                </Button>

                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="w-full justify-start gap-2"
                                                    onClick={handleRemoveFRP}
                                                    disabled={!canUseQuickActions || isRemovingFRP}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    {isRemovingFRP ? 'Removing FRP...' : t('flash.removeFRP', 'Remove FRP')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Logs Tab */}
                        <TabsContent value="logs" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        ({filteredLogs.length}{filterLevel !== 'all' || searchQuery ? `/${logs.length}` : ''})
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => setShowFilters(!showFilters)}
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
                                        onClick={clearLogs}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Filter & Search */}
                            {showFilters && (
                                <div className="px-3 py-2 border-b border-border space-y-2">
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
                        </TabsContent>
                    </Tabs>
                )}

                {/* Collapsed State - Show icons only */}
                {collapsed && (
                    <div className="flex flex-col items-center py-4 gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "text-muted-foreground",
                                activeTab === 'device' && "bg-muted text-foreground"
                            )}
                            onClick={() => { setActiveTab('device'); onToggleCollapse?.(); }}
                        >
                            <Settings className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "text-muted-foreground relative",
                                activeTab === 'logs' && "bg-muted text-foreground"
                            )}
                            onClick={() => { setActiveTab('logs'); onToggleCollapse?.(); }}
                        >
                            <Terminal className="h-5 w-5" />
                            {logs.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                    {logs.length > 99 ? '99+' : logs.length}
                                </span>
                            )}
                        </Button>
                    </div>
                )}

                {/* Collapse Button */}
                <div className="mt-auto p-2 border-t border-border">
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
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <>
                                <ChevronLeft className="h-4 w-4 mr-2" />
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
                    className="fixed left-16 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-6 h-16 bg-primary/10 hover:bg-primary/20 border border-l-0 border-border rounded-r-lg transition-all duration-200 group"
                    title={t('sidebar.expand') || 'Expand sidebar'}
                    aria-label="Expand sidebar"
                >
                    <ChevronRight className="h-4 w-4 text-primary group-hover:text-primary/80 transition-transform group-hover:translate-x-0.5" />
                </button>
            )}

            {/* Dialogs */}
            <ManualFirehosePopup
                open={showManualPopup}
                onOpenChange={setShowManualPopup}
                onSubmit={(files) => {
                    console.log('Manual firehose loaded via sidebar:', files);
                    useDeviceStore.getState().setFirehoseLoaded(true);
                    setShowManualPopup(false);
                }}
                onSkip={() => setShowManualPopup(false)}
            />

            <XMLBackupDialog
                open={showXMLBackupDialog}
                onOpenChange={setShowXMLBackupDialog}
                onConfirm={handleXMLBackupConfirm}
            />

            <XMLFlashDialog
                open={showXMLFlashDialog}
                onOpenChange={setShowXMLFlashDialog}
                onConfirm={handleXMLFlashConfirm}
            />
        </>
    );
}
