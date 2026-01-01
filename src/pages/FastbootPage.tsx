/**
 * Fastboot Page
 * 
 * Main page for Fastboot mode functionality.
 * Provides device connection, bootloader management, flash operations, and terminal.
 * 
 * Epic 8 - Fastboot Mode Features
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { useFastbootStore } from '@/stores/fastbootStore';

// Hooks
import { useFastboot } from '@/hooks/useFastboot';

// Components
import {
    BootloaderActions,
    FastbootFlashPanel,
    FastbootRebootActions,
    FastbootTerminal,
    FastbootConnectionGuide
} from '@/components/features/fastboot';
import { cn } from '@/lib/utils';

export default function FastbootPage() {
    const { t } = useTranslation();

    // Store state
    const { setConnected, setMode } = useDeviceStore();
    const { deviceInfo } = useFastbootStore();

    // Fastboot hook
    const { connect, getDeviceInfo, getInstance } = useFastboot();

    // Get actual Fastboot connection state from protocol (source of truth)
    const protocol = getInstance();

    // Use store state for reactive updates (deviceStore.isConnected is synced by useFastboot)
    const { isConnected } = useDeviceStore();

    // For initial check, also look at protocol
    const isFastbootConnected = isConnected || protocol.isConnected;

    // Ensure we are in Fastboot mode when this page loads
    useEffect(() => {
        setMode('fastboot');
        document.title = "Q-Flash - Fastboot Mode";
    }, [setMode]);

    // Listen for USB disconnect events to update state in real-time
    useEffect(() => {
        const handleDisconnect = (event: USBConnectionEvent) => {
            console.log('[FastbootPage] USB device disconnected:', event.device);
            // Check if it was our Fastboot device
            const device = event.device;
            for (const config of device.configurations) {
                for (const iface of config.interfaces) {
                    for (const alt of iface.alternates) {
                        if (alt.interfaceClass === 255 &&
                            alt.interfaceSubclass === 66 &&
                            alt.interfaceProtocol === 3) {
                            // It's a Fastboot device - reset state
                            console.log('[FastbootPage] Fastboot device disconnected, resetting state');
                            setConnected(false);
                            useFastbootStore.getState().reset();
                            return;
                        }
                    }
                }
            }
        };

        navigator.usb.addEventListener('disconnect', handleDisconnect);
        return () => {
            navigator.usb.removeEventListener('disconnect', handleDisconnect);
        };
    }, [setConnected]);

    // Sync store with Fastboot protocol state when on this page
    useEffect(() => {
        if (protocol.isConnected && !isConnected) {
            console.log('[FastbootPage] Fastboot is connected, syncing store');
            setConnected(true);
        }
    }, [protocol.isConnected, isConnected, setConnected]);


    // Auto-connect on page load if Fastboot device is available
    useEffect(() => {
        // Skip if already connected (check both store and protocol)
        const protocol = getInstance();
        if (isFastbootConnected) {
            console.log('[FastbootPage] Already connected, skipping auto-connect');
            return;
        }

        const tryAutoConnect = async () => {
            // Small delay to let other components settle and avoid race conditions
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check again after delay
            if (isFastbootConnected) return;

            try {
                // Check if there are any previously paired Fastboot devices
                const devices = await navigator.usb.getDevices();

                // Check for Fastboot device (protocol 3)
                for (const device of devices) {
                    for (const config of device.configurations) {
                        for (const iface of config.interfaces) {
                            for (const alt of iface.alternates) {
                                if (alt.interfaceClass === 255 &&
                                    alt.interfaceSubclass === 66 &&
                                    alt.interfaceProtocol === 3) {
                                    // Found Fastboot device, try to connect
                                    console.log('[FastbootPage] Auto-connecting to Fastboot device...');
                                    const success = await connect();
                                    if (success) {
                                        // Explicitly fetch device info after connect
                                        console.log('[FastbootPage] Fetching device info...');
                                        await getDeviceInfo();
                                    }
                                    return;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.debug('[FastbootPage] Auto-connect check failed:', error);
            }
        };

        tryAutoConnect();
    }, [connect, getDeviceInfo, isFastbootConnected]);

    // Fallback: If connected but no deviceInfo, try to fetch it (only once)
    const hasTriedFallbackFetch = useRef(false);
    useEffect(() => {
        if (isFastbootConnected && !deviceInfo && !hasTriedFallbackFetch.current) {
            hasTriedFallbackFetch.current = true;
            console.log('[FastbootPage] Connected but no deviceInfo, fetching...');
            getDeviceInfo();
        }
        // Reset when disconnected
        if (!isFastbootConnected) {
            hasTriedFallbackFetch.current = false;
        }
    }, [isFastbootConnected, deviceInfo, getDeviceInfo]);

    return (
        <div className="h-full flex flex-col max-w-6xl mx-auto p-6 animate-in fade-in duration-500">
            {/* Compact Hero Section */}
            <div className="flex items-center gap-4 mb-6">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 flex items-center justify-center shadow-sm ring-1 ring-orange-500/20">
                    <Wrench className="h-7 w-7 text-orange-500" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {t('fastboot.title', 'Fastboot Mode')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('fastboot.description', 'Flash partitions, manage bootloader, and perform low-level device operations')}
                    </p>
                    {deviceInfo?.isUserspace && (
                        <p className="text-sm font-medium text-blue-500 mt-1 flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            {t('fastboot.fastbootdHeaderDesc', 'Device is in FastbootD Userspace mode. Logical partitions are accessible.')}
                        </p>
                    )}
                </div>
            </div>

            {/* Main Grid */}
            <div className={cn(
                "flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min transition-all duration-500",
                !isFastbootConnected ? "opacity-50 pointer-events-none grayscale-[0.5]" : ""
            )}>
                {/* Row 1: Bootloader Actions + Reboot Options */}
                <BootloaderActions />
                <FastbootRebootActions />

                {/* Conditional Visibility: Hide Flash & Terminal if FastbootD + Locked */}
                {!(deviceInfo?.isUserspace && !deviceInfo?.unlocked) && (
                    <>
                        {/* Row 2: Flash Panel (full width when terminal is below) */}
                        <FastbootFlashPanel className="md:col-span-2" />

                        {/* Row 3: Terminal (full width) */}
                        <FastbootTerminal className="md:col-span-2" />
                    </>
                )}
            </div>

            {/* Connection Guide (if disconnected) or Disconnect button (if connected) */}
            <FastbootConnectionGuide
                onConnect={connect}
                isConnected={isFastbootConnected}
            />
        </div>
    );
}
