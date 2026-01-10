/**
 * useWorkflowExecution Hook
 *
 * Hook để thực thi workflow với state management
 */

import { useCallback, useRef } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useADB } from '@/hooks/useADB';
import { useTerminalStore } from '@/stores/terminalStore';
import { toast } from 'sonner';
import {
  executeWorkflow,
  type ExecutionCallbacks,
} from '@/services/workflowExecutor';
import type { WorkflowStep, StepExecutionResult } from '@/types/workflow';

export function useWorkflowExecution() {
  const {
    selectedWorkflow,
    executionStatus,
    currentStepIndex,
    startWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    stopWorkflow,
    nextStep,
    setStepResult,
  } = useWorkflowStore();

  const { getInstance } = useADB();
  const { log } = useTerminalStore();

  // Refs for pause/stop state (accessible in callbacks)
  const isPausedRef = useRef(false);
  const shouldStopRef = useRef(false);
  const userActionResolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  /**
   * Start executing the workflow
   */
  const execute = useCallback(async () => {
    if (!selectedWorkflow) {
      toast.error('Chưa chọn workflow');
      return;
    }

    const protocol = getInstance();
    if (!protocol.isConnected) {
      toast.error('Chưa kết nối ADB. Vui lòng kết nối thiết bị trước.');
      return;
    }

    // Reset refs
    isPausedRef.current = false;
    shouldStopRef.current = false;

    // Start workflow in store
    startWorkflow();
    toast.success('Bắt đầu thực thi workflow');

    // Setup callbacks
    const callbacks: ExecutionCallbacks = {
      onStepStart: (stepId, stepIndex) => {
        log('info', `▶️ Bước ${stepIndex + 1}: ${selectedWorkflow.steps[stepIndex].titleVi || selectedWorkflow.steps[stepIndex].title}`);
      },

      onStepComplete: (stepId, result) => {
        setStepResult(stepId, result);
        if (result.success) {
          nextStep();
        }
      },

      onStepError: (stepId, error) => {
        log('error', `❌ Lỗi: ${error}`);
        toast.error(`Lỗi: ${error}`);
      },

      onLog: (level, message) => {
        log(level === 'success' ? 'info' : level, message);
      },

      onUserActionRequired: async (step: WorkflowStep) => {
        // Show toast and wait for user confirmation
        return new Promise<boolean>((resolve) => {
          userActionResolverRef.current = resolve;

          toast.info(step.userPromptVi || step.userPrompt || step.titleVi || step.title, {
            duration: Infinity,
            action: {
              label: 'Xong',
              onClick: () => {
                if (userActionResolverRef.current) {
                  userActionResolverRef.current(true);
                  userActionResolverRef.current = null;
                }
              },
            },
            cancel: {
              label: 'Bỏ qua',
              onClick: () => {
                if (userActionResolverRef.current) {
                  userActionResolverRef.current(false);
                  userActionResolverRef.current = null;
                }
              },
            },
          });
        });
      },

      shouldStop: () => shouldStopRef.current,

      isPaused: () => isPausedRef.current,
    };

    try {
      const success = await executeWorkflow(
        selectedWorkflow.steps,
        protocol,
        callbacks,
        currentStepIndex
      );

      if (success) {
        toast.success('🎉 Workflow hoàn thành!');
      } else if (shouldStopRef.current) {
        toast.info('Workflow đã dừng');
      } else {
        toast.warning('Workflow hoàn thành với một số lỗi');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log('error', `Workflow error: ${msg}`);
      toast.error(`Lỗi workflow: ${msg}`);
    } finally {
      stopWorkflow();
    }
  }, [selectedWorkflow, getInstance, startWorkflow, stopWorkflow, nextStep, setStepResult, log, currentStepIndex]);

  /**
   * Pause execution
   */
  const pause = useCallback(() => {
    isPausedRef.current = true;
    pauseWorkflow();
    toast.info('Đã tạm dừng workflow');
  }, [pauseWorkflow]);

  /**
   * Resume execution
   */
  const resume = useCallback(() => {
    isPausedRef.current = false;
    resumeWorkflow();
    toast.info('Tiếp tục workflow');
  }, [resumeWorkflow]);

  /**
   * Stop execution
   */
  const stop = useCallback(() => {
    shouldStopRef.current = true;
    isPausedRef.current = false;

    // Resolve any pending user action
    if (userActionResolverRef.current) {
      userActionResolverRef.current(false);
      userActionResolverRef.current = null;
    }

    stopWorkflow();
    toast.info('Đã dừng workflow');
  }, [stopWorkflow]);

  /**
   * Confirm user action (called from UI)
   */
  const confirmUserAction = useCallback((confirmed: boolean) => {
    if (userActionResolverRef.current) {
      userActionResolverRef.current(confirmed);
      userActionResolverRef.current = null;
    }
  }, []);

  return {
    execute,
    pause,
    resume,
    stop,
    confirmUserAction,
    isRunning: executionStatus === 'running',
    isPaused: executionStatus === 'paused',
    isIdle: executionStatus === 'idle',
  };
}
