/**
 * AI Assistant Panel Component
 *
 * Panel AI Assistant với khả năng:
 * - Đọc hiểu ngữ cảnh (device, brand, model, OS)
 * - Hướng dẫn chi tiết từng bước
 * - Tra cứu web khi cần
 * - Hiển thị sub-steps cho guided-action
 */

import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { useWorkflowStore } from '@/stores/workflowStore';
import { callGeminiAPI, generateSmartSuggestions, searchWeb } from '@/services/geminiAI';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Bot,
  Send,
  Sparkles,
  Lightbulb,
  User as UserIcon,
  Smartphone,
  Globe,
  CheckCircle2,
  Circle,
  Info,
  Search,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIChatMessage, GuidedSubStep } from '@/types/workflow';

interface AIAssistantPanelProps {
  className?: string;
}

export function AIAssistantPanel({ className }: AIAssistantPanelProps) {
  const {
    aiEnabled,
    toggleAI,
    chatMessages,
    addChatMessage,
    aiSuggestions,
    setAISuggestions,
    selectedWorkflow,
    getCurrentStep,
    deviceFilter,
    currentStepIndex,
    stepStates,
    getAIContext,
  } = useWorkflowStore();

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [currentSubStepIndex, setCurrentSubStepIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentStep = getCurrentStep();
  const currentStepState = currentStep ? stepStates.get(currentStep.id) : undefined;
  const aiContext = getAIContext();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Reset sub-step index when step changes
  useEffect(() => {
    setCurrentSubStepIndex(0);
  }, [currentStepIndex]);

  // Generate context-based suggestions using smart suggestions
  useEffect(() => {
    if (!aiEnabled) {
      setAISuggestions([]);
      return;
    }

    const suggestions = generateSmartSuggestions(selectedWorkflow, currentStep);
    setAISuggestions(suggestions);
  }, [currentStep, selectedWorkflow, aiEnabled, setAISuggestions]);

  // Handle web search
  const handleWebSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const results = await searchWeb(query);
      const searchMessage: AIChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `🔍 **Kết quả tìm kiếm cho "${query}":**\n\n${results}`,
        timestamp: new Date(),
        metadata: {
          isWebSearch: true,
        },
      };
      addChatMessage(searchMessage);
    } catch (error) {
      console.error('Web search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !aiEnabled) return;

    const userMessage: AIChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    addChatMessage(userMessage);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Convert chat messages to format for API
      const previousMessages = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Build enhanced context for AI
      const contextInfo = `
Ngữ cảnh thiết bị:
- Hãng: ${deviceFilter.brand || 'Chưa chọn'}
- Model: ${deviceFilter.model || 'Chưa chọn'}
- Phiên bản OS: ${deviceFilter.osVersion || 'Chưa chọn'}
- Kết nối: ${aiContext.device.isConnected ? 'Đã kết nối' : 'Chưa kết nối'}

Quy trình hiện tại: ${selectedWorkflow?.nameVi || 'Chưa chọn'}
Bước hiện tại: ${currentStep ? `${currentStepIndex + 1}. ${currentStep.titleVi || currentStep.title}` : 'Chưa bắt đầu'}
`;

      // Call Gemini API with enhanced context
      const response = await callGeminiAPI(
        userMessage.content,
        selectedWorkflow,
        currentStep,
        previousMessages,
        contextInfo
      );

      const aiMessage: AIChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        metadata: {
          stepId: currentStep?.id,
        },
      };

      addChatMessage(aiMessage);
    } catch (error) {
      console.error('AI chat error:', error);

      const errorMessage: AIChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.',
        timestamp: new Date(),
      };

      addChatMessage(errorMessage);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  // Render sub-steps for guided-action
  const renderSubSteps = (subSteps: GuidedSubStep[]) => (
    <div className="space-y-1.5 mb-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
        <Info className="w-3 h-3" />
        Hướng dẫn chi tiết:
      </div>
      {subSteps.map((subStep, idx) => (
        <div
          key={subStep.id}
          className={cn(
            'flex items-start gap-2 p-1.5 rounded text-[10px]',
            idx === currentSubStepIndex ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
          )}
        >
          <div className="flex-none pt-0.5">
            {idx < currentSubStepIndex ? (
              <CheckCircle2 className="w-3 h-3 text-green-600" />
            ) : idx === currentSubStepIndex ? (
              <Circle className="w-3 h-3 text-primary fill-primary" />
            ) : (
              <Circle className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <p>{subStep.instruction}</p>
            {subStep.alternativeInstructions && subStep.alternativeInstructions.length > 0 && (
              <div className="mt-1 text-muted-foreground">
                <span className="text-[9px]">Hoặc: </span>
                {subStep.alternativeInstructions.map((alt, i) => (
                  <span key={i} className="text-[9px]">
                    {alt}
                    {i < subStep.alternativeInstructions!.length - 1 ? ' / ' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Render device context badge
  const renderDeviceContext = () => {
    if (!deviceFilter.brand && !deviceFilter.model) return null;

    return (
      <div className="flex items-center gap-1.5 px-4 py-1.5 bg-muted/50 border-b text-[9px]">
        <Smartphone className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">Thiết bị:</span>
        {deviceFilter.brand && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
            {deviceFilter.brand}
          </Badge>
        )}
        {deviceFilter.model && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
            {deviceFilter.model}
          </Badge>
        )}
        {deviceFilter.osVersion && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
            {deviceFilter.osVersion}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-2 flex-none">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" />
            AI Assistant
            {isSearching && (
              <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4 gap-1">
                <Search className="w-2.5 h-2.5 animate-pulse" />
                Đang tra cứu...
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="ai-toggle"
              checked={aiEnabled}
              onCheckedChange={toggleAI}
              className="scale-75"
            />
            <Label htmlFor="ai-toggle" className="text-[10px] cursor-pointer">
              {aiEnabled ? 'Bật' : 'Tắt'}
            </Label>
          </div>
        </div>
      </CardHeader>

      {/* Device Context */}
      {aiEnabled && renderDeviceContext()}

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {!aiEnabled ? (
          // AI Disabled View
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Bot className="w-10 h-10 mb-2 text-muted-foreground opacity-30" />
            <p className="text-[10px] text-muted-foreground">
              AI Assistant đang tắt.
              <br />
              Bật để nhận hỗ trợ từ AI.
            </p>
          </div>
        ) : (
          <>
            {/* Current Step Guide (for guided-action) */}
            {currentStep?.type === 'guided-action' && currentStep.subSteps && currentStepState === 'waiting-confirm' && (
              <div className="flex-none px-3 py-2 bg-primary/5 border-b">
                {renderSubSteps(currentStep.subSteps)}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[9px] flex-1"
                    onClick={() => setCurrentSubStepIndex(Math.max(0, currentSubStepIndex - 1))}
                    disabled={currentSubStepIndex === 0}
                  >
                    Bước trước
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-[9px] flex-1"
                    onClick={() => {
                      if (currentSubStepIndex < currentStep.subSteps!.length - 1) {
                        setCurrentSubStepIndex(currentSubStepIndex + 1);
                      }
                    }}
                    disabled={currentSubStepIndex >= currentStep.subSteps.length - 1}
                  >
                    Bước tiếp
                  </Button>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full px-3" ref={scrollRef}>
                <div className="space-y-2 py-2">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-[10px] text-muted-foreground py-6">
                      <Sparkles className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
                      Xin chào! Tôi là AI Assistant.
                      <br />
                      Hỏi tôi về workflow hoặc cách thực hiện.
                    </div>
                  ) : (
                    chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex gap-1.5',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex-none w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                            {message.metadata?.isWebSearch ? (
                              <Globe className="w-3 h-3 text-primary" />
                            ) : (
                              <Bot className="w-3 h-3 text-primary" />
                            )}
                          </div>
                        )}

                        <div
                          className={cn(
                            'max-w-[85%] rounded-lg px-2.5 py-1.5 text-[10px]',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          )}
                        >
                          <div className="prose prose-xs prose-slate dark:prose-invert max-w-none [&_p]:my-1 [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:text-[9px] [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
                            <Markdown>{message.content}</Markdown>
                          </div>
                          {message.metadata?.sources && message.metadata.sources.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-border/50">
                              <div className="flex items-center gap-1 text-[8px] text-muted-foreground mb-1">
                                <ExternalLink className="w-2.5 h-2.5" />
                                Nguồn tham khảo:
                              </div>
                              {message.metadata.sources.map((source, i) => (
                                <a
                                  key={i}
                                  href={source}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-[8px] text-primary hover:underline truncate"
                                >
                                  {source}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {message.role === 'user' && (
                          <div className="flex-none w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <UserIcon className="w-3 h-3 text-blue-600" />
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {isTyping && (
                    <div className="flex gap-1.5 justify-start">
                      <div className="flex-none w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="w-3 h-3 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg px-2.5 py-1.5 text-[10px]">
                        <div className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="flex-none px-3 py-1.5 border-t bg-muted/30">
                <div className="flex items-center gap-1 mb-1">
                  <Lightbulb className="w-3 h-3 text-yellow-600" />
                  <span className="text-[9px] font-medium text-muted-foreground">
                    Gợi ý
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {aiSuggestions.slice(0, 3).map((suggestion, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-[8px] cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Web Search Quick Action */}
            {currentStep?.webSearchKeywords && currentStep.webSearchKeywords.length > 0 && (
              <div className="flex-none px-3 py-1.5 border-t">
                <div className="flex items-center gap-1 mb-1">
                  <Search className="w-3 h-3 text-blue-600" />
                  <span className="text-[9px] font-medium text-muted-foreground">
                    Tra cứu nhanh
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {currentStep.webSearchKeywords.map((keyword: string, idx: number) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="text-[8px] cursor-pointer hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/50 transition-colors gap-1"
                      onClick={() => handleWebSearch(keyword)}
                    >
                      <Globe className="w-2.5 h-2.5" />
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex-none p-3 border-t bg-background">
              <div className="flex gap-1.5">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Hỏi AI Assistant..."
                  className="flex-1 h-8 text-[10px]"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  size="icon"
                  className="h-8 w-8"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
