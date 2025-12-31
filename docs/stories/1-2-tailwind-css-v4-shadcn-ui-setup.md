# Story 1.2: Tailwind CSS v4 & shadcn/ui Setup

**Status:** review  
**Epic:** Epic 1 - Foundation - React Migration Setup  
**Created:** 2025-12-29  
**Story Key:** 1-2-tailwind-css-v4-shadcn-ui-setup

---

## Story

As a **developer**,  
I want **Tailwind CSS v4 and shadcn/ui configured with the Linear Violet theme**,  
so that **I can use shadcn/ui components to build the redesigned UI**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | Tailwind CSS v4 and @tailwindcss/vite plugin are installed | `npm list tailwindcss` shows 4.x ✅ |
| AC2 | shadcn/ui dependencies installed (class-variance-authority, clsx, tailwind-merge) | Check package.json ✅ |
| AC3 | globals.css contains Linear Violet theme CSS variables | File contains `--primary`, `--background`, etc. ✅ |
| AC4 | components.json is configured for shadcn/ui (New York style, Zinc base) | File exists with correct settings ✅ |
| AC5 | cn() utility function exists in src/lib/utils.ts | Function is exported and works ✅ |
| AC6 | A test Button component renders correctly with Tailwind styles | Button displays with correct styling ✅ |
| AC7 | `npm run dev` runs without errors | Dev server starts successfully ✅ |

---

## Tasks / Subtasks

- [x] **Task 1: Install Tailwind CSS v4** (AC: 1)
  - [x] 1.1 Run `npm install tailwindcss @tailwindcss/vite`
  - [x] 1.2 Update vite.config.ts to add Tailwind plugin
  - [x] 1.3 Verify vite.config.ts has both React and Tailwind plugins

- [x] **Task 2: Install shadcn/ui dependencies** (AC: 2)
  - [x] 2.1 Run `npm install class-variance-authority clsx tailwind-merge`
  - [x] 2.2 Verify all three packages in package.json

- [x] **Task 3: Create globals.css with Linear Violet theme** (AC: 3)
  - [x] 3.1 Create src/styles/globals.css
  - [x] 3.2 Add @import "tailwindcss" at top
  - [x] 3.3 Add CSS variables for Linear Violet theme from UX spec:
    - Primary colors (violet/purple shades)
    - Background colors (dark zinc-based)
    - Foreground, muted, accent, destructive colors
    - Border, ring, chart colors
  - [x] 3.4 Import globals.css in main.tsx

- [x] **Task 4: Create cn() utility** (AC: 5)
  - [x] 4.1 Create src/lib/utils.ts
  - [x] 4.2 Implement cn() using clsx + tailwind-merge
  - [x] 4.3 Export cn() function

- [x] **Task 5: Initialize shadcn/ui** (AC: 4)
  - [x] 5.1 Run `npx shadcn@latest init`
  - [x] 5.2 Select options: New York style, Zinc base color
  - [x] 5.3 Verify components.json created with correct settings
  - [x] 5.4 Update paths if needed (src/components/ui, src/lib/utils)

- [x] **Task 6: Install and test Button component** (AC: 6)
  - [x] 6.1 Run `npx shadcn@latest add button`
  - [x] 6.2 Verify src/components/ui/button.tsx created
  - [x] 6.3 Import and render Button in App.tsx
  - [x] 6.4 Verify button displays correctly with Tailwind styles

- [x] **Task 7: Verify build and dev server** (AC: 7)
  - [x] 7.1 Run `npm run dev` and verify no errors
  - [x] 7.2 Access localhost and see React app with styled Button
  - [x] 7.3 Test HMR by changing Button variant

---

## Dev Notes

### Architecture Context

Tiếp nối Story 1.1, story này thiết lập styling foundation:

1. **Tailwind CSS v4** - New CSS-first configuration (không cần tailwind.config.js)
2. **shadcn/ui** - UI components sẽ được add dần trong các stories tiếp theo
3. **Linear Violet Theme** - Premium dark theme từ UX Design Specification

### Technical Decisions

| Decision | Rationale | Source |
|----------|-----------|--------|
| Tailwind v4 | CSS-first config, 5x faster, @apply không cần | [architecture.md#ADR-004] |
| New York style | Dense, professional appearance | [ux-design-specification] |
| Zinc base | Dark theme foundation | [ux-design-specification] |

### vite.config.ts Update Pattern

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // ... existing config
})
```

### Linear Violet Theme CSS Variables

Reference from UX Design Specification:

```css
@import "tailwindcss";

@theme {
  --color-background: oklch(0.141 0.005 285.823);
  --color-foreground: oklch(0.985 0.002 247.839);
  --color-card: oklch(0.161 0.007 285.823);
  --color-card-foreground: oklch(0.985 0.002 247.839);
  --color-popover: oklch(0.161 0.007 285.823);
  --color-popover-foreground: oklch(0.985 0.002 247.839);
  --color-primary: oklch(0.707 0.165 313.189);
  --color-primary-foreground: oklch(0.2 0.06 310);
  --color-secondary: oklch(0.274 0.025 256.801);
  --color-secondary-foreground: oklch(0.985 0.002 247.839);
  --color-muted: oklch(0.274 0.025 256.801);
  --color-muted-foreground: oklch(0.706 0.015 256.801);
  --color-accent: oklch(0.274 0.025 256.801);
  --color-accent-foreground: oklch(0.985 0.002 247.839);
  --color-destructive: oklch(0.664 0.21 28.752);
  --color-destructive-foreground: oklch(0.985 0.002 247.839);
  --color-border: oklch(0.274 0.025 256.801);
  --color-input: oklch(0.274 0.025 256.801);
  --color-ring: oklch(0.707 0.165 313.189);
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}
```

### cn() Utility Pattern

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Project Structure Notes

After this story:

```
src/
├── app/
│   ├── App.tsx           # Updated with Button test
│   └── main.tsx          # Updated with globals.css import
├── components/
│   └── ui/
│       └── button.tsx    # NEW - shadcn/ui Button
├── lib/
│   └── utils.ts          # NEW - cn() utility
├── styles/
│   └── globals.css       # NEW - Tailwind + theme
├── core/                  # UNCHANGED
├── auth/                  # UNCHANGED
└── services/              # UNCHANGED
```

### References

- [Source: docs/architecture.md#Project-Initialization] - Installation commands
- [Source: docs/architecture.md#ADR-004] - Tailwind v4 decision
- [Source: docs/epics.md#Story-1.2] - Story definition
- [Source: docs/ux-design-specification.md] - Linear Violet theme colors

---

## Learnings from Previous Story

**From Story 1-1-project-setup-react-installation (Status: review)**

- **Foundation Established**: React 19 + Vite React plugin configured and working
- **Entry Points Created**: `src/app/App.tsx` and `src/app/main.tsx` exist
- **Config Updated**: `vite.config.ts` has React plugin, `tsconfig.json` has JSX support
- **Core Logic Preserved**: No changes to src/core/, src/auth/, src/services/

**Dependencies:**
- This story REQUIRES Story 1.1 to be complete (React must be installed first) ✓

[Source: stories/1-1-project-setup-react-installation.md]

---

## Dev Agent Record

### Context Reference

- **Context File:** `docs/stories/1-2-tailwind-css-v4-shadcn-ui-setup.context.xml`
- **Generated:** 2025-12-29 by BMAD Story Context Workflow

### Agent Model Used

Gemini 2.5 Pro (Antigravity)

### Debug Log References

- Task 1: Installed tailwindcss 4.1.18 and @tailwindcss/vite 4.1.18
- Task 2: Installed class-variance-authority, clsx, tailwind-merge
- Task 3: Created globals.css with Tailwind v4 @theme syntax and oklch colors
- Task 4: Created cn() utility in src/lib/utils.ts
- Task 5: Created components.json manually (shadcn CLI put files in wrong @ folder)
- Task 6: Installed Button component, verified all 6 variants render correctly
- Task 7: Verified dev server runs, all styling works in browser

### Completion Notes List

- **Tailwind CSS v4** installed with CSS-first configuration using `@theme` directive
- **Linear Violet theme** implemented with oklch color values for modern CSS support
- **shadcn/ui** configured with New York style and Zinc base color
- **Button component** demonstrates all variant types (default, secondary, outline, ghost, destructive, link)
- All 7 acceptance criteria verified and passed ✅
- **Note:** shadcn CLI created files in `@/` folder instead of `src/` - manually relocated and cleaned up

### File List

- [x] NEW: src/styles/globals.css
- [x] NEW: src/lib/utils.ts
- [x] NEW: src/components/ui/button.tsx
- [x] NEW: components.json
- [x] MODIFIED: vite.config.ts (add Tailwind plugin)
- [x] MODIFIED: src/app/main.tsx (import globals.css)
- [x] MODIFIED: src/app/App.tsx (add Button test with all variants)
- [x] MODIFIED: package.json (new dependencies)

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
| 2025-12-29 | Dev Agent | All tasks implemented, all ACs verified |
