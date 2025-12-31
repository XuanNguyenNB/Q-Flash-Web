/**
 * XML Utility Functions
 * 
 * Helper functions for building and parsing Firehose XML commands.
 */

/**
 * Build an XML command string for Firehose protocol
 */
export function buildXmlCommand(tagName: string, attributes: Record<string, string | number | boolean> = {}, selfClosing = true): string {
    // NOTE: We no longer filter empty strings - some devices require filename="" to be sent explicitly
    const attrString = Object.entries(attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');

    const attrPart = attrString ? ` ${attrString}` : '';

    if (selfClosing) {
        return `<?xml version="1.0" ?><data><${tagName}${attrPart} /></data>`;
    } else {
        return `<?xml version="1.0" ?><data><${tagName}${attrPart}></${tagName}></data>`;
    }
}

/**
 * Build a VIP action command
 */
export function buildVipCommand(action: string, extraTags: Record<string, string | number> = {}): string {
    const tagsString = Object.entries(extraTags)
        .map(([key, value]) => `<${key}>${value}</${key}>`)
        .join('');

    return `<?xml version="1.0" ?><data><action>${action}</action>${tagsString}</data>`;
}

/**
 * Build a self-closing VIP command (like <verify/> or <sha256init/>)
 */
export function buildVipSelfClosingCommand(tagName: string): string {
    return `<?xml version="1.0" ?><data><${tagName}/></data>`;
}

/**
 * Parse an XML response to check for ACK/NAK
 */
export function parseXmlResponse(xml: string): { success: boolean; value?: string; rawlog?: string; error?: string } {
    // Check for ACK response
    if (xml.includes('ACK') || xml.includes('value="ACK"')) {
        // Extract rawlog if present
        const rawlogMatch = xml.match(/rawlog="([^"]*)"/);
        return {
            success: true,
            value: 'ACK',
            rawlog: rawlogMatch ? rawlogMatch[1] : undefined,
        };
    }

    // Check for NAK response
    if (xml.includes('NAK') || xml.includes('value="NAK"')) {
        const rawlogMatch = xml.match(/rawlog="([^"]*)"/);
        return {
            success: false,
            value: 'NAK',
            rawlog: rawlogMatch ? rawlogMatch[1] : undefined,
            error: rawlogMatch ? rawlogMatch[1] : 'NAK received',
        };
    }

    // Check for log messages (info/error)
    if (xml.includes('<log ') || xml.includes('<log>')) {
        return {
            success: true,
            value: 'LOG',
            rawlog: xml,
        };
    }

    // Unknown response
    return {
        success: false,
        error: `Unknown response: ${xml.substring(0, 100)}`,
    };
}

/**
 * Extract text content between XML tags
 */
export function extractTagContent(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
}

/**
 * Extract attribute value from XML
 */
export function extractAttribute(xml: string, attrName: string): string | null {
    const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
}

/**
 * Check if response indicates success for VIP handshake
 */
export function isVipSuccess(xml: string): boolean {
    // Check for explicit success indicators
    if (xml.includes('verify passed') || xml.includes('verify_pass')) {
        return true;
    }

    // Check for ACK in response
    if (xml.includes('value="ACK"')) {
        return true;
    }

    return false;
}

/**
 * Encode a string to Uint8Array (UTF-8)
 */
export function stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

/**
 * Decode Uint8Array to string (UTF-8)
 */
export function bytesToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}
