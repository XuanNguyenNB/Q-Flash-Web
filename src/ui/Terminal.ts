/**
 * Terminal UI Component
 * 
 * CLI-style logging terminal for displaying protocol messages and status.
 */

import type { LogLevel, LogEntry } from '../types';

export class Terminal {
    private container: HTMLElement;
    private logEntries: LogEntry[] = [];
    private maxEntries = 1000;

    constructor(containerId: string) {
        const element = document.getElementById(containerId);
        if (!element) {
            throw new Error(`Terminal container not found: ${containerId}`);
        }
        this.container = element;
        this.container.className = 'terminal';
    }

    /**
     * Log a message
     */
    log(message: string, level: LogLevel = 'info'): void {
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
        };

        this.logEntries.push(entry);

        // Trim old entries
        if (this.logEntries.length > this.maxEntries) {
            this.logEntries.shift();
            this.container.removeChild(this.container.firstChild!);
        }

        // Create and append log line
        const line = document.createElement('div');
        line.className = `log-line log-${level}`;

        const timestamp = document.createElement('span');
        timestamp.className = 'log-timestamp';
        timestamp.textContent = this.formatTimestamp(entry.timestamp);

        const levelSpan = document.createElement('span');
        levelSpan.className = 'log-level';
        levelSpan.textContent = `[${level.toUpperCase()}]`;

        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-message';
        messageSpan.textContent = message;

        line.appendChild(timestamp);
        line.appendChild(levelSpan);
        line.appendChild(messageSpan);

        this.container.appendChild(line);

        // Auto-scroll to bottom
        this.container.scrollTop = this.container.scrollHeight;
    }

    /**
     * Log info message
     */
    info(message: string): void {
        this.log(message, 'info');
    }

    /**
     * Log success message
     */
    success(message: string): void {
        this.log(message, 'success');
    }

    /**
     * Log warning message
     */
    warning(message: string): void {
        this.log(message, 'warning');
    }

    /**
     * Log error message
     */
    error(message: string): void {
        this.log(message, 'error');
    }

    /**
     * Log debug message
     */
    debug(message: string): void {
        this.log(message, 'debug');
    }

    /**
     * Clear all logs
     */
    clear(): void {
        this.logEntries = [];
        this.container.innerHTML = '';
    }

    /**
     * Add a separator line
     */
    separator(): void {
        const line = document.createElement('div');
        line.className = 'log-separator';
        line.textContent = '─'.repeat(60);
        this.container.appendChild(line);
    }

    /**
     * Display a table of partitions
     */
    showPartitionTable(partitions: { name: string; startSector: bigint; sizeFormatted: string; lun?: number }[]): void {
        this.separator();
        this.info('┌─────────────────────────────────────────────────────────────────────────┐');
        this.info('│                           PARTITION TABLE                              │');
        this.info('├─────┬──────────────────────────┬──────────────────┬──────────────────┤');
        this.info('│ LUN │ Name                     │ Start Sector     │ Size             │');
        this.info('├─────┼──────────────────────────┼──────────────────┼──────────────────┤');

        for (const p of partitions) {
            const lun = (p.lun ?? 0).toString().padStart(3);
            const name = p.name.padEnd(24).substring(0, 24);
            const start = p.startSector.toString().padStart(16);
            const size = p.sizeFormatted.padStart(16);
            this.info(`│ ${lun} │ ${name} │ ${start} │ ${size} │`);
        }

        this.info('└─────┴──────────────────────────┴──────────────────┴──────────────────┘');
        this.separator();
    }

    /**
     * Format timestamp for display
     */
    private formatTimestamp(date: Date): string {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ms = date.getMilliseconds().toString().padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${ms}`;
    }
}
