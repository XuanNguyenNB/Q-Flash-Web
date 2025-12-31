/**
 * ADBAppManager Component
 * 
 * Manages installed applications on the device via ADB.
 * Features:
 * - List user/system apps
 * - Install APKs
 * - Uninstall apps (Single & Multi-select)
 * - Backup APKs option
 * - Filter/Search
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// Hooks
import { useADB } from '@/hooks/useADB';
import { useDeviceStore } from '@/stores/deviceStore';
import { type ADBAppEntry } from '@/core/ADBProtocol'; // Import type

// Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Icons
import {
    Activity,
    Trash2,
    RefreshCw,
    Search,
    Upload,
    Smartphone,
    Package,
    HardDrive,
    Loader2,
    CheckSquare,
    Square,
    Eraser,
    Ban,
    Download as DownloadIcon,
    Power,
    Copy,
    Info,
    Shield,
    User, // Added
    Cpu   // Added
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

export function ADBAppManager() {
    const { t } = useTranslation();
    const { listPackages, installAPK, uninstallPackage, getPackagePath, pullFile, runCommand, pendingOperation } = useADB();
    const { isConnected } = useDeviceStore();

    // State
    const [apps, setApps] = useState<ADBAppEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [appType, setAppType] = useState<'user' | 'system' | 'enabled' | 'disabled'>('user');

    // Selection state
    const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());

    // Dialog States
    const [uninstallTarget, setUninstallTarget] = useState<string[] | null>(null); // Array for multi
    const [wantsBackup, setWantsBackup] = useState(false);
    const [permissionTarget, setPermissionTarget] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<{ name: string, granted: boolean }[]>([]);
    const [permSearch, setPermSearch] = useState('');
    const [clearDataTarget, setClearDataTarget] = useState<string | null>(null); // For clear data confirm
    const [permLoading, setPermLoading] = useState(false);

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Fetch app list
     */
    const fetchApps = async (type: 'user' | 'system' | 'enabled' | 'disabled') => {
        if (!isConnected) return;

        setLoading(true);
        setSelectedApps(new Set()); // Reset selection on refresh to avoid ghosts
        try {
            // Updated to pass category as filter
            const list = await listPackages(type);
            setApps(list);
        } catch (error) {
            console.error(error);
            toast.error(t('common.error', 'Error fetching apps'));
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch when connection or type changes
    useEffect(() => {
        if (isConnected) {
            fetchApps(appType);
        } else {
            setApps([]);
            setSelectedApps(new Set());
        }
    }, [isConnected, appType]);

    /**
     * Install Handler
     */
    const handleInstallClick = () => {
        fileInputRef.current?.click();
    };

    const [installProgress, setInstallProgress] = useState<number | null>(null);

    // ...

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        try {
            // Snapshot current apps to check for new one later
            const beforeApps = new Set(apps.map(a => a.package));

            toast.info(t('adb.apps.installConfirm', 'Check your device to confirm installation!'));
            setInstallProgress(0);

            const success = await installAPK(file, (p) => setInstallProgress(p));

            setInstallProgress(null);

            if (success) {
                // Verify by checking if a new app appeared
                // We fetch the list again
                const currentList = await listPackages(appType); // Reuse current filter
                setApps(currentList);

                // Find difference
                const newApps = currentList.filter(a => !beforeApps.has(a.package));

                if (newApps.length > 0) {
                    toast.success(t('adb.apps.installSuccessNamed', { app: newApps[0].package, name: file.name }));
                } else {
                    // Could be an update or verification failed, but command said success
                    toast.success(t('adb.apps.installSuccess', { app: file.name }));
                }
            } else {
                toast.error(t('adb.apps.installFailed', { app: file.name }));
            }
        } catch (error) {
            setInstallProgress(null);
            toast.error(t('adb.apps.installFailed', { app: file.name }));
        }
    };

    const handlePermissionClick = async (pkg: string) => {
        setPermissionTarget(pkg);
        setPermLoading(true);
        setPermissions([]);

        try {
            // Get all permissions asked by app
            // dump package <pkg> returns insanely long text, we need to parse it or use `dumpsys package <pkg>`
            // Using `dumpsys package <pkg>` is standard.
            const output = await runCommand(`dumpsys package ${pkg}`);

            if (output) {
                // Parse the output. This is tricky as format varies by Android version.
                // Look for "requested permissions:" section and "install permissions:" / "runtime permissions:"
                // Simplified approach: find lines containing "android.permission." and check if "granted=true" nearby

                // Better approach for GUI:
                // 1. Get requested permissions
                const requested: string[] = [];
                const granted = new Set<string>();

                const lines = output.split('\n');
                let inRequested = false;
                let inRuntime = false;

                for (const line of lines) {
                    const l = line.trim();
                    if (l.startsWith('requested permissions:')) {
                        inRequested = true;
                        inRuntime = false;
                        continue;
                    }
                    if (l.startsWith('runtime permissions:')) {
                        inRequested = false;
                        inRuntime = true;
                        continue;
                    }
                    if (l.startsWith('install permissions:') || l === '') {
                        inRequested = false; // end section
                    }

                    if (inRequested) {
                        // Extract permission name
                        const match = l.match(/(android\.permission\.[A-Z_0-9]+)/);
                        if (match) requested.push(match[1]);
                    }
                    if (inRuntime) {
                        const match = l.match(/(android\.permission\.[A-Z_0-9]+): granted=(true|false)/);
                        if (match) {
                            if (match[2] === 'true') granted.add(match[1]);
                        }
                    }
                }

                // Combine
                const parsed = requested.map(p => ({
                    name: p.replace('android.permission.', ''),
                    granted: granted.has(p)
                })).sort((a, b) => a.name.localeCompare(b.name));

                // If parsing fail (empty), maybe fallback or show empty
                if (parsed.length === 0) {
                    // Try another regex if standard fail
                    // Sometimes just list of permissions
                }

                setPermissions(parsed);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch permissions");
        } finally {
            setPermLoading(false);
        }
    };

    const togglePermission = async (permName: string, currentGranted: boolean) => {
        if (!permissionTarget) return;
        const fullPerm = `android.permission.${permName}`;
        const cmd = currentGranted ? 'revoke' : 'grant';

        try {
            const res = await runCommand(`pm ${cmd} ${permissionTarget} ${fullPerm}`);
            if (res && res.includes('SecurityException')) {
                toast.error(`Failed to ${cmd}: Security Exception (Root needed?)`);
            } else {
                toast.success(`${cmd}ed ${permName}`);
                // Update local state
                setPermissions(prev => prev.map(p =>
                    p.name === permName ? { ...p, granted: !currentGranted } : p
                ));
            }
        } catch (e) {
            toast.error(String(e));
        }
    };

    /**
     * Uninstall Handlers
     */
    const confirmUninstallSingle = (pkg: string) => {
        setUninstallTarget([pkg]);
        setWantsBackup(false);
    };

    const confirmUninstallMulti = () => {
        if (selectedApps.size === 0) return;
        setUninstallTarget(Array.from(selectedApps));
        setWantsBackup(false);
    };

    const handleCopyPackage = (pkg: string) => {
        navigator.clipboard.writeText(pkg);
        toast.success(t('adb.apps.copySuccess', { text: pkg }));
    };

    /**
     * Advanced Actions
     */
    const handleSaveApk = async (pkgs: string[]) => {
        if (!pkgs.length) return;

        let count = 0;
        for (const pkg of pkgs) {
            try {
                const path = await getPackagePath(pkg);
                if (path) {
                    const blob = await pullFile(path);
                    if (blob) {
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${pkg}_backup.apk`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        count++;
                        // Delay for browser download handling
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            } catch (error) {
                console.error(`Failed to save APK for ${pkg}`, error);
            }
        }
        if (count > 0) toast.success(t('adb.apps.saveSuccess', { count }));
    };

    const handleClearData = (pkg: string) => {
        setClearDataTarget(pkg);
    };

    const executeClearData = async () => {
        if (!clearDataTarget) return;

        const pkg = clearDataTarget;
        setClearDataTarget(null);

        const result = await runCommand(`pm clear ${pkg}`);
        if (result && (result.includes('Success') || result === '')) {
            toast.success(t('adb.apps.clearedSuccess', { package: pkg }));
        } else {
            toast.error(t('adb.files.actionFailed', { error: result || 'Unknown' }));
        }
    };

    const handleDisable = async (pkg: string) => {
        // Toggle based on current state? For now assume disable.
        // Or check `pm list packages -d`
        // Simplified: Button is "Disable" 
        const result = await runCommand(`pm disable-user --user 0 ${pkg}`);
        if (result && (result.includes('Success') || result.includes('disabled'))) {
            toast.success(t('adb.apps.disableSuccess', { package: pkg }));
            // Refresh app list to show disabled status
            fetchApps(appType);
        } else {
            toast.error(t('adb.files.actionFailed', { error: result || 'Unknown' }));
        }
    };

    const handleUninstall = async () => {
        if (!uninstallTarget || uninstallTarget.length === 0) return;

        const total = uninstallTarget.length;
        let successCount = 0;

        for (const pkg of uninstallTarget) {
            try {
                // 1. Backup if requested
                if (wantsBackup) {
                    const path = await getPackagePath(pkg);
                    if (path) {
                        const blob = await pullFile(path);
                        if (blob) {
                            // Trigger download
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${pkg}_backup.apk`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            // Brief pause to ensure browser handles download trigger
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }
                }

                // 2. Uninstall
                const success = await uninstallPackage(pkg);
                if (success) {
                    successCount++;
                    setApps(prev => prev.filter(p => p.package !== pkg));
                    setSelectedApps(prev => {
                        const next = new Set(prev);
                        next.delete(pkg);
                        return next;
                    });
                }
            } catch (err) {
                console.error(`Failed to process ${pkg}`, err);
            }
        }

        if (successCount === total) {
            toast.success(t('adb.apps.uninstallSuccess', { package: `${successCount} apps` }));
        } else {
            toast.warning(`Uninstalled ${successCount}/${total} apps`);
        }

        setUninstallTarget(null);
    };

    /**
     * Selection Handlers
     */
    const toggleSelect = (pkg: string) => {
        setSelectedApps(prev => {
            const next = new Set(prev);
            if (next.has(pkg)) next.delete(pkg);
            else next.add(pkg);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedApps.size === filteredApps.length) {
            setSelectedApps(new Set());
        } else {
            setSelectedApps(new Set(filteredApps.map(app => app.package)));
        }
    };

    // Filter apps
    const filteredApps = apps.filter(app =>
        app.package.toLowerCase().includes(search.toLowerCase())
    );

    const isBusy = !!pendingOperation || loading;

    // Helper to beautify package name
    // e.g. com.google.android.youtube -> Youtube
    const getAppLabel = (pkg: string) => {
        const parts = pkg.split('.');
        const last = parts[parts.length - 1];
        if (!last) return pkg;
        return last.charAt(0).toUpperCase() + last.slice(1);
    };

    // Generate consistent color from string
    const stringToColor = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Use HSL for better predefined colors (S=70%, L=60%)
        const h = Math.abs(hash) % 360;
        return `hsl(${h}, 70%, 50%)`; // Background color
    }; // We will use this in the style prop

    const getInitials = (pkg: string) => {
        const label = getAppLabel(pkg);
        return label.substring(0, 1).toUpperCase();
    }

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground border-2 border-dashed rounded-lg bg-muted/30">
                <Smartphone className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('adb.scrcpy.connectFirst', 'Connect device first')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 flex-1 w-full">


                    <Tabs value={appType} onValueChange={(v) => setAppType(v as any)} className="w-auto">
                        <TabsList>
                            <TabsTrigger value="user">
                                <User className="w-4 h-4 mr-2" />
                                {t('adb.apps.user', 'User Apps')}
                            </TabsTrigger>
                            <TabsTrigger value="system">
                                <Cpu className="w-4 h-4 mr-2" />
                                {t('adb.apps.system', 'System Apps')}
                            </TabsTrigger>
                            <TabsTrigger value="enabled">
                                <CheckSquare className="w-4 h-4 mr-2" />
                                {t('adb.apps.enabled', 'Enabled Apps')}
                            </TabsTrigger>
                            <TabsTrigger value="disabled">
                                <Ban className="w-4 h-4 mr-2" />
                                {t('adb.apps.disabled', 'Disabled Apps')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {selectedApps.size > 0 && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => handleSaveApk(Array.from(selectedApps))}
                                disabled={isBusy}
                                className="gap-2 animate-in fade-in zoom-in duration-200"
                            >
                                <DownloadIcon className="h-4 w-4" />
                                {t('adb.apps.saveSelected', 'Save')}
                            </Button>

                            <Button
                                variant="destructive"
                                onClick={confirmUninstallMulti}
                                disabled={isBusy}
                                className="gap-2 animate-in fade-in zoom-in duration-200"
                            >
                                <Trash2 className="h-4 w-4" />
                                {t('adb.apps.uninstallSelected', `Uninstall (${selectedApps.size})`)}
                            </Button>
                        </div>
                    )}

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fetchApps(appType)}
                        disabled={isBusy}
                        title={t('common.refresh', 'Refresh')}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>

                    <Button
                        onClick={handleInstallClick}
                        disabled={isBusy}
                        className="gap-2"
                    >
                        <Upload className="h-4 w-4" />
                        {t('adb.apps.install', 'Install APK')}
                    </Button>
                    <input
                        type="file"
                        accept=".apk"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>
            </div>

            {/* App List */}
            <Card className="flex-1 overflow-hidden flex flex-col">
                <CardHeader className="py-3 px-4 border-b flex-none bg-muted/40">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="select-all"
                                checked={filteredApps.length > 0 && selectedApps.size === filteredApps.length}
                                onCheckedChange={toggleSelectAll}
                            />
                            <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                                {t('adb.apps.packageName', 'Select All')}
                            </Label>
                        </div>
                        <div className="flex-1 px-4">
                            <div className="relative max-w-sm mx-auto">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('adb.apps.search', 'Search apps...')}
                                    className="pl-9 h-9" // slightly smaller height for header
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground min-w-[60px]">
                            {filteredApps.length} apps
                        </div>
                    </div>
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {t('common.loading', 'Loading...')}
                        </div>
                    ) : filteredApps.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Package className="w-10 h-10 mb-2 opacity-20" />
                            <p>{t('adb.apps.noApps', 'No apps found')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1">
                            {filteredApps.map((app) => {
                                const isSelected = selectedApps.has(app.package);
                                return (
                                    <div
                                        key={app.package}
                                        className={cn(
                                            "flex items-center justify-between p-2 rounded-lg border transition-colors group",
                                            isSelected ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-accent/50",
                                            !app.enabled && "opacity-60 bg-muted/50"
                                        )}
                                        onClick={(e) => {
                                            // Toggle selection on row click if control Key pressed or just normal click?
                                            // Standard UX: Click checkbox to select, click row needed? 
                                            // Let's rely on Checkbox for selection to avoid accidental uninstalls
                                        }}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleSelect(app.package)}
                                                className="ml-1"
                                            />

                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-none shadow-sm transition-transform group-hover:scale-105"
                                                style={{ backgroundColor: !app.enabled ? '#71717a' : stringToColor(app.package) }}
                                            >
                                                {/* Pseudo Icon */}
                                                {/* Use first letter of label */}
                                                <span className="text-lg font-bold drop-shadow-md">
                                                    {getAppLabel(app.package).charAt(0)}
                                                </span>
                                            </div>

                                            <div className="min-w-0 flex flex-col justify-center gap-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold truncate text-foreground">
                                                        {getAppLabel(app.package)}
                                                    </p>
                                                    <div className="flex gap-1">
                                                        <Badge variant={app.type === 'user' ? 'default' : 'secondary'} className="text-[10px] h-4 px-1 py-0">
                                                            {app.type === 'user' ? 'User' : 'System'}
                                                        </Badge>
                                                        {!app.enabled && (
                                                            <Badge variant="destructive" className="text-[10px] h-4 px-1 py-0">
                                                                Disabled
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate font-mono" title={app.package}>
                                                    {app.package}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-blue-500 hover:bg-blue-500/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopyPackage(app.package);
                                                }}
                                                title={t('adb.apps.copyPackage', 'Copy Package Name')}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-green-600 hover:bg-green-600/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handlePermissionClick(app.package);
                                                }}
                                                title={t('adb.apps.permissions', 'Set Permissions')}
                                            >
                                                <Shield className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-primary hover:bg-primary/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSaveApk([app.package]);
                                                }}
                                                title={t('adb.apps.saveApk', 'Save APK')}
                                            >
                                                <DownloadIcon className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-orange-500 hover:bg-orange-500/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleClearData(app.package);
                                                }}
                                                title={t('adb.apps.clearData', 'Clear Data')}
                                            >
                                                <Eraser className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-purple-500 hover:bg-purple-500/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDisable(app.package);
                                                }}
                                                title={t('adb.apps.disable', 'Disable')}
                                            >
                                                <Ban className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    confirmUninstallSingle(app.package);
                                                }}
                                                title={t('adb.apps.uninstall', 'Uninstall')}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Card>

            {/* Uninstall Confirmation Dialog */}
            <AlertDialog open={!!uninstallTarget} onOpenChange={(open) => !open && setUninstallTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {uninstallTarget?.length && uninstallTarget.length > 1
                                ? t('adb.apps.uninstallSelected', 'Uninstall Selected Apps')
                                : t('adb.apps.uninstall', 'Uninstall Application')
                            }
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {uninstallTarget?.length && uninstallTarget.length > 1
                                ? t('adb.apps.confirmMultiUninstall', { count: uninstallTarget.length })
                                : t('adb.apps.confirmUninstall', { package: uninstallTarget?.[0] })
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {/* Backup Option */}
                    <div className="flex items-center space-x-2 py-4">
                        <Switch id="backup-mode" checked={wantsBackup} onCheckedChange={setWantsBackup} />
                        <Label htmlFor="backup-mode">{t('adb.apps.backupApk', 'Backup APK(s) before uninstalling')}</Label>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleUninstall}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t('adb.apps.uninstall', 'Uninstall')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Permission Dialog */}
            <Dialog open={!!permissionTarget} onOpenChange={(open) => !open && setPermissionTarget(null)}>
                <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-6">
                    <DialogHeader className="flex-none">
                        <DialogTitle>{t('adb.apps.permissions', 'Permissions')}</DialogTitle>
                        <DialogDescription className="truncate">
                            {permissionTarget}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative flex-none my-2">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={permSearch}
                            onChange={(e) => setPermSearch(e.target.value)}
                            placeholder={t('adb.apps.searchPermissions', 'Search permissions...')}
                            className="pl-9"
                        />
                    </div>

                    <div className="flex-1 min-h-0 border rounded-md overflow-hidden bg-background">
                        <ScrollArea className="h-full w-full p-2">
                            {permLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : permissions.length === 0 ? (
                                <div className="text-center text-sm text-muted-foreground py-4">
                                    {t('adb.apps.noPermissions', 'No permissions found')}
                                </div>
                            ) : (
                                <div className="space-y-1 pr-3 pb-2">
                                    {permissions
                                        .filter(p => p.name.toLowerCase().includes(permSearch.toLowerCase()))
                                        .map((p) => (
                                            <div key={p.name} className="flex items-center space-x-2 py-1.5 px-2 hover:bg-accent rounded transition-colors w-full">
                                                <Checkbox
                                                    id={`perm-${p.name}`}
                                                    checked={p.granted}
                                                    onCheckedChange={() => togglePermission(p.name, p.granted)}
                                                    className="mt-0.5 shrink-0"
                                                />
                                                <label
                                                    htmlFor={`perm-${p.name}`}
                                                    className="text-sm leading-snug font-mono text-muted-foreground peer-data-[state=checked]:text-foreground break-all cursor-pointer flex-1"
                                                >
                                                    {p.name}
                                                </label>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    <DialogFooter className="flex-none mt-2">
                        <Button onClick={() => setPermissionTarget(null)}>
                            {t('common.close', 'Close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Install Progress Dialog */}
            <Dialog open={installProgress !== null} onOpenChange={() => { }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('adb.apps.installing', 'Installing APK')}</DialogTitle>
                        <DialogDescription>
                            {t('adb.apps.installingDesc', 'Please confirm installation on your device if prompted.')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Progress value={installProgress || 0} className="w-full" />
                        <div className="text-center text-sm text-muted-foreground">
                            {installProgress}%
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Clear Data Confirmation Dialog */}
            <AlertDialog open={!!clearDataTarget} onOpenChange={(open) => !open && setClearDataTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('adb.apps.clearData', 'Clear App Data')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('adb.apps.confirmClearData', { package: clearDataTarget })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeClearData}
                            className="bg-orange-500 text-white hover:bg-orange-600"
                        >
                            <Eraser className="w-4 h-4 mr-2" />
                            {t('adb.apps.clearData', 'Clear Data')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
