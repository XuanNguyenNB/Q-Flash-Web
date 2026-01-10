/**
 * Scrcpy Context
 *
 * Context để chia sẻ canvas và controller của Scrcpy với các component khác
 * Dùng cho AI Automation để truy cập màn hình và điều khiển thiết bị
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Scrcpy Controller Interface
 */
export interface ScrcpyController {
  injectTouch(params: {
    action: number;
    pointerId: bigint;
    pointerX: number;
    pointerY: number;
    videoWidth: number;
    videoHeight: number;
    pressure: number;
    actionButton: number;
    buttons: number;
  }): void;
  injectKeyCode(params: {
    action: number;
    keyCode: number;
    repeat: number;
    metaState: number;
  }): Promise<void>;
  injectText(text: string): Promise<void>;
  injectScroll(params: {
    pointerX: number;
    pointerY: number;
    videoWidth: number;
    videoHeight: number;
    scrollX: number;
    scrollY: number;
    buttons: number;
  }): Promise<void>;
}

/**
 * Scrcpy Context Value
 */
interface ScrcpyContextValue {
  // Canvas ref
  canvas: HTMLCanvasElement | null;
  setCanvas: (canvas: HTMLCanvasElement | null) => void;

  // Controller ref
  controller: ScrcpyController | null;
  setController: (controller: ScrcpyController | null) => void;

  // Streaming state
  isStreaming: boolean;
  setIsStreaming: (isStreaming: boolean) => void;

  // Screen dimensions
  screenWidth: number;
  screenHeight: number;
  setScreenSize: (width: number, height: number) => void;
}

const ScrcpyContext = createContext<ScrcpyContextValue | null>(null);

/**
 * Scrcpy Provider
 */
export function ScrcpyProvider({ children }: { children: ReactNode }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [controller, setController] = useState<ScrcpyController | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);
  const [screenHeight, setScreenHeight] = useState(0);

  const setScreenSize = useCallback((width: number, height: number) => {
    setScreenWidth(width);
    setScreenHeight(height);
  }, []);

  return (
    <ScrcpyContext.Provider
      value={{
        canvas,
        setCanvas,
        controller,
        setController,
        isStreaming,
        setIsStreaming,
        screenWidth,
        screenHeight,
        setScreenSize,
      }}
    >
      {children}
    </ScrcpyContext.Provider>
  );
}

/**
 * Hook to use Scrcpy context
 */
export function useScrcpy() {
  const context = useContext(ScrcpyContext);
  if (!context) {
    throw new Error('useScrcpy must be used within a ScrcpyProvider');
  }
  return context;
}

/**
 * Hook to check if scrcpy is available for AI automation
 */
export function useScrcpyAvailable() {
  const context = useContext(ScrcpyContext);
  if (!context) {
    return {
      isAvailable: false,
      canvas: null,
      controller: null,
    };
  }

  return {
    isAvailable: context.isStreaming && context.canvas !== null && context.controller !== null,
    canvas: context.canvas,
    controller: context.controller,
    screenWidth: context.screenWidth,
    screenHeight: context.screenHeight,
  };
}
