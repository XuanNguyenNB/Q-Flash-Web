/**
 * FastbootTerminal Component
 * 
 * Provides a terminal-like interface for running Fastboot commands directly.
 * Supports common fastboot operations via text commands.
 * 
 * Story: 8.6 - Fastboot Page Layout Enhancement
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, Send, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';

// Stores
import { useDeviceStore } from '@/stores/deviceStore';
import { useFastbootStore } from '@/stores/fastbootStore';
import { useTerminalStore } from '@/stores/terminalStore';

// Hooks
import { useFastboot } from '@/hooks/useFastboot';

// Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface FastbootTerminalProps {
    className?: string;
}

interface CommandHistoryItem {
    command: string;
    output: string;
    success: boolean;
    timestamp: Date;
}

export function FastbootTerminal({ className }: FastbootTerminalProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // State
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState<CommandHistoryItem[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Stores
    const { isConnected } = useDeviceStore();
    const { deviceInfo } = useFastbootStore();
    const terminalStore = useTerminalStore();

    // Fastboot hook
    const fastboot = useFastboot();

    // Auto scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    // ========================================================================
    // Command Execution
    // ========================================================================

    const executeCommand = async () => {
        if (!command.trim() || !isConnected || isRunning) return;

        let cmd = command.trim();
        // Remove 'fastboot' prefix if present (case insensitive)
        if (cmd.toLowerCase().startsWith('fastboot ')) {
            cmd = cmd.substring(9).trim();
        }

        setIsRunning(true);
        setCommand('');

        let output = '';
        let success = false;

        try {
            // Normalize special cases like getvar:all -> getvar all
            const normalizedCmd = cmd.replace(':', ' ');
            const parts = normalizedCmd.split(/\s+/);
            const action = parts[0].toLowerCase();

            // Argument (part[1]) should keep original case for variables if needed, 
            // but for commands like 'reboot recovery' usually lowercase works.
            const arg = parts[1];

            switch (action) {
                case 'reboot':
                    if (arg === 'recovery') {
                        success = await fastboot.rebootRecovery();
                        output = success ? 'Rebooting to recovery...' : 'Failed to reboot';
                    } else if (arg === 'bootloader') {
                        success = await fastboot.rebootBootloader();
                        output = success ? 'Rebooting to bootloader...' : 'Failed to reboot';
                    } else if (arg === 'fastboot' || arg === 'fastbootd') {
                        success = await fastboot.rebootFastbootd();
                        output = success ? 'Rebooting to FastbootD...' : 'Failed to reboot';
                    } else {
                        success = await fastboot.reboot();
                        output = success ? 'Rebooting to system...' : 'Failed to reboot';
                    }
                    break;

                case 'getvar':
                    if (arg) {
                        const protocol = fastboot.getInstance();
                        if (arg === 'all') {
                            // getvar:all returns multiple lines via INFO packets
                            // android-fastboot logs these, but might not return them in getVariable
                            await protocol.runCommand('getvar:all');
                            output = 'Command sent. Check detailed output in the Main Logs panel.';
                            success = true;
                        } else {
                            const value = await protocol.getVariable(arg);
                            success = value !== null;
                            output = value || `Variable '${arg}' not found`;
                        }
                    } else {
                        output = 'Usage: getvar <variable> (e.g., getvar all)';
                    }
                    break;

                case 'erase':
                    if (arg) {
                        success = await fastboot.erasePartition(arg);
                        output = success ? `Erased partition: ${arg}` : `Failed to erase: ${arg}`;
                    } else {
                        output = 'Usage: erase <partition>';
                    }
                    break;

                case 'flash':
                    output = t('fastboot.terminal.flashHint', 'Use the Flash Panel above to flash .img files');
                    success = true;
                    break;

                case 'devices':
                    if (deviceInfo) {
                        output = `${deviceInfo.serialno}\t${deviceInfo.product} (${deviceInfo.unlocked ? 'unlocked' : 'locked'})`;
                        success = true;
                    } else {
                        output = 'No device connected';
                    }
                    break;

                case 'help':
                    output = `Available commands:
  reboot              - Reboot to system
  reboot recovery     - Reboot to recovery
  reboot bootloader   - Reboot to bootloader
  getvar <name>       - Get device variable
  erase <partition>   - Erase partition
  devices             - List connected device
  clear               - Clear terminal
  help                - Show this help`;
                    success = true;
                    break;

                case 'clear':
                    setHistory([]);
                    setIsRunning(false);
                    return;

                default:
                    output = `Unknown command: ${action}. Type 'help' for available commands.`;
            }

            // Log to main terminal
            terminalStore.log(success ? 'success' : 'error', `[Fastboot Shell] ${cmd} -> ${output}`);

        } catch (error) {
            output = error instanceof Error ? error.message : String(error);
            terminalStore.log('error', `[Fastboot Shell] ${cmd} -> Error: ${output}`);
        }

        // Add to history
        setHistory(prev => [...prev, {
            command: cmd,
            output,
            success,
            timestamp: new Date()
        }]);

        setIsRunning(false);
        setHistoryIndex(-1);
    };

    // ========================================================================
    // Key Handlers
    // ========================================================================

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            executeCommand();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length > 0) {
                const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setCommand(history[history.length - 1 - newIndex]?.command || '');
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setCommand(history[history.length - 1 - newIndex]?.command || '');
            } else {
                setHistoryIndex(-1);
                setCommand('');
            }
        }
    };

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <Card className={cn("col-span-2", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-primary" />
                            {t('fastboot.terminal.title', 'Fastboot Shell')}
                        </CardTitle>
                        <CardDescription>
                            {t('fastboot.terminal.description', 'Run fastboot commands directly')}
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setHistory([])}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Clear</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                            setCommand('help');
                                            executeCommand();
                                        }}
                                    >
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Help</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Output Area */}
                <div
                    ref={scrollRef}
                    className="h-40 bg-black/90 rounded-lg p-3 font-mono text-xs overflow-y-auto"
                >
                    {history.length === 0 ? (
                        <div className="text-green-500/70">
                            {isConnected
                                ? t('fastboot.terminal.ready', "Type 'help' for available commands")
                                : t('fastboot.terminal.disconnected', 'Connect device to start')}
                        </div>
                    ) : (
                        history.map((item, i) => (
                            <div key={i} className="mb-2">
                                <div className="text-green-400">
                                    <span className="text-green-600">fastboot$ </span>
                                    {item.command}
                                </div>
                                <div className={cn(
                                    "whitespace-pre-wrap pl-2",
                                    item.success ? "text-gray-300" : "text-red-400"
                                )}>
                                    {item.output}
                                </div>
                            </div>
                        ))
                    )}
                    {isRunning && (
                        <div className="text-yellow-500 animate-pulse">Running...</div>
                    )}
                </div>

                {/* Input Area */}
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">
                            fastboot$
                        </span>
                        <Input
                            ref={inputRef}
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('fastboot.terminal.placeholder', 'reboot, getvar, erase...')}
                            className="pl-24 font-mono"
                            disabled={!isConnected || isRunning}
                        />
                    </div>
                    <Button
                        onClick={executeCommand}
                        disabled={!isConnected || !command.trim() || isRunning}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
