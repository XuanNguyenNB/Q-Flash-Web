# Q-Flash-Web - Epic Breakdown

**Author:** Nguyen  
**Date:** 2025-12-29  
**Project Level:** Brownfield Web Application  
**Target Scale:** Professional Tool with 100+ DAU target  

---

## Overview

This document provides the complete epic and story breakdown for Q-Flash-Web, decomposing the requirements from the [PRD](./PRD.md) into implementable stories.

### Epic Summary

| Epic | Goal | Stories | Dependencies |
|------|------|---------|--------------|
| **Epic 1: Foundation** | React 19 + shadcn/ui migration setup | 6 | None |
| **Epic 2: Device Management** | Device selection & WebUSB connection | 5 | Epic 1 |
| **Epic 3: Onboarding & Guide** | First-time user experience | 5 | Epic 1 |
| **Epic 4: Partition Operations** | Backup/Flash with new UI | 6 | Epic 1, 2 |
| **Epic 5: Polish & Power User** | Keyboard shortcuts, animations | 5 | Epic 1-4 |

**Total Stories:** 27

---

## Epic 1: Foundation - React Migration Setup

**Goal:** Thiết lập nền tảng React 19 + Vite + shadcn/ui để enable toàn bộ redesign, bảo toàn core Firehose/WebUSB logic.

**Business Value:** Enables the entire UI redesign while preserving battle-tested flash logic.

---

### Story 1.1: Project Setup & React Installation

As a **developer**,  
I want **the project configured with React 19, Vite React plugin, and TypeScript**,  
So that **I can start building React components**.

**Acceptance Criteria:**

**Given** the existing Vanilla TypeScript + Vite project  
**When** I run the installation commands  
**Then** React 19, React DOM, and @vitejs/plugin-react are installed

**And** vite.config.ts is updated with React plugin  
**And** tsconfig.json is updated for JSX support  
**And** a basic App.tsx and main.tsx entry point exist  
**And** `npm run dev` works without errors

**Prerequisites:** None (Foundation story)

**Technical Notes:**
- Run: `npm install react react-dom @vitejs/plugin-react`
- Update vite.config.ts to use `@vitejs/plugin-react`
- Update tsconfig.json: `"jsx": "react-jsx"`
- Create src/app/App.tsx and src/app/main.tsx
- DO NOT modify any files in src/core/, src/auth/, src/services/

---

### Story 1.2: Tailwind CSS v4 & shadcn/ui Setup

As a **developer**,  
I want **Tailwind CSS v4 and shadcn/ui configured**,  
So that **I can use shadcn/ui components with the Linear Violet theme**.

**Acceptance Criteria:**

**Given** React is installed (Story 1.1)  
**When** I install Tailwind v4 and shadcn/ui dependencies  
**Then** tailwindcss and @tailwindcss/vite are installed

**And** globals.css contains the Linear Violet color theme from UX spec  
**And** components.json is configured for shadcn/ui  
**And** cn() utility function exists in src/lib/utils.ts  
**And** a test Button component renders correctly with Tailwind styles

**Prerequisites:** Story 1.1

**Technical Notes:**
- Run: `npm install tailwindcss @tailwindcss/vite`
- Run: `npm install class-variance-authority clsx tailwind-merge`
- Create src/styles/globals.css with CSS variables from ux-design-specification.md
- Configure vite.config.ts for Tailwind v4
- Run: `npx shadcn@latest init` (select New York style, Zinc base)

---

### Story 1.3: Zustand State Management Setup

As a **developer**,  
I want **Zustand stores configured for device, partition, flash, and settings state**,  
So that **React components can access and update app state**.

**Acceptance Criteria:**

**Given** React and Tailwind are set up  
**When** I create the Zustand stores  
**Then** deviceStore.ts exists with: `selectedDevice`, `isConnected`, `setDevice`, `setConnected`

**And** partitionStore.ts exists with: `partitions`, `selectedPartitions`, `toggleSelection`  
**And** flashStore.ts exists with: `status`, `progress`, `currentPartition`, `setProgress`  
**And** terminalStore.ts exists with: `logs`, `log()`, `clear()`  
**And** settingsStore.ts exists with: `language`, `showWizard`, persisted to localStorage

**Prerequisites:** Story 1.1

**Technical Notes:**
- Run: `npm install zustand`
- Use `persist` middleware for settingsStore
- Create src/stores/ directory structure
- TypeScript interfaces for all state shapes

---

### Story 1.4: React Router & i18n Setup

As a **developer**,  
I want **React Router v7 and react-i18next configured**,  
So that **the app has client-side routing and bilingual support**.

**Acceptance Criteria:**

**Given** React is set up  
**When** I install and configure routing and i18n  
**Then** React Router v7 is installed with routes for: /, /guide, /downloads, /devices, /support

**And** react-i18next is configured with en.json and vi.json  
**And** existing translation keys are preserved and migrated  
**And** useTranslation hook works in components  
**And** language can be switched via settingsStore

**Prerequisites:** Story 1.3 (for settingsStore)

**Technical Notes:**
- Run: `npm install react-router-dom react-i18next i18next`
- Migrate existing src/i18n/en.json and vi.json content
- Create src/i18n/config.ts for i18next initialization
- Create route structure in src/app/App.tsx

---

### Story 1.5: Core Logic Wrapper Hooks

As a **developer**,  
I want **React hooks that wrap the existing WebUSB, Firehose, and Sahara protocols**,  
So that **React components can use core flash logic without modifying it**.

**Acceptance Criteria:**

**Given** React and Zustand are set up  
**When** I create the wrapper hooks  
**Then** useWebUSB.ts exists and wraps WebUSBManager with: `connect()`, `disconnect()`, `getManager()`

**And** useFirehose.ts exists and wraps FirehoseProtocol  
**And** useSahara.ts exists and wraps SaharaProtocol  
**And** useAuth.ts exists and wraps AuthStrategy  
**And** all hooks sync state with Zustand stores  
**And** all hooks log operations to terminalStore  
**And** ZERO changes to files in src/core/, src/auth/, src/services/

**Prerequisites:** Story 1.3

**Technical Notes:**
- Use useRef for singleton protocol instances
- Use useCallback for memoized methods
- Cleanup on unmount via useEffect
- Follow pattern from architecture.md (Protocol Bridge Hook pattern)
- This is CRITICAL: core logic must remain untouched

---

### Story 1.6: App Shell Layout Components

As a **developer**,  
I want **the app shell layout components (Header, Sidebar, LogPanel, AppLayout)**,  
So that **pages have a consistent 3-column layout**.

**Acceptance Criteria:**

**Given** shadcn/ui is set up  
**When** I create the layout components  
**Then** Header.tsx exists with: logo, navigation links, language toggle, settings button

**And** Sidebar.tsx exists with: device card placeholder, navigation items  
**And** LogPanel.tsx exists with: scrollable log area, clear button, color-coded entries  
**And** AppLayout.tsx wraps pages in the 3-column layout  
**And** layout is responsive: 3 columns on desktop, collapsible on tablet

**Prerequisites:** Story 1.2 (shadcn/ui), Story 1.4 (routing)

**Technical Notes:**
- Use CSS Grid for layout: `grid-cols-[260px_1fr_320px]`
- LogPanel reads from terminalStore
- Install lucide-react for icons: `npm install lucide-react`
- Header navigation uses React Router `<Link>`

---

## Epic 2: Device Management & Connection

**Goal:** Cho phép user chọn device từ dropdown grouped by chipset và kết nối WebUSB với UI feedback.

**Business Value:** Users can connect their device with proper firehose auto-selection.

---

### Story 2.1: Device Configuration Update

As a **user with various Qualcomm devices**,  
I want **all 13 chipset families listed in the device selector**,  
So that **I can find and select my device**.

**Acceptance Criteria:**

**Given** the devices.json file  
**When** I update it with all chipset folders  
**Then** devices.json includes entries for all 13 chipset folders from PRD

**And** each device has: id, name, chipset, chipsetFolder, firehose URLs  
**And** devices are grouped by chipset family  
**And** status field reflects: tested, beta, or coming  
**And** at least 40 devices are defined

**Prerequisites:** None (data file update)

**Technical Notes:**
- Reference PRD F4 for chipset folder list
- Firehose URLs point to: `/firehose/{chipsetFolder}/programmer.melf`
- Include devices: OnePlus 6-13, Find X-X8, Realme series
- Mark tested devices based on actual testing

---

### Story 2.2: DeviceSelector Component

As a **user**,  
I want **a searchable dropdown to select my device grouped by chipset**,  
So that **I can easily find my device**.

**Acceptance Criteria:**

**Given** the app shell is loaded  
**When** I click the device selector  
**Then** a dropdown opens with devices grouped by chipset family

**And** I can type to search/filter devices  
**And** selecting a device updates deviceStore  
**And** the selected device is shown with chipset name  
**And** selection is persisted across page reloads

**Prerequisites:** Story 1.6 (App Shell), Story 2.1 (Device Config)

**Technical Notes:**
- Use shadcn/ui Command or Combobox component
- Group devices by chipset in the dropdown
- Persist lastDeviceId in settingsStore

---

### Story 2.3: Auto-detect Firehose by Chipset

As a **user**,  
I want **the tool to automatically load firehose files when I select a device**,  
So that **I don't have to manually select files**.

**Acceptance Criteria:**

**Given** a device is selected  
**When** the device selection changes  
**Then** firehose URLs are constructed from chipsetFolder

**And** programmer.melf, digest.elf, signature.bin are fetched  
**And** loading progress is shown in the UI  
**And** errors are logged to terminal and shown in toast  
**And** if auto-load fails, a popup offers manual file selection

**Prerequisites:** Story 2.2, Story 1.5 (useFirehose hook)

**Technical Notes:**
- Reference PRD F5 for implementation details
- Cache loaded firehose in memory for session
- Use progress indicator during fetch
- Fallback modal for manual file browser

---

### Story 2.4: Device Card & Connection Status

As a **user**,  
I want **to see my device connection status and connect/disconnect**,  
So that **I know when my device is ready**.

**Acceptance Criteria:**

**Given** a device is selected  
**When** I view the Device Card in sidebar  
**Then** it shows: device name, chipset, connection status dot

**And** disconnected: gray dot, "Connect Device" button  
**And** connecting: pulsing animation  
**And** connected: green dot, device info, "Disconnect" button  
**And** error: red dot, error message

**Prerequisites:** Story 2.2, Story 1.5 (useWebUSB hook)

**Technical Notes:**
- Status dot uses CSS animation for pulse effect
- Connect button triggers useWebUSB.connect()
- Status syncs with deviceStore.isConnected

---

### Story 2.5: Connection Flow with Sahara & VIP Auth

As a **user**,  
I want **the full connection flow to work (USB → Sahara → Firehose → VIP Auth)**,  
So that **I can proceed to partition operations**.

**Acceptance Criteria:**

**Given** device is connected via WebUSB  
**When** the connection is established  
**Then** Sahara handshake completes and logs to terminal

**And** firehose is uploaded to device  
**And** VIP authentication is performed for Oppo/OnePlus/Realme  
**And** partition table is read and stored in partitionStore  
**And** success is shown in DeviceCard and log

**Prerequisites:** Story 2.4, Story 1.5 (all protocol hooks)

**Technical Notes:**
- Use useWebUSB, useSahara, useFirehose, useAuth in sequence
- Log each step: "Sahara handshake...", "Loading firehose...", "VIP auth..."
- Handle errors gracefully with retry option

---

## Epic 3: Onboarding & Guide Experience

**Goal:** First-time users được hướng dẫn đầy đủ qua wizard và comprehensive guide page.

**Business Value:** >80% first-time success rate, reduced support questions.

---

### Story 3.1: First-Visit Detection

As a **new user**,  
I want **the app to detect my first visit**,  
So that **I can be shown the setup wizard**.

**Acceptance Criteria:**

**Given** I visit the Tool page for the first time  
**When** the page loads  
**Then** a check is made against localStorage for `wizard_completed` flag

**And** if flag is false/missing, wizard should open  
**And** if flag is true, wizard does not open  
**And** a "Show Guide" button in header re-opens wizard anytime

**Prerequisites:** Story 1.3 (settingsStore)

**Technical Notes:**
- Use settingsStore.showWizard boolean
- Create useFirstVisit hook
- "Show Guide" button in Header component

---

### Story 3.2: First-Time User Wizard Modal

As a **new user**,  
I want **a step-by-step wizard guiding me through setup**,  
So that **I can successfully flash my device on first attempt**.

**Acceptance Criteria:**

**Given** first visit is detected  
**When** the wizard modal opens  
**Then** it has 5 steps: Welcome, Prerequisites, Device Selection, Connect, Ready

**And** each step has Next/Back/Skip buttons  
**And** final step has "Don't show again" checkbox  
**And** wizard is fully translated (Vietnamese + English)  
**And** dismissing wizard updates settingsStore

**Prerequisites:** Story 3.1, Story 2.2 (DeviceSelector)

**Technical Notes:**
- Use shadcn/ui Dialog for modal
- Follow UI flow from PRD F1
- Content from ux-design-specification.md wizard flow
- Each step is a separate component in features/wizard/

---

### Story 3.3: Expanded Guide Page

As a **user**,  
I want **a comprehensive guide page with all usage instructions**,  
So that **I can learn advanced features**.

**Acceptance Criteria:**

**Given** I navigate to the Guide page  
**When** the page loads  
**Then** sections exist: Quick Start, Prerequisites, Installing Drivers, Entering EDL Mode, Using Q-Flash Tool, ROM Processing, Troubleshooting, FAQ

**And** each section is collapsible accordion  
**And** page is fully translated  
**And** relevant screenshots/diagrams are included

**Prerequisites:** Story 1.6 (App Layout)

**Technical Notes:**
- Use shadcn/ui Accordion component
- Rename navigation from "Drivers" to "Guide"
- Content structure from PRD F2
- Add images to public/images/guide/

---

### Story 3.4: Downloads Page Enhancement

As a **user**,  
I want **to download all necessary tools from one place**,  
So that **I don't have to search for them**.

**Acceptance Criteria:**

**Given** I navigate to the Downloads page  
**When** the page loads  
**Then** a "Companion Tools" section appears above "Stock ROMs"

**And** Q-FLASH-FORGE card with GitHub link exists  
**And** WinUSB Driver download card exists  
**And** Zadig tool download link exists  
**And** each card shows: Name, Description, Version, Download links  
**And** clicks are trackable for future analytics

**Prerequisites:** Story 1.6 (App Layout)

**Technical Notes:**
- Use shadcn/ui Card components
- Tool cards from PRD F3
- Add onClick tracking with data attributes
- Links open in new tab

---

### Story 3.5: Support Page with FAQ

As a **user**,  
I want **a support page with FAQs and contact links**,  
So that **I can get help when needed**.

**Acceptance Criteria:**

**Given** I navigate to the Support page  
**When** the page loads  
**Then** FAQ section with common questions exists

**And** contact links (Telegram, Facebook) are shown  
**And** common error solutions are listed  
**And** page is fully translated

**Prerequisites:** Story 1.6 (App Layout)

**Technical Notes:**
- Use Accordion for FAQs
- Content from PRD troubleshooting section
- Add social links with icons

---

## Epic 4: Partition Operations UI

**Goal:** Backup và Flash partitions với React UI mới, progress indicators, và confirmation dialogs.

**Business Value:** Core functionality with improved UX and safety.

---

### Story 4.1: PartitionGrid Component

As a **user**,  
I want **to see all partitions in a grid view with selection checkboxes**,  
So that **I can select partitions to backup or flash**.

**Acceptance Criteria:**

**Given** device is connected and partition table is read  
**When** I view the main content area  
**Then** partitions are displayed in a grid

**And** each partition shows: checkbox, name, size  
**And** dangerous partitions have warning icon ⚠️  
**And** "Select All" / "Deselect All" buttons exist  
**And** selection state is stored in partitionStore

**Prerequisites:** Story 2.5 (Connection with partition read)

**Technical Notes:**
- Use CSS Grid for responsive layout
- PartitionItem is a separate component
- Dangerous partitions from protected list in core logic
- Virtual list if >100 partitions (react-window)

---

### Story 4.2: Partition Search & Filter

As a **user**,  
I want **to search and filter partitions**,  
So that **I can quickly find specific partitions**.

**Acceptance Criteria:**

**Given** partitions are displayed  
**When** I type in the search box  
**Then** partitions are filtered by name

**And** filter is debounced (200ms)  
**And** "No results" message when no matches  
**And** clear button to reset search

**Prerequisites:** Story 4.1

**Technical Notes:**
- Use shadcn/ui Input with search icon
- Debounce with useDebouncedValue or lodash.debounce
- Filter stored in partitionStore.searchFilter

---

### Story 4.3: Backup Flow with Progress

As a **user**,  
I want **to backup selected partitions with progress feedback**,  
So that **I can save my device data**.

**Acceptance Criteria:**

**Given** partitions are selected  
**When** I click "Backup" button  
**Then** a confirmation dialog shows selected partitions

**And** I choose save location (File System Access API)  
**And** backup progress shows: current partition, bytes/total, percentage  
**And** each partition status updates: pending → in-progress → done  
**And** errors are logged and shown  
**And** success toast with file location

**Prerequisites:** Story 4.1, Story 1.5 (useFirehose)

**Technical Notes:**
- Use showDirectoryPicker API
- Progress bar with shadcn/ui Progress
- Write to flashStore for progress tracking
- Create XML metadata file for restore

---

### Story 4.4: Flash Flow with Confirmation

As a **user**,  
I want **to flash selected partitions with proper confirmation**,  
So that **I don't accidentally flash wrong partitions**.

**Acceptance Criteria:**

**Given** ROM files are loaded and partitions selected  
**When** I click "Flash" button  
**Then** a confirmation dialog shows selected partitions

**And** critical partitions are highlighted with warning  
**And** I can confirm to proceed  
**And** flash progress shows: current partition, bytes/total, percentage, ETA  
**And** success toast with summary

**Prerequisites:** Story 4.1, Story 1.5 (useFirehose)

**Technical Notes:**
- Use shadcn/ui AlertDialog for confirmation
- Simple Yes/No confirm (ADR-005)
- Progress with ETA calculation
- Log all operations to terminal

---

### Story 4.5: Terminal Log Panel

As a **user**,  
I want **to see real-time operation logs**,  
So that **I can monitor what's happening**.

**Acceptance Criteria:**

**Given** the app is running  
**When** operations occur (connect, flash, backup, etc.)  
**Then** logs appear in the Log Panel with timestamps

**And** logs are color-coded: info (gray), success (green), warning (yellow), error (red)  
**And** "Clear" button removes all logs  
**And** panel auto-scrolls to latest entry  
**And** logs use monospace font

**Prerequisites:** Story 1.6 (LogPanel component), Story 1.3 (terminalStore)

**Technical Notes:**
- Format: `[HH:mm:ss] Message`
- Use Inter Mono or Fira Code font
- Virtualize if >500 log entries
- Add copy button for error logs

---

### Story 4.6: ROM File Loading

As a **user**,  
I want **to load ROM files and have them parsed automatically**,  
So that **I can flash partitions from a ROM**.

**Acceptance Criteria:**

**Given** device is connected  
**When** I click "Load ROM" and select a folder  
**Then** rawprogram*.xml files are detected

**And** partition entries are parsed from XML  
**And** partition grid shows ROM partitions with sizes  
**And** missing files are marked (e.g., super.img not found)  
**And** errors are logged to terminal

**Prerequisites:** Story 4.1

**Technical Notes:**
- Use showDirectoryPicker API
- Parse rawprogram XML with existing parser logic
- Match ROM files to partition names
- Handle sparse vs raw images

---

## Epic 5: Polish & Power User Features

**Goal:** Nâng cấp UX với keyboard shortcuts, command palette, micro-animations.

**Business Value:** Power users get efficiency; all users get polished experience.

---

### Story 5.1: Keyboard Shortcuts System

As a **power user**,  
I want **keyboard shortcuts for common actions**,  
So that **I can work faster without using the mouse**.

**Acceptance Criteria:**

**Given** the app is running  
**When** I press keyboard shortcuts  
**Then** Ctrl+K opens Command Palette

**And** Ctrl+D toggles connect/disconnect  
**And** Ctrl+O opens ROM file picker  
**And** Ctrl+Enter starts flash/backup  
**And** Escape closes modals  
**And** ? shows shortcuts help

**Prerequisites:** Story 1.6 (App Shell)

**Technical Notes:**
- Create useKeyboard hook
- Use event.ctrlKey or event.metaKey for Mac
- Prevent default browser actions
- Reference UX spec shortcuts table

---

### Story 5.2: Command Palette

As a **power user**,  
I want **a Linear-style command palette (Ctrl+K)**,  
So that **I can quickly access any action**.

**Acceptance Criteria:**

**Given** the app is running  
**When** I press Ctrl+K  
**Then** a command palette modal opens

**And** I can type to filter commands  
**And** actions include: connect, disconnect, load, flash, backup, erase, reboot, settings, guide  
**And** Enter executes selected command  
**And** Escape closes palette

**Prerequisites:** Story 5.1

**Technical Notes:**
- Use shadcn/ui Command component (already Radix-based)
- Actions map to existing functions
- Show keyboard shortcuts next to commands

---

### Story 5.3: Toast Notifications

As a **user**,  
I want **toast notifications for action feedback**,  
So that **I know when actions succeed or fail**.

**Acceptance Criteria:**

**Given** an action completes (connect, flash, backup, etc.)  
**When** the action result is determined  
**Then** a toast notification appears

**And** success toasts are green with checkmark  
**And** error toasts are red with X  
**And** toasts auto-dismiss after 5 seconds  
**And** toasts can be manually dismissed

**Prerequisites:** Story 1.2 (shadcn/ui)

**Technical Notes:**
- Use shadcn/ui Toast/Sonner component
- Create useToast hook or sonner toast()
- Position: bottom-right
- Limit to 3 visible toasts

---

### Story 5.4: Micro-Animations

As a **user**,  
I want **smooth animations throughout the app**,  
So that **the experience feels polished and professional**.

**Acceptance Criteria:**

**Given** user interactions occur  
**When** UI elements change state  
**Then** page transitions fade in/out (150ms)

**And** modals scale up with fade (200ms)  
**And** buttons have hover color transition (100ms)  
**And** progress bars animate smoothly  
**And** log entries fade in  
**And** status dots pulse when connecting

**Prerequisites:** Epic 1-4 complete

**Technical Notes:**
- Use Tailwind transitions: `transition-all duration-150`
- CSS keyframes for pulse animation
- Consider Framer Motion for complex animations
- Reference UX spec animation table

---

### Story 5.5: Settings Page

As a **user**,  
I want **a settings page to customize my preferences**,  
So that **the app works the way I want**.

**Acceptance Criteria:**

**Given** I navigate to Settings  
**When** the page loads  
**Then** I can toggle: language (EN/VI), show wizard, theme (future)

**And** settings are persisted to localStorage  
**And** changes take effect immediately  
**And** "Reset to defaults" option exists

**Prerequisites:** Story 1.3 (settingsStore)

**Technical Notes:**
- Use shadcn/ui Switch and Select components
- settingsStore handles persistence
- Language change updates i18next
- Can be a page or settings drawer

---

_For implementation: Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown._
