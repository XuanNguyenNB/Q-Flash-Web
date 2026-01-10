/**
 * FastbootConnectionStatus Component
 * 
 * Displays Fastboot connection status and provides connect/disconnect buttons.
 * Shows device product name when connected with orange accent for Fastboot mode.
 * 
 * Story: 8.2 - Fastboot Device Connection UI
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

// Stores
import { useFastbootStore } from '@/stores/fastbootStore';

// Hooks
import { useFastboot } from '@/hooks/useFastboot';

// Components
import { Button } from '@/components/ui/button';
import { ConnectionStatusDot, type ConnectionStatus } from '@/components/features/device/ConnectionStatusDot';

// Utils
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface FastbootConnectionStatusProps {
    className?: string;
    variant?: 'default' | 'card';
}

// ============================================================================
// Component
// ============================================================================

/**
 * FastbootConnectionStatus - Connection UI for Fastboot mode
 * 
 * Features:
 * - Connect/Disconnect button with orange Fastboot styling
 * - Status dot (gray/orange pulsing/green)
 * - Product name display when connected
 * - Error handling with toasts
 * - Responsive variants (default horizontal, card vertical)
 */
export function FastbootConnectionStatus({ className, variant = 'default' }: FastbootConnectionStatusProps) {
    const { t } = useTranslation();

    // Store state
    const { isConnecting, deviceInfo } = useFastbootStore();

    // Fastboot hook - get protocol for actual connection state
    const { connect, disconnect, getInstance } = useFastboot();

    // Get actual connection state from protocol (source of truth)
    const protocol = getInstance();
    const isConnected = protocol.isConnected;

    // ========================================================================
    // Status Helpers
    // ========================================================================

    /**
     * Get connection status for status dot
     */
    const getConnectionStatus = (): ConnectionStatus => {
        if (isConnecting) return 'connecting';
        if (isConnected) return 'connected';
        return 'disconnected';
    };

    /**
     * Get status text based on current state
     */
    const getStatusText = (): string => {
        if (isConnecting) {
            return t('fastboot.connection.connecting', 'Connecting...');
        }
        if (isConnected && deviceInfo) {
            return variant === 'card'
                ? t('fastboot.connection.connected', 'Connected')
                : `${t('fastboot.connection.connected', 'Connected')} (${deviceInfo.product})`;
        }
        if (isConnected) {
            return t('fastboot.connection.connected', 'Connected');
        }
        return t('fastboot.connection.disconnected', 'Disconnected');
    };

    // ========================================================================
    // Event Handlers
    // ========================================================================

    /**
     * Handle connect button click
     */
    const handleConnect = useCallback(async () => {
        try {
            const success = await connect();
            if (success) {
                toast.success(t('fastboot.toast.connected', 'Fastboot device connected'), { duration: 5000 });
            } else {
                toast.error(t('fastboot.toast.connectionFailed', 'Failed to connect. Ensure device is in Fastboot mode.'), { duration: 5000 });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(message, { duration: 5000 });
        }
    }, [connect, t]);

    /**
     * Handle disconnect button click
     */
    const handleDisconnect = useCallback(async () => {
        try {
            await disconnect();
            toast.info(t('fastboot.toast.disconnected', 'Fastboot device disconnected'), { duration: 5000 });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(message, { duration: 5000 });
        }
    }, [disconnect, t]);

    // ========================================================================
    // Render
    // ========================================================================

    if (variant === 'card') {
        return (
            <div className={cn(
                "rounded-lg bg-card border border-border p-4 space-y-3",
                className
            )}>
                {/* Connection Status Header */}
                <div className="flex items-center gap-2">
                    <ConnectionStatusDot
                        status={getConnectionStatus()}
                        className={cn(isConnecting && "bg-orange-500")}
                    />
                    <span className="text-xs font-medium text-muted-foreground truncate">
                        {getStatusText()}
                    </span>
                </div>

                {/* Device Info (only when connected) */}
                {isConnected && deviceInfo && (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Wrench className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                                {deviceInfo.product}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {deviceInfo.isUserspace ? 'FastbootD Mode' : 'Fastboot Mode'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Connect/Disconnect Button */}
                {isConnected ? (
                    <Button
                        variant="outline"
                        onClick={handleDisconnect}
                        disabled={isConnecting}
                        className="w-full gap-2"
                    >
                        <WifiOff className="h-4 w-4" />
                        {t('fastboot.button.disconnect', 'Disconnect')}
                    </Button>
                ) : (
                    <Button
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                    >
                        {isConnecting ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <Wrench className="h-4 w-4" />
                        )}
                        {isConnecting
                            ? t('fastboot.button.connecting', 'Connecting...')
                            : t('fastboot.button.connect', 'Connect')
                        }
                    </Button>
                )}
            </div>
        );
    }

    // Default horizontal layout
    return (
        <div
            className={cn(
                "flex items-center justify-between p-4 bg-card rounded-xl border border-border",
                className
            )}
        >
            {/* Connect/Disconnect Button */}
            {isConnected ? (
                <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    disabled={isConnecting}
                    className="gap-2"
                >
                    <WifiOff className="h-4 w-4" />
                    {t('fastboot.button.disconnect', 'Disconnect')}
                </Button>
            ) : (
                <Button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                >
                    {isConnecting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                        <Wrench className="h-4 w-4" />
                    )}
                    {isConnecting
                        ? t('fastboot.button.connecting', 'Connecting...')
                        : t('fastboot.button.connect', 'Connect Fastboot')
                    }
                </Button>
            )}

            {/* Status Indicator */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                    {t('fastboot.label.status', 'Status')}:
                </span>
                <ConnectionStatusDot
                    status={getConnectionStatus()}
                    className={cn(
                        // Use orange for connecting state in Fastboot mode
                        isConnecting && "bg-orange-500"
                    )}
                />
                <span className="text-sm font-medium text-foreground">
                    {getStatusText()}
                </span>
            </div>
        </div>
    );
}
