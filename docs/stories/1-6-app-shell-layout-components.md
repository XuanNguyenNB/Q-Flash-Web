# Story 1.6: App Shell Layout Components

**Status:** review  
**Epic:** Epic 1 - Foundation - React Migration Setup  
**Created:** 2025-12-29  
**Story Key:** 1-6-app-shell-layout-components

---

## Story

As a **developer**,  
I want **the app shell layout components (Header, Sidebar, LogPanel, AppLayout)**,  
so that **pages have a consistent 3-column layout**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | `Header.tsx` exists with: logo, navigation links, language toggle, settings button | Header renders with all elements, navigation links work with React Router |
| AC2 | `Sidebar.tsx` exists with: device card placeholder, navigation items | Sidebar renders with nav items, placeholder for DeviceCard |
| AC3 | `LogPanel.tsx` exists with: scrollable log area, clear button, color-coded entries | LogPanel displays logs from terminalStore, clear button works |
| AC4 | `AppLayout.tsx` wraps pages in the 3-column layout | Layout applies grid structure to child pages |
| AC5 | Layout is responsive: 3 columns on desktop, collapsible on tablet | On screen < 1280px, sidebar can be collapsed |
| AC6 | Header navigation uses React Router `<Link>` | Navigation doesn't cause page reload |
| AC7 | Language toggle updates settingsStore.language | Clicking toggle switches language and UI updates |
| AC8 | `npm run dev` runs without TypeScript errors | Dev server starts successfully |

---

## Tasks / Subtasks

- [x] **Task 1: Create Header component** (AC: 1, 6, 7)
  - [x] 1.1 Create `src/components/layout/Header.tsx`
  - [x] 1.2 Add Q-Flash logo (use `icon.png` from public/)
  - [x] 1.3 Add navigation links: Tool, Guide, Downloads, Devices, Support
  - [x] 1.4 Use React Router `<Link>` for navigation
  - [x] 1.5 Add language toggle button (EN/VI) connected to settingsStore
  - [x] 1.6 Add settings/gear button (placeholder for future use)
  - [x] 1.7 Style with Tailwind: fixed top, dark background, violet accents
  - [x] 1.8 Add keyboard shortcut hint for Command Palette (Ctrl+K)

- [x] **Task 2: Create Sidebar component** (AC: 2)
  - [x] 2.1 Create `src/components/layout/Sidebar.tsx`
  - [x] 2.2 Add device card placeholder area (to be replaced by DeviceCard later)
  - [x] 2.3 Add navigation items for sidebar (if different from header)
  - [x] 2.4 Add connection status indicator placeholder
  - [x] 2.5 Style with Tailwind: fixed left, 260px width, dark theme
  - [x] 2.6 Add collapse/expand button for responsive mode

- [x] **Task 3: Create LogPanel component** (AC: 3)
  - [x] 3.1 Create `src/components/layout/LogPanel.tsx`
  - [x] 3.2 Connect to terminalStore using `useTerminalStore()`
  - [x] 3.3 Display log entries with timestamp `[HH:mm:ss]` format
  - [x] 3.4 Color-code entries based on level:
    - info: text-zinc-400 (gray)
    - success: text-green-500
    - warning: text-yellow-500
    - error: text-red-500
  - [x] 3.5 Add "Clear" button that calls `terminalStore.clear()`
  - [x] 3.6 Enable auto-scroll to latest entry
  - [x] 3.7 Use monospace font (font-mono or Inter Mono)
  - [x] 3.8 Style with Tailwind: fixed right, 320px width, scrollable area

- [x] **Task 4: Create AppLayout component** (AC: 4, 5)
  - [x] 4.1 Create `src/components/layout/AppLayout.tsx`
  - [x] 4.2 Implement CSS Grid layout: `grid-cols-[260px_1fr_320px]`
  - [x] 4.3 Include Header at top (fixed)
  - [x] 4.4 Include Sidebar on left
  - [x] 4.5 Include LogPanel on right
  - [x] 4.6 Render children in center main area
  - [x] 4.7 Add responsive behavior:
    - Desktop (1280px+): Full 3-column layout
    - Tablet (768-1279px): Collapsible sidebar, log as overlay/drawer
  - [x] 4.8 Use zustand state for sidebar collapse state

- [x] **Task 5: Create layout barrel export** (AC: 1-4)
  - [x] 5.1 Create `src/components/layout/index.ts`
  - [x] 5.2 Export all layout components

- [x] **Task 6: Integrate layout into App** (AC: 4, 8)
  - [x] 6.1 Update `src/app/App.tsx` to use AppLayout
  - [x] 6.2 Wrap pages/routes with AppLayout
  - [x] 6.3 Verify navigation works with React Router

- [x] **Task 7: Install required dependencies** (AC: 8)
  - [x] 7.1 Install lucide-react: `npm install lucide-react`
  - [x] 7.2 Verify no TypeScript errors

- [x] **Task 8: Verify implementation** (AC: 8)
  - [x] 8.1 Run `npm run dev` and verify no errors
  - [x] 8.2 Check Header renders correctly with all elements
  - [x] 8.3 Check Sidebar renders with placeholder
  - [x] 8.4 Check LogPanel displays logs from terminalStore
  - [x] 8.5 Check layout grid applies correctly
  - [x] 8.6 Test responsive behavior on different screen sizes
  - [x] 8.7 Test language toggle functionality


---

## Dev Notes

### Architecture Context

Story này thiết lập **App Shell** - layout chính của ứng dụng theo style Linear Dashboard. Đây là nền tảng cho tất cả các page components.

**Key Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Header (fixed): Logo + Navigation + Settings                   │
├──────────────┬────────────────────────────┬─────────────────────┤
│              │                            │                     │
│   Sidebar    │      Main Content          │    Log Panel        │
│   (260px)    │      (flexible)            │    (320px)          │
│              │                            │                     │
└──────────────┴────────────────────────────┴─────────────────────┘
```

### Technical Decisions

| Decision | Rationale | Source |
|----------|-----------|--------|
| CSS Grid for layout | Modern, flexible 3-column layout | [architecture.md#Project-Structure] |
| Fixed widths for side panels | Consistent with UX spec | [ux-design-specification.md#Layout] |
| terminalStore for logs | Centralized log management | [architecture.md#Zustand-Store-Pattern] |
| React Router Links | Client-side navigation, no reload | [architecture.md#Technology-Stack] |
| lucide-react icons | Consistent with shadcn/ui | [architecture.md#Decision-Summary] |

### Color Theme Reference (Linear Violet)

```css
--primary: #8b5cf6;
--bg-base: #09090b;
--bg-card: #111113;
--bg-elevated: #18181b;
--border: #27272a;
--text: #fafafa;
--text-secondary: #a1a1aa;
--success: #22c55e;
--warning: #eab308;
--error: #ef4444;
```

### Component Structure

After this story:

```
src/
├── components/
│   ├── layout/                # NEW DIRECTORY
│   │   ├── index.ts           # NEW - barrel export
│   │   ├── Header.tsx         # NEW - top navigation
│   │   ├── Sidebar.tsx        # NEW - left panel
│   │   ├── LogPanel.tsx       # NEW - right log panel
│   │   └── AppLayout.tsx      # NEW - main layout wrapper
│   │
│   └── ui/                    # FROM STORY 1.2
│       ├── button.tsx
│       └── ...
│
├── stores/                    # FROM STORY 1.3
│   ├── terminalStore.ts       # LogPanel reads from here
│   └── settingsStore.ts       # Language toggle uses this
│
├── hooks/                     # FROM STORY 1.5
│   └── useTerminal.ts         # Helper for logging
│
└── app/                       # FROM STORY 1.1, 1.4
    ├── App.tsx                # Updated to use AppLayout
    └── main.tsx
```

### Navigation Links

| Path | Page | Description |
|------|------|-------------|
| `/` | ToolPage | Main flash tool (default) |
| `/guide` | GuidePage | Usage guide & documentation |
| `/downloads` | DownloadsPage | Downloads & companion tools |
| `/devices` | DevicesPage | Supported devices list |
| `/support` | SupportPage | Help & FAQ |

### References

- [Source: docs/architecture.md#Project-Structure] - Component organization
- [Source: docs/architecture.md#Layout-Pattern] - Layout structure
- [Source: docs/ux-design-specification.md#Layout-Linear-Dashboard] - Layout specification
- [Source: docs/ux-design-specification.md#Visual-Foundation] - Color theme
- [Source: docs/ux-design-specification.md#Navigation-Structure] - Navigation items
- [Source: docs/epics.md#Story-1.6] - Story definition and acceptance criteria

---

## Learnings from Previous Story

**From Story 1-5-core-logic-wrapper-hooks (Status: ready-for-dev)**

- **Not yet implemented** - Story 1-5 is currently in ready-for-dev status
- **Key patterns established**:
  - React 19 with Vite setup (Story 1.1 - review)
  - Tailwind CSS v4 + shadcn/ui (Story 1.2 - review)
  - Zustand stores with persist middleware (Story 1.3 - review)
  - React Router v7 + i18n (Story 1.4 - in-progress)
  - Protocol wrapper hooks planned (Story 1.5 - ready-for-dev)

**Dependencies:**

- **Story 1.2** (review): Tailwind CSS v4, shadcn/ui, globals.css with theme
- **Story 1.3** (review): terminalStore, settingsStore available
- **Story 1.4** (in-progress): React Router configured with routes

**If dependencies not complete:**

- Layout components can be created first
- Full integration with routing after 1.4 completes
- LogPanel can use mock data if terminalStore not ready

[Source: stories/1-5-core-logic-wrapper-hooks.md]

---

## Prerequisites

- **Story 1.2**: shadcn/ui setup complete (for styling utilities, cn() function)
- **Story 1.4**: React Router configured (for navigation links)
- **Story 1.3**: terminalStore and settingsStore available

---

## Dev Agent Record

### Context Reference

- `docs/stories/1-6-app-shell-layout-components.context.xml`

### Agent Model Used

Gemini 2.5 Pro (via Antigravity Agent)

### Debug Log References

- Verified layout via browser subagent at localhost:5175
- Tested language toggle (EN ↔ VI) - UI updates immediately
- Tested sidebar collapse/expand functionality
- Verified React Router navigation without page reload
- No console errors during testing

### Completion Notes List

- Created 4 layout components following Linear Dashboard style:
  - **Header**: Logo, nav links, language toggle, settings button, Ctrl+K hint
  - **Sidebar**: Device card placeholder, connection status, collapse button
  - **LogPanel**: terminalStore integration, color-coded logs, auto-scroll, clear button
  - **AppLayout**: 3-column grid, responsive behavior, sidebar collapse state
- Added translation keys for EN/VI in sidebar, terminal, device, settings sections
- Integrated AppLayout into App.tsx to wrap all routes
- lucide-react already installed (v0.562.0)
- All ACs verified through browser testing

### File List

- [x] NEW: src/components/layout/index.ts
- [x] NEW: src/components/layout/Header.tsx
- [x] NEW: src/components/layout/Sidebar.tsx
- [x] NEW: src/components/layout/LogPanel.tsx
- [x] NEW: src/components/layout/AppLayout.tsx
- [x] MODIFIED: src/app/App.tsx
- [x] MODIFIED: src/i18n/translations/en.json
- [x] MODIFIED: src/i18n/translations/vi.json

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
| 2025-12-29 | Dev Agent | Implemented all layout components, verified via browser testing |

