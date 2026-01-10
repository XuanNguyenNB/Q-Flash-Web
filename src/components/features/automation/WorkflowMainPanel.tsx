/**
 * Workflow Main Panel Component
 *
 * Hiển thị màn hình thiết bị (Scrcpy) và các bước workflow
 */

import { useWorkflowStore } from '@/stores/workflowStore';
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScrcpyPanel } from '@/components/features/adb/ScrcpyPanel';
import { getWorkflowsByDevice } from '@/data/workflowPresets';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Terminal,
  Package,
  Trash2,
  Clock,
  User,
  ChevronRight,
  ChevronLeft,
  Star,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function WorkflowMainPanel() {
  const {
    selectedWorkflow,
    executionStatus,
    currentStepIndex,
    stepResults,
    deviceFilter,
    selectWorkflow,
    clearSelectedWorkflow,
    nextStep,
    previousStep,
    getProgress,
  } = useWorkflowStore();

  // Use the workflow execution hook
  const {
    execute,
    pause,
    resume,
    stop,
    isRunning,
    isPaused,
    isIdle,
  } = useWorkflowExecution();

  const progress = getProgress();
  const currentStep = selectedWorkflow?.steps[currentStepIndex];

  // Get filtered workflows based on device selection
  const availableWorkflows = getWorkflowsByDevice(
    deviceFilter.brand || '',
    deviceFilter.model || '',
    deviceFilter.osVersion || ''
  );

  // Get step icon
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'adb-command':
        return Terminal;
      case 'install-apk':
        return Package;
      case 'uninstall-packages':
        return Trash2;
      case 'user-action':
        return User;
      case 'delay':
        return Clock;
      default:
        return Circle;
    }
  };

  // Get step status
  const getStepStatus = (stepId: string, index: number) => {
    const result = stepResults.get(stepId);
    if (result) {
      return result.success ? 'completed' : 'error';
    }
    if (executionStatus === 'running' && index === currentStepIndex) {
      return 'running';
    }
    if (index < currentStepIndex) {
      return 'skipped';
    }
    return 'pending';
  };

  // If no device selected, show empty state
  if (!deviceFilter.brand || !deviceFilter.model || !deviceFilter.osVersion) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 border-2 border-dashed rounded-lg bg-muted/30">
        <Package className="w-16 h-16 mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold mb-2">Chưa chọn thiết bị</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Vui lòng chọn thiết bị từ thanh bên trái để xem các quy trình khả dụng.
        </p>
      </div>
    );
  }

  // If device selected but no workflow, show workflow list
  if (!selectedWorkflow) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quy trình khả dụng</CardTitle>
          <p className="text-sm text-muted-foreground">
            Chọn một quy trình để bắt đầu tự động hóa
          </p>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pb-4">
            {availableWorkflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Package className="w-12 h-12 mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-sm font-semibold mb-2">Không tìm thấy quy trình</h3>
                <p className="text-xs text-muted-foreground max-w-md">
                  Chưa có quy trình nào khả dụng cho thiết bị đã chọn.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableWorkflows.map((workflow) => (
                  <Card
                    key={workflow.id}
                    className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                    onClick={() => selectWorkflow(workflow.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-none w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          {workflow.category === 'cleanup' && (
                            <Trash2 className="w-5 h-5 text-primary" />
                          )}
                          {workflow.category === 'optimization' && (
                            <Zap className="w-5 h-5 text-primary" />
                          )}
                          {workflow.category === 'gaming' && (
                            <Star className="w-5 h-5 text-primary" />
                          )}
                          {workflow.category === 'vietnam-setup' && (
                            <Package className="w-5 h-5 text-primary" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{workflow.nameVi}</h4>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-none" />
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {workflow.descriptionVi}
                          </p>

                          {/* Meta info */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {workflow.steps.length} bước
                            </Badge>
                            {workflow.estimatedMinutes && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                ~{workflow.estimatedMinutes} phút
                              </Badge>
                            )}
                            {workflow.difficulty && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] px-1.5 py-0',
                                  workflow.difficulty === 'easy' && 'border-green-500 text-green-600',
                                  workflow.difficulty === 'medium' && 'border-yellow-500 text-yellow-600',
                                  workflow.difficulty === 'hard' && 'border-red-500 text-red-600'
                                )}
                              >
                                {workflow.difficulty === 'easy' && 'Dễ'}
                                {workflow.difficulty === 'medium' && 'Trung bình'}
                                {workflow.difficulty === 'hard' && 'Khó'}
                              </Badge>
                            )}
                            {workflow.isOfficial && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                Chính thức
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Scrcpy Panel */}
      <Card className="flex-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Màn hình thiết bị
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Scrcpy
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="aspect-[9/20] max-h-[500px] bg-black rounded-lg overflow-hidden">
            <ScrcpyPanel className="w-full h-full" />
          </div>
        </CardContent>
      </Card>

      {/* Workflow Info & Controls */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 flex-none">
          <div className="space-y-3">
            {/* Back button + Title */}
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearSelectedWorkflow}
                className="flex-none -ml-2"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <CardTitle className="text-lg mb-1">
                  {selectedWorkflow.nameVi}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedWorkflow.descriptionVi}
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tiến độ</span>
                <span className="font-medium">
                  {progress.completed}/{progress.total} bước ({progress.percentage}%)
                </span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {isIdle && (
                <Button onClick={execute} className="gap-2">
                  <Play className="w-4 h-4" />
                  Bắt đầu
                </Button>
              )}

              {isRunning && (
                <Button onClick={pause} variant="secondary" className="gap-2">
                  <Pause className="w-4 h-4" />
                  Tạm dừng
                </Button>
              )}

              {isPaused && (
                <Button onClick={resume} className="gap-2">
                  <Play className="w-4 h-4" />
                  Tiếp tục
                </Button>
              )}

              {!isIdle && (
                <Button onClick={stop} variant="destructive" className="gap-2">
                  <Square className="w-4 h-4" />
                  Dừng
                </Button>
              )}

              {!isIdle && (
                <>
                  <Button
                    onClick={previousStep}
                    variant="outline"
                    size="icon"
                    disabled={currentStepIndex === 0 || isRunning}
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={nextStep}
                    variant="outline"
                    size="icon"
                    disabled={currentStepIndex >= selectedWorkflow.steps.length - 1 || isRunning}
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Steps List */}
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pb-4">
            <div className="space-y-2">
              {selectedWorkflow.steps.map((step, index) => {
                const StepIcon = getStepIcon(step.type);
                const status = getStepStatus(step.id, index);
                const isCurrent = index === currentStepIndex;

                return (
                  <div
                    key={step.id}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all',
                      isCurrent && executionStatus !== 'idle'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-transparent bg-card'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex-none w-8 h-8 rounded-full flex items-center justify-center',
                          status === 'completed' && 'bg-green-500/10 text-green-600',
                          status === 'running' && 'bg-blue-500/10 text-blue-600',
                          status === 'error' && 'bg-red-500/10 text-red-600',
                          status === 'pending' && 'bg-muted text-muted-foreground',
                          status === 'skipped' && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {status === 'completed' && <CheckCircle2 className="w-5 h-5" />}
                        {status === 'running' && <Loader2 className="w-5 h-5 animate-spin" />}
                        {status === 'error' && <AlertCircle className="w-5 h-5" />}
                        {(status === 'pending' || status === 'skipped') && (
                          <StepIcon className="w-5 h-5" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">
                            Bước {index + 1}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {step.type}
                          </Badge>
                          {step.canSkip && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Có thể bỏ qua
                            </Badge>
                          )}
                        </div>

                        <h4 className="font-semibold text-sm mb-1">
                          {step.titleVi || step.title}
                        </h4>

                        {step.descriptionVi && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {step.descriptionVi}
                          </p>
                        )}

                        {/* Command preview */}
                        {step.command && (
                          <div className="text-xs font-mono bg-muted p-2 rounded mt-2 overflow-x-auto">
                            {step.command}
                          </div>
                        )}

                        {/* Packages list */}
                        {step.packages && step.packages.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-2">
                            {step.packages.length} gói tin
                          </div>
                        )}

                        {/* User prompt */}
                        {step.userPromptVi && (
                          <div className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 p-2 rounded mt-2">
                            💡 {step.userPromptVi}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
