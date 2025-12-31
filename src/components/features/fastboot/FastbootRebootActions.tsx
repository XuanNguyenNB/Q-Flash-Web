/**
 * FastbootRebootActions Component
 * 
 * Provides quick reboot actions: System, Recovery, Bootloader, FastbootD
 * 
 * Story: 8.6 - Fastboot Page Layout Enhancement
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Smartphone, HardDrive, Wrench, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';

// Hooks
import { useFastboot } from '@/hooks/useFastboot';

// Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FastbootRebootActionsProps {
    className?: string;
}

type RebootAction = 'system' | 'bootloader' | 'recovery' | 'fastbootd';

export function FastbootRebootActions({ className }: FastbootRebootActionsProps) {
    const { t } = useTranslation();
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    // Store state
    const { isConnected } = useDeviceStore();

    // Fastboot hook
    const { reboot, rebootBootloader, rebootRecovery, rebootFastbootd, pendingOperation } = useFastboot();

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleReboot = async (action: RebootAction) => {
        setLoadingAction(action);
        try {
            let success = false;
            switch (action) {
                case 'system':
                    success = await reboot();
                    break;
                case 'bootloader':
                    success = await rebootBootloader();
                    break;
                case 'recovery':
                    success = await rebootRecovery();
                    break;
                case 'fastbootd':
                    success = await rebootFastbootd();
                    break;
            }

            if (success) {
                toast.success(t(`fastboot.reboot.${action}Success`, `Rebooting to ${action}...`));
            } else {
                toast.error(t(`fastboot.reboot.${action}Failed`, `Failed to reboot to ${action}`));
            }
        } catch (error) {
            toast.error(t('common.error', 'Error') + ': ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setLoadingAction(null);
        }
    };

    // ========================================================================
    // Render
    // ========================================================================

    const rebootOptions = [
        {
            id: 'system' as RebootAction,
            icon: Smartphone,
            label: t('fastboot.reboot.system', 'System'),
            desc: t('fastboot.reboot.systemDesc', 'Normal boot'),
            color: 'text-green-500',
            bgColor: 'hover:bg-green-500/10',
        },
        {
            id: 'recovery' as RebootAction,
            icon: HardDrive,
            label: t('fastboot.reboot.recovery', 'Recovery'),
            desc: t('fastboot.reboot.recoveryDesc', 'Recovery mode'),
            color: 'text-blue-500',
            bgColor: 'hover:bg-blue-500/10',
        },
        {
            id: 'bootloader' as RebootAction,
            icon: Wrench,
            label: t('fastboot.reboot.bootloader', 'Bootloader'),
            desc: t('fastboot.reboot.bootloaderDesc', 'Stay in Fastboot'),
            color: 'text-orange-500',
            bgColor: 'hover:bg-orange-500/10',
        },
        {
            id: 'fastbootd' as RebootAction,
            icon: Zap,
            label: t('fastboot.reboot.fastbootd', 'FastbootD'),
            desc: t('fastboot.reboot.fastbootdDesc', 'Userspace Fastboot'),
            color: 'text-purple-500',
            bgColor: 'hover:bg-purple-500/10',
        },
    ];

    return (
        <Card className={cn(className)}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                    <RotateCcw className="h-5 w-5 text-primary" />
                    {t('fastboot.features.reboot', 'Reboot Options')}
                </CardTitle>
                <CardDescription>
                    {t('fastboot.features.rebootDesc', 'Reboot to system, recovery, or bootloader')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-3">
                    {rebootOptions.map((option) => (
                        <Button
                            key={option.id}
                            variant="outline"
                            className={cn(
                                "h-auto py-4 flex flex-col gap-2 items-center justify-center border",
                                option.bgColor
                            )}
                            onClick={() => handleReboot(option.id)}
                            disabled={!isConnected || loadingAction !== null || !!pendingOperation}
                        >
                            {loadingAction === option.id ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <option.icon className={cn("h-6 w-6", option.color)} />
                            )}
                            <div className="text-center space-y-0.5">
                                <span className="font-semibold block text-sm">{option.label}</span>
                                <span className="text-xs text-muted-foreground block">{option.desc}</span>
                            </div>
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
