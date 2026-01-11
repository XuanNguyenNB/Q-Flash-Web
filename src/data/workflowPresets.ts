/**
 * Mock Data cho Workflows
 *
 * Dữ liệu mẫu cho các workflow của Honor, Oppo, Realme
 */

import type { Workflow, BrandOption, ModelOption, OSVersionOption, PackageInfo } from '@/types/workflow';

/**
 * Common OS Versions
 */
const MAGICOS_VERSIONS = {
  v8: { id: 'magicos-8', name: 'MagicOS 8.0', version: '8.0' },
  v9: { id: 'magicos-9', name: 'MagicOS 9.0', version: '9.0' },
  v10: { id: 'magicos-10', name: 'MagicOS 10.0', version: '10.0' },
};

const COLOROS_VERSIONS = {
  v13: { id: 'coloros-13', name: 'ColorOS 13', version: '13' },
  v14: { id: 'coloros-14', name: 'ColorOS 14', version: '14' },
  v15: { id: 'coloros-15', name: 'ColorOS 15', version: '15' },
};

/**
 * BRAND OPTIONS
 */
export const BRAND_OPTIONS: BrandOption[] = [
  {
    id: 'honor',
    name: 'Honor',
    nameVi: 'Honor',
    icon: '🏆',
    models: [
      // ============ MAGIC 8 SERIES ============
      { id: 'magic-8', name: 'Magic 8', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'magic-8-pro', name: 'Magic 8 Pro', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'magic-8-pro-air', name: 'Magic 8 Pro Air', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'magic-8-lite', name: 'Magic 8 Lite', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },

      // ============ MAGIC 7 SERIES ============
      { id: 'magic-7', name: 'Magic 7', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-7-pro', name: 'Magic 7 Pro', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-7-rsr', name: 'Magic 7 RSR Porsche Design', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-7-lite', name: 'Magic 7 Lite', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },

      // ============ MAGIC 6 SERIES ============
      { id: 'magic-6', name: 'Magic 6', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-6-pro', name: 'Magic 6 Pro', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-6-ultimate', name: 'Magic 6 Ultimate', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-6-rsr', name: 'Magic 6 RSR Porsche Design', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-6-lite', name: 'Magic 6 Lite', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },

      // ============ MAGIC 5 SERIES ============
      { id: 'magic-5', name: 'Magic 5', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-5-pro', name: 'Magic 5 Pro', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-5-ultimate', name: 'Magic 5 Ultimate', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'magic-5-lite', name: 'Magic 5 Lite', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },

      // ============ MAGIC 4 SERIES ============
      { id: 'magic-4', name: 'Magic 4', osVersions: [MAGICOS_VERSIONS.v8] },
      { id: 'magic-4-pro', name: 'Magic 4 Pro', osVersions: [MAGICOS_VERSIONS.v8] },
      { id: 'magic-4-ultimate', name: 'Magic 4 Ultimate', osVersions: [MAGICOS_VERSIONS.v8] },
      { id: 'magic-4-lite', name: 'Magic 4 Lite', osVersions: [MAGICOS_VERSIONS.v8] },

      // ============ MAGIC 3 SERIES ============
      { id: 'magic-3', name: 'Magic 3', osVersions: [MAGICOS_VERSIONS.v8] },
      { id: 'magic-3-pro', name: 'Magic 3 Pro', osVersions: [MAGICOS_VERSIONS.v8] },
      { id: 'magic-3-pro-plus', name: 'Magic 3 Pro+', osVersions: [MAGICOS_VERSIONS.v8] },

      // ============ HONOR 500 SERIES ============
      { id: 'honor-500', name: 'Honor 500', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-500-pro', name: 'Honor 500 Pro', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-500-gt', name: 'Honor 500 GT', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-500-lite', name: 'Honor 500 Lite', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },

      // ============ HONOR 400 SERIES ============
      { id: 'honor-400', name: 'Honor 400', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-400-pro', name: 'Honor 400 Pro', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-400-gt', name: 'Honor 400 GT / Smart', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-400-lite', name: 'Honor 400 Lite', osVersions: [MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },

      // ============ HONOR 300 SERIES ============
      { id: 'honor-300', name: 'Honor 300', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'honor-300-pro', name: 'Honor 300 Pro', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'honor-300-ultra', name: 'Honor 300 Ultra', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'honor-300-lite', name: 'Honor 300 Lite', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },

      // ============ HONOR 200 SERIES ============
      { id: 'honor-200', name: 'Honor 200', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'honor-200-pro', name: 'Honor 200 Pro', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'honor-200-lite', name: 'Honor 200 Lite', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },
      { id: 'honor-200-smart', name: 'Honor 200 Smart', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9] },

      // ============ HONOR 100 SERIES ============
      { id: 'honor-100', name: 'Honor 100', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-100-pro', name: 'Honor 100 Pro', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-100-gt', name: 'Honor 100 GT', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },

      // ============ HONOR WIN SERIES ============
      { id: 'honor-win', name: 'Honor WIN', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-win-rt', name: 'Honor WIN RT', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },

      // ============ HONOR GT SERIES ============
      { id: 'honor-gt-pro-5g', name: 'Honor GT Pro 5G', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-gt', name: 'Honor GT', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-90-gt', name: 'Honor 90 GT', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-80-gt', name: 'Honor 80 GT', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-x50-gt', name: 'Honor X50 GT', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-x40-gt', name: 'Honor X40 GT / X40 GT Racing', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },

      // ============ HONOR MAGICPAD SERIES ============
      { id: 'honor-magicpad-3', name: 'Honor MagicPad 3', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-magicpad-2', name: 'Honor MagicPad 2', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
      { id: 'honor-pad-gt-pro', name: 'Honor Pad GT Pro', osVersions: [MAGICOS_VERSIONS.v8, MAGICOS_VERSIONS.v9, MAGICOS_VERSIONS.v10] },
    ],
  },
  {
    id: 'oppo',
    name: 'Oppo',
    nameVi: 'Oppo',
    icon: '📱',
    models: [
      // ============ FIND X9 SERIES ============
      { id: 'find-x9', name: 'Find X9', osVersions: [COLOROS_VERSIONS.v15] },
      { id: 'find-x9-pro', name: 'Find X9 Pro', osVersions: [COLOROS_VERSIONS.v15] },

      // ============ FIND X8 SERIES ============
      { id: 'find-x8', name: 'Find X8', osVersions: [COLOROS_VERSIONS.v14, COLOROS_VERSIONS.v15] },
      { id: 'find-x8-pro', name: 'Find X8 Pro', osVersions: [COLOROS_VERSIONS.v14, COLOROS_VERSIONS.v15] },
      { id: 'find-x8-ultra', name: 'Find X8 Ultra', osVersions: [COLOROS_VERSIONS.v14, COLOROS_VERSIONS.v15] },
      { id: 'find-x8s', name: 'Find X8s', osVersions: [COLOROS_VERSIONS.v14, COLOROS_VERSIONS.v15] },
      { id: 'find-x8s-plus', name: 'Find X8s+', osVersions: [COLOROS_VERSIONS.v14, COLOROS_VERSIONS.v15] },

      // ============ FIND X7 SERIES ============
      { id: 'find-x7', name: 'Find X7', osVersions: [COLOROS_VERSIONS.v14, COLOROS_VERSIONS.v15] },
      { id: 'find-x7-ultra', name: 'Find X7 Ultra', osVersions: [COLOROS_VERSIONS.v14, COLOROS_VERSIONS.v15] },
      { id: 'find-x7-ultra-satellite', name: 'Find X7 Ultra Satellite Edition', osVersions: [COLOROS_VERSIONS.v14, COLOROS_VERSIONS.v15] },

      // ============ FIND X6 SERIES ============
      { id: 'find-x6', name: 'Find X6', osVersions: [COLOROS_VERSIONS.v13, COLOROS_VERSIONS.v14] },
      { id: 'find-x6-pro', name: 'Find X6 Pro', osVersions: [COLOROS_VERSIONS.v13, COLOROS_VERSIONS.v14] },

      // ============ FIND X5 SERIES ============
      { id: 'find-x5', name: 'Find X5', osVersions: [COLOROS_VERSIONS.v13, COLOROS_VERSIONS.v14] },
      { id: 'find-x5-pro', name: 'Find X5 Pro', osVersions: [COLOROS_VERSIONS.v13, COLOROS_VERSIONS.v14] },
      { id: 'find-x5-lite', name: 'Find X5 Lite', osVersions: [COLOROS_VERSIONS.v13, COLOROS_VERSIONS.v14] },

      // ============ FIND X3 SERIES ============
      { id: 'find-x3', name: 'Find X3', osVersions: [COLOROS_VERSIONS.v13] },
      { id: 'find-x3-pro', name: 'Find X3 Pro', osVersions: [COLOROS_VERSIONS.v13] },
      { id: 'find-x3-neo', name: 'Find X3 Neo', osVersions: [COLOROS_VERSIONS.v13] },
      { id: 'find-x3-lite', name: 'Find X3 Lite', osVersions: [COLOROS_VERSIONS.v13] },

      // ============ FIND X2 SERIES ============
      { id: 'find-x2', name: 'Find X2', osVersions: [COLOROS_VERSIONS.v13] },
      { id: 'find-x2-pro', name: 'Find X2 Pro', osVersions: [COLOROS_VERSIONS.v13] },
      { id: 'find-x2-neo', name: 'Find X2 Neo', osVersions: [COLOROS_VERSIONS.v13] },
      { id: 'find-x2-lite', name: 'Find X2 Lite', osVersions: [COLOROS_VERSIONS.v13] },
    ],
  },
];

/**
 * WORKFLOW PRESETS
 */

// Oppo Cleanup Workflow
export const OPPO_CLEANUP_WORKFLOW: Workflow = {
  id: 'oppo-china-cleanup',
  name: 'Oppo/Realme China Cleanup',
  nameVi: 'Dọn dẹp máy Oppo/Realme Trung Quốc',
  description: 'Remove Chinese bloatware and setup for Vietnam',
  descriptionVi: 'Xóa ứng dụng rác TQ và thiết lập cho Việt Nam',
  brand: 'oppo',
  models: [],
  osVersions: [],
  category: 'cleanup',
  tags: ['china', 'bloatware', 'vietnam', 'popular'],
  difficulty: 'easy',
  estimatedMinutes: 12,
  isOfficial: true,
  downloads: 2156,
  rating: 4.7,
  aiAssistEnabled: true,
  steps: [
    {
      id: 'step-1',
      type: 'uninstall-packages',
      title: 'Remove ColorOS bloatware',
      titleVi: 'Xóa bloatware ColorOS',
      description: 'Uninstall pre-installed apps',
      descriptionVi: 'Gỡ các ứng dụng có sẵn',
      // Video hướng dẫn
      videoUrl: '/videos/oppo/cleanup/step-1-remove-bloatware.mp4',
      videoPoster: '/videos/thumbnails/oppo-cleanup-step-1.jpg',
      packages: [
        'com.heytap.market',
        'com.oppo.music',
        'com.oppo.video',
        'com.oppo.browser',
        'com.coloros.gamespace',
        'com.nearme.instant.platform',
        'com.baidu.input',
        'com.tencent.mm',
        'com.sina.weibo',
      ],
      canSkip: false,
    },
    {
      id: 'step-2',
      type: 'install-apk',
      title: 'Install Google Play Services',
      titleVi: 'Cài Google Play Services',
      // Video hướng dẫn
      videoUrl: '/videos/oppo/cleanup/step-2-install-gms.mp4',
      videoPoster: '/videos/thumbnails/oppo-cleanup-step-2.jpg',
      apkUrl: 'https://example.com/google-installer-oppo.apk',
      apkName: 'GMS Installer',
      needsAIGuide: true,
      canSkip: false,
    },
    {
      id: 'step-3',
      type: 'install-apk',
      title: 'Install Vietnamese IME',
      titleVi: 'Cài bàn phím tiếng Việt',
      // Video hướng dẫn
      videoUrl: '/videos/oppo/cleanup/step-3-install-keyboard.mp4',
      videoPoster: '/videos/thumbnails/oppo-cleanup-step-3.jpg',
      apkUrl: 'https://example.com/gboard.apk',
      apkName: 'Gboard',
      canSkip: true,
    },
    {
      id: 'step-4',
      type: 'adb-command',
      title: 'Optimize battery for GMS',
      titleVi: 'Tối ưu pin cho GMS',
      // Video hướng dẫn
      videoUrl: '/videos/oppo/cleanup/step-4-optimize-battery.mp4',
      videoPoster: '/videos/thumbnails/oppo-cleanup-step-4.jpg',
      command: 'dumpsys deviceidle whitelist +com.google.android.gms',
      canSkip: true,
    },
  ],
};

// Honor Google Play Setup Workflow (with detailed guided steps)
export const HONOR_GOOGLE_PLAY_WORKFLOW: Workflow = {
  id: 'honor-google-play-setup',
  name: 'Honor Google Play Setup',
  nameVi: 'Bật Google Play trên Honor',
  description: 'Enable Google Play Services and install Play Store on Honor devices from China',
  descriptionVi: 'Bật dịch vụ Google Play và cài đặt Cửa hàng Play trên máy Honor nội địa Trung Quốc',
  brand: 'honor',
  models: [],
  osVersions: [],
  category: 'google-services',
  tags: ['google', 'play-store', 'honor', 'popular', 'guided'],
  difficulty: 'easy',
  estimatedMinutes: 3,
  isOfficial: true,
  downloads: 3456,
  rating: 4.9,
  aiAssistEnabled: true,
  steps: [
    {
      id: 'gp-step-1',
      type: 'guided-action',
      title: 'Enable Google Play Services',
      titleVi: 'Bật Google Play Services',
      description: 'Navigate to settings and enable Google Play Services',
      descriptionVi: 'Truy cập cài đặt và bật dịch vụ Google Play',
      // Video hướng dẫn
      videoUrl: 'https://youtube.com/shorts/5porTLDfuqM',
      userPrompt: 'Follow the steps below to enable Google Play Services on your Honor device',
      userPromptVi: 'Làm theo các bước bên dưới để bật Google Play Services trên máy Honor',
      subSteps: [
        {
          id: 'gp-1-1',
          instruction: 'Mở ứng dụng Cài đặt (Settings)',
          alternativeInstructions: [
            'Kéo thanh thông báo xuống và nhấn vào biểu tượng bánh răng',
            'Tìm biểu tượng "Cài đặt" trên màn hình chính',
          ],
        },
        {
          id: 'gp-1-2',
          instruction: 'Vuốt xuống và chọn mục "Người dùng & Tài khoản"',
          alternativeInstructions: [
            'Tìm kiếm "Người dùng" trong thanh tìm kiếm',
            'Có thể tên là "Users & accounts" nếu máy đang để tiếng Anh',
          ],
        },
        {
          id: 'gp-1-3',
          instruction: 'Bật công tắc mục "Google Play Services"',
          alternativeInstructions: [
            'Nhấn vào dòng "Google Play Services" rồi bật công tắc',
            'Công tắc sẽ chuyển sang màu xanh khi đã bật',
          ],
        },
      ],
      requiresConfirmation: true,
      aiContext: 'Bước này yêu cầu người dùng thao tác trực tiếp trên điện thoại. Hướng dẫn chi tiết từng sub-step nếu họ gặp khó khăn.',
      webSearchKeywords: [
        'Honor bật Google Play Services',
        'Honor MagicOS Google Services',
      ],
      canSkip: false,
    },
    {
      id: 'gp-step-2',
      type: 'guided-action',
      title: 'Download & Open Play Store',
      titleVi: 'Tải và mở CH Play',
      description: 'Download Play Store from App Market and sign in',
      descriptionVi: 'Tải CH Play từ App Market và đăng nhập',
      // Video hướng dẫn
      videoUrl: 'https://youtube.com/shorts/wIk9S9xwYto',
      userPrompt: 'Download Play Store from the Honor App Market and sign in with your Google account',
      userPromptVi: 'Tải Cửa hàng Play từ App Market của Honor và đăng nhập tài khoản Google',
      subSteps: [
        {
          id: 'gp-2-1',
          instruction: 'Mở ứng dụng "App Market" (Kho ứng dụng) từ màn hình chính',
          alternativeInstructions: [
            'Biểu tượng có hình túi mua sắm màu đỏ/cam',
            'Có thể nằm trong thư mục "Công cụ" hoặc "Tools"',
          ],
        },
        {
          id: 'gp-2-2',
          instruction: 'Tìm kiếm "Google Play Store" hoặc "CH Play"',
          alternativeInstructions: [
            'Nhấn vào ô tìm kiếm và gõ "Play Store"',
            'Kết quả đầu tiên thường là app chính thức',
          ],
        },
        {
          id: 'gp-2-3',
          instruction: 'Nhấn "Tải về" và chờ cài đặt hoàn tất',
          alternativeInstructions: [
            'Có thể mất 1-2 phút tùy tốc độ mạng',
            'Đồng ý các điều khoản nếu được yêu cầu',
          ],
        },
        {
          id: 'gp-2-4',
          instruction: 'Mở Play Store và đăng nhập tài khoản Google',
          alternativeInstructions: [
            'Nhấn "Đăng nhập" và nhập email Google của bạn',
            'Nếu chưa có tài khoản, chọn "Tạo tài khoản"',
          ],
        },
      ],
      requiresConfirmation: true,
      aiContext: 'Người dùng cần tải Play Store từ App Market và đăng nhập. Nếu không tìm thấy trong App Market, có thể gợi ý dùng APKMirror.',
      webSearchKeywords: [
        'Tải Play Store Honor',
        'Honor App Market Google Play',
        'Đăng nhập Google Play Store',
      ],
      canSkip: false,
    },
  ],
};

/**
 * Honor China Bloatware Packages List
 */
const HONOR_CHINA_BLOATWARE: PackageInfo[] = [
  // ===== Ứng dụng giải trí / Streaming =====
  {
    packageName: 'com.hihonor.cloudmusic',
    name: 'Honor Cloud Music',
    nameVi: 'Nhạc Honor',
    descriptionVi: 'Ứng dụng nghe nhạc nội địa Trung Quốc',
  },
  {
    packageName: 'com.hihonor.youku.video',
    name: 'Youku Video',
    nameVi: 'Youku Video',
    descriptionVi: 'Ứng dụng xem video Trung Quốc (như YouTube TQ)',
  },
  {
    packageName: 'com.qiyi.video',
    name: 'iQIYI',
    nameVi: 'iQIYI Video',
    descriptionVi: 'Ứng dụng xem phim/video Trung Quốc',
  },
  {
    packageName: 'tv.danmaku.bili',
    name: 'Bilibili',
    nameVi: 'Bilibili',
    descriptionVi: 'Ứng dụng video/anime Trung Quốc',
  },
  {
    packageName: 'com.xs.fm',
    name: 'Ximalaya FM',
    nameVi: 'Ximalaya FM',
    descriptionVi: 'Ứng dụng podcast/radio Trung Quốc',
  },

  // ===== Ứng dụng đọc sách / Tin tức =====
  {
    packageName: 'com.hihonor.dz.reader',
    name: 'Honor Reader',
    nameVi: 'Đọc sách Honor',
    descriptionVi: 'Ứng dụng đọc sách điện tử',
  },
  {
    packageName: 'com.phoenix.read',
    name: 'Phoenix News',
    nameVi: 'Tin Phoenix',
    descriptionVi: 'Ứng dụng đọc tin tức Trung Quốc',
  },
  {
    packageName: 'com.dragon.read',
    name: 'Dragon Read',
    nameVi: 'Đọc truyện Dragon',
    descriptionVi: 'Ứng dụng đọc truyện Trung Quốc',
  },
  {
    packageName: 'com.ss.android.article.news',
    name: 'Toutiao News',
    nameVi: 'Tin Toutiao',
    descriptionVi: 'Ứng dụng tin tức của ByteDance (TikTok)',
  },

  // ===== Mạng xã hội =====
  {
    packageName: 'com.zhihu.android',
    name: 'Zhihu',
    nameVi: 'Zhihu',
    descriptionVi: 'Mạng xã hội hỏi đáp Trung Quốc (như Quora)',
  },
  {
    packageName: 'com.xingin.xhs',
    name: 'Xiaohongshu (RED)',
    nameVi: 'Xiaohongshu',
    descriptionVi: 'Mạng xã hội mua sắm Trung Quốc',
  },
  {
    packageName: 'com.ss.android.ugc.aweme',
    name: 'Douyin (TikTok China)',
    nameVi: 'Douyin',
    descriptionVi: 'TikTok phiên bản Trung Quốc',
  },
  {
    packageName: 'com.smile.gifmaker',
    name: 'Kuaishou',
    nameVi: 'Kuaishou',
    descriptionVi: 'Ứng dụng video ngắn Trung Quốc',
  },

  // ===== Thương mại điện tử =====
  {
    packageName: 'com.alibaba.wireless',
    name: 'Alibaba',
    nameVi: 'Alibaba',
    descriptionVi: 'Ứng dụng mua sắm Alibaba',
  },
  {
    packageName: 'com.taobao.taobao',
    name: 'Taobao',
    nameVi: 'Taobao',
    descriptionVi: 'Ứng dụng mua sắm Taobao',
  },
  {
    packageName: 'com.taobao.idlefish',
    name: 'Xianyu (Idle Fish)',
    nameVi: 'Xianyu',
    descriptionVi: 'Ứng dụng mua bán đồ cũ của Alibaba',
  },
  {
    packageName: 'com.jingdong.app.mall',
    name: 'JD.com',
    nameVi: 'JD.com',
    descriptionVi: 'Ứng dụng mua sắm JD',
  },
  {
    packageName: 'com.xunmeng.pinduoduo',
    name: 'Pinduoduo',
    nameVi: 'Pinduoduo',
    descriptionVi: 'Ứng dụng mua sắm giá rẻ',
  },
  {
    packageName: 'com.hihonor.vmall',
    name: 'Honor VMall',
    nameVi: 'Cửa hàng Honor',
    descriptionVi: 'Cửa hàng trực tuyến của Honor',
  },
  {
    packageName: 'com.dianping.v1',
    name: 'Dianping',
    nameVi: 'Dianping',
    descriptionVi: 'Ứng dụng đánh giá nhà hàng/dịch vụ',
  },

  // ===== Thanh toán / Ngân hàng =====
  {
    packageName: 'com.unionpay.tsmservice',
    name: 'UnionPay',
    nameVi: 'UnionPay',
    descriptionVi: 'Dịch vụ thanh toán UnionPay Trung Quốc',
  },
  {
    packageName: 'com.eg.android.AlipayGphone',
    name: 'Alipay',
    nameVi: 'Alipay',
    descriptionVi: 'Ứng dụng thanh toán Alipay',
  },

  // ===== Bản đồ / Di chuyển =====
  {
    packageName: 'com.baidu.BaiduMap',
    name: 'Baidu Maps',
    nameVi: 'Bản đồ Baidu',
    descriptionVi: 'Bản đồ Trung Quốc (không hoạt động tốt ở VN)',
  },
  {
    packageName: 'com.sdu.didi.psnger',
    name: 'Didi',
    nameVi: 'Didi',
    descriptionVi: 'Ứng dụng gọi xe Trung Quốc (như Grab TQ)',
  },
  {
    packageName: 'ctrip.android.view',
    name: 'Ctrip',
    nameVi: 'Ctrip',
    descriptionVi: 'Ứng dụng đặt vé/khách sạn Trung Quốc',
  },
  {
    packageName: 'com.Qunar',
    name: 'Qunar',
    nameVi: 'Qunar',
    descriptionVi: 'Ứng dụng đặt vé máy bay/khách sạn',
  },

  // ===== Ứng dụng Baidu =====
  {
    packageName: 'com.baidu.netdisk',
    name: 'Baidu Netdisk',
    nameVi: 'Baidu Cloud',
    descriptionVi: 'Lưu trữ đám mây Baidu',
  },
  {
    packageName: 'com.baidu.searchbox',
    name: 'Baidu Search',
    nameVi: 'Tìm kiếm Baidu',
    descriptionVi: 'Công cụ tìm kiếm Baidu',
  },
  {
    packageName: 'com.baidu.swan',
    name: 'Baidu Mini Programs',
    nameVi: 'Mini App Baidu',
    descriptionVi: 'Nền tảng mini app của Baidu',
  },
  {
    packageName: 'com.hihonor.baidu.browser',
    name: 'Baidu Browser (Honor)',
    nameVi: 'Trình duyệt Baidu',
    descriptionVi: 'Trình duyệt Baidu tích hợp Honor',
  },

  // ===== Trình duyệt =====
  {
    packageName: 'com.quark.browser',
    name: 'Quark Browser',
    nameVi: 'Trình duyệt Quark',
    descriptionVi: 'Trình duyệt Quark của Alibaba',
  },

  // ===== Bàn phím - CẦN CẢNH BÁO =====
  {
    packageName: 'com.sohu.inputmethod.sogou.honor',
    name: 'Sogou Keyboard',
    nameVi: 'Bàn phím Sogou',
    descriptionVi: 'Bàn phím tiếng Trung mặc định',
    warningVi: '⚠️ CÀI BÀN PHÍM TIẾNG VIỆT TRƯỚC (Gboard, Laban Key...) nếu không sẽ không có bàn phím để gõ!',
    isRecommended: true,
  },

  // ===== Ứng dụng Honor - TÙY CHỌN =====
  {
    packageName: 'com.hihonor.magicvoice',
    name: 'Honor Voice Assistant',
    nameVi: 'Trợ lý giọng nói Honor',
    descriptionVi: 'Trợ lý ảo của Honor',
    warningVi: 'Gỡ app này nếu muốn sử dụng Google Assistant',
    isOptional: true,
  },
  {
    packageName: 'com.hihonor.smartiot',
    name: 'Honor Smart Home',
    nameVi: 'Nhà thông minh Honor',
    descriptionVi: 'Điều khiển thiết bị IoT Honor',
    warningVi: 'Giữ lại nếu bạn có thiết bị thông minh Honor',
    isOptional: true,
  },
  {
    packageName: 'com.hihonor.servicecenter',
    name: 'Honor Service Center',
    nameVi: 'Trung tâm dịch vụ Honor',
    descriptionVi: 'Hỗ trợ & bảo hành Honor',
    warningVi: 'Có thể cần nếu bạn cần hỗ trợ từ Honor',
    isOptional: true,
  },
  {
    packageName: 'com.hihonor.health',
    name: 'Honor Health',
    nameVi: 'Sức khỏe Honor',
    descriptionVi: 'Theo dõi sức khỏe & đồng bộ đồng hồ',
    warningVi: 'Giữ lại nếu bạn có đồng hồ Honor/Huawei',
    isOptional: true,
  },
  {
    packageName: 'com.hihonor.maplib',
    name: 'Honor Map Library',
    nameVi: 'Thư viện bản đồ Honor',
    descriptionVi: 'Thư viện bản đồ cho các ứng dụng Honor',
    isOptional: true,
  },

  // ===== Ứng dụng Honor khác =====
  {
    packageName: 'cn.honor.qinxuan',
    name: 'Honor Qinxuan',
    nameVi: 'Honor Qinxuan',
    descriptionVi: 'Ứng dụng nội bộ Honor Trung Quốc',
  },
  {
    packageName: 'com.hihonor.phoneservice',
    name: 'Honor Phone Service',
    nameVi: 'Dịch vụ điện thoại Honor',
    descriptionVi: 'Dịch vụ hỗ trợ điện thoại Honor Trung Quốc',
  },
];

// Honor China Cleanup Workflow
export const HONOR_CHINA_CLEANUP_WORKFLOW: Workflow = {
  id: 'honor-china-cleanup',
  name: 'Honor China Bloatware Cleanup',
  nameVi: 'Xóa app rác máy Honor Trung Quốc',
  description: 'Remove Chinese bloatware apps from Honor China devices',
  descriptionVi: 'Gỡ bỏ các ứng dụng rác Trung Quốc trên máy Honor nội địa',
  brand: 'honor',
  models: [],
  osVersions: [],
  category: 'cleanup',
  tags: ['china', 'bloatware', 'honor', 'cleanup', 'popular'],
  difficulty: 'easy',
  estimatedMinutes: 5,
  isOfficial: true,
  downloads: 1500,
  rating: 4.8,
  aiAssistEnabled: false,
  steps: [
    {
      id: 'cleanup-step-1',
      type: 'guided-action',
      title: 'Prepare for cleanup',
      titleVi: 'Chuẩn bị trước khi xóa',
      description: 'Install Vietnamese keyboard before removing Sogou',
      descriptionVi: 'Cài bàn phím tiếng Việt trước khi xóa Sogou',
      userPromptVi: 'Trước khi xóa app, hãy đảm bảo bạn đã cài bàn phím tiếng Việt (Gboard hoặc Laban Key) từ CH Play. Nếu chưa cài, hãy cài ngay bây giờ!',
      subSteps: [
        {
          id: 'prep-1',
          instruction: 'Mở CH Play (Google Play Store)',
          alternativeInstructions: ['Nếu chưa có CH Play, hãy chạy quy trình "Bật Google Play trên Honor" trước'],
        },
        {
          id: 'prep-2',
          instruction: 'Tìm và cài đặt "Gboard" hoặc "Laban Key"',
        },
        {
          id: 'prep-3',
          instruction: 'Vào Cài đặt > Hệ thống > Ngôn ngữ & nhập liệu > Bàn phím ảo',
        },
        {
          id: 'prep-4',
          instruction: 'Bật bàn phím mới cài và đặt làm mặc định',
        },
      ],
      requiresConfirmation: true,
      canSkip: true,
    },
    {
      id: 'cleanup-step-2',
      type: 'uninstall-packages',
      title: 'Select and remove bloatware',
      titleVi: 'Chọn và xóa ứng dụng rác',
      description: 'Select which Chinese apps to remove',
      descriptionVi: 'Chọn các ứng dụng Trung Quốc cần xóa. Bỏ tích những app bạn muốn giữ lại.',
      packagesInfo: HONOR_CHINA_BLOATWARE,
      canSkip: false,
    },
  ],
};

// Honor Google Assistant Setup Workflow
export const HONOR_GOOGLE_ASSISTANT_WORKFLOW: Workflow = {
  id: 'honor-google-assistant-setup',
  name: 'Honor Google Assistant Setup',
  nameVi: 'Cài đặt trợ lý Google làm mặc định',
  description: 'Set Google Assistant as the default voice assistant on Honor devices',
  descriptionVi: 'Đặt Google Assistant làm trợ lý giọng nói mặc định trên máy Honor',
  brand: 'honor',
  models: [],
  osVersions: [],
  category: 'google-services',
  tags: ['google', 'assistant', 'honor', 'gemini', 'voice'],
  difficulty: 'easy',
  estimatedMinutes: 5,
  isOfficial: true,
  downloads: 1200,
  rating: 4.8,
  aiAssistEnabled: false,
  steps: [
    {
      id: 'ga-step-1',
      type: 'uninstall-packages',
      title: 'Remove Honor Voice Assistant',
      titleVi: 'Xóa trợ lý giọng nói Honor',
      description: 'Uninstall Honor Magic Voice to allow Google Assistant',
      descriptionVi: 'Gỡ bỏ trợ lý giọng nói Honor để sử dụng Google Assistant',
      packagesInfo: [
        {
          packageName: 'com.hihonor.magicvoice',
          name: 'Honor Voice Assistant',
          nameVi: 'Trợ lý giọng nói Honor',
          descriptionVi: 'Trợ lý ảo mặc định của Honor - cần xóa để dùng Google Assistant',
        },
      ],
      canSkip: false,
    },
    {
      id: 'ga-step-2',
      type: 'guided-action',
      title: 'Setup Google Assistant with Gemini',
      titleVi: 'Thiết lập Google Assistant với Gemini',
      description: 'Install and configure Google Assistant as default',
      descriptionVi: 'Cài đặt và cấu hình Google Assistant làm mặc định',
      videoUrl: 'https://youtube.com/shorts/qPhhea_Cokw',
      userPrompt: 'Follow the steps below to setup Google Assistant as your default voice assistant',
      userPromptVi: 'Làm theo các bước bên dưới để thiết lập Google Assistant làm trợ lý mặc định',
      subSteps: [
        {
          id: 'ga-2-1',
          instruction: 'Đăng nhập tài khoản Google vào Cửa hàng Play (nếu chưa đăng nhập)',
          alternativeInstructions: [
            'Mở CH Play và nhấn vào ảnh đại diện góc trên phải',
            'Chọn "Đăng nhập" và nhập thông tin tài khoản Google',
          ],
        },
        {
          id: 'ga-2-2',
          instruction: 'Cài đặt ứng dụng "Google" và "Gemini" từ CH Play',
          alternativeInstructions: [
            'Tìm kiếm "Google" trong CH Play và nhấn Cài đặt',
            'Tìm kiếm "Gemini" trong CH Play và nhấn Cài đặt',
          ],
        },
        {
          id: 'ga-2-3',
          instruction: 'Mở ứng dụng Gemini và chọn "Đồng ý" sử dụng Gemini',
          alternativeInstructions: [
            'Đọc các điều khoản và chọn đồng ý để tiếp tục',
          ],
        },
        {
          id: 'ga-2-4',
          instruction: 'Chọn ảnh đại diện (góc trên phải) để vào mục Cài đặt',
        },
        {
          id: 'ga-2-5',
          instruction: 'Chọn "Bối cảnh trên màn hình" (Screen context)',
        },
        {
          id: 'ga-2-6',
          instruction: 'Chọn "Ứng dụng Trợ lý Google" để đặt làm mặc định',
          alternativeInstructions: [
            'Bật công tắc để cho phép Gemini làm trợ lý mặc định',
          ],
        },
      ],
      requiresConfirmation: true,
      canSkip: false,
    },
  ],
};

// Honor Notification Fix Workflow
export const HONOR_NOTIFICATION_FIX_WORKFLOW: Workflow = {
  id: 'honor-notification-fix',
  name: 'Fix Super Notifications',
  nameVi: 'Fix thông báo siêu cấp',
  description: 'Optimize notification delivery for apps on Honor devices',
  descriptionVi: 'Tối ưu hóa thông báo cho các ứng dụng trên máy Honor nội địa Trung Quốc',
  brand: 'honor',
  models: [],
  osVersions: [],
  category: 'optimization',
  tags: ['notification', 'optimization', 'honor', 'popular'],
  difficulty: 'medium',
  estimatedMinutes: 8,
  isOfficial: true,
  downloads: 890,
  rating: 4.7,
  aiAssistEnabled: false,
  steps: [
    {
      id: 'notif-step-1',
      type: 'optimize-notifications',
      title: 'Select apps to optimize',
      titleVi: 'Chọn ứng dụng cần tối ưu thông báo',
      description: 'Select which apps should receive optimized notification delivery',
      descriptionVi: 'Chọn các ứng dụng mà bạn muốn tối ưu hóa thông báo. Các app được chọn sẽ được đưa vào danh sách ưu tiên.',
      selectUserApps: true,
      optimizationMethods: ['deviceidle-whitelist', 'standby-bucket-active'],
      canSkip: false,
    },
    {
      id: 'notif-step-2',
      type: 'guided-action',
      title: 'Configure notification settings',
      titleVi: 'Cấu hình cài đặt thông báo trong Settings',
      description: 'Configure system settings for optimal notification delivery',
      descriptionVi: 'Cấu hình các cài đặt hệ thống để thông báo hoạt động tốt nhất',
      videoUrl: 'https://youtu.be/ijjRmuoZIFc',
      userPrompt: 'Follow the video guide to configure notification settings on your Honor device',
      userPromptVi: 'Làm theo video hướng dẫn để cấu hình cài đặt thông báo trên máy Honor của bạn',
      subSteps: [
        {
          id: 'notif-2-1',
          instruction: 'Cài đặt → Thông báo → Bật "Đánh thức màn hình khi có thông báo"',
          alternativeInstructions: [
            'Kéo xuống dưới chọn ứng dụng cần bật thông báo',
            'Chọn "Cho phép thông báo" cho từng ứng dụng',
          ],
        },
        {
          id: 'notif-2-2',
          instruction: 'Cài đặt → Pin → Cài đặt pin khác → Bật "Duy trì kết nối trong khi thiết bị ở trạng thái ngủ"',
          alternativeInstructions: [
            'Tùy chọn này giúp các ứng dụng vẫn nhận được thông báo khi máy đang ngủ',
          ],
        },
        {
          id: 'notif-2-3',
          instruction: 'Cài đặt → Ứng dụng → Khởi chạy ứng dụng → Tắt "Quản lý tự động" cho ứng dụng cần thông báo',
          alternativeInstructions: [
            'Sau khi tắt, bật cả 3 mục bên trong: Tự khởi động, Chạy phụ, Hoạt động nền',
            'Làm điều này cho từng ứng dụng cần nhận thông báo nhanh',
          ],
        },
        {
          id: 'notif-2-4',
          instruction: 'Cài đặt → Ứng dụng → Quản lý quyền hạn → Nhấn dấu 3 chấm (góc trên phải) → Quyền truy cập đặc biệt → Tối ưu hóa pin',
          alternativeInstructions: [
            'Chọn "Tất cả ứng dụng"',
            'Chọn ứng dụng cần thông báo và chọn "Không được phép" để tắt tối ưu pin cho app đó',
          ],
        },
      ],
      requiresConfirmation: true,
      canSkip: false,
    },
  ],
};

/**
 * All workflows list
 */
export const ALL_WORKFLOWS: Workflow[] = [
  HONOR_GOOGLE_PLAY_WORKFLOW,
  HONOR_GOOGLE_ASSISTANT_WORKFLOW,
  HONOR_CHINA_CLEANUP_WORKFLOW,
  HONOR_NOTIFICATION_FIX_WORKFLOW,
  OPPO_CLEANUP_WORKFLOW,
];

/**
 * Get workflows filtered by device
 * When model or osVersion is 'auto', skip that filter (used for auto-detected devices)
 */
export function getWorkflowsByDevice(brand: string | null, model: string | null, osVersion: string | null): Workflow[] {
  return ALL_WORKFLOWS.filter(workflow => {
    if (workflow.brand === 'all') return true;
    if (brand && workflow.brand !== brand) return false;
    // Skip model/osVersion filter when 'auto' (auto-detected device)
    if (model && model !== 'auto' && workflow.models && workflow.models.length > 0 && !workflow.models.includes(model)) return false;
    if (osVersion && osVersion !== 'auto' && workflow.osVersions && workflow.osVersions.length > 0 && !workflow.osVersions.includes(osVersion)) return false;
    return true;
  });
}
