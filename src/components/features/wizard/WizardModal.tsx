/**
 * WizardModal Component
 * 
 * Full 5-step wizard implementation for first-time users.
 * Guides users through device setup process.
 * 
 * Steps:
 * 1. Welcome - Introduction
 * 2. Prerequisites - Requirements checklist
 * 3. Device Selection - Select device from list
 * 4. Connect - Connect device via WebUSB
 * 5. Ready - Success and completion
 */

import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWizardNavigation } from './useWizardNavigation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import {
    WelcomeStep,
    PrerequisitesStep,
    DeviceSelectionStep,
    ConnectStep,
    ReadyStep,
} from './steps';

/**
 * Wizard Modal component
 * 
 * Multi-step wizard for guiding new users through setup.
 * Controlled by settingsStore.showWizard state.
 */
export function WizardModal() {
    const { t, i18n } = useTranslation();
    const showWizard = useSettingsStore((state) => state.showWizard);
    const setShowWizard = useSettingsStore((state) => state.setShowWizard);
    const language = useSettingsStore((state) => state.language);
    const setLanguage = useSettingsStore((state) => state.setLanguage);

    const {
        currentStep,
        totalSteps,
        canGoNext,
        canGoBack,
        nextStep,
        prevStep,
        skipWizard,
        completeWizard,
    } = useWizardNavigation();

    const isLastStep = currentStep === totalSteps - 1;

    /**
     * Toggle language between English and Vietnamese
     */
    const toggleLanguage = () => {
        const newLang = language === 'en' ? 'vi' : 'en';
        setLanguage(newLang);
        i18n.changeLanguage(newLang);
    };

    /**
     * Handle wizard completion
     * Called from ReadyStep with dontShowAgain preference
     */
    const handleComplete = (dontShowAgain: boolean) => {
        if (dontShowAgain) {
            setShowWizard(false);
        }
        completeWizard();
    };

    /**
     * Render current step component
     */
    const renderStep = () => {
        switch (currentStep) {
            case 0:
                return <WelcomeStep onGetStarted={nextStep} />;
            case 1:
                return <PrerequisitesStep />;
            case 2:
                return <DeviceSelectionStep />;
            case 3:
                return <ConnectStep />;
            case 4:
                return <ReadyStep onComplete={handleComplete} />;
            default:
                return null;
        }
    };

    return (
        <Dialog open={showWizard} onOpenChange={(open) => !open && skipWizard()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-2">
                        <DialogTitle className="text-xl">
                            {t('wizard.title')}
                        </DialogTitle>
                        {/* Language Switcher */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleLanguage}
                            className="h-8 px-2 text-xs gap-1"
                            title={language === 'en' ? 'Switch to Vietnamese' : 'Chuyển sang tiếng Anh'}
                        >
                            <Languages className="h-3.5 w-3.5" />
                            <span className="font-medium">{language === 'en' ? 'VI' : 'EN'}</span>
                        </Button>
                    </div>

                    {/* Step indicator */}
                    <p className="text-sm text-muted-foreground pt-1">
                        {t('wizard.stepIndicator', {
                            current: currentStep + 1,
                            total: totalSteps
                        })}
                    </p>

                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-1.5 mt-3">
                        <div
                            className="bg-primary h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                        />
                    </div>
                </DialogHeader>

                {/* Step Content */}
                <div className="min-h-[300px]">
                    {renderStep()}
                </div>

                {/* Navigation Buttons - Hidden on last step (ReadyStep has its own Finish button) */}
                {!isLastStep && (
                    <div className="flex items-center justify-between border-t pt-4 mt-4">
                        <Button
                            variant="ghost"
                            onClick={prevStep}
                            disabled={!canGoBack}
                        >
                            {t('wizard.navigation.back')}
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={skipWizard}>
                                {t('wizard.navigation.skip')}
                            </Button>
                            <Button onClick={nextStep} disabled={!canGoNext}>
                                {t('wizard.navigation.next')}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
