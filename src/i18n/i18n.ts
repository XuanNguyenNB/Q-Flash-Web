/**
 * Internationalization (i18n) service for Q-Flash-Web
 * Supports Vietnamese (vi) and English (en)
 */

import viTranslations from './translations/vi.json';
import enTranslations from './translations/en.json';

export type Language = 'vi' | 'en';

interface Translations {
    [key: string]: any;
}

const translations: Record<Language, Translations> = {
    vi: viTranslations,
    en: enTranslations,
};

const STORAGE_KEY = 'qflash-language';
let currentLanguage: Language = 'vi'; // Default to Vietnamese

/**
 * Initialize i18n system - load saved language from localStorage
 */
export function initI18n(): void {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && (saved === 'vi' || saved === 'en')) {
        currentLanguage = saved;
    }
}

/**
 * Get current language
 */
export function getCurrentLanguage(): Language {
    return currentLanguage;
}

/**
 * Set language and persist to localStorage
 */
export function setLanguage(lang: Language): void {
    currentLanguage = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    // Dispatch custom event for components to listen
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
}

/**
 * Translate a key to current language
 * Supports nested keys with dot notation: 'header.title'
 * Supports variable interpolation: t('messages.total', { count: 5 })
 */
export function t(key: string, variables?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = translations[currentLanguage];

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            console.warn(`Translation key not found: ${key}`);
            return key; // Return key if translation not found
        }
    }

    let result = typeof value === 'string' ? value : JSON.stringify(value);

    // Replace variables like {{count}} with actual values
    if (variables) {
        Object.entries(variables).forEach(([varKey, varValue]) => {
            result = result.replace(new RegExp(`{{${varKey}}}`, 'g'), String(varValue));
        });
    }

    return result;
}
