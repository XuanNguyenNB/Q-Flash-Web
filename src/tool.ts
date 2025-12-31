/**
 * Oppo Find X7 Ultra WebUSB Unlock Tool
 * 
 * Tool module - Contains the WebUSB flash tool logic.
 * This is loaded by the router when navigating to the tool page.
 */

import { Terminal } from './ui/Terminal';
import { WebUSBManager } from './core/WebUSBManager';
import { SaharaProtocol } from './core/SaharaProtocol';
import { OppoVipAuth } from './auth/AuthStrategy';
import { FirehoseProtocol } from './core/FirehoseProtocol';
import { AppStage, EXPECTED_FILE_SIZES } from './types';
import { loadBinaryFile } from './presets';
import { loadDeviceConfigs, loadFirehoseForDevice } from './services/deviceConfig';
import type { DeviceProfile } from './services/deviceConfig';
import { t, getCurrentLanguage, setLanguage } from './i18n/i18n';
import { renderAiChatPanel, initAiChat } from './components/ai-chat';

// ============================================================================
// Application State
// ============================================================================

interface AppState {
  stage: AppStage;
  programmerData: Uint8Array | null;
  digestData: Uint8Array | null;
  signatureData: Uint8Array | null;
  isConnected: boolean;
}

const state: AppState = {
  stage: AppStage.IDLE,
  programmerData: null,
  digestData: null,
  signatureData: null,
  isConnected: false,
};

// Protocol instances
let terminal: Terminal;
let usb: WebUSBManager;
let sahara: SaharaProtocol;
let firehose: FirehoseProtocol;

// ============================================================================
// DOM Setup
// ============================================================================

function createToolHTML(): string {
  const currentLang = getCurrentLanguage();
  return `
    <header class="header">
      <div class="header-title">
        <h1>WebUSB OplusTool</h1>
        <span class="badge">v1.0</span>
      </div>
      <div class="header-controls">
        <button class="btn-lang" id="btn-lang" title="Switch Language">
          <span class="lang-icon">🌐</span>
          <span class="lang-text">${currentLang.toUpperCase()}</span>
        </button>
        <div class="header-status" id="device-status">
          <span class="status-dot" id="status-dot"></span>
          <span id="status-text">${t('header.status.idle')}</span>
        </div>
      </div>
    </header>
    
    <div class="main-container">
      <aside class="sidebar">
        
        <!-- Sidebar Top: Controls -->
        <div class="sidebar-top">
          <!-- Device Preset Selector -->
          <div class="control-section">
            <h2>${t('sidebar.devicePreset')}</h2>
            <div class="preset-selector">
              <select id="preset-select" class="preset-dropdown">
                <option value="">-- Loading devices... --</option>
              </select>
              <button class="btn btn-secondary" id="load-preset-btn" disabled>
                ⬇️ ${t('sidebar.loadPreset')}
              </button>
            </div>
            <div class="preset-status" id="preset-status"></div>
          </div>
          
          <!-- Info -->
          <div class="control-section">
            <h2>${t('sidebar.requirements')}</h2>
            <p style="font-size: 0.75rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-line;">
              ${t('sidebar.requirementsList')}
            </p>
          </div>
        </div>
        
        <!-- Sidebar Bottom: AI Chat Panel -->
        <div class="sidebar-bottom">
          ${renderAiChatPanel()}
        </div>
      </aside>
      
      <!-- Partition Table Panel -->
      <div class="partition-panel" id="partition-panel">
        <div class="partition-header">
          <h2>📋 ${t('partition.title')}</h2>
          <span class="partition-count" id="partition-count">${t('partition.count', { count: 0 })}</span>
        </div>
        <div class="partition-search">
          <input type="text" id="partition-search" placeholder="${t('partition.searchPlaceholder')}" autocomplete="off" />
        </div>
        <div class="partition-table-container" id="partition-table">
          <div class="partition-empty">
            <span>${t('partition.noPartitions')}</span>
            <span class="hint">${t('partition.hint')}</span>
          </div>
        </div>
        <div class="partition-actions-bar" id="partition-actions-bar">
          <button class="btn btn-action btn-connect" id="connect-btn" disabled>
            🔌 ${t('sidebar.connectDevice')}
          </button>
          <button class="btn btn-action" id="btn-read-partitions" disabled>
            📋 ${t('actions.readList')}
          </button>
          <button class="btn btn-action" id="btn-backup-selected" disabled>
            📥 ${t('actions.backup')} (<span id="selected-count">0</span>)
          </button>
          <button class="btn btn-action btn-flash" id="btn-flash-selected" disabled>
            ⚡ ${t('actions.flash')} (<span id="flash-file-count">0</span>)
          </button>
          <button class="btn btn-action btn-xml-flash" id="btn-flash-xml">
            📄 ${t('actions.romFlash')}
          </button>
          <button class="btn btn-action btn-warning" id="reboot-btn">
            🔄 ${t('actions.reboot')}
          </button>
          <button class="btn btn-action btn-danger-outline" id="btn-stop-all" disabled>
            ⏹️ ${t('actions.stop')}
          </button>
        </div>
      </div>
      

      
      <!-- Terminal Log -->
      <div class="terminal-container">
        <div class="terminal-header">
          <h2>📜 ${t('terminal.title')}</h2>
          <button class="btn btn-sm" id="copy-log-btn" title="Copy log to clipboard">📋 ${t('terminal.copy')}</button>
        </div>
        <div class="terminal terminal-compact" id="terminal"></div>
      </div>
    </div>
  `;
}

// ============================================================================
// Initialization - Exported for router
// ============================================================================

export function initTool(): void {
  // Find the tool container (rendered by router)
  const container = document.querySelector('.tool-container');
  if (!container) {
    console.error('Tool container not found');
    return;
  }
  container.innerHTML = createToolHTML();

  // Initialize terminal
  terminal = new Terminal('terminal');

  // Initialize USB manager
  usb = new WebUSBManager();

  // Check WebUSB support
  if (!WebUSBManager.isSupported()) {
    terminal.error('WebUSB is not supported in this browser.');
    terminal.error('Please use Chrome (61+) or Edge (79+).');
    return;
  }

  // Log startup
  terminal.info('Q-Flash Universal Qualcomm Tool initialized');
  terminal.info('Load the required files to begin');
  terminal.separator();

  // Set up event listeners
  setupEventListeners();

  // Set up batch action handlers (including Flash from XML)
  setupBatchHandlers();

  // Initialize AI Chat panel
  initAiChat();

  // Load device configurations
  populateDeviceDropdown();

  // Check for HTTPS requirement
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    terminal.warning('WebUSB requires HTTPS. Some features may not work.');
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners(): void {
  // Preset selector
  document.getElementById('preset-select')?.addEventListener('change', handlePresetChange);
  document.getElementById('load-preset-btn')?.addEventListener('click', handleLoadPreset);

  // Buttons
  document.getElementById('connect-btn')?.addEventListener('click', handleConnect);
  document.getElementById('btn-read-partitions')?.addEventListener('click', handleReadPartitions);
  document.getElementById('reboot-btn')?.addEventListener('click', handleRebootDevice);

  // Language switcher
  document.getElementById('btn-lang')?.addEventListener('click', handleLanguageSwitch);

  // Copy log button
  document.getElementById('copy-log-btn')?.addEventListener('click', handleCopyLog);
}


/**
 * Copy terminal log to clipboard
 */
function handleCopyLog(): void {
  const terminalEl = document.getElementById('terminal');
  if (!terminalEl) return;

  const logText = terminalEl.innerText || terminalEl.textContent || '';

  navigator.clipboard.writeText(logText).then(() => {
    const btn = document.getElementById('copy-log-btn');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = t('terminal.copied');
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }
  }).catch((err) => {
    terminal.error(`Failed to copy log: ${err}`);
  });
}

/**
 * Handle language switch
 */
function handleLanguageSwitch(): void {
  const currentLang = getCurrentLanguage();
  const newLang = currentLang === 'vi' ? 'en' : 'vi';
  setLanguage(newLang);

  // Re-render the tool UI with new language
  const container = document.querySelector('.tool-container');
  if (container) {
    container.innerHTML = createToolHTML();

    // Re-initialize
    terminal = new Terminal('terminal');
    setupEventListeners();
    initAiChat();
    updateStage(state.stage);
    updateButtonStates();

    // Re-render partitions if loaded
    const partitions = (window as any).__partitions as import('./types').PartitionInfo[];
    if (partitions && partitions.length > 0) {
      const searchInput = document.getElementById('partition-search') as HTMLInputElement;
      const currentFilter = searchInput?.value || '';
      renderPartitionTable(partitions, currentFilter);
    }

    terminal.info(`Language changed to ${newLang.toUpperCase()}`);
  }
}

/**
 * Show toast notification
 */
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  // Remove existing toast
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// ============================================================================
// File Handling
// ============================================================================

async function handleFileInput(event: Event, fileType: 'programmer' | 'digest' | 'signature'): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  try {
    const data = new Uint8Array(await file.arrayBuffer());

    // Validate file size
    const validation = validateFileSize(fileType, data.length);
    if (validation.warning) {
      terminal.warning(validation.warning);
    }

    // Store data
    switch (fileType) {
      case 'programmer':
        state.programmerData = data;
        updateFileLabel('programmer-label', file.name, true);
        terminal.success(`Programmer loaded: ${file.name} (${formatBytes(data.length)})`);
        break;
      case 'digest':
        state.digestData = data;
        updateFileLabel('digest-label', file.name, true);
        terminal.success(`Digest loaded: ${file.name} (${formatBytes(data.length)})`);
        break;
      case 'signature':
        state.signatureData = data;
        updateFileLabel('signature-label', file.name, true);
        terminal.success(`Signature loaded: ${file.name} (${formatBytes(data.length)})`);
        break;
    }

    updateButtonStates();

  } catch (error) {
    terminal.error(`Failed to load ${fileType}: ${error}`);
  }
}

// Store loaded devices for reference
let loadedDevices: DeviceProfile[] = [];

/**
 * Populate device dropdown from config
 */
async function populateDeviceDropdown(): Promise<void> {
  const select = document.getElementById('preset-select') as HTMLSelectElement;
  if (!select) return;

  const result = await loadDeviceConfigs();

  if (!result.success || !result.data) {
    select.innerHTML = '<option value="">-- Failed to load devices --</option>';
    terminal.error('Failed to load device configurations');
    return;
  }

  loadedDevices = result.data;

  // Build options HTML
  let optionsHtml = '<option value="">-- Select Device --</option>';

  // Group by brand
  const brands = ['oppo', 'oneplus', 'realme', 'qualcomm'] as const;
  const statusIcons: Record<string, string> = {
    'tested': '✅',
    'beta': '⚡',
    'coming': '⏳'
  };

  for (const brand of brands) {
    const brandDevices = loadedDevices.filter(d => d.brand === brand);
    if (brandDevices.length === 0) continue;

    optionsHtml += `<optgroup label="${brand.toUpperCase()}">`;
    for (const device of brandDevices) {
      const icon = statusIcons[device.status] || '';
      const disabled = device.status === 'coming' && !device.presetId && !device.firehose?.programmerUrl;
      optionsHtml += `<option value="${device.id}" ${disabled ? 'disabled' : ''}>${icon} ${device.name} (${device.chipsetName})</option>`;
    }
    optionsHtml += '</optgroup>';
  }

  select.innerHTML = optionsHtml;

  // Restore previously selected device from localStorage
  const savedDeviceId = localStorage.getItem('qflash-selected-device');
  if (savedDeviceId && loadedDevices.some(d => d.id === savedDeviceId)) {
    select.value = savedDeviceId;
    // Enable load button if a device is selected
    const loadBtn = document.getElementById('load-preset-btn') as HTMLButtonElement;
    if (loadBtn) {
      loadBtn.disabled = false;
    }
    terminal.info(`📱 Restored device selection: ${loadedDevices.find(d => d.id === savedDeviceId)?.name || savedDeviceId}`);
  }

  terminal.info(`📋 Loaded ${loadedDevices.length} device profiles`);
}

/**
 * Handle preset dropdown change
 */
function handlePresetChange(): void {
  const select = document.getElementById('preset-select') as HTMLSelectElement;
  const loadBtn = document.getElementById('load-preset-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('preset-status');

  const deviceId = select.value;
  const device = loadedDevices.find(d => d.id === deviceId);

  // Save selected device to localStorage
  if (deviceId) {
    localStorage.setItem('qflash-selected-device', deviceId);
  } else {
    localStorage.removeItem('qflash-selected-device');
  }

  if (!device) {
    loadBtn.disabled = true;
    if (statusEl) statusEl.textContent = '';
    return;
  }

  // Check if firehose is available (either remote or local)
  const hasRemote = device.firehose?.programmerUrl;
  const hasLocal = device.presetId !== null;
  const canLoad = device.status !== 'coming' || hasRemote || hasLocal;

  if (canLoad) {
    loadBtn.disabled = false;
    if (statusEl) {
      if (hasRemote) {
        statusEl.textContent = '📡 Will load from GitHub';
        statusEl.style.color = 'var(--accent-blue)';
      } else if (hasLocal) {
        statusEl.textContent = '📦 Local preset available';
        statusEl.style.color = 'var(--accent-green)';
      } else {
        statusEl.textContent = '';
      }
    }
  } else {
    loadBtn.disabled = true;
    if (statusEl) {
      statusEl.textContent = '⏳ Coming soon - no firehose available';
      statusEl.style.color = 'var(--accent-yellow)';
    }
  }
}

/**
 * Load firehose files for selected device
 */
async function handleLoadPreset(): Promise<void> {
  const select = document.getElementById('preset-select') as HTMLSelectElement;
  const loadBtn = document.getElementById('load-preset-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('preset-status');

  const deviceId = select.value;
  const device = loadedDevices.find(d => d.id === deviceId);

  if (!device) {
    terminal.error('Please select a valid device');
    return;
  }

  loadBtn.disabled = true;
  select.disabled = true;

  if (statusEl) {
    statusEl.textContent = '⏳ Loading firehose files...';
    statusEl.style.color = 'var(--accent-blue)';
  }

  terminal.separator();
  terminal.info(`📥 Loading firehose for: ${device.name}`);

  try {
    const result = await loadFirehoseForDevice(
      device,
      // Progress callback
      (progress) => {
        const percent = progress.total > 0
          ? Math.round((progress.loaded / progress.total) * 100)
          : 0;
        if (statusEl) {
          statusEl.textContent = `⏳ ${progress.file}: ${percent}%`;
        }
      },
      // Log callback
      (msg, level) => {
        switch (level) {
          case 'success': terminal.success(msg); break;
          case 'error': terminal.error(msg); break;
          case 'warning': terminal.warning(msg); break;
          default: terminal.info(msg);
        }
      }
    );

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Unknown error loading firehose');
    }

    // Store loaded data
    state.programmerData = result.data.programmer;
    state.digestData = result.data.digest;
    state.signatureData = result.data.signature;

    // Update file labels
    updateFileLabel('programmer-label', 'programmer.melf', true);
    updateFileLabel('digest-label', 'digest.elf', true);
    updateFileLabel('signature-label', 'signature.bin', true);

    // Update UI
    if (statusEl) {
      statusEl.textContent = '✅ Firehose loaded!';
      statusEl.style.color = 'var(--accent-green)';
    }

    terminal.success(`✅ Firehose loaded for ${device.name}!`);
    terminal.info('You can now connect to device.');

    // Enable connect button
    updateButtonStates();

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    terminal.error(`Failed to load firehose: ${errorMsg}`);
    if (statusEl) {
      statusEl.textContent = '❌ Failed to load firehose';
      statusEl.style.color = 'var(--accent-red)';
    }

    // Show popup for manual file selection
    terminal.info('💡 Opening manual file selection popup...');
    const result = await showFirehoseFilesPopup();
    if (result) {
      terminal.success('✅ Firehose files loaded manually!');
      updateButtonStates();
    }
  } finally {
    loadBtn.disabled = false;
    select.disabled = false;
  }
}

function validateFileSize(fileType: string, size: number): { isValid: boolean; warning?: string } {
  const expected = EXPECTED_FILE_SIZES[fileType as keyof typeof EXPECTED_FILE_SIZES];
  if (!expected) return { isValid: true };

  if (size < expected.min || size > expected.max) {
    return {
      isValid: false,
      warning: `${fileType} size (${formatBytes(size)}) is outside expected range (${formatBytes(expected.min)} - ${formatBytes(expected.max)}). Verify correct file.`,
    };
  }

  return { isValid: true };
}

function updateFileLabel(labelId: string, fileName: string, loaded: boolean): void {
  const label = document.getElementById(labelId);
  if (!label) return;

  if (loaded) {
    label.classList.add('loaded');
    label.innerHTML = `
      <span>✅ ${fileName.substring(0, 20)}${fileName.length > 20 ? '...' : ''}</span>
      <span class="status-icon">✓</span>
    `;
  }
}

/**
 * Show popup dialog for manual Firehose file selection
 * Returns true if all files were loaded successfully
 */
async function showFirehoseFilesPopup(): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'firehose-popup-overlay';

    // Track loaded files
    const loadedFiles = {
      programmer: false,
      digest: false,
      signature: false
    };

    overlay.innerHTML = `
      <div class="firehose-popup-modal">
        <h3>📁 ${t('firehosePopup.title')}</h3>
        <p class="popup-description">${t('firehosePopup.description')}</p>
        
        <div class="firehose-file-inputs">
          <div class="file-input-wrapper popup-file">
            <input type="file" class="file-input" id="popup-programmer-input" accept=".melf,.elf,.mbn">
            <label class="file-input-label" id="popup-programmer-label">
              <span>📦 ${t('sidebar.programmer')}</span>
              <span class="icon">📂</span>
            </label>
          </div>
          <div class="file-input-wrapper popup-file">
            <input type="file" class="file-input" id="popup-digest-input" accept=".elf,.bin">
            <label class="file-input-label" id="popup-digest-label">
              <span>🔑 ${t('sidebar.digest')}</span>
              <span class="icon">📂</span>
            </label>
          </div>
          <div class="file-input-wrapper popup-file">
            <input type="file" class="file-input" id="popup-signature-input" accept=".bin">
            <label class="file-input-label" id="popup-signature-label">
              <span>✍️ ${t('sidebar.signature')}</span>
              <span class="icon">📂</span>
            </label>
          </div>
        </div>
        
        <div class="firehose-popup-buttons">
          <button class="btn-cancel">${t('flash.cancel')}</button>
          <button class="btn-confirm" disabled>${t('firehosePopup.confirm')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const updateConfirmButton = () => {
      const confirmBtn = overlay.querySelector('.btn-confirm') as HTMLButtonElement;
      if (confirmBtn) {
        confirmBtn.disabled = !(loadedFiles.programmer && loadedFiles.digest && loadedFiles.signature);
      }
    };

    const handleFileLoad = async (inputId: string, labelId: string, fileType: 'programmer' | 'digest' | 'signature') => {
      const input = document.getElementById(inputId) as HTMLInputElement;
      const label = document.getElementById(labelId);

      input?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          const data = new Uint8Array(await file.arrayBuffer());

          // Store in state
          switch (fileType) {
            case 'programmer':
              state.programmerData = data;
              break;
            case 'digest':
              state.digestData = data;
              break;
            case 'signature':
              state.signatureData = data;
              break;
          }

          loadedFiles[fileType] = true;

          // Update label
          if (label) {
            label.classList.add('loaded');
            label.innerHTML = `
              <span>✅ ${file.name.substring(0, 15)}...</span>
              <span class="status-icon">✓</span>
            `;
          }

          terminal.success(`${fileType} loaded: ${file.name} (${formatBytes(data.length)})`);
          updateConfirmButton();

        } catch (error) {
          terminal.error(`Failed to load ${fileType}: ${error}`);
        }
      });
    };

    // Set up file handlers
    handleFileLoad('popup-programmer-input', 'popup-programmer-label', 'programmer');
    handleFileLoad('popup-digest-input', 'popup-digest-label', 'digest');
    handleFileLoad('popup-signature-input', 'popup-signature-label', 'signature');

    // Confirm button
    overlay.querySelector('.btn-confirm')?.addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });

    // Cancel button
    overlay.querySelector('.btn-cancel')?.addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });

    // Click outside to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

// ============================================================================
// USB Connection
// ============================================================================

async function handleConnect(): Promise<void> {
  try {
    terminal.info('Requesting USB device...');
    const deviceInfo = await usb.connect();

    state.isConnected = true;
    updateConnectionStatus(true, `VID:${deviceInfo.vendorId.toString(16).padStart(4, '0')} PID:${deviceInfo.productId.toString(16).padStart(4, '0')}`);

    terminal.success(`Connected to device: ${deviceInfo.productName}`);
    terminal.info(`Vendor ID: 0x${deviceInfo.vendorId.toString(16).toUpperCase()}`);
    terminal.info(`Product ID: 0x${deviceInfo.productId.toString(16).toUpperCase()}`);

    updateButtonStates();

    // Auto-start unlock flow if all files are loaded
    if (state.programmerData && state.digestData && state.signatureData) {
      terminal.info('All files loaded, auto-starting unlock flow...');
      updateStage(AppStage.CONNECTING);
      await new Promise(resolve => setTimeout(resolve, 100));
      await handleStartUnlockFlow();
    } else {
      terminal.warning('⚠️ IMPORTANT: Load all files BEFORE connecting!');
      terminal.warning('Device sends HELLO immediately - disconnect and reconnect after loading files.');
    }

  } catch (error) {
    terminal.error(`Connection failed: ${error instanceof Error ? error.message : error}`);
    if ((error as Error).message?.includes('Zadig')) {
      terminal.info('📖 Install WinUSB driver: https://zadig.akeo.ie/');
    }
  }
}

async function handleDisconnect(): Promise<void> {
  try {
    await usb.disconnect();
    state.isConnected = false;
    updateConnectionStatus(false);
    updateStage(AppStage.IDLE);
    terminal.info('Disconnected from device');
    updateButtonStates();
  } catch (error) {
    terminal.error(`Disconnect error: ${error}`);
  }
}

function updateConnectionStatus(connected: boolean, details?: string): void {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');

  if (dot) {
    dot.className = connected ? 'status-dot connected' : 'status-dot';
  }
  if (text) {
    text.textContent = connected ? `Connected ${details ? `(${details})` : ''}` : 'Disconnected';
  }
}

// ============================================================================
// Unlock Flow
// ============================================================================

async function handleStartUnlockFlow(): Promise<void> {
  if (!state.programmerData || !state.digestData || !state.signatureData) {
    terminal.error('Please load all required files first');
    return;
  }

  if (!state.isConnected) {
    terminal.error('Please connect to device first');
    return;
  }

  // Check if already running (SAHARA, VIP, or FIREHOSE). 
  // Allow IDLE and CONNECTING (since auto-start sets CONNECTING)
  if (state.stage > AppStage.CONNECTING && state.stage < AppStage.READY) {
    terminal.warning('Unlock flow is already running!');
    return;
  }

  terminal.separator();
  terminal.info('Starting unlock flow...');

  try {
    // Step 1: Sahara - Upload programmer
    updateStage(AppStage.SAHARA);
    terminal.info('Step 1/5: Sahara Protocol - Uploading programmer...');

    sahara = new SaharaProtocol(usb, (msg, level) => {
      if (level === 'debug') {
        terminal.debug(msg);
      } else if (level === 'error') {
        terminal.error(msg);
      } else {
        terminal.info(msg);
      }
    });

    sahara.loadProgrammer(state.programmerData);
    const saharaResult = await sahara.execute();

    if (!saharaResult.success) {
      terminal.error(`Sahara failed: ${saharaResult.error}`);
      terminal.error('Please power cycle the device and try again.');
      return;
    }

    terminal.success('Sahara complete - Programmer uploaded');

    // Device is now in Firehose mode - continue with VIP handshake
    terminal.separator();
    terminal.info('📱 Device is now in Firehose mode');

    // Step 2: VIP Handshake
    // Device re-enumerates after Sahara, so we must reconnect (using permissions we already have)
    terminal.separator();
    terminal.info('📱 Device switching to Firehose mode (Re-connecting)...');

    // Try to reconnect automatically
    const reconnected = await usb.reconnect();
    if (reconnected) {
      terminal.info('Reconnected successfully');
    } else {
      // If auto-reconnect fails, we might still be good if it didn't strictly detach
      terminal.warning('Auto-reconnect failed/skipped. Trying existing connection...');
    }

    updateStage(AppStage.VIP_HANDSHAKE);
    terminal.info('Step 2/5: VIP Handshake - Authenticating...');

    const vipAuth = new OppoVipAuth(state.digestData, state.signatureData, (msg, level) => {
      if (level === 'debug') {
        terminal.debug(msg);
      } else if (level === 'error') {
        terminal.error(msg);
      } else if (level === 'success') {
        terminal.success(msg);
      } else {
        terminal.info(msg);
      }
    });

    const vipResult = await vipAuth.execute(usb);

    if (!vipResult.success) {
      terminal.error(`VIP Handshake failed at step ${vipResult.step}: ${vipResult.error}`);
      return;
    }

    terminal.success('VIP Handshake complete - Authenticated');

    // Step 3: Configure Firehose
    updateStage(AppStage.FIREHOSE_CONFIG);
    terminal.info('Step 3/5: Configuring Firehose...');

    firehose = new FirehoseProtocol(usb, (msg, level) => {
      if (level === 'debug') {
        terminal.debug(msg);
      } else if (level === 'error') {
        terminal.error(msg);
      } else if (level === 'success') {
        terminal.success(msg);
      } else {
        terminal.info(msg);
      }
    });

    const configResult = await firehose.configure();

    if (!configResult.success) {
      terminal.error(`Firehose configure failed: ${configResult.error}`);
      return;
    }

    const cfg = firehose.currentConfig;
    terminal.success(`Firehose configured: ${cfg.memoryName.toUpperCase()}, MaxPayload=${cfg.maxPayloadSizeToTargetInBytes}`);

    // Done - Ready for operations
    updateStage(AppStage.READY);
    terminal.separator();
    terminal.success('🎉 Device ready! You can now read partitions.');

    // Enable Read List button
    const readListBtn = document.getElementById('btn-read-partitions') as HTMLButtonElement;
    if (readListBtn) {
      readListBtn.disabled = false;
    }

    // Show toast notification
    showToast('✅ Device ready! Click "Read List" to view partitions.', 'success');

    updateButtonStates();

  } catch (error) {
    terminal.error(`Unlock flow error: ${error instanceof Error ? error.message : error}`);
  }
}

// ============================================================================
// Partition Operations
// ============================================================================

async function handleReadPartitions(): Promise<void> {
  if (!firehose) {
    terminal.error('Firehose not initialized. Run unlock flow first.');
    return;
  }

  terminal.info('Reading partition table from all LUNs...');

  // Use the new getAllPartitions method which handles drain/NOP between LUNs
  const result = await firehose.getAllPartitions();

  terminal.separator();

  if (result.success && result.partitions && result.partitions.length > 0) {
    terminal.success(`Total: ${result.partitions.length} partitions`);

    // Update partition panel
    renderPartitionTable(result.partitions);
  } else {
    terminal.warning(`No partitions found: ${result.error || 'unknown error'}`);
  }
}

/**
 * Render partition table to the partition panel
 */
function renderPartitionTable(partitions: import('./types').PartitionInfo[], searchFilter = ''): void {
  const container = document.getElementById('partition-table');
  const countEl = document.getElementById('partition-count');
  const searchInput = document.getElementById('partition-search') as HTMLInputElement;

  if (!container) return;

  // Store partitions for later use
  (window as any).__partitions = partitions;

  // Initialize selected partitions set if not exists
  if (!(window as any).__selectedPartitions) {
    (window as any).__selectedPartitions = new Set<number>();
  }
  const selectedPartitions = (window as any).__selectedPartitions as Set<number>;

  // Filter partitions based on search
  const filter = searchFilter.toLowerCase().trim();
  const filteredPartitions = filter
    ? partitions.filter(p => p.name.toLowerCase().includes(filter))
    : partitions;

  // Update count
  if (countEl) {
    if (filter) {
      countEl.textContent = `${filteredPartitions.length} / ${partitions.length} partitions`;
    } else {
      countEl.textContent = `${partitions.length} partitions`;
    }
  }

  // Set up search input handler (only once)
  if (searchInput && !(searchInput as any).__hasHandler) {
    (searchInput as any).__hasHandler = true;
    searchInput.addEventListener('input', () => {
      const allPartitions = (window as any).__partitions as import('./types').PartitionInfo[];
      if (allPartitions) {
        renderPartitionTable(allPartitions, searchInput.value);
      }
    });
  }

  // Build HTML table with checkboxes - Select All in header
  const allSelected = partitions.length > 0 && selectedPartitions.size === partitions.length;
  let html = `
    <table class="partition-table">
      <thead>
        <tr>
          <th class="checkbox-col">
            <input type="checkbox" id="select-all-partitions" ${allSelected ? 'checked' : ''} title="Select All" />
          </th>
          <th>LUN</th>
          <th>Name</th>
          <th>Start Sector</th>
          <th>Size</th>
          <th>Read</th>
          <th>Write</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (filteredPartitions.length === 0) {
    html += `
      <tr>
        <td colspan="6" style="text-align: center; padding: 20px; color: var(--text-secondary);">
          ${filter ? `No partitions matching "${filter}"` : 'No partitions found'}
        </td>
      </tr>
    `;
  } else {
    for (let i = 0; i < partitions.length; i++) {
      const p = partitions[i];
      // Skip if doesn't match filter
      if (filter && !p.name.toLowerCase().includes(filter)) continue;

      const lun = (p as any).lun ?? 0;
      const sizeBytes = Number(p.sizeInSectors) * 4096;
      const isSmall = sizeBytes < 100 * 1024 * 1024; // < 100MB
      const isLarge = sizeBytes > 1024 * 1024 * 1024; // > 1GB
      const isChecked = selectedPartitions.has(i);

      // Check if this partition has a flash file selected
      const flashFiles = (window as any).__flashFiles as Map<number, { file: File, partition: import('./types').PartitionInfo }> || new Map();
      const flashFile = flashFiles.get(i);
      const flashFileName = flashFile ? flashFile.file.name : '';
      const flashFileSize = flashFile ? flashFile.file.size : 0;
      const sizeMismatch = flashFile && flashFileSize !== sizeBytes;

      // Highlight matching text
      let displayName = p.name;
      if (filter) {
        const regex = new RegExp(`(${filter})`, 'gi');
        displayName = p.name.replace(regex, '<mark>$1</mark>');
      }

      html += `
        <tr class="${isChecked ? 'row-selected' : ''}">
          <td class="checkbox-col">
            <input type="checkbox" class="partition-checkbox" data-index="${i}" ${isChecked ? 'checked' : ''} />
          </td>
          <td class="lun-cell">${lun}</td>
          <td class="name-cell">${displayName}</td>
          <td>${p.startSector.toString()}</td>
          <td class="size-cell ${isLarge ? 'size-large' : ''}">${p.sizeFormatted}</td>
          <td class="action-cell">
            <button class="btn-download ${isSmall ? '' : 'btn-large'}" 
                    data-index="${i}" 
                    title="${isLarge ? 'Large file (>1GB) - streams to disk' : isSmall ? 'Download' : 'Download (may take a while)'}">
              📥
            </button>
          </td>
          <td class="action-cell write-cell">
            <button class="btn-select-flash ${flashFileName ? 'has-file' : ''} ${sizeMismatch ? 'size-mismatch' : ''}" 
                    data-index="${i}" 
                    title="${flashFileName ? `${flashFileName} (${formatBytes(flashFileSize)})${sizeMismatch ? ' ⚠️ SIZE MISMATCH' : ''}` : 'Select file to flash'}">
              ${flashFileName ? '📄' : '📂'}
            </button>
            ${flashFileName ? `<span class="flash-filename" title="${flashFileName}">${flashFileName.substring(0, 8)}...</span>` : ''}
          </td>
        </tr>
      `;
    }
  }

  html += '</tbody></table>';
  container.innerHTML = html;

  // Set up batch action handlers AFTER HTML is inserted
  setupBatchHandlers();

  // Add click handlers for download buttons
  container.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10);
      await handleBackupPartition(index);
    });
  });

  // Add checkbox handlers
  container.querySelectorAll('.partition-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const index = parseInt((e.target as HTMLInputElement).dataset.index || '0', 10);
      const checked = (e.target as HTMLInputElement).checked;

      if (checked) {
        selectedPartitions.add(index);
      } else {
        selectedPartitions.delete(index);
      }

      updateSelectedCount();
      updateRowHighlight(index, checked);
    });
  });

  // Add flash file selection handlers
  container.querySelectorAll('.btn-select-flash').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10);
      await handleSelectFlashFile(index);
    });
  });
}

/**
 * Set up batch action handlers (only once)
 */
function setupBatchHandlers(): void {
  const selectAllCheckbox = document.getElementById('select-all-partitions') as HTMLInputElement;
  const backupSelectedBtn = document.getElementById('btn-backup-selected');

  // Select All handler - Always reattach to handle table re-renders
  if (selectAllCheckbox) {
    // Remove old handler first
    const oldHandler = (selectAllCheckbox as any).__changeHandler;
    if (oldHandler) {
      selectAllCheckbox.removeEventListener('change', oldHandler);
    }

    // Create and attach new handler
    const changeHandler = () => {
      const partitions = (window as any).__partitions as import('./types').PartitionInfo[];
      const selectedPartitions = (window as any).__selectedPartitions as Set<number>;

      if (selectAllCheckbox.checked) {
        // Select all
        partitions.forEach((_, i) => selectedPartitions.add(i));
      } else {
        // Deselect all
        selectedPartitions.clear();
      }

      // Update all individual partition checkboxes
      document.querySelectorAll('.partition-checkbox').forEach((cb) => {
        const checkbox = cb as HTMLInputElement;
        const index = parseInt(checkbox.dataset.index || '0', 10);
        const shouldCheck = selectedPartitions.has(index);
        checkbox.checked = shouldCheck;
        updateRowHighlight(index, shouldCheck);
      });

      updateSelectedCount();
    };

    (selectAllCheckbox as any).__changeHandler = changeHandler;
    selectAllCheckbox.addEventListener('change', changeHandler);
  }

  // Backup Selected handler
  if (backupSelectedBtn && !(backupSelectedBtn as any).__hasHandler) {
    (backupSelectedBtn as any).__hasHandler = true;
    backupSelectedBtn.addEventListener('click', handleBatchBackup);
  }

  // Flash Selected handler
  const flashSelectedBtn = document.getElementById('btn-flash-selected');
  if (flashSelectedBtn && !(flashSelectedBtn as any).__hasHandler) {
    (flashSelectedBtn as any).__hasHandler = true;
    flashSelectedBtn.addEventListener('click', handleFlashSelected);
  }

  // Flash from XML handler
  const flashXmlBtn = document.getElementById('btn-flash-xml');
  if (flashXmlBtn && !(flashXmlBtn as any).__hasHandler) {
    (flashXmlBtn as any).__hasHandler = true;
    flashXmlBtn.addEventListener('click', handleFlashFromXml);
  }
}

/**
 * Update selected count display
 */
function updateSelectedCount(): void {
  const countEl = document.getElementById('selected-count');
  const backupBtn = document.getElementById('btn-backup-selected') as HTMLButtonElement;
  const flashBtn = document.getElementById('btn-flash-selected') as HTMLButtonElement;
  const flashCountEl = document.getElementById('flash-file-count');
  const selectedPartitions = (window as any).__selectedPartitions as Set<number>;
  const flashFiles = (window as any).__flashFiles as Map<number, any> || new Map();
  const count = selectedPartitions?.size || 0;
  const flashCount = flashFiles?.size || 0;

  if (countEl) {
    countEl.textContent = `${count} selected`;
  }

  if (backupBtn) {
    backupBtn.disabled = count === 0;
  }

  if (flashCountEl) {
    flashCountEl.textContent = `${flashCount} files`;
  }

  if (flashBtn) {
    flashBtn.disabled = flashCount === 0;
  }
}

/**
 * Update row highlight based on selection
 */
function updateRowHighlight(index: number, selected: boolean): void {
  const checkbox = document.querySelector(`.partition-checkbox[data-index="${index}"]`);
  if (checkbox) {
    const row = checkbox.closest('tr');
    if (row) {
      if (selected) {
        row.classList.add('row-selected');
      } else {
        row.classList.remove('row-selected');
      }
    }
  }
}

// Critical partitions that should show extra warning
const CRITICAL_PARTITIONS = ['boot', 'boot_a', 'boot_b', 'recovery', 'recovery_a', 'recovery_b',
  'frp', 'devinfo', 'sbl1', 'xbl', 'abl', 'modem', 'dsp', 'tz', 'hyp', 'keymaster'];

// Protected partitions - should be unchecked by default
const PROTECTED_PARTITIONS = ['persist', 'userdata', 'frp', 'devinfo', 'keystore'];

// LUN5 (calibration data) protection - ALWAYS skipped like native tool
// From native log: "[Protect LUN5] Skipping 5 partition(s) in LUN5"
const LUN5_PROTECTED = true;  // Set to false to allow LUN5 flashing (DANGEROUS!)
const LUN5_WARNING = 'LUN5 contains calibration data. Flashing may cause hardware issues!';

interface FlashEntry {
  file: File;
  partition: import('./types').PartitionInfo;
  label?: string;
  lun?: number;
}

/**
 * Show flash confirmation dialog with partition selection and protection options
 * Returns the list of entries that user selected to flash, or empty array if cancelled
 */
function showFlashConfirmDialog(
  entries: [number, FlashEntry][],
  hasCritical: boolean
): Promise<[number, FlashEntry][]> {
  return new Promise((resolve) => {
    // Analyze entries
    const hasLun5 = entries.some(([, e]) => (e.lun ?? (e.partition as any).lun ?? 0) === 5);
    const hasPersist = entries.some(([, e]) => {
      const name = (e.label || e.partition.name).toLowerCase();
      return name === 'persist';
    });

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'flash-confirm-overlay';

    // Build entries HTML with checkboxes
    const entriesHtml = entries.map(([idx, { file, partition, label, lun }], i) => {
      const name = label || partition.name;
      const partLun = lun ?? (partition as any).lun ?? 0;
      const isCritical = CRITICAL_PARTITIONS.includes(name.toLowerCase());
      const isProtected = PROTECTED_PARTITIONS.includes(name.toLowerCase());
      const isLun5 = partLun === 5;

      // Protected partitions are unchecked by default
      const defaultChecked = !isProtected;

      let badges = '';
      if (isCritical) badges += '<span class="warning-badge critical-badge">⚠️ CRITICAL</span>';
      if (isLun5) badges += '<span class="warning-badge lun5-badge">⚡ LUN5</span>';
      if (isProtected) badges += '<span class="warning-badge protected-badge">🛡️ PROTECTED</span>';

      return `
        <label class="flash-item-selectable ${isCritical ? 'critical' : ''} ${isLun5 ? 'lun5' : ''}" data-index="${i}">
          <input type="checkbox" class="flash-checkbox" data-entry-idx="${idx}" ${defaultChecked ? 'checked' : ''} />
          <span class="partition-name">${name}</span>
          <span class="lun-badge">LUN${partLun}</span>
          <span class="arrow">←</span>
          <span class="file-name">${file.name}</span>
          ${badges}
        </label>
      `;
    }).join('');

    overlay.innerHTML = `
      <div class="flash-confirm-modal flash-confirm-modal-large">
        <h3>⚠️ Confirm Flash</h3>

        <div class="flash-protection-options">
          <label class="protection-option">
            <input type="checkbox" id="skip-lun5" ${hasLun5 ? 'checked' : ''} />
            <span>🛡️ Skip LUN5 partitions</span>
            <span class="option-hint">(calibration data)</span>
          </label>
          <label class="protection-option">
            <input type="checkbox" id="skip-persist" ${hasPersist ? 'checked' : ''} />
            <span>🛡️ Skip persist</span>
            <span class="option-hint">(account & settings)</span>
          </label>
          <label class="protection-option">
            <input type="checkbox" id="skip-userdata" checked />
            <span>🛡️ Skip userdata</span>
            <span class="option-hint">(user data)</span>
          </label>
        </div>

        <div class="flash-list-selectable">
          ${entriesHtml}
        </div>

        <div class="flash-selection-actions">
          <button class="btn-select-all-flash">Select All</button>
          <button class="btn-select-none-flash">Select None</button>
          <span class="flash-selected-count">0 selected</span>
        </div>

        ${hasLun5 ? `<div class="lun5-warning">⚡ ${LUN5_WARNING}</div>` : ''}
        ${hasCritical ? '<div class="critical-warning">⚠️ CRITICAL PARTITIONS - RISK OF BRICK!</div>' : ''}

        <div class="flash-confirm-buttons">
          <button class="btn-cancel">❌ Cancel</button>
          <button class="btn-confirm ${hasCritical ? 'critical' : ''}">⚡ CONFIRM FLASH</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Update selected count
    const updateSelectedCount = () => {
      const count = overlay.querySelectorAll('.flash-checkbox:checked').length;
      const countEl = overlay.querySelector('.flash-selected-count');
      if (countEl) countEl.textContent = `${count} selected`;

      // Disable confirm if nothing selected
      const confirmBtn = overlay.querySelector('.btn-confirm') as HTMLButtonElement;
      if (confirmBtn) confirmBtn.disabled = count === 0;
    };

    // Apply protection filters
    const applyProtectionFilters = () => {
      const skipLun5 = (overlay.querySelector('#skip-lun5') as HTMLInputElement)?.checked;
      const skipPersist = (overlay.querySelector('#skip-persist') as HTMLInputElement)?.checked;
      const skipUserdata = (overlay.querySelector('#skip-userdata') as HTMLInputElement)?.checked;

      entries.forEach(([, { partition, label, lun }], i) => {
        const name = (label || partition.name).toLowerCase();
        const partLun = lun ?? (partition as any).lun ?? 0;
        const checkbox = overlay.querySelector(`.flash-checkbox[data-entry-idx="${entries[i][0]}"]`) as HTMLInputElement;

        if (!checkbox) return;

        if (skipLun5 && partLun === 5) {
          checkbox.checked = false;
        }
        if (skipPersist && name === 'persist') {
          checkbox.checked = false;
        }
        if (skipUserdata && name === 'userdata') {
          checkbox.checked = false;
        }
      });

      updateSelectedCount();
    };

    // Initial count and filter
    applyProtectionFilters();

    // Protection option handlers
    overlay.querySelectorAll('.protection-option input').forEach(cb => {
      cb.addEventListener('change', applyProtectionFilters);
    });

    // Checkbox change handler
    overlay.querySelectorAll('.flash-checkbox').forEach(cb => {
      cb.addEventListener('change', updateSelectedCount);
    });

    // Select All / None handlers
    overlay.querySelector('.btn-select-all-flash')?.addEventListener('click', () => {
      overlay.querySelectorAll('.flash-checkbox').forEach(cb => {
        (cb as HTMLInputElement).checked = true;
      });
      updateSelectedCount();
    });

    overlay.querySelector('.btn-select-none-flash')?.addEventListener('click', () => {
      overlay.querySelectorAll('.flash-checkbox').forEach(cb => {
        (cb as HTMLInputElement).checked = false;
      });
      updateSelectedCount();
    });

    // Confirm handler - return selected entries
    overlay.querySelector('.btn-confirm')?.addEventListener('click', () => {
      const selectedEntries: [number, FlashEntry][] = [];
      overlay.querySelectorAll('.flash-checkbox:checked').forEach(cb => {
        const idx = parseInt((cb as HTMLInputElement).dataset.entryIdx || '-1', 10);
        const entry = entries.find(([i]) => i === idx);
        if (entry) selectedEntries.push(entry);
      });
      overlay.remove();
      resolve(selectedEntries);
    });

    overlay.querySelector('.btn-cancel')?.addEventListener('click', () => {
      overlay.remove();
      resolve([]);
    });

    // Click outside to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve([]);
      }
    });
  });
}

/**
 * Handle flash file selection for a partition
 */
async function handleSelectFlashFile(partitionIndex: number): Promise<void> {
  const partitions = (window as any).__partitions as import('./types').PartitionInfo[];
  if (!partitions || !partitions[partitionIndex]) {
    terminal.error('Partition not found');
    return;
  }

  const partition = partitions[partitionIndex];

  // Initialize flash files map if needed
  if (!(window as any).__flashFiles) {
    (window as any).__flashFiles = new Map<number, { file: File, partition: import('./types').PartitionInfo }>();
  }
  const flashFiles = (window as any).__flashFiles as Map<number, { file: File, partition: import('./types').PartitionInfo }>;

  // Open file picker
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.bin,.img,.mbn,.elf';

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const partitionSize = Number(partition.sizeInSectors) * 4096;

    // Size validation warning
    if (file.size > partitionSize) {
      terminal.warning(`⚠️ File size (${formatBytes(file.size)}) exceeds partition size (${formatBytes(partitionSize)})`);
      terminal.warning('File will be truncated or flash may fail.');
    } else if (file.size < partitionSize) {
      terminal.info(`File size (${formatBytes(file.size)}) is smaller than partition (${formatBytes(partitionSize)}). Will be padded with zeros.`);
    }

    // Critical partition warning
    if (CRITICAL_PARTITIONS.includes(partition.name.toLowerCase())) {
      terminal.warning(`⚠️ WARNING: "${partition.name}" is a critical partition!`);
      terminal.warning('Flashing incorrect data can BRICK your device!');
    }

    // Store the file
    flashFiles.set(partitionIndex, { file, partition });
    terminal.success(`Selected "${file.name}" for partition "${partition.name}"`);

    // Re-render table to show file info, keeping current search filter
    const searchInput = document.getElementById('partition-search') as HTMLInputElement;
    const currentFilter = searchInput?.value || '';
    renderPartitionTable(partitions, currentFilter);
    updateSelectedCount();
  };

  input.click();
}

/**
 * Handle flash all selected partitions
 */
async function handleFlashSelected(): Promise<void> {
  if (!firehose) {
    terminal.error('Firehose not initialized.');
    return;
  }

  const flashFiles = (window as any).__flashFiles as Map<number, { file: File, partition: import('./types').PartitionInfo }>;
  const selectedPartitions = (window as any).__selectedPartitions as Set<number>;

  if (!flashFiles || flashFiles.size === 0) {
    terminal.error('No flash files selected. Please select files first (📂 button).');
    return;
  }

  if (!selectedPartitions || selectedPartitions.size === 0) {
    terminal.error('No partitions checked. Please check the checkbox for partitions you want to flash.');
    return;
  }

  // Build list of files to flash - only partitions that are BOTH checked AND have file selected
  const entries: [number, { file: File, partition: import('./types').PartitionInfo }][] = [];

  for (const [index, flashData] of flashFiles.entries()) {
    if (selectedPartitions.has(index)) {
      entries.push([index, flashData]);
    }
  }

  if (entries.length === 0) {
    terminal.error('No partitions match the criteria. Partitions must be BOTH checked ☑️ AND have a file selected 📄.');
    return;
  }

  // Show confirmation with size warnings
  terminal.separator();
  terminal.warning('⚠️ FLASH CONFIRMATION');
  terminal.info(`About to flash ${entries.length} partition(s):`);

  let hasCritical = false;
  let hasSizeMismatch = false;

  for (const [, { file, partition }] of entries) {
    const isCritical = CRITICAL_PARTITIONS.includes(partition.name.toLowerCase());
    const partitionSize = Number(partition.sizeInSectors) * 4096;
    const sizeMismatch = file.size !== partitionSize;

    if (isCritical) hasCritical = true;
    if (sizeMismatch) hasSizeMismatch = true;

    let sizeWarning = '';
    if (file.size > partitionSize) {
      sizeWarning = ` ⚠️ FILE TOO LARGE (${formatBytes(file.size)} > ${formatBytes(partitionSize)})`;
    } else if (file.size < partitionSize) {
      sizeWarning = ` ⚠️ FILE SMALLER (${formatBytes(file.size)} < ${formatBytes(partitionSize)})`;
    }

    terminal.info(`  • ${partition.name} ← ${file.name} (${formatBytes(file.size)})${isCritical ? ' ⚠️ CRITICAL' : ''}${sizeWarning}`);
  }

  if (hasSizeMismatch) {
    terminal.warning('');
    terminal.warning('⚠️ SIZE MISMATCH DETECTED!');
    terminal.warning('Some files have different size than partition. Proceed with caution!');
  }

  if (hasCritical) {
    terminal.warning('');
    terminal.warning('⚠️ CRITICAL PARTITIONS DETECTED!');
    terminal.warning('Flashing these partitions incorrectly can BRICK your device!');
  }

  // Confirm with user using custom modal
  terminal.warning('');
  terminal.warning('👆 Click the CONFIRM button in the toolbar to proceed, or CANCEL to abort.');

  const selectedEntries = await showFlashConfirmDialog(entries, hasCritical);

  if (selectedEntries.length === 0) {
    terminal.info('Flash cancelled by user.');
    return;
  }

  terminal.separator();
  terminal.info(`🔥 Starting flash operation (${selectedEntries.length} partition(s))...`);

  let successCount = 0;
  let failCount = 0;
  let isFirstWrite = true;

  for (const [index, { file, partition }] of selectedEntries) {
    terminal.info(`Flashing "${partition.name}"...`);

    try {
      // Read file data
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      const lun = (partition as any).lun ?? 0;

      // SPOOF MODE: Some partitions are protected and need BackupGPT spoof
      const PROTECTED_PARTITIONS = ['super', 'splash_odm', 'vm-bootsys_a', 'vm-bootsys_b'];
      const isProtected = PROTECTED_PARTITIONS.includes(partition.name.toLowerCase());

      let spoofLabel: string | undefined;
      let spoofFilename: string | undefined;

      if (isProtected) {
        terminal.info(`[Spoof Mode] ${partition.name} is protected, using BackupGPT spoof`);
        spoofLabel = 'BackupGPT';
        spoofFilename = `gpt_backup${lun}.bin`;
      }

      // Skip configure for subsequent writes (already configured)
      const result = await firehose.writePartition(
        lun,
        partition.startSector,
        partition.sizeInSectors,
        partition.name,
        data,
        (percent) => {
          if (percent === 100) {
            terminal.debug(`${partition.name}: 100%`);
          }
        },
        !isFirstWrite,  // skipConfigure = true for all except first
        file.name,  // Pass actual filename so device can match partition info
        false,  // partofsingleimage = false for normal partition writes
        false,  // sparse = false (could be enhanced to detect from file)
        spoofLabel,    // For protected partitions: "BackupGPT"
        spoofFilename  // For protected partitions: "gpt_backup0.bin"
      );

      isFirstWrite = false;

      if (result.success) {
        terminal.success(`✅ ${partition.name} flashed successfully (${formatBytes(result.bytesWritten)})`);
        successCount++;
        // Remove from flash files after success
        flashFiles.delete(index);
      } else {
        terminal.error(`❌ ${partition.name} flash failed: ${result.error}`);
        failCount++;
      }
    } catch (error) {
      terminal.error(`❌ ${partition.name} error: ${error instanceof Error ? error.message : error}`);
      failCount++;
    }
  }

  terminal.separator();
  if (failCount === 0) {
    terminal.success(`✅ All ${successCount} partition(s) flashed successfully!`);
  } else {
    terminal.warning(`Flash complete: ${successCount} success, ${failCount} failed`);
  }

  // Refresh table, keeping current search filter
  const partitions = (window as any).__partitions as import('./types').PartitionInfo[];
  if (partitions) {
    const searchInput = document.getElementById('partition-search') as HTMLInputElement;
    const currentFilter = searchInput?.value || '';
    renderPartitionTable(partitions, currentFilter);
  }
  updateSelectedCount();
}

// ============================================================================
// XML Batch Flash
// ============================================================================

interface ProgramEntry {
  label: string;
  filename: string;
  startSector: bigint;
  numSectors: number;
  lun: number;
  sectorSize: number;
  partofsingleimage: boolean;  // true for GPT/raw writes, false for partition writes
  sparse: boolean;  // true for sparse images (like super.img), false for raw images
}

/**
 * Parse rawprogram XML file to extract program entries
 */
function parseRawprogramXml(xmlContent: string): ProgramEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const entries: ProgramEntry[] = [];

  const programs = doc.querySelectorAll('program');
  for (const prog of programs) {
    const filename = prog.getAttribute('filename') || '';
    // Skip entries without filename (they're placeholders)
    if (!filename) continue;

    const startSectorStr = prog.getAttribute('start_sector') || '0';
    const numSectorsStr = prog.getAttribute('num_partition_sectors') || '0';

    // Skip entries with formula-based values (like NUM_DISK_SECTORS-5.)
    // These are typically BackupGPT entries that use disk-size-relative positioning
    if (startSectorStr.includes('NUM_DISK_SECTORS') || numSectorsStr.includes('NUM_DISK_SECTORS')) {
      continue;
    }

    try {
      const partofsingleimage = prog.getAttribute('partofsingleimage') === 'true';
      const sparse = prog.getAttribute('sparse') === 'true';  // Parse sparse attribute from XML

      entries.push({
        label: prog.getAttribute('label') || '',
        filename: filename,
        startSector: BigInt(startSectorStr),
        numSectors: parseInt(numSectorsStr, 10),
        lun: parseInt(prog.getAttribute('physical_partition_number') || '0', 10),
        sectorSize: parseInt(prog.getAttribute('SECTOR_SIZE_IN_BYTES') || '4096', 10),
        partofsingleimage: partofsingleimage,
        sparse: sparse,  // Add sparse to entry
      });
    } catch {
      // Skip entries with unparseable values
    }
  }

  return entries;
}

/**
 * Handle flash from XML file - improved UX
 * Flow: Select ROM folder → Auto-find XMLs → Checkbox selection → Flash
 */
async function handleFlashFromXml(): Promise<void> {
  if (!firehose) {
    terminal.error('Firehose not initialized. Run unlock flow first.');
    return;
  }

  // Firehose is already configured from reading partition table - no need to reconfigure
  terminal.separator();
  terminal.success('✅ Firehose ready for flashing');

  // Step 1: Select ROM folder
  terminal.separator();
  terminal.info('📁 Select ROM folder containing XML and image files...');

  let dirHandle: FileSystemDirectoryHandle;
  try {
    dirHandle = await (window as any).showDirectoryPicker({
      mode: 'read',
    });
  } catch (e) {
    terminal.info('Folder selection cancelled.');
    return;
  }

  terminal.success(`Selected folder: ${dirHandle.name}`);

  // Step 2: Find all rawprogram*.xml files (including subfolders)
  terminal.info('Scanning for rawprogram XML files...');
  const xmlFiles: { name: string; handle: FileSystemFileHandle; dirHandle: FileSystemDirectoryHandle }[] = [];

  // Helper to scan directory recursively
  async function scanDirectory(dir: FileSystemDirectoryHandle, depth = 0): Promise<void> {
    if (depth > 2) return; // Limit recursion depth

    for await (const entry of (dir as any).values()) {
      if (entry.kind === 'file' && entry.name.match(/^rawprogram.*\.xml$/i)) {
        xmlFiles.push({ name: entry.name, handle: entry, dirHandle: dir });
      } else if (entry.kind === 'directory' && depth < 2) {
        // Scan subdirectory
        try {
          await scanDirectory(entry, depth + 1);
        } catch { /* ignore permission errors */ }
      }
    }
  }

  await scanDirectory(dirHandle);

  if (xmlFiles.length === 0) {
    terminal.error('No rawprogram*.xml files found in folder or subfolders.');
    return;
  }

  // Pre-parse XMLs to filter out those without valid entries (like native tool)
  terminal.info('Analyzing XML files...');
  terminal.debug(`Scanned ${xmlFiles.length} XML file(s): ${xmlFiles.map(x => x.name).join(', ')}`);
  const validXmlFiles: { name: string; handle: FileSystemFileHandle; dirHandle: FileSystemDirectoryHandle; entryCount: number }[] = [];

  for (const xml of xmlFiles) {
    try {
      const file = await xml.handle.getFile();
      const content = await file.text();
      const entries = parseRawprogramXml(content);
      terminal.debug(`  ${xml.name}: ${entries.length} entries with filename`);
      if (entries.length > 0) {
        validXmlFiles.push({ ...xml, entryCount: entries.length });
      }
    } catch (e) {
      terminal.debug(`  ${xml.name}: error - ${e}`);
    }
  }

  if (validXmlFiles.length === 0) {
    terminal.error('No XML files with valid program entries found.');
    return;
  }

  // Sort by name
  validXmlFiles.sort((a, b) => a.name.localeCompare(b.name));
  terminal.success(`Found ${validXmlFiles.length} XML file(s) with flash data`);

  // Step 3: Group XML files by type
  const groupedXmls = groupXmlFilesByType(validXmlFiles);
  terminal.debug(`Grouped into ${groupedXmls.length} group(s): ${groupedXmls.map(g => `${g.groupName}(${g.files.length})`).join(', ')}`);

  // Step 4: Show XML selection dialog (grouped)
  const selectedXmls = await showGroupedXmlSelectionDialog(groupedXmls);

  if (selectedXmls.length === 0) {
    terminal.info('No XML files selected.');
    return;
  }

  terminal.info(`Selected ${selectedXmls.length} XML file(s) to flash`);

  // Step 4: Parse all selected XMLs and collect entries
  // Store dirHandle with each entry for file lookup
  const allEntries: (ProgramEntry & { xmlDirHandle: FileSystemDirectoryHandle })[] = [];

  for (const displayName of selectedXmls) {
    // Extract original filename from display name (remove " (N files)" suffix)
    const xmlName = displayName.replace(/ \(\d+ files\)$/, '');
    const xmlInfo = validXmlFiles.find(x => x.name === xmlName);
    if (!xmlInfo) continue;

    try {
      const file = await xmlInfo.handle.getFile();
      const content = await file.text();
      const entries = parseRawprogramXml(content);
      terminal.debug(`${xmlName}: ${entries.length} entries`);
      // Add dirHandle to each entry
      for (const entry of entries) {
        allEntries.push({ ...entry, xmlDirHandle: xmlInfo.dirHandle });
      }
    } catch (e) {
      terminal.warning(`Failed to parse ${xmlName}`);
    }
  }

  if (allEntries.length === 0) {
    terminal.error('No valid program entries found in selected XMLs.');
    return;
  }

  terminal.success(`Total ${allEntries.length} partition(s) to flash`);

  // Step 5: Validate files exist in folder (same folder as XML)
  terminal.info('Checking binary files...');
  const filesToFlash: { entry: ProgramEntry; file: File }[] = [];
  const missingFiles: string[] = [];

  for (const entry of allEntries) {
    try {
      // Use the directory where the XML was found
      const fileHandle = await entry.xmlDirHandle.getFileHandle(entry.filename);
      const file = await fileHandle.getFile();
      filesToFlash.push({ entry, file });
      terminal.debug(`✓ ${entry.filename} (${formatBytes(file.size)})`);
    } catch {
      missingFiles.push(entry.filename);
    }
  }

  if (missingFiles.length > 0) {
    terminal.warning(`${missingFiles.length} file(s) not found, will be skipped`);
  }

  if (filesToFlash.length === 0) {
    terminal.error('No files found to flash.');
    return;
  }

  // Step 6: Confirmation with improved dialog
  terminal.separator();
  terminal.warning('⚠️ XML BATCH FLASH CONFIRMATION');
  terminal.info(`Ready to flash ${filesToFlash.length} partition(s):`)

  let hasCritical = false;
  for (const { entry, file } of filesToFlash) {
    const isCritical = CRITICAL_PARTITIONS.includes(entry.label.toLowerCase());
    if (isCritical) hasCritical = true;
    terminal.info(`  • LUN${entry.lun}:${entry.label} ← ${file.name} (${formatBytes(file.size)})${isCritical ? ' ⚠️ CRITICAL' : ''}`);
  }

  if (hasCritical) {
    terminal.warning('');
    terminal.warning('⚠️ CRITICAL PARTITIONS DETECTED!');
  }

  // Use enhanced dialog with selection capability
  const dialogEntries: [number, FlashEntry][] = filesToFlash.map(({ entry, file }, i) => [i, {
    file,
    partition: {
      name: entry.label,
      startSector: entry.startSector,
      sizeInSectors: BigInt(entry.numSectors),
      sizeFormatted: formatBytes(entry.numSectors * entry.sectorSize),
    } as any,
    label: entry.label,
    lun: entry.lun,
  }]);

  const selectedEntries = await showFlashConfirmDialog(dialogEntries, hasCritical);

  if (selectedEntries.length === 0) {
    terminal.info('Flash cancelled.');
    return;
  }

  // Get selected files to flash
  const selectedFilesToFlash = selectedEntries.map(([idx]) => filesToFlash[idx]);

  // LUN5 Protection: Filter out LUN5 partitions (like native tool)
  // Native tool: "[Protect LUN5] Skipping 5 partition(s) in LUN5"
  let lun5SkipCount = 0;
  const filteredFilesToFlash = LUN5_PROTECTED
    ? selectedFilesToFlash.filter(({ entry }) => {
      if (entry.lun === 5) {
        lun5SkipCount++;
        return false;
      }
      return true;
    })
    : selectedFilesToFlash;

  if (lun5SkipCount > 0) {
    terminal.warning(`[Protect LUN5] Skipping ${lun5SkipCount} partition(s) in LUN5`);
  }

  // Step 7: Separate GPT partitions from regular partitions
  // CRITICAL: GPT must be flashed FIRST, then device reset, then regular partitions
  const gptPartitions = filteredFilesToFlash.filter(({ entry }) =>
    entry.label === 'PrimaryGPT' || entry.label === 'BackupGPT'
  );
  const regularPartitions = filteredFilesToFlash.filter(({ entry }) =>
    entry.label !== 'PrimaryGPT' && entry.label !== 'BackupGPT'
  );

  terminal.separator();
  if (gptPartitions.length > 0) {
    terminal.info(`📋 Flash plan: ${gptPartitions.length} GPT table(s) first, then ${regularPartitions.length} partition(s)`);
  } else {
    terminal.info(`🔥 Starting XML batch flash (${filteredFilesToFlash.length} partition(s))...`);
  }

  let successCount = 0;
  let failCount = 0;
  let isFirstWrite = true;

  // Step 7a: Try to flash GPT tables
  // NOTE: We already reset device at function start to clear partition cache
  if (gptPartitions.length > 0) {
    terminal.separator();
    terminal.info(`📋 Phase 1: Flashing ${gptPartitions.length} GPT table(s)...`);

    for (const { entry, file } of gptPartitions) {
      terminal.info(`Flashing "${entry.label}" (LUN${entry.lun})...`);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        // For GPT flash, we MUST match the num_sectors from XML, not file size
        // Device validates the write size against what's declared in XML
        const numSectorsToWrite = entry.numSectors;

        // If file is smaller than declared sectors, we need to pad it
        const expectedBytes = numSectorsToWrite * 4096;
        let dataToWrite = data;

        if (data.byteLength < expectedBytes) {
          terminal.warning(`⚠️ File ${entry.filename} is ${formatBytes(data.byteLength)} but XML declares ${formatBytes(expectedBytes)}. Padding...`);
          // Pad with zeros to match XML declaration
          const paddedData = new Uint8Array(expectedBytes);
          paddedData.set(data);
          dataToWrite = paddedData;
        }

        const result = await firehose.writePartition(
          entry.lun,
          entry.startSector,
          BigInt(numSectorsToWrite),  // Use XML value, not file size
          entry.label,
          dataToWrite,  // Use padded data if needed
          (percent) => {
            if (percent === 100) terminal.debug(`${entry.label}: 100%`);
          },
          !isFirstWrite,
          entry.filename,  // Pass actual filename from XML (e.g., gpt_main0.bin, not PrimaryGPT.bin)
          true,  // FORCE partofsingleimage=true for GPT tables (XML may have false but device requires true)
          entry.sparse  // Pass sparse flag from XML (critical for sparse image handling)
        );

        isFirstWrite = false;

        if (result.success) {
          terminal.success(`✅ ${entry.label} (LUN${entry.lun}) flashed (${formatBytes(result.bytesWritten)})`);
          successCount++;
        } else {
          terminal.warning(`⚠️ ${entry.label} flash failed: ${result.error}`);
          terminal.warning('Continuing with regular partitions...');
          // Don't increment failCount - treat as non-fatal
        }
      } catch (error) {
        terminal.warning(`⚠️ ${entry.label} error: ${error instanceof Error ? error.message : error}`);
        terminal.warning('Continuing with regular partitions...');
        // Don't increment failCount - treat as non-fatal
      }
    }

    // Step 6.5: CRITICAL - Reconfigure to reload GPT from disk
    // After writing new GPT tables, trigger device to reload them
    terminal.separator();
    terminal.info('🔄 Triggering partition table reload...');
    try {
      // Wait for device to process GPT writes
      terminal.info('Waiting 2s for device to process GPT tables...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Reconfigure to force GPT reload from disk
      const configResult = await firehose.configure();
      if (!configResult.success) {
        terminal.warning('⚠️ Failed to reload partition tables');
      } else {
        terminal.success('✅ Partition tables reloaded, device ready for data partitions');
      }
    } catch (error) {
      terminal.warning(`⚠️ GPT reload warning: ${error instanceof Error ? error.message : error}`);
      terminal.info('Continuing anyway...');
    }
  }

  // Step 7b: Flash regular partitions
  if (regularPartitions.length > 0) {
    terminal.separator();
    terminal.info(`🔥 Phase 2: Flashing ${regularPartitions.length} partition(s)...`);

    for (const { entry, file } of regularPartitions) {
      // Log partition info like native tool
      terminal.info(`[Flash] Writing ${entry.label} (LUN${entry.lun}, ${formatBytes(file.size)})...`);

      try {
        let result: { success: boolean; bytesWritten: number; error?: string };

        // Native tool strategy: Use 64MB chunked writes for files >64MB
        // This is how super.img (14.28 GB) is successfully flashed
        const CHUNK_THRESHOLD = 512 * 1024 * 1024; // 512MB threshold (use chunked for files larger than this)

        // SPOOF MODE: Some partitions like 'super' and 'splash_odm' are protected.
        // Device rejects writes with the real label. Native tool bypasses this by
        // spoofing the label/filename to "BackupGPT"/"gpt_backup0.bin" while still
        // writing to the correct sector address.
        const PROTECTED_PARTITIONS = ['super', 'splash_odm', 'vm-bootsys_a', 'vm-bootsys_b'];
        const isProtected = PROTECTED_PARTITIONS.includes(entry.label.toLowerCase());

        let spoofLabel: string | undefined;
        let spoofFilename: string | undefined;

        if (isProtected) {
          terminal.info(`[Spoof Mode] ${entry.label} is protected, using BackupGPT spoof`);
          spoofLabel = 'BackupGPT';
          spoofFilename = `gpt_backup${entry.lun}.bin`;
        }

        if (file.size > CHUNK_THRESHOLD) {
          terminal.info(`[Strategy] Chunked write enabled (${formatBytes(file.size)})`);

          // Use chunked write like native tool
          result = await firehose.writePartitionChunked(
            entry.lun,
            entry.startSector,
            BigInt(entry.numSectors),
            entry.label,
            file,
            (percent) => {
              // Only log major milestones
              if (percent % 25 === 0) terminal.debug(`${entry.label}: ${percent}%`);
            },
            (chunkIndex, totalChunks, chunkMB) => {
              // Log each chunk progress like native tool
              terminal.info(`  Writing chunk ${chunkIndex}/${totalChunks} (${chunkMB} MB)...`);
            },
            entry.filename,  // Pass filename from XML (e.g., "super.img")
            true,  // partofsingleimage=true for regular partitions after GPT flash
            spoofLabel,      // For protected partitions: "BackupGPT"
            spoofFilename    // For protected partitions: "gpt_backup0.bin"
          );
        } else {
          // Load smaller files into memory (faster for small files)
          const arrayBuffer = await file.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);

          // SPOOF MODE for small protected files (uses same spoof variables from above)
          // Note: spoof detection was done before the if/else, so spoofLabel/spoofFilename are available

          result = await firehose.writePartition(
            entry.lun,
            entry.startSector,
            BigInt(entry.numSectors),
            entry.label,
            data,
            (percent) => {
              if (percent === 100) terminal.debug(`${entry.label}: 100%`);
            },
            !isFirstWrite,
            entry.filename,
            true,  // FORCE partofsingleimage=true after GPT reload
            entry.sparse,
            spoofLabel,      // For protected partitions: "BackupGPT"
            spoofFilename    // For protected partitions: "gpt_backup0.bin"
          );
        }

        isFirstWrite = false;

        if (result.success) {
          terminal.success(`[Success] ${entry.label} written successfully`);
          successCount++;
        } else {
          terminal.error(`❌ ${entry.label} failed: ${result.error}`);
          failCount++;
        }
      } catch (error) {
        terminal.error(`❌ ${entry.label} error: ${error instanceof Error ? error.message : error}`);
        failCount++;
      }
    }
  }

  // Final summary
  terminal.separator();
  if (failCount === 0) {
    terminal.success(`✅ All ${successCount} partition(s) flashed successfully!`);
  } else {
    terminal.warning(`Flash complete: ${successCount} success, ${failCount} failed`);
  }

  // Step 8: Apply patch files (CRITICAL for device to boot!)
  terminal.separator();
  terminal.info('📝 Applying patch files...');

  // Find patch*.xml files - search in root and subdirectories (like rawprogram search)
  const patchFiles: { name: string; handle: FileSystemFileHandle }[] = [];
  const searchedDirs = new Set<string>();

  async function findPatchFiles(dir: FileSystemDirectoryHandle, depth = 0) {
    const dirPath = dir.name; // Simple path tracking
    if (searchedDirs.has(dirPath)) return;
    searchedDirs.add(dirPath);

    for await (const entry of (dir as any).values()) {
      if (entry.kind === 'file' && entry.name.match(/^patch\d+\.xml$/i)) {
        // Avoid duplicates
        if (!patchFiles.some(p => p.name === entry.name)) {
          patchFiles.push({ name: entry.name, handle: entry });
        }
      } else if (entry.kind === 'directory' && depth < 2) {
        try {
          await findPatchFiles(entry, depth + 1);
        } catch { /* ignore */ }
      }
    }
  }

  await findPatchFiles(dirHandle);

  // Sort by name (patch0 → patch5)
  patchFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (patchFiles.length === 0) {
    terminal.warning('No patch files found - device may not boot properly!');
  } else {
    // Filter out patch5.xml if LUN5 protection is enabled (like native tool)
    const filteredPatchFiles = LUN5_PROTECTED
      ? patchFiles.filter(p => {
        if (p.name.toLowerCase() === 'patch5.xml') {
          terminal.warning('[Protect LUN5] Skipping patch5.xml');
          return false;
        }
        return true;
      })
      : patchFiles;

    terminal.info(`Applying ${filteredPatchFiles.length} patch file(s): ${filteredPatchFiles.map(p => p.name.replace('.xml', '')).join(', ')}.xml`);

    // Reconfigure before applying patches (like native tool does)
    await firehose.configure();

    let patchSuccess = 0;
    let patchFail = 0;

    for (const patchFile of filteredPatchFiles) {
      // Reconfigure before each patch file to reset device state
      await firehose.configure();

      try {
        const file = await patchFile.handle.getFile();
        const content = await file.text();

        // Parse patch XML
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        const patchElements = doc.querySelectorAll('patch');

        if (patchElements.length === 0) {
          terminal.debug(`${patchFile.name}: No patch entries`);
          continue;
        }

        terminal.debug(`${patchFile.name}: ${patchElements.length} patch entries`);

        for (const patch of patchElements) {
          const startSector = patch.getAttribute('start_sector') || '0';
          const byteOffset = patch.getAttribute('byte_offset') || '0';
          const size = patch.getAttribute('size_in_bytes') || '0';
          const value = patch.getAttribute('value') || '';
          const lun = parseInt(patch.getAttribute('physical_partition_number') || '0', 10);
          const filename = patch.getAttribute('filename') || '';

          // Skip patches with empty values or weird filenames
          if (!value || value === '' || filename !== 'DISK') {
            continue;
          }

          const result = await firehose.patch(lun, startSector, byteOffset, size, value);
          if (!result.success) {
            terminal.error(`Patch failed: LUN${lun} sector ${startSector}: ${result.error}`);
            patchFail++;
          }
        }

        patchSuccess++;
        terminal.success(`✅ ${patchFile.name} applied`);
      } catch (error) {
        terminal.error(`❌ ${patchFile.name} error: ${error instanceof Error ? error.message : error}`);
        patchFail++;
      }
    }

    if (patchFail > 0) {
      terminal.warning(`Patches applied: ${patchSuccess} success, ${patchFail} failed`);
    } else {
      terminal.success(`Patch application completed: ${patchSuccess}/${filteredPatchFiles.length} successful`);
    }
    terminal.info(`Patch files applied: ${patchSuccess} file(s)`);
  }

  // Step 9: Set bootable drive (like native tool)
  terminal.info('Sending setbootablestoragedrive (value=1)...');
  const bootResult = await firehose.setBootableDrive(1);
  if (bootResult.success) {
    terminal.success('setbootablestoragedrive command sent successfully');
  } else {
    terminal.warning(`Failed to set bootable drive: ${bootResult.error}`);
  }

  // Step 10: Auto reboot (like native tool)
  // Native tool: "Auto reboot is enabled, rebooting device..."
  terminal.separator();
  terminal.success('Flash completed successfully!');
  terminal.info('Auto reboot is enabled, rebooting device...');
  terminal.info('Sending reboot command...');

  try {
    const rebootResult = await firehose.power('reset');
    if (rebootResult.success) {
      terminal.success('Device is rebooting...');
      terminal.success('Device reboot command sent successfully!');
      terminal.success('🎉 All operations completed successfully!');
    } else {
      terminal.warning(`Reboot command failed: ${rebootResult.error}`);
      terminal.info('Please manually reboot the device.');
    }
  } catch (error) {
    terminal.warning(`Reboot error: ${error instanceof Error ? error.message : error}`);
    terminal.info('Please manually reboot the device or disconnect USB.');
  }
}

interface XmlFileInfo {
  name: string;
  handle: FileSystemFileHandle;
  dirHandle: FileSystemDirectoryHandle;
  entryCount: number;
}

interface XmlGroup {
  groupName: string;
  displayName: string;
  files: XmlFileInfo[];
}

/**
 * Group XML files by their type/suffix
 */
function groupXmlFilesByType(xmlFiles: XmlFileInfo[]): XmlGroup[] {
  const groups = new Map<string, XmlFileInfo[]>();

  for (const xml of xmlFiles) {
    let groupKey = 'other';

    // Try to extract group key from filename
    // rawprogram0.xml -> "main"
    // rawprogram0_BLANK_GPT.xml -> "BLANK_GPT"
    // rawprogram0_WIPE_PARTITIONS.xml -> "WIPE_PARTITIONS"
    // rawprogram_0_backup.xml -> "backup"
    const match1 = xml.name.match(/^rawprogram(\d+)(?:_(.+))?\.xml$/i);
    const match2 = xml.name.match(/^rawprogram_(\d+)_(.+)\.xml$/i);

    if (match1) {
      groupKey = match1[2] || 'main';
    } else if (match2) {
      groupKey = match2[2] || 'other';
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(xml);
  }

  // Convert to array and sort
  const result: XmlGroup[] = [];

  // Put 'main' group first
  if (groups.has('main')) {
    result.push({
      groupName: 'main',
      displayName: '📦 Main (rawprogram)',
      files: groups.get('main')!.sort((a, b) => a.name.localeCompare(b.name))
    });
    groups.delete('main');
  }

  // Add other groups sorted
  const otherKeys = Array.from(groups.keys()).sort();
  for (const key of otherKeys) {
    result.push({
      groupName: key,
      displayName: `📄 ${key.replace(/_/g, ' ')}`,
      files: groups.get(key)!.sort((a, b) => a.name.localeCompare(b.name))
    });
  }

  return result;
}

/**
 * Show grouped XML selection dialog with parent-child checkboxes
 */
function showGroupedXmlSelectionDialog(groups: XmlGroup[]): Promise<string[]> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'flash-confirm-overlay';

    // Build grouped HTML
    let groupsHtml = '';
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const totalFiles = group.files.reduce((sum, f) => sum + f.entryCount, 0);
      const isMainGroup = group.groupName === 'main';

      groupsHtml += `
        <div class="xml-group" data-group="${gi}">
          <label class="xml-group-header">
            <input type="checkbox" class="group-checkbox" data-group="${gi}" ${isMainGroup ? 'checked' : ''} />
            <span class="group-name">${group.displayName}</span>
            <span class="group-count">(${group.files.length} XML, ${totalFiles} partitions)</span>
          </label>
          <div class="xml-group-items">
            ${group.files.map((f, fi) => `
              <label class="xml-item">
                <input type="checkbox" class="file-checkbox" data-group="${gi}" data-file="${fi}" value="${f.name} (${f.entryCount} files)" ${isMainGroup ? 'checked' : ''} />
                <span>${f.name}</span>
                <span class="file-count">(${f.entryCount})</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="flash-confirm-modal xml-select-modal">
        <h3>📄 Select XML Files to Flash</h3>
        <div class="xml-list-grouped">
          ${groupsHtml}
        </div>
        <div class="xml-select-actions">
          <button class="btn-select-all">Select All</button>
          <button class="btn-select-none">Select None</button>
        </div>
        <div class="flash-confirm-buttons">
          <button class="btn-cancel">❌ Cancel</button>
          <button class="btn-confirm">✓ Continue</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Group checkbox handler - toggle all children
    overlay.querySelectorAll('.group-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const groupIndex = (e.target as HTMLInputElement).dataset.group;
        const isChecked = (e.target as HTMLInputElement).checked;
        overlay.querySelectorAll(`.file-checkbox[data-group="${groupIndex}"]`).forEach((fcb) => {
          (fcb as HTMLInputElement).checked = isChecked;
        });
      });
    });

    // File checkbox handler - update parent group state
    overlay.querySelectorAll('.file-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const groupIndex = (e.target as HTMLInputElement).dataset.group;
        const groupCheckbox = overlay.querySelector(`.group-checkbox[data-group="${groupIndex}"]`) as HTMLInputElement;
        const allFiles = overlay.querySelectorAll(`.file-checkbox[data-group="${groupIndex}"]`);
        const checkedFiles = overlay.querySelectorAll(`.file-checkbox[data-group="${groupIndex}"]:checked`);

        if (checkedFiles.length === 0) {
          groupCheckbox.checked = false;
          groupCheckbox.indeterminate = false;
        } else if (checkedFiles.length === allFiles.length) {
          groupCheckbox.checked = true;
          groupCheckbox.indeterminate = false;
        } else {
          groupCheckbox.checked = false;
          groupCheckbox.indeterminate = true;
        }
      });
    });

    // Select All / None handlers
    overlay.querySelector('.btn-select-all')?.addEventListener('click', () => {
      overlay.querySelectorAll('.group-checkbox, .file-checkbox').forEach((cb) => {
        (cb as HTMLInputElement).checked = true;
        (cb as HTMLInputElement).indeterminate = false;
      });
    });

    overlay.querySelector('.btn-select-none')?.addEventListener('click', () => {
      overlay.querySelectorAll('.group-checkbox, .file-checkbox').forEach((cb) => {
        (cb as HTMLInputElement).checked = false;
        (cb as HTMLInputElement).indeterminate = false;
      });
    });

    // Confirm handler
    overlay.querySelector('.btn-confirm')?.addEventListener('click', () => {
      const selected: string[] = [];
      overlay.querySelectorAll('.file-checkbox:checked').forEach((cb) => {
        selected.push((cb as HTMLInputElement).value);
      });
      overlay.remove();
      resolve(selected);
    });

    // Cancel handler
    overlay.querySelector('.btn-cancel')?.addEventListener('click', () => {
      overlay.remove();
      resolve([]);
    });

    // Click outside to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve([]);
      }
    });
  });
}

/**
 * Show backup options dialog
 * @returns true if user wants XML, false if not, null if cancelled
 */
function showBackupOptionsDialog(): Promise<boolean | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'flash-confirm-overlay';

    overlay.innerHTML = `
      <div class="flash-confirm-modal">
        <h2>🗂️ Backup Options</h2>
        <p style="margin-bottom: 16px; color: var(--text-secondary);">
          Choose backup format for selected partitions:
        </p>
        
        <div class="backup-options" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
          <label class="backup-option-item" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--border-radius); cursor: pointer; border: 2px solid transparent; transition: all 0.2s ease;">
            <input type="radio" name="backup-option" value="with-xml" checked style="margin-top: 4px;">
            <div>
              <div style="font-weight: 600; color: var(--accent-green);">📄 With XML (Recommended)</div>
              <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px;">
                Generate rawprogram XML files for easy restoration with flash tools
              </div>
            </div>
          </label>
          
          <label class="backup-option-item" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--border-radius); cursor: pointer; border: 2px solid transparent; transition: all 0.2s ease;">
            <input type="radio" name="backup-option" value="no-xml" style="margin-top: 4px;">
            <div>
              <div style="font-weight: 600;">💾 Without XML</div>
              <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 4px;">
                Only save partition images (manual restoration required)
              </div>
            </div>
          </label>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary btn-cancel">Cancel</button>
          <button class="btn btn-primary btn-confirm">Start Backup</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Add hover effect
    const optionItems = overlay.querySelectorAll('.backup-option-item');
    optionItems.forEach(item => {
      const radio = item.querySelector('input[type="radio"]') as HTMLInputElement;
      item.addEventListener('click', () => {
        radio.checked = true;
        optionItems.forEach(i => (i as HTMLElement).style.borderColor = 'transparent');
        (item as HTMLElement).style.borderColor = 'var(--accent-blue)';
      });
    });

    // Set initial border
    const checkedItem = overlay.querySelector('input[type="radio"]:checked')?.closest('.backup-option-item') as HTMLElement;
    if (checkedItem) checkedItem.style.borderColor = 'var(--accent-blue)';

    // Confirm handler
    overlay.querySelector('.btn-confirm')?.addEventListener('click', () => {
      const selected = overlay.querySelector('input[name="backup-option"]:checked') as HTMLInputElement;
      const generateXml = selected?.value === 'with-xml';
      overlay.remove();
      resolve(generateXml);
    });

    // Cancel handler
    overlay.querySelector('.btn-cancel')?.addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });

    // Click outside to cancel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(null);
      }
    });
  });
}

/**
 * Handle batch backup of selected partitions
 */
async function handleBatchBackup(): Promise<void> {
  if (!firehose) {
    terminal.error('Firehose not initialized.');
    return;
  }

  const partitions = (window as any).__partitions as import('./types').PartitionInfo[];
  const selectedPartitions = (window as any).__selectedPartitions as Set<number>;

  if (!selectedPartitions || selectedPartitions.size === 0) {
    terminal.error('No partitions selected');
    return;
  }

  // Ask user if they want to generate XML
  const generateXml = await showBackupOptionsDialog();
  if (generateXml === null) {
    terminal.info('Backup cancelled');
    return;
  }

  // Get selected partition objects
  const selectedList = Array.from(selectedPartitions).sort((a, b) => a - b);
  const partitionsToBackup = selectedList.map(i => ({ index: i, partition: partitions[i] }));

  terminal.separator();
  terminal.info(`📦 Batch backup: ${partitionsToBackup.length} partition(s)`);
  if (generateXml) {
    terminal.info('Will generate XML files for restoration');
  }

  // Request directory access
  let directoryHandle: FileSystemDirectoryHandle;
  try {
    directoryHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite'
    });
    terminal.success(`📁 Output directory: ${directoryHandle.name}`);
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      terminal.warning('Backup cancelled by user');
      return;
    }
    terminal.error(`Failed to select directory: ${e}`);
    return;
  }

  // Group partitions by LUN for XML generation
  const partitionsByLun: Map<number, Array<{ partition: import('./types').PartitionInfo; filename: string }>> = new Map();

  // Backup each partition
  let successCount = 0;
  let failCount = 0;
  const skippedAlignment: string[] = [];
  const skippedProtected: string[] = [];

  // Protected bootloader partitions that device forbids reading
  const protectedPartitions = ['ssd', 'xbl_a', 'xbl_b', 'uefi_a', 'uefi_b'];

  for (const { index, partition } of partitionsToBackup) {
    const lun = (partition as any).lun ?? 0;
    const numSectors = partition.sizeInSectors;
    const sizeBytes = Number(numSectors) * 4096;
    const filename = `${partition.name}.img`;

    // Skip alignment padding partitions
    if (partition.name.startsWith('ALIGN_TO_')) {
      skippedAlignment.push(partition.name);
      terminal.info(`⏭️ Skipped: ${partition.name} (alignment padding)`);
      continue;
    }
    // Skip protected bootloader partitions
    if (protectedPartitions.includes(partition.name)) {
      skippedProtected.push(partition.name);
      terminal.info(`⏭️ Skipped: ${partition.name} (protected bootloader)`);
      continue;
    }

    terminal.info(`📥 Reading: ${partition.name} (${partition.sizeFormatted})...`);

    try {
      // Create file in directory
      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });

      let result: { success: boolean; bytesWritten?: number; data?: Uint8Array; error?: string };

      // Use streaming for large partitions
      if (sizeBytes > 1024 * 1024 * 1024) {
        result = await firehose.readPartitionStreamToFile(
          lun,
          partition.startSector,
          numSectors,
          partition.name,
          fileHandle,
          undefined
        );
      } else if (sizeBytes > 100 * 1024 * 1024) {
        // Medium partitions - use streaming too
        result = await firehose.readPartitionStreamToFile(
          lun,
          partition.startSector,
          numSectors,
          partition.name,
          fileHandle,
          undefined
        );
      } else {
        // Small partitions - read to memory first, then write
        const readResult = await firehose.readPartition(
          lun,
          partition.startSector,
          numSectors,
          partition.name,
          undefined
        );

        if (readResult.success && readResult.data) {
          const writable = await fileHandle.createWritable();
          const buffer = new ArrayBuffer(readResult.data.length);
          new Uint8Array(buffer).set(readResult.data);
          await writable.write(buffer);
          await writable.close();
          result = { success: true, bytesWritten: readResult.data.length };
        } else {
          result = { success: false, error: readResult.error };
        }
      }

      if (result.success) {
        terminal.success(`✓ Saved: ${filename}`);
        successCount++;

        // Track for XML generation
        if (generateXml) {
          if (!partitionsByLun.has(lun)) {
            partitionsByLun.set(lun, []);
          }
          partitionsByLun.get(lun)!.push({ partition, filename });
        }
      } else {
        terminal.error(`✗ Failed: ${partition.name} - ${result.error}`);
        failCount++;
      }
    } catch (error) {
      terminal.error(`✗ Error: ${partition.name} - ${error}`);
      failCount++;
    }
  }

  // Generate XML files
  if (generateXml && partitionsByLun.size > 0) {
    terminal.info('Generating XML files...');

    for (const [lun, parts] of partitionsByLun) {
      const xmlFilename = `rawprogram_${lun}_backup.xml`;
      const xmlContent = generateRawProgramXml(lun, parts);

      try {
        const xmlHandle = await directoryHandle.getFileHandle(xmlFilename, { create: true });
        const writable = await xmlHandle.createWritable();
        await writable.write(xmlContent);
        await writable.close();
        terminal.success(`📄 XML: ${xmlFilename}`);
      } catch (e) {
        terminal.error(`Failed to create ${xmlFilename}: ${e}`);
      }
    }
  }

  terminal.separator();
  terminal.success(`✅ Batch backup complete: ${successCount} succeeded, ${failCount} failed`);

  // Show summary of skipped partitions if user selected any
  const totalSkipped = skippedAlignment.length + skippedProtected.length;
  if (totalSkipped > 0) {
    terminal.info('');
    terminal.info(`ℹ️ ${totalSkipped} partition(s) were skipped (not errors):`);
    if (skippedProtected.length > 0) {
      terminal.info(`   • Protected bootloader (${skippedProtected.length}): ${skippedProtected.join(', ')}`);
      terminal.info(`     → Device security prevents reading. No unique data - can use from official ROM`);
    }
    if (skippedAlignment.length > 0) {
      terminal.info(`   • Alignment padding (${skippedAlignment.length}): ${skippedAlignment.join(', ')}`);
      terminal.info(`     → Empty padding areas, not needed for backup`);
    }
  }
}

/**
 * Generate rawprogram XML content for flash restoration
 */
function generateRawProgramXml(
  lun: number,
  parts: Array<{ partition: import('./types').PartitionInfo; filename: string }>
): string {
  let xml = '<?xml version="1.0" ?>\n';
  xml += '<data>\n';
  xml += `  <!-- rawprogram for LUN ${lun} - Generated by Oppo WebUSB Tool -->\n`;
  xml += `  <!-- ${new Date().toISOString()} -->\n`;

  for (const { partition, filename } of parts) {
    const sectorSize = 4096;
    const numSectors = partition.sizeInSectors;

    xml += `  <program SECTOR_SIZE_IN_BYTES="${sectorSize}" `;
    xml += `file_sector_offset="0" `;
    xml += `filename="${filename}" `;
    xml += `label="${partition.name}" `;
    xml += `num_partition_sectors="${numSectors}" `;
    xml += `partofsingleimage="false" `;
    xml += `physical_partition_number="${lun}" `;
    xml += `readbackverify="false" `;
    xml += `size_in_KB="${Number(numSectors) * sectorSize / 1024}" `;
    xml += `sparse="false" `;
    xml += `start_byte_hex="0x${(Number(partition.startSector) * sectorSize).toString(16)}" `;
    xml += `start_sector="${partition.startSector}"/>\n`;
  }

  xml += '</data>\n';
  return xml;
}


/**
 * Handle backup/download of a partition
 */
async function handleBackupPartition(index: number): Promise<void> {
  if (!firehose) {
    terminal.error('Firehose not initialized.');
    return;
  }

  const partitions = (window as any).__partitions as import('./types').PartitionInfo[];
  if (!partitions || index >= partitions.length) {
    terminal.error('Invalid partition index');
    return;
  }

  const partition = partitions[index];
  const lun = (partition as any).lun ?? 0;
  const numSectors = partition.sizeInSectors;
  const sizeBytes = Number(numSectors) * 4096;

  terminal.separator();
  terminal.info(`📥 Backing up partition: ${partition.name}`);
  terminal.info(`LUN: ${lun}, Start: ${partition.startSector}, Size: ${partition.sizeFormatted}`);

  // Check if partition is in protected area (GPT header region)
  if (partition.startSector < 8n) {
    terminal.warning(`⚠️ Skipping ${partition.name}: Located in protected GPT area (sector ${partition.startSector})`);
    terminal.info('This is normal - GPT header regions cannot be backed up via external network.');
    return;
  }

  // Warn for large partitions
  if (sizeBytes > 100 * 1024 * 1024) {
    terminal.warning(`Large partition (${partition.sizeFormatted}) - this may take a while...`);
  }

  try {
    const filename = `${partition.name}.bin`;

    // For large partitions (>1GB), use single-command streaming directly to file
    // This matches native tool behavior that can read 16GB+ in one command
    if (sizeBytes > 1024 * 1024 * 1024 && 'showSaveFilePicker' in window) {
      terminal.info('Using single-command streaming (native tool mode)...');

      // Prompt for save location first
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Binary Files',
          accept: { 'application/octet-stream': ['.bin'] }
        }]
      });

      // Use the new streaming method that sends ONE read command for entire partition
      const result = await firehose.readPartitionStreamToFile(
        lun,
        partition.startSector,
        numSectors,
        partition.name,
        handle,
        (percent) => {
          if (percent % 5 === 0) {
            terminal.debug(`Progress: ${percent}%`);
          }
        }
      );

      if (result.success) {
        terminal.success(`✅ Streaming complete! ${result.bytesWritten} bytes written`);
      } else {
        terminal.error(`Streaming failed: ${result.error}`);
      }
      return;
    }

    // Standard read for smaller partitions
    const result = await firehose.readPartition(
      lun,
      partition.startSector,
      numSectors,
      partition.name,
      (percent) => {
        // Update progress in terminal
        if (percent % 10 === 0) {
          terminal.debug(`Progress: ${percent}%`);
        }
      }
    );

    if (!result.success || !result.data) {
      terminal.error(`Backup failed: ${result.error}`);
      return;
    }

    terminal.success(`✅ Backup complete! ${result.data.length} bytes`);

    // Save file using File System Access API (Chrome/Edge)

    try {
      // Try modern File System Access API first
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Binary Files',
            accept: { 'application/octet-stream': ['.bin'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(result.data);
        await writable.close();
        terminal.success(`📁 Saved: ${filename}`);
        return;
      }
    } catch (e) {
      // User cancelled or API failed, fall through to fallback
      if ((e as Error).name === 'AbortError') {
        terminal.warning('Save cancelled by user');
        return;
      }
    }

    // Fallback: Traditional blob download
    const buffer = new ArrayBuffer(result.data.length);
    new Uint8Array(buffer).set(result.data);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);

    terminal.success(`📁 Downloading: ${filename}`);

  } catch (error) {
    terminal.error(`Backup error: ${error instanceof Error ? error.message : error}`);
  }
}

async function handleRebootDevice(): Promise<void> {
  if (!firehose) {
    terminal.error('Firehose not initialized. Run unlock flow first.');
    return;
  }

  terminal.separator();
  terminal.info('📤 Reboot Device');
  terminal.info('Sending reboot command to device...');

  try {
    const result = await firehose.power('reset');

    if (result.success) {
      terminal.separator();
      terminal.success('✅ Device rebooted successfully!');
      terminal.info('Device is booting to system.');

      // Update UI state
      state.isConnected = false;
      firehose = null as any;
      updateConnectionStatus(false);
      updateStage(AppStage.IDLE);
      updateButtonStates();

      // Cleanup
      try {
        await usb.disconnect(true);
      } catch { /* ignore */ }

    } else {
      terminal.error(`Reboot failed: ${result.error}`);
    }
  } catch (error) {
    // Device may disconnect immediately which is expected
    terminal.separator();
    terminal.success('✅ Reboot command sent!');
    terminal.info('Device is rebooting to system...');

    state.isConnected = false;
    firehose = null as any;
    updateConnectionStatus(false);
    updateStage(AppStage.IDLE);
    updateButtonStates();
  }
}

// ============================================================================
// UI Updates
// ============================================================================

function updateStage(stage: AppStage): void {
  state.stage = stage;

  const steps = document.querySelectorAll('.progress-step');
  steps.forEach((step, index) => {
    const icon = step.querySelector('.step-icon');
    if (index < stage) {
      step.classList.remove('active');
      step.classList.add('completed');
      if (icon) icon.textContent = '✓';
    } else if (index === stage) {
      step.classList.add('active');
      step.classList.remove('completed');
      if (icon) icon.textContent = '●';
    } else {
      step.classList.remove('active', 'completed');
      if (icon) icon.textContent = '○';
    }
  });
}

function updateButtonStates(): void {
  const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
  const readListBtn = document.getElementById('btn-read-partitions') as HTMLButtonElement;
  const rebootBtn = document.getElementById('reboot-btn') as HTMLButtonElement;

  // Connect enabled when files are loaded but not connected
  if (connectBtn) {
    connectBtn.disabled = !state.programmerData || state.isConnected;
  }

  // Read List enabled when ready
  if (readListBtn) {
    readListBtn.disabled = state.stage < AppStage.READY;
  }

  // Reboot button should always be enabled
  if (rebootBtn) {
    rebootBtn.disabled = false;
  }
}

// ============================================================================
// Utilities
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================================================
// Start Application - Now handled by router, initTool() is exported
// ============================================================================

