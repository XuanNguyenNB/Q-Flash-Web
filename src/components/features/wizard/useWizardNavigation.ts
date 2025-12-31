/**
 * useWizardNavigation Hook
 * 
 * Manages wizard navigation state and validation logic.
 * Controls step progression based on completion requirements.
 */

import { useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useDeviceStore } from '@/stores/deviceStore';

/**
 * Wizard navigation hook
 * 
 * Provides navigation state and actions for the wizard.
 * Validates each step before allowing progression.
 * 
 * @returns Navigation state and control functions
 */
export function useWizardNavigation() {
    const [currentStep, setCurrentStep] = useState(0);
    const setShowWizard = useSettingsStore((state) => state.setShowWizard);
    const selectedDevice = useDeviceStore((state) => state.selectedDevice);
    const isConnected = useDeviceStore((state) => state.isConnected);

    const totalSteps = 5;

    /**
     * Validation logic for each step
     * 
     * Step 0 (Welcome): Always can proceed
     * Step 1 (Prerequisites): Always can proceed
     * Step 2 (Device Selection): Need device selected
     * Step 3 (Connect): Need connection established
     * Step 4 (Ready): Final step, always valid
     */
    const canGoNext = () => {
        switch (currentStep) {
            case 0: // Welcome - always can proceed
            case 1: // Prerequisites - always can proceed
                return true;
            case 2: // Device Selection - need device selected
                return selectedDevice !== null;
            case 3: // Connect - need connection established
                return isConnected;
            case 4: // Ready - final step
                return true;
            default:
                return false;
        }
    };

    const canGoBack = currentStep > 0;

    /**
     * Navigate to next step
     * Only proceeds if current step validation passes
     */
    const nextStep = () => {
        if (canGoNext() && currentStep < totalSteps - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    /**
     * Navigate to previous step
     */
    const prevStep = () => {
        if (canGoBack) {
            setCurrentStep(currentStep - 1);
        }
    };

    /**
     * Skip wizard
     * Closes wizard and resets to first step
     */
    const skipWizard = () => {
        setShowWizard(false);
        setCurrentStep(0); // Reset for next time
    };

    /**
     * Complete wizard
     * Closes wizard and resets to first step
     */
    const completeWizard = () => {
        setShowWizard(false);
        setCurrentStep(0);
    };

    return {
        currentStep,
        totalSteps,
        canGoNext: canGoNext(),
        canGoBack,
        nextStep,
        prevStep,
        skipWizard,
        completeWizard,
    };
}
