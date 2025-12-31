/**
 * Donate Page
 * 
 * Page for users to support the developer with donation options.
 * Shows QR codes and account details for MB Bank, Momo, and Binance.
 */

import { useTranslation } from 'react-i18next';
import { Heart, Copy, Check, Building2, Smartphone, Bitcoin } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Donation methods data
const donationMethods = [
    {
        id: 'bank',
        name: 'MB Bank',
        nameVi: 'MB Bank - NH Quân Đội',
        icon: Building2,
        color: 'blue',
        gradient: 'from-blue-500/20 to-cyan-500/10',
        border: 'border-blue-500/30',
        iconColor: 'text-blue-500',
        qrImage: '/images/QR_BANK.jpg',
        accountNumber: '2070108213983',
        accountName: 'TA XUAN NGUYEN',
        extra: 'Ngân hàng TMCP Quân đội (MB Bank)',
    },
    {
        id: 'momo',
        name: 'Momo',
        nameVi: 'Ví Momo',
        icon: Smartphone,
        color: 'pink',
        gradient: 'from-pink-500/20 to-rose-500/10',
        border: 'border-pink-500/30',
        iconColor: 'text-pink-500',
        qrImage: '/images/QR_MOMO.jpg',
        accountNumber: '0899813596',
        accountName: 'TA XUAN NGUYEN',
        extra: null,
    },
    {
        id: 'binance',
        name: 'Binance',
        nameVi: 'Binance Crypto',
        icon: Bitcoin,
        color: 'yellow',
        gradient: 'from-yellow-500/20 to-amber-500/10',
        border: 'border-yellow-500/30',
        iconColor: 'text-yellow-500',
        qrImage: '/images/QR_BINANCE.jpg',
        accountNumber: '381766288',
        accountName: 'Binance Pay ID',
        extra: null,
    },
];

export default function DonatePage() {
    const { t } = useTranslation();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="min-h-screen bg-background overflow-y-auto">
            {/* Hero Section */}
            <section className="relative overflow-hidden">
                {/* Background gradient orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-4xl mx-auto px-6 py-12 md:py-16">
                    {/* Page Header */}
                    <div className="text-center space-y-4 mb-12">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-500 text-sm font-medium">
                            <Heart className="w-4 h-4 fill-current" />
                            {t('donate.badge', 'Support the Developer')}
                        </div>

                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                            {t('donate.title', 'Donate Me')} <span className="text-pink-500">♥</span>
                        </h1>

                        <p className="text-muted-foreground max-w-xl mx-auto">
                            {t('donate.description', 'If Q-Flash Web has been helpful to you, consider supporting the development. Every contribution helps keep this project alive and growing!')}
                        </p>
                    </div>

                    {/* Donation Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {donationMethods.map((method) => {
                            const Icon = method.icon;
                            const isCopied = copiedId === method.id;

                            return (
                                <Card
                                    key={method.id}
                                    className={cn(
                                        "relative overflow-hidden transition-all duration-300",
                                        "hover:scale-[1.02] hover:-translate-y-1",
                                        `bg-gradient-to-br ${method.gradient}`,
                                        method.border,
                                        "hover:shadow-xl"
                                    )}
                                >
                                    <CardHeader className="pb-3">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center mb-2",
                                            "bg-background/80 shadow-sm ring-1 ring-border/50"
                                        )}>
                                            <Icon className={cn("w-6 h-6", method.iconColor)} />
                                        </div>
                                        <CardTitle className="text-lg">
                                            {method.nameVi}
                                        </CardTitle>
                                        {method.extra && (
                                            <CardDescription className="text-xs">
                                                {method.extra}
                                            </CardDescription>
                                        )}
                                    </CardHeader>

                                    <CardContent className="space-y-4">
                                        {/* QR Code */}
                                        <div className="bg-white rounded-lg p-3 flex items-center justify-center">
                                            <img
                                                src={method.qrImage}
                                                alt={`${method.name} QR Code`}
                                                className="w-full max-w-[180px] h-auto rounded"
                                            />
                                        </div>

                                        {/* Account Details */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2 text-sm">
                                                <span className="text-muted-foreground shrink-0">
                                                    {method.id === 'binance' ? 'Pay ID:' : t('donate.accountNumber', 'STK:')}
                                                </span>
                                                <code className="font-mono text-foreground bg-muted/50 px-2 py-1 rounded text-xs truncate">
                                                    {method.accountNumber}
                                                </code>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 text-sm">
                                                <span className="text-muted-foreground shrink-0">
                                                    {t('donate.name', 'Tên:')}
                                                </span>
                                                <span className="font-medium text-foreground text-xs truncate">
                                                    {method.accountName}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Copy Button */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full gap-2"
                                            onClick={() => handleCopy(method.accountNumber, method.id)}
                                        >
                                            {isCopied ? (
                                                <>
                                                    <Check className="w-4 h-4 text-green-500" />
                                                    {t('donate.copied', 'Đã sao chép!')}
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-4 h-4" />
                                                    {t('donate.copy', 'Sao chép số tài khoản')}
                                                </>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Thank You Message */}
                    <div className="text-center mt-12 p-6 rounded-xl bg-muted/30 border border-border/50">
                        <Heart className="w-8 h-8 text-pink-500 mx-auto mb-3 fill-current animate-pulse" />
                        <h3 className="font-semibold mb-2">
                            {t('donate.thankYou', 'Cảm ơn bạn đã ủng hộ!')}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            {t('donate.thankYouDesc', 'Mọi đóng góp của bạn giúp tôi tiếp tục phát triển và duy trì công cụ này miễn phí cho cộng đồng.')}
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
