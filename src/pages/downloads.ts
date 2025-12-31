/**
 * Downloads Page
 */

interface RomInfo {
    id: string;
    device: string;
    deviceId: string;
    codename: string;
    brand: string;
    version: string;
    android: string;
    buildNumber: string;
    region: string;
    size: string;
    date: string;
    type: 'full' | 'incremental' | 'fastboot';
    format: 'extracted' | 'ozip' | 'zip';
    status: 'verified' | 'untested';
    links: {
        onedrive?: string;
        gdrive?: string;
        mega?: string;
    };
    changelog: string;
    md5: string;
}

interface DownloadsData {
    tools: any[];
    drivers: any[];
    roms: RomInfo[];
}

let currentFilter = {
    brand: 'all',
    android: 'all',
    region: 'all',
    search: ''
};

function getBrandIcon(brand: string): string {
    switch (brand.toLowerCase()) {
        case 'oppo': return '🟢';
        case 'oneplus': return '🔴';
        case 'realme': return '🟡';
        default: return '📱';
    }
}

function getStatusBadge(status: string): string {
    if (status === 'verified') {
        return '<span class="rom-status rom-status-verified">✓ Verified</span>';
    }
    return '<span class="rom-status rom-status-untested">⚠ Untested</span>';
}

function getFormatBadge(format: string): string {
    switch (format) {
        case 'extracted':
            return '<span class="rom-badge rom-badge-ready">🔥 Flash Ready</span>';
        case 'ozip':
            return '<span class="rom-badge rom-badge-ozip">📦 OZIP</span>';
        case 'zip':
            return '<span class="rom-badge rom-badge-zip">📁 ZIP</span>';
        default:
            return '';
    }
}

function getRegionFlag(region: string): string {
    switch (region.toUpperCase()) {
        case 'CN': return '🇨🇳';
        case 'GLOBAL': return '🌍';
        case 'IN': return '🇮🇳';
        case 'EU': return '🇪🇺';
        case 'US': return '🇺🇸';
        default: return '🌐';
    }
}

function renderDownloadLinks(links: RomInfo['links'], romId: string): string {
    const buttons: string[] = [];
    
    if (links.onedrive) {
        buttons.push(`<a href="${links.onedrive}" target="_blank" class="btn btn-primary btn-sm">OneDrive</a>`);
    }
    if (links.gdrive) {
        buttons.push(`<a href="${links.gdrive}" target="_blank" class="btn btn-secondary btn-sm">GDrive</a>`);
    }
    if (links.mega) {
        buttons.push(`<a href="${links.mega}" target="_blank" class="btn btn-secondary btn-sm">Mega</a>`);
    }
    
    if (buttons.length === 0) {
        return '<span class="rom-no-links">Links coming soon...</span>';
    }
    
    return buttons.join('');
}

function filterRoms(roms: RomInfo[]): RomInfo[] {
    return roms.filter(rom => {
        if (currentFilter.brand !== 'all' && rom.brand !== currentFilter.brand) {
            return false;
        }
        if (currentFilter.android !== 'all' && rom.android !== currentFilter.android) {
            return false;
        }
        if (currentFilter.region !== 'all' && rom.region.toLowerCase() !== currentFilter.region.toLowerCase()) {
            return false;
        }
        if (currentFilter.search) {
            const searchLower = currentFilter.search.toLowerCase();
            const searchableText = `${rom.device} ${rom.codename} ${rom.version} ${rom.buildNumber}`.toLowerCase();
            if (!searchableText.includes(searchLower)) {
                return false;
            }
        }
        return true;
    });
}

function renderRomCard(rom: RomInfo): string {
    return `
        <div class="rom-card" data-rom-id="${rom.id}">
            <div class="rom-header">
                <div class="rom-device">
                    <span class="rom-brand-icon">${getBrandIcon(rom.brand)}</span>
                    <div class="rom-device-info">
                        <h3>${rom.device}</h3>
                        <span class="rom-codename">${rom.codename}</span>
                    </div>
                </div>
                <div class="rom-badges">
                    ${getStatusBadge(rom.status)}
                    ${getFormatBadge(rom.format)}
                </div>
            </div>
            
            <div class="rom-details">
                <div class="rom-version">
                    <span class="rom-os">${rom.version}</span>
                    <span class="rom-android">Android ${rom.android}</span>
                </div>
                <div class="rom-meta">
                    <span class="rom-region">${getRegionFlag(rom.region)} ${rom.region}</span>
                    <span class="rom-size">💾 ${rom.size}</span>
                    <span class="rom-date">📅 ${rom.date}</span>
                </div>
            </div>
            
            <div class="rom-build">
                <code>${rom.buildNumber}</code>
            </div>
            
            ${rom.changelog ? `
                <div class="rom-changelog">
                    <p>${rom.changelog}</p>
                </div>
            ` : ''}
            
            <div class="rom-actions">
                ${renderDownloadLinks(rom.links, rom.id)}
            </div>
        </div>
    `;
}

function renderFilterBar(roms: RomInfo[]): string {
    const brands = [...new Set(roms.map(r => r.brand))];
    const androids = [...new Set(roms.map(r => r.android))].sort((a, b) => Number(b) - Number(a));
    const regions = [...new Set(roms.map(r => r.region))];

    return `
        <div class="rom-filters">
            <div class="filter-group">
                <input type="text" 
                       id="rom-search" 
                       class="filter-search" 
                       placeholder="🔍 Search device, codename..."
                       value="${currentFilter.search}">
            </div>
            <div class="filter-group">
                <select id="filter-brand" class="filter-select">
                    <option value="all">All Brands</option>
                    ${brands.map(b => `
                        <option value="${b}" ${currentFilter.brand === b ? 'selected' : ''}>
                            ${getBrandIcon(b)} ${b.charAt(0).toUpperCase() + b.slice(1)}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="filter-group">
                <select id="filter-android" class="filter-select">
                    <option value="all">All Android</option>
                    ${androids.map(a => `
                        <option value="${a}" ${currentFilter.android === a ? 'selected' : ''}>
                            Android ${a}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="filter-group">
                <select id="filter-region" class="filter-select">
                    <option value="all">All Regions</option>
                    ${regions.map(r => `
                        <option value="${r.toLowerCase()}" ${currentFilter.region === r.toLowerCase() ? 'selected' : ''}>
                            ${getRegionFlag(r)} ${r}
                        </option>
                    `).join('')}
                </select>
            </div>
        </div>
    `;
}

function initFilterListeners(roms: RomInfo[]): void {
    setTimeout(() => {
        const searchInput = document.getElementById('rom-search') as HTMLInputElement;
        const brandSelect = document.getElementById('filter-brand') as HTMLSelectElement;
        const androidSelect = document.getElementById('filter-android') as HTMLSelectElement;
        const regionSelect = document.getElementById('filter-region') as HTMLSelectElement;
        const romsGrid = document.getElementById('roms-grid');

        const updateRomsDisplay = () => {
            if (!romsGrid) return;
            const filtered = filterRoms(roms);
            if (filtered.length === 0) {
                romsGrid.innerHTML = '<p class="empty-state">No ROMs match your filters</p>';
            } else {
                romsGrid.innerHTML = filtered.map(rom => renderRomCard(rom)).join('');
            }
        };

        searchInput?.addEventListener('input', (e) => {
            currentFilter.search = (e.target as HTMLInputElement).value;
            updateRomsDisplay();
        });

        brandSelect?.addEventListener('change', (e) => {
            currentFilter.brand = (e.target as HTMLSelectElement).value;
            updateRomsDisplay();
        });

        androidSelect?.addEventListener('change', (e) => {
            currentFilter.android = (e.target as HTMLSelectElement).value;
            updateRomsDisplay();
        });

        regionSelect?.addEventListener('change', (e) => {
            currentFilter.region = (e.target as HTMLSelectElement).value;
            updateRomsDisplay();
        });
    }, 100);
}

export async function renderDownloadsPage(): Promise<string> {
    let downloadsData: DownloadsData = { tools: [], drivers: [], roms: [] };

    try {
        const response = await fetch('/configs/downloads.json');
        if (response.ok) {
            downloadsData = await response.json();
        }
    } catch (error) {
        console.error('Failed to load downloads config:', error);
    }

    const toolsHtml = downloadsData.tools.map((tool: any) => `
        <div class="download-card">
            <div class="download-icon">${tool.icon}</div>
            <div class="download-info">
                <h3>${tool.name}</h3>
                <p class="download-desc">${tool.description}</p>
                <span class="download-version">v${tool.version}</span>
            </div>
            <div class="download-actions">
                ${tool.links.github ? `<a href="${tool.links.github}" target="_blank" class="btn btn-primary btn-sm">⬇️ Download</a>` : ''}
                ${tool.links.onedrive ? `<a href="${tool.links.onedrive}" target="_blank" class="btn btn-secondary btn-sm">OneDrive</a>` : ''}
                ${tool.links.gdrive ? `<a href="${tool.links.gdrive}" target="_blank" class="btn btn-secondary btn-sm">GDrive</a>` : ''}
            </div>
        </div>
    `).join('');

    const roms = downloadsData.roms || [];
    const filteredRoms = filterRoms(roms);

    // Initialize filter listeners after render
    initFilterListeners(roms);

    return `
        <div class="page downloads-page">
            <div class="page-header">
                <h1>⬇️ Downloads</h1>
                <p>Tools, ROMs and utilities for Q-Flash ecosystem</p>
            </div>
            
            <section class="download-section">
                <h2>🔧 Tools</h2>
                <div class="download-grid">
                    ${toolsHtml || '<p class="empty-state">No tools available</p>'}
                </div>
            </section>
            
            <section class="download-section">
                <h2>📱 Stock ROMs</h2>
                <p class="section-desc">Pre-extracted firmware ready for EDL flashing. All ROMs are compatible with Q-Flash Web.</p>
                
                ${renderFilterBar(roms)}
                
                <div class="rom-grid" id="roms-grid">
                    ${filteredRoms.length > 0 
                        ? filteredRoms.map(rom => renderRomCard(rom)).join('')
                        : '<p class="empty-state">No ROMs available yet. Check back later!</p>'
                    }
                </div>
            </section>
            
            <section class="download-section">
                <h2>📦 EDL Programmers</h2>
                <p class="section-hint">Programmers are bundled in device presets. Select your device in the Flash Tool.</p>
            </section>
        </div>
    `;
}
