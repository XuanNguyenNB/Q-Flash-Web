# Story 3.4: Downloads Page Enhancement

**Status:** review  
**Epic:** Epic 3 - Onboarding & Guide Experience  
**Created:** 2025-12-29  
**Story Key:** 3-4-downloads-page-enhancement

---

## Story

As a **user**,  
I want **to download all necessary tools from one place**,  
So that **I don't have to search for them across multiple websites**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | Downloads page has a "Companion Tools" section above "Stock ROMs" | Navigate to /downloads → verify "Companion Tools" section appears first |
| AC2 | Q-FLASH-FORGE card with GitHub link exists | View Companion Tools → verify Q-FLASH-FORGE card with description and GitHub link |
| AC3 | WinUSB Driver download card exists | View Companion Tools → verify WinUSB Driver card with download link |
| AC4 | Zadig tool download link exists | View Companion Tools → verify Zadig card with download link |
| AC5 | Each card shows: Name, Description, Version, Download links | Inspect each card → verify all required fields are present |
| AC6 | Clicks are trackable for future analytics | Check download links → verify data attributes for tracking |
| AC7 | Links open in new tab | Click download links → verify opens in new tab (target="_blank") |
| AC8 | Page is fully translated in Vietnamese and English | Switch language → verify all content translates |

---

## Tasks / Subtasks

- [x] **Task 1: Create DownloadsPage component structure** (AC: 1, 8)
  - [x] 1.1 Create `src/pages/DownloadsPage.tsx` if it doesn't exist
  - [x] 1.2 Import necessary shadcn/ui Card components
  - [x] 1.3 Set up page layout with header and main content area
  - [x] 1.4 Add page title: "Downloads"
  - [x] 1.5 Add page description: "Download companion tools and stock ROMs"
  - [x] 1.6 Ensure all text uses i18n: `downloads.*`

- [x] **Task 2: Create Companion Tools section** (AC: 1, 2, 3, 4, 5)
  - [x] 2.1 Add section header: "Companion Tools"
  - [x] 2.2 Add section description: "Essential tools for flashing Qualcomm devices"
  - [x] 2.3 Create grid layout for tool cards (responsive: 1 column mobile, 2-3 columns desktop)
  - [x] 2.4 Position section above existing "Stock ROMs" section
  - [x] 2.5 Ensure all text uses i18n: `downloads.companionTools.*`

- [x] **Task 3: Implement Q-FLASH-FORGE card** (AC: 2, 5, 6, 7)
  - [x] 3.1 Create Card component for Q-FLASH-FORGE
  - [x] 3.2 Add tool name: "Q-FLASH-FORGE"
  - [x] 3.3 Add description: "ROM processing tool - Convert OZIP to standard flashable format"
  - [x] 3.4 Add version badge: "Latest"
  - [x] 3.5 Add GitHub icon and link: Opens GitHub repository in new tab
  - [x] 3.6 Add data-tracking attribute: `data-tool="q-flash-forge"`
  - [x] 3.7 Add external link icon to indicate opens in new tab
  - [x] 3.8 Ensure all text uses i18n: `downloads.companionTools.qFlashForge.*`

- [x] **Task 4: Implement WinUSB Driver card** (AC: 3, 5, 6, 7)
  - [x] 4.1 Create Card component for WinUSB Driver
  - [x] 4.2 Add tool name: "WinUSB Driver"
  - [x] 4.3 Add description: "USB driver for Qualcomm EDL mode devices (QDLoader 9008)"
  - [x] 4.4 Add version badge: "v6.1.7600.16385" (or latest)
  - [x] 4.5 Add download button with direct download link
  - [x] 4.6 Add data-tracking attribute: `data-tool="winusb-driver"`
  - [x] 4.7 Add download icon and "Download" label
  - [x] 4.8 Link opens in new tab with `target="_blank" rel="noopener noreferrer"`
  - [x] 4.9 Ensure all text uses i18n: `downloads.companionTools.winusbDriver.*`

- [x] **Task 5: Implement Zadig tool card** (AC: 4, 5, 6, 7)
  - [x] 5.1 Create Card component for Zadig
  - [x] 5.2 Add tool name: "Zadig"
  - [x] 5.3 Add description: "USB driver installation tool (alternative method)"
  - [x] 5.4 Add version badge: "v2.8" (or latest)
  - [x] 5.5 Add download button with link to Zadig official website
  - [x] 5.6 Add data-tracking attribute: `data-tool="zadig"`
  - [x] 5.7 Add external link icon
  - [x] 5.8 Link opens in new tab with `target="_blank" rel="noopener noreferrer"`
  - [x] 5.9 Ensure all text uses i18n: `downloads.companionTools.zadig.*`

- [x] **Task 6: Create ToolCard reusable component** (AC: 2, 3, 4, 5)
  - [x] 6.1 Create `src/components/features/downloads/ToolCard.tsx`
  - [x] 6.2 Define ToolCardProps interface: name, description, version, downloadUrl, githubUrl, icon, trackingId
  - [x] 6.3 Implement card layout with shadcn/ui Card
  - [x] 6.4 Add tool icon/logo area
  - [x] 6.5 Add tool name as card title
  - [x] 6.6 Add description as card content
  - [x] 6.7 Add version badge (use shadcn/ui Badge)
  - [x] 6.8 Add download/link button in card footer
  - [x] 6.9 Add hover effects and transitions
  - [x] 6.10 Export component in barrel file

- [x] **Task 7: Add tracking attributes** (AC: 6)
  - [x] 7.1 Add `data-tool` attribute to each tool card
  - [x] 7.2 Add `data-action="download"` to download buttons
  - [x] 7.3 Add `data-action="visit"` to external links
  - [x] 7.4 Document tracking attributes for future analytics integration
  - [x] 7.5 Add onClick handlers (placeholder for future analytics)

- [x] **Task 8: Update existing Stock ROMs section** (AC: 1)
  - [x] 8.1 Locate existing Stock ROMs section in DownloadsPage
  - [x] 8.2 Ensure it appears BELOW Companion Tools section
  - [x] 8.3 Maintain existing functionality
  - [x] 8.4 Add consistent spacing between sections

- [x] **Task 9: Add i18n translations** (AC: 8)
  - [x] 9.1 Add to `src/i18n/translations/en.json`:
    - `downloads.title` - "Downloads"
    - `downloads.description` - "Download companion tools and stock ROMs"
    - `downloads.companionTools.title` - "Companion Tools"
    - `downloads.companionTools.description` - "Essential tools for flashing Qualcomm devices"
    - `downloads.companionTools.qFlashForge.*` - Q-FLASH-FORGE card keys
    - `downloads.companionTools.winusbDriver.*` - WinUSB Driver card keys
    - `downloads.companionTools.zadig.*` - Zadig card keys
    - `downloads.common.download` - "Download"
    - `downloads.common.visitGithub` - "Visit GitHub"
    - `downloads.common.version` - "Version"
  - [x] 9.2 Add Vietnamese translations to `src/i18n/translations/vi.json`

- [x] **Task 10: Install shadcn/ui Badge component** (AC: 5)
  - [x] 10.1 Check if Badge is already installed
  - [x] 10.2 If not installed, run: `npx shadcn@latest add badge`
  - [x] 10.3 Verify component exists in `src/components/ui/badge.tsx`

- [x] **Task 11: Styling and polish** (AC: 5, 7)
  - [x] 11.1 Use shadcn/ui Card for consistent styling
  - [x] 11.2 Add responsive grid layout: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
  - [x] 11.3 Add hover effects on cards (subtle scale or shadow)
  - [x] 11.4 Style download buttons with primary variant
  - [x] 11.5 Add external link icons from lucide-react (ExternalLink)
  - [x] 11.6 Add download icons from lucide-react (Download)
  - [x] 11.7 Use Linear Violet theme colors for accents
  - [x] 11.8 Add proper spacing between sections
  - [x] 11.9 Ensure mobile-friendly layout

- [x] **Task 12: Testing and verification** (AC: 1-8)
  - [x] 12.1 Run `npm run dev` and verify no TypeScript errors
  - [x] 12.2 Test: Navigate to /downloads → verify page loads
  - [x] 12.3 Test: Verify "Companion Tools" section appears ABOVE "Stock ROMs"
  - [x] 12.4 Test: Verify all 3 tool cards exist (Q-FLASH-FORGE, WinUSB Driver, Zadig)
  - [x] 12.5 Test: Verify each card shows name, description, version, and download/link button
  - [x] 12.6 Test: Click download links → verify opens in new tab
  - [x] 12.7 Test: Inspect links → verify data-tracking attributes present
  - [x] 12.8 Test: Switch language → verify all content translates
  - [x] 12.9 Test: Responsive layout on mobile viewport
  - [x] 12.10 Test: Hover effects on cards and buttons

---

## Dev Notes

### Architecture Context

Story 3.4 implements the **Downloads Page Enhancement** by adding a "Companion Tools" section that provides users with easy access to essential tools needed for flashing Qualcomm devices.

**Pattern:** Content page with reusable card components:
1. **Page Component**: `DownloadsPage.tsx` as a standard page component
2. **Feature Component**: `ToolCard.tsx` as a reusable component for tool cards
3. **i18n Integration**: All content fully translated (EN/VI)
4. **Tracking Ready**: Data attributes for future analytics integration

### Companion Tools Content

```typescript
// Tool definitions for Companion Tools section:

const companionTools = [
  {
    name: 'Q-FLASH-FORGE',
    description: 'ROM processing tool - Convert OZIP to standard flashable format',
    version: 'Latest',
    githubUrl: 'https://github.com/[your-repo]/Q-FLASH-FORGE',
    trackingId: 'q-flash-forge',
    icon: 'github', // or custom logo
  },
  {
    name: 'WinUSB Driver',
    description: 'USB driver for Qualcomm EDL mode devices (QDLoader 9008)',
    version: 'v6.1.7600.16385',
    downloadUrl: '/downloads/drivers/winusb-driver.exe', // or external URL
    trackingId: 'winusb-driver',
    icon: 'download',
  },
  {
    name: 'Zadig',
    description: 'USB driver installation tool (alternative method)',
    version: 'v2.8',
    downloadUrl: 'https://zadig.akeo.ie/',
    trackingId: 'zadig',
    icon: 'external-link',
  },
];
```

### ToolCard Component Implementation

```typescript
// src/components/features/downloads/ToolCard.tsx
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ToolCardProps {
  name: string;
  description: string;
  version: string;
  downloadUrl?: string;
  githubUrl?: string;
  trackingId: string;
  className?: string;
}

export function ToolCard({
  name,
  description,
  version,
  downloadUrl,
  githubUrl,
  trackingId,
  className,
}: ToolCardProps) {
  const { t } = useTranslation();

  const handleClick = () => {
    // Placeholder for future analytics
    console.log(`Tool clicked: ${trackingId}`);
  };

  return (
    <Card
      className={cn('transition-all hover:shadow-lg', className)}
      data-tool={trackingId}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl">{name}</CardTitle>
          <Badge variant="secondary">{version}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        {githubUrl && (
          <Button
            variant="default"
            className="w-full"
            asChild
            onClick={handleClick}
            data-action="visit"
          >
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              <Github className="mr-2 h-4 w-4" />
              {t('downloads.common.visitGithub')}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
        {downloadUrl && (
          <Button
            variant="default"
            className="w-full"
            asChild
            onClick={handleClick}
            data-action="download"
          >
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              {t('downloads.common.download')}
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

### DownloadsPage Component Implementation

```typescript
// src/pages/DownloadsPage.tsx
import { useTranslation } from 'react-i18next';
import { ToolCard } from '@/components/features/downloads/ToolCard';

export function DownloadsPage() {
  const { t } = useTranslation();

  const companionTools = [
    {
      name: 'Q-FLASH-FORGE',
      description: t('downloads.companionTools.qFlashForge.description'),
      version: t('downloads.companionTools.qFlashForge.version'),
      githubUrl: 'https://github.com/[your-repo]/Q-FLASH-FORGE',
      trackingId: 'q-flash-forge',
    },
    {
      name: 'WinUSB Driver',
      description: t('downloads.companionTools.winusbDriver.description'),
      version: t('downloads.companionTools.winusbDriver.version'),
      downloadUrl: '/downloads/drivers/winusb-driver.exe',
      trackingId: 'winusb-driver',
    },
    {
      name: 'Zadig',
      description: t('downloads.companionTools.zadig.description'),
      version: t('downloads.companionTools.zadig.version'),
      downloadUrl: 'https://zadig.akeo.ie/',
      trackingId: 'zadig',
    },
  ];

  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Page Header */}
      <header>
        <h1 className="text-3xl font-bold">{t('downloads.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('downloads.description')}
        </p>
      </header>

      {/* Companion Tools Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-2">
          {t('downloads.companionTools.title')}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t('downloads.companionTools.description')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companionTools.map((tool) => (
            <ToolCard key={tool.trackingId} {...tool} />
          ))}
        </div>
      </section>

      {/* Stock ROMs Section (existing) */}
      <section>
        <h2 className="text-2xl font-semibold mb-2">
          {t('downloads.stockRoms.title')}
        </h2>
        {/* Existing Stock ROMs content */}
      </section>
    </div>
  );
}
```

### Project Structure Notes

New files will be added following architecture.md patterns:
- `src/pages/DownloadsPage.tsx` - Main downloads page component (may already exist)
- `src/components/features/downloads/ToolCard.tsx` - Reusable tool card component
- `src/components/features/downloads/index.ts` - Barrel export
- Modified: `src/i18n/translations/en.json` - Add downloads translation keys
- Modified: `src/i18n/translations/vi.json` - Add Vietnamese translations

### Learnings from Previous Story

**From Story 3-3-expanded-guide-page (Status: in-progress)**

- **shadcn/ui Components**: Card and Badge components may already be installed - verify before installing
- **Translation Pattern**: Continue using `downloads.*` namespace for all downloads-related keys
- **Component Structure**: Keep page components in `src/pages/` following architecture pattern
- **i18n Integration**: Use `useTranslation()` hook for all text content
- **Linear Violet Theme**: Apply theme colors consistently with rest of app
- **Responsive Design**: Ensure mobile-friendly layout with responsive grid

**Key patterns to reuse:**
- **Page Component Pattern**: Follow `ExamplePage` pattern from architecture.md
- **Card Pattern**: Use shadcn/ui Card for consistent styling
- **Translation Pattern**: All text uses `t('downloads.{section}.{key}')`
- **External Links**: Always use `target="_blank" rel="noopener noreferrer"` for security

**Integration notes:**
- This story COMPLETES Epic 3's downloads enhancement - provides essential tools in one place
- Downloads page should be accessible from Header navigation
- Links to Guide page for driver installation instructions (Story 3.3)
- Q-FLASH-FORGE tool complements the main Q-Flash tool
- WinUSB Driver and Zadig are prerequisites mentioned in Guide page

**Technical considerations:**
- Download links should be verified and updated with actual URLs
- Consider hosting WinUSB driver on own server or linking to official source
- Zadig link should point to official website (https://zadig.akeo.ie/)
- Q-FLASH-FORGE GitHub link needs to be updated with actual repository URL
- Analytics tracking attributes are placeholders for future implementation

[Source: stories/3-3-expanded-guide-page.md#Dev-Notes]

### References

- [Source: docs/epics.md#Story-3.4] - Story definition and acceptance criteria
- [Source: docs/architecture.md#Page-Component-Pattern] - Page component structure
- [Source: docs/stories/3-3-expanded-guide-page.md] - Guide page with driver installation instructions
- [Source: docs/PRD.md#F3-Downloads-Enhancement] - Downloads page requirements

---

## Prerequisites

- **Story 1.6** (App Shell Layout Components) - AppLayout and Header for navigation
- **Story 1.2** (Tailwind CSS v4 & shadcn/ui Setup) - Card and Badge components
- **Story 1.4** (React Router & i18n Setup) - Routing and translations

**Note:** This story enhances the Downloads page by adding companion tools section, making it easier for users to find all necessary tools in one place.

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->
- docs/stories/3-4-downloads-page-enhancement.context.xml

### Agent Model Used

_To be filled during implementation_

### Debug Log References

_To be filled during implementation_

### Completion Notes List

_To be filled during implementation_

### File List

- src/pages/DownloadsPage.tsx
- src/i18n/translations/en.json
- src/i18n/translations/vi.json
- src/components/features/downloads/ToolCard.tsx
- src/components/features/downloads/index.ts
- src/components/ui/badge.tsx
- src/components/ui/card.tsx

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
| 2025-12-30 | Dev Agent | Task 1 & 9: Refactored DownloadsPage & added i18n keys |
| 2025-12-30 | Dev Agent | Completed story 3-4: Implemented ToolCard, Companion Tools section, tracking, and polish. |
