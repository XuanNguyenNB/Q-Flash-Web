/**
 * BootloaderActions Component
 * 
 * Provides functionalities to unlock and lock the bootloader.
 * Include critical confirmation dialogs before execution.
 * 
 * Story: 8.4 - Bootloader Unlock/Lock Buttons
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, AlertTriangle, ArrowDown, Power } from 'lucide-react';
import { toast } from 'sonner';
import { trackEvent } from '@/services/analytics';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { useFastbootStore } from '@/stores/fastbootStore';

// Hooks
import { useFastboot } from '@/hooks/useFastboot';

// Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface BootloaderActionsProps {
    className?: string;
}

export function BootloaderActions({ className }: BootloaderActionsProps) {
    const { t } = useTranslation();
    const [showUnlockDialog, setShowUnlockDialog] = useState(false);
    const [showLockDialog, setShowLockDialog] = useState(false);
    const [showUnlockInstructionDialog, setShowUnlockInstructionDialog] = useState(false);
    const [showLockInstructionDialog, setShowLockInstructionDialog] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Store state
    const { isConnected } = useDeviceStore();
    const { deviceInfo } = useFastbootStore();

    // Fastboot hook
    const { unlockBootloader, lockBootloader, getDeviceInfo, pendingOperation } = useFastboot();

    // Device state
    const isUnlocked = deviceInfo?.unlocked ?? false;

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleUnlock = async () => {
        setShowUnlockDialog(false);
        setIsLoading(true);
        try {
            const success = await unlockBootloader();
            if (success) {
                trackEvent('fastboot', 'unlock_bootloader', deviceInfo?.product || 'unknown');
                toast.success(t('fastboot.bootloader.unlockSuccess', 'Unlock command sent! Check device screen to confirm.'));
                setShowUnlockInstructionDialog(true);
                // Refresh device info after a delay to allow device to process
                setTimeout(() => getDeviceInfo(), 5000);
            } else {
                toast.error(t('fastboot.bootloader.unlockFailed', 'Failed to send unlock command'));
            }
        } catch (error) {
            toast.error(t('common.error', 'Error') + ': ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsLoading(false);
        }
    };

    const handleLock = async () => {
        setShowLockDialog(false);
        setIsLoading(true);
        try {
            const success = await lockBootloader();
            if (success) {
                trackEvent('fastboot', 'lock_bootloader', deviceInfo?.product || 'unknown');
                toast.success(t('fastboot.bootloader.lockSuccess', 'Lock command sent! Check device screen to confirm.'));
                setShowLockInstructionDialog(true);
                setTimeout(() => getDeviceInfo(), 5000);
            } else {
                toast.error(t('fastboot.bootloader.lockFailed', 'Failed to send lock command'));
            }
        } catch (error) {
            toast.error(t('common.error', 'Error') + ': ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsLoading(false);
        }
    };

    // If not connected, disable buttons
    const isDisabled = !isConnected || isLoading || !deviceInfo || !!pendingOperation;

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {isUnlocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    {t('fastboot.features.unlock', 'Bootloader Actions')}
                </CardTitle>
                <CardDescription>
                    {t('fastboot.bootloader.description', 'Manage device bootloader lock state')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Status Banner */}
                <div className={`p-3 rounded-lg border flex items-center gap-3 ${isUnlocked
                    ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
                    }`}>
                    {isUnlocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    <div className="flex-1">
                        <p className="font-medium text-sm">
                            {isUnlocked
                                ? t('fastboot.bootloader.unlocked', 'Bootloader is UNLOCKED')
                                : t('fastboot.bootloader.locked', 'Bootloader is LOCKED')
                            }
                        </p>
                    </div>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Unlock Button */}
                    <Button
                        onClick={() => setShowUnlockDialog(true)}
                        disabled={isDisabled || isUnlocked || deviceInfo?.isUserspace}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                        variant="default"
                    >
                        <Unlock className="mr-2 h-4 w-4" />
                        {isLoading ? t('common.processing', 'Processing...') : t('fastboot.bootloader.unlock', 'Unlock Bootloader')}
                    </Button>

                    {/* Lock Button */}
                    <Button
                        onClick={() => setShowLockDialog(true)}
                        disabled={isDisabled || !isUnlocked || deviceInfo?.isUserspace}
                        variant="destructive"
                        className="w-full"
                    >
                        <Lock className="mr-2 h-4 w-4" />
                        {isLoading ? t('common.processing', 'Processing...') : t('fastboot.bootloader.lock', 'Lock Bootloader')}
                    </Button>
                </div>

                {/* Warnings */}
                <div className="text-xs text-muted-foreground pt-2 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                        {deviceInfo?.isUserspace && (
                            <p className="font-semibold text-orange-500">
                                {t('fastboot.bootloader.userspaceWarning', 'Bootloader actions are not available in FastbootD mode. Please reboot to Bootloader mode.')}
                            </p>
                        )}
                        <p>
                            {t('fastboot.bootloader.warning', 'Changing bootloader state will factory reset your device and erase all data. Please backup important data first.')}
                        </p>
                    </div>
                </div>
            </CardContent>

            {/* Unlock Confirmation Dialog */}
            <AlertDialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>⚠️ {t('fastboot.bootloader.unlockTitle', 'Unlock Bootloader?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            <div className="space-y-3 pt-2">
                                <p className="text-destructive font-semibold">
                                    {t('fastboot.bootloader.dataWarning', 'WARNING: This will ERASE ALL DATA on your device!')}
                                </p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>{t('fastboot.bootloader.warning1', 'All apps, photos, and files will be deleted')}</li>
                                    <li>{t('fastboot.bootloader.warning2', 'Device will undergo factory reset')}</li>
                                    <li>{t('fastboot.bootloader.warning3', 'You must confirm the action on the device screen')}</li>
                                    <li>{t('fastboot.bootloader.warning4', 'Device security features may be disabled')}</li>
                                </ul>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleUnlock}
                            className="bg-amber-500 hover:bg-amber-600"
                        >
                            {t('fastboot.bootloader.confirmUnlock', 'Yes, Unlock Bootloader')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Unlock Instruction Dialog (Post-Action) */}
            <Dialog open={showUnlockInstructionDialog} onOpenChange={setShowUnlockInstructionDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-500">
                            <AlertTriangle className="h-5 w-5" />
                            {t('fastboot.bootloader.unlockInstructionTitle', 'Physical Confirmation Required')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('fastboot.bootloader.unlockInstructionInfo', 'You must perform these steps on the device screen immediately.')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Simulation of Phone Screen */}
                        <div className="bg-black text-white p-4 rounded-lg font-mono text-xs border-4 border-gray-800 shadow-xl relative">
                            {/* Screen Bezel Notches/Cameras simulation */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-3 bg-gray-800 rounded-b-lg"></div>

                            <div className="mt-4 space-y-4">
                                <p className="text-red-500 font-bold uppercase text-center border-b border-gray-700 pb-2">Unlock Bootloader?</p>
                                <p className="text-gray-400">If you unlock the bootloader, you will be able to install custom operating system software on this phone.</p>
                                <p className="text-gray-400">A custom OS is not subject to the same testing as the original OS, and can cause your phone and installed applications to stop working properly.</p>
                                <p className="text-gray-400">To prevent unauthorized access to your personal data, unlocking the bootloader will also delete all personal data from your phone (a "factory data reset").</p>
                                <p className="text-gray-400">Press the Volume Up/Down keys to select an option, and the Power key to confirm.</p>

                                <div className="space-y-1 mt-4">
                                    <p>Do not unlock the bootloader</p>
                                    <div className="bg-blue-600 text-white px-1">Unlock the bootloader</div>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    <ArrowDown className="h-4 w-4" />
                                </div>
                                <p className="text-sm pt-1.5">
                                    {t('fastboot.bootloader.unlockInstruction1', "Press Volume Down key to select 'Unlock the bootloader'")}
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    <Power className="h-4 w-4" />
                                </div>
                                <p className="text-sm pt-1.5">
                                    {t('fastboot.bootloader.unlockInstruction2', "Press Power key to confirm")}
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setShowUnlockInstructionDialog(false)} className="w-full">
                            {t('common.done', 'Done')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Lock Confirmation Dialog */}
            <AlertDialog open={showLockDialog} onOpenChange={setShowLockDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>🔒 {t('fastboot.bootloader.lockTitle', 'Lock Bootloader?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            <div className="space-y-3 pt-2">
                                <p className="text-destructive font-semibold">
                                    {t('fastboot.bootloader.dataWarning', 'WARNING: This will ERASE ALL DATA on your device!')}
                                </p>
                                <p>
                                    {t('fastboot.bootloader.lockWarning', 'Locking the bootloader will restore device security features. Ensure you have stock firmware installed effectively before locking to avoid bricking.')}
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleLock}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {t('fastboot.bootloader.confirmLock', 'Yes, Lock Bootloader')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Lock Instruction Dialog (Post-Action) */}
            <Dialog open={showLockInstructionDialog} onOpenChange={setShowLockInstructionDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-500">
                            <Lock className="h-5 w-5" />
                            {t('fastboot.bootloader.lockInstructionTitle', 'Physical Confirmation Required')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('fastboot.bootloader.lockInstructionInfo', 'You must perform these steps on the device screen immediately.')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Simulation of Phone Screen */}
                        <div className="bg-black text-white p-4 rounded-lg font-mono text-xs border-4 border-gray-800 shadow-xl relative">
                            {/* Screen Bezel Notches/Cameras simulation */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-3 bg-gray-800 rounded-b-lg"></div>

                            <div className="mt-4 space-y-4">
                                <p className="text-red-500 font-bold uppercase text-center border-b border-gray-700 pb-2">Lock Bootloader?</p>
                                <p className="text-gray-400">If you lock the bootloader, you will not be able to install custom operating system software on this phone.</p>
                                <p className="text-gray-400">Locking will restore device security and prevent unauthorized modifications.</p>
                                <p className="text-gray-400 text-red-400 font-semibold">⚠️ All data will be erased (factory reset).</p>
                                <p className="text-gray-400">Press the Volume Up/Down keys to select an option, and the Power key to confirm.</p>

                                <div className="space-y-1 mt-4">
                                    <p>Do not lock the bootloader</p>
                                    <div className="bg-red-600 text-white px-1">Lock the bootloader</div>
                                </div>
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    <ArrowDown className="h-4 w-4" />
                                </div>
                                <p className="text-sm pt-1.5">
                                    {t('fastboot.bootloader.lockInstruction1', "Press Volume Down key to select 'Lock the bootloader'")}
                                </p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    <Power className="h-4 w-4" />
                                </div>
                                <p className="text-sm pt-1.5">
                                    {t('fastboot.bootloader.lockInstruction2', "Press Power key to confirm")}
                                </p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setShowLockInstructionDialog(false)} className="w-full">
                            {t('common.done', 'Done')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
