/**
 * Fastboot Connection Guide
 * 
 * Shows instructions for entering Fastboot mode when device is disconnected.
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, Smartphone, Cable, Power, ChevronDown, Usb, Unplug } from 'lucide-react';
import { useFastboot } from '@/hooks/useFastboot';

interface FastbootGuideProps {
    onConnect: () => void;
    onDisconnect?: () => void;
    isConnected: boolean;
}

export function FastbootConnectionGuide({ onConnect, onDisconnect, isConnected }: FastbootGuideProps) {
    const { t } = useTranslation();
    const { disconnect } = useFastboot();

    const handleDisconnect = async () => {
        await disconnect();
        onDisconnect?.();
    };

    // If connected, show disconnect button
    if (isConnected) {
        return (
            <div className="flex justify-center mb-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    className="gap-2 text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                >
                    <Unplug className="h-4 w-4" />
                    {t('fastboot.disconnect', 'Ngắt kết nối Fastboot')}
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Guide Header */}
            <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                    {t('fastboot.guide.title', 'Hướng dẫn vào chế độ Fastboot')}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {t('fastboot.guide.subtitle', 'Chọn một trong các phương pháp dưới đây để đưa thiết bị vào chế độ Fastboot')}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method 1: ADB Command */}
                <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg text-blue-500">
                            <Terminal className="h-5 w-5" />
                            {t('fastboot.guide.method1.title', 'Cách 1: Dùng lệnh ADB')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">
                                    1
                                </span>
                                <div className="text-sm">
                                    <p className="text-muted-foreground">
                                        {t('fastboot.guide.method1.step1', 'Kết nối thiết bị với máy tính qua ADB (trang ADB)')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">
                                    2
                                </span>
                                <div className="text-sm space-y-2">
                                    <p className="text-muted-foreground">
                                        {t('fastboot.guide.method1.step2', 'Chạy một trong các lệnh sau:')}
                                    </p>
                                    <div className="space-y-2">
                                        <div className="bg-background/80 border rounded-md p-2">
                                            <code className="text-xs font-mono text-orange-500 font-semibold">adb reboot bootloader</code>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                → Vào Fastboot (Bootloader)
                                            </p>
                                        </div>
                                        <div className="bg-background/80 border rounded-md p-2">
                                            <code className="text-xs font-mono text-blue-500 font-semibold">adb reboot fastboot</code>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                → Vào FastbootD (Userspace)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">
                                    3
                                </span>
                                <div className="text-sm">
                                    <p className="text-muted-foreground">
                                        {t('fastboot.guide.method1.step3', 'Đợi thiết bị khởi động lại và nhấn')}
                                        {' '}
                                        <span className="font-semibold text-orange-500">Connect Fastboot</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Method 2: Hardware Keys */}
                <Card className="border-orange-500/30 bg-orange-500/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg text-orange-500">
                            <Smartphone className="h-5 w-5" />
                            {t('fastboot.guide.method2.title', 'Cách 2: Dùng phím cứng')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">
                                    1
                                </span>
                                <div className="text-sm flex items-center gap-2">
                                    <Cable className="h-4 w-4 text-red-500" />
                                    <p className="text-muted-foreground">
                                        <span className="font-semibold text-red-500">Rút cáp USB</span>
                                        {' '}ra khỏi thiết bị
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">
                                    2
                                </span>
                                <div className="text-sm flex items-center gap-2">
                                    <Power className="h-4 w-4 text-red-500" />
                                    <p className="text-muted-foreground">
                                        <span className="font-semibold text-red-500">Tắt nguồn</span>
                                        {' '}hoàn toàn
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">
                                    3
                                </span>
                                <div className="text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ChevronDown className="h-4 w-4 text-green-500" />
                                        <span className="font-semibold text-green-500">Giữ nút Giảm âm lượng</span>
                                    </div>
                                    <p className="text-muted-foreground ml-6">
                                        đồng thời
                                        <span className="font-semibold text-blue-500 ml-1">cắm cáp USB</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">
                                    4
                                </span>
                                <div className="text-sm">
                                    <p className="text-muted-foreground">
                                        Giữ đến khi màn hình hiển thị
                                        <span className="font-semibold text-orange-500 ml-1">giao diện Bootloader/Fastboot</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">
                                    5
                                </span>
                                <div className="text-sm">
                                    <p className="text-muted-foreground">
                                        Nhấn nút
                                        <span className="font-semibold text-orange-500 ml-1">Connect Fastboot</span>
                                        {' '}bên dưới
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Connect Button */}
            <div className="flex justify-center pt-4">
                <Button
                    onClick={onConnect}
                    size="lg"
                    className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg"
                >
                    <Usb className="h-5 w-5" />
                    {t('fastboot.connect', 'Connect Fastboot')}
                </Button>
            </div>

            {/* Note */}
            <div className="text-center text-xs text-muted-foreground">
                <p>
                    {t('fastboot.guide.note', '💡 Nếu cần dùng Fastboot local trên Windows, hãy nhấn "Ngắt kết nối Fastboot" sau khi kết nối.')}
                </p>
            </div>
        </div>
    );
}
