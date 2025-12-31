/**
 * Q-Flash-Web Terminal Store
 * 
 * Manages terminal log entries for operation feedback.
 * Uses Zustand for lightweight state management.
 */

import { create } from 'zustand';

/**
 * Log level type for terminal entries.
 * Reusing LogLevel from types/index.ts but adding 'debug' for compatibility.
 */
export type TerminalLogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

/**
 * Filter level type - includes 'all' option
 */
export type TerminalFilterLevel = 'all' | TerminalLogLevel;

/**
 * Terminal log entry interface.
 * Extended from LogEntry in types/index.ts with unique id.
 */
export interface TerminalLogEntry {
    id: string;
    timestamp: Date;
    level: TerminalLogLevel;
    message: string;
    data?: unknown;
}

/**
 * Terminal store state interface.
 */
export interface TerminalState {
    // State
    logs: TerminalLogEntry[];
    maxLogs: number;
    filterLevel: TerminalFilterLevel;
    searchQuery: string;

    // Actions
    log: (level: TerminalLogLevel, message: string, data?: unknown) => void;
    clear: () => void;
    setFilterLevel: (level: TerminalFilterLevel) => void;
    setSearchQuery: (query: string) => void;
}

/**
 * Generate unique id for log entries.
 */
const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Terminal store hook.
 * Manages terminal log entries with color-coded levels.
 */
export const useTerminalStore = create<TerminalState>()((set) => ({
    // Initial state
    logs: [],
    maxLogs: 10000, // Increased to support backup of 100+ partitions
    filterLevel: 'all',
    searchQuery: '',

    // Actions
    log: (level, message, data) => set((state) => {
        const newEntry: TerminalLogEntry = {
            id: generateId(),
            timestamp: new Date(),
            level,
            message,
            data,
        };

        // Keep only the last maxLogs entries
        const newLogs = [...state.logs, newEntry].slice(-state.maxLogs);

        return { logs: newLogs };
    }),

    clear: () => set({ logs: [] }),

    setFilterLevel: (level) => set({ filterLevel: level }),

    setSearchQuery: (query) => set({ searchQuery: query }),
}));

