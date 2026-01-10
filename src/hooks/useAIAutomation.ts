/**
 * useAIAutomation Hook
 *
 * Hook để quản lý AI automation cho guided-action steps
 * Kết hợp với scrcpy context và workflow execution
 */

import { useCallback, useRef } from 'react';
import { useScrcpyAvailable, type ScrcpyController } from '@/contexts/ScrcpyContext';
import { useAIAutomationStore } from '@/stores/aiAutomationStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { AIAutomationRunner, type AutomationLog } from '@/services/aiAutomation';
import { toast } from 'sonner';

export function useAIAutomation() {
  const { isAvailable, canvas, controller } = useScrcpyAvailable();
  const runnerRef = useRef<AIAutomationRunner | null>(null);

  const {
    isRunning,
    isPaused,
    currentSubStepIndex,
    logs,
    aiStatus,
    statusMessage,
    setRunner,
    setIsRunning,
    setIsPaused,
    setCurrentSubStepIndex,
    addLog,
    clearLogs,
    setLastAction,
    setLastScreenshot,
    setAIStatus,
    reset,
  } = useAIAutomationStore();

  const { selectedWorkflow, currentStepIndex, confirmStep } = useWorkflowStore();

  /**
   * Start AI automation for current guided-action step
   */
  const startAutomation = useCallback(() => {
    if (!isAvailable || !canvas || !controller) {
      toast.error('Scrcpy chưa sẵn sàng. Vui lòng bật screen mirror trước.');
      return;
    }

    const currentStep = selectedWorkflow?.steps[currentStepIndex];
    if (!currentStep || currentStep.type !== 'guided-action') {
      toast.error('Chỉ có thể dùng AI automation cho bước hướng dẫn.');
      return;
    }

    // Clear previous state
    reset();
    clearLogs();

    // Create runner
    const runner = new AIAutomationRunner(
      canvas,
      controller as ScrcpyController,
      currentStep,
      {
        onLog: (log: AutomationLog) => {
          addLog(log);

          // Update AI status based on log level
          if (log.level === 'action') {
            setAIStatus('executing', log.message);
            setLastAction(log.action || null);
            if (log.screenshot) {
              setLastScreenshot(log.screenshot);
            }
          } else if (log.level === 'info' && log.message.includes('phân tích')) {
            setAIStatus('analyzing', log.message);
          } else if (log.level === 'success') {
            setAIStatus('complete', log.message);
          } else if (log.level === 'error') {
            setAIStatus('error', log.message);
          }
        },
        onSubStepChange: (index: number) => {
          setCurrentSubStepIndex(index);
        },
        onComplete: (success: boolean) => {
          setIsRunning(false);
          setRunner(null);
          runnerRef.current = null;

          if (success) {
            setAIStatus('complete', 'Hoàn thành tất cả các bước!');
            toast.success('AI đã hoàn thành tự động hóa!');
            // Auto-confirm the step
            confirmStep();
          } else {
            setAIStatus('error', 'Tự động hóa dừng lại');
            toast.warning('AI automation đã dừng.');
          }
        },
      }
    );

    runnerRef.current = runner;
    setRunner(runner);
    setIsRunning(true);
    setAIStatus('analyzing', 'Bắt đầu phân tích...');

    // Start execution
    runner.start();

    toast.success('Đã bật AI automation!');
  }, [
    isAvailable,
    canvas,
    controller,
    selectedWorkflow,
    currentStepIndex,
    reset,
    clearLogs,
    addLog,
    setRunner,
    setIsRunning,
    setCurrentSubStepIndex,
    setAIStatus,
    setLastAction,
    setLastScreenshot,
    confirmStep,
  ]);

  /**
   * Stop AI automation
   */
  const stopAutomation = useCallback(() => {
    if (runnerRef.current) {
      runnerRef.current.stop();
      runnerRef.current = null;
    }
    setRunner(null);
    setIsRunning(false);
    setAIStatus('idle', 'Đã dừng');
    toast.info('Đã dừng AI automation.');
  }, [setRunner, setIsRunning, setAIStatus]);

  /**
   * Pause AI automation
   */
  const pauseAutomation = useCallback(() => {
    if (runnerRef.current) {
      runnerRef.current.pause();
      setIsPaused(true);
      setAIStatus('waiting', 'Đã tạm dừng');
    }
  }, [setIsPaused, setAIStatus]);

  /**
   * Resume AI automation
   */
  const resumeAutomation = useCallback(() => {
    if (runnerRef.current) {
      runnerRef.current.resume();
      setIsPaused(false);
      setAIStatus('analyzing', 'Tiếp tục...');
    }
  }, [setIsPaused, setAIStatus]);

  /**
   * Check if AI automation can be used
   */
  const canUseAutomation = useCallback(() => {
    if (!isAvailable) return false;

    const currentStep = selectedWorkflow?.steps[currentStepIndex];
    if (!currentStep || currentStep.type !== 'guided-action') return false;

    return true;
  }, [isAvailable, selectedWorkflow, currentStepIndex]);

  return {
    // State
    isRunning,
    isPaused,
    currentSubStepIndex,
    logs,
    aiStatus,
    statusMessage,

    // Checks
    canUseAutomation: canUseAutomation(),
    isScrcpyAvailable: isAvailable,

    // Actions
    startAutomation,
    stopAutomation,
    pauseAutomation,
    resumeAutomation,
    clearLogs,
  };
}
