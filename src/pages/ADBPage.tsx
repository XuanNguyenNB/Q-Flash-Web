/**
 * ADB Page
 * 
 * Main page for ADB Mode features.
 * Refactored to use a Tabbed Interface as per user redesign request.
 */

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// Components
import { ADBDeviceInfo, ADBQuickActions, ADBGuidePanel, ADBTerminal, ScrcpyPanel } from '@/components/features/adb';
import { ADBAppManager } from '@/components/features/adb/ADBAppManager';
import { ADBFileManager } from '@/components/features/adb/ADBFileManager';
import { GlobalADBProgress } from '@/components/features/adb/GlobalADBProgress';

// UI
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, AppWindow, FolderOpen, Terminal } from "lucide-react";

// Utils
import { useDeviceStore } from '@/stores/deviceStore';
import { useADB } from '@/hooks/useADB';

export function ADBPage() {
    const { t } = useTranslation();
    const { setMode, setConnected } = useDeviceStore();
    const [activeTab, setActiveTab] = useState("quick-view");

    // Ensure we are in ADB mode when this page loads
    useEffect(() => {
        setMode('adb');
        document.title = "Q-Flash - ADB Mode";
    }, [setMode]);

    // ADB hook with getDeviceInfo
    const { connect, getDeviceInfo, deviceInfo, getInstance } = useADB();

    // Get actual ADB connection state from protocol (source of truth)
    const protocol = getInstance();
    const isADBConnected = protocol.isConnected;

    // Sync store with ADB protocol state when on this page
    useEffect(() => {
        if (isADBConnected) {
            console.log('[ADBPage] ADB is connected, syncing store');
            setConnected(true);
        }
    }, [isADBConnected, setConnected]);

    // Auto-connect on page load if ADB device is available
    useEffect(() => {
        // Skip if already connected (check both store and protocol)
        const protocol = getInstance();
        if (isADBConnected) {
            console.log('[ADBPage] Already connected, skipping auto-connect');
            return;
        }

        const tryAutoConnect = async () => {
            // Small delay to let other components settle and avoid race conditions
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check again after delay
            const proto = getInstance();
            if (isADBConnected) return;

            try {
                // Check if there are any previously paired ADB devices
                const devices = await navigator.usb.getDevices();

                // Check for ADB device (protocol 1)
                for (const device of devices) {
                    for (const config of device.configurations) {
                        for (const iface of config.interfaces) {
                            for (const alt of iface.alternates) {
                                if (alt.interfaceClass === 255 &&
                                    alt.interfaceSubclass === 66 &&
                                    alt.interfaceProtocol === 1) {
                                    // Found ADB device, try to connect
                                    console.log('[ADBPage] Auto-connecting to ADB device...');
                                    const success = await connect();
                                    if (success) {
                                        console.log('[ADBPage] Fetching device info...');
                                        await getDeviceInfo();
                                    }
                                    return;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.debug('[ADBPage] Auto-connect check failed:', error);
            }
        };

        tryAutoConnect();
    }, [connect, getDeviceInfo, isADBConnected]);

    // Fallback: If connected but no deviceInfo, try to fetch it (only once)
    const hasTriedFallbackFetch = useRef(false);
    useEffect(() => {
        if (isADBConnected && !deviceInfo && !hasTriedFallbackFetch.current) {
            hasTriedFallbackFetch.current = true;
            console.log('[ADBPage] Connected but no deviceInfo, fetching...');
            getDeviceInfo();
        }
        // Reset when disconnected
        if (!isADBConnected) {
            hasTriedFallbackFetch.current = false;
        }
    }, [isADBConnected, deviceInfo, getDeviceInfo]);

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {/* Content Area */}

                {/* Content Area */}
                <div className="flex-1">
                    {isADBConnected ? (
                        /* Connected View - Tabbed Interface */
                        <Tabs defaultValue="quick-view" value={activeTab} onValueChange={setActiveTab} className="w-full">

                            {/* Navigation Bar */}
                            <div className="flex justify-center mb-6">
                                <TabsList className="grid w-full max-w-2xl grid-cols-4 h-11 bg-muted/50 p-1">
                                    <TabsTrigger value="quick-view" className="text-sm gap-2">
                                        <LayoutDashboard className="w-4 h-4" />
                                        {t('adb.tabs.quickView', 'Quick View')}
                                    </TabsTrigger>
                                    <TabsTrigger value="app-manager" className="text-sm gap-2">
                                        <AppWindow className="w-4 h-4" />
                                        {t('adb.tabs.appManager', 'App Manager')}
                                    </TabsTrigger>
                                    <TabsTrigger value="file-manager" className="text-sm gap-2">
                                        <FolderOpen className="w-4 h-4" />
                                        {t('adb.tabs.fileManager', 'File Manager')}
                                    </TabsTrigger>
                                    <TabsTrigger value="terminal" className="text-sm gap-2">
                                        <Terminal className="w-4 h-4" />
                                        {t('adb.tabs.terminal', 'Terminal')}
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* 1. Quick View Tab */}
                            <TabsContent value="quick-view" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Left Column (1/3): Quick Actions + Device Info */}
                                    <div className="lg:col-span-1 flex flex-col gap-6 h-full">
                                        <div className="flex-none">
                                            <ADBDeviceInfo className="h-auto" />
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <ADBQuickActions className="h-full" />
                                        </div>
                                    </div>

                                    {/* Right Column (2/3): View Screen (Scrcpy) */}
                                    <div className="lg:col-span-2 h-[600px] lg:h-auto min-h-[600px]">
                                        <ScrcpyPanel className="h-full" />
                                    </div>
                                </div>
                            </TabsContent>

                            {/* 2. App Manager Tab */}
                            <TabsContent value="app-manager" className="h-[600px]">
                                <ADBAppManager />
                            </TabsContent>

                            {/* 3. File Manager Tab */}
                            <TabsContent value="file-manager" className="h-[600px]">
                                <ADBFileManager />
                            </TabsContent>

                            {/* 4. Terminal Tab */}
                            <TabsContent value="terminal" className="h-[600px]">
                                <div className="h-full flex flex-col">
                                    <ADBTerminal />
                                </div>
                            </TabsContent>

                        </Tabs>
                    ) : (
                        /* Disconnected View (Guide Mode) */
                        <div className="grid grid-cols-1 gap-6 h-full mt-6">
                            <ADBGuidePanel />
                        </div>
                    )}
                </div>
            </div>

            {/* Global Progress Overlay */}
            <GlobalADBProgress />
        </div>
    );
}
