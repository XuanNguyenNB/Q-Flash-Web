/**
 * ManualFirehosePopup Component
 * 
 * Dialog for manually selecting firehose files when auto-load fails.
 * Allows user to browse and select programmer, digest, and signature files.
 * 
 * @story 2-3-auto-detect-firehose-by-chipset
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileCheck, AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ManualFirehosePopupProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback to close the dialog */
    onOpenChange: (open: boolean) => void;
    /** Device name for display */
    deviceName?: string;
    /** Callback when files are selected and submitted */
    onSubmit: (files: {
        programmer: ArrayBuffer;
        digest: ArrayBuffer;
        signature: ArrayBuffer;
    }) => void;
    /** Callback when user chooses to skip */
    onSkip?: () => void;
}

interface FileState {
    file: File | null;
    buffer: ArrayBuffer | null;
}

/**
 * Dialog for manually selecting firehose files.
 * 
 * Shows when auto-load fails, allowing user to:
 * - Browse and select each firehose file
 * - See which files are still needed
 * - Skip manual selection if desired
 */
export function ManualFirehosePopup({
    open,
    onOpenChange,
    deviceName,
    onSubmit,
    onSkip,
}: ManualFirehosePopupProps) {
    const { t } = useTranslation();

    // File states
    const [programmer, setProgrammer] = useState<FileState>({ file: null, buffer: null });
    const [digest, setDigest] = useState<FileState>({ file: null, buffer: null });
    const [signature, setSignature] = useState<FileState>({ file: null, buffer: null });

    // File input refs
    const programmerRef = useRef<HTMLInputElement>(null);
    const digestRef = useRef<HTMLInputElement>(null);
    const signatureRef = useRef<HTMLInputElement>(null);

    /**
     * Read file as ArrayBuffer.
     */
    const readFileAsBuffer = useCallback(async (file: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }, []);

    /**
     * Handle file selection for a specific firehose type.
     */
    const handleFileSelect = useCallback(async (
        event: React.ChangeEvent<HTMLInputElement>,
        setter: (state: FileState) => void
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const buffer = await readFileAsBuffer(file);
            setter({ file, buffer });
        } catch (err) {
            console.error('Failed to read file:', err);
        }
    }, [readFileAsBuffer]);

    /**
     * Check if all required files are selected.
     */
    const allFilesSelected = programmer.buffer && digest.buffer && signature.buffer;

    /**
     * Handle form submission.
     */
    const handleSubmit = useCallback(() => {
        if (!allFilesSelected) return;

        onSubmit({
            programmer: programmer.buffer!,
            digest: digest.buffer!,
            signature: signature.buffer!,
        });

        // Reset state
        setProgrammer({ file: null, buffer: null });
        setDigest({ file: null, buffer: null });
        setSignature({ file: null, buffer: null });
        onOpenChange(false);
    }, [allFilesSelected, programmer, digest, signature, onSubmit, onOpenChange]);

    /**
     * Handle skip action.
     */
    const handleSkip = useCallback(() => {
        onSkip?.();
        onOpenChange(false);
    }, [onSkip, onOpenChange]);

    /**
     * Render a file input row.
     */
    const FileInputRow = ({
        label,
        hint,
        inputRef,
        state,
        onChange,
    }: {
        label: string;
        hint: string;
        inputRef: React.RefObject<HTMLInputElement | null>;
        state: FileState;
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    }) => (
        <div className="flex items-center gap-3 p-3 rounded-md bg-zinc-800/50 border border-zinc-700">
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept=".elf,.melf,.bin"
                onChange={onChange}
            />

            {state.buffer ? (
                <FileCheck className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
                <p className={cn(
                    "font-medium text-sm",
                    state.buffer ? "text-green-400" : "text-zinc-300"
                )}>
                    {label}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                    {state.file ? state.file.name : hint}
                </p>
            </div>

            <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                className="shrink-0"
            >
                <Upload className="h-4 w-4 mr-1" />
                {t('firehose.manual.browse', 'Browse')}
            </Button>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        {t('firehose.manual.title', 'Manual File Selection')}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'firehose.manual.description',
                            'Auto-load failed. Please select firehose files manually.'
                        )}
                        {deviceName && (
                            <span className="block mt-1 text-zinc-400">
                                Device: <strong>{deviceName}</strong>
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-2 py-4">
                    <FileInputRow
                        label="Programmer"
                        hint="programmer.melf or .elf"
                        inputRef={programmerRef}
                        state={programmer}
                        onChange={(e) => handleFileSelect(e, setProgrammer)}
                    />
                    <FileInputRow
                        label="Digest"
                        hint="digest.elf"
                        inputRef={digestRef}
                        state={digest}
                        onChange={(e) => handleFileSelect(e, setDigest)}
                    />
                    <FileInputRow
                        label="Signature"
                        hint="signature.bin"
                        inputRef={signatureRef}
                        state={signature}
                        onChange={(e) => handleFileSelect(e, setSignature)}
                    />
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={handleSkip}
                    >
                        {t('firehose.manual.skip', 'Skip for now')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!allFilesSelected}
                    >
                        {t('common.confirm', 'Confirm')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
