# Story 1.4: React Router & i18n Setup

**Status:** review  
**Epic:** Epic 1 - Foundation - React Migration Setup  
**Created:** 2025-12-29  
**Story Key:** 1-4-react-router-i18n-setup

---

## Story

As a **developer**,  
I want **React Router v7 and react-i18next configured with client-side routing and bilingual support**,  
so that **the app has proper navigation between pages and users can switch between English and Vietnamese languages**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | React Router v7 is installed | `npm list react-router-dom` shows 7.x |
| AC2 | react-i18next and i18next are installed | `npm list react-i18next i18next` shows versions |
| AC3 | Routes are configured for: `/`, `/guide`, `/downloads`, `/devices`, `/support` | Navigating to each URL renders the correct page component |
| AC4 | i18next is configured with en.json and vi.json | `i18n.options.resources` contains both locales |
| AC5 | Existing translation keys are preserved and migrated | All keys from original `src/i18n/en.json` and `vi.json` exist in new files |
| AC6 | `useTranslation` hook works in components | Calling `t('key')` returns translated text |
| AC7 | Language can be switched via settingsStore | Changing `settingsStore.language` updates i18next language |
| AC8 | `npm run dev` runs without TypeScript errors | Dev server starts successfully |

---

## Tasks / Subtasks

- [x] **Task 1: Install React Router v7** (AC: 1)
  - [x] 1.1 Run `npm install react-router-dom`
  - [x] 1.2 Verify react-router-dom version 7.x in package.json
  - [x] 1.3 Ensure no peer dependency warnings

- [x] **Task 2: Install i18n dependencies** (AC: 2)
  - [x] 2.1 Run `npm install react-i18next i18next`
  - [x] 2.2 Verify versions in package.json

- [x] **Task 3: Configure i18next** (AC: 4, 6, 7)
  - [x] 3.1 Create `src/i18n/config.ts` with i18next initialization:
    - Import `i18next`, `initReactI18next`
    - Configure with `lng` from localStorage fallback to navigator.language
    - Set `fallbackLng: 'en'`
    - Configure `interpolation: { escapeValue: false }`
  - [x] 3.2 Import and use translations from en.json and vi.json
  - [x] 3.3 Add settingsStore integration:
    - Subscribe to `settingsStore.language` changes
    - Call `i18next.changeLanguage()` when language changes
  - [x] 3.4 Export configured i18next instance

- [x] **Task 4: Migrate existing translation files** (AC: 5)
  - [x] 4.1 Backup existing `src/i18n/en.json` and `vi.json`
  - [x] 4.2 Review and preserve all existing translation keys
  - [x] 4.3 Organize keys into logical namespaces (common, tool, guide, downloads, etc.)
  - [x] 4.4 Add any missing keys needed for new pages:
    - `nav.home`, `nav.guide`, `nav.downloads`, `nav.devices`, `nav.support`
    - `page.guide.title`, `page.guide.description`
    - `page.downloads.title`, `page.downloads.description`
    - `page.devices.title`, `page.devices.description`
    - `page.support.title`, `page.support.description`

- [x] **Task 5: Create route structure** (AC: 3)
  - [x] 5.1 Create `src/app/routes.tsx` with route definitions:
    ```tsx
    const routes = [
      { path: '/', element: <ToolPage /> },
      { path: '/guide', element: <GuidePage /> },
      { path: '/downloads', element: <DownloadsPage /> },
      { path: '/devices', element: <DevicesPage /> },
      { path: '/support', element: <SupportPage /> },
    ]
    ```
  - [x] 5.2 Create placeholder page components:
    - `src/pages/ToolPage.tsx` (placeholder for main tool)
    - `src/pages/GuidePage.tsx` (renamed from Drivers)
    - `src/pages/DownloadsPage.tsx`
    - `src/pages/DevicesPage.tsx`
    - `src/pages/SupportPage.tsx`
  - [x] 5.3 Each placeholder renders page title using `useTranslation`

- [x] **Task 6: Update App.tsx with Router** (AC: 3)
  - [x] 6.1 Import `BrowserRouter`, `Routes`, `Route` from react-router-dom
  - [x] 6.2 Wrap app with `BrowserRouter`
  - [x] 6.3 Add `Routes` component with all route definitions
  - [x] 6.4 Import i18n config to initialize i18next

- [x] **Task 7: Create language sync hook** (AC: 7)
  - [x] 7.1 Create `src/hooks/useLanguageSync.ts`
  - [x] 7.2 Subscribe to settingsStore.language changes
  - [x] 7.3 Call `i18next.changeLanguage()` on change
  - [x] 7.4 Set initial language from settingsStore
  - [x] 7.5 Use this hook in App.tsx or providers.tsx

- [x] **Task 8: Verify implementation** (AC: 8)
  - [x] 8.1 Run `npm run dev` and verify no TypeScript errors
  - [x] 8.2 Navigate to each route and verify page renders
  - [x] 8.3 Test `useTranslation` in a component
  - [x] 8.4 Test language switching (if settingsStore is implemented)
  - [x] 8.5 Verify translations render correctly in both languages

---

## Dev Notes

### Architecture Context

Story này thiết lập client-side routing và i18n foundation:

1. **React Router v7** - Client-side routing với type-safe route definitions
2. **react-i18next** - Đồng bộ với settingsStore để persist language preference
3. **Migration strategy** - Preserve existing translation keys, add new ones

### Technical Decisions

| Decision | Rationale | Source |
|----------|-----------|--------|
| React Router v7 over TanStack Router | Mature, well-documented, team familiarity | [architecture.md#Decision-Summary] |
| react-i18next | Easy migration from existing JSON files | [architecture.md#Technology-Stack-Details] |
| BrowserRouter over HashRouter | Cleaner URLs, modern hosting supports it | SEO best practices |
| settingsStore integration | Language preference should persist across sessions | [epics.md#Story-1.4] |

### Route Structure

```
/ (ToolPage)           - Main flash tool page
/guide (GuidePage)     - Comprehensive usage guide (renamed from Drivers)  
/downloads             - Downloads + companion tools
/devices               - Supported devices list
/support               - Help & FAQ
```

### i18n Configuration Pattern

```typescript
// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import vi from './vi.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    lng: localStorage.getItem('qflash-settings') 
      ? JSON.parse(localStorage.getItem('qflash-settings')!).state?.language 
      : 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
```

### Language Sync Hook Pattern

```typescript
// src/hooks/useLanguageSync.ts
import { useEffect } from 'react';
import i18n from '@/i18n/config';
import { useSettingsStore } from '@/stores/settingsStore';

export function useLanguageSync() {
  const language = useSettingsStore((state) => state.language);
  
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);
}
```

### Existing i18n Keys to Preserve

Based on current src/i18n/en.json and vi.json, these keys MUST be preserved:
- All tool-related keys (connect, flash, backup, partition, etc.)
- All device-related keys
- All error messages
- All UI element labels

### Project Structure Notes

After this story:

```
src/
├── app/
│   ├── App.tsx            # MODIFIED - Add Router and i18n
│   ├── main.tsx           # UNCHANGED
│   ├── routes.tsx         # NEW - Route definitions
│   └── providers.tsx      # MAY MODIFY - Add language sync
│
├── i18n/
│   ├── config.ts          # NEW - i18next configuration
│   ├── en.json            # PRESERVED + EXTENDED
│   └── vi.json            # PRESERVED + EXTENDED
│
├── hooks/
│   ├── useLanguageSync.ts # NEW - Language sync with store
│   └── ...                # Other hooks from 1.5
│
├── pages/
│   ├── ToolPage.tsx       # NEW (placeholder)
│   ├── GuidePage.tsx      # NEW (placeholder)
│   ├── DownloadsPage.tsx  # NEW (placeholder)
│   ├── DevicesPage.tsx    # NEW (placeholder)
│   └── SupportPage.tsx    # NEW (placeholder)
│
├── stores/                # FROM STORY 1.3
├── core/                  # UNCHANGED - PRESERVED
├── auth/                  # UNCHANGED - PRESERVED
└── services/              # UNCHANGED - PRESERVED
```

### References

- [Source: docs/architecture.md#Technology-Stack-Details] - React Router, react-i18next versions
- [Source: docs/architecture.md#Project-Structure] - Page components location
- [Source: docs/epics.md#Story-1.4] - Story definition and acceptance criteria
- [Source: docs/architecture.md#ADR-001] - React Migration decision

---

## Learnings from Previous Story

**From Story 1-3-zustand-state-management-setup (Status: drafted)**

- **Not yet implemented** - Story 1-3 is currently in drafted status
- **Key dependency**: `settingsStore.language` is required for language switching feature
- **localStorage key**: Settings stored at `qflash-settings` with structure:
  ```json
  {
    "state": {
      "language": "en",
      "showWizard": true,
      "lastDeviceId": null
    }
  }
  ```
- **If Story 1.3 not complete**: Language sync hook should read from localStorage directly as fallback

**Fallback Strategy:**
- If `useSettingsStore` is not available:
  - Read initial language from localStorage key `qflash-settings`
  - Language switching will be implemented fully when settingsStore is available
  - Hook can be updated to use store when Story 1.3 is done

[Source: stories/1-3-zustand-state-management-setup.md]

---

## Dev Agent Record

### Context Reference

- [Story Context XML](./1-4-react-router-i18n-setup.context.xml)

### Agent Model Used

Antigravity (Google DeepMind Advanced Agentic Coding)

### Debug Log References

- Installed react-router-dom, react-i18next, i18next via npm
- Created i18n/config.ts with react-i18next initialization and localStorage fallback for language
- Created useLanguageSync hook to sync settingsStore.language with i18next
- Created 5 placeholder page components (ToolPage, GuidePage, DownloadsPage, DevicesPage, SupportPage)
- Created routes.tsx with centralized route configuration
- Updated App.tsx with BrowserRouter and language sync
- Added nav.* and page.* translation keys to en.json and vi.json
- Verified all routes render correctly via browser testing

### Completion Notes List

- All 8 tasks completed successfully
- React Router v7.18.2 installed
- react-i18next and i18next installed
- 5 routes configured: /, /guide, /downloads, /devices, /support
- useTranslation hook works in all page components
- Language sync with settingsStore via useLanguageSync hook
- All existing translation keys preserved, new nav/page keys added
- npm run dev runs without TypeScript errors
- Browser verification: all routes render correct pages with translations

### File List

- [x] NEW: src/i18n/config.ts
- [x] NEW: src/app/routes.tsx
- [x] NEW: src/hooks/useLanguageSync.ts
- [x] NEW: src/pages/ToolPage.tsx
- [x] NEW: src/pages/GuidePage.tsx
- [x] NEW: src/pages/DownloadsPage.tsx
- [x] NEW: src/pages/DevicesPage.tsx
- [x] NEW: src/pages/SupportPage.tsx
- [x] MODIFIED: src/app/App.tsx (add Router and i18n)
- [x] MODIFIED: src/i18n/translations/en.json (add nav and page keys)
- [x] MODIFIED: src/i18n/translations/vi.json (add nav and page keys)
- [x] MODIFIED: package.json (add react-router-dom, react-i18next, i18next)

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
| 2025-12-29 | Dev Agent | All tasks implemented, story ready for review |
