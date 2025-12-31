/**
 * Hook to sync URL with stored device mode
 * 
 * On page load, redirects to the appropriate page based on stored mode.
 * The actual device detection and auto-connect is handled by each page.
 */

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDeviceStore } from '@/stores/deviceStore';

const modeRoutes: Record<string, string> = {
    'edl': '/edl',
    'adb': '/adb',
    'fastboot': '/fastboot',
};

/**
 * Redirects to the correct page based on stored device mode (from localStorage)
 * 
 * Note: This only uses the stored mode, not WebUSB detection.
 * Each page handles its own auto-connect logic.
 */
export function useModeRedirect() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentMode = useDeviceStore((state) => state.currentMode);
    const hasRedirected = useRef(false);

    useEffect(() => {
        // Only redirect once on initial load
        if (hasRedirected.current) return;

        // Only process redirect for mode pages (not landing, guide, etc.)
        const modePages = ['/', '/edl', '/adb', '/fastboot'];
        if (!modePages.includes(location.pathname)) {
            hasRedirected.current = true;
            return;
        }

        // If on landing page (/), don't auto-redirect - let user choose
        if (location.pathname === '/') {
            hasRedirected.current = true;
            return;
        }

        // Use stored mode to determine target route
        const targetRoute = modeRoutes[currentMode] || '/edl';

        // Only redirect if we're not already on the target page
        if (location.pathname !== targetRoute) {
            hasRedirected.current = true;
            navigate(targetRoute, { replace: true });
        } else {
            hasRedirected.current = true;
        }
    }, [currentMode, location.pathname, navigate]);
}

export default useModeRedirect;
