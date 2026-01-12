/**
 * AppLayout Component
 *
 * Main layout wrapper with Header and unified Sidebar (no separate LogPanel).
 * Part of the App Shell layout.
 */

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// Layout components
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ADBAutoConnector } from '../features/adb/ADBAutoConnector';

// Utils
import { cn } from '@/lib/utils';

interface AppLayoutProps {
    children: ReactNode;
}

/**
 * Routes that should use full-width layout (no sidebar)
 */
const FULL_WIDTH_ROUTES = ['/'];

/**
 * AppLayout component providing the layout structure
 */
export function AppLayout({ children }: AppLayoutProps) {
    const location = useLocation();
    // Load sidebar collapsed state from localStorage (persist user preference)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        return saved ? JSON.parse(saved) : false;
    });

    // Check if current route should have full-width layout
    const isFullWidthRoute = FULL_WIDTH_ROUTES.includes(location.pathname);

    // Persist sidebar state to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', JSON.stringify(sidebarCollapsed));
    }, [sidebarCollapsed]);

    const handleToggleSidebar = () => {
        setSidebarCollapsed((prev: boolean) => !prev);
    };

    // Calculate main content margins based on sidebar state
    const sidebarWidth = sidebarCollapsed ? 64 : 340; // 64px collapsed, 340px expanded

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

            {/* Sidebar (includes both Device/Actions and Logs tabs) */}
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggleCollapse={handleToggleSidebar}
            />

            {/* Main Content Area */}
            <main
                className={cn(
                    "pt-14 min-h-screen transition-all duration-300"
                )}
                style={{
                    paddingLeft: `${sidebarWidth}px`,
                }}
            >
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
