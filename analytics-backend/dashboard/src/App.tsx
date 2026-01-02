import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing token
        const token = localStorage.getItem('admin_token');
        if (token) {
            verifyToken(token);
        } else {
            setIsLoading(false);
        }
    }, []);

    const verifyToken = async (token: string) => {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                setIsAuthenticated(true);
            } else {
                localStorage.removeItem('admin_token');
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            localStorage.removeItem('admin_token');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = (token: string) => {
        localStorage.setItem('admin_token', token);
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        setIsAuthenticated(false);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginPage onLogin={handleLogin} />;
    }

    return <Dashboard onLogout={handleLogout} />;
}

export default App;
