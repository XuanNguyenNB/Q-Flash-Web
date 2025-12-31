/**
 * DevicePanel Component
 * 
 * Wrapper component that combines DeviceSelector with automatic firehose loading.
 * Shows loading indicator and manual popup when needed.
 * 
 * @story 2-3-auto-detect-firehose-by-chipset
 */

import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceStore } from '@/stores/deviceStore';
import { useDevices } from '@/hooks/useDevices';
import { useFirehoseLoader } from '@/hooks/useFirehoseLoader';
import { DeviceSelector } from './DeviceSelector';
import { FirehoseLoadingIndicator } from './FirehoseLoadingIndicator';
import { ManualFirehosePopup } from './ManualFirehosePopup';
import { cn } from '@/lib/utils';

interface DevicePanelProps {
    /** Additional CSS classes */
    className?: string;
    /** Whether the sidebar is collapsed */
    collapsed?: boolean;
}

/**
 * Device panel with automatic firehose loading.
 * 
 * Features:
 * - Device selector dropdown
 * - Automatic firehose loading on device selection
 * - Loading progress indicator
 * - Manual file selection popup on failure
 */
export function DevicePanel({ className, collapsed = false }: DevicePanelProps) {
    const { t } = useTranslation();

    // Device store
    const selectedDevice = useDeviceStore((state) => state.selectedDevice);
    const setFirehoseLoaded = useDeviceStore((state) => state.setFirehoseLoaded);

    // Devices hook
    const { devices } = useDevices();

    // Firehose loader
    const {
        loadFirehose,
        status,
        progress,
        error,
        showManualPopup,
        setShowManualPopup,
    } = useFirehoseLoader();

    /**
     * Load firehose when device changes.
     */
    useEffect(() => {
        if (selectedDevice && devices.length > 0) {
            // Find the DeviceEntry for the selected device
            const deviceEntry = devices.find(d => d.id === selectedDevice.id);
            if (deviceEntry) {
                loadFirehose(deviceEntry);
            }
        } else {
            // Reset firehose state when no device selected
            setFirehoseLoaded(false);
        }
    }, [selectedDevice?.id, devices, loadFirehose, setFirehoseLoaded]);

    /**
     * Handle manual file submission.
     */
    const handleManualSubmit = useCallback((files: {
        programmer: ArrayBuffer;
        digest: ArrayBuffer;
        signature: ArrayBuffer;
    }) => {
        // Mark firehose as loaded
        setFirehoseLoaded(true);
        setShowManualPopup(false);

        // TODO: Pass files to useFirehose hook when connection is established
        console.log('Manual firehose files loaded:', {
            programmer: files.programmer.byteLength,
            digest: files.digest.byteLength,
            signature: files.signature.byteLength,
        });
    }, [setFirehoseLoaded, setShowManualPopup]);

    /**
     * Handle skip manual selection.
     */
    const handleManualSkip = useCallback(() => {
        setShowManualPopup(false);
    }, [setShowManualPopup]);

    // Collapsed view
    if (collapsed) {
        return (
            <div className={cn('flex flex-col gap-2', className)}>
                <DeviceSelector collapsed />
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {/* Device selector */}
            <DeviceSelector />

            {/* Firehose loading indicator */}
            {selectedDevice && status !== 'idle' && (
                <FirehoseLoadingIndicator
                    status={status}
                    progress={progress}
                    error={error}
                />
            )}

            {/* Manual firehose popup */}
            <ManualFirehosePopup
                open={showManualPopup}
                onOpenChange={setShowManualPopup}
                deviceName={selectedDevice?.name}
                onSubmit={handleManualSubmit}
                onSkip={handleManualSkip}
            />
        </div>
    );
}
