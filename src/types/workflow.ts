/**
 * Workflow Types & Interfaces
 *
 * Định nghĩa các types cho hệ thống Tự động hóa (Automation)
 */

/**
 * Loại bước trong workflow
 */
export type WorkflowStepType =
  | 'adb-command'           // Chạy lệnh ADB
  | 'install-apk'           // Cài đặt APK
  | 'uninstall-packages'    // Gỡ cài đặt apps
  | 'user-action'           // Yêu cầu người dùng thực hiện hành động
  | 'guided-action'         // Hướng dẫn chi tiết với AI guide
  | 'optimize-notifications'// Tối ưu thông báo cho apps
  | 'delay';                // Delay/chờ

/**
 * Optimization method for notifications
 */
export type OptimizationMethod =
  | 'deviceidle-whitelist'  // adb shell dumpsys deviceidle whitelist +<package>
  | 'standby-bucket-active' // adb shell am set-standby-bucket <package> active
  | 'disable-powergenie';   // adb shell pm disable-user --user 0 com.huawei.powergenie

/**
 * Sub-step trong một bước hướng dẫn chi tiết
 */
export interface GuidedSubStep {
  id: string;
  instruction: string; // Hướng dẫn chi tiết
  screenshot?: string; // Optional: URL to reference screenshot
  highlightArea?: { x: number; y: number; width: number; height: number }; // Vùng cần highlight trên screen
  waitForElement?: string; // Optional: text/element to wait for
  alternativeInstructions?: string[]; // Các cách thực hiện khác (VD: trên web vs trên điện thoại)
}

/**
 * Package info for uninstall step with detailed metadata
 */
export interface PackageInfo {
  packageName: string;
  name: string; // Tên hiển thị
  nameVi?: string; // Tên tiếng Việt
  description?: string; // Mô tả chức năng
  descriptionVi?: string;
  warning?: string; // Cảnh báo đặc biệt
  warningVi?: string;
  isRecommended?: boolean; // Nên xóa (mặc định true)
  isOptional?: boolean; // Tùy chọn, cân nhắc trước khi xóa
}

/**
 * Step control action - hành động người dùng có thể thực hiện
 */
export type StepControlAction = 'confirm' | 'skip' | 'stop' | 'retry' | 'ask-ai';

/**
 * Step execution state - trạng thái chi tiết của từng bước
 */
export type StepExecutionState =
  | 'pending'           // Chưa thực hiện
  | 'waiting-confirm'   // Đang chờ xác nhận từ người dùng
  | 'in-progress'       // Đang thực hiện
  | 'completed'         // Hoàn thành
  | 'skipped'           // Bỏ qua
  | 'error'             // Lỗi
  | 'paused';           // Tạm dừng

/**
 * Một bước trong workflow
 */
export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  title: string;
  titleVi?: string;
  description?: string;
  descriptionVi?: string;

  // Video hướng dẫn cho bước này
  videoUrl?: string; // URL video (có thể là YouTube, local, hoặc cloud storage)
  videoPoster?: string; // Thumbnail cho video

  // For ADB commands
  command?: string;
  expectedOutput?: string;

  // For APK installation
  apkUrl?: string;
  apkName?: string;

  // For uninstall
  packages?: string[];
  packagesInfo?: PackageInfo[]; // Chi tiết các package với metadata

  // For user action
  userPrompt?: string;
  userPromptVi?: string;
  needsAIGuide?: boolean; // AI sẽ visual guide

  // For guided-action (hướng dẫn chi tiết với sub-steps)
  subSteps?: GuidedSubStep[];
  requiresConfirmation?: boolean; // Yêu cầu xác nhận từ người dùng trước khi chuyển bước

  // For delay
  delayMs?: number;

  // For optimize-notifications (select user apps and run optimization commands)
  optimizationMethods?: OptimizationMethod[]; // Các phương pháp tối ưu được áp dụng
  selectUserApps?: boolean; // Hiển thị danh sách app user để chọn

  // Validation & Options
  canSkip?: boolean;
  retryCount?: number;

  // AI Context (deprecated - keeping for backwards compatibility)
  aiContext?: string; // Ngữ cảnh bổ sung cho AI khi hướng dẫn bước này
  webSearchKeywords?: string[]; // Keywords để AI tra cứu web nếu cần
}

/**
 * Danh mục workflow
 */
export type WorkflowCategory =
  | 'cleanup'           // Dọn dẹp
  | 'optimization'      // Tối ưu hóa
  | 'gaming'            // Gaming setup
  | 'google-services'   // Google Services setup
  | 'vietnam-setup'     // Setup cho VN
  | 'custom';           // Tự tạo

/**
 * Độ khó
 */
export type WorkflowDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Workflow chính
 */
export interface Workflow {
  id: string;
  name: string;
  nameVi: string;
  description: string;
  descriptionVi: string;

  // Target devices
  brand: string; // 'honor', 'oppo', 'realme', 'xiaomi', etc.
  models?: string[]; // Empty = all models
  osVersions?: string[]; // Empty = all versions

  // Metadata
  category: WorkflowCategory;
  tags: string[];
  difficulty: WorkflowDifficulty;
  estimatedMinutes: number;
  isOfficial: boolean;

  // Steps
  steps: WorkflowStep[];

  // Stats (from server)
  downloads?: number;
  rating?: number;

  // AI
  aiAssistEnabled?: boolean;
}

/**
 * Brand option
 */
export interface BrandOption {
  id: string;
  name: string;
  nameVi: string;
  icon: string; // emoji
  models: ModelOption[];
}

/**
 * Model option
 */
export interface ModelOption {
  id: string;
  name: string;
  osVersions: OSVersionOption[];
}

/**
 * OS Version option
 */
export interface OSVersionOption {
  id: string;
  name: string;
  version: string;
}

/**
 * Device filter
 */
export interface DeviceFilter {
  brand: string | null;
  model: string | null;
  osVersion: string | null;
}

/**
 * Workflow execution status
 */
export type WorkflowExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

/**
 * Step execution result
 */
export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  output?: string;
  error?: string;
  timestamp: Date;
}

/**
 * AI Guide overlay
 */
export interface AIGuideOverlay {
  type: 'circle' | 'arrow' | 'highlight' | 'text';
  position: { x: number; y: number; width?: number; height?: number };
  message: string;
  messageVi?: string;
}

/**
 * AI Chat message
 */
export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    stepId?: string;       // ID của step liên quan
    isWebSearch?: boolean; // Có phải từ web search
    sources?: string[];    // Nguồn tham khảo
  };
}

/**
 * AI Context - Ngữ cảnh cho AI hiểu về thiết bị và workflow
 */
export interface AIContext {
  device: {
    brand: string | null;
    model: string | null;
    osVersion: string | null;
    isConnected: boolean;
  };
  workflow: {
    id: string | null;
    name: string | null;
    currentStepIndex: number;
    totalSteps: number;
  };
  currentStep: WorkflowStep | null;
  executionHistory: {
    stepId: string;
    action: StepControlAction;
    timestamp: Date;
  }[];
}

/**
 * Step Control State - Trạng thái của panel điều khiển bước
 */
export interface StepControlState {
  currentStepIndex: number;
  stepState: StepExecutionState;
  canConfirm: boolean;
  canSkip: boolean;
  canStop: boolean;
  canRetry: boolean;
  message: string; // Thông báo hiện tại
}
