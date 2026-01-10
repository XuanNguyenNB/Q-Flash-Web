/**
 * Workflow Sidebar Component
 *
 * Sidebar để:
 * - Kết nối ADB
 * - Chọn Brand/Model/OS
 * - Hiển thị Step Control Panel (Confirm/Skip/Stop) ở vùng dưới cùng
 */

import { useState, useCallback } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useADBStore } from '@/stores/adbStore';
import { useADB } from '@/hooks/useADB';
import { useAIAutomation } from '@/hooks/useAIAutomation';
import { BRAND_OPTIONS } from '@/data/workflowPresets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StepControlPanel } from './StepControlPanel';
import { AIActionLogPanel } from './AIActionLogPanel';
import {
  Check,
  Smartphone,
  Loader2,
  ChevronDown,
  ChevronUp,
  Terminal,
  Package,
  Trash2,
  User,
  Clock,
  Navigation,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { WorkflowStepType } from '@/types/workflow';

// Step type icons
const STEP_TYPE_ICONS: Record<WorkflowStepType, React.ReactNode> = {
  'adb-command': <Terminal className="w-3 h-3" />,
  'install-apk': <Package className="w-3 h-3" />,
  'uninstall-packages': <Trash2 className="w-3 h-3" />,
  'user-action': <User className="w-3 h-3" />,
  'guided-action': <Navigation className="w-3 h-3" />,
  'optimize-notifications': <Bell className="w-3 h-3" />,
  'delay': <Clock className="w-3 h-3" />,
};

interface WorkflowSidebarProps {
  onAskAI?: (question: string) => void;
}

export function WorkflowSidebar({ onAskAI }: WorkflowSidebarProps) {
  const { t } = useTranslation();
  const {
    deviceFilter,
    setDeviceFilter,
    selectedWorkflow,
    executionStatus,
    currentStepIndex,
  } = useWorkflowStore();
  const { isConnecting } = useADBStore();

  // AI Automation hook
  const {
    isRunning: isAIRunning,
    canUseAutomation,
    isScrcpyAvailable,
    startAutomation,
    stopAutomation,
    logs: aiLogs,
  } = useAIAutomation();

  // ADB hook - get protocol for actual connection state
  const { connect, disconnect, getInstance } = useADB();
  const protocol = getInstance();
  const isConnected = protocol.isConnected;

  const [tempBrand, setTempBrand] = useState<string>(deviceFilter.brand || '');
  const [tempModel, setTempModel] = useState<string>(deviceFilter.model || '');
  const [tempOS, setTempOS] = useState<string>(deviceFilter.osVersion || '');
  const [isDeviceSectionCollapsed, setIsDeviceSectionCollapsed] = useState(false);

  // Get selected brand data
  const selectedBrandData = BRAND_OPTIONS.find((b) => b.id === tempBrand);
  const models = selectedBrandData?.models || [];
  const selectedModelData = models.find((m) => m.id === tempModel);
  const osVersions = selectedModelData?.osVersions || [];

  // Check if can confirm
  const canConfirm = tempBrand && tempModel && tempOS;
  const isDeviceConfirmed = deviceFilter.brand === tempBrand && deviceFilter.model === tempModel && deviceFilter.osVersion === tempOS;

  // Check if workflow is active
  const isWorkflowActive = selectedWorkflow && executionStatus !== 'idle' && executionStatus !== 'completed';

  // Handle confirm
  const handleConfirm = () => {
    setDeviceFilter({
      brand: tempBrand,
      model: tempModel,
      osVersion: tempOS,
    });
  };

  // Handle brand change
  const handleBrandChange = (brandId: string) => {
    setTempBrand(brandId);
    setTempModel('');
    setTempOS('');
  };

  // Handle model change
  const handleModelChange = (modelId: string) => {
    setTempModel(modelId);
    setTempOS('');
  };

  // Handle ADB connect
  const handleConnect = useCallback(async () => {
    try {
      const success = await connect();
      if (success) {
        toast.success(t('adb.toast.connected', 'ADB device connected'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t('adb.toast.connectionFailed', 'Connection failed: {{message}}', { message }));
    }
  }, [connect, t]);

  // Handle ADB disconnect
  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
      toast.info(t('adb.toast.disconnected', 'ADB device disconnected'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t('adb.toast.disconnectFailed', 'Disconnect failed: {{message}}', { message }));
    }
  }, [disconnect, t]);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* ADB Connection Card - Compact */}
      <Card className="flex-none">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between gap-2">
            {/* Status */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected && 'bg-green-500',
                  !isConnected && 'bg-gray-400'
                )}
              />
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Đã kết nối' : 'Chưa kết nối'}
              </span>
            </div>

            {/* Connect Button */}
            <Button
              onClick={isConnected ? handleDisconnect : handleConnect}
              disabled={isConnecting}
              size="sm"
              variant={isConnected ? 'outline' : 'default'}
              className="h-7 text-xs gap-1.5"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang kết nối
                </>
              ) : isConnected ? (
                <>
                  <Smartphone className="w-3 h-3" />
                  Ngắt
                </>
              ) : (
                <>
                  <Smartphone className="w-3 h-3" />
                  Kết nối ADB
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Device Selection Card - Collapsible when workflow is active */}
      <Card className={cn(
        'flex flex-col overflow-hidden transition-all',
        isWorkflowActive ? 'flex-none' : 'flex-1'
      )}>
        <CardHeader
          className={cn(
            'pb-2 pt-3 px-4 flex-none cursor-pointer',
            isWorkflowActive && 'hover:bg-muted/50'
          )}
          onClick={() => isWorkflowActive && setIsDeviceSectionCollapsed(!isDeviceSectionCollapsed)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold">Thiết bị</CardTitle>
            {isWorkflowActive && (
              <Button variant="ghost" size="icon" className="h-5 w-5">
                {isDeviceSectionCollapsed ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronUp className="w-3 h-3" />
                )}
              </Button>
            )}
            {isDeviceConfirmed && !isWorkflowActive && (
              <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4 gap-0.5">
                <Check className="w-2.5 h-2.5" />
                Đã chọn
              </Badge>
            )}
          </div>
        </CardHeader>

        {/* Collapsible content */}
        {(!isWorkflowActive || !isDeviceSectionCollapsed) && (
          <CardContent className="flex-1 flex flex-col gap-3 overflow-auto px-4 pb-3">
            {/* Brand Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Hãng</label>
              <Select value={tempBrand} onValueChange={handleBrandChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Chọn hãng..." />
                </SelectTrigger>
                <SelectContent>
                  {BRAND_OPTIONS.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id} className="text-xs">
                      {brand.nameVi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selector */}
            {tempBrand && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Model</label>
                <Select value={tempModel} onValueChange={handleModelChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Chọn model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id} className="text-xs">
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* OS Version Selector */}
            {tempModel && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Hệ điều hành</label>
                <Select value={tempOS} onValueChange={setTempOS}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Chọn OS..." />
                  </SelectTrigger>
                  <SelectContent>
                    {osVersions.map((os) => (
                      <SelectItem key={os.id} value={os.id} className="text-xs">
                        {os.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Confirm Button */}
            {!isDeviceConfirmed && (
              <Button
                onClick={handleConfirm}
                disabled={!canConfirm}
                size="sm"
                className="mt-2 h-8 text-xs gap-1.5"
              >
                <Check className="w-3 h-3" />
                Xác nhận thiết bị
              </Button>
            )}

            {/* Device Info Summary (when confirmed) */}
            {isDeviceConfirmed && !isWorkflowActive && (
              <div className="mt-2 p-2 rounded bg-muted/50 border space-y-0.5">
                <p className="text-[10px] font-medium">{selectedBrandData?.nameVi}</p>
                <p className="text-[9px] text-muted-foreground">{selectedModelData?.name}</p>
                <p className="text-[9px] text-muted-foreground">
                  {osVersions.find((o) => o.id === tempOS)?.name}
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Step Control Panel - Vùng khoanh đỏ */}
      {selectedWorkflow && (
        <Card className="flex-none">
          <StepControlPanel
            onAskAI={onAskAI}
            onStartAIAutomation={startAutomation}
            onStopAIAutomation={stopAutomation}
            canUseAIAutomation={isScrcpyAvailable}
          />
        </Card>
      )}

      {/* AI Action Log Panel - shows when AI is running or has logs */}
      {(isAIRunning || aiLogs.length > 0) && (
        <Card className="flex-none max-h-[200px]">
          <AIActionLogPanel maxHeight="180px" />
        </Card>
      )}
    </div>
  );
}
