# Q-Flash-Web UX Design Specification

> **Version:** 1.0  
> **Date:** 2025-12-29  
> **Author:** Sally (UX Designer Agent) with Nguyen  
> **Status:** Draft

---

## 📋 Executive Summary

This document defines the User Experience specification for the Q-Flash-Web redesign project. It captures all UX decisions made during the collaborative design process.

### Design Vision

> **"Tool EDL trực tiếp trên browser - Không biết làm gì thì lên đây nó hướng dẫn hết"**

A professional, Linear-inspired web application that makes Qualcomm device flashing accessible to everyone while providing power-user capabilities for technicians.

---

## 🎯 Emotional Goals

The redesigned Q-Flash-Web should evoke these feelings:

| Emotion | How We Achieve It |
|---------|------------------|
| 💪 **Empowered & In Control** | Clear visual feedback, undo/confirm for dangerous actions |
| 🛡️ **Safe & Confident** | Fail-safe design, validation steps, clear warnings |
| ⚡ **Efficient & Productive** | Keyboard shortcuts, optimistic UI, minimal steps |
| 😎 **Professional** | Premium dark aesthetic, smooth animations, Linear-quality polish |

---

## 🎨 Visual Foundation

### Design System

| Aspect | Decision |
|--------|----------|
| **Framework** | shadcn/ui (Radix primitives + Tailwind) |
| **Typography** | Inter font family |
| **Icons** | Lucide Icons |
| **Animations** | Framer Motion / CSS transitions |

### Color Theme: Linear Violet

```css
:root {
  /* Primary Colors */
  --primary: #8b5cf6;
  --primary-hover: #7c3aed;
  --primary-glow: rgba(139, 92, 246, 0.25);
  --secondary: #a78bfa;
  --accent: #c084fc;
  
  /* Semantic Colors */
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;
  --info: #8b5cf6;
  
  /* Background Layers */
  --bg-base: #09090b;
  --bg-card: #111113;
  --bg-elevated: #18181b;
  --bg-hover: #1f1f23;
  
  /* Borders & Lines */
  --border: #27272a;
  --border-hover: #3f3f46;
  
  /* Text */
  --text: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
}
```

### Typography Scale

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| H1 | 32px | 700 | Page titles |
| H2 | 24px | 700 | Section headers |
| H3 | 18px | 600 | Card titles |
| Body | 14px | 400 | Default text |
| Small | 12px | 400 | Captions, labels |
| Mono | 13px | 400 | Log output, technical |

### Spacing System

```
Base unit: 4px
xs: 4px   (0.25rem)
sm: 8px   (0.5rem)
md: 16px  (1rem)
lg: 24px  (1.5rem)
xl: 32px  (2rem)
2xl: 48px (3rem)
```

---

## 📐 Layout: Linear Dashboard

### Overall Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (fixed): Logo + Navigation + Settings                   │
├──────────────┬────────────────────────────┬─────────────────────┤
│              │                            │                     │
│   Sidebar    │      Main Content          │    Log Panel        │
│   (260px)    │      (flexible)            │    (320px)          │
│              │                            │                     │
│  • Device    │  • Content Header          │  • Console output   │
│  • Nav items │  • Action buttons          │  • Real-time logs   │
│  • Quick     │  • Partition grid/list     │  • Timestamps       │
│    actions   │  • Progress indicators     │  • Color-coded      │
│              │                            │                     │
└──────────────┴────────────────────────────┴─────────────────────┘
```

### Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| **Desktop (1280px+)** | Full 3-column layout |
| **Tablet (768-1279px)** | Collapsible sidebar, log as drawer |
| **Mobile (<768px)** | Show "Desktop recommended" warning |

---

## 🧭 Navigation Structure

### Sidebar Navigation

```
📱 Device Card
├── Device name + chip
├── Connection status (dot indicator)
└── Quick disconnect button

📋 Navigation Items
├── Partitions (default view)
├── Backup
├── Flash
├── Tools
│   ├── Erase Data
│   ├── Reboot
│   └── Read Info
└── Settings
    ├── Language
    ├── Theme
    └── Advanced
```

### Header Navigation

```
[Logo] Q-Flash-Web          [Guide] [Downloads] [Devices] [Support]  [🌐 EN/VI] [⚙️]
```

---

## 🔄 Core User Flows

### Flow 1: First-Time User (Wizard)

```
┌─────────────────────────────────────────────────┐
│  Step 1: Welcome                                │
│  "Chào mừng đến Q-Flash! Hãy để tôi hướng dẫn" │
│  [Next]                                         │
├─────────────────────────────────────────────────┤
│  Step 2: Prerequisites                          │
│  ✓ Chrome/Edge browser                          │
│  ✓ WinUSB Driver [Download]                     │
│  ✓ Q-FLASH-FORGE [Download]                     │
│  [Next] [Skip]                                  │
├─────────────────────────────────────────────────┤
│  Step 3: Select Your Device                     │
│  [Dropdown: Device list grouped by chipset]     │
│  [Next] [Back]                                  │
├─────────────────────────────────────────────────┤
│  Step 4: Enter EDL Mode                         │
│  Instructions + diagram                         │
│  [Connect Device] [Back]                        │
├─────────────────────────────────────────────────┤
│  Step 5: Ready!                                 │
│  Quick reference card                           │
│  [ ] Don't show again                           │
│  [Start Flashing]                               │
└─────────────────────────────────────────────────┘
```

### Flow 2: Flash Partitions

```
1. Device Connected (auto or manual)
   └── Log: "Device connected: OnePlus 12R"
   
2. Load ROM Files
   └── Click "Load ROM" → File picker
   └── Parse rawprogram.xml automatically
   └── Show partition list with sizes
   
3. Select Partitions
   └── Grid view with checkboxes
   └── "Select All" / "Deselect All"
   └── Dangerous partitions marked ⚠️
   
4. Confirm & Flash
   └── Summary modal: "Flash 12 partitions?"
   └── Progress bar with partition name
   └── Real-time log updates
   
5. Complete
   └── Success toast with summary
   └── Option to reboot device
```

### Flow 3: Backup Partitions

```
1. Select partitions to backup
2. Choose save location (File System Access API)
3. Confirm backup
4. Progress with ETA
5. Validation check
6. Success + file location
```

---

## 🎛️ Component Specifications

### Device Card

```
┌─────────────────────────────────────┐
│ ● OnePlus 12R                       │
│   SM7675 • Snapdragon 7+ Gen 3      │
│   [Disconnect]                      │
└─────────────────────────────────────┘

States:
- Disconnected: Gray, "Connect Device" button
- Connecting: Pulsing animation
- Connected: Green dot, device info shown
- Error: Red dot, error message
```

### Partition Item

```
┌─────────────────────────────────────┐
│ [✓] boot                     64 MB  │
└─────────────────────────────────────┘

States:
- Default: Unchecked, neutral border
- Selected: Checked, primary border glow
- Dangerous: Warning icon, requires confirmation
- Flashing: Progress bar overlay
- Success: Green check
- Failed: Red X with retry option
```

### Progress Indicator

```
┌─────────────────────────────────────┐
│ Flashing super.img                  │
│ ████████████░░░░░░░░░  65%         │
│ 3.2 GB / 4.9 GB • ~2:30 remaining   │
└─────────────────────────────────────┘
```

### Log Panel

```
┌─────────────────────────────────────┐
│ Console                    [Clear]  │
├─────────────────────────────────────┤
│ [14:25:01] Device connected         │
│ [14:25:02] ✓ Sahara handshake OK    │
│ [14:25:03] Loading firehose...      │
│ [14:25:04] ✓ VIP auth success       │
│ [14:25:05] Reading partition table  │
│ [14:25:06] Found 48 partitions      │
└─────────────────────────────────────┘

Color coding:
- Normal: --text-muted
- Success: --success (green)
- Warning: --warning (yellow)
- Error: --error (red)
- Info: --primary (violet)
```

---

## ⌨️ Keyboard Shortcuts (Linear-inspired)

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open Command Palette |
| `Ctrl/Cmd + L` | Focus log panel |
| `Ctrl/Cmd + D` | Connect/Disconnect device |
| `Ctrl/Cmd + O` | Open/Load ROM files |
| `Ctrl/Cmd + Enter` | Start flash/backup |
| `Escape` | Close modal/cancel |
| `?` | Show keyboard shortcuts |

### Command Palette Actions

```
> connect     - Connect to device
> disconnect  - Disconnect device
> load        - Load ROM files
> flash       - Start flash
> backup      - Start backup
> erase       - Erase userdata
> reboot      - Reboot device
> settings    - Open settings
> guide       - Open guide
```

---

## 🛡️ Fail-Safe Design Patterns

### Dangerous Action Confirmation

For operations that could damage the device:

```
┌─────────────────────────────────────────────┐
│ ⚠️ Warning: Dangerous Operation             │
├─────────────────────────────────────────────┤
│ You are about to flash:                     │
│ • system_a (critical)                       │
│ • boot_a (critical)                         │
│                                             │
│ This may brick your device if interrupted.  │
│                                             │
│ Type "FLASH" to confirm:                    │
│ [________________]                          │
│                                             │
│ [Cancel]                   [Confirm Flash]  │
└─────────────────────────────────────────────┘
```

### Protected Partition Handling

| Partition Type | Default Behavior |
|----------------|------------------|
| Normal (vendor, product) | Selectable |
| Critical (boot, system) | Warning icon, confirmation required |
| Protected (modem, persist) | Hidden by default, "Show protected" toggle |
| Dangerous (userdata) | Separate "Erase" action, not in batch |

---

## ✨ Micro-Animations

| Element | Animation | Duration |
|---------|-----------|----------|
| Page transitions | Fade in/out | 150ms |
| Modal open | Scale up + fade | 200ms |
| Button hover | Background color | 100ms |
| Checkbox toggle | Scale bounce | 150ms |
| Toast appear | Slide in from right | 200ms |
| Progress bar | Smooth width transition | 100ms |
| Log entry | Fade in + slide up | 100ms |
| Status dot | Pulse when connecting | 1s loop |

---

## 📱 Mobile Considerations

Since WebUSB requires desktop, mobile will show:

```
┌─────────────────────────────────────┐
│         🖥️ Desktop Required         │
│                                     │
│  Q-Flash-Web requires a desktop     │
│  browser with WebUSB support.       │
│                                     │
│  Supported browsers:                │
│  • Chrome 89+                       │
│  • Edge 89+                         │
│                                     │
│  [View Guide] [Download Options]    │
└─────────────────────────────────────┘
```

---

## 📎 Appendix

### A. Design Assets

| Asset | Location |
|-------|----------|
| Color Theme Visualizer | `docs/ux-color-themes.html` |
| Design Direction Mockups | `docs/ux-design-directions.html` |
| Brand Icon | `icon.png` |

### B. Inspiration References

| App | Patterns Borrowed |
|-----|-------------------|
| **Linear** | Command palette, deep dark mode, keyboard-first, optimistic UI |
| **BalenaEtcher** | 3-step workflow, fail-safe design, validation steps |
| **Docker Desktop** | Visual dashboard, quick actions, status management |

### C. Related Documents

- [PRD](./PRD.md) - Product requirements
- [Architecture](./architecture.md) - Technical architecture
- [Component Inventory](./component-inventory.md) - Existing components

---

## ✅ Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| UX Designer | Sally (Agent) | 2025-12-29 | ✅ Drafted |
| Product Owner | Nguyen | 2025-12-29 | ⏳ Pending |

---

*This UX specification is a living document. It will be updated as design evolves during implementation.*
