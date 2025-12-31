/**
 * Support Page
 * 
 * Help & FAQ page with contact information, troubleshooting guide.
 * Story 3.5: Support Page with FAQ - COMPLETE IMPLEMENTATION
 */

import { useTranslation } from 'react-i18next';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    HelpCircle,
    AlertTriangle,
    MessageCircle,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Send,
    Facebook,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SupportPage() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto">
            {/* Page Header */}
            <header className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">
                    {t('support.title')}
                </h1>
                <p className="text-muted-foreground">
                    {t('support.description')}
                </p>
            </header>

            {/* Contact Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    {t('support.contact.title')}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Telegram Card */}
                    <Card className="hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Send className="h-5 w-5 text-[#0088cc]" />
                                Telegram
                            </CardTitle>
                            <CardDescription>
                                {t('support.contact.telegram.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <a
                                href="https://t.me/mitomtreem"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0088cc] text-white text-sm font-medium hover:bg-[#0077b5] transition-colors"
                            >
                                {t('support.contact.joinChannel')}
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </CardContent>
                    </Card>

                    {/* Facebook Card */}
                    <Card className="hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Facebook className="h-5 w-5 text-[#1877f2]" />
                                Facebook
                            </CardTitle>
                            <CardDescription>
                                {t('support.contact.facebook.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <a
                                href="https://www.facebook.com/xuannguyen030923"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1877f2] text-white text-sm font-medium hover:bg-[#166fe5] transition-colors"
                            >
                                {t('support.contact.joinGroup')}
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Troubleshooting Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    {t('support.troubleshooting.title')}
                </h2>
                <p className="text-muted-foreground">
                    {t('support.troubleshooting.description')}
                </p>

                <Accordion type="single" collapsible className="w-full space-y-2">
                    {/* Error 1: Device not found */}
                    <AccordionItem value="error-1" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                                <span className="font-medium">{t('support.troubleshooting.error1.title')}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pt-2">
                            <p className="text-sm text-muted-foreground">
                                {t('support.troubleshooting.error1.description')}
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error1.solution1')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error1.solution2')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error1.solution3')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error1.solution4')}</span>
                                </li>
                            </ul>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Error 2: Bulk transfer timeout */}
                    <AccordionItem value="error-2" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                                <span className="font-medium">{t('support.troubleshooting.error2.title')}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pt-2">
                            <p className="text-sm text-muted-foreground">
                                {t('support.troubleshooting.error2.description')}
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error2.solution1')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error2.solution2')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error2.solution3')}</span>
                                </li>
                            </ul>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Error 3: VIP authentication failed */}
                    <AccordionItem value="error-3" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                                <span className="font-medium">{t('support.troubleshooting.error3.title')}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pt-2">
                            <p className="text-sm text-muted-foreground">
                                {t('support.troubleshooting.error3.description')}
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error3.solution1')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error3.solution2')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error3.solution3')}</span>
                                </li>
                            </ul>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Error 4: Session limit reached */}
                    <AccordionItem value="error-4" className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                                <span className="font-medium">{t('support.troubleshooting.error4.title')}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pt-2">
                            <p className="text-sm text-muted-foreground">
                                {t('support.troubleshooting.error4.description')}
                            </p>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error4.solution1')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error4.solution2')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                    <span>{t('support.troubleshooting.error4.solution3')}</span>
                                </li>
                            </ul>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                {/* Link to Guide Page */}
                <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <HelpCircle className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                            {t('support.troubleshooting.moreHelp')}
                        </p>
                        <Link
                            to="/guide"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                        >
                            {t('support.troubleshooting.viewGuide')}
                            <ExternalLink className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-cyan-500" />
                    {t('support.faq.title')}
                </h2>

                <Accordion type="single" collapsible className="w-full space-y-2">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                        <AccordionItem key={num} value={`faq-${num}`} className="border rounded-lg px-4">
                            <AccordionTrigger className="text-left hover:no-underline">
                                <span className="font-medium">
                                    {t(`support.faq.q${num}.question`)}
                                </span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                                <p className="text-sm text-muted-foreground">
                                    {t(`support.faq.q${num}.answer`)}
                                </p>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </section>
        </div>
    );
}
