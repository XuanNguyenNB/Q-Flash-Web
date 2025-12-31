/**
 * Q-Flash-Web Settings Store
 * 
 * Manages user preferences with localStorage persistence.
 * Uses Zustand with persist middleware.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Supported language codes.
 */
export type Language = 'en' | 'vi';

/**
 * Settings store state interface.
 */
export interface SettingsState {
    // State
    language: Language;
    showWizard: boolean;
    lastDeviceId: string | null;

    // Actions
    setLanguage: (language: Language) => void;
    setShowWizard: (show: boolean) => void;
    setLastDeviceId: (id: string | null) => void;
    reset: () => void;
}

/**
 * Initial state for settings store.
 */
const initialState = {
    language: 'vi' as Language,
    showWizard: true,
    lastDeviceId: null,
};

/**
 * Settings store hook.
 * Manages user preferences with localStorage persistence.
 * Persisted to localStorage with key 'qflash-settings'.
 */
export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            // Initial state
            ...initialState,

            // Actions
            setLanguage: (language) => set({ language }),

            setShowWizard: (show) => set({ showWizard: show }),

            setLastDeviceId: (id) => set({ lastDeviceId: id }),

            reset: () => set(initialState),
        }),
        {
            name: 'qflash-settings', // localStorage key
            partialize: (state) => ({
                // Only persist these properties
                language: state.language,
                showWizard: state.showWizard,
                lastDeviceId: state.lastDeviceId,
            }),
        }
    )
);
