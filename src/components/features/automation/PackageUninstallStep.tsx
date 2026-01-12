/**
 * Package Uninstall Step Component
 *
 * Hiển thị danh sách các package có thể xóa với checkbox
 * Cho phép người dùng bỏ chọn những app muốn giữ lại
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useADB } from '@/hooks/useADB';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Trash2,
  AlertTriangle,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
  Archive,
  SkipForward,
  AppWindow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PackageInfo } from '@/types/workflow';
import { toast } from 'sonner';

interface PackageUninstallStepProps {
  packagesInfo: PackageInfo[];
  onComplete?: () => void;
  className?: string;
}

interface UninstallResult {
  packageName: string;
  success: boolean;
  error?: string;
  reason?: 'not_found' | 'already_removed' | 'permission_denied' | 'unknown';
}

// Parse ADB uninstall result to get detailed reason
function parseUninstallResult(output: string, packageName: string): UninstallResult {
  const lowerOutput = output.toLowerCase();

  if (lowerOutput.includes('success')) {
    return { packageName, success: true };
  }

  if (lowerOutput.includes('not installed') || lowerOutput.includes('unknown package')) {
    return {
      packageName,
      success: false,
      reason: 'not_found',
      error: 'Ứng dụng không tồn tại trên thiết bị'
    };
  }

  if (lowerOutput.includes('delete_failed_device_policy_manager') || lowerOutput.includes('permission')) {
    return {
      packageName,
      success: false,
      reason: 'permission_denied',
      error: 'Không có quyền xóa (app hệ thống được bảo vệ)'
    };
  }

  if (lowerOutput.includes('failure')) {
    return {
      packageName,
      success: false,
      reason: 'unknown',
      error: 'Lỗi không xác định: ' + output
    };
  }

  // Consider as success if no explicit failure
  return { packageName, success: true };
}

export function PackageUninstallStep({
  packagesInfo,
  onComplete,
  className,
}: PackageUninstallStepProps) {
  // Navigation
  const navigate = useNavigate();

  // Installed packages filter state
  const [isLoadingInstalledApps, setIsLoadingInstalledApps] = useState(true);
  const [installedPackages, setInstalledPackages] = useState<Set<string>>(new Set());
  const [filteredPackagesInfo, setFilteredPackagesInfo] = useState<PackageInfo[]>([]);

  // Selected packages (will be set after filtering)
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());

  // Uninstall state
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<UninstallResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  // Backup confirmation dialog
  const [showBackupDialog, setShowBackupDialog] = useState(false);

  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  // ADB
  const { getInstance, getPackagePath, pullFile, listPackages } = useADB();
  const protocol = getInstance();
  const isConnected = protocol.isConnected;

  // Load installed packages and filter against bloatware list
  useEffect(() => {
    async function loadAndFilterPackages() {
      if (!isConnected) {
        setIsLoadingInstalledApps(false);
        // Show all packages if not connected (user can connect later)
        setFilteredPackagesInfo(packagesInfo);
        const initial = new Set<string>();
        packagesInfo.forEach((pkg) => {
          if (!pkg.isOptional) {
            initial.add(pkg.packageName);
          }
        });
        setSelectedPackages(initial);
        return;
      }

      setIsLoadingInstalledApps(true);
      try {
        // Get all installed packages (both user and system)
        const [userApps, systemApps] = await Promise.all([
          listPackages('user'),
          listPackages('system'),
        ]);

        // Combine into a Set for fast lookup
        const allInstalledSet = new Set<string>();
        userApps.forEach((app) => allInstalledSet.add(app.package));
        systemApps.forEach((app) => allInstalledSet.add(app.package));
        setInstalledPackages(allInstalledSet);

        // Filter packagesInfo to only include installed packages
        const filtered = packagesInfo.filter((pkg) => allInstalledSet.has(pkg.packageName));
        setFilteredPackagesInfo(filtered);

        // Pre-select non-optional packages that are installed
        const initial = new Set<string>();
        filtered.forEach((pkg) => {
          if (!pkg.isOptional) {
            initial.add(pkg.packageName);
          }
        });
        setSelectedPackages(initial);
      } catch (error) {
        console.error('Failed to load installed packages:', error);
        toast.error('Không thể lấy danh sách ứng dụng', {
          description: String(error),
        });
        // Fallback to showing all packages
        setFilteredPackagesInfo(packagesInfo);
        const initial = new Set<string>();
        packagesInfo.forEach((pkg) => {
          if (!pkg.isOptional) {
            initial.add(pkg.packageName);
          }
        });
        setSelectedPackages(initial);
      } finally {
        setIsLoadingInstalledApps(false);
      }
    }

    loadAndFilterPackages();
  }, [isConnected, listPackages, packagesInfo]);

  // Toggle package selection
  const togglePackage = (packageName: string) => {
    setSelectedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(packageName)) {
        next.delete(packageName);
      } else {
        next.add(packageName);
      }
      return next;
    });
  };

  // Select all (only from filtered list)
  const selectAll = () => {
    const all = new Set(filteredPackagesInfo.map((p) => p.packageName));
    setSelectedPackages(all);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedPackages(new Set());
  };

  // Show backup confirmation before uninstall
  const handleUninstallClick = () => {
    if (!isConnected) {
      toast.error('Chưa kết nối ADB', {
        description: 'Vui lòng kết nối điện thoại qua ADB trước',
      });
      return;
    }

    const packagesToUninstall = Array.from(selectedPackages);
    if (packagesToUninstall.length === 0) {
      toast.warning('Chưa chọn app nào', {
        description: 'Vui lòng chọn ít nhất 1 ứng dụng để xóa',
      });
      return;
    }

    // Show backup confirmation
    setShowBackupDialog(true);
  };

  // Start uninstalling (without backup)
  const startUninstall = async () => {
    setShowBackupDialog(false);

    const packagesToUninstall = Array.from(selectedPackages);

    setIsUninstalling(true);
    setCurrentIndex(0);
    setResults([]);

    let successCount = 0;
    let notFoundCount = 0;
    let failedCount = 0;

    for (let i = 0; i < packagesToUninstall.length; i++) {
      const pkg = packagesToUninstall[i];
      setCurrentIndex(i);

      try {
        // Run ADB uninstall command
        const command = `pm uninstall -k --user 0 ${pkg}`;
        const output = await protocol.runShellCommand(command);

        const result = parseUninstallResult(output, pkg);
        setResults((prev) => [...prev, result]);

        if (result.success) {
          successCount++;
        } else if (result.reason === 'not_found' || result.reason === 'already_removed') {
          notFoundCount++;
          // Show toast for not found apps
          toast.info(`${pkg.split('.').pop()}`, {
            description: 'Ứng dụng không tồn tại hoặc đã bị xóa trước đó',
          });
        } else {
          failedCount++;
          // Show toast for failed apps
          toast.error(`Không thể xóa ${pkg.split('.').pop()}`, {
            description: result.error,
          });
        }
      } catch (error) {
        failedCount++;
        setResults((prev) => [
          ...prev,
          { packageName: pkg, success: false, error: String(error), reason: 'unknown' },
        ]);
        toast.error(`Lỗi khi xóa ${pkg.split('.').pop()}`, {
          description: String(error),
        });
      }

      // Small delay between uninstalls
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setIsUninstalling(false);
    setIsComplete(true);

    // Final summary toast
    if (successCount > 0) {
      toast.success('Hoàn tất xóa ứng dụng', {
        description: `Đã xóa ${successCount} ứng dụng${notFoundCount > 0 ? `, ${notFoundCount} không tồn tại` : ''}${failedCount > 0 ? `, ${failedCount} thất bại` : ''}`,
      });
    } else if (notFoundCount === packagesToUninstall.length) {
      toast.info('Tất cả ứng dụng đã được xóa trước đó', {
        description: 'Không có ứng dụng nào cần xóa',
      });
    }
  };

  // Backup apps then uninstall
  const backupAndUninstall = async () => {
    setShowBackupDialog(false);

    const packagesToBackup = Array.from(selectedPackages);
    setIsBackingUp(true);
    setBackupProgress(0);

    let backupCount = 0;
    let failedCount = 0;

    // If more than 1 app, use File System Access API to select folder
    let directoryHandle: FileSystemDirectoryHandle | null = null;
    if (packagesToBackup.length > 1 && 'showDirectoryPicker' in window) {
      try {
        directoryHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads',
        });
        toast.info('Đã chọn thư mục sao lưu', {
          description: directoryHandle.name,
        });
      } catch (error) {
        // User cancelled or API not supported
        if ((error as Error).name !== 'AbortError') {
          console.error('Directory picker error:', error);
        }
        // Fall back to individual downloads
        directoryHandle = null;
      }
    }

    for (let i = 0; i < packagesToBackup.length; i++) {
      const pkg = packagesToBackup[i];
      setBackupProgress(((i + 1) / packagesToBackup.length) * 100);

      try {
        const path = await getPackagePath(pkg);
        if (path) {
          const blob = await pullFile(path);
          if (blob) {
            const fileName = `${pkg}_backup.apk`;

            if (directoryHandle) {
              // Save directly to selected folder
              try {
                const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                backupCount++;
              } catch (writeError) {
                console.error(`Failed to write ${fileName}:`, writeError);
                failedCount++;
              }
            } else {
              // Fallback: trigger individual download
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
              backupCount++;
              // Brief pause to ensure browser handles download trigger
              await new Promise(r => setTimeout(r, 500));
            }
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Failed to backup ${pkg}:`, error);
        failedCount++;
      }
    }

    setIsBackingUp(false);
    setBackupProgress(0);

    if (backupCount > 0) {
      toast.success(`Đã sao lưu ${backupCount} ứng dụng`, {
        description: directoryHandle
          ? `Lưu vào thư mục: ${directoryHandle.name}`
          : failedCount > 0 ? `${failedCount} ứng dụng không tìm thấy` : 'Tiếp tục xóa...',
      });
    } else if (failedCount > 0) {
      toast.warning('Không thể sao lưu', {
        description: 'Các ứng dụng có thể đã bị xóa hoặc không tồn tại',
      });
    }

    // Proceed with uninstall after backup
    await startUninstall();
  };

  // Get progress
  const progress = isUninstalling
    ? ((currentIndex + 1) / selectedPackages.size) * 100
    : isComplete
    ? 100
    : 0;

  // Group packages from filtered list
  const recommendedPackages = filteredPackagesInfo.filter((p) => !p.isOptional);
  const optionalPackages = filteredPackagesInfo.filter((p) => p.isOptional);

  if (isComplete) {
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    return (
      <div className={cn('flex flex-col h-full', className)}>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Hoàn tất!</h3>
          <p className="text-muted-foreground mb-4">
            Đã xóa thành công {successCount} ứng dụng
            {failCount > 0 && ` (${failCount} thất bại)`}
          </p>
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
            <Trash2 className="w-4 h-4" />
            Chọn ứng dụng cần xóa
          </h3>
          <Badge variant="secondary">
            {selectedPackages.size}/{filteredPackagesInfo.length} đã chọn
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={selectAll}
            disabled={isUninstalling || isLoadingInstalledApps}
          >
            Chọn tất cả
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={deselectAll}
            disabled={isUninstalling || isLoadingInstalledApps}
          >
            Bỏ chọn tất cả
          </Button>
        </div>
      </div>

      {/* Package List - Scrollable with fixed height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoadingInstalledApps ? (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Đang kiểm tra ứng dụng trên thiết bị...</p>
          </div>
        ) : filteredPackagesInfo.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Tuyệt vời!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Không tìm thấy ứng dụng rác nào trên thiết bị.<br />
              Có thể bạn đã dọn dẹp trước đó rồi.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={onComplete}>Tiếp tục</Button>
              <Button
                variant="outline"
                onClick={() => navigate('/adb?tab=app-manager')}
                className="gap-2"
              >
                <AppWindow className="w-4 h-4" />
                Gỡ theo ý bạn
              </Button>
            </div>
          </div>
        ) : (
        <ScrollArea className="h-full">
        <div className="p-3 space-y-4">
          {/* Info banner showing how many apps were found */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <Info className="w-4 h-4 text-blue-500 flex-none" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Tìm thấy <strong>{filteredPackagesInfo.length}</strong> ứng dụng rác trên thiết bị (trong tổng số {packagesInfo.length} app trong danh sách).
              Bỏ tích những app bạn muốn giữ lại.
            </p>
          </div>

          {/* Recommended packages */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Package className="w-3 h-3" />
              Ứng dụng nên xóa ({recommendedPackages.length})
            </h4>
            <div className="space-y-1">
              {recommendedPackages.map((pkg) => (
                <PackageItem
                  key={pkg.packageName}
                  pkg={pkg}
                  isSelected={selectedPackages.has(pkg.packageName)}
                  onToggle={() => togglePackage(pkg.packageName)}
                  disabled={isUninstalling}
                  result={results.find((r) => r.packageName === pkg.packageName)}
                  isCurrent={
                    isUninstalling &&
                    Array.from(selectedPackages)[currentIndex] === pkg.packageName
                  }
                />
              ))}
            </div>
          </div>

          {/* Optional packages */}
          {optionalPackages.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Tùy chọn - Cân nhắc trước khi xóa ({optionalPackages.length})
              </h4>
              <div className="space-y-1">
                {optionalPackages.map((pkg) => (
                  <PackageItem
                    key={pkg.packageName}
                    pkg={pkg}
                    isSelected={selectedPackages.has(pkg.packageName)}
                    onToggle={() => togglePackage(pkg.packageName)}
                    disabled={isUninstalling}
                    result={results.find((r) => r.packageName === pkg.packageName)}
                    isCurrent={
                      isUninstalling &&
                      Array.from(selectedPackages)[currentIndex] === pkg.packageName
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        </ScrollArea>
        )}
      </div>

      {/* Progress & Action */}
      <div className="flex-none p-3 border-t bg-muted/30 space-y-3">
        {isBackingUp && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-2">
                <Archive className="w-3 h-3" />
                Đang sao lưu...
              </span>
              <span className="font-medium">
                {Math.round(backupProgress)}%
              </span>
            </div>
            <Progress value={backupProgress} className="h-2" />
          </div>
        )}

        {isUninstalling && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Đang xóa...</span>
              <span className="font-medium">
                {currentIndex + 1}/{selectedPackages.size}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <Button
          className="w-full"
          onClick={handleUninstallClick}
          disabled={!isConnected || selectedPackages.size === 0 || isUninstalling || isBackingUp}
        >
          {isBackingUp ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang sao lưu...
            </>
          ) : isUninstalling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang xóa...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Xóa {selectedPackages.size} ứng dụng đã chọn
            </>
          )}
        </Button>

        {!isConnected && (
          <p className="text-xs text-center text-amber-600 dark:text-amber-400">
            Kết nối ADB để xóa ứng dụng
          </p>
        )}
      </div>

      {/* Backup Confirmation Dialog */}
      <AlertDialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              Sao lưu ứng dụng?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có muốn sao lưu {selectedPackages.size} ứng dụng trước khi xóa không?
              <br /><br />
              <span className="text-amber-600 dark:text-amber-400">
                Lưu ý: Sau khi xóa, bạn sẽ không thể khôi phục dữ liệu của các ứng dụng này.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowBackupDialog(false)}>
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={backupAndUninstall}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Archive className="w-4 h-4 mr-2" />
              Sao lưu rồi xóa
            </AlertDialogAction>
            <AlertDialogAction
              onClick={startUninstall}
              className="bg-red-600 hover:bg-red-700"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Xóa luôn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Individual package item
 */
interface PackageItemProps {
  pkg: PackageInfo;
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  result?: UninstallResult;
  isCurrent?: boolean;
}

function PackageItem({
  pkg,
  isSelected,
  onToggle,
  disabled,
  result,
  isCurrent,
}: PackageItemProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2 rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'bg-primary/5 border-primary/30'
          : 'bg-muted/30 border-transparent',
        pkg.isOptional && 'border-amber-500/30',
        pkg.warningVi && isSelected && 'bg-amber-500/10 border-amber-500/50',
        isCurrent && 'ring-2 ring-primary',
        result?.success && 'bg-green-500/10 border-green-500/30',
        result && !result.success && 'bg-red-500/10 border-red-500/30',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
      onClick={() => !disabled && !result && onToggle()}
    >
      {/* Checkbox or Status */}
      <div className="flex-none pt-0.5">
        {result ? (
          result.success ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )
        ) : isCurrent ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle()}
            disabled={disabled}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {pkg.nameVi || pkg.name}
          </span>
          {pkg.isOptional && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-amber-600 border-amber-500/50">
              Tùy chọn
            </Badge>
          )}
        </div>
        {pkg.descriptionVi && (
          <p className="text-xs text-muted-foreground truncate">
            {pkg.descriptionVi}
          </p>
        )}
        {pkg.warningVi && (
          <div className="flex items-start gap-1 mt-1 p-1.5 rounded bg-amber-500/20 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-600 flex-none mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {pkg.warningVi}
            </p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
          {pkg.packageName}
        </p>
      </div>
    </div>
  );
}
