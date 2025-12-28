/**
 * Simple hash-based router for SPA navigation
 */

export type Route = 'tool' | 'downloads' | 'drivers' | 'devices' | 'donate' | 'support';

export interface RouteConfig {
    path: Route;
    title: string;
    icon: string;
    render: () => string | Promise<string>;
}

class Router {
    private routes: Map<Route, RouteConfig> = new Map();
    private currentRoute: Route = 'tool';
    private contentContainer: HTMLElement | null = null;
    private onRouteChange: ((route: Route) => void) | null = null;

    /**
     * Register a route
     */
    register(config: RouteConfig): void {
        this.routes.set(config.path, config);
    }

    /**
     * Initialize router with content container
     */
    init(containerId: string, onChange?: (route: Route) => void): void {
        this.contentContainer = document.getElementById(containerId);
        this.onRouteChange = onChange || null;

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleHashChange());

        // Handle initial route
        this.handleHashChange();
    }

    /**
     * Navigate to a route
     */
    navigate(route: Route): void {
        window.location.hash = route;
    }

    /**
     * Get current route
     */
    getCurrentRoute(): Route {
        return this.currentRoute;
    }

    /**
     * Get all registered routes
     */
    getRoutes(): RouteConfig[] {
        return Array.from(this.routes.values());
    }

    /**
     * Handle hash change event
     */
    private async handleHashChange(): Promise<void> {
        const hash = window.location.hash.slice(1) || 'tool';
        const route = hash as Route;

        if (this.routes.has(route)) {
            this.currentRoute = route;
            await this.render(route);

            if (this.onRouteChange) {
                this.onRouteChange(route);
            }
        } else {
            // Default to tool page
            this.navigate('tool');
        }
    }

    /**
     * Render the current route
     */
    private async render(route: Route): Promise<void> {
        if (!this.contentContainer) return;

        const config = this.routes.get(route);
        if (!config) return;

        // Update page title
        document.title = `${config.title} - Q-Flash`;

        // Show loading state
        this.contentContainer.innerHTML = `
            <div class="page-loading">
                <div class="spinner"></div>
                <span>Loading...</span>
            </div>
        `;

        try {
            const content = await config.render();
            this.contentContainer.innerHTML = content;
        } catch (error) {
            this.contentContainer.innerHTML = `
                <div class="page-error">
                    <span class="error-icon">⚠️</span>
                    <p>Failed to load page</p>
                </div>
            `;
            console.error('Router render error:', error);
        }
    }
}

// Singleton instance
export const router = new Router();
