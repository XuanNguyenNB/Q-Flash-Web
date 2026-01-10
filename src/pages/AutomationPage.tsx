/**
 * Automation Page (Tự động hóa)
 *
 * Layout theo sketch:
 * [Workflow + State] | [PHONE lớn] | [Video Hướng dẫn]
 */

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useDeviceStore } from '@/stores/deviceStore';
import { useADBStore } from '@/stores/adbStore';
import { useADB } from '@/hooks/useADB';
import { useWorkflowStore } from '@/stores/workflowStore';

// Components
import { ScrcpyPanel } from '@/components/features/adb/ScrcpyPanel';
import { ADBConnectionStatus } from '@/components/features/adb/ADBConnectionStatus';
import { ADBAuthorizationDialog } from '@/components/features/adb/ADBAuthorizationDialog';
import { DeviceInUseDialog } from '@/components/features/adb/DeviceInUseDialog';
import { UserGestureRequiredDialog } from '@/components/features/adb/UserGestureRequiredDialog';
import { VideoGuidePanel } from '@/components/features/automation/VideoGuidePanel';
import { ADBSetupGuide } from '@/components/features/automation/ADBSetupGuide';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Icons
import {
  Monitor,
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
  Workflow,
  Smartphone,
  Settings,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { getWorkflowsByDeviceWithCustom } from '@/stores/customWorkflowStore';

/**
 * Map manufacturer name to brand ID
 */
function mapManufacturerToBrand(manufacturer: string): string | null {
  const lowerMfg = manufacturer.toLowerCase().trim();

  // Honor detection
  if (lowerMfg.includes('honor') || lowerMfg.includes('hihonor')) {
    return 'honor';
  }

  // Oppo detection
  if (lowerMfg.includes('oppo')) {
    return 'oppo';
  }

  // Realme detection (uses same workflows as Oppo)
  if (lowerMfg.includes('realme')) {
    return 'oppo'; // Realme uses ColorOS, same as Oppo
  }

  // OnePlus detection (uses same workflows as Oppo)
  if (lowerMfg.includes('oneplus') || lowerMfg.includes('one plus')) {
    return 'oppo'; // OnePlus uses ColorOS-based OxygenOS
  }

  return null;
}

export function AutomationPage() {
  const { t } = useTranslation();
  const { setMode, setConnected } = useDeviceStore();
  const { showDeviceInUseDialog, setShowDeviceInUseDialog, showUserGestureDialog, setShowUserGestureDialog, isConnecting, deviceInfo } = useADBStore();

  // Workflow store
  const {
    selectedWorkflow,
    executionStatus,
    currentStepIndex,
    stepResults,
    deviceFilter,
    selectWorkflow,
    clearSelectedWorkflow,
    setDeviceFilter,
  } = useWorkflowStore();

  // ADB
  const { connect, getDeviceInfo, getInstance } = useADB();
  const protocol = getInstance();
  const isADBConnected = protocol.isConnected;

  // Track if we've auto-detected device
  const hasAutoDetected = useRef(false);

  // Check if device is confirmed (from sidebar or auto-detected)
  const isDeviceConfirmed = deviceFilter.brand && deviceFilter.model && deviceFilter.osVersion;

  // Get available workflows (includes custom workflows)
  const availableWorkflows = getWorkflowsByDeviceWithCustom(
    deviceFilter.brand || '',
    deviceFilter.model || '',
    deviceFilter.osVersion || ''
  );

  // Set mode on mount
  useEffect(() => {
    setMode('automation');
    document.title = 'Q-Flash - Tự động hóa';
  }, [setMode]);

  // Sync store with ADB protocol state
  useEffect(() => {
    if (isADBConnected) {
      setConnected(true);
    }
  }, [isADBConnected, setConnected]);

  // Auto-detect brand from ADB device info
  useEffect(() => {
    if (!deviceInfo || hasAutoDetected.current) return;
    if (deviceFilter.brand) return; // Already has brand selected

    const manufacturer = deviceInfo.manufacturer;
    if (!manufacturer || manufacturer === 'Unknown') return;

    const detectedBrand = mapManufacturerToBrand(manufacturer);
    if (detectedBrand) {
      hasAutoDetected.current = true;

      // Auto-set device filter with detected brand
      // Use 'auto' as model and osVersion to indicate auto-detected
      setDeviceFilter({
        brand: detectedBrand,
        model: 'auto',
        osVersion: 'auto',
      });

      console.log(`[AutomationPage] Auto-detected brand: ${detectedBrand} from manufacturer: ${manufacturer}`);
    }
  }, [deviceInfo, deviceFilter.brand, setDeviceFilter]);

  // Auto-connect on page load
  const hasTriedAutoConnect = useRef(false);
  useEffect(() => {
    if (isADBConnected || hasTriedAutoConnect.current) return;
    hasTriedAutoConnect.current = true;

    const tryAutoConnect = async () => {
      try {
        const devices = await navigator.usb.getDevices();
        for (const device of devices) {
          for (const config of device.configurations) {
            for (const iface of config.interfaces) {
              for (const alt of iface.alternates) {
                if (alt.interfaceClass === 255 && alt.interfaceSubclass === 66 && alt.interfaceProtocol === 1) {
                  const success = await connect();
                  if (success) await getDeviceInfo();
                  return;
                }
              }
            }
          }
        }
      } catch (error) {
        console.debug('[AutomationPage] Auto-connect failed:', error);
      }
    };

    tryAutoConnect();
  }, [connect, getDeviceInfo, isADBConnected]);

  // Get step icon
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'adb-command': return Terminal;
      case 'install-apk': return Package;
      case 'uninstall-packages': return Trash2;
      case 'user-action': return User;
      case 'delay': return Clock;
      default: return Circle;
    }
  };

  // Get step status
  const getStepStatus = (stepId: string, index: number) => {
    const result = stepResults.get(stepId);
    if (result) return result.success ? 'completed' : 'error';
    if (executionStatus === 'running' && index === currentStepIndex) return 'running';
    if (index < currentStepIndex) return 'skipped';
    return 'pending';
  };

  // Desktop only check
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-background">
        <Monitor className="w-20 h-20 mb-6 text-muted-foreground opacity-50" />
        <h2 className="text-2xl font-bold mb-4">
          {t('automation.desktopOnly', 'Chức năng chỉ khả dụng trên Desktop')}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {t('automation.desktopOnlyDesc', 'Tính năng Tự động hóa yêu cầu màn hình lớn. Vui lòng sử dụng máy tính.')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px-48px)] bg-background">
      {/* Page Title - Compact */}
      <div className="flex-none pb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Workflow className="w-4 h-4" />
          Tự Động Hóa
        </h1>
        <Link to="/workflow-editor">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <Settings className="w-3 h-3" />
            Quản lý quy trình
          </Button>
        </Link>
      </div>

      {/* Main 3-Column Grid Layout - Full Height */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">

        {/* Column 1: Workflow + State (3 cols) */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">
          {/* Workflow Card */}
          <Card className="flex-1 min-h-0 flex flex-col border-border/50">
            <CardHeader className="pb-1.5 pt-2 px-2.5 flex-none">
              <div className="flex items-center gap-1">
                {selectedWorkflow && (
                  <Button variant="ghost" size="icon" onClick={clearSelectedWorkflow} className="-ml-0.5 h-5 w-5">
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                )}
                <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
                  <Workflow className="w-3 h-3" />
                  {selectedWorkflow ? 'Chi tiết quy trình' : 'Quy trình tự động có sẵn'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-2.5 pb-2 flex-1 overflow-hidden">
              {!isDeviceConfirmed ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Package className="w-6 h-6 mb-1.5 text-muted-foreground opacity-30" />
                  <p className="text-[10px] text-muted-foreground">Chọn thiết bị ở sidebar trái</p>
                </div>
              ) : !selectedWorkflow ? (
                <ScrollArea className="h-full">
                  {availableWorkflows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-3 text-center">
                      <Package className="w-6 h-6 mb-1.5 text-muted-foreground opacity-30" />
                      <p className="text-[10px] text-muted-foreground">Không có quy trình</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {availableWorkflows.map((workflow) => (
                        <div
                          key={workflow.id}
                          className="p-1.5 rounded border cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/50"
                          onClick={() => selectWorkflow(workflow.id)}
                        >
                          <div className="flex items-center gap-1">
                            {workflow.category === 'cleanup' && <Trash2 className="w-2.5 h-2.5 text-primary" />}
                            {workflow.category === 'optimization' && <Zap className="w-2.5 h-2.5 text-primary" />}
                            {workflow.category === 'gaming' && <Star className="w-2.5 h-2.5 text-primary" />}
                            {workflow.category === 'vietnam-setup' && <Package className="w-2.5 h-2.5 text-primary" />}
                            <span className="font-medium text-[10px] truncate">{workflow.nameVi}</span>
                            <ChevronRight className="w-2.5 h-2.5 ml-auto text-muted-foreground" />
                          </div>
                          <div className="flex gap-1 mt-0.5">
                            <Badge variant="secondary" className="text-[7px] px-1 py-0 h-3">
                              {workflow.steps.length} bước
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              ) : (
                <ScrollArea className="h-full">
                  <div className="space-y-0.5">
                    {selectedWorkflow.steps.map((step, index) => {
                      const StepIcon = getStepIcon(step.type);
                      const status = getStepStatus(step.id, index);
                      const isCurrent = index === currentStepIndex;

                      return (
                        <div
                          key={step.id}
                          className={cn(
                            'p-1 rounded border transition-all',
                            isCurrent && executionStatus !== 'idle'
                              ? 'border-primary bg-primary/5'
                              : 'border-transparent bg-muted/30'
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <div
                              className={cn(
                                'flex-none w-4 h-4 rounded-full flex items-center justify-center',
                                status === 'completed' && 'bg-green-500/10 text-green-600',
                                status === 'running' && 'bg-blue-500/10 text-blue-600',
                                status === 'error' && 'bg-red-500/10 text-red-600',
                                (status === 'pending' || status === 'skipped') && 'bg-muted text-muted-foreground'
                              )}
                            >
                              {status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                              {status === 'running' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                              {status === 'error' && <AlertCircle className="w-2.5 h-2.5" />}
                              {(status === 'pending' || status === 'skipped') && <StepIcon className="w-2.5 h-2.5" />}
                            </div>
                            <span className="text-[9px] font-medium truncate flex-1">
                              {step.titleVi || step.title}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 2: PHONE - Main Scrcpy (5 cols) - Maintain aspect ratio */}
        <div className="col-span-5 min-h-0 h-full flex items-center justify-center">
          {isADBConnected ? (
            <ScrcpyPanel className="h-full w-full" />
          ) : (
            <ADBSetupGuide className="h-full w-full" />
          )}
        </div>

        {/* Column 3: Video Guide (4 cols) - Full height fit */}
        <div className="col-span-4 min-h-0 h-full">
          <div className="h-full [&>div]:h-full [&>div]:border-border/50">
            <VideoGuidePanel />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <DeviceInUseDialog open={showDeviceInUseDialog} onClose={() => setShowDeviceInUseDialog(false)} />
      <UserGestureRequiredDialog open={showUserGestureDialog} onClose={() => setShowUserGestureDialog(false)} />
      <ADBAuthorizationDialog open={isConnecting && !showDeviceInUseDialog && !showUserGestureDialog} onClose={() => {}} />
    </div>
  );
}
