/**
 * Q-Flash-Web Root Component
 * 
 * Main React application component with routing, i18n, and app shell layout.
 */

import { BrowserRouter } from 'react-router-dom';

// Initialize i18n (must be imported before any component that uses translations)
import '../i18n/config';

// Layout
import { AppLayout } from '@/components/layout';

// Routes
import { AppRoutes } from './routes';

// Hooks
import { useLanguageSync } from '../hooks/useLanguageSync';
import { useModeRedirect } from '../hooks/useModeRedirect';

// Toast notifications
import { Toaster } from 'sonner';

/**
 * Inner App component that uses hooks
 * (Hooks must be used inside Router context)
 */
function AppContent() {
    // Sync i18next language with settings store
    useLanguageSync();

    // Redirect to correct page based on persisted device mode
    useModeRedirect();

    return (
        <>
            <AppLayout>
                <AppRoutes />
            </AppLayout>
            <Toaster
                position="bottom-right"
                toastOptions={{
                    duration: 4000,
                    classNames: {
                        toast: 'bg-card border border-border',
                        title: 'text-foreground',
                        description: 'text-muted-foreground',
                    }
                }}
            />
        </>
    );
}

/**
 * Root App component
 */
export default function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

