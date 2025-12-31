/**
 * Language Sync Hook
 * 
 * Synchronizes i18next language with settingsStore.
 * When settingsStore.language changes, i18next is updated.
 */

import { useEffect } from 'react';
import i18n from '../i18n/config';
import { useSettingsStore } from '../stores';

/**
 * Hook to sync i18next language with settingsStore.
 * Should be used in App.tsx or a top-level provider.
 */
export function useLanguageSync(): void {
    const language = useSettingsStore((state) => state.language);

    useEffect(() => {
        // Only change if different to avoid unnecessary updates
        if (i18n.language !== language) {
            i18n.changeLanguage(language);
        }
    }, [language]);
}
