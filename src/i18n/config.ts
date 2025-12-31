/**
 * Q-Flash-Web i18n Configuration
 * 
 * Configures react-i18next for React components.
 * Synchronizes language with settingsStore.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from './translations/en.json';
import vi from './translations/vi.json';

/**
 * Get initial language from localStorage or default to 'en'
 */
function getInitialLanguage(): 'en' | 'vi' {
    try {
        const stored = localStorage.getItem('qflash-settings');
        if (stored) {
            const parsed = JSON.parse(stored);
            const lang = parsed?.state?.language;
            if (lang === 'en' || lang === 'vi') {
                return lang;
            }
        }
    } catch {
        // Ignore parsing errors
    }
    return 'en';
}

// Initialize i18next with react-i18next
i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            vi: { translation: vi },
        },
        lng: getInitialLanguage(),
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        // React-specific options
        react: {
            useSuspense: false, // Disable suspense for better SSR compatibility
        },
    });

export default i18n;
