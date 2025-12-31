# Story 1.1: Project Setup & React Installation

**Status:** review  
**Epic:** Epic 1 - Foundation - React Migration Setup  
**Created:** 2025-12-29  
**Story Key:** 1-1-project-setup-react-installation

---

## Story

As a **developer**,  
I want **the project configured with React 19, Vite React plugin, and TypeScript**,  
so that **I can start building React components for the UI redesign**.

---

## Acceptance Criteria

| # | Criteria | Test |
|---|----------|------|
| AC1 | React 19 and React DOM are installed as dependencies | `npm list react` shows 19.x |
| AC2 | @vitejs/plugin-react is installed and configured | vite.config.ts includes React plugin |
| AC3 | TypeScript is configured for JSX support | tsconfig.json has `"jsx": "react-jsx"` |
| AC4 | Entry points App.tsx and main.tsx exist | Files exist in src/app/ |
| AC5 | `npm run dev` runs without errors | Dev server starts successfully |
| AC6 | Core logic files are NOT modified | No changes to src/core/, src/auth/, src/services/ |

---

## Tasks / Subtasks

- [x] **Task 1: Install React dependencies** (AC: 1)
  - [x] 1.1 Run `npm install react react-dom`
  - [x] 1.2 Run `npm install -D @types/react @types/react-dom`
  - [x] 1.3 Verify versions in package.json (React 19.x)

- [x] **Task 2: Install Vite React plugin** (AC: 2)
  - [x] 2.1 Run `npm install -D @vitejs/plugin-react`
  - [x] 2.2 Update vite.config.ts to import and use React plugin
  - [x] 2.3 Configure plugin options if needed

- [x] **Task 3: Update TypeScript configuration** (AC: 3)
  - [x] 3.1 Update tsconfig.json with `"jsx": "react-jsx"`
  - [x] 3.2 Add `"jsxImportSource": "react"` if needed
  - [x] 3.3 Verify IDE recognizes JSX syntax

- [x] **Task 4: Create React entry points** (AC: 4)
  - [x] 4.1 Create src/app/ directory
  - [x] 4.2 Create src/app/main.tsx with ReactDOM.createRoot
  - [x] 4.3 Create src/app/App.tsx with basic component
  - [x] 4.4 Update index.html to reference new entry point

- [x] **Task 5: Verify build and dev server** (AC: 5)
  - [x] 5.1 Run `npm run dev` and verify no errors
  - [x] 5.2 Access localhost and see React app rendered
  - [x] 5.3 Verify HMR (Hot Module Replacement) works

- [x] **Task 6: Verify core logic preservation** (AC: 6)
  - [x] 6.1 Confirm no changes to src/core/FirehoseProtocol.ts
  - [x] 6.2 Confirm no changes to src/core/SaharaProtocol.ts
  - [x] 6.3 Confirm no changes to src/core/WebUSBManager.ts
  - [x] 6.4 Confirm no changes to src/auth/AuthStrategy.ts
  - [x] 6.5 Confirm no changes to src/services/deviceConfig.ts


---

## Dev Notes

### Architecture Context

This is a **brownfield migration** project. The approach is:

1. **Add React layer on top** of existing vanilla TypeScript
2. **DO NOT modify** core Firehose/WebUSB/Sahara logic
3. Core logic will be wrapped by React hooks in future stories

### Technical Decisions

| Decision | Rationale | Source |
|----------|-----------|--------|
| React 19 | Required for shadcn/ui, modern hooks | [architecture.md#ADR-001] |
| Keep core logic | Tested, working, risk of regression | [architecture.md#ADR-002] |
| Vite React plugin | Native Vite support, fast HMR | [architecture.md] |

### Commands Reference

```bash
# Install React
npm install react react-dom
npm install -D @types/react @types/react-dom

# Install Vite React plugin
npm install -D @vitejs/plugin-react
```

### vite.config.ts Update Pattern

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ... existing config
})
```

### tsconfig.json Update Pattern

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    // ... existing options
  }
}
```

### main.tsx Pattern

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

### App.tsx Pattern

```tsx
export default function App() {
  return (
    <div>
      <h1>Q-Flash-Web</h1>
      <p>React migration in progress...</p>
    </div>
  )
}
```

### Project Structure Notes

After this story, the project should have:

```
src/
├── app/                 # NEW - React entry
│   ├── App.tsx         # Root component
│   └── main.tsx        # Entry point
├── core/               # UNCHANGED
│   ├── FirehoseProtocol.ts
│   ├── SaharaProtocol.ts
│   └── WebUSBManager.ts
├── auth/               # UNCHANGED
│   └── AuthStrategy.ts
└── services/           # UNCHANGED
    └── deviceConfig.ts
```

### References

- [Source: docs/architecture.md#Project-Initialization] - Installation commands
- [Source: docs/architecture.md#ADR-001] - React migration rationale
- [Source: docs/architecture.md#ADR-002] - Core logic preservation
- [Source: docs/epics.md#Story-1.1] - Story definition

---

## Learnings from Previous Story

**First story in epic - no predecessor context**

This is the foundation story that establishes the React migration base.

---

## Dev Agent Record

### Context Reference

- **Context File:** `docs/stories/1-1-project-setup-react-installation.context.xml`
- **Generated:** 2025-12-29 by BMAD Story Context Workflow

### Agent Model Used

- **Agent:** Antigravity (Google DeepMind Advanced Agentic Coding)
- **Executed:** 2025-12-29

### Debug Log References

**Implementation Plan:**
1. Install React 19 and React DOM dependencies
2. Install TypeScript types and Vite React plugin
3. Create vite.config.ts with React plugin configuration
4. Update tsconfig.json with JSX support
5. Create src/app/ directory with main.tsx and App.tsx
6. Update index.html entry point
7. Verify dev server and core logic preservation

**Verification Steps:**
- `npx tsc --noEmit` - TypeScript check passed ✓
- `npm run dev` - Dev server started on port 5174 ✓
- Browser verification - React app renders correctly ✓
- Git status check - Core files not modified by this story ✓

### Completion Notes List

✅ **Story 1-1 Implementation Complete**

- Successfully installed React 19.2.3 and React DOM
- Configured @vitejs/plugin-react v5.1.2
- Added JSX support to TypeScript (jsx: react-jsx, jsxImportSource: react)
- Created React entry points in src/app/ (App.tsx, main.tsx)
- Updated index.html to use new React entry point
- Dev server runs successfully with HMR support
- Core logic files (src/core/, src/auth/, src/services/) preserved - NO changes made
- Visual verification confirmed React app renders with gradient styling

**Notes:**
- Pre-existing changes in src/core/ files are from previous work (flash failure fixes), NOT from this story
- App.tsx includes inline styles as placeholder - will be replaced with Tailwind in Story 1.2

### File List

- [x] NEW: src/app/App.tsx
- [x] NEW: src/app/main.tsx
- [x] NEW: vite.config.ts
- [x] MODIFIED: tsconfig.json
- [x] MODIFIED: index.html
- [x] MODIFIED: package.json
- [x] MODIFIED: package-lock.json

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-29 | SM Agent | Story drafted from epics.md |
| 2025-12-29 | Dev Agent | Implementation complete - React 19 setup with all ACs satisfied |

