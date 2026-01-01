/**
 * UserGestureRequiredDialog Component
 * 
 * Displays when WebUSB requires a user gesture (click) to request device permission.
 * This happens when auto-connect is attempted without user interaction.
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
import { MousePointerClick, Info, Usb } from 'lucide-react';

interface UserGestureRequiredDialogProps {
    open: boolean;
    onClose: () => void;
}

export function UserGestureRequiredDialog({ open, onClose }: UserGestureRequiredDialogProps) {
    const { t } = useTranslation();

    return (
        <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20">
                            <MousePointerClick className="w-6 h-6 text-blue-500" />
                        </div>
                        <AlertDialogTitle className="text-xl">
                            {t('adb.userGesture.title', 'Cần nhấn nút kết nối')}
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-base text-muted-foreground">
                        {t('adb.userGesture.subtitle', 'Trình duyệt yêu cầu bạn phải nhấn nút để cho phép kết nối USB. Điều này là bắt buộc vì lý do bảo mật.')}
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
                                {t('adb.userGesture.step1.title', 'Cắm cáp USB')}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t('adb.userGesture.step1.desc', 'Đảm bảo điện thoại đã được cắm cáp USB và đã bật USB Debugging.')}
                            </p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-primary/10 border-2 border-primary/30 hover:bg-primary/20 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                            2
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-medium mb-1">
                                <MousePointerClick className="w-4 h-4" />
                                {t('adb.userGesture.step2.title', 'Nhấn nút "Kết nối ADB"')}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t('adb.userGesture.step2.desc', 'Nhấn vào nút màu xanh "Kết nối ADB" ở góc trên màn hình.')}
                            </p>
                        </div>
                    </div>

                    {/* Info note */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                            {t('adb.userGesture.info', 'Sau khi nhấn nút, trình duyệt sẽ hiển thị danh sách thiết bị. Chọn thiết bị của bạn và nhấn "Kết nối".')}
                        </p>
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
