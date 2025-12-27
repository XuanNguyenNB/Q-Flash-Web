/**
 * Oppo Find X7 Ultra WebUSB Unlock Tool
 * 
 * Main entry point - wires up UI, file inputs, and protocol handlers.
 */

import './style.css';
import { Terminal } from './ui/Terminal';
import { WebUSBManager } from './core/WebUSBManager';
import { SaharaProtocol } from './core/SaharaProtocol';
import { OppoVipAuth } from './auth/AuthStrategy';
import { FirehoseProtocol } from './core/FirehoseProtocol';
import { AppStage, EXPECTED_FILE_SIZES } from './types';
import { DEVICE_PRESETS, loadBinaryFile } from './presets';

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

function createAppHTML(): string {
  return `
    <!-- Activity Bar (Left Navigation) -->
    <nav class="activity-bar">
      <div class="activity-bar-top">
        <button class="activity-btn active" data-tab="flash" title="Flash Tool">
          <span class="activity-icon">⚡</span>
        </button>
        <button class="activity-btn" data-tab="downloads" title="Downloads">
          <span class="activity-icon">⬇️</span>
        </button>
        <button class="activity-btn" data-tab="adb" title="ADB Tools">
          <span class="activity-icon">📱</span>
        </button>
      </div>
      <div class="activity-bar-bottom">
        <button class="activity-btn" data-tab="support" title="Support & Donate">
          <span class="activity-icon">❤️</span>
        </button>
      </div>
    </nav>

    <!-- Main App Container -->
    <div class="app-main">
      <header class="header">
        <div class="header-title">
          <h1>Q-Flash Web</h1>
          <span class="badge">v1.0</span>
        </div>
        <div class="header-status" id="device-status">
          <span class="status-dot" id="status-dot"></span>
          <span id="status-text">Disconnected</span>
        </div>
      </header>

      <!-- Tab: Flash (Main Tool) -->
      <div class="tab-content active" id="tab-flash">
        <div class="main-container">
          <aside class="sidebar">
            <!-- Progress Steps -->
            <div class="control-section progress-container">
              <h2>Progress</h2>
              <div class="progress-steps" id="progress-steps">
                <div class="progress-step" data-step="0">
                  <span class="step-icon">○</span>
                  <span>Load Files</span>
                </div>
                <div class="progress-step" data-step="1">
                  <span class="step-icon">○</span>
                  <span>Connect Device</span>
                </div>
                <div class="progress-step" data-step="2">
                  <span class="step-icon">○</span>
                  <span>Sahara Upload</span>
                </div>
                <div class="progress-step" data-step="3">
                  <span class="step-icon">○</span>
                  <span>VIP Handshake</span>
                </div>
                <div class="progress-step" data-step="4">
                  <span class="step-icon">○</span>
                  <span>Configure Firehose</span>
                </div>
                <div class="progress-step" data-step="5">
                  <span class="step-icon">○</span>
                  <span>Ready</span>
                </div>
              </div>
            </div>
            
            <!-- Device Preset Selector -->
            <div class="control-section">
              <h2>Device Preset</h2>
              <div class="preset-selector">
                <select id="preset-select" class="preset-dropdown">
                  <option value="">-- Select Device --</option>
                  <option value="8Gen3">Snapdragon 8 Gen 3 (Find X7 Ultra)</option>
                  <option value="8Gen2">Snapdragon 8 Gen 2 (coming soon)</option>
                </select>
                <button class="btn btn-secondary" id="load-preset-btn" disabled>
                  ⬇️ Load Preset
                </button>
              </div>
              <div class="preset-status" id="preset-status"></div>
            </div>
            
            <!-- File Inputs (Manual) -->
            <div class="control-section">
              <h2>Or Load Files Manually</h2>
              <div class="file-input-group">
                <div class="file-input-wrapper">
                  <input type="file" class="file-input" id="programmer-input" accept=".melf,.elf,.mbn">
                  <label class="file-input-label" id="programmer-label">
                    <span>📦 Programmer (.melf)</span>
                    <span class="icon">📂</span>
                  </label>
                </div>
                <div class="file-input-wrapper">
                  <input type="file" class="file-input" id="digest-input" accept=".elf,.bin">
                  <label class="file-input-label" id="digest-label">
                    <span>🔑 Digest (.elf)</span>
                    <span class="icon">📂</span>
                  </label>
                </div>
                <div class="file-input-wrapper">
                  <input type="file" class="file-input" id="signature-input" accept=".bin">
                  <label class="file-input-label" id="signature-label">
                    <span>✍️ Signature (.bin)</span>
                    <span class="icon">📂</span>
                  </label>
                </div>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="control-section">
              <h2>Actions</h2>
              <button class="btn btn-primary" id="connect-btn" disabled>
                🔌 Connect Device
              </button>
              <button class="btn btn-success" id="start-btn" disabled style="margin-top: 8px;">
                ▶️ Start Unlock Flow
              </button>
              <button class="btn btn-secondary" id="partitions-btn" disabled style="margin-top: 8px;">
                📋 Read Partitions
              </button>
              <button class="btn btn-warning" id="reboot-btn" disabled style="margin-top: 8px;">
                🔄 Reboot Device
              </button>
              <button class="btn btn-danger" id="disconnect-btn" disabled style="margin-top: 8px;">
                ⏏️ Disconnect
              </button>
            </div>
          </aside>
          
          <!-- Partition Table Panel -->
          <div class="partition-panel" id="partition-panel">
            <div class="partition-header">
              <h2>📋 Partition Table</h2>
              <span class="partition-count" id="partition-count">0 partitions</span>
            </div>
            <div class="partition-search">
              <input type="text" id="partition-search" placeholder="🔍 Search partition name..." autocomplete="off" />
            </div>
            <div class="partition-batch-actions" id="partition-batch-actions" style="display: none;">
              <div class="batch-select">
                <label class="checkbox-label">
                  <input type="checkbox" id="select-all-partitions" />
                  <span>Select All</span>
                </label>
                <span class="selected-count" id="selected-count">0 selected</span>
              </div>
              <div class="batch-buttons">
                <label class="checkbox-label">
                  <input type="checkbox" id="generate-xml-option" checked />
                  <span>Generate XML</span>
                </label>
                <button class="btn btn-batch" id="btn-backup-selected" disabled>
                  📥 Backup Selected
                </button>
                <span class="flash-file-count" id="flash-file-count">0 files</span>
                <button class="btn btn-batch btn-flash" id="btn-flash-selected" disabled>
                  ⚡ Flash Selected
                </button>
                <button class="btn btn-batch btn-xml-flash" id="btn-flash-xml">
                  📄 Flash from XML
                </button>
              </div>
            </div>
            <div class="partition-table-container" id="partition-table">
              <div class="partition-empty">
                <span>No partitions loaded</span>
                <span class="hint">Click "Read Partitions" after device is ready</span>
              </div>
            </div>
          </div>
          
          <!-- Terminal Log -->
          <div class="terminal-container">
            <div class="terminal-header">
              <h2>📜 Log</h2>
            </div>
            <div class="terminal" id="terminal"></div>
          </div>
        </div>
      </div>

      <!-- Tab: Downloads -->
      <div class="tab-content" id="tab-downloads">
        <div class="tab-page">
          <h2 class="tab-page-title">⬇️ Downloads</h2>
          <p class="tab-page-desc">Essential drivers and tools for Qualcomm device flashing.</p>
          <div class="download-grid">
            <div class="download-card">
              <div class="download-icon">🔧</div>
              <h3>Qualcomm 9008 Driver</h3>
              <p>WinUSB driver via Zadig for EDL mode</p>
              <a href="https://zadig.akeo.ie/" target="_blank" class="btn btn-primary">Download Zadig</a>
            </div>
            <div class="download-card">
              <div class="download-icon">📦</div>
              <h3>ADB & Fastboot</h3>
              <p>Google Platform Tools</p>
              <a href="https://developer.android.com/tools/releases/platform-tools" target="_blank" class="btn btn-primary">Download</a>
            </div>
            <div class="download-card">
              <div class="download-icon">🔥</div>
              <h3>Q-Flash Forge</h3>
              <p>Desktop companion tool for ROM conversion</p>
              <a href="https://github.com/XuanNguyenNB/Q-Flash-Web" target="_blank" class="btn btn-primary">GitHub</a>
            </div>
            <div class="download-card">
              <div class="download-icon">📋</div>
              <h3>QFIL / QPST</h3>
              <p>Official Qualcomm Flash Tools</p>
              <a href="#" class="btn btn-secondary">Coming Soon</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: ADB Tools -->
      <div class="tab-content" id="tab-adb">
        <div class="tab-page">
          <h2 class="tab-page-title">📱 ADB & Fastboot Commands</h2>
          <p class="tab-page-desc">Copy these commands and run in your terminal (CMD/PowerShell).</p>
          <div class="adb-commands">
            <div class="command-card">
              <h3>Reboot to EDL Mode</h3>
              <p>Enter Emergency Download (9008) mode</p>
              <div class="command-box">
                <code>adb reboot edl</code>
                <button class="btn-copy" data-cmd="adb reboot edl">📋 Copy</button>
              </div>
            </div>
            <div class="command-card">
              <h3>Reboot to Bootloader</h3>
              <p>Enter Fastboot mode</p>
              <div class="command-box">
                <code>adb reboot bootloader</code>
                <button class="btn-copy" data-cmd="adb reboot bootloader">📋 Copy</button>
              </div>
            </div>
            <div class="command-card">
              <h3>Fastboot Reboot</h3>
              <p>Normal reboot from Fastboot</p>
              <div class="command-box">
                <code>fastboot reboot</code>
                <button class="btn-copy" data-cmd="fastboot reboot">📋 Copy</button>
              </div>
            </div>
            <div class="command-card">
              <h3>Fastboot to FastbootD</h3>
              <p>Enter userspace Fastboot</p>
              <div class="command-box">
                <code>fastboot reboot fastboot</code>
                <button class="btn-copy" data-cmd="fastboot reboot fastboot">📋 Copy</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Support & Donate -->
      <div class="tab-content" id="tab-support">
        <div class="tab-page support-page">
          <h2 class="tab-page-title">❤️ Support & Donate</h2>
          <p class="tab-page-desc">If this tool helped you, consider supporting the development!</p>
          
          <div class="support-grid">
            <div class="support-card author-card">
              <h3>👨‍💻 Author</h3>
              <div class="author-info">
                <span class="author-name">XuanNguyen</span>
                <a href="https://t.me/mitomtreem" target="_blank" class="author-link">@mitomtreem</a>
              </div>
            </div>
            
            <div class="support-card">
              <h3>💬 Community</h3>
              <a href="https://t.me/qflashweb" target="_blank" class="btn btn-primary" style="width: 100%;">
                Join Telegram Group
              </a>
            </div>
            
            <div class="support-card donate-card">
              <h3>💰 Donate</h3>
              <div class="donate-options">
                <div class="donate-item">
                  <span class="donate-label">Momo</span>
                  <span class="donate-value">Scan QR (coming soon)</span>
                </div>
                <div class="donate-item">
                  <span class="donate-label">Binance ID</span>
                  <span class="donate-value" style="color: var(--accent-yellow); font-family: var(--font-mono);">381766288</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="support-footer">
            <p>⭐ Star us on <a href="https://github.com/XuanNguyenNB/Q-Flash-Web" target="_blank">GitHub</a></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// Initialization
// ============================================================================

function init(): void {
  // Render HTML
  const app = document.getElementById('app');
  if (!app) {
    console.error('App container not found');
    return;
  }
  app.innerHTML = createAppHTML();

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
  terminal.info('Q-Flash Web initialized');
  terminal.info('Load the required files to begin');
  terminal.separator();

  // Set up event listeners
  setupEventListeners();

  // Check for HTTPS requirement
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    terminal.warning('WebUSB requires HTTPS. Some features may not work.');
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners(): void {
  // File inputs
  document.getElementById('programmer-input')?.addEventListener('change', (e) => handleFileInput(e, 'programmer'));
  document.getElementById('digest-input')?.addEventListener('change', (e) => handleFileInput(e, 'digest'));
  document.getElementById('signature-input')?.addEventListener('change', (e) => handleFileInput(e, 'signature'));

  // Preset selector
  document.getElementById('preset-select')?.addEventListener('change', handlePresetChange);
  document.getElementById('load-preset-btn')?.addEventListener('click', handleLoadPreset);

  // Buttons
  document.getElementById('connect-btn')?.addEventListener('click', handleConnect);
  document.getElementById('start-btn')?.addEventListener('click', handleStartUnlockFlow);
  document.getElementById('partitions-btn')?.addEventListener('click', handleReadPartitions);
  document.getElementById('reboot-btn')?.addEventListener('click', handleRebootDevice);
  document.getElementById('disconnect-btn')?.addEventListener('click', handleDisconnect);

  // Activity Bar - Tab switching
  document.querySelectorAll('.activity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (!tabId) return;

      // Update active button
      document.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show corresponding tab
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
      const targetTab = document.getElementById(`tab-${tabId}`);
      if (targetTab) targetTab.classList.add('active');
    });
  });

  // ADB Copy buttons
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      if (!cmd) return;

      navigator.clipboard.writeText(cmd).then(() => {
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '📋 Copy';
          btn.classList.remove('copied');
        }, 2000);
      }).catch(() => {
        btn.textContent = '❌ Failed';
        setTimeout(() => {
          btn.textContent = '📋 Copy';
        }, 2000);
      });
    });
  });
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

/**
 * Handle preset dropdown change
 */
function handlePresetChange(): void {
  const select = document.getElementById('preset-select') as HTMLSelectElement;
  const loadBtn = document.getElementById('load-preset-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('preset-status');

  const preset = DEVICE_PRESETS[select.value];

  if (preset && preset.available) {
    loadBtn.disabled = false;
    if (statusEl) statusEl.textContent = '';
  } else if (preset && !preset.available) {
    loadBtn.disabled = true;
    if (statusEl) {
      statusEl.textContent = '⚠️ This preset is not available yet';
      statusEl.style.color = 'var(--accent-yellow)';
    }
  } else {
    loadBtn.disabled = true;
    if (statusEl) statusEl.textContent = '';
  }
}

/**
 * Load preset files from server
 */
async function handleLoadPreset(): Promise<void> {
  const select = document.getElementById('preset-select') as HTMLSelectElement;
  const loadBtn = document.getElementById('load-preset-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('preset-status');

  const presetId = select.value;
  const preset = DEVICE_PRESETS[presetId];

  if (!presetId || !preset?.available || !preset.files) {
    terminal.error('Please select a valid device preset');
    return;
  }

  loadBtn.disabled = true;
  if (statusEl) {
    statusEl.textContent = '⏳ Loading files...';
    statusEl.style.color = 'var(--accent-blue)';
  }

  terminal.separator();
  terminal.info(`📥 Loading preset: ${preset.name}`);

  try {
    // Load files using XMLHttpRequest to avoid IDM interception
    // Programmer
    terminal.info('Loading programmer...');
    const programmerData = await loadBinaryFile(preset.files.programmer);
    state.programmerData = programmerData;
    terminal.success(`✓ Programmer: ${formatBytes(programmerData.length)}`);
    updateFileLabel('programmer-label', 'programmer.melf', true);

    // Digest
    terminal.info('Loading digest...');
    const digestData = await loadBinaryFile(preset.files.digest);
    state.digestData = digestData;
    terminal.success(`✓ Digest: ${formatBytes(digestData.length)}`);
    updateFileLabel('digest-label', 'digest.elf', true);

    // Signature
    terminal.info('Loading signature...');
    const signatureData = await loadBinaryFile(preset.files.signature);
    state.signatureData = signatureData;
    terminal.success(`✓ Signature: ${formatBytes(signatureData.length)}`);
    updateFileLabel('signature-label', 'signature.bin', true);

    // Update UI
    if (statusEl) {
      statusEl.textContent = '✅ All files loaded!';
      statusEl.style.color = 'var(--accent-green)';
    }

    terminal.success(`✅ Preset loaded successfully!`);
    terminal.info('You can now connect to device.');

    // Enable connect button
    updateButtonStates();

  } catch (error) {
    terminal.error(`Failed to load preset: ${error}`);
    if (statusEl) {
      statusEl.textContent = '❌ Failed to load files';
      statusEl.style.color = 'var(--accent-red)';
    }
  } finally {
    loadBtn.disabled = false;
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
  const batchActionsEl = document.getElementById('partition-batch-actions');

  if (!container) return;

  // Store partitions for later use
  (window as any).__partitions = partitions;

  // Initialize selected partitions set if not exists
  if (!(window as any).__selectedPartitions) {
    (window as any).__selectedPartitions = new Set<number>();
  }
  const selectedPartitions = (window as any).__selectedPartitions as Set<number>;

  // Show batch actions bar when partitions are loaded
  if (batchActionsEl && partitions.length > 0) {
    batchActionsEl.style.display = 'flex';
  }

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

  // Set up batch action handlers (only once)
  setupBatchHandlers();

  // Build HTML table with checkboxes
  let html = `
    <table class="partition-table">
      <thead>
        <tr>
          <th class="checkbox-col"></th>
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

  // Select All handler
  if (selectAllCheckbox && !(selectAllCheckbox as any).__hasHandler) {
    (selectAllCheckbox as any).__hasHandler = true;
    selectAllCheckbox.addEventListener('change', () => {
      const partitions = (window as any).__partitions as import('./types').PartitionInfo[];
      const selectedPartitions = (window as any).__selectedPartitions as Set<number>;

      if (selectAllCheckbox.checked) {
        // Select all
        partitions.forEach((_, i) => selectedPartitions.add(i));
      } else {
        // Deselect all
        selectedPartitions.clear();
      }

      // Update all checkboxes
      document.querySelectorAll('.partition-checkbox').forEach((cb) => {
        const checkbox = cb as HTMLInputElement;
        const index = parseInt(checkbox.dataset.index || '0', 10);
        checkbox.checked = selectedPartitions.has(index);
        updateRowHighlight(index, checkbox.checked);
      });

      updateSelectedCount();
    });
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

// LUN5 partitions (usually calibration data)
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
        !isFirstWrite  // skipConfigure = true for all except first
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
      entries.push({
        label: prog.getAttribute('label') || '',
        filename: filename,
        startSector: BigInt(startSectorStr),
        numSectors: parseInt(numSectorsStr, 10),
        lun: parseInt(prog.getAttribute('physical_partition_number') || '0', 10),
        sectorSize: parseInt(prog.getAttribute('SECTOR_SIZE_IN_BYTES') || '4096', 10),
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

  // Step 7: Execute flash
  terminal.separator();
  terminal.info(`🔥 Starting XML batch flash (${selectedFilesToFlash.length} partition(s))...`);

  let successCount = 0;
  let failCount = 0;
  let isFirstWrite = true;

  for (const { entry, file } of selectedFilesToFlash) {
    terminal.info(`Flashing "${entry.label}"...`);

    try {
      let result: { success: boolean; bytesWritten: number; error?: string };

      // Use streaming for large files (>500MB) to avoid memory issues
      if (file.size > 500 * 1024 * 1024) {
        terminal.debug(`Using streaming for large file (${formatBytes(file.size)})`);
        result = await firehose.writePartitionFromFile(
          entry.lun,
          entry.startSector,
          BigInt(entry.numSectors),
          entry.label,
          file,
          (percent) => {
            if (percent % 10 === 0) terminal.debug(`${entry.label}: ${percent}%`);
          }
        );
      } else {
        // Load smaller files into memory
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        result = await firehose.writePartition(
          entry.lun,
          entry.startSector,
          BigInt(entry.numSectors),
          entry.label,
          data,
          (percent) => {
            if (percent === 100) terminal.debug(`${entry.label}: 100%`);
          },
          !isFirstWrite
        );
      }

      isFirstWrite = false;

      if (result.success) {
        terminal.success(`✅ ${entry.label} flashed (${formatBytes(result.bytesWritten)})`);
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
    terminal.info(`Found ${patchFiles.length} patch file(s): ${patchFiles.map(p => p.name).join(', ')}`);

    // Reconfigure before applying patches (like native tool does)
    await firehose.configure();

    let patchSuccess = 0;
    let patchFail = 0;

    for (const patchFile of patchFiles) {
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
      terminal.success(`All ${patchSuccess} patch file(s) applied successfully`);
    }
  }

  // Step 9: Set bootable drive
  terminal.info('Setting bootable drive...');
  const bootResult = await firehose.setBootableDrive(1);
  if (!bootResult.success) {
    terminal.warning(`Failed to set bootable drive: ${bootResult.error}`);
  }

  // Step 10: Optional reboot
  terminal.separator();
  terminal.success('🎉 Flash complete! Device is ready.');
  terminal.info('Click "Reboot" button to restart device, or disconnect USB.');
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
 * Handle batch backup of selected partitions
 */
async function handleBatchBackup(): Promise<void> {
  if (!firehose) {
    terminal.error('Firehose not initialized.');
    return;
  }

  const partitions = (window as any).__partitions as import('./types').PartitionInfo[];
  const selectedPartitions = (window as any).__selectedPartitions as Set<number>;
  const generateXml = (document.getElementById('generate-xml-option') as HTMLInputElement)?.checked ?? true;

  if (!selectedPartitions || selectedPartitions.size === 0) {
    terminal.error('No partitions selected');
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

  for (const { index, partition } of partitionsToBackup) {
    const lun = (partition as any).lun ?? 0;
    const numSectors = partition.sizeInSectors;
    const sizeBytes = Number(numSectors) * 4096;
    const filename = `${partition.name}.img`;

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
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  const partitionsBtn = document.getElementById('partitions-btn') as HTMLButtonElement;
  const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;

  // Connect enabled when files are loaded but not connected
  if (connectBtn) {
    connectBtn.disabled = !state.programmerData || state.isConnected;
  }

  // Start enabled when connected and all files loaded, AND not currently running
  if (startBtn) {
    // Only enable if we are IDLE/CONNECTING (not running) and not yet READY
    const isRunning = state.stage > AppStage.CONNECTING && state.stage < AppStage.READY;
    startBtn.disabled = !state.isConnected || !state.programmerData || !state.digestData || !state.signatureData || isRunning || state.stage === AppStage.READY;
  }

  // Partitions enabled when ready
  if (partitionsBtn) {
    partitionsBtn.disabled = state.stage < AppStage.READY;
  }

  // Reboot enabled when ready
  const rebootBtn = document.getElementById('reboot-btn') as HTMLButtonElement;
  if (rebootBtn) {
    rebootBtn.disabled = state.stage < AppStage.READY;
  }

  // Disconnect enabled when connected
  if (disconnectBtn) {
    disconnectBtn.disabled = !state.isConnected;
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
// Start Application
// ============================================================================

document.addEventListener('DOMContentLoaded', init);
