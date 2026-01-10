/**
 * DeviceCard Component
 * 
 * Displays device information and connection status in the sidebar.
 * Shows device name, chipset, connection status dot, and connect/disconnect buttons.
 * 
 * Story: 2.4 - Device Card & Connection Status
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { usePartitionStore } from '@/stores/partitionStore';
import { useTerminalStore } from '@/stores/terminalStore';

// Hooks
import { useConnectionFlow, type ConnectionFlowState } from '@/hooks/useConnectionFlow';

// Components
import { Button } from '@/components/ui/button';
import { ConnectionStatusDot } from './ConnectionStatusDot';
import { EDLTroubleshootDialog } from './EDLTroubleshootDialog';

// Icons
import { Smartphone, Wifi, WifiOff } from 'lucide-react';

// Utils
import { cn } from '@/lib/utils';
import type { TFunction } from 'i18next';

/**
 * Translate error message based on error code and message content
 */
function translateErrorMessage(errorCode: string, errorMessage: string, t: TFunction): string {
    // Check for specific error messages
    if (errorMessage.includes('Device not found')) {
        return t('connection.error.deviceNotFound', 'Device not found. Ensure device is in EDL mode and WinUSB driver is installed via Zadig.');
    }

    // Check by error code
    switch (errorCode) {
        case 'USB_ERROR':
            return t('connection.error.usb', 'USB connection failed');
        case 'SAHARA_ERROR':
            return t('connection.error.sahara', 'Sahara handshake failed');
        case 'FIREHOSE_ERROR':
            return t('connection.error.firehose', 'Firehose upload failed');
        case 'VIP_ERROR':
            return t('connection.error.vip', 'VIP authentication failed');
        case 'PARTITION_ERROR':
            return t('connection.error.partition', 'Failed to read partitions');
        default:
            return errorMessage;
    }
}

/**
 * Map ConnectionFlowState to ConnectionStatus for the status dot
 */
function mapFlowStatusToDotStatus(flowStatus: ConnectionFlowState): ConnectionStatus {
    switch (flowStatus) {
        case 'idle':
            return 'disconnected';
        case 'connecting':
        case 'sahara':
        case 'uploading':
        case 'authenticating':
        case 'reading-partitions':
            return 'connecting';
        case 'connected':
            return 'connected';
        case 'error':
            return 'error';
        default:
            return 'disconnected';
    }
}

/**
 * Connection status type for local state management
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface DeviceCardProps {
    className?: string;
}

/**
 * DeviceCard component - shows device info and connection controls
 */
export function DeviceCard({ className }: DeviceCardProps) {
    const { t } = useTranslation();

    // Store state
    const { selectedDevice } = useDeviceStore();

    // Connection flow hook
    const { connect, disconnect, retry, status: flowStatus, error: flowError } = useConnectionFlow();

    // Troubleshoot dialog state
    const [showTroubleshoot, setShowTroubleshoot] = useState(false);

    // Translate error message for display
    const translatedError = flowError ? translateErrorMessage(flowError.code, flowError.message, t) : null;

    // Auto-show troubleshoot dialog on USB error
    useEffect(() => {
        if (flowStatus === 'error' && flowError?.code === 'USB_ERROR') {
            setShowTroubleshoot(true);
        }
    }, [flowStatus, flowError]);

    // Reset state when selected device changes
    useEffect(() => {
        if (selectedDevice) {
            // If we were connected to another device, ensure we reset UI state
            usePartitionStore.getState().reset();
            // Disconnect if active connection exists (handled by flow status check internally usually, but good to enforce)
            if (flowStatus === 'connected' || flowStatus === 'reading-partitions') {
                disconnect();
            }
        }
    }, [selectedDevice?.id]); // Only trigger on ID change to avoid loops

    // Map flow status to display text
    const getStatusText = (): string => {
        switch (flowStatus) {
            case 'idle':
                return t('device.status.disconnected');
            case 'connecting':
                return t('connection.flow.connecting');
            case 'sahara':
                return t('connection.flow.sahara');
            case 'uploading':
                return t('connection.flow.uploading');
            case 'authenticating':
                return t('connection.flow.authenticating');
            case 'reading-partitions':
                return t('connection.flow.reading');
            case 'connected':
                return t('connection.flow.connected');
            case 'error':
                return t('device.status.error'); // Just show "Lỗi kết nối", detailed error in error box
            default:
                return t('device.status.disconnected');
        }
    };

    /**
     * Handle connect button click
     */
    const handleConnect = useCallback(async () => {
        if (!selectedDevice) {
            return;
        }

        try {
            await connect();
        } catch (err) {
            // Error already handled in useConnectionFlow
        }
    }, [selectedDevice, connect]);

    /**
     * Handle disconnect button click
     */
    const handleDisconnect = useCallback(async () => {
        try {
            await disconnect();
        } catch (err) {
            // Error already handled in useConnectionFlow
        }
    }, [disconnect]);

    /**
     * Handle retry after error
     */
    const handleRetry = useCallback(() => {
        retry();
    }, [retry]);

    // If no device selected, show empty state
    if (!selectedDevice) {
        return (
            <div className={cn(
                "rounded-lg bg-card border border-border p-4",
                className
            )}>
                <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        <Smartphone className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-foreground">
                            {t('device.card.noDevice')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('device.card.selectDevice')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Device is selected - show full card
    return (
        <div className={cn(
            "rounded-lg bg-card border border-border p-4 space-y-3",
            className
        )}>
            {/* Connection Status Header */}
            <div className="flex items-center gap-2">
                <ConnectionStatusDot status={mapFlowStatusToDotStatus(flowStatus)} />
                <span className="text-xs font-medium text-muted-foreground">
                    {getStatusText()}
                </span>
            </div>

            {/* Device Info */}
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {selectedDevice.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {t('device.card.chipset')}: {selectedDevice.chipset}
                    </p>
                </div>
            </div>

            {/* Error Message */}
            {flowStatus === 'error' && translatedError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-xs text-destructive font-medium">
                        {translatedError}
                    </p>
                </div>
            )}

            {/* Connect/Disconnect Button */}
            {flowStatus === 'idle' || flowStatus === 'error' ? (
                <Button
                    variant={flowStatus === 'error' ? 'destructive' : 'default'}
                    className="w-full"
                    onClick={flowStatus === 'error' ? handleRetry : handleConnect}
                    disabled={!selectedDevice}
                >
                    <Wifi className="h-4 w-4 mr-2" />
                    {flowStatus === 'error' ? t('connection.action.retry') : t('device.action.connect')}
                </Button>
            ) : flowStatus === 'connected' ? (
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleDisconnect}
                >
                    <WifiOff className="h-4 w-4 mr-2" />
                    {t('device.action.disconnect')}
                </Button>
            ) : (
                <Button
                    variant="outline"
                    className="w-full"
                    disabled
                >
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {getStatusText()}
                </Button>
            )}

            {/* Troubleshoot Dialog */}
            <EDLTroubleshootDialog
                open={showTroubleshoot}
                onOpenChange={setShowTroubleshoot}
                onRetry={handleRetry}
                errorMessage={translatedError ?? undefined}
            />
        </div>
    );
}
