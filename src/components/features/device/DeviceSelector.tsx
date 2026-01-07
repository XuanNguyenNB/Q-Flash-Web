/**
 * DeviceSelector Component
 * 
 * Simplified chipset selector - choose by chip instead of phone model.
 * Simpler and doesn't need constant phone list updates.
 */

import { useTranslation } from 'react-i18next';
import { useDeviceStore, type DeviceProfile } from '@/stores/deviceStore';
import { useChipsets, type ChipsetEntry } from '@/hooks/useChipsets';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Smartphone, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/services/analytics';

interface DeviceSelectorProps {
    className?: string;
    collapsed?: boolean;
}

export function DeviceSelector({ className, collapsed = false }: DeviceSelectorProps) {
    const { t } = useTranslation();
    const { selectedDevice, setDevice } = useDeviceStore();
    const { chipsets, loading, error } = useChipsets();

    const handleSelect = (chipsetId: string) => {
        const chipset = chipsets.find(c => c.id === chipsetId);
        if (chipset) {
            // Determine auth method - LG uses 'standard', others use 'oppo_vip'
            const authMethod = chipset.authMethod === 'standard' ? 'none' :
                chipset.authMethod === 'oppo_vip' ? 'oppo_vip' : 'none';

            // Convert ChipsetEntry to DeviceProfile
            const profile: DeviceProfile = {
                id: chipset.id,
                brand: chipset.id.startsWith('LG_') ? 'lg' : 'qualcomm',
                name: chipset.name,
                codename: chipset.codename,
                chipset: chipset.codename,
                chipsetName: chipset.name,
                chipsetFolder: chipset.codename,
                authMethod: authMethod,
                presetId: chipset.presetId || null,
                status: 'tested',
                firehoseUrls: {
                    programmer: chipset.firehose.programmerUrl,
                    digest: chipset.firehose.digestUrl,
                    signature: chipset.firehose.signatureUrl,
                },
            };
            setDevice(profile);
            trackEvent('edl', 'device_selected', chipset.name);
        }
    };

    if (collapsed) {
        return (
            <Button
                variant="ghost"
                size="icon"
                className={cn('h-10 w-10', className)}
            >
                <Smartphone className="h-5 w-5" />
            </Button>
        );
    }

    return (
        <Select
            value={selectedDevice?.id || ''}
            onValueChange={handleSelect}
            disabled={loading || !!error}
        >
            <SelectTrigger className={cn('w-full', className)}>
                <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 shrink-0 opacity-70" />
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{t('device.selector.loading', 'Loading...')}</span>
                        </div>
                    ) : error ? (
                        <span className="text-destructive">{t('device.selector.error', 'Error loading')}</span>
                    ) : selectedDevice ? (
                        <span>{selectedDevice.chipsetName || selectedDevice.name}</span>
                    ) : (
                        <span className="text-muted-foreground">{t('device.selector.placeholder', 'Select chipset...')}</span>
                    )}
                </div>
            </SelectTrigger>
            <SelectContent>
                {chipsets.map((chipset) => (
                    <SelectItem key={chipset.id} value={chipset.id}>
                        <div className="flex flex-col gap-1">
                            <div className="font-medium">
                                {chipset.codename} - {chipset.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {chipset.examples.join(', ')}
                            </div>
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
