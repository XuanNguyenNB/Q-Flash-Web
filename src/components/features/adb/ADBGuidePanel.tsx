import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
// import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, Check, ChevronRight, AlertTriangle, Settings, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEBUGGING_GUIDES, type DebuggingGuide } from '@/data/connectionGuides';

/**
 * Helper to render text with **bold** support
 */
const renderText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
    });
};

export function ADBGuidePanel() {
    const { t } = useTranslation();
    const [selectedBrandId, setSelectedBrandId] = useState<string>('oppo_realme_oneplus');
    const [includeOem, setIncludeOem] = useState(false);

    // Get current guide
    const guide = useMemo(() =>
        DEBUGGING_GUIDES.find(g => g.id === selectedBrandId) || DEBUGGING_GUIDES[0],
        [selectedBrandId]
    );

    const activeSteps = includeOem ? guide.steps.usbDebugging.oemSteps : guide.steps.usbDebugging.standardSteps;

    return (
        <Card className="h-full border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <Smartphone className="h-6 w-6 text-primary" />
                            {t('adb.guide.title', 'Enable USB Debugging')}
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {t('adb.guide.subtitle', 'Follow the instructions below to enable USB Debugging')}
                        </CardDescription>
                    </div>

                    {/* Brand Selector */}
                    <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                        <SelectTrigger className="w-full md:w-[320px] h-10 bg-background">
                            <SelectValue placeholder={t('adb.guide.label.brand', 'Select Brand')} />
                        </SelectTrigger>
                        <SelectContent>
                            {DEBUGGING_GUIDES.map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                    {t(`adb.guide.brand.${g.id}`, g.brand)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>

            <CardContent className="px-0 space-y-6">
                {/* Info Bar: Brand Info & OEM Toggle */}
                <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex-1 flex flex-col justify-center gap-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Settings className="h-3.5 w-3.5" />
                            <span>System: <span className="font-medium text-foreground">{guide.osName}</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>Version: <span className="font-medium text-foreground">{guide.androidVersions}</span></span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-background px-4 py-2 rounded-md border border-border shadow-sm">
                        <div className="space-y-0.5">
                            <Label htmlFor="oem-mode" className={cn("text-sm font-medium", includeOem ? "text-purple-500" : "text-foreground")}>
                                {t('adb.guide.includeOem', 'OEM Unlock')}
                            </Label>
                        </div>
                        <Switch
                            id="oem-mode"
                            checked={includeOem}
                            onCheckedChange={setIncludeOem}
                            className="data-[state=checked]:bg-purple-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Instructions */}
                    <div className="space-y-6">
                        {/* Step 1: Developer Options */}
                        <div className="relative pl-6 border-l-2 border-primary/20 pb-2">
                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary ring-4 ring-background" />
                            <h3 className="font-semibold text-lg flex items-center gap-2 text-primary mb-3">
                                1. {t(guide.steps.developerOptions.title, 'Enable Developer Options')}
                            </h3>
                            <ul className="space-y-2.5">
                                {guide.steps.developerOptions.instructions.map((stepKey, idx) => (
                                    <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                                        <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>{renderText(t(stepKey))}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Step 2: USB Debugging */}
                        <div className="relative pl-6 border-l-2 border-purple-500/20 pb-2">
                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-indigo-500 ring-4 ring-background" />
                            <h3 className="font-semibold text-lg flex items-center gap-2 text-indigo-500 mb-3">
                                2. {t(guide.steps.usbDebugging.title, 'Enable USB Debugging')}
                                {includeOem && <Badge variant="secondary" className="ml-2 text-xs bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-200/20">OEM + Debug</Badge>}
                            </h3>
                            <ul className="space-y-2.5">
                                {activeSteps.map((stepKey, idx) => (
                                    <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                                        <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
                                        <span>{renderText(t(stepKey))}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Right Column: Authorization & Verification */}
                    <div className="space-y-6">
                        {/* Step 3: Connect USB and Choose Device */}
                        <div className="relative pl-6 border-l-2 border-green-500/20 pb-2">
                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-green-500 ring-4 ring-background" />
                            <h3 className="font-semibold text-lg flex items-center gap-2 text-green-500 mb-3">
                                3. {t('adb.guide.step3Title', 'Bước 3: Kết nối USB và chọn thiết bị')}
                            </h3>

                            <div className="bg-muted/30 rounded-lg p-4 border border-border/60">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {renderText(t('adb.guide.step3.desc', 'Tiến hành cắm cáp kết nối USB với máy tính, sau đó ấn nút **Kết nối ADB** màu xanh. Màn hình trình duyệt sẽ hiện ra bảng danh sách thiết bị, hãy chọn thiết bị của bạn rồi ấn **OK**.'))}
                                </p>
                            </div>
                        </div>

                        {/* Step 4: Allow on Phone */}
                        <div className="relative pl-6 border-l-2 border-blue-500/20 pb-2">
                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-blue-500 ring-4 ring-background" />
                            <h3 className="font-semibold text-lg flex items-center gap-2 text-blue-500 mb-3">
                                4. {t('adb.guide.step4Title', 'Bước 4: Cho phép kết nối trên điện thoại')}
                            </h3>

                            <div className="bg-muted/30 rounded-lg p-4 border border-border/60">
                                <div className="flex gap-4">
                                    <div className="flex-1 space-y-3">
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {renderText(t('adb.guide.step4.desc', 'Một hộp thoại sẽ hiện lên màn hình điện thoại.'))}
                                        </p>
                                        <ul className="space-y-2">
                                            <li className="flex items-center gap-2 text-sm">
                                                <Check className="h-4 w-4 text-blue-500 shrink-0" />
                                                <span>{renderText(t('adb.guide.step4.check', 'Tích vào **"Luôn cho phép từ máy tính này"**'))}</span>
                                            </li>
                                            <li className="flex items-center gap-2 text-sm">
                                                <Check className="h-4 w-4 text-blue-500 shrink-0" />
                                                <span>{renderText(t('adb.guide.step4.allow', 'Nhấn **Cho phép** hoặc **OK**'))}</span>
                                            </li>
                                        </ul>
                                    </div>
                                    {/* Image increased stored size */}
                                    <div className="w-32 md:w-48 shrink-0 rounded-md overflow-hidden border border-border shadow-sm bg-black/5">
                                        <img src="/images/allow-usb-debug.png" alt="Allow USB Debugging Popup" className="w-full h-auto object-cover" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg p-4 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <p className="text-yellow-600/90 text-sm font-medium">
                                        {t('adb.guide.troubleshooting.title', 'Nếu không thấy hộp thoại')}
                                    </p>
                                    <ul className="space-y-1 text-yellow-600/80 text-xs">
                                        {(t('adb.guide.troubleshooting.items', { returnObjects: true, defaultValue: [] }) as string[] || []).map((item: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-yellow-600 mt-0.5">•</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Path Summary Footer */}
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 p-3 bg-muted/20 rounded-md">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('adb.guide.header.build', 'Build Number Path')}</span>
                        <code className="text-xs text-foreground bg-muted px-2 py-1 rounded w-fit">
                            {t(guide.pathSummary.buildNumber)}
                        </code>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-muted/20 rounded-md">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('adb.guide.header.dev', 'Developer Options Path')}</span>
                        <code className="text-xs text-foreground bg-muted px-2 py-1 rounded w-fit">
                            {t(guide.pathSummary.developerOptions)}
                        </code>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
