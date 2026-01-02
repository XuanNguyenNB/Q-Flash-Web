/**
 * Mode Selector Component
 * 
 * Tab pills component for switching between device modes (EDL, ADB, Fastboot).
 * Shows in the Header navigation area.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Zap, Smartphone, Wrench } from 'lucide-react';
import { trackEvent } from '@/services/analytics';

// Stores
import { useDeviceStore, type DeviceMode } from '@/stores/deviceStore';

// Utils
import { cn } from '@/lib/utils';

/**
 * Mode configuration
 */
interface ModeConfig {
    id: DeviceMode;
    labelKey: string;
    icon: React.ElementType;
    path: string;
}

const modes: ModeConfig[] = [
    { id: 'edl', labelKey: 'mode.edl', icon: Zap, path: '/edl' },
    { id: 'adb', labelKey: 'mode.adb', icon: Smartphone, path: '/adb' },
    { id: 'fastboot', labelKey: 'mode.fastboot', icon: Wrench, path: '/fastboot' },
];

/**
 * Mode Selector component - Tab pills for selecting device mode
 */
export function ModeSelector() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    // Device store
    const currentMode = useDeviceStore((state) => state.currentMode);
    const isConnected = useDeviceStore((state) => state.isConnected);
    const setMode = useDeviceStore((state) => state.setMode);

    /**
     * Handle mode selection
     */
    /**
     * Handle mode selection
     */
    const handleModeClick = (mode: ModeConfig) => {
        // Track mode switch
        trackEvent('mode', 'switch', mode.id);

        // Allow switching mode even if connected
        // This allows users to manually switch if auto-detection fails
        // or if they want to view other pages while connected
        setMode(mode.id);
        navigate(mode.path);
    };

    /**
     * Check if mode is currently active based on URL path
     */
    const isActive = (mode: ModeConfig) => {
        if (mode.id === 'edl') {
            // EDL mode is active on /edl path
            return location.pathname === '/edl' || location.pathname === '/flash';
        }
        return location.pathname.startsWith(mode.path);
    };

    return (
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {modes.map((mode) => {
                const Icon = mode.icon;
                const active = isActive(mode);
                const disabled = isConnected && mode.id !== currentMode;

                return (
                    <button
                        key={mode.id}
                        onClick={() => handleModeClick(mode)}
                        title={t(mode.labelKey)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                            active && [
                                "bg-primary text-primary-foreground shadow-sm",
                                // Glow effect for active mode
                                "shadow-primary/20",
                            ],
                            !active && [
                                "text-muted-foreground hover:text-foreground hover:bg-muted",
                            ]
                        )}
                    >
                        <Icon className={cn(
                            "h-4 w-4",
                            active && "text-primary-foreground",
                            mode.id === 'edl' && active && "text-yellow-300",
                        )} />
                        <span className="hidden sm:inline">{t(mode.labelKey)}</span>
                    </button>
                );
            })}
        </div>
    );
}
