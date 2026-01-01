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
} from 'lucide-react';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';

// Hooks
import { useWebUSB, useXMLBackup, useXMLFlash } from '@/hooks';

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

                {/* ROM Loader - Shows when connected (EDL only) */}
                {!collapsed && isConnected && currentMode === 'edl' && (
                    <div className="p-4 border-b border-border">
                        <RomLoader compact />
                    </div>
                )}

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
                                    {/* Backup by XML Button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start gap-2"
                                        onClick={() => setShowXMLBackupDialog(true)}
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
                                    >
                                        <Zap className="w-4 h-4" />
                                        {t('xml_flash.button')}
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
