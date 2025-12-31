/**
 * ADB Auto Connector
 * 
 * Global component that handles:
 * 1. Auto-reconnection on page load (F5)
 * 2. USB Hotplug events (Plug/Unplug)
 * 
 * This must be mounted EXACTLY ONCE in the application (e.g. in Sidebar or App Layout)
 * to avoid duplicate event listeners and race conditions.
 */

import { useEffect, useRef } from 'react';
import { useADBStore } from '@/stores/adbStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { ADBProtocol } from '@/core/ADBProtocol';

export function ADBAutoConnector() {
    // Store access
    const { setDeviceInfo, setConnecting, setPendingOperation } = useADBStore();
    const { setConnected } = useDeviceStore();
    const addLog = useTerminalStore((state) => state.log);

    // Refs for locking
    const connectionLock = useRef(false);

    // Helper logger
    const log = (level: 'info' | 'error' | 'success' | 'warning', message: string) => {
        addLog(level, message);
    };

    // Singleton instance access with adapted logger
    const getADB = () => ADBProtocol.getInstance((msg, level) => addLog(level || 'info', msg));

    useEffect(() => {
        const adb = getADB();
        const usb = navigator.usb;

        if (!usb) return;

        // --- Event Handlers ---

        const handleConnect = async (event: USBConnectionEvent) => {
            // Prevent duplicate handling (debounce)
            if (connectionLock.current || adb.isConnected) return;
            if (useADBStore.getState().isConnecting) return;

            connectionLock.current = true;
            log('info', `USB Device Connected: ${event.device.productName || 'Unknown Device'}`);

            try {
                // Wait for device to settle
                await new Promise(r => setTimeout(r, 1000));

                // Re-check status
                if (adb.isConnected) return;

                // Check pairing
                const count = await adb.getPairedDevicesCount();
                if (count > 0) {
                    setConnecting(true);
                    try {
                        const success = await adb.restoreConnection();
                        if (success) {
                            setConnected(true);
                            log('success', '⚡ Auto-connected to device');
                            // Auto-switch mode to ADB to ensure UI is active
                            useDeviceStore.getState().setMode('adb');
                            const info = await adb.getDeviceInfo();
                            setDeviceInfo(info);
                            // Auto-switch mode to ADB
                            useDeviceStore.getState().setMode('adb');
                        }
                    } finally {
                        setConnecting(false);
                    }
                }
            } catch (e) {
                console.error('Auto-connect error:', e);
            } finally {
                setTimeout(() => {
                    connectionLock.current = false;
                }, 2000);
            }
        };

        const handleDisconnect = async (event: USBConnectionEvent) => {
            const isMatch = adb.isCurrentDevice(event.device);

            // Check if we think we are connected OR matches
            if (adb.isConnected && isMatch) {
                log('warning', `🔌 Device Disconnected: ${event.device.productName || 'Unknown'}`);

                // 1. Cleanup Protocol FIRST (Critical to prevent race conditions with UI re-renders)
                try {
                    await adb.disconnect();
                } catch (e) {
                    console.error('Disconnect cleanup error:', e);
                }

                // 2. Force UI Update IMMEDIATELY
                setConnected(false);
                setDeviceInfo(null);
                setPendingOperation(null);
                setConnecting(false);

                // 3. Reset Store
                useADBStore.getState().reset();
                useDeviceStore.getState().setConnected(false); // Redundant but safe

                // 4. Reset Lock to allow immediate replug
                connectionLock.current = false;
            }
        };

        // --- Initial Mount Check (Page Refresh) ---

        const attemptInitialRestore = async () => {
            if (adb.isConnected || useADBStore.getState().isConnecting) return;

            const count = await adb.getPairedDevicesCount();
            if (count > 0) {
                setConnecting(true);
                try {
                    const restored = await adb.restoreConnection();
                    if (restored) {
                        setConnected(true);
                        log('success', '🔄 Connection restored');
                        useDeviceStore.getState().setMode('adb');
                        const info = await adb.getDeviceInfo();
                        setDeviceInfo(info);
                    }
                } finally {
                    setConnecting(false);
                }
            }
        };

        // Attach Listeners
        usb.addEventListener('connect', handleConnect);
        usb.addEventListener('disconnect', handleDisconnect);

        // Run initial check
        attemptInitialRestore();

        // Cleanup
        return () => {
            usb.removeEventListener('connect', handleConnect);
            usb.removeEventListener('disconnect', handleDisconnect);
        };
    }, []); // Run once on mount

    return null; // Logic only component
}
