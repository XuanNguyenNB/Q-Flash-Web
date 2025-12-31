# Story 3.5: Support Page with FAQ

Status: review

## Story

As a user,
I want a support page with FAQs and contact links,
so that I can get help when needed.

## Acceptance Criteria

1. **Navigation & Layout**: The Support page is accessible via the Header "Support" link and renders within the main AppLayout.
2. **FAQ Section**: A collapsible FAQ section displays common questions and answers, using the Accordion component.
3. **Troubleshooting Guide**: Common error messages (e.g., "Device not found", "VIP authentication failed") are listed with solution steps.
4. **Contact Channels**: Direct links to support channels (Telegram, Facebook) are displayed with icons and clear labels.
5. **i18n Support**: All content is fully translated into English and Vietnamese.

## Tasks / Subtasks

- [x] **Create Support Page Component** (AC: 1)
  - [x] Create `src/pages/SupportPage.tsx`
  - [x] Implement layout with PageHeader and content container
  - [x] Ensure responsive design
- [x] **Implement FAQ Section** (AC: 2)
  - [x] Use `shadcn/ui` Accordion component
  - [x] Populate with initial FAQs (6 questions covering EDL mode, safety, unbricking, VIP auth, browser support, and flashing time)
- [x] **Implement Troubleshooting Section** (AC: 3)
  - [x] Create a "Common Errors" section
  - [x] List error solutions: "Device not found", "Bulk transfer timeout", "VIP authentication failed", "Session limit reached"
- [x] **Implement Contact Section** (AC: 4)
  - [x] Create contact cards for Telegram and Facebook
  - [x] Add icons using Lucide React (Send, Facebook, ExternalLink)
  - [x] Ensure links open in new tab with `rel="noopener noreferrer"` and `target="_blank"`
- [x] **Add Translations** (AC: 5)
  - [x] Add keys to `src/i18n/translations/en.json` (support namespace)
  - [x] Add keys to `src/i18n/translations/vi.json`
- [x] **Route Integration** (AC: 1)
  - [x] Verified `/support` route already exists in `src/app/routes.tsx`

## Dev Notes

- **Architecture Patterns**:
  - Follow the **Page Component Pattern** defined in `architecture.md`: Header + Main content area.
  - Use `shadcn/ui` components (`Accordion`, `Card`, `Button`) for consistent styling.
  - No specific state management needed (static content), but utilize `useTranslation` hook.

- **Source Tree Components**:
  - `src/pages/SupportPage.tsx` (New)
  - `src/components/ui/accordion.tsx` (Existing)
  - `src/components/ui/card.tsx` (Existing)

- **Testing Standards**:
  - Verify all external links use `rel="noopener noreferrer"` and `target="_blank"`.
  - Check responsiveness on mobile/tablet breakpoints (stacking order).
  - Validate translations for all text strings.

### Project Structure Notes

- Compliant with `unified-project-structure.md` (implied standard): Pages go in `src/pages/`.
- No new stores or services required.

### References

- [Source: docs/epics.md#Story-3.5:-Support-Page-with-FAQ]
- [Source: docs/PRD.md#F2:-Expanded-Guide-Page] (Troubleshooting content source)
- [Source: docs/ux-design-specification.md#Navigation-Structure]

## Dev Agent Record

### Context Reference

- docs/stories/3-5-support-page-with-faq.context.xml

### Agent Model Used

Google Deepmind: Antigravity

### Debug Log References

- 2025-12-30: Implementation started. TypeScript compilation successful.

### Learnings from Previous Story

**From Story 3-4-downloads-page-enhancement (Status: review)**

- Previous story is `review`, meaning implementation is complete.
- Accordion pattern can be referenced from `GuidePage` (Story 3.3).
- Card component exists and works well for contact sections.

### Completion Notes List

- ✅ SupportPage fully implemented with 3 main sections: Contact, Troubleshooting, FAQ
- ✅ FAQ section with 6 questions (EDL mode, safety, unbricking, VIP auth, browsers, timing)
- ✅ Troubleshooting section with 4 common errors and solutions in Accordion format
- ✅ Contact section with Telegram and Facebook cards using shadcn/ui Card component
- ✅ Full i18n support for both English and Vietnamese
- ✅ All external links use proper security attributes (noopener, noreferrer, _blank)
- ✅ Responsive design with grid layout for contact cards
- ✅ TypeScript compilation successful

### File List

- `src/pages/SupportPage.tsx` (Modified - Complete reimplementation)
- `src/i18n/translations/en.json` (Modified - Added support namespace with 77+ translation keys)
- `src/i18n/translations/vi.json` (Modified - Added support namespace with 77+ translation keys)
