/**
 * Step Control Panel
 *
 * Panel điều khiển từng bước trong workflow
 * Hiển thị: Thông tin bước hiện tại + Sub-steps + Confirm/Skip/Stop buttons
 * Đặt ở dưới cùng của Workflow Sidebar (vùng khoanh đỏ)
 */

import { useState, useEffect } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useAIAutomationStore } from '@/stores/aiAutomationStore';
import { useADB } from '@/hooks/useADB';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  CheckCircle2,
  SkipForward,
  Square,
  Play,
  Pause,
  RefreshCw,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Circle,
  ChevronDown,
  ChevronUp,
  Info,
  Navigation,
  Terminal,
  Package,
  Trash2,
  User,
  Clock,
  Bot,
  Sparkles,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkflowStepType, GuidedSubStep } from '@/types/workflow';

// Step type icons
const STEP_TYPE_ICONS: Record<WorkflowStepType, React.ReactNode> = {
  'adb-command': <Terminal className="w-3.5 h-3.5" />,
  'install-apk': <Package className="w-3.5 h-3.5" />,
  'uninstall-packages': <Trash2 className="w-3.5 h-3.5" />,
  'user-action': <User className="w-3.5 h-3.5" />,
  'guided-action': <Navigation className="w-3.5 h-3.5" />,
  'optimize-notifications': <Bell className="w-3.5 h-3.5" />,
  'delay': <Clock className="w-3.5 h-3.5" />,
};

// Step type labels
const STEP_TYPE_LABELS: Record<WorkflowStepType, string> = {
  'adb-command': 'Lệnh ADB',
  'install-apk': 'Cài APK',
  'uninstall-packages': 'Gỡ ứng dụng',
  'user-action': 'Thao tác',
  'guided-action': 'Hướng dẫn',
  'optimize-notifications': 'Tối ưu thông báo',
  'delay': 'Chờ',
};

interface StepControlPanelProps {
  className?: string;
  onAskAI?: (question: string) => void;
  onStartAIAutomation?: () => void;
  onStopAIAutomation?: () => void;
  canUseAIAutomation?: boolean;
}

export function StepControlPanel({
  className,
  onAskAI,
  onStartAIAutomation,
  onStopAIAutomation,
  canUseAIAutomation = false,
}: StepControlPanelProps) {
  const {
    selectedWorkflow,
    executionStatus,
    currentStepIndex,
    stepStates,
    confirmStep,
    skipStep,
    stopExecution,
    pauseExecution,
    resumeExecution,
    retryStep,
    getProgress,
  } = useWorkflowStore();

  // AI Automation state
  const {
    isRunning: isAIRunning,
    isPaused: isAIPaused,
    currentSubStepIndex: aiSubStepIndex,
    aiStatus,
    statusMessage: aiStatusMessage,
  } = useAIAutomationStore();

  const { getInstance } = useADB();
  const isADBConnected = getInstance().isConnected;

  // State for tracking current sub-step
  const [currentSubStepIndex, setCurrentSubStepIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true); // Always expanded by default
  const [aiAutoMode, setAiAutoMode] = useState(false);

  // Sync sub-step index with AI automation
  useEffect(() => {
    if (isAIRunning && aiSubStepIndex !== currentSubStepIndex) {
      setCurrentSubStepIndex(aiSubStepIndex);
    }
  }, [isAIRunning, aiSubStepIndex, currentSubStepIndex]);

  // Current step
  const currentStep = selectedWorkflow?.steps[currentStepIndex];
  const currentStepState = currentStep ? stepStates.get(currentStep.id) : undefined;
  const progress = getProgress();

  // Sub-steps for guided-action
  const subSteps = currentStep?.subSteps || [];
  const hasSubSteps = subSteps.length > 0;

  // Determine what actions are available
  const isWaitingConfirm = currentStepState === 'waiting-confirm';
  const isInProgress = currentStepState === 'in-progress';
  const hasError = currentStepState === 'error';
  const isPaused = executionStatus === 'paused';
  const isRunning = executionStatus === 'running';
  const isIdle = executionStatus === 'idle';
  const isCompleted = executionStatus === 'completed';

  // Can actions - for guided-action, don't require ADB
  const isGuidedAction = currentStep?.type === 'guided-action';
  const isUserAction = currentStep?.type === 'user-action';
  const needsADB = !isGuidedAction && !isUserAction;

  const canConfirm = isWaitingConfirm && (needsADB ? isADBConnected : true);
  const canSkip = currentStep?.canSkip !== false && (isWaitingConfirm || hasError);
  const canStop = isRunning || isPaused || isWaitingConfirm;
  const canRetry = hasError;
  const canResume = isPaused;
  const canStart = isIdle && selectedWorkflow;

  // Get user prompt to display
  const getUserPrompt = (): string | null => {
    if (!currentStep) return null;
    return currentStep.userPromptVi || currentStep.userPrompt || null;
  };

  // Get status message
  const getStatusMessage = (): string => {
    if (!selectedWorkflow) return 'Chọn quy trình để bắt đầu';
    if (isCompleted) return '🎉 Hoàn thành quy trình!';
    if (isIdle) return 'Nhấn "Bắt đầu" để thực hiện';
    if (isPaused) return 'Đã tạm dừng';
    if (hasError) return 'Có lỗi - Thử lại hoặc bỏ qua';
    if (isWaitingConfirm) {
      if (isGuidedAction) return 'Làm theo hướng dẫn rồi nhấn "Xác nhận"';
      if (isUserAction) return 'Thực hiện thao tác rồi nhấn "Xác nhận"';
      return 'Xác nhận để tiếp tục';
    }
    if (isInProgress) return 'Đang thực hiện...';
    return 'Đang chờ...';
  };

  // Get status color
  const getStatusColor = (): string => {
    if (isCompleted) return 'text-green-600';
    if (hasError) return 'text-red-600';
    if (isWaitingConfirm) return 'text-amber-600';
    if (isInProgress || isRunning) return 'text-blue-600';
    return 'text-muted-foreground';
  };

  // Handle ask AI
  const handleAskAI = () => {
    if (!currentStep) return;
    const question = `Hướng dẫn chi tiết bước "${currentStep.titleVi || currentStep.title}"`;
    onAskAI?.(question);
  };

  // Navigate sub-steps
  const goToPrevSubStep = () => {
    if (currentSubStepIndex > 0) {
      setCurrentSubStepIndex(currentSubStepIndex - 1);
    }
  };

  const goToNextSubStep = () => {
    if (currentSubStepIndex < subSteps.length - 1) {
      setCurrentSubStepIndex(currentSubStepIndex + 1);
    }
  };

  // Render sub-step item - always show full instructions
  const renderSubStep = (subStep: GuidedSubStep, idx: number) => {
    const isActive = idx === currentSubStepIndex;
    const isStepCompleted = idx < currentSubStepIndex;
    const isAIControlled = isAIRunning && idx === aiSubStepIndex;

    return (
      <div
        key={subStep.id}
        className={cn(
          'flex items-start gap-2 p-2.5 rounded-lg transition-all',
          isActive && 'bg-primary/10 border border-primary/30',
          isAIControlled && 'bg-purple-50 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-700',
          !isActive && !isAIControlled && 'hover:bg-muted/50 cursor-pointer'
        )}
        onClick={() => !isAIRunning && setCurrentSubStepIndex(idx)}
      >
        {/* Step indicator */}
        <div className="flex-none pt-0.5">
          {isStepCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : isAIControlled ? (
            <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center animate-pulse">
              <Bot className="w-2.5 h-2.5 text-white" />
            </div>
          ) : isActive ? (
            <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
              <span className="text-[8px] font-bold text-primary-foreground">{idx + 1}</span>
            </div>
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

        {/* Step content - always show full instructions */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-xs leading-relaxed',
            isActive && 'font-medium',
            isStepCompleted && 'text-muted-foreground line-through'
          )}>
            {subStep.instruction}
          </p>

          {/* Always show alternative instructions for all steps */}
          {subStep.alternativeInstructions && subStep.alternativeInstructions.length > 0 && (
            <div className="mt-1.5 pl-2 border-l-2 border-muted">
              <p className="text-[10px] text-muted-foreground mb-0.5">Hoặc:</p>
              {subStep.alternativeInstructions.map((alt, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">
                  • {alt}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Empty state
  if (!selectedWorkflow) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
        <p className="text-xs text-muted-foreground">
          Chọn quy trình để xem điều khiển
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col bg-background', className)}>
      {/* Progress bar - always visible */}
      <div className="px-3 pt-3 pb-2 border-b">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-muted-foreground font-medium">Tiến độ</span>
          <span className="font-semibold">{progress.completed}/{progress.total} bước</span>
        </div>
        <Progress value={progress.percentage} className="h-2" />
      </div>

      {/* Current step header */}
      {currentStep && !isIdle && (
        <div
          className="px-3 py-2 border-b bg-muted/30 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            {/* Step type icon */}
            <div className="flex-none w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {STEP_TYPE_ICONS[currentStep.type]}
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[8px] px-1.5 py-0 h-4">
                  Bước {currentStepIndex + 1}/{selectedWorkflow.steps.length}
                </Badge>
                <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4">
                  {STEP_TYPE_LABELS[currentStep.type]}
                </Badge>
              </div>
              <p className="text-xs font-medium mt-0.5 truncate">
                {currentStep.titleVi || currentStep.title}
              </p>
            </div>

            {/* Expand toggle */}
            <Button variant="ghost" size="icon" className="h-6 w-6 flex-none">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Expanded content - instructions & sub-steps */}
      {currentStep && !isIdle && isExpanded && (
        <ScrollArea className="flex-1 max-h-[300px]">
          <div className="p-3 space-y-3">
            {/* Description */}
            {currentStep.descriptionVi && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {currentStep.descriptionVi}
              </p>
            )}

            {/* User prompt - main instruction */}
            {getUserPrompt() && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 flex-none mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                    {getUserPrompt()}
                  </p>
                </div>
              </div>
            )}

            {/* Sub-steps for guided-action */}
            {hasSubSteps && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Các bước thực hiện
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {currentSubStepIndex + 1}/{subSteps.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {subSteps.map((subStep, idx) => renderSubStep(subStep, idx))}
                </div>

                {/* Sub-step navigation */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-[10px]"
                    onClick={goToPrevSubStep}
                    disabled={currentSubStepIndex === 0}
                  >
                    ← Bước trước
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-[10px]"
                    onClick={goToNextSubStep}
                    disabled={currentSubStepIndex >= subSteps.length - 1}
                  >
                    Bước tiếp →
                  </Button>
                </div>
              </div>
            )}

            {/* ADB Command info */}
            {currentStep.type === 'adb-command' && currentStep.command && (
              <div className="p-2 rounded-lg bg-muted font-mono text-[10px] break-all">
                <span className="text-muted-foreground">$ </span>
                {currentStep.command}
              </div>
            )}

            {/* Packages to uninstall */}
            {currentStep.type === 'uninstall-packages' && currentStep.packages && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Ứng dụng sẽ gỡ ({currentStep.packages.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {currentStep.packages.slice(0, 5).map((pkg) => (
                    <Badge key={pkg} variant="secondary" className="text-[8px] font-mono">
                      {pkg.split('.').pop()}
                    </Badge>
                  ))}
                  {currentStep.packages.length > 5 && (
                    <Badge variant="outline" className="text-[8px]">
                      +{currentStep.packages.length - 5} khác
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Status message */}
      <div className="px-3 py-2 border-t bg-muted/20">
        <div className="flex items-center gap-2">
          {isAIRunning && <Bot className="w-4 h-4 animate-pulse text-purple-600" />}
          {!isAIRunning && isInProgress && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          {!isAIRunning && isWaitingConfirm && <AlertTriangle className="w-4 h-4 text-amber-600" />}
          {hasError && <AlertTriangle className="w-4 h-4 text-red-600" />}
          {isCompleted && <CheckCircle2 className="w-4 h-4 text-green-600" />}
          {!isAIRunning && isIdle && <Info className="w-4 h-4 text-muted-foreground" />}
          <span className={cn('text-xs font-medium', isAIRunning ? 'text-purple-600' : getStatusColor())}>
            {isAIRunning ? aiStatusMessage || 'AI đang thực hiện...' : getStatusMessage()}
          </span>
        </div>
      </div>

      {/* AI Automation Toggle - for guided-action steps */}
      {currentStep?.type === 'guided-action' && isWaitingConfirm && (
        <div className="px-3 py-2 border-t bg-purple-50 dark:bg-purple-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                AI Tự động hóa
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isAIRunning ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1 border-purple-300"
                  onClick={onStopAIAutomation}
                >
                  <Square className="w-3 h-3" />
                  Dừng AI
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-7 text-[10px] gap-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                  onClick={onStartAIAutomation}
                  disabled={!canUseAIAutomation}
                  title={!canUseAIAutomation ? 'Bật Screen Mirror trước để dùng AI' : 'Bật AI tự động hóa'}
                >
                  <Bot className="w-3 h-3" />
                  Bật AI
                </Button>
              )}
            </div>
          </div>
          {!canUseAIAutomation && !isAIRunning && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
              ⚠️ Bật Screen Mirror (tab ADB/Scrcpy) để dùng AI tự động
            </p>
          )}
          {isAIRunning && (
            <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">
              AI đang phân tích màn hình và thực hiện các thao tác tự động...
            </p>
          )}
        </div>
      )}

      {/* Control buttons */}
      <div className="px-3 py-3 border-t">
        <div className="flex flex-wrap gap-2">
          {/* Start button */}
          {canStart && (
            <Button
              size="sm"
              className="gap-1.5 h-9 text-xs flex-1"
              onClick={() => useWorkflowStore.getState().startExecution()}
            >
              <Play className="w-4 h-4" />
              Bắt đầu
            </Button>
          )}

          {/* Confirm button - primary action */}
          {canConfirm && (
            <Button
              size="sm"
              className="gap-1.5 h-9 text-xs flex-1 bg-green-600 hover:bg-green-700"
              onClick={confirmStep}
            >
              <CheckCircle2 className="w-4 h-4" />
              Xác nhận & Tiếp tục
            </Button>
          )}

          {/* Resume button */}
          {canResume && (
            <Button
              size="sm"
              className="gap-1.5 h-9 text-xs flex-1"
              onClick={resumeExecution}
            >
              <Play className="w-4 h-4" />
              Tiếp tục
            </Button>
          )}

          {/* Pause button */}
          {isRunning && !isWaitingConfirm && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1 h-9 text-xs"
              onClick={pauseExecution}
            >
              <Pause className="w-4 h-4" />
              Dừng
            </Button>
          )}

          {/* Skip button */}
          {canSkip && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-9 text-xs"
              onClick={skipStep}
            >
              <SkipForward className="w-4 h-4" />
              Bỏ qua
            </Button>
          )}

          {/* Retry button */}
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-9 text-xs"
              onClick={retryStep}
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </Button>
          )}

          {/* Stop button */}
          {canStop && (
            <Button
              size="sm"
              variant="destructive"
              className="gap-1 h-9 text-xs"
              onClick={stopExecution}
            >
              <Square className="w-4 h-4" />
              Dừng
            </Button>
          )}

          {/* Ask AI button */}
          {currentStep && onAskAI && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 h-9 text-xs"
              onClick={handleAskAI}
            >
              <MessageSquare className="w-4 h-4" />
              Hỏi AI
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
