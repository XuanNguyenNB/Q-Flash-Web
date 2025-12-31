/**
 * Guide Page
 * 
 * Comprehensive usage guide for Q-Flash Web Tool.
 * Story 3.3: Expanded Guide Page - COMPLETE IMPLEMENTATION
 */

import { useTranslation } from 'react-i18next';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    CheckCircle2,
    AlertCircle,
    Info,
    ExternalLink,
    Terminal,
    Zap,
    Shield,
    HelpCircle,
    FileText,
    Wrench
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function GuidePage() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
            {/* Page Header */}
            <header className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">
                    {t('guide.title')}
                </h1>
                <p className="text-muted-foreground">
                    {t('guide.description')}
                </p>
            </header>

            {/* Guide Content - 8 Accordion Sections */}
            <Accordion type="single" collapsible className="w-full space-y-2">
                {/* Section 1: Quick Start */}
                <AccordionItem value="quick-start" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            {t('guide.quickStart.title')}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        <p className="text-muted-foreground">
                            {t('guide.quickStart.intro')}
                        </p>

                        {/* 5-Step Process */}
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((step) => (
                                <div key={step} className="flex items-start gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                                        {step}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <h4 className="font-semibold text-foreground">
                                            {t(`guide.quickStart.step${step}.title`)}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {t(`guide.quickStart.step${step}.description`)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
                            <Info className="h-5 w-5 text-primary shrink-0" />
                            <p className="text-sm text-muted-foreground">
                                {t('guide.quickStart.tip')}
                            </p>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 2: Prerequisites */}
                <AccordionItem value="prerequisites" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            {t('guide.prerequisites.title')}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
                        <p className="text-muted-foreground">
                            {t('guide.prerequisites.intro')}
                        </p>

                        {/* Requirements List */}
                        <ul className="space-y-3">
                            {['windows', 'usbCable', 'driver', 'edlMode'].map((item) => (
                                <li key={item} className="flex items-start gap-3">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <span className="font-medium text-foreground">
                                            {t(`guide.prerequisites.${item}.title`)}
                                        </span>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {t(`guide.prerequisites.${item}.description`)}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        {/* Warning about cables */}
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-foreground">
                                    {t('guide.prerequisites.cableWarning.title')}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('guide.prerequisites.cableWarning.description')}
                                </p>
                            </div>
                        </div>

                        {/* Link to Downloads */}
                        <div className="pt-2">
                            <Link
                                to="/downloads"
                                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                {t('guide.prerequisites.downloadDriver')}
                                <ExternalLink className="h-4 w-4" />
                            </Link>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 3: Installing Drivers */}
                <AccordionItem value="installing-drivers" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-blue-600" />
                            {t('guide.installingDrivers.title')}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        {/* Automatic Installation */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold">
                                    ✓
                                </span>
                                {t('guide.installingDrivers.automatic.title')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {t('guide.installingDrivers.automatic.intro')}
                            </p>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                                {[1, 2, 3].map((step) => (
                                    <li key={step}>
                                        {t(`guide.installingDrivers.automatic.step${step}`)}
                                    </li>
                                ))}
                            </ol>
                        </div>

                        <div className="border-t pt-6" />

                        {/* Manual Installation with Zadig */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-foreground">
                                {t('guide.installingDrivers.manual.title')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {t('guide.installingDrivers.manual.intro')}
                            </p>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-4">
                                {[1, 2, 3, 4].map((step) => (
                                    <li key={step}>
                                        {t(`guide.installingDrivers.manual.step${step}`)}
                                    </li>
                                ))}
                            </ol>

                            {/* Zadig Screenshots - 3 Steps */}
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-center text-muted-foreground">
                                        {t('guide.installingDrivers.manual.screenshot1', 'Step 1: Select Device')}
                                    </p>
                                    <img
                                        src="/images/zadig_step_1.png"
                                        alt="Zadig Step 1 - Select QDLoader 9008"
                                        className="rounded-lg border border-border shadow-sm w-full h-auto"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-center text-muted-foreground">
                                        {t('guide.installingDrivers.manual.screenshot2', 'Step 2: Choose WinUSB')}
                                    </p>
                                    <img
                                        src="/images/zadig_step_2.png"
                                        alt="Zadig Step 2 - Select WinUSB driver"
                                        className="rounded-lg border border-border shadow-sm w-full h-auto"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-center text-muted-foreground">
                                        {t('guide.installingDrivers.manual.screenshot3', 'Step 3: Install Driver')}
                                    </p>
                                    <img
                                        src="/images/zadig_step_3.png"
                                        alt="Zadig Step 3 - Install Driver button"
                                        className="rounded-lg border border-border shadow-sm w-full h-auto"
                                        loading="lazy"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Troubleshooting tip */}
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-muted-foreground">
                                {t('guide.installingDrivers.troubleshootingTip')}
                            </p>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 4: Entering EDL Mode */}
                <AccordionItem value="entering-edl" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-orange-600" />
                            {t('guide.enteringEDL.title')}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        <p className="text-muted-foreground">
                            {t('guide.enteringEDL.intro')}
                        </p>

                        {/* Method 1: Test Point */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                    1
                                </span>
                                {t('guide.enteringEDL.method1.title')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {t('guide.enteringEDL.method1.description')}
                            </p>
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-muted-foreground">
                                    {t('guide.enteringEDL.method1.warning')}
                                </p>
                            </div>
                        </div>

                        {/* Method 2: ADB Command */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                    2
                                </span>
                                {t('guide.enteringEDL.method2.title')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {t('guide.enteringEDL.method2.description')}
                            </p>
                            <div className="p-3 rounded-lg bg-muted font-mono text-sm">
                                adb reboot edl
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {t('guide.enteringEDL.method2.note')}
                            </p>
                        </div>

                        {/* Method 3: Fastboot Command */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                    3
                                </span>
                                {t('guide.enteringEDL.method3.title')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {t('guide.enteringEDL.method3.description')}
                            </p>
                            <div className="p-3 rounded-lg bg-muted font-mono text-sm">
                                fastboot oem edl
                            </div>
                        </div>

                        {/* Method 4: Key Combination */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                    4
                                </span>
                                {t('guide.enteringEDL.method4.title')}
                            </h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                <li>{t('guide.enteringEDL.method4.step1')}</li>
                                <li>{t('guide.enteringEDL.method4.step2')}</li>
                                <li>{t('guide.enteringEDL.method4.step3')}</li>
                            </ol>
                        </div>

                        {/* Verification */}
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-foreground">
                                    {t('guide.enteringEDL.verification.title')}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('guide.enteringEDL.verification.description')}
                                </p>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 5: Using Q-Flash Tool */}
                <AccordionItem value="using-tool" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-purple-600" />
                            {t('guide.usingTool.title')}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        {/* Selecting Device */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground">
                                {t('guide.usingTool.selectingDevice.title')}
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                <li>{t('guide.usingTool.selectingDevice.step1')}</li>
                                <li>{t('guide.usingTool.selectingDevice.step2')}</li>
                                <li>{t('guide.usingTool.selectingDevice.step3')}</li>
                            </ul>
                        </div>

                        {/* Connecting */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground">
                                {t('guide.usingTool.connecting.title')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {t('guide.usingTool.connecting.description')}
                            </p>
                        </div>

                        {/* Viewing Partitions */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground">
                                {t('guide.usingTool.viewingPartitions.title')}
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                <li>{t('guide.usingTool.viewingPartitions.item1')}</li>
                                <li>{t('guide.usingTool.viewingPartitions.item2')}</li>
                                <li>{t('guide.usingTool.viewingPartitions.item3')}</li>
                            </ul>
                        </div>

                        {/* Backup Operations */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground">
                                {t('guide.usingTool.backup.title')}
                            </h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                <li>{t('guide.usingTool.backup.step1')}</li>
                                <li>{t('guide.usingTool.backup.step2')}</li>
                                <li>{t('guide.usingTool.backup.step3')}</li>
                                <li>{t('guide.usingTool.backup.step4')}</li>
                            </ol>
                        </div>

                        {/* Flash Operations */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground">
                                {t('guide.usingTool.flash.title')}
                            </h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                <li>{t('guide.usingTool.flash.step1')}</li>
                                <li>{t('guide.usingTool.flash.step2')}</li>
                                <li>{t('guide.usingTool.flash.step3')}</li>
                                <li>{t('guide.usingTool.flash.step4')}</li>
                            </ol>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 6: ROM Processing */}
                <AccordionItem value="rom-processing" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-indigo-600" />
                            {t('guide.romProcessing.title')}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        {/* ROM Structure */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground">
                                {t('guide.romProcessing.structure.title')}
                            </h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                <li>{t('guide.romProcessing.structure.item1')}</li>
                                <li>{t('guide.romProcessing.structure.item2')}</li>
                                <li>{t('guide.romProcessing.structure.item3')}</li>
                            </ul>
                        </div>

                        {/* Loading ROM */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground">
                                {t('guide.romProcessing.loading.title')}
                            </h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                <li>{t('guide.romProcessing.loading.step1')}</li>
                                <li>{t('guide.romProcessing.loading.step2')}</li>
                                <li>{t('guide.romProcessing.loading.step3')}</li>
                                <li>{t('guide.romProcessing.loading.step4')}</li>
                            </ol>
                        </div>

                        {/* Selective Flashing */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground">
                                {t('guide.romProcessing.selective.title')}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {t('guide.romProcessing.selective.description')}
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                                <li>{t('guide.romProcessing.selective.tip1')}</li>
                                <li>{t('guide.romProcessing.selective.tip2')}</li>
                            </ul>
                        </div>

                        {/* Warning */}
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-sm font-medium text-foreground">
                                {t('guide.romProcessing.warning')}
                            </p>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 7: Troubleshooting */}
                <AccordionItem value="troubleshooting" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            {t('guide.troubleshooting.title')}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        {/* Error 1: Device not detected */}
                        <div className="space-y-2">
                            <h4 className="font-medium text-red-600 flex items-center gap-2">
                                <span>❌</span>
                                {t('guide.troubleshooting.error1.title')}
                            </h4>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li>✓ {t('guide.troubleshooting.error1.solution1')}</li>
                                <li>✓ {t('guide.troubleshooting.error1.solution2')}</li>
                                <li>✓ {t('guide.troubleshooting.error1.solution3')}</li>
                                <li>✓ {t('guide.troubleshooting.error1.solution4')}</li>
                            </ul>
                        </div>

                        {/* Error 2: Connection failed */}
                        <div className="space-y-2">
                            <h4 className="font-medium text-red-600 flex items-center gap-2">
                                <span>❌</span>
                                {t('guide.troubleshooting.error2.title')}
                            </h4>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li>✓ {t('guide.troubleshooting.error2.solution1')}</li>
                                <li>✓ {t('guide.troubleshooting.error2.solution2')}</li>
                                <li>✓ {t('guide.troubleshooting.error2.solution3')}</li>
                            </ul>
                        </div>

                        {/* Error 3: VIP auth failed */}
                        <div className="space-y-2">
                            <h4 className="font-medium text-red-600 flex items-center gap-2">
                                <span>❌</span>
                                {t('guide.troubleshooting.error3.title')}
                            </h4>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li>✓ {t('guide.troubleshooting.error3.solution1')}</li>
                                <li>✓ {t('guide.troubleshooting.error3.solution2')}</li>
                                <li>✓ {t('guide.troubleshooting.error3.solution3')}</li>
                            </ul>
                        </div>

                        {/* Error 4: Flash failed */}
                        <div className="space-y-2">
                            <h4 className="font-medium text-red-600 flex items-center gap-2">
                                <span>❌</span>
                                {t('guide.troubleshooting.error4.title')}
                            </h4>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li>✓ {t('guide.troubleshooting.error4.solution1')}</li>
                                <li>✓ {t('guide.troubleshooting.error4.solution2')}</li>
                                <li>✓ {t('guide.troubleshooting.error4.solution3')}</li>
                            </ul>
                        </div>

                        {/* Error 5: Device stuck */}
                        <div className="space-y-2">
                            <h4 className="font-medium text-red-600 flex items-center gap-2">
                                <span>❌</span>
                                {t('guide.troubleshooting.error5.title')}
                            </h4>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li>✓ {t('guide.troubleshooting.error5.solution1')}</li>
                                <li>✓ {t('guide.troubleshooting.error5.solution2')}</li>
                                <li>✓ {t('guide.troubleshooting.error5.solution3')}</li>
                            </ul>
                        </div>

                        {/* Still having issues */}
                        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <HelpCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-medium text-foreground">
                                    {t('guide.troubleshooting.stillHavingIssues.title')}
                                </p>
                                <Link
                                    to="/support"
                                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-2"
                                >
                                    {t('guide.troubleshooting.stillHavingIssues.link')}
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 8: FAQ */}
                <AccordionItem value="faq" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                        <div className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-cyan-600" />
                            {t('guide.faq.title')}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                            <div key={num} className="space-y-2">
                                <h4 className="font-semibold text-foreground">
                                    Q: {t(`guide.faq.q${num}.question`)}
                                </h4>
                                <p className="text-sm text-muted-foreground pl-4">
                                    A: {t(`guide.faq.q${num}.answer`)}
                                </p>
                            </div>
                        ))}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
