/**
 * useTerminal Hook
 * 
 * Convenience React hook for terminal logging operations.
 * Provides formatted logging with timestamp and easy access to terminal store.
 * 
 * This hook is a thin wrapper around terminalStore for convenience.
 */

import { useCallback } from 'react';
import { useTerminalStore, type TerminalLogLevel, type TerminalLogEntry } from '@/stores/terminalStore';

/**
 * Format timestamp as [HH:mm:ss]
 */
const formatTimestamp = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `[${hours}:${minutes}:${seconds}]`;
};

/**
 * Return type for useTerminal hook.
 */
export interface UseTerminalReturn {
    /** Log entries */
    logs: TerminalLogEntry[];
    /** Log a message with level */
    log: (level: TerminalLogLevel, message: string, data?: unknown) => void;
    /** Log an info message */
    info: (message: string, data?: unknown) => void;
    /** Log a success message */
    success: (message: string, data?: unknown) => void;
    /** Log a warning message */
    warning: (message: string, data?: unknown) => void;
    /** Log an error message */
    error: (message: string, data?: unknown) => void;
    /** Log a debug message */
    debug: (message: string, data?: unknown) => void;
    /** Clear all logs */
    clear: () => void;
    /** Format a log entry for display */
    formatEntry: (entry: TerminalLogEntry) => string;
}

/**
 * React hook for terminal logging operations.
 * 
 * Features:
 * - Convenience methods for each log level
 * - Formatted timestamp display
 * - Direct access to logs for rendering
 * 
 * @example
 * ```tsx
 * const { info, success, error, logs, clear } = useTerminal();
 * 
 * // Log messages
 * info('Starting operation...');
 * success('Operation completed');
 * error('Something went wrong');
 * 
 * // Render logs
 * {logs.map(log => (
 *   <div key={log.id} className={`log-${log.level}`}>
 *     {formatEntry(log)}
 *   </div>
 * ))}
 * ```
 */
export function useTerminal(): UseTerminalReturn {
    // Get store state and actions
    const logs = useTerminalStore((state) => state.logs);
    const logAction = useTerminalStore((state) => state.log);
    const clearAction = useTerminalStore((state) => state.clear);

    /**
     * Log a message with level.
     */
    const log = useCallback((level: TerminalLogLevel, message: string, data?: unknown): void => {
        logAction(level, message, data);
    }, [logAction]);

    /**
     * Log an info message.
     */
    const info = useCallback((message: string, data?: unknown): void => {
        logAction('info', message, data);
    }, [logAction]);

    /**
     * Log a success message.
     */
    const success = useCallback((message: string, data?: unknown): void => {
        logAction('success', message, data);
    }, [logAction]);

    /**
     * Log a warning message.
     */
    const warning = useCallback((message: string, data?: unknown): void => {
        logAction('warning', message, data);
    }, [logAction]);

    /**
     * Log an error message.
     */
    const error = useCallback((message: string, data?: unknown): void => {
        logAction('error', message, data);
    }, [logAction]);

    /**
     * Log a debug message.
     */
    const debug = useCallback((message: string, data?: unknown): void => {
        logAction('debug', message, data);
    }, [logAction]);

    /**
     * Clear all logs.
     */
    const clear = useCallback((): void => {
        clearAction();
    }, [clearAction]);

    /**
     * Format a log entry for display.
     * Returns: [HH:mm:ss] message
     */
    const formatEntry = useCallback((entry: TerminalLogEntry): string => {
        return `${formatTimestamp(entry.timestamp)} ${entry.message}`;
    }, []);

    return {
        logs,
        log,
        info,
        success,
        warning,
        error,
        debug,
        clear,
        formatEntry,
    };
}
