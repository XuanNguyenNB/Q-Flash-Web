/**
 * AI Automation Store
 *
 * Zustand store for managing AI automation state
 */

import { create } from 'zustand';
import type { AutomationLog, AIAction, AIAutomationRunner } from '@/services/aiAutomation';

interface AIAutomationState {
  // Runner reference
  runner: AIAutomationRunner | null;

  // Status
  isRunning: boolean;
  isPaused: boolean;
  currentSubStepIndex: number;

  // Logs
  logs: AutomationLog[];
  maxLogs: number;

  // Last action
  lastAction: AIAction | null;
  lastScreenshot: string | null;

  // AI status
  aiStatus: 'idle' | 'analyzing' | 'executing' | 'waiting' | 'complete' | 'error';
  statusMessage: string;

  // Actions
  setRunner: (runner: AIAutomationRunner | null) => void;
  setIsRunning: (isRunning: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setCurrentSubStepIndex: (index: number) => void;
  addLog: (log: AutomationLog) => void;
  clearLogs: () => void;
  setLastAction: (action: AIAction | null) => void;
  setLastScreenshot: (screenshot: string | null) => void;
  setAIStatus: (status: AIAutomationState['aiStatus'], message?: string) => void;
  reset: () => void;
}

export const useAIAutomationStore = create<AIAutomationState>((set, get) => ({
  // Initial state
  runner: null,
  isRunning: false,
  isPaused: false,
  currentSubStepIndex: 0,
  logs: [],
  maxLogs: 100,
  lastAction: null,
  lastScreenshot: null,
  aiStatus: 'idle',
  statusMessage: '',

  // Actions
  setRunner: (runner) => set({ runner }),

  setIsRunning: (isRunning) => set({ isRunning }),

  setIsPaused: (isPaused) => set({ isPaused }),

  setCurrentSubStepIndex: (index) => set({ currentSubStepIndex: index }),

  addLog: (log) => {
    const { logs, maxLogs } = get();
    const newLogs = [...logs, log];
    // Keep only last maxLogs entries
    if (newLogs.length > maxLogs) {
      newLogs.shift();
    }
    set({ logs: newLogs });
  },

  clearLogs: () => set({ logs: [] }),

  setLastAction: (action) => set({ lastAction: action }),

  setLastScreenshot: (screenshot) => set({ lastScreenshot: screenshot }),

  setAIStatus: (status, message) =>
    set({
      aiStatus: status,
      statusMessage: message || getDefaultStatusMessage(status),
    }),

  reset: () =>
    set({
      runner: null,
      isRunning: false,
      isPaused: false,
      currentSubStepIndex: 0,
      logs: [],
      lastAction: null,
      lastScreenshot: null,
      aiStatus: 'idle',
      statusMessage: '',
    }),
}));

/**
 * Get default status message for AI status
 */
function getDefaultStatusMessage(status: AIAutomationState['aiStatus']): string {
  switch (status) {
    case 'idle':
      return 'Sẵn sàng';
    case 'analyzing':
      return 'Đang phân tích màn hình...';
    case 'executing':
      return 'Đang thực hiện hành động...';
    case 'waiting':
      return 'Đang chờ...';
    case 'complete':
      return 'Hoàn thành!';
    case 'error':
      return 'Có lỗi xảy ra';
    default:
      return '';
  }
}
