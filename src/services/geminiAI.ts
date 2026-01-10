/**
 * Gemini AI Service
 *
 * Service để gọi Gemini API cho AI Assistant
 * Hỗ trợ cả proxy server (ưu tiên) và direct Gemini API (fallback)
 */

import type { Workflow, WorkflowStep } from '@/types/workflow';

/**
 * AI Config from environment
 */
interface AIConfig {
  proxyUrl: string | undefined;
  proxyApiKey: string | undefined;
  model: string;
  directApiKey: string | undefined;
}

/**
 * Get AI configuration from environment variables
 */
function getAIConfig(): AIConfig {
  return {
    proxyUrl: import.meta.env.VITE_AI_PROXY_URL,
    proxyApiKey: import.meta.env.VITE_AI_PROXY_API_KEY,
    model: import.meta.env.VITE_AI_MODEL || 'gemini-2.5-flash',
    directApiKey: import.meta.env.VITE_GEMINI_API_KEY,
  };
}

/**
 * Check if proxy server is configured
 */
function isProxyConfigured(config: AIConfig): boolean {
  return !!(config.proxyUrl && config.proxyApiKey);
}

/**
 * Proxy API response interface (OpenAI-compatible format)
 */
interface ProxyResponse {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * Gemini API response interface (Direct Gemini format)
 */
interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

/**
 * Build context for the AI based on current workflow state
 */
function buildContext(
  workflow: Workflow | null,
  currentStep: WorkflowStep | null,
  previousMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  additionalContext?: string
): string {
  let context = `Bạn là AI Assistant cho ứng dụng Q-Flash-Web, một công cụ giúp người dùng Việt Nam thiết lập điện thoại Android xách tay từ Trung Quốc (Honor, Oppo, Realme, LG).

NHIỆM VỤ CỦA BẠN:
- Hỗ trợ người dùng thực hiện các quy trình tự động hóa (workflow) trên điện thoại
- Giải thích các bước trong workflow một cách dễ hiểu
- Trả lời câu hỏi về ADB commands, gỡ ứng dụng, cài Google Services
- Hướng dẫn người dùng khi họ gặp khó khăn
- Tra cứu web khi cần thiết để cung cấp thông tin chính xác

QUY TẮC:
- Trả lời bằng tiếng Việt
- Giữ câu trả lời ngắn gọn, dễ hiểu
- Không sử dụng thuật ngữ kỹ thuật phức tạp trừ khi cần thiết
- Luôn khuyến khích và hỗ trợ người dùng
- Nếu được hỏi về bước hiện tại, hãy giải thích chi tiết từng sub-step
`;

  // Add additional context (device info, etc.)
  if (additionalContext) {
    context += `\n${additionalContext}\n`;
  }

  if (workflow) {
    context += `\n--- WORKFLOW HIỆN TẠI ---
Tên: ${workflow.nameVi}
Mô tả: ${workflow.descriptionVi}
Danh mục: ${workflow.category}
Độ khó: ${workflow.difficulty}
Số bước: ${workflow.steps.length}
`;

    if (currentStep) {
      const stepIndex = workflow.steps.findIndex(s => s.id === currentStep.id);
      context += `\n--- BƯỚC HIỆN TẠI (${stepIndex + 1}/${workflow.steps.length}) ---
Loại: ${currentStep.type}
Tiêu đề: ${currentStep.titleVi || currentStep.title}
`;

      if (currentStep.descriptionVi) {
        context += `Mô tả: ${currentStep.descriptionVi}\n`;
      }

      if (currentStep.command) {
        context += `Lệnh ADB: ${currentStep.command}\n`;
      }

      if (currentStep.packages && currentStep.packages.length > 0) {
        context += `Gói tin: ${currentStep.packages.slice(0, 5).join(', ')}${currentStep.packages.length > 5 ? '...' : ''}\n`;
      }

      if (currentStep.userPromptVi) {
        context += `Hướng dẫn cho người dùng: ${currentStep.userPromptVi}\n`;
      }

      // Add sub-steps for guided-action
      if (currentStep.type === 'guided-action' && currentStep.subSteps) {
        context += `\nCác bước chi tiết:\n`;
        currentStep.subSteps.forEach((subStep, idx) => {
          context += `${idx + 1}. ${subStep.instruction}\n`;
          if (subStep.alternativeInstructions) {
            context += `   (Hoặc: ${subStep.alternativeInstructions.join(' / ')})\n`;
          }
        });
      }

      // Add AI context hint if available
      if (currentStep.aiContext) {
        context += `\nLưu ý: ${currentStep.aiContext}\n`;
      }
    }
  }

  // Add recent conversation context
  if (previousMessages.length > 0) {
    context += '\n--- HỘI THOẠI GẦN ĐÂY ---\n';
    const recentMessages = previousMessages.slice(-6); // Last 6 messages for context
    recentMessages.forEach(msg => {
      const role = msg.role === 'user' ? 'Người dùng' : msg.role === 'assistant' ? 'AI' : 'Hệ thống';
      context += `${role}: ${msg.content}\n`;
    });
  }

  return context;
}

/**
 * Build messages for OpenAI-compatible API (proxy server)
 */
function buildProxyMessages(
  context: string,
  message: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return [
    {
      role: 'system',
      content: context,
    },
    {
      role: 'user',
      content: `${message}\n\n(Trả lời ngắn gọn, dễ hiểu, bằng tiếng Việt)`,
    },
  ];
}

/**
 * Call proxy server API (OpenAI-compatible format)
 */
async function callProxyAPI(
  config: AIConfig,
  context: string,
  message: string
): Promise<string> {
  const messages = buildProxyMessages(context, message);

  // Build endpoint URL - append /completions if not already present
  let endpoint = config.proxyUrl!;
  if (!endpoint.endsWith('/completions')) {
    endpoint = endpoint.replace(/\/?$/, '/completions');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.proxyApiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Proxy API error:', errorData);
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const data: ProxyResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('No response from AI');
  }

  return text.trim();
}

/**
 * Call direct Gemini API (fallback)
 */
async function callDirectGeminiAPI(
  apiKey: string,
  context: string,
  message: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${context}\n\n--- CÂU HỎI CỦA NGƯỜI DÙNG ---\n${message}\n\n--- TRẢ LỜI (ngắn gọn, dễ hiểu, tiếng Việt) ---`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
          topP: 0.9,
          topK: 40,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE',
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Gemini API error:', errorData);
    throw new Error(errorData.error?.message || `HTTP ${response.status}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No response from AI');
  }

  return text.trim();
}

/**
 * Call Gemini API (uses proxy if configured, falls back to direct API)
 */
export async function callGeminiAPI(
  message: string,
  workflow: Workflow | null,
  currentStep: WorkflowStep | null,
  previousMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  additionalContext?: string,
  _apiKey?: string // Deprecated: use environment variables instead
): Promise<string> {
  const config = getAIConfig();

  // Check if any API is configured
  if (!isProxyConfigured(config) && !config.directApiKey) {
    return `Xin lỗi, AI Assistant chưa được cấu hình. Vui lòng liên hệ quản trị viên.`;
  }

  const context = buildContext(workflow, currentStep, previousMessages, additionalContext);

  try {
    // Priority 1: Use proxy server if configured
    if (isProxyConfigured(config)) {
      return await callProxyAPI(config, context, message);
    }

    // Priority 2: Fall back to direct Gemini API
    if (config.directApiKey) {
      return await callDirectGeminiAPI(config.directApiKey, context, message);
    }

    throw new Error('No API configured');
  } catch (error) {
    console.error('AI API call failed:', error);

    // Provide helpful fallback response
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('403')) {
        return 'API key không hợp lệ. Vui lòng kiểm tra lại cấu hình.';
      }
      if (error.message.includes('quota') || error.message.includes('limit') || error.message.includes('429')) {
        return 'Đã vượt quá giới hạn API. Vui lòng thử lại sau.';
      }
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return 'Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra kết nối mạng.';
      }
    }

    return 'Xin lỗi, AI Assistant tạm thời không khả dụng. Vui lòng thử lại sau.';
  }
}

/**
 * Generate smart suggestions based on context
 */
export function generateSmartSuggestions(
  workflow: Workflow | null,
  currentStep: WorkflowStep | null
): string[] {
  const suggestions: string[] = [];

  if (!workflow) {
    return [
      'Làm thế nào để chọn workflow phù hợp?',
      'Workflow nào an toàn nhất cho người mới?',
      'Tôi có thể hoàn tác không?',
    ];
  }

  if (currentStep) {
    switch (currentStep.type) {
      case 'uninstall-packages':
        suggestions.push('App nào có thể xóa an toàn?');
        suggestions.push('Xóa app có mất dữ liệu không?');
        suggestions.push('Có thể cài lại app đã xóa không?');
        break;

      case 'install-apk':
        suggestions.push('Nguồn APK có an toàn không?');
        suggestions.push('Cài đặt có cần root không?');
        suggestions.push('Lỗi "App not installed" là gì?');
        break;

      case 'user-action':
        suggestions.push('Hướng dẫn chi tiết hơn');
        suggestions.push('Tôi không tìm thấy menu này');
        suggestions.push('Có cách nào khác không?');
        break;

      case 'adb-command':
        suggestions.push('Lệnh này có an toàn không?');
        suggestions.push('Giải thích lệnh này');
        suggestions.push('Nếu lệnh thất bại thì sao?');
        break;

      case 'delay':
        suggestions.push('Tại sao cần đợi?');
        suggestions.push('Có thể bỏ qua không?');
        break;
    }
  }

  // Generic suggestions
  suggestions.push('Giải thích workflow này');
  suggestions.push('Tôi gặp lỗi, phải làm sao?');

  // Return unique suggestions (max 4)
  return [...new Set(suggestions)].slice(0, 4);
}

/**
 * Search web using AI
 */
export async function searchWeb(query: string): Promise<string> {
  const config = getAIConfig();

  // Check if any API is configured
  if (!isProxyConfigured(config) && !config.directApiKey) {
    return `Không thể tra cứu web: AI chưa được cấu hình.

Bạn có thể tìm kiếm thủ công trên Google với từ khóa: "${query}"`;
  }

  const searchPrompt = `Bạn là một trợ lý tìm kiếm thông tin. Hãy cung cấp thông tin chính xác và hữu ích về chủ đề sau đây, dựa trên kiến thức của bạn. Trả lời bằng tiếng Việt, ngắn gọn và dễ hiểu.

Chủ đề cần tra cứu: "${query}"

Hãy cung cấp:
1. Thông tin tổng quan ngắn gọn
2. Các bước thực hiện (nếu có)
3. Lưu ý quan trọng

Định dạng câu trả lời rõ ràng, dễ đọc.`;

  try {
    // Priority 1: Use proxy server if configured
    if (isProxyConfigured(config)) {
      const messages = [
        { role: 'user' as const, content: searchPrompt },
      ];

      // Build endpoint URL - append /completions if not already present
      let endpoint = config.proxyUrl!;
      if (!endpoint.endsWith('/completions')) {
        endpoint = endpoint.replace(/\/?$/, '/completions');
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.proxyApiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ProxyResponse = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error('No response');
      }

      return text.trim();
    }

    // Priority 2: Fall back to direct Gemini API
    if (config.directApiKey) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.directApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: searchPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 800,
              topP: 0.9,
              topK: 40,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('No response');
      }

      return text.trim();
    }

    throw new Error('No API configured');
  } catch (error) {
    console.error('Web search failed:', error);
    return `Không thể tra cứu thông tin về "${query}". Vui lòng thử lại sau hoặc tìm kiếm thủ công trên Google.`;
  }
}
