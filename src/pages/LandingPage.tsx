/**
 * Landing Page
 * 
 * Welcome page showcasing Q-Flash Web's three modes:
 * EDL, ADB, and Fastboot. Provides quick navigation to each mode
 * with feature highlights and getting started guide.
 */

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    Zap,
    Smartphone,
    Wrench,
    ArrowRight,
    Shield,
    Globe,
    Cpu,
    Terminal,
    HardDrive,
    Sparkles,
    CheckCircle2,
    Heart
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useDeviceStore } from '@/stores/deviceStore';

// Mode card styles (no text - text comes from i18n)
const modeStyles = {
    edl: {
        icon: Zap,
        gradient: 'from-yellow-500/20 to-amber-500/10',
        border: 'border-yellow-500/30',
        iconColor: 'text-yellow-500',
        hoverGlow: 'hover:shadow-yellow-500/20',
        route: '/edl'
    },
    adb: {
        icon: Smartphone,
        gradient: 'from-green-500/20 to-emerald-500/10',
        border: 'border-green-500/30',
        iconColor: 'text-green-500',
        hoverGlow: 'hover:shadow-green-500/20',
        route: '/adb'
    },
    fastboot: {
        icon: Wrench,
        gradient: 'from-orange-500/20 to-red-500/10',
        border: 'border-orange-500/30',
        iconColor: 'text-orange-500',
        hoverGlow: 'hover:shadow-orange-500/20',
        route: '/fastboot'
    }
};

// Feature icons
const featureIcons = [Globe, Shield, Cpu, Terminal];

export default function LandingPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { setMode } = useDeviceStore();

    const handleModeSelect = (mode: 'edl' | 'adb' | 'fastboot', route: string) => {
        setMode(mode);
        navigate(route);
    };

    // Get translated modes
    const getModeData = (modeId: 'edl' | 'adb' | 'fastboot') => {
        const style = modeStyles[modeId];
        return {
            id: modeId,
            name: t(`landing.modes.${modeId}.name`),
            description: t(`landing.modes.${modeId}.description`),
            features: [
                t(`landing.modes.${modeId}.feature1`),
                t(`landing.modes.${modeId}.feature2`),
                t(`landing.modes.${modeId}.feature3`),
                t(`landing.modes.${modeId}.feature4`)
            ],
            ...style
        };
    };

    const modes = ['edl', 'adb', 'fastboot'].map(id => getModeData(id as 'edl' | 'adb' | 'fastboot'));

    // Get translated features
    const getFeatures = () => [
        {
            icon: featureIcons[0],
            title: t('landing.highlight.browser.title'),
            description: t('landing.highlight.browser.desc')
        },
        {
            icon: featureIcons[1],
            title: t('landing.highlight.secure.title'),
            description: t('landing.highlight.secure.desc')
        },
        {
            icon: featureIcons[2],
            title: t('landing.highlight.multidevice.title'),
            description: t('landing.highlight.multidevice.desc')
        },
        {
            icon: featureIcons[3],
            title: t('landing.highlight.logs.title'),
            description: t('landing.highlight.logs.desc')
        }
    ];

    const features = getFeatures();

    return (
        <div className="min-h-screen bg-background overflow-y-auto">
            {/* Hero Section */}
            <section className="relative overflow-hidden">
                {/* Background gradient orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
                </div>

                <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-24">
                    {/* Logo & Title */}
                    <div className="text-center space-y-6 mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-4">
                            <Sparkles className="w-4 h-4" />
                            {t('landing.badge')}
                        </div>

                        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
                            {t('landing.title')}
                        </h1>

                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                            {t('landing.subtitle')}
                        </p>

                        <p className="text-muted-foreground max-w-xl mx-auto">
                            {t('landing.description')}
                        </p>

                        {/* Donate button */}
                        <div className="flex justify-center pt-4">
                            <Button
                                size="lg"
                                className="gap-2 shadow-lg px-8 py-6 text-lg bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0"
                                onClick={() => navigate('/donate')}
                            >
                                <Heart className="w-5 h-5 text-white fill-white animate-pulse" />
                                {t('landing.donate')}
                            </Button>
                        </div>
                    </div>

                    {/* Mode Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {modes.map((mode) => {
                            const Icon = mode.icon;
                            return (
                                <Card
                                    key={mode.id}
                                    className={cn(
                                        "group relative overflow-hidden cursor-pointer transition-all duration-300",
                                        "hover:scale-[1.02] hover:-translate-y-1",
                                        `bg-gradient-to-br ${mode.gradient}`,
                                        mode.border,
                                        `hover:shadow-xl ${mode.hoverGlow}`
                                    )}
                                    onClick={() => handleModeSelect(mode.id as 'edl' | 'adb' | 'fastboot', mode.route)}
                                >
                                    {/* Glow effect on hover */}
                                    <div className={cn(
                                        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                                        `bg-gradient-to-br ${mode.gradient}`
                                    )} />

                                    <CardHeader className="relative pb-2">
                                        <div className={cn(
                                            "w-14 h-14 rounded-xl flex items-center justify-center mb-3",
                                            "bg-background/80 shadow-sm ring-1 ring-border/50"
                                        )}>
                                            <Icon className={cn("w-7 h-7", mode.iconColor)} />
                                        </div>
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            {mode.name}
                                            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                        </CardTitle>
                                        <CardDescription className="text-sm leading-relaxed">
                                            {mode.description}
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="relative pt-0">
                                        <ul className="space-y-2">
                                            {mode.features.map((feature, idx) => (
                                                <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <CheckCircle2 className={cn("w-4 h-4 shrink-0", mode.iconColor)} />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="border-t border-border/50 bg-muted/30">
                <div className="max-w-6xl mx-auto px-6 py-16">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold mb-3">
                            {t('landing.features.title')}
                        </h2>
                        <p className="text-muted-foreground max-w-lg mx-auto">
                            {t('landing.features.subtitle')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, idx) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={idx}
                                    className="p-6 rounded-xl bg-background border border-border/50 hover:border-border transition-colors"
                                >
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                        <Icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Quick Start Section */}
            <section className="border-t border-border/50">
                <div className="max-w-4xl mx-auto px-6 py-16">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold mb-3">
                            {t('landing.quickstart.title', 'Quick Start')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t('landing.quickstart.subtitle', 'Get started in 3 simple steps')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                step: '1',
                                title: t('landing.quickstart.step1.title', 'Select Mode'),
                                description: t('landing.quickstart.step1.desc', 'Choose EDL, ADB, or Fastboot based on your device state.')
                            },
                            {
                                step: '2',
                                title: t('landing.quickstart.step2.title', 'Connect Device'),
                                description: t('landing.quickstart.step2.desc', 'Connect your Android device via USB and grant permission.')
                            },
                            {
                                step: '3',
                                title: t('landing.quickstart.step3.title', 'Start Flashing'),
                                description: t('landing.quickstart.step3.desc', 'Select partitions, load firmware, and begin the operation.')
                            }
                        ].map((item, idx) => (
                            <div key={idx} className="relative text-center">
                                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                                    {item.step}
                                </div>
                                <h3 className="font-semibold mb-2">{item.title}</h3>
                                <p className="text-sm text-muted-foreground">{item.description}</p>

                                {/* Connector line */}
                                {idx < 2 && (
                                    <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-px bg-border" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="text-center mt-12">
                        <Button
                            size="lg"
                            variant="outline"
                            className="gap-2"
                            onClick={() => navigate('/guide')}
                        >
                            <HardDrive className="w-5 h-5" />
                            {t('landing.readFullGuide', 'Read Full Guide')}
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border/50 py-8">
                <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
                    <p>
                        {t('landing.footer')}
                    </p>
                    <p className="mt-1 opacity-70">
                        {t('landing.footerCredit')}
                    </p>
                </div>
            </footer>
        </div>
    );
}
