/**
 * useFirstVisit Hook
 * 
 * Detects first-time visitors and manages wizard display state.
 * Wraps settingsStore.showWizard for first-visit detection.
 */

import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Hook return type
 */
export interface UseFirstVisitReturn {
    /** True if wizard should be shown (first visit or manually triggered) */
    isFirstVisit: boolean;
    /** Mark wizard as completed (sets showWizard to false) */
    markWizardCompleted: () => void;
}

/**
 * useFirstVisit hook
 * 
 * Provides first-visit detection by checking settingsStore.showWizard.
 * The wizard state persists across sessions via localStorage.
 * 
 * @returns {UseFirstVisitReturn} First visit state and completion handler
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { isFirstVisit, markWizardCompleted } = useFirstVisit();
 *   
 *   return (
 *     <>
 *       {isFirstVisit && <WizardModal onComplete={markWizardCompleted} />}
 *       <MainApp />
 *     </>
 *   );
 * }
 * ```
 */
export function useFirstVisit(): UseFirstVisitReturn {
    // Get wizard state from settings store
    const showWizard = useSettingsStore((state) => state.showWizard);
    const setShowWizard = useSettingsStore((state) => state.setShowWizard);

    /**
     * Mark wizard as completed
     * Sets showWizard to false and persists to localStorage
     */
    const markWizardCompleted = () => {
        setShowWizard(false);
    };

    return {
        isFirstVisit: showWizard,
        markWizardCompleted,
    };
}
