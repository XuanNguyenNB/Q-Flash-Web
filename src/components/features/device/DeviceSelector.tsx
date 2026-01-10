/**
 * DeviceSelector Component
 * 
 * Simplified chipset selector - choose by chip instead of phone model.
 * Simpler and doesn't need constant phone list updates.
 */

import { useTranslation } from 'react-i18next';
import { useDeviceStore, type DeviceProfile } from '@/stores/deviceStore';
import { useEDLConnectionStore, type BrandGroup } from '@/stores/edlConnectionStore';
import { useChipsets, type ChipsetEntry } from '@/hooks/useChipsets';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
    SelectSeparator,
} from '@/components/ui/select';
import { Smartphone, Loader2, Zap, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trackEvent } from '@/services/analytics';
import { useState, useMemo } from 'react';

interface DeviceSelectorProps {
    className?: string;
    collapsed?: boolean;
}

export function DeviceSelector({ className, collapsed = false }: DeviceSelectorProps) {
    const { t } = useTranslation();
    const { selectedDevice, setDevice } = useDeviceStore();
    const { selectedBrandGroup, setSelectedBrandGroup } = useEDLConnectionStore();
    const { chipsets, loading, error } = useChipsets();
    const [searchQuery, setSearchQuery] = useState('');

    // Filter and group chipsets by brand
    const { filteredOppo, filteredLG } = useMemo(() => {
        const oppoChipsets: ChipsetEntry[] = [];
        const lgChipsets: ChipsetEntry[] = [];

        const query = searchQuery.toLowerCase();

        chipsets.forEach(chipset => {
            // Search in chipset name, codename, and examples
            const matchesSearch = !query ||
                chipset.name.toLowerCase().includes(query) ||
                chipset.codename.toLowerCase().includes(query) ||
                chipset.examples.some(ex => ex.toLowerCase().includes(query));

            if (!matchesSearch) return;

            if (chipset.id.startsWith('LG_') || chipset.authMethod === 'standard') {
                lgChipsets.push(chipset);
            } else {
                oppoChipsets.push(chipset);
            }
        });

        return { filteredOppo: oppoChipsets, filteredLG: lgChipsets };
    }, [chipsets, searchQuery]);

    const handleSelect = (chipsetId: string) => {
        const chipset = chipsets.find(c => c.id === chipsetId);
        if (chipset) {
            // Auto-detect brand group from chipset
            const isLG = chipset.id.startsWith('LG_') || chipset.authMethod === 'standard';
            const newBrandGroup: BrandGroup = isLG ? 'lg' : 'oppo';

            // Update brand group if changed
            if (newBrandGroup !== selectedBrandGroup) {
                setSelectedBrandGroup(newBrandGroup);
            }

            // Determine auth method - LG uses 'standard', others use 'oppo_vip'
            const authMethod = chipset.authMethod === 'standard' ? 'none' :
                chipset.authMethod === 'oppo_vip' ? 'oppo_vip' : 'none';

            // Convert ChipsetEntry to DeviceProfile
            const profile: DeviceProfile = {
                id: chipset.id,
                brand: isLG ? 'lg' : 'qualcomm',
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
            <SelectContent className="p-0">
                {/* Search Input - Fixed at top, outside scrollable area */}
                <div className="flex items-center gap-2 px-3 py-2 border-b bg-popover sticky top-0 z-50">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                        placeholder={t('device.selector.search', 'Search chipset...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent px-0"
                        autoFocus
                        onKeyDown={(e) => {
                            // Prevent select from closing on Enter
                            if (e.key === 'Enter') {
                                e.preventDefault();
                            }
                        }}
                    />
                </div>

                {/* Scrollable content area */}
                <div className="p-1 max-h-[300px] overflow-y-auto">
                    {/* No results message */}
                    {filteredOppo.length === 0 && filteredLG.length === 0 && searchQuery && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            {t('device.selector.noResults', 'No chipsets found')}
                        </div>
                    )}

                    {/* Oppo/OnePlus/Realme Group */}
                    {filteredOppo.length > 0 && (
                    <SelectGroup>
                        <SelectLabel className="flex items-center gap-2 text-green-600 dark:text-green-500">
                            <Smartphone className="h-4 w-4" />
                            {t('tool.edl.brandGroup.oppoGroup', 'Oppo / OnePlus / Realme')}
                        </SelectLabel>
                        {filteredOppo.map((chipset) => (
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
                    </SelectGroup>
                )}

                {filteredOppo.length > 0 && filteredLG.length > 0 && <SelectSeparator />}

                {/* LG Group */}
                {filteredLG.length > 0 && (
                    <SelectGroup>
                        <SelectLabel className="flex items-center gap-2 text-red-600 dark:text-red-500">
                            <Zap className="h-4 w-4" />
                            {t('tool.edl.brandGroup.lgGroup', 'LG')}
                        </SelectLabel>
                        {filteredLG.map((chipset) => (
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
                    </SelectGroup>
                )}
                </div>
            </SelectContent>
        </Select>
    );
}
