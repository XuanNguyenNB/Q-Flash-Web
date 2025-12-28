/**
 * Downloads Page
 */

export async function renderDownloadsPage(): Promise<string> {
    let downloadsData: any = { tools: [], drivers: [] };

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

    return `
        <div class="page downloads-page">
            <div class="page-header">
                <h1>⬇️ Downloads</h1>
                <p>Tools and utilities for Q-Flash ecosystem</p>
            </div>
            
            <section class="download-section">
                <h2>🔧 Tools</h2>
                <div class="download-grid">
                    ${toolsHtml || '<p class="empty-state">No tools available</p>'}
                </div>
            </section>
            
            <section class="download-section">
                <h2>📦 EDL Programmers</h2>
                <p class="section-hint">Programmers are bundled in device presets. Select your device in the Flash Tool.</p>
            </section>
        </div>
    `;
}
