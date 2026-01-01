/**
 * EDL Troubleshoot Dialog
 * 
 * Shows troubleshooting tips when EDL connection fails.
 * Displays common causes and solutions for USB connection issues.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle, Monitor, Usb, RefreshCw, ExternalLink } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface EDLTroubleshootDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRetry?: () => void;
    errorMessage?: string;
}

/**
 * EDL connection troubleshooting dialog
 * Shows common causes and solutions for EDL connection failures
 */
export function EDLTroubleshootDialog({
    open,
    onOpenChange,
    onRetry,
    errorMessage,
}: EDLTroubleshootDialogProps) {
    const { t } = useTranslation();

    const handleRetry = () => {
        onOpenChange(false);
        onRetry?.();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                        </div>
                        <DialogTitle className="text-xl">
                            {t('edl.troubleshoot.title', 'Không thể kết nối thiết bị')}
                        </DialogTitle>
                    </div>
                    <DialogDescription className="text-base text-muted-foreground">
                        {t('edl.troubleshoot.description', 'Chưa kết nối thành công tới thiết bị. Nguyên nhân có thể là:')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Error message if provided */}
                    {errorMessage && (
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                            <p className="text-xs text-destructive font-mono">
                                {errorMessage}
                            </p>
                        </div>
                    )}

                    {/* Troubleshooting list */}
                    <div className="space-y-3">
                        {/* Reason 1: EDL mode timeout */}
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                            <RefreshCw className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium text-foreground mb-1">
                                    {t('edl.troubleshoot.reason1_title', 'Hết thời gian chờ EDL')}
                                </p>
                                <p className="text-muted-foreground">
                                    {t('edl.troubleshoot.reason1_desc', 'Quá hạn chờ của chế độ EDL trên điện thoại, bạn hãy thử vào lại chế độ EDL nhé!')}
                                </p>
                            </div>
                        </div>

                        {/* Reason 2: Driver not installed */}
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                            <Monitor className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium text-foreground mb-1">
                                    {t('edl.troubleshoot.reason2_title', 'Driver chưa được cài đặt đúng')}
                                </p>
                                <p className="text-muted-foreground">
                                    {t('edl.troubleshoot.reason2_desc', 'Hãy sử dụng Device Manager trên Windows để kiểm tra và thay đổi driver thành WinUSB (QUSB_BULK).')}
                                </p>
                            </div>
                        </div>

                        {/* Reason 3: Qualcomm QDLoader */}
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                            <Usb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium text-foreground mb-1">
                                    {t('edl.troubleshoot.reason3_title', 'Qualcomm HS-USB QDLoader 9008')}
                                </p>
                                <p className="text-muted-foreground">
                                    {t('edl.troubleshoot.reason3_desc', 'Nếu thiết bị hiển thị "Qualcomm HS-USB QDLoader 9008" trong Device Manager, hãy chuyển driver sang WinUSB thủ công hoặc bằng Zadig.')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Help link */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                        <ExternalLink className="w-3 h-3" />
                        <span>
                            {t('edl.troubleshoot.help_text', 'Xem hướng dẫn chi tiết tại trang Support của Q-Flash')}
                        </span>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.close', 'Đóng')}
                    </Button>
                    <Button onClick={handleRetry} className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        {t('connection.action.retry', 'Thử lại')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
