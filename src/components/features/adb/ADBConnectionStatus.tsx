/**
 * ADBConnectionStatus Component
 * 
 * Displays ADB connection status and provides connect/disconnect functionality.
 * Shows status dot, device model when connected, and handles connection errors.
 * 
 * Story: 7.2 - ADB Device Connection UI
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// Stores
import { useADBStore } from '@/stores/adbStore';

// Hooks
import { useADB } from '@/hooks/useADB';

// Components
import { Button } from '@/components/ui/button';
import { ConnectionStatusDot, type ConnectionStatus } from '@/components/features/device/ConnectionStatusDot';

// Icons
import { Smartphone, Loader2 } from 'lucide-react';

// Utils
import { cn } from '@/lib/utils';

interface ADBConnectionStatusProps {
    className?: string;
    variant?: 'default' | 'card';
}

/**
 * ADBConnectionStatus - ADB connection card with connect/disconnect button
 */
export function ADBConnectionStatus({ className, variant = 'default' }: ADBConnectionStatusProps) {
    const { t } = useTranslation();

    // Store state
    const { deviceInfo, isConnecting, pendingOperation } = useADBStore();

    // ADB hook - get protocol for actual connection state
    const { connect, disconnect, getInstance } = useADB();

    // Get actual connection state from protocol (source of truth)
    const protocol = getInstance();
    const isConnected = protocol.isConnected;

    /**
     * Get connection status for the status dot
     */
    const getConnectionStatus = (): ConnectionStatus => {
        if (isConnecting) return 'connecting';
        if (isConnected) return 'connected';
        return 'disconnected';
    };

    /**
     * Get status text
     */
    const getStatusText = (): string => {
        if (isConnecting) {
            return t('adb.status.connecting', 'Connecting...');
        }
        if (isConnected && deviceInfo) {
            return variant === 'card'
                ? t('adb.status.connected', 'Connected')
                : `${t('adb.status.connected', 'Connected')} (${deviceInfo.model})`;
        }
        if (isConnected) {
            return t('adb.status.connected', 'Connected');
        }
        return t('adb.status.disconnected', 'Disconnected');
    };

    /**
     * Handle connect button click
     */
    const handleConnect = useCallback(async () => {
        try {
            const success = await connect();
            if (success) {
                toast.success(t('adb.toast.connected', 'ADB device connected'));
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(t('adb.toast.connectionFailed', 'Connection failed: {{message}}', { message }));
        }
    }, [connect, t]);

    /**
     * Handle disconnect button click
     */
    const handleDisconnect = useCallback(async () => {
        try {
            await disconnect();
            toast.info(t('adb.toast.disconnected', 'ADB device disconnected'));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(t('adb.toast.disconnectFailed', 'Disconnect failed: {{message}}', { message }));
        }
    }, [disconnect, t]);

    if (variant === 'card') {
        return (
            <div className={cn(
                "rounded-lg bg-card border border-border p-4 space-y-3",
                className
            )}>
                {/* Connection Status Header */}
                <div className="flex items-center gap-2">
                    <ConnectionStatusDot status={getConnectionStatus()} />
                    <span className="text-xs font-medium text-muted-foreground truncate">
                        {getStatusText()}
                    </span>
                </div>

                {/* Device Info Removed */}

                {/* Connect/Disconnect Button */}
                <Button
                    variant={isConnected ? 'outline' : 'default'}
                    className={cn(
                        "w-full gap-2",
                        !isConnected && "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                    onClick={isConnected ? handleDisconnect : handleConnect}
                    disabled={isConnecting || !!pendingOperation}
                >
                    {isConnecting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('adb.button.connecting', 'Connecting...')}
                        </>
                    ) : isConnected ? (
                        <>
                            <Smartphone className="h-4 w-4" />
                            {t('adb.button.disconnect', 'Disconnect')}
                        </>
                    ) : (
                        <>
                            <Smartphone className="h-4 w-4" />
                            {t('adb.button.connect', 'Connect ADB')}
                        </>
                    )}
                </Button>
            </div>
        );
    }

    return (
        <div className={cn(
            "rounded-lg bg-card border border-border p-4 space-y-4",
            className
        )}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                    {t('adb.connection.title', 'Connection')}
                </h3>
            </div>

            {/* Status and Button Row */}
            <div className="flex items-center justify-between gap-4">
                {/* Connect/Disconnect Button */}
                <Button
                    variant={isConnected ? 'outline' : 'default'}
                    className={cn(
                        "gap-2",
                        !isConnected && "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                    onClick={isConnected ? handleDisconnect : handleConnect}
                    disabled={isConnecting || !!pendingOperation}
                >
                    {isConnecting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('adb.button.connecting', 'Connecting...')}
                        </>
                    ) : isConnected ? (
                        <>
                            <Smartphone className="h-4 w-4" />
                            {t('adb.button.disconnect', 'Disconnect')}
                        </>
                    ) : (
                        <>
                            <Smartphone className="h-4 w-4" />
                            {t('adb.button.connect', 'Connect ADB')}
                        </>
                    )}
                </Button>

                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {t('adb.connection.status', 'Status')}:
                    </span>
                    <ConnectionStatusDot status={getConnectionStatus()} />
                    <span className="text-xs font-medium text-foreground">
                        {getStatusText()}
                    </span>
                </div>
            </div>
        </div>
    );
}
