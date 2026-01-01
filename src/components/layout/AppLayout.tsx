/**
 * AppLayout Component
 * 
 * Main layout wrapper providing 3-column grid layout with Header, Sidebar, and LogPanel.
 * Part of the App Shell layout.
 */

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// Layout components
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { LogPanel } from './LogPanel';
import { ADBAutoConnector } from '../features/adb/ADBAutoConnector';

// Utils
import { cn } from '@/lib/utils';

interface AppLayoutProps {
    children: ReactNode;
}

/**
 * Breakpoint for responsive layout (1280px)
 */
const DESKTOP_BREAKPOINT = 1280;

/**
 * Routes that should use full-width layout (no sidebar/logpanel)
 */
const FULL_WIDTH_ROUTES = ['/'];

/**
 * AppLayout component providing the 3-column layout structure
 */
export function AppLayout({ children }: AppLayoutProps) {
    const location = useLocation();
    // Load sidebar collapsed state from localStorage (persist user preference)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        return saved ? JSON.parse(saved) : false;
    });

    // Load log panel collapsed state from localStorage (persist user preference)
    // Default to collapsed (true) for cleaner UI
    const [logPanelCollapsed, setLogPanelCollapsed] = useState(() => {
        const saved = localStorage.getItem('logpanel-collapsed');
        return saved ? JSON.parse(saved) : true; // Default collapsed
    });

    const [isDesktop, setIsDesktop] = useState(true);

    // Check if current route should have full-width layout
    const isFullWidthRoute = FULL_WIDTH_ROUTES.includes(location.pathname);

    // Check screen size for responsive behavior (LogPanel visibility only)
    useEffect(() => {
        const checkScreenSize = () => {
            const isDesktopView = window.innerWidth >= DESKTOP_BREAKPOINT;
            setIsDesktop(isDesktopView);

            // NOTE: We do NOT auto-collapse sidebar/logpanel on resize
            // User's preferences are preserved across screen sizes
        };

        // Initial check
        checkScreenSize();

        // Listen for resize
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Persist sidebar state to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', JSON.stringify(sidebarCollapsed));
    }, [sidebarCollapsed]);

    // Persist log panel state to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('logpanel-collapsed', JSON.stringify(logPanelCollapsed));
    }, [logPanelCollapsed]);

    const handleToggleSidebar = () => {
        setSidebarCollapsed((prev: boolean) => !prev);
    };

    const handleToggleLogPanel = () => {
        setLogPanelCollapsed((prev: boolean) => !prev);
    };

    // Calculate main content margins based on sidebar and log panel state
    const sidebarWidth = sidebarCollapsed ? 64 : 260; // 64px collapsed, 260px expanded
    const logPanelWidth = logPanelCollapsed ? 64 : 320; // 64px collapsed, 320px expanded

    // Full-width layout for landing page
    if (isFullWidthRoute) {
        return (
            <div className="min-h-screen bg-background text-foreground">
                {/* Fixed Header */}
                <Header />

                {/* Main Content Area - Full Width */}
                <main className="pt-14 min-h-screen">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <ADBAutoConnector />

            {/* Fixed Header */}
            <Header />

            {/* Sidebar */}
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggleCollapse={handleToggleSidebar}
            />

            {/* Log Panel - always visible on desktop */}
            {isDesktop && (
                <LogPanel
                    collapsed={logPanelCollapsed}
                    onToggleCollapse={handleToggleLogPanel}
                />
            )}

            {/* Main Content Area */}
            <main
                className={cn(
                    "pt-14 min-h-screen transition-all duration-300"
                )}
                style={{
                    paddingLeft: `${sidebarWidth}px`,
                    paddingRight: isDesktop ? `${logPanelWidth}px` : '0',
                }}
            >
                <div className="p-6">
                    {children}
                </div>
            </main>

            {/* Mobile Log Panel Toggle - future enhancement */}
            {!isDesktop && (
                <div className="fixed bottom-4 right-4 z-50">
                    {/* TODO: Add floating button to open log panel drawer on mobile */}
                </div>
            )}
        </div>
    );
}
