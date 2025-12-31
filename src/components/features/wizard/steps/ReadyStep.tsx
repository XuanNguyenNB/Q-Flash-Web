/**
 * ReadyStep Component
 * 
 * Fifth and final step of the setup wizard.
 * Shows success message and "Don't show again" option.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2 } from 'lucide-react';

interface ReadyStepProps {
    onComplete: (dontShowAgain: boolean) => void;
}

/**
 * Ready step component
 * 
 * Final step showing success and completion options.
 */
export function ReadyStep({ onComplete }: ReadyStepProps) {
    const { t } = useTranslation();
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const handleFinish = () => {
        onComplete(dontShowAgain);
    };

    return (
        <div className="flex flex-col items-center text-center space-y-6 py-8">
            {/* Success icon */}
            <div className="rounded-full bg-green-500/10 p-6">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>

            {/* Success message */}
            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {t('wizard.ready.title')}
                </h2>
                <p className="text-muted-foreground max-w-md">
                    {t('wizard.ready.description')}
                </p>
            </div>

            {/* Next steps */}
            <div className="w-full max-w-md space-y-3 text-left">
                <p className="text-sm font-medium">{t('wizard.ready.nextSteps')}</p>
                <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{t('wizard.ready.step1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{t('wizard.ready.step2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{t('wizard.ready.step3')}</span>
                    </li>
                </ul>
            </div>

            {/* Don't show again checkbox */}
            <div className="flex items-center space-x-2 pt-4">
                <Checkbox
                    id="dont-show-again"
                    checked={dontShowAgain}
                    onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                />
                <label
                    htmlFor="dont-show-again"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                    {t('wizard.ready.dontShowAgain')}
                </label>
            </div>

            {/* Finish button */}
            <Button onClick={handleFinish} size="lg" className="mt-4">
                {t('wizard.ready.finish')}
            </Button>
        </div>
    );
}
