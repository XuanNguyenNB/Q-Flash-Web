/**
 * Sidebar Navigation Component
 */

import { router } from '../router';
import type { Route } from '../router';

export interface NavItem {
    route: Route;
    icon: string;
    label: string;
}

const NAV_ITEMS: NavItem[] = [
    { route: 'tool', icon: '📱', label: 'Flash Tool' },
    { route: 'downloads', icon: '⬇️', label: 'Downloads' },
    { route: 'drivers', icon: '🔧', label: 'Drivers' },
    { route: 'devices', icon: '📋', label: 'Devices' },
    { route: 'donate', icon: '☕', label: 'Donate' },
    { route: 'support', icon: '❓', label: 'Support' },
];

/**
 * Render the sidebar navigation
 */
export function renderSidebar(): string {
    const currentRoute = router.getCurrentRoute();

    const navItemsHtml = NAV_ITEMS.map(item => `
        <a href="#${item.route}" 
           class="nav-item ${currentRoute === item.route ? 'active' : ''}"
           data-route="${item.route}"
           title="${item.label}">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${item.label}</span>
        </a>
    `).join('');

    return `
        <nav class="sidebar-nav">
            <div class="sidebar-header">
                <div class="logo">
                    <span class="logo-icon">⚡</span>
                    <span class="logo-text">Q-Flash</span>
                </div>
            </div>
            
            <div class="nav-items">
                ${navItemsHtml}
            </div>
            
            <div class="sidebar-footer">
                <div class="version-info">
                    <span class="version">v1.0.0</span>
                </div>
                <div class="author-info">
                    <span class="author">by Xuan Nguyen</span>
                </div>
            </div>
        </nav>
    `;
}

/**
 * Update sidebar active state
 */
export function updateSidebarActive(route: Route): void {
    // Remove active from all
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active to current
    const activeItem = document.querySelector(`.nav-item[data-route="${route}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}

/**
 * Toggle sidebar expand/collapse
 */
export function toggleSidebar(): void {
    const sidebar = document.querySelector('.sidebar-nav');
    if (sidebar) {
        sidebar.classList.toggle('expanded');
    }
}
