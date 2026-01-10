/**
 * Tool Page (Main Flash Tool)
 * 
 * The main tool page where users perform flash/backup operations.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Plug, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

import { useDeviceStore } from '@/stores/deviceStore';
import { usePartitionStore } from '@/stores/partitionStore';
import { useEDLConnectionStore } from '@/stores/edlConnectionStore';
import { useWebUSB } from '@/hooks';
import { PartitionGrid } from '@/components/features/partition';
import { ManualFirehoseLoader } from '@/components/features/firehose';
import { BrandGroupSelector } from '@/components/features/firehose/BrandGroupSelector';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Zadig slideshow images
const zadigSlides = [
    { src: '/images/zadig_step_1.png', stepKey: 'tool.zadig.step1' },
    { src: '/images/zadig_step_2.png', stepKey: 'tool.zadig.step2' },
    { src: '/images/zadig_step_3.png', stepKey: 'tool.zadig.step3' },
];

export default function ToolPage() {
    const { t } = useTranslation();
    const { currentMode, setMode, setConnected } = useDeviceStore();
    const { partitions, isLoading } = usePartitionStore();
    const [currentSlide, setCurrentSlide] = useState(0);

    // Use EDL store for brand group (persists across tab switches)
    const { selectedBrandGroup, setSelectedBrandGroup } = useEDLConnectionStore();

    // Get EDL connection state from WebUSB protocol (source of truth)
    const { isConnected: getIsConnected } = useWebUSB();
    const isEDLConnected = getIsConnected();

    // Ensure mode is EDL when this page mounts
    // This prevents showing ADB/Fastboot connection state on EDL page
    useEffect(() => {
        if (currentMode !== 'edl') {
            console.log('[ToolPage] Setting mode to EDL');
            setMode('edl');
        }
    }, [currentMode, setMode]);

    // Sync store with EDL protocol state when on this page
    useEffect(() => {
        if (isEDLConnected) {
            console.log('[ToolPage] EDL is connected, syncing store');
            setConnected(true);
        }
    }, [isEDLConnected, setConnected]);

    // Auto-advance slideshow
    useEffect(() => {
        if (isEDLConnected) return; // Don't run when connected

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % zadigSlides.length);
        }, 4000);

        return () => clearInterval(timer);
    }, [isEDLConnected]);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % zadigSlides.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + zadigSlides.length) % zadigSlides.length);

    // Only show for EDL mode
    if (currentMode !== 'edl') return null;

    return (
        <div className="flex flex-col gap-6 p-6 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                        <Zap className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {t('tool.edl.title', 'EDL Flash Tool')}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {t('tool.edl.subtitle', 'Flash tool for Qualcomm EDL devices. Can unbrick devices, backup data, or manage partitions directly.')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1">
                {isEDLConnected ? (
                    <PartitionGrid isLoading={isLoading} />
                ) : (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* No Device State - Connection Guide */}
                            <div className="flex flex-col gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Plug className="h-5 w-5 text-primary" />
                                        {t('tool.guide.title', 'Connection Guide')}
                                    </h3>

                                    <div className="prose prose-sm dark:prose-invert text-muted-foreground">
                                        <p>
                                            {t('tool.guide.intro', 'To use EDL mode on WEB, the device must be recognized as "QUSB_BULK" or "Qualcomm HS-USB QDLoader 9008" via WinUSB. Follow these steps to set it up:')}
                                        </p>
                                        <ol className="list-decimal pl-4 space-y-3 mt-3">
                                            <li>
                                                <span className="font-medium text-foreground">{t('tool.guide.step1.title', 'Step 1: Download and Open Zadig')}</span>
                                                <p className="text-xs mt-1">{t('tool.guide.step1.desc', 'Download and open Zadig.exe application')}</p>
                                            </li>
                                            <li>
                                                <span className="font-medium text-foreground">{t('tool.guide.step2.title', 'Step 2: Enter EDL Mode')}</span>
                                                <p className="text-xs mt-1">{t('tool.guide.step2.desc', 'Connect USB cable and hold Volume Down + Volume Up + Power simultaneously until computer recognizes it (you\'ll hear a sound or see it in Device Manager)')}</p>
                                            </li>
                                            <li>
                                                <span className="font-medium text-foreground">{t('tool.guide.step3.title', 'Step 3: Replace Driver')}</span>
                                                <p className="text-xs mt-1">{t('tool.guide.step3.desc', 'Find and replace the driver as shown in the illustration')}</p>
                                            </li>
                                            <li>
                                                <span className="font-medium text-foreground">{t('tool.guide.step4.title', 'Step 4: Reconnect')}</span>
                                                <p className="text-xs mt-1">{t('tool.guide.step4.desc', 'After installation, the device may exit EDL mode. Click the connect button on this WEB and enter EDL again: Connect USB cable and hold Volume Down + Volume Up + Power simultaneously until Chrome shows the device (as QUSB_BULK), then select that device. The web will automatically enter EDL VIP mode')}</p>
                                            </li>
                                        </ol>
                                    </div>

                                    <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                        <h4 className="font-medium text-sm mb-2">{t('tool.guide.tip.title', 'Tip: Use Q-Flash Forge')}</h4>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            {t('tool.guide.tip.desc', 'Use our Q-Flash Forge tool for automatic driver fixing and Zadig guidance.')}
                                        </p>
                                        <a
                                            href="https://github.com/XuanNguyenNB/Q-FLASH-FORGE"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 w-full")}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            {t('tool.guide.openForge', 'Open Q-Flash Forge Project')}
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Zadig Slideshow */}
                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-xl p-4 bg-muted/20 min-h-[300px]">
                                {/* Slide indicator */}
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-sm font-medium text-muted-foreground">
                                        {t('tool.zadig.title', 'Driver Installation Guide')}
                                    </span>
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                        {currentSlide + 1} / {zadigSlides.length}
                                    </span>
                                </div>

                                {/* Slideshow */}
                                <div className="relative w-full max-w-md">
                                    <img
                                        src={zadigSlides[currentSlide].src}
                                        alt={`Zadig step ${currentSlide + 1}`}
                                        className="w-full h-auto rounded-lg border border-border shadow-md transition-opacity duration-300"
                                    />

                                    {/* Navigation arrows */}
                                    <button
                                        onClick={prevSlide}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 hover:bg-background shadow-sm border border-border"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={nextSlide}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-background/80 hover:bg-background shadow-sm border border-border"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Step description */}
                                <p className="text-sm font-medium text-center mt-3">
                                    {t(zadigSlides[currentSlide].stepKey, `Step ${currentSlide + 1}`)}
                                </p>

                                {/* Dot indicators */}
                                <div className="flex gap-1.5 mt-3">
                                    {zadigSlides.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setCurrentSlide(index)}
                                            className={cn(
                                                "w-2 h-2 rounded-full transition-colors",
                                                index === currentSlide
                                                    ? "bg-primary"
                                                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Brand Group Selector + Manual Firehose Loader */}
                            <div className="lg:col-span-2 mt-4 space-y-6">
                                <BrandGroupSelector
                                    selectedGroup={selectedBrandGroup}
                                    onGroupChange={setSelectedBrandGroup}
                                    disabled={isEDLConnected}
                                />
                                <ManualFirehoseLoader brandGroup={selectedBrandGroup} />
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

