/**
 * DeviceSelector Component
 * 
 * A searchable dropdown to select devices grouped by chipset.
 * Integrates with deviceStore and settingsStore for state management.
 * 
 * Story: 2.2 - DeviceSelector Component
 * Epic: 2 - Device Management & Connection
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, X, Smartphone, Loader2 } from 'lucide-react';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import type { DeviceProfile } from '@/stores/deviceStore';
import { useSettingsStore } from '@/stores/settingsStore';

// Components
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

// Hooks
import { useDevices, groupDevicesByChipset } from '@/hooks/useDevices';
import type { DeviceEntry } from '@/hooks/useDevices';

// Utils
import { cn } from '@/lib/utils';

/**
 * Status badge styles
 */
const statusStyles = {
    tested: 'bg-green-500/10 text-green-500 border-green-500/20',
    beta: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    coming: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

/**
 * Status icons/labels
 */
const statusIcons = {
    tested: '✅',
    beta: '🔸',
    coming: '🔜',
};

interface DeviceSelectorProps {
    className?: string;
    /** Whether the component is in collapsed mode (show icon only) */
    collapsed?: boolean;
}

/**
 * DeviceSelector - Searchable dropdown for device selection
 */
export function DeviceSelector({ className, collapsed = false }: DeviceSelectorProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    // Stores
    const { selectedDevice, setDevice } = useDeviceStore();
    const { lastDeviceId, setLastDeviceId } = useSettingsStore();

    // Load devices
    const { devices, isLoading, error } = useDevices();

    // Get current mode
    const { currentMode } = useDeviceStore();

    // Group devices by chipsetName (only for non-EDL modes or if desired)
    const groupedDevices = useMemo(() => {
        if (currentMode === 'edl') return null;
        return groupDevicesByChipset(devices);
    }, [devices, currentMode]);

    // Get ordered chipset names
    const chipsetOrder = useMemo(() => {
        if (!groupedDevices) return [];
        return Object.keys(groupedDevices);
    }, [groupedDevices]);

    /**
     * Convert DeviceEntry to DeviceProfile for store compatibility
     */
    const toDeviceProfile = useCallback((device: DeviceEntry): DeviceProfile => ({
        id: device.id,
        brand: device.brand,
        name: device.name,
        codename: device.codename,
        chipset: device.chipset,
        chipsetName: device.chipsetName,
        chipsetFolder: device.chipset, // Use chipset as folder name
        authMethod: device.authMethod || undefined,
        presetId: device.presetId,
        status: device.status,
        firehoseUrls: device.firehose ? {
            programmer: device.firehose.programmerUrl,
            digest: device.firehose.digestUrl,
            signature: device.firehose.signatureUrl,
        } : undefined,
    }), []);

    /**
     * Handle device selection
     */
    const handleSelect = useCallback((deviceId: string) => {
        const device = devices.find(d => d.id === deviceId);
        if (device) {
            const profile = toDeviceProfile(device);
            setDevice(profile);
            setLastDeviceId(device.id);
        }
        setOpen(false);
    }, [devices, setDevice, setLastDeviceId, toDeviceProfile]);

    /**
     * Clear selection
     */
    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setDevice(null);
        setLastDeviceId(null);
    }, [setDevice, setLastDeviceId]);

    /**
     * Restore last selected device on mount
     */
    useEffect(() => {
        if (lastDeviceId && !selectedDevice && devices.length > 0) {
            const device = devices.find(d => d.id === lastDeviceId);
            if (device) {
                const profile = toDeviceProfile(device);
                setDevice(profile);
            }
        }
    }, [lastDeviceId, selectedDevice, devices, setDevice, toDeviceProfile]);

    /**
     * Get display text for selected device
     */
    const displayText = useMemo(() => {
        if (!selectedDevice) {
            return t('device.selector.placeholder', 'Select a device...');
        }
        const deviceEntry = devices.find(d => d.id === selectedDevice.id);

        // EDL Mode: Simple Name
        if (currentMode === 'edl') {
            return deviceEntry ? deviceEntry.name : selectedDevice.name;
        }

        if (deviceEntry) {
            return `${deviceEntry.name} - ${deviceEntry.chipsetName}`;
        }
        return selectedDevice.name;
    }, [selectedDevice, devices, currentMode, t]);

    // Collapsed view - just show icon
    if (collapsed) {
        return (
            <Button
                variant="ghost"
                size="icon"
                className={cn('h-10 w-10', className)}
                onClick={() => setOpen(true)}
            >
                <Smartphone className="h-5 w-5" />
            </Button>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={t('device.selector.placeholder', 'Select a device...')}
                    className={cn(
                        'w-full justify-between text-left font-normal',
                        !selectedDevice && 'text-muted-foreground',
                        className
                    )}
                >
                    <div className="flex items-center gap-2 truncate">
                        <Smartphone className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="truncate">{displayText}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {selectedDevice && (
                            <X
                                className="h-4 w-4 opacity-50 hover:opacity-100 cursor-pointer"
                                onClick={handleClear}
                            />
                        )}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder={t('device.selector.search', 'Search devices...')}
                    />
                    <CommandList>
                        {/* Loading state */}
                        {isLoading && (
                            <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('device.selector.loading', 'Loading devices...')}
                            </div>
                        )}

                        {/* Error state */}
                        {error && (
                            <div className="py-6 text-center text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {/* Empty state */}
                        {!isLoading && !error && devices.length === 0 && (
                            <CommandEmpty>
                                {t('device.selector.empty', 'No devices configured')}
                            </CommandEmpty>
                        )}

                        {/* No search results */}
                        <CommandEmpty>
                            {t('device.selector.noResults', 'No devices found')}
                        </CommandEmpty>

                        {/* EDL Mode: Flat List */}
                        {!isLoading && !error && currentMode === 'edl' && (
                            <CommandGroup>
                                {devices
                                    // Sort by name alphabetically
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(device => (
                                        <CommandItem
                                            key={device.id}
                                            value={`${device.name} ${device.codename}`} // Searchable terms
                                            onSelect={() => handleSelect(device.id)}
                                            className="flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Check
                                                    className={cn(
                                                        'h-4 w-4',
                                                        selectedDevice?.id === device.id
                                                            ? 'opacity-100'
                                                            : 'opacity-0'
                                                    )}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">
                                                        {device.name}
                                                    </span>
                                                    {/* Optional: Show codename for precision if duplicates exist */}
                                                    <span className="text-xs text-muted-foreground hidden group-hover:block">
                                                        {device.codename}
                                                    </span>
                                                </div>
                                            </div>
                                        </CommandItem>
                                    ))}
                            </CommandGroup>
                        )}

                        {/* Standard Mode: Grouped by Chipset */}
                        {!isLoading && !error && currentMode !== 'edl' && chipsetOrder.map(chipsetName => (
                            <CommandGroup key={chipsetName} heading={chipsetName}>
                                {groupedDevices![chipsetName].map(device => (
                                    <CommandItem
                                        key={device.id}
                                        value={`${device.name} ${device.codename} ${device.chipsetName}`}
                                        onSelect={() => handleSelect(device.id)}
                                        className="flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Check
                                                className={cn(
                                                    'h-4 w-4',
                                                    selectedDevice?.id === device.id
                                                        ? 'opacity-100'
                                                        : 'opacity-0'
                                                )}
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">
                                                    {device.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {device.codename}
                                                </span>
                                            </div>
                                        </div>
                                        <div
                                            className={cn(
                                                'text-xs px-1.5 py-0.5 rounded border',
                                                statusStyles[device.status]
                                            )}
                                        >
                                            {statusIcons[device.status]} {t(`device.status.${device.status}`, device.status)}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
