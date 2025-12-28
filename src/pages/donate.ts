/**
 * Donate Page - Support the developer
 */

export async function renderDonatePage(): Promise<string> {
    return `
        <div class="page donate-page">
            <div class="page-header">
                <h1>☕ Support the Project</h1>
                <p>If Q-Flash has helped you, consider buying me a coffee!</p>
            </div>
            
            <section class="donate-section">
                <div class="donate-card momo-card">
                    <div class="donate-icon">💳</div>
                    <h2>MoMo</h2>
                    <p>Scan QR code to donate via MoMo</p>
                    <div class="qr-container">
                        <img src="/momo_qr.jpg" alt="MoMo QR Code" class="qr-image" />
                    </div>
                    <p class="donate-note">Thank you for your support! 🙏</p>
                </div>
            </section>
            
            <section class="thank-you-section">
                <h2>🎉 Thank You!</h2>
                <p>Your donations help cover:</p>
                <ul class="donation-uses">
                    <li>☕ Coffee to fuel late-night coding sessions</li>
                    <li>🖥️ VPS hosting costs</li>
                    <li>📱 Test devices for compatibility</li>
                    <li>⏰ Time spent on development</li>
                </ul>
            </section>
        </div>
    `;
}
