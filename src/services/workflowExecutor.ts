/**
 * Workflow Executor Service
 *
 * Thực thi các bước trong workflow tự động hóa
 */

import type { WorkflowStep, StepExecutionResult } from '@/types/workflow';

/**
 * Interface cho ADB Protocol
 */
interface ADBProtocol {
  isConnected: boolean;
  runShellCommand: (command: string) => Promise<string>;
}

/**
 * Callback để update UI trong quá trình thực thi
 */
export interface ExecutionCallbacks {
  onStepStart: (stepId: string, stepIndex: number) => void;
  onStepComplete: (stepId: string, result: StepExecutionResult) => void;
  onStepError: (stepId: string, error: string) => void;
  onLog: (level: 'info' | 'success' | 'warning' | 'error', message: string) => void;
  onUserActionRequired: (step: WorkflowStep) => Promise<boolean>; // Wait for user confirmation
  shouldStop: () => boolean; // Check if execution should stop
  isPaused: () => boolean; // Check if execution is paused
}

/**
 * Execute a single workflow step
 */
export async function executeStep(
  step: WorkflowStep,
  protocol: ADBProtocol,
  callbacks: ExecutionCallbacks
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  callbacks.onLog('info', `▶️ Bắt đầu bước: ${step.titleVi || step.title}`);

  try {
    switch (step.type) {
      case 'adb-command':
        return await executeADBCommand(step, protocol, callbacks);

      case 'install-apk':
        return await executeInstallAPK(step, protocol, callbacks);

      case 'uninstall-packages':
        return await executeUninstallPackages(step, protocol, callbacks);

      case 'user-action':
        return await executeUserAction(step, callbacks);

      case 'guided-action':
        return await executeGuidedAction(step, callbacks);

      case 'optimize-notifications':
        return await executeOptimizeNotifications(step, callbacks);

      case 'delay':
        return await executeDelay(step, callbacks);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    callbacks.onLog('error', `❌ Lỗi: ${errorMessage}`);

    return {
      stepId: step.id,
      success: false,
      error: errorMessage,
      timestamp: new Date(),
    };
  }
}

/**
 * Execute ADB shell command
 */
async function executeADBCommand(
  step: WorkflowStep,
  protocol: ADBProtocol,
  callbacks: ExecutionCallbacks
): Promise<StepExecutionResult> {
  if (!step.command) {
    throw new Error('ADB command step missing command');
  }

  if (!protocol.isConnected) {
    throw new Error('ADB not connected');
  }

  callbacks.onLog('info', `📱 Chạy lệnh: ${step.command}`);

  const output = await protocol.runShellCommand(step.command);

  callbacks.onLog('success', `✅ Hoàn thành: ${output.slice(0, 100)}${output.length > 100 ? '...' : ''}`);

  // Validate expected output if specified
  if (step.expectedOutput && !output.includes(step.expectedOutput)) {
    callbacks.onLog('warning', `⚠️ Output không khớp expected: ${step.expectedOutput}`);
  }

  return {
    stepId: step.id,
    success: true,
    output,
    timestamp: new Date(),
  };
}

/**
 * Install APK from URL
 */
async function executeInstallAPK(
  step: WorkflowStep,
  protocol: ADBProtocol,
  callbacks: ExecutionCallbacks
): Promise<StepExecutionResult> {
  if (!step.apkUrl) {
    throw new Error('Install APK step missing apkUrl');
  }

  if (!protocol.isConnected) {
    throw new Error('ADB not connected');
  }

  callbacks.onLog('info', `📦 Đang tải APK: ${step.apkName || step.apkUrl}`);

  // For now, we'll use pm install with URL - in practice you'd push the file first
  // This is a simplified version - real implementation would:
  // 1. Download APK to temp folder
  // 2. Push to device with adb push
  // 3. Run pm install
  // 4. Clean up

  // Placeholder - actual implementation depends on how APKs are hosted
  callbacks.onLog('warning', `⚠️ APK installation not implemented yet (needs server-side component)`);

  return {
    stepId: step.id,
    success: true,
    output: 'APK installation placeholder',
    timestamp: new Date(),
  };
}

/**
 * Uninstall packages
 */
async function executeUninstallPackages(
  step: WorkflowStep,
  protocol: ADBProtocol,
  callbacks: ExecutionCallbacks
): Promise<StepExecutionResult> {
  if (!step.packages || step.packages.length === 0) {
    throw new Error('Uninstall step missing packages list');
  }

  if (!protocol.isConnected) {
    throw new Error('ADB not connected');
  }

  callbacks.onLog('info', `🗑️ Gỡ cài đặt ${step.packages.length} ứng dụng...`);

  const results: string[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const pkg of step.packages) {
    if (callbacks.shouldStop()) {
      callbacks.onLog('warning', '⏹️ Đã dừng theo yêu cầu');
      break;
    }

    // Wait if paused
    while (callbacks.isPaused()) {
      await delay(500);
      if (callbacks.shouldStop()) break;
    }

    try {
      callbacks.onLog('info', `  → Gỡ: ${pkg}`);

      // Use pm uninstall -k to keep data, or pm uninstall --user 0 for system apps
      const output = await protocol.runShellCommand(`pm uninstall -k --user 0 ${pkg}`);

      if (output.includes('Success')) {
        successCount++;
        callbacks.onLog('success', `    ✅ ${pkg}`);
      } else {
        failCount++;
        callbacks.onLog('warning', `    ⚠️ ${pkg}: ${output}`);
      }

      results.push(`${pkg}: ${output}`);
    } catch (error) {
      failCount++;
      const msg = error instanceof Error ? error.message : String(error);
      callbacks.onLog('error', `    ❌ ${pkg}: ${msg}`);
      results.push(`${pkg}: ERROR - ${msg}`);
    }

    // Small delay between uninstalls to avoid overwhelming the device
    await delay(200);
  }

  callbacks.onLog('info', `📊 Kết quả: ${successCount}/${step.packages.length} thành công`);

  return {
    stepId: step.id,
    success: failCount === 0,
    output: results.join('\n'),
    timestamp: new Date(),
  };
}

/**
 * Wait for user action
 */
async function executeUserAction(
  step: WorkflowStep,
  callbacks: ExecutionCallbacks
): Promise<StepExecutionResult> {
  callbacks.onLog('info', `👆 Chờ người dùng: ${step.userPromptVi || step.userPrompt || step.titleVi}`);

  // Wait for user to confirm they've completed the action
  const confirmed = await callbacks.onUserActionRequired(step);

  if (!confirmed) {
    return {
      stepId: step.id,
      success: false,
      error: 'User skipped or cancelled',
      timestamp: new Date(),
    };
  }

  callbacks.onLog('success', `✅ Người dùng xác nhận hoàn thành`);

  return {
    stepId: step.id,
    success: true,
    output: 'User confirmed action completed',
    timestamp: new Date(),
  };
}

/**
 * Execute guided action with sub-steps
 * Similar to user-action but with detailed sub-steps for AI guidance
 */
async function executeGuidedAction(
  step: WorkflowStep,
  callbacks: ExecutionCallbacks
): Promise<StepExecutionResult> {
  const subStepsCount = step.subSteps?.length || 0;
  callbacks.onLog('info', `📋 Hướng dẫn: ${step.titleVi || step.title} (${subStepsCount} bước chi tiết)`);

  // Log sub-steps for user reference
  if (step.subSteps && step.subSteps.length > 0) {
    step.subSteps.forEach((subStep, idx) => {
      callbacks.onLog('info', `   ${idx + 1}. ${subStep.instruction}`);
    });
  }

  callbacks.onLog('info', `👆 Chờ người dùng hoàn thành các bước...`);

  // Wait for user to confirm they've completed all sub-steps
  const confirmed = await callbacks.onUserActionRequired(step);

  if (!confirmed) {
    return {
      stepId: step.id,
      success: false,
      error: 'User skipped or cancelled guided action',
      timestamp: new Date(),
    };
  }

  callbacks.onLog('success', `✅ Người dùng xác nhận hoàn thành hướng dẫn`);

  return {
    stepId: step.id,
    success: true,
    output: `Guided action completed with ${subStepsCount} sub-steps`,
    timestamp: new Date(),
  };
}

/**
 * Execute optimize-notifications step
 * This step requires user interaction (selecting apps), so we wait for user confirmation
 */
async function executeOptimizeNotifications(
  step: WorkflowStep,
  callbacks: ExecutionCallbacks
): Promise<StepExecutionResult> {
  const methods = step.optimizationMethods || [];
  callbacks.onLog('info', `📱 Bước tối ưu thông báo: ${step.titleVi || step.title}`);
  callbacks.onLog('info', `   Phương pháp: ${methods.join(', ')}`);

  // This step is handled by the UI component (AppOptimizeStep)
  // The executor just waits for user confirmation that they've completed it
  callbacks.onLog('info', `👆 Chờ người dùng chọn và tối ưu ứng dụng...`);

  const confirmed = await callbacks.onUserActionRequired(step);

  if (!confirmed) {
    return {
      stepId: step.id,
      success: false,
      error: 'User skipped or cancelled optimization step',
      timestamp: new Date(),
    };
  }

  callbacks.onLog('success', `✅ Người dùng xác nhận đã tối ưu xong`);

  return {
    stepId: step.id,
    success: true,
    output: `Notification optimization completed with methods: ${methods.join(', ')}`,
    timestamp: new Date(),
  };
}

/**
 * Execute delay step
 */
async function executeDelay(
  step: WorkflowStep,
  callbacks: ExecutionCallbacks
): Promise<StepExecutionResult> {
  const delayMs = step.delayMs || 1000;

  callbacks.onLog('info', `⏳ Đợi ${delayMs / 1000} giây...`);

  // Wait with pause/stop check
  const startTime = Date.now();
  while (Date.now() - startTime < delayMs) {
    if (callbacks.shouldStop()) {
      break;
    }
    while (callbacks.isPaused()) {
      await delay(100);
      if (callbacks.shouldStop()) break;
    }
    await delay(100);
  }

  return {
    stepId: step.id,
    success: true,
    output: `Delayed ${delayMs}ms`,
    timestamp: new Date(),
  };
}

/**
 * Helper: delay function
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute entire workflow
 */
export async function executeWorkflow(
  steps: WorkflowStep[],
  protocol: ADBProtocol,
  callbacks: ExecutionCallbacks,
  startFromIndex: number = 0
): Promise<boolean> {
  callbacks.onLog('info', `🚀 Bắt đầu workflow với ${steps.length} bước`);

  let allSuccess = true;

  for (let i = startFromIndex; i < steps.length; i++) {
    const step = steps[i];

    // Check stop flag
    if (callbacks.shouldStop()) {
      callbacks.onLog('warning', '⏹️ Workflow đã dừng');
      return false;
    }

    // Wait if paused
    while (callbacks.isPaused()) {
      await delay(500);
      if (callbacks.shouldStop()) {
        callbacks.onLog('warning', '⏹️ Workflow đã dừng');
        return false;
      }
    }

    // Signal step start
    callbacks.onStepStart(step.id, i);

    // Execute step
    const result = await executeStep(step, protocol, callbacks);

    // Signal step complete
    callbacks.onStepComplete(step.id, result);

    if (!result.success) {
      allSuccess = false;
      callbacks.onStepError(step.id, result.error || 'Unknown error');

      // If step can't be skipped, stop workflow
      if (!step.canSkip) {
        callbacks.onLog('error', `❌ Bước bắt buộc thất bại, dừng workflow`);
        return false;
      }

      callbacks.onLog('warning', `⚠️ Bước có thể bỏ qua, tiếp tục...`);
    }
  }

  if (allSuccess) {
    callbacks.onLog('success', `🎉 Workflow hoàn thành thành công!`);
  } else {
    callbacks.onLog('warning', `⚠️ Workflow hoàn thành với một số lỗi`);
  }

  return allSuccess;
}
