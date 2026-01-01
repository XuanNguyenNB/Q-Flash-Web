/**
 * DeviceInUseDialog Component
 * 
 * Displays a clear, user-friendly dialog when an ADB device 
 * is already being used by another program.
 */

import { useTranslation } from 'react-i18next';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Usb, Terminal, X } from 'lucide-react';

interface DeviceInUseDialogProps {
    open: boolean;
    onClose: () => void;
}

export function DeviceInUseDialog({ open, onClose }: DeviceInUseDialogProps) {
    const { t } = useTranslation();

    return (
        <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                        </div>
                        <AlertDialogTitle className="text-xl">
                            {t('adb.toast.deviceInUse.title', 'Thiết bị đang được sử dụng')}
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-base text-muted-foreground">
                        {t('adb.toast.deviceInUse.subtitle', 'Thiết bị đang bị chiếm bởi chương trình khác trên máy tính. Hãy thử các cách sau để giải quyết:')}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-4">
                    {/* Step 1 */}
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">
                            1
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-medium mb-1">
                                <Usb className="w-4 h-4" />
                                {t('adb.deviceInUse.step1.title', 'Ngắt kết nối USB')}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t('adb.deviceInUse.step1.desc', 'Rút cáp USB ra khỏi điện thoại, đợi 3-5 giây rồi cắm lại.')}
                            </p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">
                            2
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-medium mb-1">
                                <Terminal className="w-4 h-4" />
                                {t('adb.deviceInUse.step2.title', 'Tắt ADB Server')}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                                {t('adb.deviceInUse.step2.desc', 'Mở Terminal/CMD và chạy lệnh sau:')}
                            </p>
                            <code className="block px-3 py-2 rounded bg-black/50 text-green-400 font-mono text-sm select-all">
                                adb kill-server
                            </code>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm shrink-0">
                            3
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-medium mb-1">
                                <X className="w-4 h-4" />
                                {t('adb.deviceInUse.step3.title', 'Đóng ứng dụng ADB khác')}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t('adb.deviceInUse.step3.desc', 'Đóng các ứng dụng như Android Studio, Scrcpy, Phone Link, hoặc các tool flash khác.')}
                            </p>
                        </div>
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogAction onClick={onClose} className="w-full sm:w-auto">
                        {t('common.confirm', 'Đã hiểu')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
