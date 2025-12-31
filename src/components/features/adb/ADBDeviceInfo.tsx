/**
 * ADBDeviceInfo Component
 * 
 * Displays detailed information about the connected ADB device.
 * Shows Model, Android Version, Build, Serial, Manufacturer, and Device Codename.
 * 
 * Story: 7.3 - ADB Device Info Panel
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { useADBStore } from '@/stores/adbStore';

// Hooks
import { useADB } from '@/hooks/useADB';

// Components
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Icons
import {
    Smartphone,
    RefreshCw,
    Info,
    Wifi,
    Globe,
    Battery,
    HardDrive,
    Cpu
} from 'lucide-react';

// Utils
import { cn } from '@/lib/utils';

interface ADBDeviceInfoProps {
    className?: string;
}

interface InfoItemProps {
    icon: React.ElementType;
    label: string;
    value?: string;
    subValue?: string;
}

/**
 * InfoItem - Single grid item
 */
function InfoItem({ icon: Icon, label, value, subValue }: InfoItemProps) {
    return (
        <div className="flex items-start gap-3 p-2">
            <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-foreground break-words">{value || 'Unknown'}</span>
                {subValue && <span className="text-xs text-muted-foreground/80">{subValue}</span>}
            </div>
        </div>
    );
}

/**
 * ADBDeviceInfo - Displays device properties in a card
 */
export function ADBDeviceInfo({ className }: ADBDeviceInfoProps) {
    const { t } = useTranslation();

    // Store state
    const { isConnected } = useDeviceStore();
    const { deviceInfo, isConnecting } = useADBStore();

    // ADB hook
    const { getDeviceInfo } = useADB();

    /**
     * Handle refresh button click
     */
    const handleRefresh = useCallback(async () => {
        try {
            await getDeviceInfo();
            toast.success(t('messages.deviceReady', 'Device info refreshed'));
        } catch (error) {
            // Error is handled in hook/store logging
        }
    }, [getDeviceInfo, t]);

    // Empty state when disconnected
    if (!isConnected) {
        return (
            <Card className={cn("h-full", className)}>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        {t('adb.features.deviceInfo', 'Device Information')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                        <Smartphone className="h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground">
                            {t('adb.features.deviceInfoDesc', 'Connect device to view properties')}
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("h-full", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    {t('adb.features.deviceInfo', 'Device Information')}
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={handleRefresh}
                    disabled={isConnecting}
                    title={t('common.refresh', 'Refresh')}
                >
                    <RefreshCw className={cn(
                        "h-4 w-4",
                        isConnecting && "animate-spin"
                    )} />
                </Button>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                    {/* Manufacturer */}
                    <InfoItem
                        icon={Info}
                        label={t('adb.info.manufacturer', 'Manufacturer')}
                        value={deviceInfo?.manufacturer}
                    />

                    {/* Model */}
                    <InfoItem
                        icon={Info}
                        label={t('adb.info.model', 'Model')}
                        value={deviceInfo?.model}
                        subValue={deviceInfo?.device ? `(${deviceInfo?.device})` : undefined}
                    />

                    {/* Wi-Fi */}
                    <InfoItem
                        icon={Wifi}
                        label={t('adb.info.wifi', 'Wi-Fi')}
                        value={deviceInfo?.wifiStatus || 'Not Connected'}
                    />

                    {/* IP Address */}
                    <InfoItem
                        icon={Globe}
                        label={t('adb.info.ip', 'IP Address')}
                        value={deviceInfo?.ipAddress || 'Not Connected'}
                    />

                    {/* Android Version */}
                    <InfoItem
                        icon={Smartphone}
                        label={t('adb.info.android', 'Android Version')}
                        value={deviceInfo?.androidVersion}
                        subValue={deviceInfo?.buildNumber} // Or a codename if available
                    />

                    {/* Battery */}
                    <InfoItem
                        icon={Battery}
                        label={t('adb.info.battery', 'Battery Level')}
                        value={deviceInfo?.batteryLevel}
                    // subValue={deviceInfo?.batteryStatus} // Merged into level usually
                    />

                    {/* Storage */}
                    <InfoItem
                        icon={HardDrive}
                        label={t('adb.info.storage', 'Storage Usage')}
                        value={deviceInfo?.storageUsage}
                    />

                    {/* Memory */}
                    <InfoItem
                        icon={Cpu}
                        label={t('adb.info.memory', 'Memory Usage')}
                        value={deviceInfo?.memoryUsage}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
