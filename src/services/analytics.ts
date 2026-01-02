/**
 * Q-Flash Analytics Tracking Service
 * 
 * This service collects and sends user behavior data to the analytics backend.
 * Features:
 * - Automatic session management
 * - Pageview tracking
 * - Custom event tracking
 * - Error tracking
 * - Device info collection
 */

// Configuration
const ANALYTICS_ENDPOINT = import.meta.env.PROD
    ? 'https://xuannguyen.site/api/analytics'
    : 'http://localhost:3001/api/analytics';

const STORAGE_KEYS = {
    VISITOR_ID: 'qf_visitor_id',
    SESSION_ID: 'qf_session_id',
    SESSION_START: 'qf_session_start'
};

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Analytics Service Class
 */
class AnalyticsService {
    private visitorId: string | null = null;
    private sessionId: string | null = null;
    private initialized = false;
    private lastPagePath: string | null = null;
    private lastPageTime: number = 0;
    private eventQueue: Array<{
        category: string;
        action: string;
        label?: string;
        value?: string;
        timestamp: string;
    }> = [];
    private flushTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Initialize analytics - call this when app starts
     */
    async init(): Promise<void> {
        if (this.initialized) return;

        try {
            // Get or create visitor ID (persistent)
            this.visitorId = localStorage.getItem(STORAGE_KEYS.VISITOR_ID);
            if (!this.visitorId) {
                this.visitorId = this.generateId();
                localStorage.setItem(STORAGE_KEYS.VISITOR_ID, this.visitorId);
            }

            // Check for existing session
            const storedSessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
            const sessionStart = sessionStorage.getItem(STORAGE_KEYS.SESSION_START);

            if (storedSessionId && sessionStart) {
                const elapsed = Date.now() - parseInt(sessionStart);
                if (elapsed < SESSION_TIMEOUT) {
                    this.sessionId = storedSessionId;
                }
            }

            // Create new session if needed
            if (!this.sessionId) {
                await this.createSession();
            }

            // Setup error tracking
            this.setupErrorTracking();

            // Track page visibility for time on page
            this.setupVisibilityTracking();

            this.initialized = true;
            console.log('[Analytics] Initialized', { visitorId: this.visitorId, sessionId: this.sessionId });
        } catch (error) {
            console.error('[Analytics] Init failed:', error);
        }
    }

    /**
     * Create a new session
     */
    private async createSession(): Promise<void> {
        this.sessionId = this.generateId();
        sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, this.sessionId);
        sessionStorage.setItem(STORAGE_KEYS.SESSION_START, Date.now().toString());

        const deviceInfo = this.getDeviceInfo();

        try {
            await this.send('/session', {
                sessionId: this.sessionId,
                visitorId: this.visitorId,
                ...deviceInfo,
                landingPage: window.location.pathname,
                referrer: document.referrer || null
            });
        } catch (error) {
            console.error('[Analytics] Session creation failed:', error);
        }
    }

    /**
     * Track a pageview
     */
    async trackPageview(path?: string, title?: string): Promise<void> {
        if (!this.initialized) {
            await this.init();
        }

        const currentPath = path || window.location.pathname;
        const currentTitle = title || document.title;

        // Calculate time on previous page
        if (this.lastPagePath && this.lastPageTime) {
            const timeOnPage = Math.floor((Date.now() - this.lastPageTime) / 1000);
            // Send update for previous page (if we want to track time on page)
        }

        this.lastPagePath = currentPath;
        this.lastPageTime = Date.now();

        try {
            await this.send('/pageview', {
                sessionId: this.sessionId,
                path: currentPath,
                title: currentTitle
            });
            console.log('[Analytics] Pageview:', currentPath);
        } catch (error) {
            console.error('[Analytics] Pageview failed:', error);
        }
    }

    /**
     * Track a custom event
     */
    async trackEvent(
        category: string,
        action: string,
        label?: string,
        value?: string | number,
        _metadata?: Record<string, unknown>
    ): Promise<void> {
        // Auto-init if not initialized
        if (!this.initialized || !this.sessionId) {
            await this.init();
        }

        if (!this.sessionId) {
            console.warn('[Analytics] Session still not initialized after init attempt');
            return;
        }

        const event = {
            category,
            action,
            label,
            value: value?.toString(),
            timestamp: new Date().toISOString()
        };

        // Add to queue for batching
        this.eventQueue.push(event);

        // Debounce flush
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
        }
        this.flushTimeout = setTimeout(() => this.flushEventQueue(), 1000);

        console.log('[Analytics] Event queued:', category, action, label);
    }

    /**
     * Flush event queue to server
     */
    private async flushEventQueue(): Promise<void> {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        try {
            if (events.length === 1) {
                // Single event
                await this.send('/event', {
                    sessionId: this.sessionId,
                    ...events[0]
                });
            } else {
                // Batch events
                await this.send('/batch', {
                    sessionId: this.sessionId,
                    events
                });
            }
        } catch (error) {
            console.error('[Analytics] Event flush failed:', error);
            // Put events back in queue for retry
            this.eventQueue = [...events, ...this.eventQueue];
        }
    }

    /**
     * Track an error
     */
    async trackError(
        message: string,
        stack?: string,
        errorType: 'js' | 'api' | 'usb' = 'js',
        url?: string,
        line?: number,
        column?: number
    ): Promise<void> {
        try {
            await this.send('/error', {
                sessionId: this.sessionId,
                errorType,
                message,
                stack,
                url: url || window.location.href,
                line,
                column
            });
            console.log('[Analytics] Error tracked:', message);
        } catch (error) {
            console.error('[Analytics] Error tracking failed:', error);
        }
    }

    /**
     * Get device and browser information
     */
    private getDeviceInfo(): Record<string, unknown> {
        const ua = navigator.userAgent;

        // Detect browser
        let browser = 'Unknown';
        let browserVersion = '';
        if (ua.includes('Firefox/')) {
            browser = 'Firefox';
            browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || '';
        } else if (ua.includes('Edg/')) {
            browser = 'Edge';
            browserVersion = ua.match(/Edg\/(\d+)/)?.[1] || '';
        } else if (ua.includes('Chrome/')) {
            browser = 'Chrome';
            browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || '';
        } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
            browser = 'Safari';
            browserVersion = ua.match(/Version\/(\d+)/)?.[1] || '';
        }

        // Detect OS
        let os = 'Unknown';
        let osVersion = '';
        if (ua.includes('Windows')) {
            os = 'Windows';
            if (ua.includes('Windows NT 10')) osVersion = '10/11';
            else if (ua.includes('Windows NT 6.3')) osVersion = '8.1';
            else if (ua.includes('Windows NT 6.1')) osVersion = '7';
        } else if (ua.includes('Mac OS X')) {
            os = 'macOS';
            osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
        } else if (ua.includes('Linux')) {
            os = 'Linux';
        } else if (ua.includes('Android')) {
            os = 'Android';
            osVersion = ua.match(/Android (\d+)/)?.[1] || '';
        } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
            os = 'iOS';
            osVersion = ua.match(/OS (\d+)/)?.[1] || '';
        }

        // Detect device type
        let deviceType = 'desktop';
        if (/Mobi|Android/i.test(ua)) {
            deviceType = 'mobile';
        } else if (/Tablet|iPad/i.test(ua)) {
            deviceType = 'tablet';
        }

        return {
            userAgent: ua,
            browser,
            browserVersion,
            os,
            osVersion,
            deviceType,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            language: navigator.language
        };
    }

    /**
     * Setup global error tracking
     */
    private setupErrorTracking(): void {
        // Track unhandled errors
        window.addEventListener('error', (event) => {
            this.trackError(
                event.message,
                event.error?.stack,
                'js',
                event.filename,
                event.lineno,
                event.colno
            );
        });

        // Track unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const message = event.reason?.message || String(event.reason);
            const stack = event.reason?.stack;
            this.trackError(message, stack, 'js');
        });
    }

    /**
     * Setup page visibility tracking for accurate time on page
     */
    private setupVisibilityTracking(): void {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // User left the page - flush any pending events
                this.flushEventQueue();
            }
        });

        // Send any pending events before page unload
        window.addEventListener('beforeunload', () => {
            this.flushEventQueue();
        });
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * Send data to analytics endpoint
     */
    private async send(endpoint: string, data: Record<string, unknown>): Promise<void> {
        const response = await fetch(`${ANALYTICS_ENDPOINT}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            keepalive: true // Ensure request completes even if page unloads
        });

        if (!response.ok) {
            throw new Error(`Analytics request failed: ${response.status}`);
        }
    }

    /**
     * Get current session ID (for debugging)
     */
    getSessionId(): string | null {
        return this.sessionId;
    }

    /**
     * Get current visitor ID (for debugging)
     */
    getVisitorId(): string | null {
        return this.visitorId;
    }
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Export convenience functions
export const trackPageview = (path?: string, title?: string) => analytics.trackPageview(path, title);
export const trackEvent = (
    category: string,
    action: string,
    label?: string,
    value?: string | number
) => analytics.trackEvent(category, action, label, value);
export const trackError = (
    message: string,
    stack?: string,
    errorType?: 'js' | 'api' | 'usb'
) => analytics.trackError(message, stack, errorType);
