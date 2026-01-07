/**
 * useThemeSync Hook
 * 
 * Syncs the theme from settings store to document.documentElement class.
 */

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

export function useThemeSync() {
    const theme = useSettingsStore((state) => state.theme);

    useEffect(() => {
        const root = document.documentElement;

        if (theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.add('light');
            root.classList.remove('dark');
        }
    }, [theme]);
}
