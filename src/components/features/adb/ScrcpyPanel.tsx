import { useState, useRef, useEffect, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Icons
import {
    Monitor,
    Play,
    Square,
    Loader2,
    Smartphone,
    AlertCircle,
    Maximize2, Minimize2, Settings,
    ArrowLeft, Circle, Volume2, Volume1, Power, RefreshCw,
    Clipboard as ClipboardIcon, Keyboard, Grid, Aperture, Globe, ShoppingBag
} from 'lucide-react';

// Stores & Hooks
import { useDeviceStore } from '@/stores/deviceStore';
import { useADB } from '@/hooks/useADB';
import { useTerminalStore } from '@/stores/terminalStore';
import { useADBStore } from '@/stores/adbStore';
import { trackEvent } from '@/services/analytics';

// Scrcpy Context for AI Automation
import { useScrcpy } from '@/contexts/ScrcpyContext';

// Scrcpy Dependencies
import {
    AdbScrcpyClient,
    AdbScrcpyOptionsLatest,
    AdbScrcpyOptions1_24,
} from '@yume-chan/adb-scrcpy';
import { WebCodecsVideoDecoder } from '@yume-chan/scrcpy-decoder-webcodecs';
import { PushReadableStream } from '@yume-chan/stream-extra';
import { cn } from '@/lib/utils';
import { Adb } from '@yume-chan/adb';


// Android KeyCodes
const KEYCODES = {
    HOME: 3,
    BACK: 4,
    APP_SWITCH: 187,
    POWER: 26,
    VOLUME_UP: 24,
    VOLUME_DOWN: 25
};

// Map Browser Keys to Android KeyCodes
const KEY_MAP: Record<string, number> = {
    'Home': 3, 'Escape': 4, 'Backspace': 67, 'Enter': 66, 'Tab': 61, 'Space': 62,
    'ArrowUp': 19, 'ArrowDown': 20, 'ArrowLeft': 21, 'ArrowRight': 22,
    'Delete': 112,
};



interface ScrcpyPanelProps {
    className?: string;
}

export function ScrcpyPanel({ className }: ScrcpyPanelProps) {
    const { t } = useTranslation();
    const { log } = useTerminalStore();
    // const { isConnected } = useDeviceStore(); // No longer directly used here
    const { getInstance } = useADB();
    const deviceInfo = useADBStore((state) => state.deviceInfo); // Get device info from store
    const isDeviceReady = useADBStore((state) => state.isDeviceReady); // Check if device is ready for scrcpy

    // Scrcpy Context - for AI Automation access
    const scrcpyContext = useScrcpy();

    // State
    const [isStreaming, setIsStreaming] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false); // Track if cursor is over scrcpy panel

    // Stream Settings
    const [resolution, setResolution] = useState<number>(1024); // Default 1024px
    const [bitrate, setBitrate] = useState<number>(4000000);    // Default 4 Mbps

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const clientRef = useRef<any | null>(null); // AdbScrcpyClient
    const decoderRef = useRef<any>(null); // Decoder instance

    // Register canvas with context when it changes
    useEffect(() => {
        scrcpyContext.setCanvas(canvasRef.current);
        return () => {
            scrcpyContext.setCanvas(null);
        };
    }, [canvasRef.current]);

    // Register streaming state with context
    useEffect(() => {
        scrcpyContext.setIsStreaming(isStreaming);
        if (isStreaming && clientRef.current?.controller) {
            scrcpyContext.setController(clientRef.current.controller);
        } else {
            scrcpyContext.setController(null);
        }
    }, [isStreaming]);

    /**
     * Cleanup Function
     */
    const cleanup = useCallback(async () => {
        log('info', '🧹 Cleaning up Scrcpy session...');

        // 1. Close Client
        if (clientRef.current) {
            try {
                await clientRef.current.close();
            } catch (e) {
                console.error("Close client error:", e);
            }
            clientRef.current = null;
        }

        // 2. Dispose Decoder
        if (decoderRef.current) {
            try {
                if (typeof decoderRef.current.dispose === 'function') {
                    decoderRef.current.dispose();
                }
            } catch (e) {
                console.error("Dispose decoder error:", e);
            }
            decoderRef.current = null;
        }

        setIsStreaming(false);
        setIsStarting(false);
    }, [log]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    /**
     * Start Streaming Logic (MVP)
     */
    const startStreaming = async () => {
        if (isStreaming) return;

        const protocol = getInstance();
        if (!protocol.isConnected || !protocol.adbInstance) {
            setError(t('scrcpy.error_not_connected'));
            return;
        }

        const adb = protocol.adbInstance;

        try {
            setIsStarting(true);
            setError(null);
            log('info', '🚀 Starting Scrcpy (MVP Mode - TinyH264)...');

            // Sync clipboard to device
            if (navigator.clipboard) {
                // Placeholder for future clipboard sync logic if needed
            }

            // --- Step 1: Push Server ---
            const serverPath = '/data/local/tmp/scrcpy-server.jar';
            log('info', '📦 Fetching scrcpy-server-v3.3.3.jar...');

            // Should match the file user added to /public
            const response = await fetch('/scrcpy-server-v3.3.3.jar');
            if (!response.ok) throw new Error(`Failed to fetch server: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();

            log('info', `📦 Pushing server to device (${arrayBuffer.byteLength} bytes)...`);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stream = new PushReadableStream(async (controller: any) => {
                await controller.enqueue(new Uint8Array(arrayBuffer));
                controller.close();
            });

            await AdbScrcpyClient.pushServer(
                adb,
                // @ts-expect-error - stream type compatibility
                stream,
                serverPath
            );

            log('info', '✅ Server pushed successfully');

            // --- Step 2: Configure Options (High Quality) ---
            const options = new AdbScrcpyOptionsLatest({
                video: true,
                audio: false,
                maxSize: resolution, // Use state variable
                videoBitRate: bitrate, // Use state variable
                maxFps: 60,
                videoCodec: 'h264' as any,
                tunnelForward: false,
                sendDeviceMeta: true,
                control: true,
                sendDummyByte: false,
                clipboardAutosync: true, // Enable auto clipboard sync from Phone -> PC
            });


            // --- Step 3: Start Client ---
            log('info', '🔌 Connecting to scrcpy server...');

            // Try detection or force version if needed. Ideally we detect.
            // For MVP assuming server is compatible with Latest or 1.24+
            // If strictly using provided jar, usually it's best to match.
            // Assuming jar is > 2.0 based on file list having 2.1

            const client = await AdbScrcpyClient.start(
                adb,
                serverPath,
                options
            );

            clientRef.current = client;
            log('info', '✅ Scrcpy Client connected');

            // --- Step 4: Handle Video Stream ---
            log('info', '🎥 Waiting for video stream...');

            if (!client.videoStream) {
                throw new Error("No video stream received");
            }

            const { metadata, stream: videoRawStream } = await client.videoStream;

            log('info', `running video stream: ${metadata.codec === 1748121140 ? 'H264' : metadata.codec} - ${metadata.width}x${metadata.height}`);

            // HACK: Force update controller with correct screen size
            // This is crucial because sometimes the initial handshake sends 0x0 or fails to sync
            if (client.controller) {
                try {
                    // Try generic assignment for libraries that store it as props
                    (client.controller as any).screenWidth = metadata.width;
                    (client.controller as any).screenHeight = metadata.height;

                    // Also try setScreenSize if available (v2+ clients)
                    if (typeof (client.controller as any).setScreenSize === 'function') {
                        (client.controller as any).setScreenSize(metadata.width, metadata.height);
                    }
                    console.log("✅ Forced controller screen size to:", metadata.width, metadata.height);
                } catch (e) {
                    console.warn("Failed to set screen size on controller", e);
                }
            }

            // --- Step 5: Setup WebCodecs Decoder ---
            // --- Step 5: Setup WebCodecs Decoder ---
            const decoder = new WebCodecsVideoDecoder({
                codec: 1748121140 as any, // H.264 ID
                renderer: {
                    draw: (frame: VideoFrame) => {
                        const canvas = canvasRef.current;
                        if (!canvas) { frame.close(); return; }

                        // Get context with low-latency hints
                        const ctx = canvas.getContext('2d', {
                            alpha: false,
                            desynchronized: true
                        } as any) as CanvasRenderingContext2D | null;

                        if (!ctx) { frame.close(); return; }

                        // Auto-resize
                        if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
                            canvas.width = frame.displayWidth;
                            canvas.height = frame.displayHeight;
                        }

                        ctx.drawImage(frame, 0, 0);
                        frame.close();
                    },
                    setSize: () => { } // Handled in draw
                } as any,
            });

            decoderRef.current = decoder;

            // Pipe stream to decoder
            videoRawStream.pipeTo(decoder.writable).catch(e => {
                // Ignore "closed codec" error as it happens during cleanup
                if (e?.message && (e.message.includes("closed codec") || e.message.includes("lock"))) return;

                console.error("Stream pipe error:", e);
                log('error', `Stream ended: ${e.message}`);
                cleanup();
            });

            // --- Clipboard Sync (Phone -> PC) ---
            if (client.clipboard) {
                client.clipboard.pipeTo(new WritableStream({
                    write(chunk) {
                        try {
                            navigator.clipboard.writeText(chunk);
                            toast.success("Coppied from Device");
                        } catch (e) {
                            console.warn("Clipboard write failed (browser restriction?)", e);
                        }
                    }
                }) as any).catch(e => console.warn("Clipboard sync error", e));
            }

            setIsStreaming(true);
            toast.success(t('adb.scrcpy.success', 'Screen Mirror Started (MVP)'));
            trackEvent('adb', 'scrcpy_start', `${resolution}p_${bitrate / 1000000}mbps`);

        } catch (err: any) {
            console.error("Scrcpy Start Error:", err);

            // Extract detailed server output if available
            let msg = err instanceof Error ? err.message : String(err);
            if (err.output) {
                const outputStr = Array.isArray(err.output) ? err.output.join('\n') : String(err.output);
                console.error("Server Output:", outputStr);
                msg += `\nOutput: ${outputStr}`;
                log('error', `📜 Server Output:\n${outputStr}`);
            }

            // User-friendly error message
            const userMessage = t('scrcpy.error_not_ready',
                'Device not ready. Please wait 5-10 seconds after connecting, then try again.');

            setError(userMessage);
            log('error', `❌ Failed to start Scrcpy: ${msg}`);
            log('info', '💡 ' + t('scrcpy.error_hint', 'Tip: Wait for device to fully boot before starting screen mirror.'));
            cleanup();
        } finally {
            setIsStarting(false);
        }
    };

    /**
     * Touch/Pointer Handler (Full Swipe/Drag Support)
     */
    const injectTouch = (action: number, e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isStreaming || !clientRef.current?.controller) return;

        // No throttling for maximum smoothness (WebUSB handles it)

        const canvas = e.currentTarget;
        const rect = canvas.getBoundingClientRect();

        // Calculate scaling based on actual stream resolution vs displayed size
        const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

        const controller = clientRef.current.controller;

        // Android Pointer ID Logic
        let pointerId: bigint;
        if (e.pointerType === 'mouse') {
            pointerId = -2n;
        } else {
            pointerId = BigInt(e.pointerId);
        }

        // Map Mouse Buttons to Android Constants
        let androidButton = 0;
        if (e.buttons & 1) androidButton = 1;
        if (e.buttons & 2) androidButton = 2;
        if (e.buttons & 4) androidButton = 4;

        try {
            controller.injectTouch({
                action,
                pointerId,
                pointerX: x,
                pointerY: y,
                videoWidth: canvas.width,
                videoHeight: canvas.height,
                pressure: e.pressure || (e.buttons ? 1 : 0),
                actionButton: androidButton,
                buttons: androidButton
            });
        } catch (err) {
            console.error("Input injection failed:", err);
        }
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        injectTouch(0, e); // ACTION_DOWN
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.buttons === 1) { // Only track if primary button is held
            injectTouch(2, e); // ACTION_MOVE
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        injectTouch(1, e); // ACTION_UP
    };

    const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.buttons === 1) {
            injectTouch(1, e); // ACTION_UP if leaving canvas while dragging
        }
    };

    /**
     * Send Android KeyCode (Down + Up)
     */
    const sendKey = async (keyCode: number) => {
        if (!clientRef.current?.controller) return;
        try {
            await clientRef.current.controller.injectKeyCode({ action: 0, keyCode, repeat: 0, metaState: 0 });
            await clientRef.current.controller.injectKeyCode({ action: 1, keyCode, repeat: 0, metaState: 0 });
        } catch (e) {
            console.error("Key inject failed", e);
        }
    };

    useEffect(() => {
        if (!isStreaming) return;

        const handlePaste = async (e: ClipboardEvent) => {
            if (!clientRef.current?.controller) return;
            const text = e.clipboardData?.getData('text');
            if (text) {
                e.preventDefault();
                await clientRef.current.controller.injectText(text);
                toast.success("Pasted to Device");
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [isStreaming]);

    // Block page scroll when hovering over scrcpy panel
    useEffect(() => {
        if (!isHovered) return;

        const preventScroll = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // Add passive: false to allow preventDefault
        document.body.addEventListener('wheel', preventScroll, { passive: false });
        return () => {
            document.body.removeEventListener('wheel', preventScroll);
        };
    }, [isHovered]);

    // Add native wheel handler to canvas for device scrolling
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isStreaming) return;

        const handleNativeWheel = async (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (!clientRef.current?.controller) return;

            const controller = clientRef.current.controller;

            // Get pointer position relative to canvas
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const pointerX = (e.clientX - rect.left) * scaleX;
            const pointerY = (e.clientY - rect.top) * scaleY;

            // Normalize scroll values - scrollX and scrollY are expected as float values
            // deltaY positive = scroll down, negative = scroll up
            // For Android: negative scrollY = scroll down (content moves up)
            const scrollX = 0;
            const scrollY = -e.deltaY / 100; // Normalize and invert for natural scrolling

            try {
                // Use native injectScroll method for proper scroll handling
                await controller.injectScroll({
                    pointerX,
                    pointerY,
                    videoWidth: canvas.width,
                    videoHeight: canvas.height,
                    scrollX,
                    scrollY,
                    buttons: 0
                });
            } catch (err) {
                console.error("Scroll injection failed:", err);
            }
        };

        canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
        return () => {
            canvas.removeEventListener('wheel', handleNativeWheel);
        };
    }, [isStreaming]);

    /**
     * Handle Layout KeyDown with optimized text input
     */
    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (!isStreaming || !clientRef.current?.controller) return;

        // Prevent default browser actions for common navigation keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
            e.preventDefault();
        }

        // Nav Keys
        const keyCode = KEY_MAP[e.key];
        if (keyCode) {
            e.preventDefault();
            // Send key down and up immediately for better responsiveness
            await clientRef.current.controller.injectKeyCode({ action: 0, keyCode, repeat: 0, metaState: 0 });
            await clientRef.current.controller.injectKeyCode({ action: 1, keyCode, repeat: 0, metaState: 0 });
            return;
        }

        // Text Input - batched for performance
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            // Use injectText which is more efficient than individual key events
            await clientRef.current.controller.injectText(e.key);
        }
    };

    /**
     * Launch App via ADB Shell
     */
    const launchApp = async (pkg: string) => {
        const protocol = getInstance();
        if (!protocol.isConnected) return;
        try {
            // Use monkey to launch app (works on most devices without knowing activity name)
            await protocol.runShellCommand(`monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
            toast.success(`Launched ${pkg}`);
        } catch (e) {
            console.error("Launch app failed", e);
            toast.error("Failed to launch app");
        }
    };

    /**
     * Paste Clipboard Text to Device
     */
    const pasteClipboard = async () => {
        if (!clientRef.current?.controller) return;
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                await clientRef.current.controller.injectText(text);
                toast.success("Sent to device clipboard");
            }
        } catch (e) {
            toast.error("Clipboard permission denied or empty");
        }
    };

    return (
        // Outer Container - No border, transparent
        <div className="h-full w-full bg-transparent flex items-center justify-center overflow-hidden outline-none relative"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onMouseEnter={() => setIsHovered(true)} // Track hover state
            onMouseLeave={() => setIsHovered(false)}
            onWheel={(e) => {
                e.preventDefault(); // CRITICAL: Block page scroll
                e.stopPropagation();
            }}
            style={{ touchAction: 'none' }} // Prevent touch scroll
        >
            {/* Use fixed container for transitions */}
            <div className={`relative transition-all duration-500 ease-in-out ${isStreaming ? 'w-full h-full' : 'w-full max-w-lg'}`}>

                {/* --- SETUP PANEL (Visible when NOT streaming) --- */}
                {!isStreaming && !isStarting && (
                    <div className="w-full bg-card/40 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">

                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/50 shadow-lg">
                                <Smartphone className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground tracking-tight">{t('scrcpy.title')}</h2>
                            <p className="text-muted-foreground text-sm">{t('scrcpy.subtitle')}</p>
                        </div>

                        {/* Settings Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Resolution */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">{t('scrcpy.resolution_label')}</label>
                                <div className="flex flex-col gap-2">
                                    {[720, 1024, 1600].map((res) => (
                                        <button
                                            key={res}
                                            onClick={() => setResolution(res)}
                                            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left flex justify-between items-center ${resolution === res
                                                ? 'bg-primary text-primary-foreground shadow-lg'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                                }`}
                                        >
                                            {res >= 1080 ? 'FHD+' : res >= 1024 ? 'HD+' : 'HD'} ({res}p)
                                            {resolution === res && <div className="w-2 h-2 bg-primary-foreground rounded-full" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Bitrate */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider ml-1">{t('scrcpy.bitrate_label')}</label>
                                <div className="flex flex-col gap-2">
                                    {[2000000, 4000000, 8000000].map((br) => (
                                        <button
                                            key={br}
                                            onClick={() => setBitrate(br)}
                                            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left flex justify-between items-center ${bitrate === br
                                                ? 'bg-primary text-primary-foreground shadow-lg'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                                }`}
                                        >
                                            {br / 1000000} Mbps
                                            {bitrate === br && <div className="w-2 h-2 bg-primary-foreground rounded-full" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Start Button */}
                        <button
                            onClick={startStreaming}
                            disabled={!deviceInfo}
                            className="w-full py-4 mt-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                        >
                            <Play className="w-6 h-6 fill-primary-foreground/20 group-hover:fill-primary-foreground transition-colors" />
                            {t('scrcpy.start_stream')}
                        </button>

                        {error && (
                            <div className="text-destructive text-xs text-center bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                                {error}
                            </div>
                        )}
                    </div>
                )}


                {/* --- LOADING STATE --- */}
                {isStarting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md rounded-3xl border border-border z-50 animate-in fade-in duration-500">
                        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                        <span className="text-primary/80 text-lg font-medium animate-pulse">{t('scrcpy.initializing')}</span>
                    </div>
                )}


                {/* --- STREAMING UI (Sidebar + Canvas) --- */}
                {isStreaming && (
                    <div className="relative flex flex-row h-full w-full bg-transparent overflow-hidden animate-in fade-in zoom-in-95 duration-500">

                        {/* --- SIDEBAR --- */}
                        <div className="w-14 bg-card/90 backdrop-blur-md border-r border-border flex flex-col items-center py-5 gap-4 z-20 shrink-0">
                            {/* Connection Control */}
                            <div className="flex flex-col gap-2 w-full px-2">
                                <button
                                    title="Stop Stream"
                                    onClick={cleanup}
                                    className="p-2.5 rounded-2xl transition-all active:scale-95 flex justify-center shadow-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                                >
                                    <Square className="w-4 h-4 fill-current" />
                                </button>
                            </div>

                            <div className="w-8 h-px bg-border" />

                            {/* Nav Keys */}
                            <button title="Back" onClick={() => sendKey(KEYCODES.BACK)} className="p-2.5 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground transition-all active:scale-90">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <button title="Home" onClick={() => sendKey(KEYCODES.HOME)} className="p-2.5 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground transition-all active:scale-90">
                                <Circle className="w-4 h-4" />
                            </button>
                            <button title="Recent" onClick={() => sendKey(KEYCODES.APP_SWITCH)} className="p-2.5 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground transition-all active:scale-90">
                                <Square className="w-4 h-4" />
                            </button>

                            <div className="w-8 h-px bg-border" />

                            {/* Volume & Power */}
                            <button title="Vol Up" onClick={() => sendKey(KEYCODES.VOLUME_UP)} className="p-2.5 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground transition-all active:scale-90">
                                <Volume2 className="w-5 h-5" />
                            </button>
                            <button title="Vol Down" onClick={() => sendKey(KEYCODES.VOLUME_DOWN)} className="p-2.5 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground transition-all active:scale-90">
                                <Volume1 className="w-5 h-5" />
                            </button>
                            <button title="Power" onClick={() => sendKey(KEYCODES.POWER)} className="p-2.5 hover:bg-amber-500/10 rounded-xl text-amber-500/80 hover:text-amber-400 transition-all active:scale-90 mt-1">
                                <Power className="w-5 h-5" />
                            </button>

                            <div className="w-8 h-px bg-border" />

                            {/* Tools */}
                            <button title="Paste (Ctrl+V)" onClick={pasteClipboard} className="p-2.5 hover:bg-accent rounded-xl text-muted-foreground hover:text-foreground transition-all active:scale-90">
                                <ClipboardIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* --- DISPLAY AREA --- */}
                        <div className="relative bg-transparent flex justify-center items-center flex-1 overflow-hidden">
                            <canvas
                                ref={canvasRef}
                                className="block max-w-full max-h-full w-auto h-auto object-contain cursor-crosshair touch-none select-none outline-none"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    sendKey(KEYCODES.BACK); // Right click as Back
                                }}
                            />

                            {/* Error Layer (Overlay) */}
                            {error && (
                                <div className="absolute top-10 left-10 right-10 p-4 bg-destructive/90 text-destructive-foreground rounded-xl text-sm border border-destructive/30 text-center shadow-lg">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

