import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useADB } from '@/hooks/useADB';
import { useDeviceStore } from '@/stores/deviceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Terminal, Send, Trash2, Smartphone } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TerminalLine {
    type: 'input' | 'output' | 'error';
    content: string;
    timestamp: Date;
}

export function ADBTerminal() {
    const { t } = useTranslation();
    const { runCommand, pendingOperation } = useADB();
    const { isConnected } = useDeviceStore();

    const [input, setInput] = useState('');
    const [history, setHistory] = useState<TerminalLine[]>([]);
    const [cmdHistory, setCmdHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
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
            // Run command via ADB shell
            // Note: runCommand wrap calls with simple shell execution usually
            // We'll treat this as raw shell command

            // If the user types 'adb shell ls', strip 'adb shell'? 
            // Our runCommand usually executes `shell <cmd>`.
            // Let's assume input is purely what goes after `adb shell`.
            // User might type 'ls -la', 'pm list packages', etc.

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
        </Card>
    );
}
