/**
 * DonateDialog Component
 *
 * Popup mời gọi donate sau khi hoàn thành workflow.
 * Hiển thị QR MoMo và thông tin chuyển khoản ngân hàng.
 */

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Heart,
  Copy,
  Check,
  Sparkles,
  X,
  Smartphone,
  Building2,
} from 'lucide-react';

interface DonateDialogProps {
  open: boolean;
  onClose: () => void;
  workflowName?: string;
}

// Bank info for donation (from DonatePage)
const BANK_INFO = {
  bankName: 'MB Bank',
  accountNumber: '2070108213983',
  accountName: 'TA XUAN NGUYEN',
};

// MoMo info
const MOMO_INFO = {
  accountNumber: '0899813596',
  accountName: 'TA XUAN NGUYEN',
  qrImage: '/images/QR_MOMO.jpg',
};

export function DonateDialog({ open, onClose, workflowName }: DonateDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                <Sparkles className="w-6 h-6 text-pink-500" />
              </div>
              <AlertDialogTitle className="text-xl">
                Hoàn thành xuất sắc!
              </AlertDialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <AlertDialogDescription className="text-base text-muted-foreground pt-2">
            {workflowName ? (
              <>Bạn đã hoàn thành quy trình <strong>"{workflowName}"</strong> thành công!</>
            ) : (
              <>Bạn đã hoàn thành quy trình thành công!</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Message */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20">
            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-pink-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">
                  Q-Flash được phát triển miễn phí
                </p>
                <p className="text-muted-foreground text-xs">
                  Nếu công cụ này hữu ích với bạn, hãy cân nhắc ủng hộ để mình tiếp tục phát triển nhé!
                </p>
              </div>
            </div>
          </div>

          {/* MoMo QR Code */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-pink-500" />
              Ví MoMo
            </p>

            <div className="p-3 rounded-lg bg-gradient-to-br from-pink-500/10 to-rose-500/5 border border-pink-500/20">
              {/* QR Code */}
              <div className="bg-white rounded-lg p-2 mb-3 flex items-center justify-center">
                <img
                  src={MOMO_INFO.qrImage}
                  alt="MoMo QR Code"
                  className="w-40 h-40 object-contain rounded"
                />
              </div>

              {/* MoMo Account Info */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">SĐT:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium">{MOMO_INFO.accountNumber}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopy(MOMO_INFO.accountNumber, 'momo')}
                    >
                      {copiedField === 'momo' ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tên:</span>
                  <span className="text-sm font-medium">{MOMO_INFO.accountName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Transfer Info */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              Chuyển khoản ngân hàng
            </p>

            <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 space-y-1.5">
              {/* Bank Name */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ngân hàng:</span>
                <span className="text-sm font-medium">{BANK_INFO.bankName}</span>
              </div>

              {/* Account Number */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">STK:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-medium">{BANK_INFO.accountNumber}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopy(BANK_INFO.accountNumber, 'bank')}
                  >
                    {copiedField === 'bank' ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Account Name */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tên:</span>
                <span className="text-sm font-medium">{BANK_INFO.accountName}</span>
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Để sau
          </Button>
          <Button
            onClick={() => {
              handleCopy(MOMO_INFO.accountNumber, 'momo');
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy SĐT MoMo
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
