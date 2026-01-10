import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useADB } from '@/hooks/useADB';
import { useDeviceStore } from '@/stores/deviceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Terminal, Send, Trash2, Smartphone, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TerminalLine {
    type: 'input' | 'output' | 'error';
    content: string;
    timestamp: Date;
}

export function ADBTerminal() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { runCommand, pendingOperation } = useADB();
    const { isConnected } = useDeviceStore();

    const [input, setInput] = useState('');
    const [history, setHistory] = useState<TerminalLine[]>([]);
    const [cmdHistory, setCmdHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [showFastbootConfirm, setShowFastbootConfirm] = useState(false);
    const [showEDLConfirm, setShowEDLConfirm] = useState(false);
    const [pendingCommand, setPendingCommand] = useState<string | null>(null);
    const [isExecutingReboot, setIsExecutingReboot] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history]);

    const handleSend = async () => {
        if (!input.trim() || !isConnected) return;

        const cmd = input.trim();

        // Check if command is reboot to bootloader/fastboot
        const isRebootBootloader = /^(adb\s+)?reboot\s+(bootloader|fastboot)$/i.test(cmd);
        const isRebootEDL = /^(adb\s+)?reboot\s+edl$/i.test(cmd);

        // If reboot command, show confirmation dialog
        if (isRebootBootloader) {
            setPendingCommand(cmd);
            setShowFastbootConfirm(true);
            return;
        }

        if (isRebootEDL) {
            setPendingCommand(cmd);
            setShowEDLConfirm(true);
            return;
        }

        // Execute command normally
        await executeCommand(cmd);
    };

    const executeCommand = async (cmd: string) => {
        setInput('');
        setHistoryIndex(-1);
        setCmdHistory(prev => [cmd, ...prev]);

        // Add input to display
        setHistory(prev => [...prev, {
            type: 'input',
            content: `> ${cmd}`,
            timestamp: new Date()
        }]);

        try {
            const result = await runCommand(cmd);

            if (result !== null) {
                setHistory(prev => [...prev, {
                    type: 'output',
                    content: result,
                    timestamp: new Date()
                }]);
            }
        } catch (error) {
            setHistory(prev => [...prev, {
                type: 'error',
                content: String(error),
                timestamp: new Date()
            }]);
        }
    };

    const confirmRebootFastboot = async () => {
        if (pendingCommand) {
            setIsExecutingReboot(true);
            await executeCommand(pendingCommand);
            setPendingCommand(null);
            setIsExecutingReboot(false);
            setShowFastbootConfirm(false);
            // Navigate to Fastboot page after short delay
            setTimeout(() => navigate('/fastboot'), 500);
        }
    };

    const confirmRebootEDL = async () => {
        if (pendingCommand) {
            setIsExecutingReboot(true);
            await executeCommand(pendingCommand);
            setPendingCommand(null);
            setIsExecutingReboot(false);
            setShowEDLConfirm(false);
            // Navigate to EDL page after short delay
            setTimeout(() => navigate('/edl'), 500);
        }
    };

    const cancelReboot = () => {
        setShowFastbootConfirm(false);
        setShowEDLConfirm(false);
        setPendingCommand(null);
        setIsExecutingReboot(false);
        setInput(''); // Clear input
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length > 0) {
                const nextIndex = Math.min(historyIndex + 1, cmdHistory.length - 1);
                setHistoryIndex(nextIndex);
                setInput(cmdHistory[nextIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const nextIndex = historyIndex - 1;
                setHistoryIndex(nextIndex);
                setInput(cmdHistory[nextIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    const clearTerminal = () => {
        setHistory([]);
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground border-2 border-dashed rounded-lg bg-muted/30">
                <Smartphone className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('adb.scrcpy.connectFirst', 'Connect device first')}</p>
            </div>
        );
    }

    return (
        <Card className="flex flex-col h-full border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Terminal className="w-5 h-5" />
                            ADB Shell
                        </CardTitle>
                        <CardDescription>
                            Execute shell commands directly on the device.
                        </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={clearTerminal} title="Clear Terminal">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 flex flex-col min-h-0 gap-4">
                {/* Output Area */}
                <div className="flex-1 rounded-md border bg-black/90 font-mono text-sm text-green-400 p-4 overflow-y-auto shadow-inner relative">
                    <div className="absolute top-2 right-2 text-xs text-zinc-500 select-none">
                        local@adb-shell ~ $
                    </div>
                    {history.length === 0 && (
                        <div className="opacity-50 mt-6 italic">
                            # Type commands below to start... <br />
                            # Examples: 'ls -la', 'pm list packages', 'getprop'
                        </div>
                    )}
                    {history.map((line, i) => (
                        <div key={i} className={`mb-2 whitespace-pre-wrap break-all ${line.type === 'error' ? 'text-red-400' :
                            line.type === 'input' ? 'text-blue-400 font-bold' : 'text-green-400'
                            }`}>
                            <span className="opacity-50 text-[10px] mr-2 select-none">
                                {line.timestamp.toLocaleTimeString()}
                            </span>
                            {line.content}
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>

                {/* Input Area */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-2.5 text-muted-foreground font-mono font-bold">$</span>
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type adb shell command..."
                            className="font-mono pl-6"
                            disabled={!!pendingOperation}
                            autoFocus
                        />
                    </div>
                    <Button onClick={handleSend} disabled={!!pendingOperation || !input.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </CardContent>

            {/* Reboot to Fastboot Confirmation Dialog */}
            <AlertDialog open={showFastbootConfirm} onOpenChange={setShowFastbootConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isExecutingReboot ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    {t('adb.rebootFastboot.rebooting', 'Rebooting...')}
                                </span>
                            ) : (
                                t('adb.rebootFastboot.title', 'Reboot to Fastboot Mode?')
                            )}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isExecutingReboot ? (
                                t('adb.rebootFastboot.executing', 'Sending reboot command to device. Please wait...')
                            ) : (
                                t('adb.rebootFastboot.description', 'This will reboot your device into Fastboot mode. The app will automatically switch to Fastboot page after rebooting.')
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {!isExecutingReboot && (
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={cancelReboot}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmRebootFastboot}>
                                {t('common.confirm', 'Confirm')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    )}
                </AlertDialogContent>
            </AlertDialog>

            {/* Reboot to EDL Confirmation Dialog */}
            <AlertDialog open={showEDLConfirm} onOpenChange={setShowEDLConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isExecutingReboot ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    {t('adb.rebootEDL.rebooting', 'Rebooting...')}
                                </span>
                            ) : (
                                t('adb.rebootEDL.title', 'Reboot to EDL Mode?')
                            )}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isExecutingReboot ? (
                                t('adb.rebootEDL.executing', 'Sending reboot command to device. Please wait...')
                            ) : (
                                t('adb.rebootEDL.description', 'This will reboot your device into EDL (Emergency Download) mode. You will need to reconnect the device in EDL mode to continue flashing.')
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {!isExecutingReboot && (
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={cancelReboot}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmRebootEDL}>
                                {t('common.confirm', 'Confirm')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
