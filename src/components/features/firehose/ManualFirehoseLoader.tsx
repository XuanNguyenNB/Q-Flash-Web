/**
 * ManualFirehoseLoader Component
 * 
 * Allows users to manually load firehose files when auto-detection fails
 * or when using an unsupported device.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceStore } from '@/stores/deviceStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { useConnectionFlow } from '@/hooks/useConnectionFlow';
import { useEDLConnectionStore, type BrandGroup } from '@/stores/edlConnectionStore';
import { toast } from 'sonner';
import {
    Upload,
    FileCode,
    Check,
    X,
    AlertCircle,
    Loader2,
    FileType,
    Plug
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileStatus {
    name: string;
    labelKey: string;
    loaded: boolean;
    size?: number;
    required: boolean;
}

interface ManualFirehoseLoaderProps {
    brandGroup?: BrandGroup;
}

/**
 * ManualFirehoseLoader - UI for manually loading firehose files
 */
export function ManualFirehoseLoader({ brandGroup = 'oppo' }: ManualFirehoseLoaderProps) {
    const { t } = useTranslation();
    const log = useTerminalStore((state) => state.log);
    const { connect: flowConnect, status: flowStatus } = useConnectionFlow();

    // Use EDL store for persistence across tab switches
    const {
        manualFirehoseFiles,
        setManualFirehoseFile,
        clearManualFirehoseFiles,
        setFirehoseLoaded,
        firehoseLoaded,
    } = useEDLConnectionStore();

    // For LG devices, only programmer is required
    // For Oppo/OnePlus/Realme, all 3 files are required
    const isLG = brandGroup === 'lg';

    // Sync local state with store on mount and when store changes
    const [files, setFiles] = useState<FileStatus[]>([
        {
            name: 'programmer',
            labelKey: 'firehose.manual.programmer',
            loaded: manualFirehoseFiles.programmer !== null,
            size: manualFirehoseFiles.programmer?.size,
            required: true
        },
        {
            name: 'digest',
            labelKey: 'firehose.manual.digest',
            loaded: manualFirehoseFiles.digest !== null,
            size: manualFirehoseFiles.digest?.size,
            required: !isLG
        },
        {
            name: 'signature',
            labelKey: 'firehose.manual.signature',
            loaded: manualFirehoseFiles.signature !== null,
            size: manualFirehoseFiles.signature?.size,
            required: !isLG
        },
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentFileType, setCurrentFileType] = useState<string | null>(null);

    // Sync local file state with store
    useEffect(() => {
        setFiles([
            {
                name: 'programmer',
                labelKey: 'firehose.manual.programmer',
                loaded: manualFirehoseFiles.programmer !== null,
                size: manualFirehoseFiles.programmer?.size,
                required: true
            },
            {
                name: 'digest',
                labelKey: 'firehose.manual.digest',
                loaded: manualFirehoseFiles.digest !== null,
                size: manualFirehoseFiles.digest?.size,
                required: !isLG
            },
            {
                name: 'signature',
                labelKey: 'firehose.manual.signature',
                loaded: manualFirehoseFiles.signature !== null,
                size: manualFirehoseFiles.signature?.size,
                required: !isLG
            },
        ]);
    }, [manualFirehoseFiles, isLG]);

    // Update file requirements when brand group changes
    useEffect(() => {
        setFiles(prev => prev.map(f => ({
            ...f,
            required: f.name === 'programmer' ? true : !isLG
        })));
    }, [isLG]);

    // Re-evaluate firehoseLoaded when brand group or files change
    useEffect(() => {
        const allRequiredLoaded = files.filter(f => f.required).every(f => f.loaded);
        setFirehoseLoaded(allRequiredLoaded);
    }, [files, setFirehoseLoaded]);


    /**
     * Handle file selection
     */
    const handleFileSelect = useCallback(async (
        fileType: string,
        file: File
    ) => {
        try {
            setIsLoading(true);
            setError(null);

            log('info', `${t('firehose.manual.loading', 'Loading')}: ${file.name}`);

            const arrayBuffer = await file.arrayBuffer();

            // Store the file in EDL store (persists across tab switches)
            setManualFirehoseFile(fileType as 'programmer' | 'digest' | 'signature', arrayBuffer, arrayBuffer.byteLength);

            const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(1);
            const successMsg = `${t('firehose.manual.loaded', 'Loaded')}: ${file.name} (${sizeKB} KB)`;
            log('success', successMsg);
            toast.success(successMsg);

            // Check if all required files are loaded
            const updatedFiles = files.map(f =>
                f.name === fileType ? { ...f, loaded: true } : f
            );
            const allLoaded = updatedFiles.filter(f => f.required).every(f => f.loaded);

            if (allLoaded) {
                setFirehoseLoaded(true);
                const allLoadedMsg = t('firehose.manual.allLoaded', 'All firehose files loaded successfully!');
                log('success', allLoadedMsg);
                toast.success(allLoadedMsg);
            }

        } catch (err) {
            const msg = err instanceof Error ? err.message : t('firehose.manual.loadError', 'Failed to load file');
            setError(msg);
            log('error', `${t('firehose.manual.loadError', 'Failed to load')}: ${msg}`);
            toast.error(msg);
        } finally {
            setIsLoading(false);
            setCurrentFileType(null);
        }
    }, [files, log, setFirehoseLoaded, setManualFirehoseFile, t]);

    /**
     * Open file picker for a specific file type
     */
    const openFilePicker = useCallback((fileType: string) => {
        setCurrentFileType(fileType);
        fileInputRef.current?.click();
    }, []);

    /**
     * Handle file input change
     */
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && currentFileType) {
            handleFileSelect(currentFileType, file);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [currentFileType, handleFileSelect]);

    /**
     * Clear all loaded files
     */
    const clearAll = useCallback(() => {
        clearManualFirehoseFiles();
        setError(null);
        log('info', t('firehose.manual.cleared', 'Cleared all manually loaded firehose files'));
    }, [log, clearManualFirehoseFiles, t]);

    /**
     * Handle connect button
     */
    const handleConnect = useCallback(async () => {
        try {
            setIsConnecting(true);
            setError(null);
            log('info', t('firehose.manual.connecting', 'Connecting to device...'));
            // Use full connection flow - USB → Sahara → Firehose → Partitions
            await flowConnect();
        } catch (err) {
            const msg = err instanceof Error ? err.message : t('firehose.manual.connectError', 'Connection failed');
            setError(msg);
            log('error', msg);
        } finally {
            setIsConnecting(false);
        }
    }, [flowConnect, log, t]);

    const allFilesLoaded = files.filter(f => f.required).every(f => f.loaded);

    return (
        <Card className="border-dashed border-2 border-orange-500/30 bg-orange-500/5">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-5 w-5 text-orange-500" />
                    {t('firehose.manual.title')}
                </CardTitle>
                <CardDescription className="text-sm">
                    {t('firehose.manual.description')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleInputChange}
                    accept=".melf,.mbn,.elf,.bin"
                />

                {/* File slots */}
                <div className="grid gap-2">
                    {files.map((file) => (
                        <div
                            key={file.name}
                            className={cn(
                                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                file.loaded
                                    ? "bg-green-500/10 border-green-500/30"
                                    : "bg-background border-border hover:border-orange-500/50"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-8 w-8 rounded flex items-center justify-center",
                                    file.loaded ? "bg-green-500/20" : "bg-muted"
                                )}>
                                    {file.loaded ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <FileCode className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{t(file.labelKey)}</p>
                                    {file.size && (
                                        <p className="text-xs text-muted-foreground">
                                            {(file.size / 1024).toFixed(1)} KB
                                        </p>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant={file.loaded ? "outline" : "default"}
                                size="sm"
                                onClick={() => openFilePicker(file.name)}
                                disabled={isLoading || isConnecting}
                                className="gap-2"
                            >
                                {isLoading && currentFileType === file.name ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : file.loaded ? (
                                    <FileType className="h-4 w-4" />
                                ) : (
                                    <Upload className="h-4 w-4" />
                                )}
                                {file.loaded ? t('firehose.manual.replace') : t('firehose.manual.select')}
                            </Button>
                        </div>
                    ))}
                </div>

                {/* Error message */}
                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Status indicator + Connect button */}
                {allFilesLoaded && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-500">
                            <Check className="h-4 w-4 shrink-0" />
                            <p className="text-sm font-medium">
                                {t('firehose.manual.ready')}
                            </p>
                        </div>

                        {/* Connect Button */}
                        {flowStatus !== 'connected' && (
                            <Button
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="w-full gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                                size="lg"
                            >
                                {isConnecting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Plug className="h-5 w-5" />
                                )}
                                {isConnecting
                                    ? t('firehose.manual.connecting', 'Connecting...')
                                    : t('firehose.manual.connect', 'Connect to Device')
                                }
                            </Button>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAll}
                        disabled={!files.some(f => f.loaded) || isConnecting}
                        className="text-muted-foreground"
                    >
                        <X className="h-4 w-4 mr-2" />
                        {t('firehose.manual.clear')}
                    </Button>
                </div>

                {/* Help text */}
                <p className="text-xs text-muted-foreground border-t border-border pt-3">
                    {t('firehose.manual.help')}
                </p>
            </CardContent>
        </Card>
    );
}

/**
 * Get manually loaded firehose files from store
 */
export function getManualFirehose(): { programmer: ArrayBuffer; digest?: ArrayBuffer; signature?: ArrayBuffer } | null {
    const { manualFirehoseFiles } = useEDLConnectionStore.getState();

    if (manualFirehoseFiles.programmer) {
        return {
            programmer: manualFirehoseFiles.programmer.data,
            digest: manualFirehoseFiles.digest?.data,
            signature: manualFirehoseFiles.signature?.data,
        };
    }
    return null;
}
