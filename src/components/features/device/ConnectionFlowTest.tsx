/**
 * ConnectionFlowTest Component
 * 
 * Simple test component to verify useConnectionFlow hook functionality.
 * This is a temporary test component - not for production use.
 */

import { useConnectionFlow } from '@/hooks/useConnectionFlow';
import { useDeviceStore } from '@/stores/deviceStore';
import { Button } from '@/components/ui/button';

export function ConnectionFlowTest() {
    const { status, error, connect, disconnect, retry } = useConnectionFlow();
    const selectedDevice = useDeviceStore((state) => state.selectedDevice);
    const isConnected = useDeviceStore((state) => state.isConnected);

    // Map status to display text
    const statusText = {
        'idle': 'Disconnected',
        'connecting': 'Connecting to USB...',
        'sahara': 'Sahara handshake...',
        'uploading': 'Uploading firehose...',
        'authenticating': 'VIP authentication...',
        'reading-partitions': 'Reading partitions...',
        'connected': 'Connected ✓',
        'error': 'Error ✗',
    }[status];

    // Status color
    const statusColor = {
        'idle': 'text-zinc-400',
        'connecting': 'text-yellow-500 animate-pulse',
        'sahara': 'text-yellow-500 animate-pulse',
        'uploading': 'text-yellow-500 animate-pulse',
        'authenticating': 'text-yellow-500 animate-pulse',
        'reading-partitions': 'text-yellow-500 animate-pulse',
        'connected': 'text-green-500',
        'error': 'text-red-500',
    }[status];

    const handleConnect = async () => {
        try {
            await connect();
        } catch (err) {
            // Error already handled in hook
            console.error('Connection failed:', err);
        }
    };

    return (
        <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 shadow-lg">
            {/* Header */}
            <div className="border-b border-zinc-800 p-6">
                <h2 className="text-xl font-semibold text-zinc-100">
                    Connection Flow Test
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                    Test useConnectionFlow hook functionality
                </p>
            </div>

            {/* Content */}
            <div className="space-y-4 p-6">
                {/* Device Info */}
                <div>
                    <p className="text-sm text-zinc-400">Selected Device:</p>
                    <p className="text-sm font-medium text-zinc-100">
                        {selectedDevice ? selectedDevice.name : 'No device selected'}
                    </p>
                    {selectedDevice && (
                        <p className="text-xs text-zinc-500">
                            Chipset: {selectedDevice.chipset}
                        </p>
                    )}
                </div>

                {/* Status */}
                <div>
                    <p className="text-sm text-zinc-400">Connection Status:</p>
                    <p className={`text-sm font-medium ${statusColor}`}>
                        {statusText}
                    </p>
                    <p className="text-xs text-zinc-500">
                        Store isConnected: {isConnected ? 'true' : 'false'}
                    </p>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="rounded-md bg-red-500/10 p-3 border border-red-500/20">
                        <p className="text-sm font-medium text-red-500">
                            {error.code}
                        </p>
                        <p className="text-xs text-red-400 mt-1">
                            {error.message}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                            Failed at: {error.step}
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {status === 'idle' && (
                        <Button
                            onClick={handleConnect}
                            disabled={!selectedDevice}
                            className="flex-1"
                        >
                            Connect
                        </Button>
                    )}

                    {status === 'connected' && (
                        <Button
                            onClick={disconnect}
                            variant="outline"
                            className="flex-1"
                        >
                            Disconnect
                        </Button>
                    )}

                    {status === 'error' && (
                        <Button
                            onClick={retry}
                            variant="destructive"
                            className="flex-1"
                        >
                            Retry Connection
                        </Button>
                    )}

                    {['connecting', 'sahara', 'uploading', 'authenticating', 'reading-partitions'].includes(status) && (
                        <Button
                            disabled
                            className="flex-1"
                        >
                            {statusText}
                        </Button>
                    )}
                </div>

                {/* Debug Info */}
                <details className="text-xs">
                    <summary className="cursor-pointer text-zinc-500 hover:text-zinc-400">
                        Debug Info
                    </summary>
                    <pre className="mt-2 p-2 bg-zinc-950 rounded text-zinc-400 overflow-auto text-xs">
                        {JSON.stringify(
                            {
                                status,
                                isConnected,
                                hasDevice: !!selectedDevice,
                                deviceChipset: selectedDevice?.chipset,
                                error: error ? {
                                    code: error.code,
                                    step: error.step,
                                    message: error.message,
                                } : null,
                            },
                            null,
                            2
                        )}
                    </pre>
                </details>
            </div>
        </div>
    );
}
