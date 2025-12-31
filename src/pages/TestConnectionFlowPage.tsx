/**
 * Connection Flow Test Page
 * 
 * Temporary page for testing useConnectionFlow hook.
 * Access at: /test-connection-flow
 */

import { ConnectionFlowTest } from '@/components/features/device/ConnectionFlowTest';
import { LogPanel } from '@/components/layout/LogPanel';

export function TestConnectionFlowPage() {
    return (
        <div className="flex h-screen">
            {/* Left: Test Component */}
            <div className="flex-1 p-6 flex items-center justify-center">
                <ConnectionFlowTest />
            </div>

            {/* Right: Terminal Logs */}
            <div className="w-96 border-l border-zinc-800">
                <LogPanel />
            </div>
        </div>
    );
}
