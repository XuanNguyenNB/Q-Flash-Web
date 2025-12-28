/**
 * Devices Page - Supported device list
 */

import { loadDeviceConfigs } from '../services/deviceConfig';
import type { DeviceProfile } from '../services/deviceConfig';


export async function renderDevicesPage(): Promise<string> {
    let devices: DeviceProfile[] = [];

    try {
        const result = await loadDeviceConfigs();
        if (result.success && result.data) {
            devices = result.data;
        }
    } catch (error) {
        console.error('Failed to load devices config:', error);
    }

    const statusIcons: Record<string, string> = {
        'tested': '✅',
        'beta': '⚡',
        'coming': '⏳'
    };

    const statusLabels: Record<string, string> = {
        'tested': 'Tested',
        'beta': 'Beta',
        'coming': 'Coming Soon'
    };

    const brandIcons: Record<string, string> = {
        'oppo': '🟢',
        'oneplus': '🔴',
        'realme': '🟡',
        'qualcomm': '⚪'
    };

    const devicesHtml = devices.map(device => `
        <tr class="device-row status-${device.status}">
            <td class="brand-cell">
                <span class="brand-icon">${brandIcons[device.brand] || '📱'}</span>
                <span class="brand-name">${device.brand.toUpperCase()}</span>
            </td>
            <td class="name-cell">
                <strong>${device.name}</strong>
                <span class="codename">${device.codename}</span>
            </td>
            <td class="chipset-cell">
                <span class="chipset-name">${device.chipsetName}</span>
                <span class="chipset-code">${device.chipset}</span>
            </td>
            <td class="status-cell">
                <span class="status-badge status-${device.status}">
                    ${statusIcons[device.status]} ${statusLabels[device.status]}
                </span>
            </td>
        </tr>
    `).join('');

    return `
        <div class="page devices-page">
            <div class="page-header">
                <h1>📋 Supported Devices</h1>
                <p>Qualcomm-based devices compatible with Q-Flash</p>
            </div>
            
            <section class="devices-section">
                <div class="status-legend">
                    <span class="legend-item"><span class="status-badge status-tested">✅ Tested</span> Fully tested & verified</span>
                    <span class="legend-item"><span class="status-badge status-beta">⚡ Beta</span> Work in progress</span>
                    <span class="legend-item"><span class="status-badge status-coming">⏳ Coming</span> Planned support</span>
                </div>
                
                <div class="devices-table-container">
                    <table class="devices-table">
                        <thead>
                            <tr>
                                <th>Brand</th>
                                <th>Device</th>
                                <th>Chipset</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${devicesHtml || '<tr><td colspan="4" class="empty-state">No devices found</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </section>
            
            <section class="request-section">
                <h2>🙋 Request Device Support</h2>
                <p>Have a Qualcomm device not listed here? Contact us!</p>
                <div class="contact-links">
                    <a href="https://t.me/mitomtreem" target="_blank" class="btn btn-secondary">
                        💬 Telegram
                    </a>
                    <a href="https://www.facebook.com/xuannguyen030923" target="_blank" class="btn btn-secondary">
                        📘 Facebook
                    </a>
                </div>
            </section>
        </div>
    `;
}
