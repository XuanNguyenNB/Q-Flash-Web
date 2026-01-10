/**
 * AI Action Log Panel
 *
 * Hiển thị log các hành động AI automation
 */

import { useRef, useEffect } from 'react';
import { useAIAutomationStore } from '@/stores/aiAutomationStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Trash2,
  ChevronDown,
  Loader2,
  MousePointer2,
  Move,
  Type,
  Clock,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutomationLog, AIAction } from '@/services/aiAutomation';

interface AIActionLogPanelProps {
  className?: string;
  maxHeight?: string;
}

// Action type icons
const ACTION_ICONS: Record<string, React.ReactNode> = {
  tap: <MousePointer2 className="w-3 h-3" />,
  swipe: <Move className="w-3 h-3" />,
  type: <Type className="w-3 h-3" />,
  wait: <Clock className="w-3 h-3" />,
  scroll: <ArrowDown className="w-3 h-3" />,
  key: <Zap className="w-3 h-3" />,
  done: <CheckCircle2 className="w-3 h-3" />,
};

// Log level icons and colors
const LOG_LEVEL_CONFIG: Record<
  AutomationLog['level'],
  { icon: React.ReactNode; color: string; bgColor: string }
> = {
  info: {
    icon: <Info className="w-3 h-3" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  action: {
    icon: <Zap className="w-3 h-3" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
  },
  success: {
    icon: <CheckCircle2 className="w-3 h-3" />,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
  },
  warning: {
    icon: <AlertTriangle className="w-3 h-3" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
  },
  error: {
    icon: <XCircle className="w-3 h-3" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
  },
};

export function AIActionLogPanel({ className, maxHeight = '300px' }: AIActionLogPanelProps) {
  const { logs, isRunning, aiStatus, statusMessage, clearLogs } = useAIAutomationStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Format timestamp
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format action details
  const formatActionDetails = (action: AIAction): string => {
    switch (action.type) {
      case 'tap':
        return `Tap tại (${action.x}, ${action.y})`;
      case 'swipe':
        return `Swipe từ (${action.startX}, ${action.startY}) đến (${action.endX}, ${action.endY})`;
      case 'type':
        return `Nhập: "${action.text}"`;
      case 'wait':
        return `Chờ ${action.waitMs}ms`;
      case 'scroll':
        return `Scroll ${action.direction}`;
      case 'key':
        return `Phím: ${action.keyCode}`;
      case 'done':
        return 'Hoàn thành';
      default:
        return action.description || JSON.stringify(action);
    }
  };

  // Render single log entry
  const renderLogEntry = (log: AutomationLog, index: number) => {
    const config = LOG_LEVEL_CONFIG[log.level];

    return (
      <div
        key={index}
        className={cn(
          'flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs',
          config.bgColor
        )}
      >
        {/* Icon */}
        <div className={cn('flex-none mt-0.5', config.color)}>
          {log.action ? ACTION_ICONS[log.action.type] || config.icon : config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Timestamp */}
          <span className="text-[10px] text-muted-foreground mr-2">
            {formatTime(log.timestamp)}
          </span>

          {/* Message */}
          <span className={cn('font-medium', config.color)}>{log.message}</span>

          {/* Action details */}
          {log.action && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {formatActionDetails(log.action)}
              {log.action.confidence !== undefined && (
                <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">
                  {Math.round(log.action.confidence * 100)}%
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col bg-background border rounded-lg', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">AI Automation</span>

          {/* Status badge */}
          {isRunning && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 gap-1">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {statusMessage || aiStatus}
            </Badge>
          )}
        </div>

        {/* Clear button */}
        {logs.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={clearLogs}
            title="Xóa logs"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Log content */}
      <ScrollArea className="flex-1" style={{ maxHeight }}>
        <div ref={scrollRef} className="p-2 space-y-1">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Chưa có hoạt động nào</p>
              <p className="text-[10px] mt-1">
                Bật AI Automation để xem logs
              </p>
            </div>
          ) : (
            logs.map((log, index) => renderLogEntry(log, index))
          )}
        </div>
      </ScrollArea>

      {/* Footer with stats */}
      {logs.length > 0 && (
        <div className="px-3 py-1.5 border-t bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{logs.length} log entries</span>
          <span>
            {logs.filter((l) => l.level === 'action').length} actions |{' '}
            {logs.filter((l) => l.level === 'error').length} errors
          </span>
        </div>
      )}
    </div>
  );
}
