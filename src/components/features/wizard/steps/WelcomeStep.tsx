/**
 * WelcomeStep Component
 * 
 * First step of the setup wizard.
 * Displays welcome message and theme selection.
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Zap, Sun, Moon } from 'lucide-react';
import { useSettingsStore, type Theme } from '@/stores/settingsStore';
import { cn } from '@/lib/utils';

interface WelcomeStepProps {
    onGetStarted: () => void;
}

/**
 * Welcome step component
 * 
 * Shows welcome message, theme selection, and "Get Started" button.
 */
export function WelcomeStep({ onGetStarted }: WelcomeStepProps) {
    const { t } = useTranslation();
    const theme = useSettingsStore((state) => state.theme);
    const setTheme = useSettingsStore((state) => state.setTheme);

    const handleThemeSelect = (selectedTheme: Theme) => {
        setTheme(selectedTheme);
    };

    return (
        <div className="flex flex-col items-center text-center space-y-6 py-6">
            {/* Icon */}
            <div className="rounded-full bg-primary/10 p-5">
                <Zap className="h-10 w-10 text-primary" />
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

            {/* Theme Selection */}
            <div className="w-full max-w-md space-y-3">
                <p className="text-sm font-medium text-foreground">
                    {t('wizard.welcome.themeQuestion', 'Bạn thích giao diện nào?')}
                </p>
                <div className="grid grid-cols-2 gap-4">
                    {/* Light Mode Card */}
                    <button
                        onClick={() => handleThemeSelect('light')}
                        className={cn(
                            "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                            "hover:border-primary/50 hover:bg-accent/50",
                            theme === 'light'
                                ? "border-primary bg-primary/10 shadow-md"
                                : "border-border bg-card"
                        )}
                    >
                        <div className={cn(
                            "rounded-full p-3",
                            theme === 'light' ? "bg-primary/20" : "bg-muted"
                        )}>
                            <Sun className={cn(
                                "h-6 w-6",
                                theme === 'light' ? "text-primary" : "text-muted-foreground"
                            )} />
                        </div>
                        <span className={cn(
                            "font-medium text-sm",
                            theme === 'light' ? "text-primary" : "text-foreground"
                        )}>
                            {t('wizard.welcome.lightMode', 'Light Mode')}
                        </span>
                    </button>

                    {/* Dark Mode Card */}
                    <button
                        onClick={() => handleThemeSelect('dark')}
                        className={cn(
                            "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                            "hover:border-primary/50 hover:bg-accent/50",
                            theme === 'dark'
                                ? "border-primary bg-primary/10 shadow-md"
                                : "border-border bg-card"
                        )}
                    >
                        <div className={cn(
                            "rounded-full p-3",
                            theme === 'dark' ? "bg-primary/20" : "bg-muted"
                        )}>
                            <Moon className={cn(
                                "h-6 w-6",
                                theme === 'dark' ? "text-primary" : "text-muted-foreground"
                            )} />
                        </div>
                        <span className={cn(
                            "font-medium text-sm",
                            theme === 'dark' ? "text-primary" : "text-foreground"
                        )}>
                            {t('wizard.welcome.darkMode', 'Dark Mode')}
                        </span>
                    </button>
                </div>
            </div>

            {/* Get Started button */}
            <Button onClick={onGetStarted} size="lg" className="mt-4">
                {t('wizard.welcome.getStarted')}
            </Button>
        </div>
    );
}

