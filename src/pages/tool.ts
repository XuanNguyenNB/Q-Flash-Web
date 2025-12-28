/**
 * Tool Page - WebUSB Flash Tool
 * 
 * This is a wrapper that returns HTML for the tool.
 * The actual tool logic remains in tool.ts
 */

export function renderToolPage(): string {
    // Return the tool container - the actual tool will initialize here
    return `
        <div class="page tool-page" id="tool-page">
            <div class="tool-container">
                <!-- Tool content will be rendered by tool.ts -->
                <div class="tool-loading">
                    <div class="spinner"></div>
                    <span>Initializing Flash Tool...</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize the tool after page is rendered
 * This is called by the router after rendering
 */
export async function initToolPage(): Promise<void> {
    // Dynamic import to avoid circular dependencies
    const { initTool } = await import('../tool');
    initTool();
}
