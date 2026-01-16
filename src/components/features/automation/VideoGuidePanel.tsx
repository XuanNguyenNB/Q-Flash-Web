/**
 * Video Guide Panel Component
 *
 * Panel hiển thị video hướng dẫn cho từng bước trong workflow
 * Bao gồm thanh trạng thái và các nút điều khiển workflow
 * Tối ưu cho video dọc (portrait) như quay màn hình điện thoại
 */

import { useState, useRef, useEffect } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PackageUninstallStep } from './PackageUninstallStep';
import { AppOptimizeStep } from './AppOptimizeStep';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  RotateCcw,
  Video,
  Info,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Trash2,
  BellRing,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoGuidePanelProps {
  className?: string;
}

export function VideoGuidePanel({ className }: VideoGuidePanelProps) {
  const {
    selectedWorkflow,
    currentStepIndex,
    executionStatus,
    nextStep,
    previousStep,
    getProgress,
    clearSelectedWorkflow,
    completeWorkflow,
  } = useWorkflowStore();

  // Workflow execution - only need for checking if workflow is running
  const { isRunning } = useWorkflowExecution();

  const workflowProgress = getProgress();
  const isCompleted = workflowProgress.completed === workflowProgress.total && workflowProgress.total > 0;

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVideoVertical, setIsVideoVertical] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const currentStep = selectedWorkflow?.steps[currentStepIndex];
  const hasVideo = !!currentStep?.videoUrl;
  const isYouTube = currentStep?.videoUrl?.includes('youtube.com') || currentStep?.videoUrl?.includes('youtu.be');
  const isUninstallStep = currentStep?.type === 'uninstall-packages' && currentStep?.packagesInfo;
  const isOptimizeStep = currentStep?.type === 'optimize-notifications';
  const isInteractiveStep = isUninstallStep || isOptimizeStep;
  const isLastStep = currentStepIndex === (selectedWorkflow?.steps.length || 1) - 1;

  // Handle complete for uninstall step
  const handleUninstallComplete = () => {
    if (isLastStep) {
      completeWorkflow();
    } else {
      nextStep();
    }
  };

  // Handle complete for optimize step
  const handleOptimizeComplete = () => {
    if (isLastStep) {
      completeWorkflow();
    } else {
      nextStep();
    }
  };

  // Check if step has sub-steps
  const hasSubSteps = currentStep?.subSteps && currentStep.subSteps.length > 0;

  // Reset video when step changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setVideoError(null);
    }
    setIsLoading(hasVideo);
  }, [currentStepIndex, hasVideo]);

  // Handle play/pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  // Handle mute
  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Handle restart
  const restartVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
  };

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoContainerRef.current.requestFullscreen();
    }
  };

  // Update progress
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(currentProgress);
  };

  // Handle loaded metadata - detect orientation
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setIsLoading(false);

    // Check if video is vertical (height > width)
    const video = videoRef.current;
    setIsVideoVertical(video.videoHeight > video.videoWidth);
  };

  // Handle video events
  const handleEnded = () => setIsPlaying(false);
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleError = () => {
    setIsLoading(false);
    setVideoError('Không thể tải video');
  };
  const handleCanPlay = () => setIsLoading(false);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Seek video
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * videoRef.current.duration;
  };

  return (
    <Card className={cn('flex flex-col h-full overflow-hidden', className)}>
      <CardHeader className="pb-2 flex-none px-3 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Video className="w-4 h-4" />
            Hướng dẫn chi tiết
          </CardTitle>
          {currentStep && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              Bước {currentStepIndex + 1}/{selectedWorkflow?.steps.length || 0}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
        {!selectedWorkflow ? (
          // No workflow selected
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Video className="w-12 h-12 mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">
              Chọn quy trình để xem video hướng dẫn.
            </p>
          </div>
        ) : !currentStep ? (
          // No current step
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <Play className="w-12 h-12 mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">
              Nhấn "Tiếp" để bắt đầu quy trình.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Step Title */}
            <div className="flex-none px-3 py-2 border-b bg-muted/30">
              <h3 className="text-sm font-semibold leading-tight flex items-center gap-2">
                {isUninstallStep && <Trash2 className="w-4 h-4 text-red-500" />}
                {isOptimizeStep && <BellRing className="w-4 h-4 text-amber-500" />}
                {currentStep.titleVi || currentStep.title}
              </h3>
              {currentStep.descriptionVi && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{currentStep.descriptionVi}</p>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Uninstall Packages Step */}
              {isUninstallStep ? (
                <PackageUninstallStep
                  packagesInfo={currentStep.packagesInfo!}
                  onComplete={handleUninstallComplete}
                  className="flex-1"
                />
              ) : isOptimizeStep ? (
                <AppOptimizeStep
                  optimizationMethods={currentStep.optimizationMethods}
                  onComplete={handleOptimizeComplete}
                  className="flex-1"
                />
              ) : hasVideo ? (
                <div
                  ref={videoContainerRef}
                  className={cn(
                    'relative bg-black flex items-center justify-center',
                    // For vertical videos, use more height
                    isVideoVertical ? 'flex-1 min-h-0' : 'flex-none'
                  )}
                >
                  {isYouTube ? (
                    // YouTube embed - vertical friendly
                    <div className={cn(
                      'w-full h-full flex items-center justify-center',
                      isVideoVertical ? 'max-w-[60%] mx-auto' : ''
                    )}>
                      <iframe
                        src={getYouTubeEmbedUrl(currentStep.videoUrl!)}
                        className={cn(
                          isVideoVertical
                            ? 'w-full h-full max-h-full'
                            : 'w-full aspect-video'
                        )}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <>
                      {/* Loading overlay */}
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                      )}

                      {/* Error overlay */}
                      {videoError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                          <Video className="w-8 h-8 text-white/50 mb-2" />
                          <p className="text-white/70 text-xs">{videoError}</p>
                        </div>
                      )}

                      {/* Video element - optimized for vertical */}
                      <video
                        ref={videoRef}
                        src={currentStep.videoUrl}
                        poster={currentStep.videoPoster}
                        className={cn(
                          'max-h-full max-w-full object-contain',
                          // For vertical videos, constrain width to show properly
                          isVideoVertical ? 'h-full w-auto' : 'w-full h-auto'
                        )}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={handleEnded}
                        onPlay={handlePlay}
                        onPause={handlePause}
                        onError={handleError}
                        onCanPlay={handleCanPlay}
                        onLoadStart={() => setIsLoading(true)}
                        preload="metadata"
                        playsInline
                      />

                      {/* Video Controls - Floating at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8">
                        {/* Progress bar */}
                        <div
                          className="h-1.5 bg-white/30 rounded-full mb-2 cursor-pointer hover:h-2 transition-all group"
                          onClick={handleSeek}
                        >
                          <div
                            className="h-full bg-primary rounded-full relative"
                            style={{ width: `${progress}%` }}
                          >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>

                        {/* Control buttons */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                            onClick={togglePlay}
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                            onClick={restartVideo}
                            title="Xem lại từ đầu"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>

                          <span className="text-[10px] text-white/90 font-mono ml-1">
                            {videoRef.current ? formatTime(videoRef.current.currentTime) : '0:00'}
                            <span className="text-white/50 mx-1">/</span>
                            {formatTime(duration)}
                          </span>

                          <div className="flex-1" />

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                            onClick={toggleMute}
                            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                          >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-white hover:text-white hover:bg-white/20"
                            onClick={toggleFullscreen}
                            title="Toàn màn hình"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Click to play overlay (when paused) */}
                      {!isPlaying && !isLoading && (
                        <div
                          className="absolute inset-0 flex items-center justify-center cursor-pointer group"
                          onClick={togglePlay}
                        >
                          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center group-hover:bg-primary/80 transition-colors">
                            <Play className="w-8 h-8 text-white ml-1" />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : null}

              {/* Sub-steps / Instructions - Scrollable (not for uninstall step and optimize step) */}
              {!isUninstallStep && !isOptimizeStep && (
                <ScrollArea className={cn(
                  'min-h-0',
                  hasVideo && isVideoVertical ? 'flex-none max-h-[180px]' : 'flex-1'
                )}>
                  {hasSubSteps && (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
                        <Info className="w-3.5 h-3.5" />
                        Các bước thực hiện:
                      </div>
                      {currentStep.subSteps?.map((subStep, idx) => (
                        <div
                          key={subStep.id}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                        >
                          <div className="flex-none w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            <span className="text-xs">{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-relaxed">{subStep.instruction}</p>
                            {subStep.alternativeInstructions && subStep.alternativeInstructions.length > 0 && (
                              <div className="mt-2 pl-2.5 border-l-2 border-primary/20">
                                <p className="text-xs text-muted-foreground font-medium mb-1">Hoặc:</p>
                                {subStep.alternativeInstructions.map((alt, i) => (
                                  <p key={i} className="text-xs text-muted-foreground">• {alt}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* User prompt / Main instruction */}
                  {currentStep.userPromptVi && !hasSubSteps && (
                    <div className="p-3">
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-amber-600 flex-none mt-0.5" />
                          <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                            {currentStep.userPromptVi}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>

            {/* Workflow Control Bar - Simplified (not for uninstall step) */}
            {!isUninstallStep && (
              <div className="flex-none border-t bg-muted/30 p-3 space-y-3">
                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Tiến độ</span>
                    <span className="font-medium">{workflowProgress.completed}/{workflowProgress.total} bước</span>
                  </div>
                  <Progress value={workflowProgress.percentage} className="h-2" />
                </div>

                {/* Control Buttons - Simplified */}
                {isCompleted ? (
                  // Completed state
                  <div className="flex items-center justify-center gap-2 py-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      Hoàn thành!
                    </span>
                  </div>
                ) : (
                  // Navigation buttons
                  <div className="flex items-center justify-center gap-3">
                    {/* Previous Step */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-4 text-sm"
                      onClick={previousStep}
                      disabled={currentStepIndex === 0 || isRunning}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Trước
                    </Button>

                    {/* Next Step */}
                    <Button
                      size="sm"
                      className="h-9 px-4 text-sm"
                      onClick={nextStep}
                      disabled={currentStepIndex >= (selectedWorkflow?.steps.length || 1) - 1 || isRunning}
                    >
                      Tiếp
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>

                    {/* Complete Button - Only show on last step */}
                    {isLastStep && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-9 px-4 text-sm bg-green-600 hover:bg-green-700"
                        onClick={completeWorkflow}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Hoàn thành
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Convert YouTube URL to embed URL
 */
function getYouTubeEmbedUrl(url: string): string {
  // Handle YouTube Shorts format
  if (url.includes('youtube.com/shorts/')) {
    const videoId = url.split('youtube.com/shorts/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Handle youtu.be format
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Handle youtube.com/watch format
  if (url.includes('youtube.com/watch')) {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const videoId = urlParams.get('v');
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Already embed format
  if (url.includes('youtube.com/embed/')) {
    return url;
  }

  return url;
}
