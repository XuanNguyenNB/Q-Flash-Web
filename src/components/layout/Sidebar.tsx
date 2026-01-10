/**
 * Sidebar Component
 * 
 * Left sidebar with device selector, device card, and navigation items.
 * Part of the App Shell layout.
 * 
 * Updated: Story 2.4 - Integrated DeviceCard component
 * Updated: Story 4.6 - Added RomLoader component
 * Updated: Story X.X - Added XML Backup feature
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Components
import { Button } from '@/components/ui/button';
import { DevicePanel } from '@/components/features/device/DevicePanel';
import { DeviceCard } from '@/components/features/device/DeviceCard';
import { ConnectionProgress } from '@/components/features/device/ConnectionProgress';
import { RomLoader } from '@/components/features/rom';
import { ADBConnectionStatus, ADBQuickActions } from '@/components/features/adb';
import { FastbootConnectionStatus, FastbootDeviceInfo } from '@/components/features/fastboot';
import { ManualFirehosePopup } from '@/components/features/device/ManualFirehosePopup';
import { XMLBackupDialog } from '@/components/features/backup';
import { XMLFlashDialog } from '@/components/features/flash';

// Icons
import {
    ChevronLeft,
    ChevronRight,
    FileUp,
    FileText,
    Zap,
    Trash2,
} from 'lucide-react';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { usePartitionStore } from '@/stores/partitionStore';
import { useTerminalStore } from '@/stores/terminalStore';

// Hooks
import { useWebUSB, useXMLBackup, useXMLFlash, useFirehose } from '@/hooks';

// Utils
import { cn } from '@/lib/utils';

import { ADBAutoConnector } from '@/components/features/adb/ADBAutoConnector';

interface SidebarProps {
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

/**
 * Sidebar component with device selector, device card, ROM loader, and collapse functionality
 */
export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
    const { t } = useTranslation();
    const { isConnected, currentMode } = useDeviceStore();
    const [showManualPopup, setShowManualPopup] = useState(false);
    const [showXMLBackupDialog, setShowXMLBackupDialog] = useState(false);
    const [showXMLFlashDialog, setShowXMLFlashDialog] = useState(false);

    // Hooks
    const { getManager } = useWebUSB();
    const { startXMLBackup } = useXMLBackup();
    const { startXMLFlash } = useXMLFlash();
    const { getInstance } = useFirehose();
    const partitions = usePartitionStore((state) => state.partitions);
    const isLoadingPartitions = usePartitionStore((state) => state.isLoading);
    const log = useTerminalStore((state) => state.log);

    // Check if partitions are loaded
    const hasPartitions = partitions.length > 0;
    const canUseQuickActions = hasPartitions && !isLoadingPartitions;

    // FRP Remove state
    const [isRemovingFRP, setIsRemovingFRP] = useState(false);

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

    // Handle Remove FRP (Factory Reset Protection / Google Account)
    const handleRemoveFRP = async () => {
        const usbManager = getManager();
        if (!usbManager) {
            log('error', 'USB not connected');
            return;
        }

        // Find frp partition
        const frpPartition = partitions.find(p => p.name.toLowerCase() === 'frp');
        if (!frpPartition) {
            log('error', t('flash.frp.notFound'));
            return;
        }

        // Confirm with user using i18n
        const confirmed = window.confirm(
            `${t('flash.frp.title')}\n\n` +
            `${t('flash.frp.description')}\n` +
            `${t('flash.frp.warning')}\n\n` +
            `${t('flash.frp.confirm')}`
        );
        if (!confirmed) return;

        setIsRemovingFRP(true);
        log('info', t('flash.frp.removing'));

        try {
            const firehose = getInstance(usbManager);

            // Configure firehose
            const configResult = await firehose.configure();
            if (!configResult.success) {
                throw new Error('Failed to configure Firehose');
            }

            // Create empty FRP data (all zeros)
            // FRP partition is typically 512KB - 1MB
            const frpSize = frpPartition.size || 512 * 1024; // Default 512KB
            const emptyFrpData = new Uint8Array(frpSize);

            log('info', `Writing empty FRP data (${Math.ceil(frpSize / 1024)} KB)...`);

            // Write empty data to FRP partition
            const result = await firehose.writePartition(
                frpPartition.lun || 0,
                frpPartition.startSector,
                frpPartition.sizeInSectors || BigInt(Math.ceil(frpSize / 4096)),
                'frp',
                emptyFrpData
            );

            if (result.success) {
                log('success', t('flash.frp.success'));
            } else {
                throw new Error(result.error || 'Failed to write FRP partition');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log('error', `${t('flash.frp.failed')}: ${errorMsg}`);
        } finally {
            setIsRemovingFRP(false);
        }
    };

    return (
        <>
            <aside
                className={cn(
                    "fixed left-0 top-14 bottom-0 z-40 flex flex-col border-r border-border bg-sidebar transition-all duration-300",
                    collapsed ? "w-16" : "w-[260px]"
                )}
            >
                {/* Device Panel with Selector & Device Card */}
                <div className="p-4 border-b border-border space-y-3">
                    {/* EDL Mode */}
                    {currentMode === 'edl' && (
                        <>
                            {!collapsed && <DevicePanel />}
                            {!collapsed && <DeviceCard />}
                            {!collapsed && <ConnectionProgress className="mt-3" />}
                        </>
                    )}

                    {/* ADB Mode - Connection Card Only */}
                    {currentMode === 'adb' && (
                        <>
                            {!collapsed && <ADBConnectionStatus variant="card" />}
                        </>
                    )}

                    {/* Fastboot Mode */}
                    {currentMode === 'fastboot' && (
                        <>
                            {!collapsed && <FastbootConnectionStatus variant="card" />}
                            {!collapsed && <FastbootDeviceInfo className="border-0 shadow-none p-0 bg-transparent" />}
                        </>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="flex-1 p-4 overflow-y-auto">

                    {!collapsed && currentMode !== 'adb' && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                {t('sidebar.quickActions')}
                            </p>

                            {/* Show connect hint if not connected */}
                            {!isConnected && (
                                <div className="text-sm text-muted-foreground/50 italic">
                                    {t('sidebar.connectFirst')}
                                </div>
                            )}

                            {/* EDL Quick Actions */}
                            {isConnected && currentMode === 'edl' && (
                                <div className="space-y-2">
                                    {/* Flash Domestic ROM (RomLoader) */}
                                    <RomLoader compact disabled={!canUseQuickActions} />

                                    {/* Backup by XML Button */}
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

                                    {/* Flash by XML Button */}
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

                                    {/* Remove FRP Button */}
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
                    )}
                </div>

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

            {/* Manual Firehose Popup (Global for Sidebar) */}
            <ManualFirehosePopup
                open={showManualPopup}
                onOpenChange={setShowManualPopup}
                onSubmit={(files) => {
                    // TODO: Dispatch to firehose store/loader
                    console.log('Manual firehose loaded via sidebar:', files);
                    // We can assume success for UI purposes
                    useDeviceStore.getState().setFirehoseLoaded(true);
                    setShowManualPopup(false);
                }}
                onSkip={() => setShowManualPopup(false)}
            />

            {/* XML Backup Dialog */}
            <XMLBackupDialog
                open={showXMLBackupDialog}
                onOpenChange={setShowXMLBackupDialog}
                onConfirm={handleXMLBackupConfirm}
            />

            {/* XML Flash Dialog */}
            <XMLFlashDialog
                open={showXMLFlashDialog}
                onOpenChange={setShowXMLFlashDialog}
                onConfirm={handleXMLFlashConfirm}
            />
        </>
    );
}
