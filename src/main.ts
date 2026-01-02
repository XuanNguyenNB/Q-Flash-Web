import './style.css';
import { router } from './router';
import type { Route } from './router';
import { renderSidebar, updateSidebarActive } from './components/sidebar';
import { renderToolPage, initToolPage } from './pages/tool';
import { renderDownloadsPage } from './pages/downloads';
import { renderDriversPage } from './pages/drivers';
import { renderDevicesPage } from './pages/devices';
import { renderDonatePage } from './pages/donate';
import { renderSupportPage } from './pages/support';
import { initI18n, getCurrentLanguage, setLanguage, type Language } from './i18n/i18n';
import { analytics, trackPageview } from './services/analytics';


// ============================================================================
// App Shell
// ============================================================================

function createAppShell(): string {
  return `
        <div class="app-layout">
            ${renderSidebar()}
            <main class="main-content">
                <div class="content-area" id="content-area">
                    <!-- Page content rendered by router -->
                </div>
            </main>
        </div>
    `;
}

// ============================================================================
// Route Registration
// ============================================================================

function registerRoutes(): void {
  // Tool page - WebUSB Flash Tool
  router.register({
    path: 'tool',
    title: 'Flash Tool',
    icon: '📱',
    render: () => renderToolPage(),
  });

  // Downloads page
  router.register({
    path: 'downloads',
    title: 'Downloads',
    icon: '⬇️',
    render: () => renderDownloadsPage(),
  });

  // Drivers page
  router.register({
    path: 'drivers',
    title: 'Drivers',
    icon: '🔧',
    render: () => renderDriversPage(),
  });

  // Devices page
  router.register({
    path: 'devices',
    title: 'Devices',
    icon: '📋',
    render: () => renderDevicesPage(),
  });

  // Donate page
  router.register({
    path: 'donate',
    title: 'Donate',
    icon: '☕',
    render: () => renderDonatePage(),
  });

  // Support page
  router.register({
    path: 'support',
    title: 'Support',
    icon: '❓',
    render: () => renderSupportPage(),
  });
}

// ============================================================================
// Post-render Hooks
// ============================================================================

async function onRouteChange(route: Route): Promise<void> {
  // Update sidebar active state
  updateSidebarActive(route);

  // Track pageview for analytics
  trackPageview(`/${route}`, `${route.charAt(0).toUpperCase() + route.slice(1)} - Q-Flash`);

  // Special handling for tool page - needs initialization
  if (route === 'tool') {
    // Give DOM a moment to update
    await new Promise(resolve => setTimeout(resolve, 50));
    await initToolPage();
  }
}

// ============================================================================
// Initialization
// ============================================================================

async function init(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) {
    console.error('App container not found');
    return;
  }

  // Initialize i18n system
  initI18n();

  // Initialize analytics tracking
  await analytics.init();

  // Render app shell
  app.innerHTML = createAppShell();

  // Register all routes
  registerRoutes();

  // Initialize router with content container
  router.init('content-area', onRouteChange);

  console.log('Q-Flash Universal Qualcomm Tool initialized');
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
