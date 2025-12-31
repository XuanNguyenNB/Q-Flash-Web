/**
 * ADBFileManager Component
 * 
 * Provides a file explorer interface for the connected ADB device.
 * Features:
 * - List files/folders
 * - Navigate path
 * - Upload/Download
 * - Delete
 * - Create Folder
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// Hooks
import { useADB } from '@/hooks/useADB';
import { useADBStore } from '@/stores/adbStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { type ADBFileEntry } from '@/core/ADBProtocol';

// Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

// Icons
import {
    Folder,
    File as FileIcon,
    ArrowUp,
    Home,
    RefreshCw,
    Download,
    Upload,
    Trash2,
    FolderPlus,
    Loader2,
    MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

const DEFAULT_PATH = '/sdcard/';

export function ADBFileManager() {
    const { t } = useTranslation();
    const {
        listDirectory,
        pushFile,
        pullFile,
        deleteFile,
        createDirectory,
        pendingOperation
    } = useADB();
    const { isConnected } = useDeviceStore();

    // State
    const [path, setPath] = useState(DEFAULT_PATH);
    const [files, setFiles] = useState<ADBFileEntry[]>([]);
    const [loading, setLoading] = useState(false);

    // Dialog States
    const [deleteTarget, setDeleteTarget] = useState<ADBFileEntry | null>(null);
    const [newFolderOpen, setNewFolderOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Load
    useEffect(() => {
        if (isConnected) {
            refresh();
        } else {
            setFiles([]);
        }
    }, [isConnected, path]);

    const refresh = async () => {
        if (!isConnected) return;
        setLoading(true);
        try {
            const list = await listDirectory(path);
            setFiles(list);
        } catch (error) {
            toast.error(t('adb.files.actionFailed', { error: String(error) }));
        } finally {
            setLoading(false);
        }
    };

    /**
     * Navigation Helpers
     */
    const navigateUp = () => {
        if (path === '/' || path === '//') return;
        const parent = path.replace(/\/?[^\/]+\/?$/, '') || '/';
        setPath(parent.endsWith('/') ? parent : parent + '/');
    };

    const navigateTo = (folderName: string) => {
        setPath(prev => prev.endsWith('/') ? `${prev}${folderName}/` : `${prev}/${folderName}/`);
    };

    /**
     * Actions
     */
    const handleDownload = async (entry: ADBFileEntry) => {
        if (entry.type !== 'file') return;

        try {
            const blob = await pullFile(entry.path);
            if (blob) {
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = entry.name;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success(t('adb.files.downloadSuccess', { file: entry.name }));
            } else {
                toast.error(t('adb.files.actionFailed', { error: 'Empty file or download failed' }));
            }
        } catch (error) {
            toast.error(t('adb.files.actionFailed', { error: String(error) }));
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;

        try {
            const success = await deleteFile(deleteTarget.path);
            if (success) {
                toast.success(t('adb.files.deleteSuccess', { file: deleteTarget.name }));
                refresh();
            } else {
                toast.error(t('adb.files.actionFailed', { error: 'Delete failed' }));
            }
        } catch (error) {
            toast.error(t('adb.files.actionFailed', { error: String(error) }));
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName) return;
        const fullPath = path.endsWith('/') ? `${path}${newFolderName}` : `${path}/${newFolderName}`;

        try {
            const success = await createDirectory(fullPath);
            if (success) {
                toast.success(t('adb.files.createDirSuccess', { dir: newFolderName }));
                refresh();
                setNewFolderOpen(false);
                setNewFolderName('');
            } else {
                toast.error(t('adb.files.actionFailed', { error: 'Create directory failed' }));
            }
        } catch (error) {
            toast.error(t('adb.files.actionFailed', { error: String(error) }));
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // ...

    const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input
        e.target.value = '';

        const remotePath = path.endsWith('/') ? `${path}${file.name}` : `${path}/${file.name}`;

        try {
            setUploadProgress(0);
            const success = await pushFile(file, remotePath, (p) => setUploadProgress(p));
            setUploadProgress(null);

            if (success) {
                toast.success(t('adb.files.uploadSuccess', { file: file.name }));
                refresh();
            } else {
                toast.error(t('adb.files.actionFailed', { error: 'Upload failed' }));
            }
        } catch (error) {
            setUploadProgress(null);
            toast.error(t('adb.files.actionFailed', { error: String(error) }));
        }
    };

    /**
     * Formatting
     */
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (date: Date) => {
        return date.toLocaleString();
    };

    const isBusy = loading || !!pendingOperation;

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground border-2 border-dashed rounded-lg bg-muted/30">
                <Folder className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('adb.scrcpy.connectFirst', 'Connect device first')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 flex-1 w-full">
                    <Button variant="outline" size="icon" onClick={() => setPath(DEFAULT_PATH)} title={t('adb.files.home', 'Home')}>
                        <Home className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={navigateUp} disabled={path === '/'} title={t('adb.files.up', 'Up')}>
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono truncate border">
                        {path}
                    </div>
                    <Button variant="outline" size="icon" onClick={refresh} title={t('adb.files.refresh', 'Refresh')}>
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <FolderPlus className="h-4 w-4" />
                                {t('adb.files.newFolder', 'New Folder')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t('adb.files.newFolder', 'Create New Folder')}</DialogTitle>
                                <DialogDescription>
                                    Enter the name for the new folder in {path}
                                </DialogDescription>
                            </DialogHeader>
                            <Input
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Folder Name"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            />
                            <DialogFooter>
                                <Button onClick={handleCreateFolder}>{t('common.confirm', 'Create')}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button size="sm" className="gap-2" onClick={handleUploadClick}>
                        <Upload className="h-4 w-4" />
                        {t('adb.files.upload', 'Upload')}
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleUploadFile}
                    />
                </div>
            </div>

            {/* File List */}
            <Card className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead>{t('adb.files.path', 'Name')}</TableHead>
                                <TableHead className="w-[100px]">{t('adb.files.size', 'Size')}</TableHead>
                                <TableHead className="w-[180px]">{t('adb.files.date', 'Date')}</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && files.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            {t('common.loading', 'Loading...')}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : files.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        {t('adb.files.emptyDir', 'Empty Directory')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                files.map((file) => (
                                    <TableRow key={file.name} className="group">
                                        <TableCell>
                                            {file.type === 'directory' ? (
                                                <Folder className="h-4 w-4 text-primary fill-primary/20" />
                                            ) : (
                                                <FileIcon className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className={cn(
                                                    "cursor-pointer hover:underline",
                                                    file.type === 'directory' && "font-medium"
                                                )}
                                                onClick={() => file.type === 'directory' && navigateTo(file.name)}
                                            >
                                                {file.name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {file.type === 'file' ? formatSize(file.size) : '-'}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {formatDate(file.mtime)}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>{t('adb.files.actions', 'Actions')}</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {file.type === 'file' && (
                                                        <DropdownMenuItem onClick={() => handleDownload(file)}>
                                                            <Download className="mr-2 h-4 w-4" />
                                                            {t('adb.files.download', 'Download')}
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={() => setDeleteTarget(file)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        {t('adb.files.delete', 'Delete')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('adb.files.delete', 'Delete File')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('adb.files.confirmDelete', { name: deleteTarget?.name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t('adb.files.delete', 'Delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Upload Progress Dialog */}
            {/* Upload Progress Overlay - Non-blocking */}
            {uploadProgress !== null && (
                <div className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-sm">{t('adb.files.uploading', 'Uploading...')}</h4>
                        <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2 w-full" />
                </div>
            )}

            {/* Hidden Dialog for accessibility if needed, but overlay is better for non-blocking */}
        </div >
    );
}
