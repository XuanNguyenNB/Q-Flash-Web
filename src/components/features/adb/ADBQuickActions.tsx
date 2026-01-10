/**
 * ADBQuickActions Component
 * 
 * Provides quick access to common ADB reboot commands:
 * - Reboot to EDL
 * - Reboot to Fastboot
 * - Reboot to Recovery
 * - Reboot to System
 * - Power Off
 * 
 * Story: 7.4 - ADB Quick Actions
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { trackEvent } from '@/services/analytics';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { useADBStore } from '@/stores/adbStore';

// Hooks
import { useADB } from '@/hooks/useADB';

// Components
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Icons
import { Zap, Wrench, RefreshCw, Power, Loader2 } from 'lucide-react';

// Utils
import { cn } from '@/lib/utils';

interface ADBQuickActionsProps {
    className?: string;
}

export function ADBQuickActions({ className }: ADBQuickActionsProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
    const [showEDLConfirm, setShowEDLConfirm] = useState(false);
    const [showFastbootConfirm, setShowFastbootConfirm] = useState(false);

    // Store state
    const { isConnected } = useDeviceStore();
    const { pendingOperation } = useADBStore(); // Tracks current operation name

    // ADB hook
    const { rebootToEDL, rebootToBootloader, rebootToFastbootD, rebootToRecovery, reboot, shutdown } = useADB();

    /**
     * Handle reboot action with optional navigation
     */
    const handleAction = async (
        actionFn: () => Promise<boolean>,
        actionName: string,
        navigateTo?: string
    ) => {
        try {
            const success = await actionFn();
            if (success) {
                trackEvent('adb', actionName, useADBStore.getState().deviceInfo?.model || 'unknown');
                toast.success(t(`adb.toast.${actionName}Success`, `${actionName} command sent successfully`));
                // Navigate to target page after reboot
                if (navigateTo) {
                    setTimeout(() => navigate(navigateTo), 500);
                }
            } else {
                toast.error(t(`adb.toast.${actionName}Failed`, `Failed to execute ${actionName}`));
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            toast.error(t('adb.toast.actionFailed', 'Action failed: {{message}}', { message }));
        }
    };

    const confirmShutdown = () => {
        setShowShutdownConfirm(false);
        handleAction(shutdown, 'shutdown');
    };

    const confirmRebootEDL = () => {
        setShowEDLConfirm(false);
        handleAction(rebootToEDL, 'rebootEDL', '/edl');
    };

    const confirmRebootFastboot = () => {
        setShowFastbootConfirm(false);
        handleAction(rebootToBootloader, 'rebootBootloader', '/fastboot');
    };

    return (
        <>
            <Card className={cn("h-full", className)}>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        {t('adb.features.quickActions', 'Quick Actions')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {/* Reboot EDL */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        disabled={!isConnected || !!pendingOperation}
                        onClick={() => setShowEDLConfirm(true)}
                    >
                        {pendingOperation === 'rebootToEDL' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Zap className="h-4 w-4 text-yellow-500" />
                        )}
                        {t('adb.actions.rebootEDL', 'Reboot EDL')}
                    </Button>

                    {/* Reboot Fastboot */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        disabled={!isConnected || !!pendingOperation}
                        onClick={() => setShowFastbootConfirm(true)}
                    >
                        {pendingOperation === 'rebootToBootloader' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Wrench className="h-4 w-4 text-orange-500" />
                        )}
                        {t('adb.actions.rebootBootloader', 'Reboot Bootloader')}
                    </Button>

                    {/* Reboot FastbootD */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        disabled={!isConnected || !!pendingOperation}
                        onClick={() => handleAction(rebootToFastbootD, 'rebootFastbootD', '/fastboot')}
                    >
                        {pendingOperation === 'rebootToFastbootD' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Wrench className="h-4 w-4 text-purple-500" />
                        )}
                        {t('adb.actions.rebootFastbootD', 'Reboot FastbootD')}
                    </Button>

                    {/* Reboot Recovery */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        disabled={!isConnected || !!pendingOperation}
                        onClick={() => handleAction(rebootToRecovery, 'rebootRecovery')}
                    >
                        {pendingOperation === 'rebootToRecovery' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 text-blue-500" />
                        )}
                        {t('adb.actions.rebootRecovery', 'Reboot Recovery')}
                    </Button>

                    {/* Reboot System */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11"
                        disabled={!isConnected || !!pendingOperation}
                        onClick={() => handleAction(reboot, 'rebootSystem')}
                    >
                        {pendingOperation === 'reboot' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4 text-green-500" />
                        )}
                        {t('adb.actions.rebootSystem', 'Reboot System')}
                    </Button>

                    {/* Power Off */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-11 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={!isConnected || !!pendingOperation}
                        onClick={() => setShowShutdownConfirm(true)}
                    >
                        {pendingOperation === 'shutdown' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Power className="h-4 w-4" />
                        )}
                        {t('adb.actions.powerOff', 'Power Off')}
                    </Button>
                </CardContent>
                <CardFooter>
                    <p className="text-xs text-muted-foreground w-full text-center italic">
                        {t('adb.actions.hint', 'After reboot, switch to the appropriate mode tab')}
                    </p>
                </CardFooter>
            </Card>

            {/* Shutdown Confirmation Dialog */}
            <AlertDialog open={showShutdownConfirm} onOpenChange={setShowShutdownConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('adb.shutdown.title', 'Power Off Device?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('adb.shutdown.description', 'Are you sure you want to power off the device? You will need to manually turn it back on.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmShutdown}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t('adb.actions.powerOff', 'Power Off')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reboot to EDL Confirmation Dialog */}
            <AlertDialog open={showEDLConfirm} onOpenChange={setShowEDLConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('adb.rebootEDL.title', 'Reboot to EDL Mode?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('adb.rebootEDL.description', 'This will reboot your device into EDL (Emergency Download) mode. You will need to reconnect the device in EDL mode to continue flashing.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRebootEDL}>
                            {t('common.confirm', 'Confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reboot to Fastboot Confirmation Dialog */}
            <AlertDialog open={showFastbootConfirm} onOpenChange={setShowFastbootConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('adb.rebootFastboot.title', 'Reboot to Fastboot Mode?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('adb.rebootFastboot.description', 'This will reboot your device into Fastboot mode. The app will automatically switch to Fastboot page after rebooting.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRebootFastboot}>
                            {t('common.confirm', 'Confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
