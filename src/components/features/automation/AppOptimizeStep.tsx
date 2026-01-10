/**
 * App Optimize Step Component
 *
 * Hiển thị danh sách các ứng dụng người dùng để chọn tối ưu thông báo
 * Áp dụng các lệnh ADB để đưa app vào danh sách ưu tiên
 */

import { useState, useEffect } from 'react';
import { useADB } from '@/hooks/useADB';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Bell,
  BellRing,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Zap,
  Shield,
  Battery,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OptimizationMethod } from '@/types/workflow';
import { toast } from 'sonner';

interface AppOptimizeStepProps {
  optimizationMethods?: OptimizationMethod[];
  onComplete?: () => void;
  className?: string;
}

interface OptimizeResult {
  packageName: string;
  method: OptimizationMethod;
  success: boolean;
  error?: string;
}

interface AppEntry {
  package: string;
  label?: string;
}

// Method descriptions
const METHOD_INFO: Record<OptimizationMethod, { icon: React.ReactNode; title: string; description: string }> = {
  'deviceidle-whitelist': {
    icon: <Shield className="w-4 h-4" />,
    title: 'Whitelist Battery Optimization',
    description: 'Đưa app vào danh sách không bị tối ưu pin (Doze)',
  },
  'standby-bucket-active': {
    icon: <Zap className="w-4 h-4" />,
    title: 'Active Standby Bucket',
    description: 'Đặt app ở trạng thái hoạt động cao nhất',
  },
  'disable-powergenie': {
    icon: <Battery className="w-4 h-4" />,
    title: 'Disable PowerGenie',
    description: 'Tắt dịch vụ tiết kiệm pin của Honor/Huawei',
  },
};

export function AppOptimizeStep({
  optimizationMethods = ['deviceidle-whitelist', 'standby-bucket-active'],
  onComplete,
  className,
}: AppOptimizeStepProps) {
  // App list state
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppEntry[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected packages
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());

  // Optimize state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<OptimizeResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  // ADB
  const { getInstance, listPackages } = useADB();
  const protocol = getInstance();
  const isConnected = protocol.isConnected;

  // Load user apps
  useEffect(() => {
    async function loadApps() {
      if (!isConnected) {
        setIsLoadingApps(false);
        return;
      }

      setIsLoadingApps(true);
      try {
        const userApps = await listPackages('user');
        // Sort by package name for easier browsing
        const sorted = userApps.sort((a, b) => a.package.localeCompare(b.package));
        setApps(sorted);
        setFilteredApps(sorted);

        // Pre-select common messaging apps
        const commonApps = new Set([
          'com.facebook.orca', // Messenger
          'com.facebook.katana', // Facebook
          'com.whatsapp',
          'org.telegram.messenger',
          'com.viber.voip',
          'com.zing.zalo',
          'com.google.android.gm', // Gmail
          'com.microsoft.office.outlook',
          'com.vietinbank.ipay', // Banking
          'vn.com.techcombank.bb.app',
          'com.mbmobile',
          'com.vietcombank.viettinmobile',
          'com.bidv.smartbanking',
        ]);
        const preSelected = new Set<string>();
        sorted.forEach(app => {
          if (commonApps.has(app.package)) {
            preSelected.add(app.package);
          }
        });
        setSelectedPackages(preSelected);
      } catch (error) {
        console.error('Failed to load apps:', error);
        toast.error('Không thể tải danh sách ứng dụng', {
          description: String(error),
        });
      } finally {
        setIsLoadingApps(false);
      }
    }

    loadApps();
  }, [isConnected, listPackages]);

  // Filter apps by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredApps(apps);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = apps.filter(
      app =>
        app.package.toLowerCase().includes(query) ||
        (app.label && app.label.toLowerCase().includes(query))
    );
    setFilteredApps(filtered);
  }, [searchQuery, apps]);

  // Toggle package selection
  const togglePackage = (packageName: string) => {
    setSelectedPackages(prev => {
      const next = new Set(prev);
      if (next.has(packageName)) {
        next.delete(packageName);
      } else {
        next.add(packageName);
      }
      return next;
    });
  };

  // Select all visible
  const selectAllVisible = () => {
    const all = new Set(selectedPackages);
    filteredApps.forEach(app => all.add(app.package));
    setSelectedPackages(all);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedPackages(new Set());
  };

  // Run optimization
  const runOptimization = async () => {
    if (!isConnected) {
      toast.error('Chưa kết nối ADB', {
        description: 'Vui lòng kết nối điện thoại qua ADB trước',
      });
      return;
    }

    const packagesToOptimize = Array.from(selectedPackages);
    if (packagesToOptimize.length === 0) {
      toast.warning('Chưa chọn app nào', {
        description: 'Vui lòng chọn ít nhất 1 ứng dụng để tối ưu',
      });
      return;
    }

    setIsOptimizing(true);
    setCurrentIndex(0);
    setResults([]);

    let successCount = 0;
    let failCount = 0;
    const totalOperations = packagesToOptimize.length * optimizationMethods.length;

    for (let i = 0; i < packagesToOptimize.length; i++) {
      const pkg = packagesToOptimize[i];
      setCurrentIndex(i);

      for (const method of optimizationMethods) {
        try {
          let command = '';
          switch (method) {
            case 'deviceidle-whitelist':
              command = `dumpsys deviceidle whitelist +${pkg}`;
              break;
            case 'standby-bucket-active':
              command = `am set-standby-bucket ${pkg} active`;
              break;
            case 'disable-powergenie':
              // This is a one-time operation, skip for individual apps
              continue;
          }

          const output = await protocol.runShellCommand(command);
          const success = !output.toLowerCase().includes('error') && !output.toLowerCase().includes('exception');

          setResults(prev => [...prev, { packageName: pkg, method, success }]);

          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
          setResults(prev => [
            ...prev,
            { packageName: pkg, method, success: false, error: String(error) },
          ]);
        }
      }

      // Small delay between apps
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsOptimizing(false);
    setIsComplete(true);

    // Show result toast
    const successRate = Math.round((successCount / totalOperations) * 100);
    if (successRate >= 80) {
      toast.success('Tối ưu hoàn tất!', {
        description: `Đã tối ưu ${packagesToOptimize.length} ứng dụng thành công`,
      });
    } else if (successRate >= 50) {
      toast.warning('Tối ưu một phần', {
        description: `${successCount} thành công, ${failCount} thất bại`,
      });
    } else {
      toast.error('Có nhiều lỗi xảy ra', {
        description: `Chỉ ${successCount} thành công trong tổng ${totalOperations} thao tác`,
      });
    }
  };

  // Get progress
  const progress = isOptimizing
    ? ((currentIndex + 1) / selectedPackages.size) * 100
    : isComplete
    ? 100
    : 0;

  // Complete screen
  if (isComplete) {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Tối ưu hoàn tất!</h3>
          <p className="text-muted-foreground mb-4">
            Đã tối ưu {selectedPackages.size} ứng dụng
            {failCount > 0 && ` (${failCount} thao tác thất bại)`}
          </p>
          <div className="text-sm text-muted-foreground mb-4 max-w-md">
            <p>Các ứng dụng đã được đưa vào danh sách ưu tiên.</p>
            <p className="mt-1">Thông báo sẽ được gửi nhanh hơn.</p>
          </div>
          <Button onClick={onComplete}>Tiếp tục</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {/* Header */}
      <div className="flex-none p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BellRing className="w-4 h-4" />
            Chọn ứng dụng cần tối ưu thông báo
          </h3>
          <Badge variant="secondary">
            {selectedPackages.size} đã chọn
          </Badge>
        </div>

        {/* Methods info */}
        <div className="flex flex-wrap gap-2 mb-3">
          {optimizationMethods.map(method => (
            <div
              key={method}
              className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-md text-xs"
            >
              {METHOD_INFO[method].icon}
              <span>{METHOD_INFO[method].title}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm ứng dụng..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
            disabled={isOptimizing}
          />
        </div>

        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={selectAllVisible}
            disabled={isOptimizing}
          >
            Chọn tất cả hiển thị
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={deselectAll}
            disabled={isOptimizing}
          >
            Bỏ chọn tất cả
          </Button>
        </div>
      </div>

      {/* App List */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoadingApps ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Đang tải danh sách ứng dụng...</p>
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Bell className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Kết nối ADB để xem danh sách ứng dụng
            </p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'Không tìm thấy ứng dụng phù hợp' : 'Không có ứng dụng nào'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-1">
              {filteredApps.map(app => {
                const isSelected = selectedPackages.has(app.package);
                const appResults = results.filter(r => r.packageName === app.package);
                const isCurrent =
                  isOptimizing && Array.from(selectedPackages)[currentIndex] === app.package;

                return (
                  <div
                    key={app.package}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer',
                      isSelected
                        ? 'bg-primary/5 border-primary/30'
                        : 'bg-muted/30 border-transparent hover:border-border',
                      isCurrent && 'ring-2 ring-primary',
                      appResults.length > 0 &&
                        appResults.every(r => r.success) &&
                        'bg-green-500/10 border-green-500/30',
                      appResults.length > 0 &&
                        appResults.some(r => !r.success) &&
                        'bg-amber-500/10 border-amber-500/30',
                      isOptimizing && 'cursor-not-allowed'
                    )}
                    onClick={() => !isOptimizing && togglePackage(app.package)}
                  >
                    {/* Status */}
                    <div className="flex-none">
                      {appResults.length > 0 ? (
                        appResults.every(r => r.success) ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-amber-500" />
                        )
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePackage(app.package)}
                          disabled={isOptimizing}
                        />
                      )}
                    </div>

                    {/* Package info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {app.label || app.package.split('.').pop()}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {app.package}
                      </p>
                    </div>

                    {/* Selected indicator */}
                    {isSelected && !isOptimizing && !appResults.length && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        <BellRing className="w-3 h-3 mr-1" />
                        Tối ưu
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Progress & Action */}
      <div className="flex-none p-3 border-t bg-muted/30 space-y-3">
        {isOptimizing && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-2">
                <Zap className="w-3 h-3" />
                Đang tối ưu...
              </span>
              <span className="font-medium">
                {currentIndex + 1}/{selectedPackages.size}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Button
          className="w-full"
          onClick={runOptimization}
          disabled={!isConnected || selectedPackages.size === 0 || isOptimizing}
        >
          {isOptimizing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang tối ưu...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Tối ưu {selectedPackages.size} ứng dụng
            </>
          )}
        </Button>

        {!isConnected && (
          <p className="text-xs text-center text-amber-600 dark:text-amber-400">
            Kết nối ADB để tối ưu ứng dụng
          </p>
        )}
      </div>
    </div>
  );
}
