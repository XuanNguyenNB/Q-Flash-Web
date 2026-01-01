/**
 * ADBAuthorizationDialog Component
 * 
 * Displays when waiting for the user to allow USB debugging on their phone.
 * Shows clear instructions with visual guidance.
 */

import { useTranslation, Trans } from 'react-i18next';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Smartphone, CheckSquare, Loader2, AlertTriangle } from 'lucide-react';

interface ADBAuthorizationDialogProps {
    open: boolean;
    onClose: () => void;
}

export function ADBAuthorizationDialog({ open, onClose }: ADBAuthorizationDialogProps) {
    const { t } = useTranslation();

    return (
        <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 animate-pulse">
                            <Smartphone className="w-6 h-6 text-green-500" />
                        </div>
                        <AlertDialogTitle className="text-xl">
                            {t('adb.authorization.title', 'Cho phép USB Debugging')}
                        </AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-base text-muted-foreground">
                        {t('adb.authorization.subtitle', 'Một hộp thoại sẽ xuất hiện trên màn hình điện thoại của bạn. Hãy làm theo các bước sau:')}
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
                                <Smartphone className="w-4 h-4" />
                                {t('adb.authorization.step1.title', 'Kiểm tra màn hình điện thoại')}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                <Trans i18nKey="adb.authorization.step1.desc">
                                    Một hộp thoại <strong className="text-foreground">Cho phép gỡ lỗi USB?</strong> sẽ xuất hiện trên điện thoại.
                                </Trans>
                            </p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-green-500/10 border-2 border-green-500/30 hover:bg-green-500/20 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold text-sm shrink-0">
                            2
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-medium mb-1">
                                <CheckSquare className="w-4 h-4 text-green-500" />
                                <Trans i18nKey="adb.authorization.step2.title">
                                    Tích vào <strong className="text-green-500">Luôn luôn cho phép</strong>
                                </Trans>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                <Trans i18nKey="adb.authorization.step2.desc">
                                    Tích vào ô <strong className="text-foreground">Luôn luôn cho phép máy tính này để gỡ lỗi</strong> để không phải cho phép lại lần sau.
                                </Trans>
                            </p>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-primary/10 border-2 border-primary/30 hover:bg-primary/20 transition-colors">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                            3
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-medium mb-1">
                                <Trans i18nKey="adb.authorization.step3.title">
                                    Nhấn <strong className="text-primary">Cho phép</strong> hoặc <strong className="text-primary">OK</strong>
                                </Trans>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                <Trans i18nKey="adb.authorization.step3.desc">
                                    Nhấn nút <strong className="text-foreground">Cho phép</strong> hoặc <strong className="text-foreground">OK</strong> để kết nối. Web sẽ tự động tiếp tục.
                                </Trans>
                            </p>
                        </div>
                    </div>

                    {/* Waiting indicator */}
                    <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">{t('adb.authorization.waiting', 'Đang chờ cho phép từ điện thoại...')}</span>
                    </div>

                    {/* Troubleshooting */}
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="flex items-center gap-2 font-medium mb-2 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-4 h-4" />
                            {t('adb.authorization.troubleshoot.title', 'Nếu không thấy hộp thoại')}
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>{t('adb.authorization.troubleshoot.item1', 'Rút cáp cắm lại')}</li>
                            <li>{t('adb.authorization.troubleshoot.item2', 'Tắt/bật lại Gỡ lỗi USB')}</li>
                            <li>{t('adb.authorization.troubleshoot.item3', 'Chuyển chế độ USB (Chỉ sạc / Truyền tệp)')}</li>
                        </ul>
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogAction onClick={onClose} className="w-full sm:w-auto">
                        {t('common.cancel', 'Hủy')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
