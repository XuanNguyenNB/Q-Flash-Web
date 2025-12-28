/**
 * Support Page - Contact and FAQ
 */

export async function renderSupportPage(): Promise<string> {
    return `
        <div class="page support-page">
            <div class="page-header">
                <h1>❓ Support & Contact</h1>
                <p>Get help and connect with the developer</p>
            </div>
            
            <section class="contact-section">
                <h2>📞 Contact</h2>
                <div class="contact-cards">
                    <a href="https://t.me/mitomtreem" target="_blank" class="contact-card telegram">
                        <span class="contact-icon">💬</span>
                        <span class="contact-name">Telegram</span>
                        <span class="contact-handle">@mitomtreem</span>
                    </a>
                    <a href="https://www.facebook.com/xuannguyen030923" target="_blank" class="contact-card facebook">
                        <span class="contact-icon">📘</span>
                        <span class="contact-name">Facebook</span>
                        <span class="contact-handle">Xuan Nguyen</span>
                    </a>
                </div>
            </section>
            
            <section class="faq-section">
                <h2>❓ FAQ</h2>
                <div class="faq-list">
                    <div class="faq-item">
                        <h4>What is EDL mode?</h4>
                        <p>Emergency Download mode - a special boot mode on Qualcomm devices for low-level flashing.</p>
                    </div>
                    <div class="faq-item">
                        <h4>Why WebUSB?</h4>
                        <p>WebUSB allows direct communication with USB devices from the browser - no software installation needed!</p>
                    </div>
                    <div class="faq-item">
                        <h4>Is this safe?</h4>
                        <p>Flashing ROMs carries inherent risks. Always backup your data first. Use at your own risk.</p>
                    </div>
                    <div class="faq-item">
                        <h4>Which browsers are supported?</h4>
                        <p>Chrome 61+ and Microsoft Edge 79+. Firefox and Safari do not support WebUSB.</p>
                    </div>
                    <div class="faq-item">
                        <h4>Can I use this on Mac/Linux?</h4>
                        <p>The WebUSB tool works on any OS with Chrome. QFlashForge is Windows-only.</p>
                    </div>
                </div>
            </section>
            
            <section class="about-section">
                <h2>👨‍💻 About</h2>
                <div class="about-content">
                    <p><strong>Q-Flash</strong> is a universal Qualcomm flashing toolkit created by <strong>Xuan Nguyen</strong>.</p>
                    <p>Originally built for Oppo Find X7 Ultra, now expanding to support all Qualcomm devices.</p>
                    <p class="disclaimer">⚠️ <em>Use at your own risk. Not responsible for bricked devices.</em></p>
                </div>
            </section>
        </div>
    `;
}
