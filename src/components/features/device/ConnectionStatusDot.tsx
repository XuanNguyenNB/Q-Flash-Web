/**
 * ConnectionStatusDot Component
 * 
 * Visual indicator for device connection status.
 * Shows different colors and animations based on connection state.
 * 
 * Story: 2.4 - Device Card & Connection Status
 */

import { cn } from '@/lib/utils';

/**
 * Connection status type
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface ConnectionStatusDotProps {
    status: ConnectionStatus;
    className?: string;
}

/**
 * ConnectionStatusDot - visual status indicator
 * 
 * States:
 * - disconnected: gray dot (bg-zinc-500)
 * - connecting: yellow pulsing dot (bg-yellow-500 + animate-pulse)
 * - connected: green dot (bg-green-500)
 * - error: red dot (bg-red-500)
 */
export function ConnectionStatusDot({ status, className }: ConnectionStatusDotProps) {
    return (
        <div
            className={cn(
                "h-2.5 w-2.5 rounded-full transition-all",
                status === 'disconnected' && "bg-zinc-500",
                status === 'connecting' && "bg-yellow-500 animate-pulse",
                status === 'connected' && "bg-green-500",
                status === 'error' && "bg-red-500",
                className
            )}
            aria-label={`Connection status: ${status}`}
        />
    );
}
