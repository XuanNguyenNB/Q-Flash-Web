/**
 * Drivers Page - Driver installation guides and downloads
 */

export async function renderDriversPage(): Promise<string> {
    return `
        <div class="page drivers-page">
            <div class="page-header">
                <h1>🔧 Drivers & Tools</h1>
                <p>Essential drivers for EDL mode and flashing</p>
            </div>
            
            <section class="driver-section">
                <h2>📱 Qualcomm 9008 USB Driver</h2>
                <div class="driver-card">
                    <div class="driver-info">
                        <p>Required for WebUSB to communicate with device in EDL mode.</p>
                        <p class="driver-note">⚠️ Must use <strong>WinUSB</strong> via Zadig, NOT Qualcomm's official driver.</p>
                    </div>
                    <div class="driver-steps">
                        <h3>Installation Steps:</h3>
                        <ol>
                            <li>Download <a href="https://zadig.akeo.ie/" target="_blank">Zadig</a></li>
                            <li>Put device in EDL mode (9008)</li>
                            <li>Open Zadig → Options → List All Devices</li>
                            <li>Select "QHSUSB_BULK" or "Qualcomm HS-USB..."</li>
                            <li>Select <strong>WinUSB</strong> as target driver</li>
                            <li>Click "Replace Driver" or "Install Driver"</li>
                        </ol>
                    </div>
                    <div class="driver-actions">
                        <a href="https://zadig.akeo.ie/" target="_blank" class="btn btn-primary">
                            ⬇️ Download Zadig
                        </a>
                    </div>
                </div>
            </section>
            
            <section class="driver-section">
                <h2>🔌 Kedacom USB Driver</h2>
                <div class="driver-card">
                    <div class="driver-info">
                        <p>Alternative driver for some Oppo/OnePlus/Realme devices.</p>
                        <p>Only needed if Zadig doesn't work.</p>
                    </div>
                    <div class="driver-actions">
                        <button class="btn btn-secondary" disabled>
                            Coming Soon
                        </button>
                    </div>
                </div>
            </section>
            
            <section class="driver-section">
                <h2>❓ Troubleshooting</h2>
                <div class="faq-list">
                    <div class="faq-item">
                        <h4>Device not detected in Zadig?</h4>
                        <p>Make sure device is in EDL mode. Try different USB ports/cables.</p>
                    </div>
                    <div class="faq-item">
                        <h4>"Access Denied" in Chrome?</h4>
                        <p>Close any other apps that might be using the device (QFIL, MiFlash, etc).</p>
                    </div>
                    <div class="faq-item">
                        <h4>How to enter EDL mode?</h4>
                        <p>Hold Vol+/Vol- while connecting USB, or use ADB: <code>adb reboot edl</code></p>
                    </div>
                </div>
            </section>
        </div>
    `;
}
