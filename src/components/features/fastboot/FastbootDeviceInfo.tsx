/**
 * FastbootDeviceInfo Component
 * 
 * Displays device variables panel with bootloader status, device info,
 * and refresh functionality for Fastboot mode.
 * 
 * Story: 8.3 - Fastboot Device Variables Panel
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Info, Lock, Unlock, Smartphone, Battery, Cpu, Hash } from 'lucide-react';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { useFastbootStore } from '@/stores/fastbootStore';

// Hooks
import { useFastboot } from '@/hooks/useFastboot';

// Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Utils
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface FastbootDeviceInfoProps {
    className?: string;
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Bootloader status badge component
 */
function BootloaderBadge({ unlocked }: { unlocked?: boolean }) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
                {unlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {t('fastboot.variables.bootloader', 'Bootloader')}
            </span>
            <span
                className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold",
                    unlocked
                        ? "bg-green-500/20 text-green-500 border border-green-500/30"
                        : "bg-red-500/20 text-red-500 border border-red-500/30"
                )}
            >
                {unlocked
                    ? `🔓 ${t('fastboot.variables.unlocked', 'Unlocked')}`
                    : `🔒 ${t('fastboot.variables.locked', 'Locked')}`
                }
            </span>
        </div>
    );
}

/**
 * Info row component for displaying key-value pairs
 */
function InfoRow({
    icon,
    label,
    value,
    valueClassName,
}: {
    icon?: React.ReactNode;
    label: string;
    value?: string | number;
    valueClassName?: string;
}) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
                {icon}
                {label}
            </span>
            <span className={cn("text-sm font-medium text-foreground", valueClassName)}>
                {value ?? '-'}
            </span>
        </div>
    );
}

/**
 * Empty state when device is not connected
 */
function EmptyState() {
    const { t } = useTranslation();

    return (
        <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Info className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                        {t('fastboot.variables.empty.title', 'No Device Connected')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {t('fastboot.variables.empty.description', 'Connect a device in Fastboot mode to view variables')}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * FastbootDeviceInfo - Device variables panel for Fastboot mode
 * 
 * Features:
 * - Displays device product, variant, serial, bootloader status
 * - Shows secure boot, slot, and battery level
 * - Refresh button to re-fetch variables
 * - Empty state when disconnected
 */
export function FastbootDeviceInfo({ className }: FastbootDeviceInfoProps) {
    const { t } = useTranslation();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Store state
    const { isConnected } = useDeviceStore();
    const { deviceInfo } = useFastbootStore();

    // Fastboot hook
    const { getDeviceInfo } = useFastboot();

    // ========================================================================
    // Event Handlers
    // ========================================================================

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await getDeviceInfo();
        } finally {
            setIsRefreshing(false);
        }
    }, [getDeviceInfo]);

    // ========================================================================
    // Render
    // ========================================================================

    // Show empty state when not connected
    if (!isConnected || !deviceInfo) {
        return <EmptyState />;
    }

    return (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Info className="h-4 w-4 text-orange-500" />
                    {t('fastboot.variables.title', 'Device Variables')}
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="h-8 w-8"
                >
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
            </CardHeader>
            <CardContent className="space-y-1">
                {/* Mode */}
                <InfoRow
                    label={t('fastboot.variables.mode', 'Connection Mode')}
                    value={deviceInfo.isUserspace ? 'FastbootD (Userspace)' : 'Fastboot (Bootloader)'}
                    valueClassName={deviceInfo.isUserspace ? 'text-blue-500 font-bold' : 'text-orange-500'}
                />

                {/* Product */}
                <InfoRow
                    icon={<Smartphone className="h-4 w-4" />}
                    label={t('fastboot.variables.product', 'Product')}
                    value={deviceInfo.product}
                />

                {/* Variant */}
                <InfoRow
                    icon={<Cpu className="h-4 w-4" />}
                    label={t('fastboot.variables.variant', 'Variant')}
                    value={deviceInfo.variant}
                />

                {/* Serial Number */}
                <InfoRow
                    icon={<Hash className="h-4 w-4" />}
                    label={t('fastboot.variables.serial', 'Serial')}
                    value={deviceInfo.serialno}
                    valueClassName="font-mono text-xs"
                />

                {/* Bootloader Status - Prominent Badge */}
                <BootloaderBadge unlocked={deviceInfo.unlocked} />

                {/* Secure Boot */}
                <InfoRow
                    label={t('fastboot.variables.secure', 'Secure Boot')}
                    value={deviceInfo.secure
                        ? t('common.yes', 'Yes')
                        : t('common.no', 'No')
                    }
                    valueClassName={deviceInfo.secure ? 'text-green-500' : 'text-yellow-500'}
                />

                {/* Current Slot */}
                <InfoRow
                    label={t('fastboot.variables.slot', 'Slot')}
                    value={`${deviceInfo.currentSlot.toUpperCase()} ${parseInt(String(deviceInfo.slotCount)) === 2 ? '(A/B)' : ''}`}
                />



                {/* Off-Mode Charge */}
                <InfoRow
                    label={t('fastboot.variables.offModeCharge', 'Off-Mode Charge')}
                    value={deviceInfo.offModeCharge
                        ? t('common.enabled', 'Enabled')
                        : t('common.disabled', 'Disabled')
                    }
                />
            </CardContent>
        </Card>
    );
}
