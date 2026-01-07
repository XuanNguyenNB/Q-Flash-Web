/**
 * Header Component
 * 
 * Top navigation bar with logo, mode selector, navigation links, language toggle, and settings.
 * Part of the App Shell layout.
 */

import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Stores
import { useSettingsStore, type Language, type Theme } from '@/stores/settingsStore';

// Components
import { Button } from '@/components/ui/button';
import { ModeSelector } from './ModeSelector';

// Icons
import { Globe, Moon, Sun } from 'lucide-react';

// Utils
import { cn } from '@/lib/utils';

/**
 * Navigation link configuration
 */
interface NavLink {
    path: string;
    labelKey: string;
}

const navLinks: NavLink[] = [
    { path: '/guide', labelKey: 'nav.guide' },
    { path: '/downloads', labelKey: 'nav.downloads' },
    { path: '/support', labelKey: 'nav.support' },
    { path: '/donate', labelKey: 'nav.donate' },
];

/**
 * Header component with logo, mode selector, navigation, language toggle, and settings
 */
export function Header() {
    const { t } = useTranslation();
    const location = useLocation();

    // Settings store for language and theme
    const language = useSettingsStore((state) => state.language);
    const setLanguage = useSettingsStore((state) => state.setLanguage);
    const theme = useSettingsStore((state) => state.theme);
    const setTheme = useSettingsStore((state) => state.setTheme);

    /**
     * Toggle between EN and VI languages
     */
    const handleLanguageToggle = () => {
        const newLang: Language = language === 'en' ? 'vi' : 'en';
        setLanguage(newLang);
    };

    /**
     * Toggle between light and dark themes
     */
    const handleThemeToggle = () => {
        const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    };

    /**
     * Check if a nav link is active
     */
    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-full items-center justify-between px-4">
                {/* Logo, Mode Selector, and Navigation */}
                <div className="flex items-center gap-4">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <img
                            src="/icon.png"
                            alt="Q-Flash"
                            className="h-8 w-8"
                        />
                        <span className="text-lg font-bold text-foreground hidden sm:inline">
                            Q-Flash
                        </span>
                    </Link>

                    {/* Mode Selector */}
                    <ModeSelector />

                    {/* Navigation Links */}
                    <nav className="hidden lg:flex items-center gap-1">
                        {navLinks.map(({ path, labelKey }) => {
                            const isDonate = path === '/donate';
                            return (
                                <Link
                                    key={path}
                                    to={path}
                                    className={cn(
                                        "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                        isDonate && [
                                            // Pink highlight for donate link with animation
                                            "bg-gradient-to-r from-pink-500/20 to-rose-500/20",
                                            "text-pink-500 hover:from-pink-500/30 hover:to-rose-500/30",
                                            "shadow-sm shadow-pink-500/20",
                                            "flex items-center gap-1.5"
                                        ],
                                        !isDonate && isActive(path)
                                            ? "bg-primary/10 text-primary"
                                            : !isDonate && "text-muted-foreground hover:text-foreground hover:bg-accent"
                                    )}
                                >
                                    {isDonate && (
                                        <span className="animate-pulse text-rose-500">❤</span>
                                    )}
                                    {isDonate ? t('nav.donate') : t(labelKey)}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-2">
                    {/* Theme Toggle */}
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleThemeToggle}
                        title={theme === 'light' ? 'Dark mode' : 'Light mode'}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        {theme === 'light' ? (
                            <Moon className="h-4 w-4" />
                        ) : (
                            <Sun className="h-4 w-4" />
                        )}
                    </Button>

                    {/* Language Toggle */}
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleLanguageToggle}
                        title={t('settings.language')}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Globe className="h-4 w-4" />
                        <span className="ml-1 text-xs font-medium uppercase">
                            {language}
                        </span>
                    </Button>
                </div>
            </div>
        </header>
    );
}
