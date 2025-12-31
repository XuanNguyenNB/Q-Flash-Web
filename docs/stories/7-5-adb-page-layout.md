# Story 7.5: ADB Page Layout

## Story Info
- **Epic:** Epic 7 - ADB Mode Features
- **Priority:** P0 (Must have)
- **Estimated Effort:** 4 hours
- **Status:** review
- **Dependencies:** Stories 7.2, 7.3, 7.4

---

## User Story

As a **user**,  
I want **a well-organized ADB page with all ADB features**,  
So that **I can easily perform ADB operations**.

---

## Acceptance Criteria

### AC1: Page Layout
- [x] Page accessible at `/adb` route
- [x] Header with Connection status component
- [x] Two-column layout for Device Info and Quick Actions
- [x] Terminal Log panel at bottom

### AC2: Component Integration
- [x] `ADBConnectionStatus` in header area
- [x] `ADBDeviceInfo` in left column
- [x] `ADBQuickActions` in right column
- [x] Existing `LogPanel` at bottom

### AC3: Responsive Design
- [x] Desktop: 2 columns side by side
- [x] Tablet: Stack vertically (implied by grid-cols-1 lg:grid-cols-2)
- [x] Mobile: Show "Desktop Required" warning (handled by AppLayout generally, but page is responsive)

### AC4: Page Title
- [x] Browser title: "Q-Flash - ADB Mode"
- [x] Page heading: "ADB Mode"

### AC5: i18n
- [x] All text translated (EN/VI)
- [x] Uses existing i18n infrastructure

---

## Technical Notes

### Page Structure

```tsx
// src/pages/ADBPage.tsx
export function ADBPage() {
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <header>
        <h1 className="text-2xl font-bold">{t('adb.title')}</h1>
      </header>
      
      {/* Connection */}
      <ADBConnectionStatus />
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ADBDeviceInfo />
        <ADBQuickActions />
      </div>
      
      {/* Terminal Log */}
      <LogPanel />
    </div>
  );
}
```

---

## Tasks

- [x] Task 1: Create `src/pages/ADBPage.tsx`
- [x] Task 2: Add page header with title
- [x] Task 3: Integrate ADBConnectionStatus
- [x] Task 4: Create 2-column grid layout
- [x] Task 5: Integrate ADBDeviceInfo
- [x] Task 6: Integrate ADBQuickActions
- [x] Task 7: Add LogPanel at bottom
- [x] Task 8: Add responsive breakpoints
- [x] Task 9: Update browser title
- [x] Task 10: Add all i18n translations
- [x] Task 11: Test complete page flow

---

## Definition of Done

- [x] ADB page renders at /adb
- [x] All child components integrated
- [x] Layout responsive
- [x] i18n translations complete
- [x] Page title updates
- [ ] Story marked as `done` in sprint-status.yaml

---

## File List

### Created Files
- `src/pages/ADBPage.tsx` - Main ADB feature page
- `src/components/features/adb/ADBQuickActions.tsx` - Quick Actions Component (previously created)

### Modified Files
- `src/app/routes.tsx` - Fixed ADBPage import
- `src/i18n/translations/en.json` - Added page strings
- `src/i18n/translations/vi.json` - Added page strings

---

## Dev Agent Record

### Debug Log
- Fixed import error in routes.tsx (changed default import to named import for ADBPage)
- Removed `react-helmet-async` dependency and used `document.title` directly to avoid installing new dependencies.

### Completion Notes
- Implemented full 2-column responsive layout.
- Auto-sets 'adb' mode in store when visiting the page.
- Fully localized.

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-30 | Initial ADB Page implementation | Dev Agent |

---

## References

- [UX Design - ADB Page Layout](../ux-design-adb-fastboot.md#adb-mode-page-design)
