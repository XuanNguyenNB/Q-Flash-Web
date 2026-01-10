/**
 * AI Automation Service
 *
 * Dịch vụ tự động hóa dựa trên AI
 * - Chụp màn hình từ scrcpy canvas
 * - Gửi đến AI để phân tích
 * - Parse các lệnh thao tác (tap, swipe, type, wait)
 * - Thực thi qua scrcpy controller
 */

import type { WorkflowStep, GuidedSubStep } from '@/types/workflow';

/**
 * Types for AI automation
 */
export type AIActionType = 'tap' | 'swipe' | 'type' | 'wait' | 'scroll' | 'key' | 'done' | 'error';

export interface AIAction {
  type: AIActionType;
  // For tap
  x?: number;
  y?: number;
  // For swipe
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  duration?: number;
  // For type
  text?: string;
  // For wait
  waitMs?: number;
  // For scroll
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  // For key
  keyCode?: number;
  // For all
  description?: string;
  confidence?: number;
}

export interface AIAnalysisResult {
  success: boolean;
  currentState: string;
  nextAction: AIAction | null;
  reasoning: string;
  isStepComplete: boolean;
  error?: string;
}

export interface AutomationLog {
  timestamp: Date;
  level: 'info' | 'action' | 'success' | 'warning' | 'error';
  message: string;
  screenshot?: string; // base64
  action?: AIAction;
}

/**
 * Scrcpy Controller Interface (subset of what we need)
 */
interface ScrcpyController {
  injectTouch(params: {
    action: number;
    pointerId: bigint;
    pointerX: number;
    pointerY: number;
    videoWidth: number;
    videoHeight: number;
    pressure: number;
    actionButton: number;
    buttons: number;
  }): void;
  injectKeyCode(params: {
    action: number;
    keyCode: number;
    repeat: number;
    metaState: number;
  }): Promise<void>;
  injectText(text: string): Promise<void>;
  injectScroll(params: {
    pointerX: number;
    pointerY: number;
    videoWidth: number;
    videoHeight: number;
    scrollX: number;
    scrollY: number;
    buttons: number;
  }): Promise<void>;
}

/**
 * AI Config
 */
interface AIConfig {
  proxyUrl: string | undefined;
  proxyApiKey: string | undefined;
  model: string;
}

function getAIConfig(): AIConfig {
  return {
    proxyUrl: import.meta.env.VITE_AI_PROXY_URL,
    proxyApiKey: import.meta.env.VITE_AI_PROXY_API_KEY,
    model: import.meta.env.VITE_AI_MODEL || 'gemini-2.5-flash',
  };
}

/**
 * Capture screenshot from canvas as base64
 */
export function captureScreenshot(canvas: HTMLCanvasElement): string {
  // Get image data as base64 PNG
  const dataUrl = canvas.toDataURL('image/png');
  // Remove "data:image/png;base64," prefix
  return dataUrl.split(',')[1];
}

/**
 * Capture screenshot as blob for display
 */
export async function captureScreenshotBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Build prompt for AI screen analysis
 */
function buildAnalysisPrompt(
  step: WorkflowStep,
  currentSubStep: GuidedSubStep | null,
  subStepIndex: number,
  totalSubSteps: number,
  previousActions: AIAction[]
): string {
  let prompt = `Bạn là AI tự động hóa điện thoại Android. Phân tích ảnh màn hình và xác định hành động tiếp theo.

## BƯỚC HIỆN TẠI
Tiêu đề: ${step.titleVi || step.title}
`;

  if (step.descriptionVi) {
    prompt += `Mô tả: ${step.descriptionVi}\n`;
  }

  if (currentSubStep) {
    prompt += `
## HƯỚNG DẪN CHI TIẾT (${subStepIndex + 1}/${totalSubSteps})
Nhiệm vụ: ${currentSubStep.instruction}
`;
    if (currentSubStep.alternativeInstructions?.length) {
      prompt += `Cách khác: ${currentSubStep.alternativeInstructions.join(' HOẶC ')}\n`;
    }
  }

  if (previousActions.length > 0) {
    const recent = previousActions.slice(-3);
    prompt += `
## HÀNH ĐỘNG GẦN ĐÂY
${recent.map((a, i) => `${i + 1}. ${a.type}: ${a.description || JSON.stringify(a)}`).join('\n')}
`;
  }

  prompt += `
## YÊU CẦU
Phân tích màn hình và trả lời JSON với format:
{
  "currentState": "Mô tả ngắn gọn màn hình hiện tại",
  "isStepComplete": true/false,
  "nextAction": {
    "type": "tap|swipe|type|wait|scroll|key|done",
    "x": 500, "y": 800,
    "startX": 500, "startY": 1500, "endX": 500, "endY": 500,
    "text": "text to type",
    "waitMs": 1000,
    "direction": "up|down|left|right",
    "keyCode": 4,
    "description": "Mô tả hành động",
    "confidence": 0.95
  },
  "reasoning": "Giải thích tại sao chọn hành động này"
}

## LƯU Ý
- Tọa độ x, y dựa trên kích thước màn hình thực tế
- Nếu bước hoàn thành (isStepComplete=true), set nextAction type = "done"
- Nếu cần đợi loading, type = "wait" với waitMs
- Nếu không tìm thấy element, scroll để tìm
- confidence từ 0 đến 1, chỉ hành động nếu > 0.7
- Chỉ trả lời JSON, không text thêm
`;

  return prompt;
}

/**
 * Call AI API with screenshot for analysis
 */
export async function analyzeScreen(
  screenshotBase64: string,
  step: WorkflowStep,
  currentSubStep: GuidedSubStep | null,
  subStepIndex: number,
  totalSubSteps: number,
  previousActions: AIAction[],
  canvasWidth: number,
  canvasHeight: number
): Promise<AIAnalysisResult> {
  const config = getAIConfig();

  if (!config.proxyUrl || !config.proxyApiKey) {
    return {
      success: false,
      currentState: 'AI not configured',
      nextAction: null,
      reasoning: 'AI proxy server not configured',
      isStepComplete: false,
      error: 'AI not configured',
    };
  }

  const prompt = buildAnalysisPrompt(step, currentSubStep, subStepIndex, totalSubSteps, previousActions);

  // Add screen dimensions to prompt
  const fullPrompt = `${prompt}\n\nKích thước màn hình: ${canvasWidth}x${canvasHeight}px`;

  try {
    // Build endpoint URL
    let endpoint = config.proxyUrl;
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
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: fullPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshotBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON response
    const result = parseAIResponse(content);
    return result;
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      success: false,
      currentState: 'Error',
      nextAction: null,
      reasoning: error instanceof Error ? error.message : 'Unknown error',
      isStepComplete: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse AI response JSON
 */
function parseAIResponse(content: string): AIAnalysisResult {
  try {
    // Try to extract JSON from response
    let jsonStr = content.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      success: true,
      currentState: parsed.currentState || 'Unknown',
      nextAction: parsed.nextAction || null,
      reasoning: parsed.reasoning || '',
      isStepComplete: parsed.isStepComplete || false,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', content);
    return {
      success: false,
      currentState: 'Parse error',
      nextAction: null,
      reasoning: `Failed to parse AI response: ${content.slice(0, 200)}`,
      isStepComplete: false,
      error: 'Failed to parse AI response',
    };
  }
}

/**
 * Execute an AI action on the device
 */
export async function executeAction(
  action: AIAction,
  controller: ScrcpyController,
  canvasWidth: number,
  canvasHeight: number
): Promise<boolean> {
  try {
    switch (action.type) {
      case 'tap':
        if (action.x !== undefined && action.y !== undefined) {
          await executeTap(controller, action.x, action.y, canvasWidth, canvasHeight);
          return true;
        }
        break;

      case 'swipe':
        if (
          action.startX !== undefined &&
          action.startY !== undefined &&
          action.endX !== undefined &&
          action.endY !== undefined
        ) {
          await executeSwipe(
            controller,
            action.startX,
            action.startY,
            action.endX,
            action.endY,
            canvasWidth,
            canvasHeight,
            action.duration || 300
          );
          return true;
        }
        break;

      case 'type':
        if (action.text) {
          await controller.injectText(action.text);
          return true;
        }
        break;

      case 'wait':
        await delay(action.waitMs || 1000);
        return true;

      case 'scroll':
        if (action.direction) {
          await executeScroll(
            controller,
            action.direction,
            canvasWidth,
            canvasHeight,
            action.amount || 300
          );
          return true;
        }
        break;

      case 'key':
        if (action.keyCode !== undefined) {
          await controller.injectKeyCode({
            action: 0,
            keyCode: action.keyCode,
            repeat: 0,
            metaState: 0,
          });
          await controller.injectKeyCode({
            action: 1,
            keyCode: action.keyCode,
            repeat: 0,
            metaState: 0,
          });
          return true;
        }
        break;

      case 'done':
        return true;

      default:
        console.warn('Unknown action type:', action.type);
    }
  } catch (error) {
    console.error('Action execution error:', error);
  }

  return false;
}

/**
 * Execute tap action
 */
async function executeTap(
  controller: ScrcpyController,
  x: number,
  y: number,
  videoWidth: number,
  videoHeight: number
): Promise<void> {
  const pointerId = -2n; // Mouse pointer

  // ACTION_DOWN
  controller.injectTouch({
    action: 0,
    pointerId,
    pointerX: x,
    pointerY: y,
    videoWidth,
    videoHeight,
    pressure: 1,
    actionButton: 1,
    buttons: 1,
  });

  await delay(50);

  // ACTION_UP
  controller.injectTouch({
    action: 1,
    pointerId,
    pointerX: x,
    pointerY: y,
    videoWidth,
    videoHeight,
    pressure: 0,
    actionButton: 0,
    buttons: 0,
  });
}

/**
 * Execute swipe action
 */
async function executeSwipe(
  controller: ScrcpyController,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  videoWidth: number,
  videoHeight: number,
  duration: number
): Promise<void> {
  const pointerId = -2n;
  const steps = Math.max(10, Math.floor(duration / 16)); // ~60fps
  const stepDelay = duration / steps;

  // ACTION_DOWN at start
  controller.injectTouch({
    action: 0,
    pointerId,
    pointerX: startX,
    pointerY: startY,
    videoWidth,
    videoHeight,
    pressure: 1,
    actionButton: 1,
    buttons: 1,
  });

  await delay(stepDelay);

  // ACTION_MOVE along path
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const x = startX + (endX - startX) * progress;
    const y = startY + (endY - startY) * progress;

    controller.injectTouch({
      action: 2, // ACTION_MOVE
      pointerId,
      pointerX: x,
      pointerY: y,
      videoWidth,
      videoHeight,
      pressure: 1,
      actionButton: 1,
      buttons: 1,
    });

    await delay(stepDelay);
  }

  // ACTION_UP at end
  controller.injectTouch({
    action: 1,
    pointerId,
    pointerX: endX,
    pointerY: endY,
    videoWidth,
    videoHeight,
    pressure: 0,
    actionButton: 0,
    buttons: 0,
  });
}

/**
 * Execute scroll action
 */
async function executeScroll(
  controller: ScrcpyController,
  direction: 'up' | 'down' | 'left' | 'right',
  videoWidth: number,
  videoHeight: number,
  amount: number
): Promise<void> {
  const centerX = videoWidth / 2;
  const centerY = videoHeight / 2;

  let scrollX = 0;
  let scrollY = 0;

  switch (direction) {
    case 'up':
      scrollY = amount / 100;
      break;
    case 'down':
      scrollY = -amount / 100;
      break;
    case 'left':
      scrollX = amount / 100;
      break;
    case 'right':
      scrollX = -amount / 100;
      break;
  }

  await controller.injectScroll({
    pointerX: centerX,
    pointerY: centerY,
    videoWidth,
    videoHeight,
    scrollX,
    scrollY,
    buttons: 0,
  });
}

/**
 * Helper delay function
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AI Automation Runner
 * Runs automation loop for a guided-action step
 */
export class AIAutomationRunner {
  private canvas: HTMLCanvasElement;
  private controller: ScrcpyController;
  private step: WorkflowStep;
  private logs: AutomationLog[] = [];
  private previousActions: AIAction[] = [];
  private isRunning = false;
  private isPaused = false;
  private shouldStop = false;
  private currentSubStepIndex = 0;
  private onLog: (log: AutomationLog) => void;
  private onSubStepChange: (index: number) => void;
  private onComplete: (success: boolean) => void;

  constructor(
    canvas: HTMLCanvasElement,
    controller: ScrcpyController,
    step: WorkflowStep,
    callbacks: {
      onLog: (log: AutomationLog) => void;
      onSubStepChange: (index: number) => void;
      onComplete: (success: boolean) => void;
    }
  ) {
    this.canvas = canvas;
    this.controller = controller;
    this.step = step;
    this.onLog = callbacks.onLog;
    this.onSubStepChange = callbacks.onSubStepChange;
    this.onComplete = callbacks.onComplete;
  }

  private log(level: AutomationLog['level'], message: string, action?: AIAction, screenshot?: string) {
    const logEntry: AutomationLog = {
      timestamp: new Date(),
      level,
      message,
      action,
      screenshot,
    };
    this.logs.push(logEntry);
    this.onLog(logEntry);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.shouldStop = false;
    this.isPaused = false;
    this.currentSubStepIndex = 0;
    this.previousActions = [];

    this.log('info', `🤖 Bắt đầu tự động hóa: ${this.step.titleVi || this.step.title}`);

    const subSteps = this.step.subSteps || [];
    const totalSubSteps = subSteps.length;

    try {
      while (this.currentSubStepIndex < totalSubSteps && !this.shouldStop) {
        // Wait if paused
        while (this.isPaused && !this.shouldStop) {
          await delay(200);
        }

        if (this.shouldStop) break;

        const currentSubStep = subSteps[this.currentSubStepIndex];
        this.onSubStepChange(this.currentSubStepIndex);

        this.log('info', `📋 Bước ${this.currentSubStepIndex + 1}/${totalSubSteps}: ${currentSubStep.instruction}`);

        // Run sub-step automation
        const success = await this.runSubStepAutomation(currentSubStep, this.currentSubStepIndex, totalSubSteps);

        if (success) {
          this.log('success', `✅ Hoàn thành bước ${this.currentSubStepIndex + 1}`);
          this.currentSubStepIndex++;
        } else {
          this.log('warning', `⚠️ Bước ${this.currentSubStepIndex + 1} chưa hoàn thành, thử lại...`);
          // Retry logic - max 3 times
          await delay(2000);
        }
      }

      if (this.shouldStop) {
        this.log('warning', '⏹️ Đã dừng tự động hóa');
        this.onComplete(false);
      } else {
        this.log('success', '🎉 Hoàn thành tất cả các bước!');
        this.onComplete(true);
      }
    } catch (error) {
      this.log('error', `❌ Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.onComplete(false);
    } finally {
      this.isRunning = false;
    }
  }

  private async runSubStepAutomation(
    subStep: GuidedSubStep,
    subStepIndex: number,
    totalSubSteps: number
  ): Promise<boolean> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts && !this.shouldStop) {
      attempts++;

      // Wait if paused
      while (this.isPaused && !this.shouldStop) {
        await delay(200);
      }

      if (this.shouldStop) return false;

      // Capture screenshot
      const screenshot = captureScreenshot(this.canvas);
      const canvasWidth = this.canvas.width;
      const canvasHeight = this.canvas.height;

      // Analyze screen with AI
      this.log('info', '🔍 Đang phân tích màn hình...');

      const result = await analyzeScreen(
        screenshot,
        this.step,
        subStep,
        subStepIndex,
        totalSubSteps,
        this.previousActions,
        canvasWidth,
        canvasHeight
      );

      if (!result.success) {
        this.log('error', `Lỗi AI: ${result.error}`);
        await delay(2000);
        continue;
      }

      this.log('info', `📱 Trạng thái: ${result.currentState}`);
      this.log('info', `💭 ${result.reasoning}`);

      // Check if step is complete
      if (result.isStepComplete) {
        return true;
      }

      // Execute action if available
      if (result.nextAction) {
        const action = result.nextAction;

        // Check confidence
        if ((action.confidence || 0) < 0.7) {
          this.log('warning', `⚠️ Độ tin cậy thấp (${action.confidence}), bỏ qua hành động`);
          await delay(1000);
          continue;
        }

        this.log('action', `🎯 ${action.type}: ${action.description || JSON.stringify(action)}`, action, screenshot);

        const executed = await executeAction(action, this.controller, canvasWidth, canvasHeight);

        if (executed) {
          this.previousActions.push(action);
          // Keep only last 10 actions
          if (this.previousActions.length > 10) {
            this.previousActions.shift();
          }
        }

        // Wait for UI to update
        await delay(action.type === 'wait' ? (action.waitMs || 1000) : 500);
      } else {
        // No action available, wait and retry
        await delay(1000);
      }
    }

    return false;
  }

  pause(): void {
    this.isPaused = true;
    this.log('info', '⏸️ Tạm dừng tự động hóa');
  }

  resume(): void {
    this.isPaused = false;
    this.log('info', '▶️ Tiếp tục tự động hóa');
  }

  stop(): void {
    this.shouldStop = true;
    this.log('info', '⏹️ Yêu cầu dừng tự động hóa');
  }

  getLogs(): AutomationLog[] {
    return [...this.logs];
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getCurrentSubStepIndex(): number {
    return this.currentSubStepIndex;
  }
}
