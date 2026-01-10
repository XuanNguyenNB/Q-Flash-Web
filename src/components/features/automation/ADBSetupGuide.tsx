/**
 * ADB Setup Guide Component
 *
 * Hướng dẫn bật gỡ lỗi USB theo từng hãng điện thoại
 * Hiển thị khi người dùng vào trang Tự động hóa mà chưa kết nối ADB
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Smartphone,
  Usb,
  Cable,
  CheckCircle2,
  ChevronRight,
  Play,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useADB } from '@/hooks/useADB';
import { useADBStore } from '@/stores/adbStore';

interface ADBSetupGuideProps {
  className?: string;
  onConnected?: () => void;
}

interface BrandGuide {
  id: string;
  name: string;
  icon: string;
  videoUrl?: string;
  steps: {
    id: string;
    title: string;
    instruction: string;
    details?: string[];
  }[];
}

// Brand-specific ADB setup guides
const BRAND_GUIDES: BrandGuide[] = [
  {
    id: 'honor',
    name: 'Honor',
    icon: '🏆',
    videoUrl: 'https://youtu.be/Ww0aUbSHTEc',
    steps: [
      {
        id: 'honor-1',
        title: 'Đăng nhập Honor ID',
        instruction: 'Đăng nhập tài khoản Honor ID trên điện thoại',
        details: [
          'Vào Cài đặt → Tài khoản → Đăng nhập Honor ID',
          'Nếu chưa có tài khoản, tạo mới và xác minh',
        ],
      },
      {
        id: 'honor-2',
        title: 'Bật chế độ nhà phát triển',
        instruction: 'Vào Cài đặt → Giới thiệu điện thoại → Chạm liên tục 10 lần vào "Số hiệu bản dựng"',
        details: [
          'Chạm liên tục và nhanh vào dòng "Số hiệu bản dựng"',
          'Máy sẽ hiện thông báo: "Bạn đã là nhà phát triển"',
        ],
      },
      {
        id: 'honor-3',
        title: 'Bật Gỡ lỗi USB',
        instruction: 'Quay lại Cài đặt → Hệ thống và cập nhật → Tùy chọn nhà phát triển → Bật "Gỡ lỗi USB"',
        details: [
          'Tìm mục "Tùy chọn nhà phát triển" trong phần Hệ thống',
          'Bật công tắc "Gỡ lỗi USB"',
          'Xác nhận bật nếu có hộp thoại hỏi',
        ],
      },
      {
        id: 'honor-4',
        title: 'Kết nối và cho phép',
        instruction: 'Cắm cáp USB, chọn chế độ "Truyền tệp", cho phép gỡ lỗi USB từ máy tính này',
        details: [
          'Cắm cáp USB kết nối điện thoại với máy tính',
          'Trên trang web, nhấn nút "Kết nối ADB"',
          'Trên điện thoại, chọn chế độ "Truyền tệp" (MTP)',
          'Khi hiện thông báo "Cho phép gỡ lỗi USB?", tích vào "Luôn cho phép từ máy tính này" rồi chọn OK',
        ],
      },
    ],
  },
  {
    id: 'oppo',
    name: 'Oppo / Realme / OnePlus',
    icon: '📱',
    videoUrl: undefined, // TODO: Add video later
    steps: [
      {
        id: 'oppo-1',
        title: 'Bật chế độ nhà phát triển',
        instruction: 'Vào Cài đặt → Giới thiệu điện thoại → Chạm liên tục 7 lần vào "Phiên bản bản dựng"',
        details: [
          'Có thể ở mục "Thông tin phần mềm" hoặc "Giới thiệu điện thoại"',
          'Chạm liên tục và nhanh vào dòng "Phiên bản bản dựng" hoặc "Build number"',
          'Máy sẽ hiện thông báo: "Bạn đã ở chế độ nhà phát triển"',
        ],
      },
      {
        id: 'oppo-2',
        title: 'Bật Gỡ lỗi USB',
        instruction: 'Quay lại Cài đặt → Cài đặt bổ sung → Tùy chọn nhà phát triển → Bật "Gỡ lỗi USB"',
        details: [
          'Trên ColorOS: Cài đặt → Cài đặt bổ sung → Tùy chọn nhà phát triển',
          'Bật công tắc "Gỡ lỗi USB"',
          'Xác nhận bật nếu có hộp thoại hỏi',
        ],
      },
      {
        id: 'oppo-3',
        title: 'Kết nối và cho phép',
        instruction: 'Cắm cáp USB, chọn chế độ "Truyền tệp", cho phép gỡ lỗi USB',
        details: [
          'Cắm cáp USB kết nối điện thoại với máy tính',
          'Trên trang web, nhấn nút "Kết nối ADB"',
          'Trên điện thoại, chọn chế độ "Truyền tệp" (MTP)',
          'Khi hiện thông báo "Cho phép gỡ lỗi USB?", tích vào "Luôn cho phép" rồi chọn OK',
        ],
      },
    ],
  },
];

export function ADBSetupGuide({ className, onConnected }: ADBSetupGuideProps) {
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const { connect, getDeviceInfo, getInstance } = useADB();
  const { isConnecting } = useADBStore();
  const protocol = getInstance();
  const isConnected = protocol.isConnected;

  const selectedGuide = BRAND_GUIDES.find(b => b.id === selectedBrand);

  // Handle connect
  const handleConnect = async () => {
    const success = await connect();
    if (success) {
      await getDeviceInfo();
      onConnected?.();
    }
  };

  // If connected, show success
  if (isConnected) {
    return (
      <Card className={cn('flex flex-col h-full', className)}>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Đã kết nối thành công!</h3>
          <p className="text-muted-foreground">
            Thiết bị đã sẵn sàng. Bây giờ bạn có thể chọn và chạy các quy trình tự động.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Brand selection
  if (!selectedBrand) {
    return (
      <Card className={cn('flex flex-col h-full', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Usb className="w-5 h-5" />
            Hướng dẫn bật Gỡ lỗi USB
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Để sử dụng tính năng Tự động hóa, bạn cần bật Gỡ lỗi USB trên điện thoại.
            Chọn hãng điện thoại của bạn:
          </p>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="grid gap-3">
            {BRAND_GUIDES.map(brand => (
              <Button
                key={brand.id}
                variant="outline"
                className="h-auto p-4 justify-start gap-4 hover:border-primary"
                onClick={() => {
                  setSelectedBrand(brand.id);
                  setCurrentStepIndex(0);
                }}
              >
                <span className="text-3xl">{brand.icon}</span>
                <div className="text-left">
                  <div className="font-semibold">{brand.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {brand.steps.length} bước hướng dẫn
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 ml-auto text-muted-foreground" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step-by-step guide
  const currentStep = selectedGuide?.steps[currentStepIndex];
  const isLastStep = currentStepIndex === (selectedGuide?.steps.length || 1) - 1;

  return (
    <Card className={cn('flex flex-col h-full overflow-hidden', className)}>
      <CardHeader className="pb-2 flex-none">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setSelectedBrand(null)}
          >
            ← Quay lại
          </Button>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span>{selectedGuide?.icon}</span>
            {selectedGuide?.name}
          </CardTitle>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mt-3">
          {selectedGuide?.steps.map((step, idx) => (
            <div
              key={step.id}
              className={cn(
                'flex-1 h-1.5 rounded-full transition-colors',
                idx < currentStepIndex ? 'bg-green-500' :
                idx === currentStepIndex ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">
            Bước {currentStepIndex + 1}/{selectedGuide?.steps.length}
          </span>
          {selectedGuide?.videoUrl && (
            <a
              href={selectedGuide.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              Xem video hướng dẫn
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
        {/* Video embed for last step or if available */}
        {selectedGuide?.videoUrl && isLastStep && (
          <div className="flex-none bg-black aspect-video max-h-[200px] flex items-center justify-center">
            <iframe
              src={getYouTubeEmbedUrl(selectedGuide.videoUrl)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Current Step */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-none w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {currentStepIndex + 1}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-base mb-1">{currentStep?.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {currentStep?.instruction}
                </p>
              </div>
            </div>

            {/* Details */}
            {currentStep?.details && currentStep.details.length > 0 && (
              <div className="ml-13 pl-4 border-l-2 border-primary/20 space-y-2">
                {currentStep.details.map((detail, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-primary text-sm">•</span>
                    <p className="text-sm text-muted-foreground">{detail}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Connect button on last step */}
            {isLastStep && (
              <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <Cable className="w-6 h-6 text-primary" />
                  <div>
                    <h4 className="font-semibold text-sm">Sẵn sàng kết nối?</h4>
                    <p className="text-xs text-muted-foreground">
                      Đảm bảo cáp USB đã cắm và điện thoại ở chế độ "Truyền tệp"
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang kết nối...
                    </>
                  ) : (
                    <>
                      <Usb className="w-4 h-4 mr-2" />
                      Kết nối ADB
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Navigation */}
        <div className="flex-none p-4 border-t bg-muted/30 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
            disabled={currentStepIndex === 0}
          >
            ← Trước
          </Button>

          {!isLastStep ? (
            <Button
              onClick={() => setCurrentStepIndex(prev => prev + 1)}
            >
              Tiếp →
            </Button>
          ) : (
            <Badge variant="secondary" className="px-3 py-1">
              <Smartphone className="w-3 h-3 mr-1" />
              Bước cuối cùng
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Convert YouTube URL to embed URL
 */
function getYouTubeEmbedUrl(url: string): string {
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
