/**
 * AI Chat Panel Component
 * Integrates with CLI Proxy API (OpenAI-compatible) for AI assistance
 */

import { t } from '../i18n/i18n';

// Hardcoded API Configuration - No user settings needed
const AI_CONFIG = {
    apiUrl: 'http://34.177.106.101:8317/v1/chat/completions',
    apiKey: 'mitomtreem',
    model: 'gemini-3-flash-preview',
};

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
}

// Store messages in memory
let chatMessages: ChatMessage[] = [];
let isStreaming = false;

/**
 * Render the AI Chat Panel HTML
 */
export function renderAiChatPanel(): string {
    return `
    <div class="ai-chat-panel">
      <div class="ai-chat-header">
        <h3>🤖 ${t('aiPanel.title')}</h3>
      </div>
      <div class="ai-chat-messages" id="ai-chat-messages">
        <div class="ai-welcome-message">
          <span class="ai-icon">🤖</span>
          <p>${t('aiPanel.welcome')}</p>
        </div>
      </div>
      <div class="ai-chat-input-container">
        <textarea 
          class="ai-chat-input" 
          id="ai-chat-input" 
          placeholder="${t('aiPanel.placeholder')}"
          rows="2"
        ></textarea>
        <button class="btn-ai-send" id="btn-ai-send" title="${t('aiPanel.send')}">
          ➤
        </button>
      </div>
    </div>
  `;
}

/**
 * Initialize AI Chat panel event handlers
 */
export function initAiChat(): void {
    const sendBtn = document.getElementById('btn-ai-send');
    const inputEl = document.getElementById('ai-chat-input') as HTMLTextAreaElement;

    // Send button handler
    sendBtn?.addEventListener('click', handleSendMessage);

    // Enter key handler (Shift+Enter for newline)
    inputEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Restore previous messages if any
    restoreChatHistory();
}

/**
 * Handle sending a message to the AI
 */
async function handleSendMessage(): Promise<void> {
    const inputEl = document.getElementById('ai-chat-input') as HTMLTextAreaElement;
    const message = inputEl?.value.trim();

    if (!message || isStreaming) return;

    // Clear input
    inputEl.value = '';

    // Add user message
    addMessage({ role: 'user', content: message, timestamp: new Date() });

    // Check if API is configured
    if (!AI_CONFIG.apiUrl) {
        addMessage({
            role: 'assistant',
            content: t('aiPanel.configureApi'),
            timestamp: new Date()
        });
        return;
    }

    // Send to AI
    isStreaming = true;
    updateSendButtonState(true);

    // Show typing indicator
    const typingIndicator = addTypingIndicator();

    try {
        const response = await fetchAiResponse(message);

        // Remove typing indicator
        removeTypingIndicator(typingIndicator);

        // Add message with typing effect
        await addMessageWithTypingEffect({ role: 'assistant', content: response, timestamp: new Date() });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        // Remove typing indicator
        removeTypingIndicator(typingIndicator);

        addMessage({
            role: 'assistant',
            content: `❌ ${t('aiPanel.error')}: ${errorMsg}`,
            timestamp: new Date()
        });
    } finally {
        isStreaming = false;
        updateSendButtonState(false);
    }
}

/**
 * Fetch response from CLI Proxy API
 */
async function fetchAiResponse(userMessage: string): Promise<string> {
    // Build messages array with context
    const systemPrompt = `Bạn là trợ lý AI kỹ thuật chuyên sâu cho **Q-Flash WebUSB Tool**.
Nhiệm vụ của bạn là hỗ trợ người dùng thực hiện các tác vụ nạp firmware (flash), sao lưu (backup), và khôi phục (unbrick) cho các thiết bị sử dụng chịp Qualcomm, đặc biệt là **Oppo, OnePlus, Realme**.

**Kiến thức chuyên môn của bạn bao gồm:**
1.  **Chế độ EDL (Emergency Download Mode - 9008):** Cách vào chế độ này, driver WinUSB, lỗi driver.
2.  **Giao thức Firehose & Sahara:** Hiểu về quá trình bắt tay (handshake), load programmer (prog_firehose_ddr.elf), VIP handshake của Oppo.
3.  **Cấu trúc phân vùng (Partitioning):**
    - Hiểu về GPT (GUID Partition Table).
    - Các phân vùng quan trọng: \`userdata\`, \`super\`, \`boot\`, \`recovery\`, \`vbmeta\`, \`modem\`, \`persist\`.
    - Cảnh báo về các phân vùng nhạy cảm (như \`lun5\` chứa thông tin IMEI/kalibration).
4.  **Sử dụng Q-Flash Tool:**
    - Cách kết nối thiết bị WebUSB.
    - Cách chọn file thủ công (Programmer, Digest, Signature).
    - Quy trình flash: Read Partition List -> Select Partitions -> Flash.

**Nguyên tắc phản hồi:**
- **NGÔN NGỮ: LUÔN LUÔN TRẢ LỜI BẰNG TIẾNG VIỆT.**
- **Phong cách:** Chuyên nghiệp, ngắn gọn, đi thẳng vào vấn đề kỹ thuật.
- **An toàn:** Luôn cảnh báo người dùng backup dữ liệu trước khi flash. Cảnh báo rủi ro brick máy khi can thiệp vào các phân vùng hệ thống.
- **Hỗ trợ lỗi:** Nếu người dùng gặp lỗi (ví dụ: "Bulk OUT transfer timeout", "Sahara Fail"), hãy phân tích nguyên nhân và đưa ra giải pháp cụ thể (đổi cáp, cài lại driver, giữ phím cứng...).`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
    ];

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Add API key if configured
    if (AI_CONFIG.apiKey) {
        headers['Authorization'] = `Bearer ${AI_CONFIG.apiKey}`;
    }

    const response = await fetch(AI_CONFIG.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: AI_CONFIG.model,
            messages,
            max_tokens: 1024,
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || t('aiPanel.noResponse');
}

/**
 * Add a message to the chat UI
 */
function addMessage(msg: ChatMessage): void {
    chatMessages.push(msg);

    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return;

    // Remove welcome message if exists
    const welcomeMsg = messagesContainer.querySelector('.ai-welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    // Create message element
    const msgEl = document.createElement('div');
    msgEl.className = `ai-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`;

    // Format content with markdown-like rendering
    const formattedContent = formatMessageContent(msg.content);

    msgEl.innerHTML = `
    <div class="message-content">${formattedContent}</div>
    <div class="message-time">${msg.timestamp ? formatTime(msg.timestamp) : ''}</div>
  `;

    messagesContainer.appendChild(msgEl);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Format message content (basic markdown)
 */
function formatMessageContent(content: string): string {
    // Escape HTML
    let formatted = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks ```...```
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code `...`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold **...**
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

/**
 * Format timestamp
 */
function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Add typing indicator
 */
function addTypingIndicator(): HTMLElement {
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return document.createElement('div');

    const typingEl = document.createElement('div');
    typingEl.className = 'ai-message assistant-message typing-indicator';
    typingEl.id = 'ai-typing-indicator';
    typingEl.innerHTML = `
        <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    messagesContainer.appendChild(typingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return typingEl;
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator(indicator: HTMLElement): void {
    indicator?.remove();
}

/**
 * Add message with typing effect (character by character)
 */
async function addMessageWithTypingEffect(msg: ChatMessage): Promise<void> {
    chatMessages.push(msg);

    const messagesContainer = document.getElementById('ai-chat-messages');
    if (!messagesContainer) return;

    // Remove welcome message if exists
    const welcomeMsg = messagesContainer.querySelector('.ai-welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    // Create message element
    const msgEl = document.createElement('div');
    msgEl.className = `ai-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = msg.timestamp ? formatTime(msg.timestamp) : '';

    msgEl.appendChild(contentDiv);
    msgEl.appendChild(timeDiv);
    messagesContainer.appendChild(msgEl);

    // Typing effect - add characters one by one
    const formattedContent = formatMessageContent(msg.content);
    let currentIndex = 0;
    const typingSpeed = 15; // milliseconds per character

    // Strip HTML tags for character counting (approximate)
    const textContent = msg.content;

    return new Promise<void>((resolve) => {
        const typeInterval = setInterval(() => {
            if (currentIndex <= textContent.length) {
                // Update content with substring and format
                const substring = textContent.substring(0, currentIndex);
                contentDiv.innerHTML = formatMessageContent(substring);
                currentIndex++;

                // Auto scroll
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                clearInterval(typeInterval);
                // Final formatting
                contentDiv.innerHTML = formattedContent;
                resolve();
            }
        }, typingSpeed);
    });
}

/**
 * Update send button state
 */
function updateSendButtonState(loading: boolean): void {
    const sendBtn = document.getElementById('btn-ai-send');
    if (sendBtn) {
        sendBtn.textContent = loading ? '⏳' : '➤';
        (sendBtn as HTMLButtonElement).disabled = loading;
    }
}

/**
 * Restore chat history from session
 */
function restoreChatHistory(): void {
    // Could persist to localStorage if needed
    // For now, just show welcome message on fresh load
}
