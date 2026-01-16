# EDL Getting Started Wizard - Implementation Plan

## Tổng quan

Tính năng **EDL Getting Started Wizard** giúp người dùng mới hiểu và sử dụng chế độ EDL một cách dễ dàng. Wizard sẽ hiển thị khi người dùng lần đầu vào trang EDL và hướng dẫn từng bước dựa trên:

1. **Hãng điện thoại** (Oppo/OnePlus/Realme hoặc LG)
2. **Mục đích sử dụng** (cứu máy, backup, v.v.)

---

## Luồng Wizard (Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Welcome / Giới thiệu                                   │
│  - "Chào mừng đến EDL Mode!"                                    │
│  - Giải thích ngắn gọn EDL là gì, dùng để làm gì                │
│  - [Bắt đầu nhanh] button                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Chọn hãng điện thoại                                   │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │  📱 OPPO / OnePlus  │  │  📱 LG              │               │
│  │     / Realme        │  │                     │               │
│  │  (BBK Electronics)  │  │  (LG Electronics)   │               │
│  └─────────────────────┘  └─────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Chọn Model điện thoại (Optional - dựa vào hãng)        │
│  - Dropdown/Search để chọn model cụ thể                         │
│  - Auto-fill thông tin cần thiết                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Mục đích sử dụng                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │
│  │ 🔧 Cứu máy     │  │ 💾 Backup      │  │ 📦 Flash ROM   │     │
│  │   (Unbrick)    │  │   dữ liệu      │  │   mới          │     │
│  └────────────────┘  └────────────────┘  └────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
     [Cứu máy Flow]    [Backup Flow]     [Flash ROM Flow]
```

---

## Chi tiết từng Flow theo mục đích

### Flow A: Cứu máy (Unbrick) - Phổ biến nhất

```
Step 5A: Hướng dẫn cứu máy
├── 5A.1: Tải ROM
│   - Link tải ROM chính thức cho model đã chọn
│   - Giải thích các file cần có trong ROM
│
├── 5A.2: Chuẩn bị Super Image (nếu cần)
│   - Hướng dẫn dùng tool build super image
│   - Giải thích tại sao cần super image
│
├── 5A.3: Chuẩn bị Firehose files
│   - Programmer (.melf/.mbn)
│   - Digest (.elf)
│   - Signature (.bin)
│
├── 5A.4: Kết nối thiết bị
│   - Hướng dẫn vào EDL mode (Vol+ + Vol- + Power)
│   - Hướng dẫn cài driver Zadig
│
└── 5A.5: Bắt đầu flash
    - Các phân vùng cần flash để cứu máy
    - Thứ tự flash đúng
```

### Flow B: Backup dữ liệu

```
Step 5B: Hướng dẫn backup
├── 5B.1: Các phân vùng quan trọng cần backup
│   - persist, modemst1, modemst2, fsc, fsg
│   - Giải thích tầm quan trọng
│
└── 5B.2: Hướng dẫn lưu trữ an toàn
    - Đặt tên file backup
    - Nơi lưu trữ an toàn
```

### Flow C: Flash ROM mới

```
Step 5C: Hướng dẫn flash ROM
├── 5C.1: Backup trước khi flash
│   - Nhắc nhở backup các phân vùng quan trọng
│
├── 5C.2: Chọn phân vùng cần flash
│   - Giải thích từng phân vùng
│
└── 5C.3: Thực hiện flash
    - Checklist trước khi flash
    - Hướng dẫn từng bước
```

---

## Cấu trúc Component

```
src/components/features/edl-wizard/
├── EDLWizard.tsx              # Main wizard component
├── useEDLWizard.ts            # Hook quản lý state wizard
├── steps/
│   ├── index.ts               # Export all steps
│   ├── WelcomeStep.tsx        # Step 1: Welcome
│   ├── BrandSelectStep.tsx    # Step 2: Chọn hãng
│   ├── ModelSelectStep.tsx    # Step 3: Chọn model
│   ├── PurposeSelectStep.tsx  # Step 4: Chọn mục đích
│   ├── UnbrickGuideStep.tsx   # Step 5A: Hướng dẫn cứu máy
│   ├── BackupGuideStep.tsx    # Step 5B: Hướng dẫn backup
│   └── FlashGuideStep.tsx     # Step 5C: Hướng dẫn flash
└── types.ts                   # Type definitions
```

---

## Store (Zustand)

```typescript
// src/stores/edlWizardStore.ts

interface EDLWizardState {
    // Wizard visibility
    showWizard: boolean;
    hasCompletedWizard: boolean;

    // User selections
    selectedBrand: 'oppo' | 'lg' | null;
    selectedModel: string | null;
    selectedPurpose: 'unbrick' | 'backup' | 'flash' | null;

    // Current step
    currentStep: number;

    // Actions
    setShowWizard: (show: boolean) => void;
    setSelectedBrand: (brand: 'oppo' | 'lg') => void;
    setSelectedModel: (model: string) => void;
    setSelectedPurpose: (purpose: 'unbrick' | 'backup' | 'flash') => void;
    nextStep: () => void;
    prevStep: () => void;
    resetWizard: () => void;
    completeWizard: () => void;
}
```

---

## Translations cần thêm

```json
{
    "edlWizard": {
        "title": "Bắt đầu với EDL Mode",
        "welcome": {
            "title": "Chào mừng đến EDL Mode!",
            "description": "EDL (Emergency Download Mode) là chế độ đặc biệt của Qualcomm cho phép bạn flash, backup và cứu máy ở mức thấp nhất.",
            "features": {
                "unbrick": "Cứu máy brick không vào được hệ thống",
                "backup": "Backup phân vùng quan trọng",
                "flash": "Flash ROM trực tiếp qua web"
            },
            "getStarted": "Bắt đầu nhanh"
        },
        "brand": {
            "title": "Điện thoại của bạn là hãng nào?",
            "description": "Chọn hãng để chúng tôi hướng dẫn phù hợp",
            "oppo": {
                "title": "OPPO / OnePlus / Realme",
                "description": "Các thiết bị thuộc BBK Electronics"
            },
            "lg": {
                "title": "LG",
                "description": "Thiết bị LG Electronics"
            }
        },
        "model": {
            "title": "Chọn model điện thoại",
            "description": "Tìm kiếm hoặc chọn model của bạn",
            "searchPlaceholder": "Tìm kiếm model...",
            "notFound": "Không tìm thấy model? Chọn \"Khác\" và tiếp tục"
        },
        "purpose": {
            "title": "Bạn muốn làm gì?",
            "description": "Chọn mục đích để nhận hướng dẫn phù hợp",
            "unbrick": {
                "title": "Cứu máy (Unbrick)",
                "description": "Máy không lên nguồn, treo logo, hoặc bootloop"
            },
            "backup": {
                "title": "Backup dữ liệu",
                "description": "Sao lưu các phân vùng quan trọng"
            },
            "flash": {
                "title": "Flash ROM mới",
                "description": "Cài đặt ROM mới hoặc nâng/hạ cấp"
            }
        },
        "guide": {
            "unbrick": {
                "title": "Hướng dẫn cứu máy {{model}}",
                "step1": {
                    "title": "Bước 1: Tải ROM",
                    "description": "Tải ROM chính hãng cho {{model}}"
                },
                "step2": {
                    "title": "Bước 2: Chuẩn bị Super Image",
                    "description": "Một số ROM cần build Super Image"
                },
                "step3": {
                    "title": "Bước 3: Chuẩn bị Firehose",
                    "description": "Tải các file Programmer, Digest, Signature"
                },
                "step4": {
                    "title": "Bước 4: Vào EDL Mode",
                    "description": "Giữ Vol+ + Vol- + Power cho đến khi máy tính nhận"
                },
                "step5": {
                    "title": "Bước 5: Flash các phân vùng",
                    "description": "Flash theo thứ tự: boot → system → vendor"
                }
            }
        },
        "navigation": {
            "back": "Quay lại",
            "next": "Tiếp tục",
            "skip": "Bỏ qua",
            "finish": "Hoàn thành"
        }
    }
}
```

---

## Implementation Steps

### Phase 1: Core Structure
1. Tạo `edlWizardStore.ts` - Store quản lý state
2. Tạo `useEDLWizard.ts` - Hook navigation logic
3. Tạo `EDLWizard.tsx` - Main component
4. Tạo các step components cơ bản

### Phase 2: Brand & Model Selection
1. Implement `BrandSelectStep.tsx`
2. Implement `ModelSelectStep.tsx` với searchable dropdown
3. Tích hợp với device store hiện có

### Phase 3: Purpose-based Guides
1. Implement `PurposeSelectStep.tsx`
2. Implement `UnbrickGuideStep.tsx` với interactive checklist
3. Implement `BackupGuideStep.tsx`
4. Implement `FlashGuideStep.tsx`

### Phase 4: Integration
1. Tích hợp wizard vào `ToolPage.tsx`
2. Thêm trigger logic (first visit detection)
3. Thêm button "Xem lại hướng dẫn" cho user đã hoàn thành

### Phase 5: Translations
1. Thêm translations cho `vi.json`
2. Thêm translations cho `en.json`

---

## UX Considerations

1. **Persistent Progress**: Lưu progress vào localStorage để user quay lại không mất data
2. **Skip Option**: Cho phép user skip wizard nếu đã biết cách dùng
3. **Re-access**: Có button "Xem hướng dẫn" để mở lại wizard bất kỳ lúc nào
4. **Responsive**: Wizard hoạt động tốt trên mobile
5. **Animation**: Smooth transitions giữa các steps

---

## Dependencies

- Không cần thêm package mới
- Sử dụng các UI components đã có: Dialog, Button, Card
- Sử dụng Zustand pattern đã có trong project

---

## Estimated Effort

| Task | Complexity |
|------|------------|
| Store setup | Low |
| Wizard shell | Medium |
| Brand/Model steps | Medium |
| Purpose guides | High |
| Translations | Low |
| Integration | Medium |
