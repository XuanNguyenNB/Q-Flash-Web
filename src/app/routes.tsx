/**
 * Q-Flash-Web Routes Configuration
 *
 * Centralized route definitions for the application.
 */

import { Routes, Route, Navigate } from 'react-router-dom';

// Page imports
import LandingPage from '../pages/LandingPage';
import ToolPage from '../pages/ToolPage';
import GuidePage from '../pages/GuidePage';
import DownloadsPage from '../pages/DownloadsPage';
import SupportPage from '../pages/SupportPage';
import DonatePage from '../pages/DonatePage';
import { ADBPage } from '../pages/ADBPage';
import FastbootPage from '../pages/FastbootPage';
import { AutomationPage } from '../pages/AutomationPage';

/**
 * Route configuration type
 */
export interface RouteConfig {
    path: string;
    element: React.ReactNode;
    label: string;
}

/**
 * Application routes configuration
 */
export const routeConfig: RouteConfig[] = [
    { path: '/', element: <LandingPage />, label: 'nav.home' },
    { path: '/edl', element: <ToolPage />, label: 'nav.edl' },
    { path: '/guide', element: <GuidePage />, label: 'nav.guide' },
    { path: '/downloads', element: <DownloadsPage />, label: 'nav.downloads' },
    { path: '/support', element: <SupportPage />, label: 'nav.support' },
    { path: '/donate', element: <DonatePage />, label: 'nav.donate' },
    { path: '/adb', element: <ADBPage />, label: 'nav.adb' },
    { path: '/fastboot', element: <FastbootPage />, label: 'nav.fastboot' },
    { path: '/automation', element: <AutomationPage />, label: 'nav.automation' },
];

/**
 * App Routes Component
 * 
 * Renders all application routes.
 */
export function AppRoutes() {
    return (
        <Routes>
            {routeConfig.map(({ path, element }) => (
                <Route key={path} path={path} element={element} />
            ))}
            {/* Redirect old /flash route to /edl for compatibility */}
            <Route path="/flash" element={<Navigate to="/edl" replace />} />
        </Routes>
    );
}
