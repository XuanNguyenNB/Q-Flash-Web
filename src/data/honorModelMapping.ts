/**
 * Honor Model Mapping
 *
 * Maps ADB model codes to workflow model IDs for automatic device detection.
 * Format: { [adbModelCode]: modelId }
 */

export const HONOR_MODEL_MAPPING: Record<string, string> = {
  // ============ Magic 8 Series ============
  'BKQ-AN10': 'magic-8-pro',
  'BKQ-AN00': 'magic-8',
  'MTN-NX1M': 'magic-8-lite',

  // ============ Magic 7 Series ============
  'PTP-AN10': 'magic-7-pro',
  'PTP-AN00': 'magic-7',
  'PTP-AN20': 'magic-7-rsr',
  'BRP-NX1': 'magic-7-lite',

  // ============ Magic 6 Series ============
  'BVL-AN16': 'magic-6-pro',
  'BVL-AN00': 'magic-6',
  'BVL-AN20': 'magic-6-ultimate', // Also Magic 6 RSR
  'ALI-NX1': 'magic-6-lite',
  'ALI-NX3': 'magic-6-lite',

  // ============ Magic 5 Series ============
  'PGT-AN10': 'magic-5-pro',
  'PGT-AN00': 'magic-5',
  'PGT-AN20': 'magic-5-ultimate',
  'RMO-NX1': 'magic-5-lite',

  // ============ Magic 4 Series ============
  'LGE-AN10': 'magic-4-pro',
  'LGE-AN00': 'magic-4',
  'LGE-AN20': 'magic-4-ultimate',
  'ANY-NX1': 'magic-4-lite',

  // ============ Magic 3 Series ============
  'ELZ-AN10': 'magic-3-pro',
  'ELZ-AN00': 'magic-3',
  'ELZ-AN20': 'magic-3-pro-plus',

  // ============ Honor 500 Series ============
  'MEY-AN00': 'honor-500',
  'MEY-AN10': 'honor-500-pro',

  // ============ Honor 400 Series ============
  'ADM-AN00': 'honor-400',
  'ADM-AN10': 'honor-400-pro',

  // ============ Honor 300 Series ============
  'AMP-AN00': 'honor-300',
  'AMP-AN10': 'honor-300-pro',
  'AMP-AN20': 'honor-300-ultra',

  // ============ Honor 200 Series ============
  'ELI-AN10': 'honor-200',
  'ELI-AN00': 'honor-200-pro',
  'LLY-NX1': 'honor-200-lite',
  'ELP-NX9': 'honor-200-smart',

  // ============ Honor 100 Series ============
  'MAA-AN00': 'honor-100',
  'MAA-AN10': 'honor-100-pro',
};

/**
 * Get model ID from ADB model code
 * @param adbModel - The model code from ADB (e.g., "BKQ-AN10")
 * @returns The model ID for workflowPresets (e.g., "magic-8-pro") or null if not found
 */
export function getModelIdFromADBCode(adbModel: string): string | null {
  if (!adbModel) return null;

  // Try exact match first
  const exactMatch = HONOR_MODEL_MAPPING[adbModel.toUpperCase()];
  if (exactMatch) return exactMatch;

  // Try partial match (some devices may have suffix)
  const upperModel = adbModel.toUpperCase();
  for (const [code, modelId] of Object.entries(HONOR_MODEL_MAPPING)) {
    if (upperModel.startsWith(code) || upperModel.includes(code)) {
      return modelId;
    }
  }

  return null;
}

/**
 * Get model display name from model ID
 * @param modelId - The model ID (e.g., "magic-8-pro")
 * @returns Human-readable name (e.g., "Magic 8 Pro")
 */
export function getModelDisplayName(modelId: string): string {
  const displayNames: Record<string, string> = {
    // Magic Series
    'magic-8': 'Magic 8',
    'magic-8-pro': 'Magic 8 Pro',
    'magic-8-pro-air': 'Magic 8 Pro Air',
    'magic-8-lite': 'Magic 8 Lite',
    'magic-7': 'Magic 7',
    'magic-7-pro': 'Magic 7 Pro',
    'magic-7-rsr': 'Magic 7 RSR Porsche Design',
    'magic-7-lite': 'Magic 7 Lite',
    'magic-6': 'Magic 6',
    'magic-6-pro': 'Magic 6 Pro',
    'magic-6-ultimate': 'Magic 6 Ultimate',
    'magic-6-rsr': 'Magic 6 RSR Porsche Design',
    'magic-6-lite': 'Magic 6 Lite',
    'magic-5': 'Magic 5',
    'magic-5-pro': 'Magic 5 Pro',
    'magic-5-ultimate': 'Magic 5 Ultimate',
    'magic-5-lite': 'Magic 5 Lite',
    'magic-4': 'Magic 4',
    'magic-4-pro': 'Magic 4 Pro',
    'magic-4-ultimate': 'Magic 4 Ultimate',
    'magic-4-lite': 'Magic 4 Lite',
    'magic-3': 'Magic 3',
    'magic-3-pro': 'Magic 3 Pro',
    'magic-3-pro-plus': 'Magic 3 Pro+',
    // Honor Number Series
    'honor-500': 'Honor 500',
    'honor-500-pro': 'Honor 500 Pro',
    'honor-500-gt': 'Honor 500 GT',
    'honor-500-lite': 'Honor 500 Lite',
    'honor-400': 'Honor 400',
    'honor-400-pro': 'Honor 400 Pro',
    'honor-400-gt': 'Honor 400 GT / Smart',
    'honor-400-lite': 'Honor 400 Lite',
    'honor-300': 'Honor 300',
    'honor-300-pro': 'Honor 300 Pro',
    'honor-300-ultra': 'Honor 300 Ultra',
    'honor-300-lite': 'Honor 300 Lite',
    'honor-200': 'Honor 200',
    'honor-200-pro': 'Honor 200 Pro',
    'honor-200-lite': 'Honor 200 Lite',
    'honor-200-smart': 'Honor 200 Smart',
    'honor-100': 'Honor 100',
    'honor-100-pro': 'Honor 100 Pro',
    'honor-100-gt': 'Honor 100 GT',
  };

  return displayNames[modelId] || modelId;
}
