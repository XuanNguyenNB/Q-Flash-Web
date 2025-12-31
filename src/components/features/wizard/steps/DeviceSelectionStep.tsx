/**
 * DeviceSelectionStep Component
 * 
 * Third step of the setup wizard.
 * Integrates DeviceSelector component for device selection.
 */

import { useTranslation } from 'react-i18next';
import { DeviceSelector } from '@/components/features/device/DeviceSelector';
import { useDeviceStore } from '@/stores/deviceStore';
import { CheckCircle } from 'lucide-react';

/**
 * Device Selection step component
 * 
 * Shows DeviceSelector and confirmation when device is selected.
 */
export function DeviceSelectionStep() {
    const { t } = useTranslation();
    const selectedDevice = useDeviceStore((state) => state.selectedDevice);

    return (
        <div className="space-y-6 py-4">
            {/* Title */}
            <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                    {t('wizard.deviceSelection.title')}
                </h3>
                <p className="text-muted-foreground">
                    {t('wizard.deviceSelection.description')}
                </p>
            </div>

            {/* Device Selector */}
            <div>
                <DeviceSelector />
            </div>

            {/* Selected device confirmation */}
            {selectedDevice && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                            {t('wizard.deviceSelection.selected')}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                            {selectedDevice.name} ({selectedDevice.chipset})
                        </p>
                    </div>
                </div>
            )}

            {/* Hint when no device selected */}
            {!selectedDevice && (
                <p className="text-sm text-muted-foreground">
                    {t('wizard.deviceSelection.hint')}
                </p>
            )}
        </div>
    );
}
