/**
 * Workflow Store
 *
 * Quản lý state cho hệ thống Tự động hóa
 */

import { create } from 'zustand';
import type {
  Workflow,
  DeviceFilter,
  WorkflowExecutionStatus,
  StepExecutionResult,
  StepExecutionState,
  AIGuideOverlay,
  AIChatMessage,
  AIContext,
} from '@/types/workflow';
import { ALL_WORKFLOWS, getWorkflowsByDevice } from '@/data/workflowPresets';

interface WorkflowStore {
  // Workflows data
  workflows: Workflow[];
  selectedWorkflow: Workflow | null;

  // Device filter
  deviceFilter: DeviceFilter;

  // Execution state
  executionStatus: WorkflowExecutionStatus;
  currentStepIndex: number;
  stepResults: Map<string, StepExecutionResult>;
  stepStates: Map<string, StepExecutionState>; // New: trạng thái chi tiết từng bước

  // AI state
  aiEnabled: boolean;
  aiOverlays: AIGuideOverlay[];
  chatMessages: AIChatMessage[];
  aiSuggestions: string[];
  aiContext: AIContext | null; // New: ngữ cảnh cho AI

  // Actions - Workflow selection
  setSelectedWorkflow: (workflow: Workflow | null) => void;
  selectWorkflow: (id: string) => void;
  selectWorkflowById: (id: string) => void; // Alias for selectWorkflow
  clearSelectedWorkflow: () => void;

  // Actions - Device filter
  setDeviceFilter: (filter: Partial<DeviceFilter>) => void;
  resetDeviceFilter: () => void;

  // Actions - Execution
  startWorkflow: () => void;
  startExecution: () => void; // Alias for startWorkflow
  pauseWorkflow: () => void;
  pauseExecution: () => void; // Alias for pauseWorkflow
  resumeWorkflow: () => void;
  resumeExecution: () => void; // Alias for resumeWorkflow
  stopWorkflow: () => void;
  stopExecution: () => void; // Alias for stopWorkflow
  nextStep: () => void;
  previousStep: () => void;
  setStepResult: (stepId: string, result: StepExecutionResult) => void;

  // Actions - Step Control (New)
  setStepState: (stepId: string, state: StepExecutionState) => void;
  confirmStep: () => void;
  skipStep: () => void;
  retryStep: () => void;
  requestStepConfirmation: () => void;

  // Actions - AI
  toggleAI: () => void;
  setAIOverlays: (overlays: AIGuideOverlay[]) => void;
  addChatMessage: (message: AIChatMessage) => void;
  clearChat: () => void;
  setAISuggestions: (suggestions: string[]) => void;
  updateAIContext: () => void; // New: cập nhật ngữ cảnh AI

  // Getters
  getFilteredWorkflows: () => Workflow[];
  getCurrentStep: () => any | null;
  getProgress: () => { completed: number; total: number; percentage: number };
  getAIContext: () => AIContext; // New
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  // Initial state
  workflows: ALL_WORKFLOWS,
  selectedWorkflow: null,

  deviceFilter: {
    brand: null,
    model: null,
    osVersion: null,
  },

  executionStatus: 'idle',
  currentStepIndex: 0,
  stepResults: new Map(),
  stepStates: new Map(), // New

  aiEnabled: true,
  aiOverlays: [],
  chatMessages: [],
  aiSuggestions: [],
  aiContext: null, // New

  // Workflow selection
  setSelectedWorkflow: (workflow) => set({ selectedWorkflow: workflow }),

  selectWorkflow: (id) => {
    const workflow = get().workflows.find((w) => w.id === id);
    if (workflow) {
      set({
        selectedWorkflow: workflow,
        currentStepIndex: 0,
        stepResults: new Map(),
        executionStatus: 'idle',
      });
    }
  },

  // Alias for selectWorkflow
  selectWorkflowById: (id) => get().selectWorkflow(id),

  clearSelectedWorkflow: () =>
    set({
      selectedWorkflow: null,
      currentStepIndex: 0,
      stepResults: new Map(),
      executionStatus: 'idle',
    }),

  // Device filter
  setDeviceFilter: (filter) =>
    set((state) => ({
      deviceFilter: { ...state.deviceFilter, ...filter },
    })),

  resetDeviceFilter: () =>
    set({
      deviceFilter: { brand: null, model: null, osVersion: null },
    }),

  // Execution
  startWorkflow: () => {
    const { selectedWorkflow } = get();
    if (!selectedWorkflow) return;

    // Initialize step states
    const stepStates = new Map<string, StepExecutionState>();
    selectedWorkflow.steps.forEach((step, index) => {
      // First step waits for confirmation, others are pending
      stepStates.set(step.id, index === 0 ? 'waiting-confirm' : 'pending');
    });

    set({
      executionStatus: 'running',
      currentStepIndex: 0,
      stepResults: new Map(),
      stepStates,
    });
  },

  // Alias for startWorkflow
  startExecution: () => get().startWorkflow(),

  pauseWorkflow: () => {
    const { getCurrentStep } = get();
    const currentStep = getCurrentStep();
    if (currentStep) {
      set((state) => {
        const newStepStates = new Map(state.stepStates);
        newStepStates.set(currentStep.id, 'paused');
        return { executionStatus: 'paused', stepStates: newStepStates };
      });
    } else {
      set({ executionStatus: 'paused' });
    }
  },

  // Alias for pauseWorkflow
  pauseExecution: () => get().pauseWorkflow(),

  resumeWorkflow: () => {
    const { getCurrentStep } = get();
    const currentStep = getCurrentStep();
    if (currentStep) {
      set((state) => {
        const newStepStates = new Map(state.stepStates);
        newStepStates.set(currentStep.id, 'waiting-confirm');
        return { executionStatus: 'running', stepStates: newStepStates };
      });
    } else {
      set({ executionStatus: 'running' });
    }
  },

  // Alias for resumeWorkflow
  resumeExecution: () => get().resumeWorkflow(),

  stopWorkflow: () =>
    set({
      executionStatus: 'idle',
      currentStepIndex: 0,
      stepResults: new Map(),
      stepStates: new Map(),
    }),

  // Alias for stopWorkflow
  stopExecution: () => get().stopWorkflow(),

  nextStep: () => {
    const { currentStepIndex, selectedWorkflow } = get();
    if (!selectedWorkflow) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < selectedWorkflow.steps.length) {
      set({ currentStepIndex: nextIndex });
    } else {
      // Workflow completed
      set({ executionStatus: 'completed' });
    }
  },

  previousStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  setStepResult: (stepId, result) =>
    set((state) => {
      const newResults = new Map(state.stepResults);
      newResults.set(stepId, result);
      return { stepResults: newResults };
    }),

  // Step Control (New)
  setStepState: (stepId, state) =>
    set((prevState) => {
      const newStepStates = new Map(prevState.stepStates);
      newStepStates.set(stepId, state);
      return { stepStates: newStepStates };
    }),

  confirmStep: () => {
    const { currentStepIndex, selectedWorkflow, nextStep, setStepState, setStepResult } = get();
    if (!selectedWorkflow) return;

    const currentStep = selectedWorkflow.steps[currentStepIndex];
    if (!currentStep) return;

    // Mark current step as completed
    setStepState(currentStep.id, 'completed');
    setStepResult(currentStep.id, {
      stepId: currentStep.id,
      success: true,
      timestamp: new Date(),
    });

    // Move to next step
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < selectedWorkflow.steps.length) {
      const nextStepObj = selectedWorkflow.steps[nextIndex];
      set((state) => {
        const newStepStates = new Map(state.stepStates);
        newStepStates.set(nextStepObj.id, 'waiting-confirm');
        return { currentStepIndex: nextIndex, stepStates: newStepStates };
      });
    } else {
      // Workflow completed
      set({ executionStatus: 'completed' });
    }
  },

  skipStep: () => {
    const { currentStepIndex, selectedWorkflow, setStepState, setStepResult } = get();
    if (!selectedWorkflow) return;

    const currentStep = selectedWorkflow.steps[currentStepIndex];
    if (!currentStep) return;

    // Mark current step as skipped
    setStepState(currentStep.id, 'skipped');
    setStepResult(currentStep.id, {
      stepId: currentStep.id,
      success: true,
      output: 'Đã bỏ qua',
      timestamp: new Date(),
    });

    // Move to next step
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < selectedWorkflow.steps.length) {
      const nextStepObj = selectedWorkflow.steps[nextIndex];
      set((state) => {
        const newStepStates = new Map(state.stepStates);
        newStepStates.set(nextStepObj.id, 'waiting-confirm');
        return { currentStepIndex: nextIndex, stepStates: newStepStates };
      });
    } else {
      set({ executionStatus: 'completed' });
    }
  },

  retryStep: () => {
    const { currentStepIndex, selectedWorkflow, setStepState } = get();
    if (!selectedWorkflow) return;

    const currentStep = selectedWorkflow.steps[currentStepIndex];
    if (!currentStep) return;

    // Reset step state to waiting-confirm
    setStepState(currentStep.id, 'waiting-confirm');
  },

  requestStepConfirmation: () => {
    const { currentStepIndex, selectedWorkflow, setStepState } = get();
    if (!selectedWorkflow) return;

    const currentStep = selectedWorkflow.steps[currentStepIndex];
    if (!currentStep) return;

    setStepState(currentStep.id, 'waiting-confirm');
  },

  // AI
  toggleAI: () => set((state) => ({ aiEnabled: !state.aiEnabled })),

  setAIOverlays: (overlays) => set({ aiOverlays: overlays }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  clearChat: () => set({ chatMessages: [] }),

  setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),

  updateAIContext: () => {
    const { selectedWorkflow, currentStepIndex, deviceFilter, getCurrentStep, executionStatus } = get();
    const currentStep = getCurrentStep();

    const aiContext: AIContext = {
      device: {
        brand: deviceFilter.brand,
        model: deviceFilter.model,
        osVersion: deviceFilter.osVersion,
        isConnected: false, // Will be updated by component
      },
      workflow: {
        id: selectedWorkflow?.id || null,
        name: selectedWorkflow?.nameVi || selectedWorkflow?.name || null,
        currentStepIndex,
        totalSteps: selectedWorkflow?.steps.length || 0,
      },
      currentStep: currentStep || null,
      executionHistory: [],
    };

    set({ aiContext });
  },

  // Getters
  getFilteredWorkflows: () => {
    const { deviceFilter } = get();
    return getWorkflowsByDevice(
      deviceFilter.brand,
      deviceFilter.model,
      deviceFilter.osVersion
    );
  },

  getCurrentStep: () => {
    const { selectedWorkflow, currentStepIndex } = get();
    if (!selectedWorkflow) return null;
    return selectedWorkflow.steps[currentStepIndex] || null;
  },

  getProgress: () => {
    const { selectedWorkflow, stepResults } = get();
    if (!selectedWorkflow) return { completed: 0, total: 0, percentage: 0 };

    const total = selectedWorkflow.steps.length;
    const completed = Array.from(stepResults.values()).filter(
      (r) => r.success
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  },

  getAIContext: () => {
    const { selectedWorkflow, currentStepIndex, deviceFilter, getCurrentStep } = get();
    const currentStep = getCurrentStep();

    return {
      device: {
        brand: deviceFilter.brand,
        model: deviceFilter.model,
        osVersion: deviceFilter.osVersion,
        isConnected: false,
      },
      workflow: {
        id: selectedWorkflow?.id || null,
        name: selectedWorkflow?.nameVi || selectedWorkflow?.name || null,
        currentStepIndex,
        totalSteps: selectedWorkflow?.steps.length || 0,
      },
      currentStep: currentStep || null,
      executionHistory: [],
    };
  },
}));
