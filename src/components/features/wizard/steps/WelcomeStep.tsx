/**
 * WelcomeStep Component
 * 
 * First step of the setup wizard.
 * Displays welcome message and introduction to Q-Flash.
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

interface WelcomeStepProps {
    onGetStarted: () => void;
}

/**
 * Welcome step component
 * 
 * Shows welcome message and "Get Started" button.
 */
export function WelcomeStep({ onGetStarted }: WelcomeStepProps) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col items-center text-center space-y-6 py-8">
            {/* Icon */}
            <div className="rounded-full bg-primary/10 p-6">
                <Zap className="h-12 w-12 text-primary" />
            </div>

            {/* Welcome message */}
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">
                    {t('wizard.welcome.title')}
                </h2>
                <p className="text-muted-foreground max-w-md">
                    {t('wizard.welcome.description')}
                </p>
            </div>

            {/* Get Started button */}
            <Button onClick={onGetStarted} size="lg" className="mt-4">
                {t('wizard.welcome.getStarted')}
            </Button>
        </div>
    );
}
