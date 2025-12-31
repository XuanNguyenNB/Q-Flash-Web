# Q-Flash-Web UX Design: ADB & Fastboot Modes

> **Version:** 1.0  
> **Date:** 2025-12-30  
> **Author:** UX Designer Agent with Nguyen  
> **Status:** Draft  
> **Related:** [Main UX Spec](./ux-design-specification.md) | [PRD](./prd-usb-adb-fastboot.md)

---

## 📋 Overview

This document extends the main UX Design Specification with detailed wireframes and interaction patterns for the new **ADB Mode** and **Fastboot Mode** pages.

### Design Principles (Inherited)

- **Linear-inspired** dark aesthetic
- **Keyboard-first** interactions
- **Fail-safe** design for dangerous operations
- **Real-time feedback** via terminal log

---

## 🎨 Mode Selector Component

### Position & Placement

The Mode Selector is placed in the **Header**, between the logo and navigation links.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🔷 Q-Flash    [EDL ▼] [ADB] [Fastboot]   │  Guide  Downloads  Support  🌐  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Design Variants

#### Option A: Tab Pills (Recommended)

```
┌──────────────────────────────────────────┐
│  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
│  │ ⚡ EDL  │ │ 📱 ADB  │ │ 🔧 Fastboot│  │
│  └─────────┘ └─────────┘ └───────────┘  │
│      ▲                                   │
│   Selected (primary bg, text-white)      │
└──────────────────────────────────────────┘

States:
- Default: bg-zinc-800/50, text-muted
- Hover: bg-zinc-700/50, text-foreground
- Selected: bg-primary, text-white, glow effect
- Disabled: opacity-50, cursor-not-allowed
```

#### Option B: Dropdown Select

```
┌─────────────────────────────────────────┐
│  Mode: [⚡ EDL Mode            ▼]       │
│        ┌────────────────────────┐       │
│        │ ⚡ EDL Mode            │       │
│        │ 📱 ADB Mode           │       │
│        │ 🔧 Fastboot Mode      │       │
│        └────────────────────────┘       │
└─────────────────────────────────────────┘
```

### Mode Icons & Colors

| Mode | Icon | Color Accent | Description |
|------|------|--------------|-------------|
| EDL | ⚡ | Violet (#8b5cf6) | Current primary |
| ADB | 📱 | Blue (#3b82f6) | Subtle blue tint |
| Fastboot | 🔧 | Orange (#f97316) | Warning-like |

### Connected State Behavior

When device is connected:
- Current mode tab is **highlighted**
- Other modes are **disabled** with tooltip: "Disconnect device to change mode"
- Visual: `opacity-50` + `cursor-not-allowed`

---

## 📱 ADB Mode Page Design

### Full Page Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🔷 Q-Flash    [EDL] [ADB ▼] [Fastboot]   │  Guide  Downloads  Support  🌐  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─ ADB Mode ──────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  ┌─ Connection ─────────────────────────────────────────────────┐   │  │
│  │  │                                                               │   │  │
│  │  │   [📱 Connect ADB]              Status: ● Disconnected        │   │  │
│  │  │                                                               │   │  │
│  │  └───────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  │  ┌─ Device Information ─────────────┐ ┌─ Quick Actions ───────────┐ │  │
│  │  │                                  │ │                           │ │  │
│  │  │  📱 Connect device to view info  │ │  ⚡ Reboot EDL            │ │  │
│  │  │                                  │ │  🔧 Reboot Fastboot       │ │  │
│  │  │  Model:        —                 │ │  🔄 Reboot Recovery       │ │  │
│  │  │  Android:      —                 │ │  🔄 Reboot System         │ │  │
│  │  │  Build:        —                 │ │  ⏻  Power Off             │ │  │
│  │  │  Serial:       —                 │ │                           │ │  │
│  │  │  Manufacturer: —                 │ │  ─────────────────────    │ │  │
│  │  │  Device:       —                 │ │  All buttons disabled     │ │  │
│  │  │                                  │ │  until device connected   │ │  │
│  │  │  [🔄 Refresh]                    │ │                           │ │  │
│  │  │                                  │ │                           │ │  │
│  │  └──────────────────────────────────┘ └───────────────────────────┘ │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─ Terminal Log ───────────────────────────────────── [Copy] [Clear] ─┐  │
│  │                                                                      │  │
│  │  [11:30:00] Welcome to ADB Mode                                      │  │
│  │  [11:30:00] Click "Connect ADB" to begin                             │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Connected State

```
┌─ Connection ─────────────────────────────────────────────────────────┐
│                                                                       │
│   [📱 Disconnect]              Status: ● Connected (Pixel 7 Pro)     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘

┌─ Device Information ─────────────┐ ┌─ Quick Actions ───────────────┐
│                                  │ │                               │
│  📱 Pixel 7 Pro                  │ │  [⚡ Reboot EDL      ]        │
│                                  │ │  [🔧 Reboot Fastboot ]        │
│  Model:        Pixel 7 Pro       │ │  [🔄 Reboot Recovery ]        │
│  Android:      14                │ │  [🔄 Reboot System   ]        │
│  Build:        AP2A.240805.005   │ │  [⏻  Power Off       ]        │
│  Serial:       XXXXXXXXXXXX      │ │                               │
│  Manufacturer: Google            │ │  ─────────────────────────    │
│  Device:       cheetah           │ │  ℹ️ After reboot, switch to   │
│                                  │ │  the appropriate mode tab     │
│  [🔄 Refresh]                    │ │                               │
│                                  │ │                               │
└──────────────────────────────────┘ └───────────────────────────────┘
```

### Component Specifications

#### Connection Header Card

```css
/* Container */
.connection-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Connect Button */
.connect-btn {
  background: var(--primary);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  gap: 8px;
}

.connect-btn:hover {
  background: var(--primary-hover);
  box-shadow: 0 0 20px var(--primary-glow);
}

/* Status Indicator */
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot.disconnected { background: #71717a; }
.status-dot.connecting { 
  background: #f97316; 
  animation: pulse 1s infinite;
}
.status-dot.connected { background: #22c55e; }
.status-dot.error { background: #ef4444; }
```

#### Device Info Panel

```
┌─────────────────────────────────────────┐
│  📱 Device Information            [🔄]  │
├─────────────────────────────────────────┤
│                                         │
│  Model         Pixel 7 Pro              │
│  Android       14                       │
│  Build         AP2A.240805.005          │
│  Serial        XXXXXXXXXXXX             │
│  Manufacturer  Google                   │
│  Device        cheetah                  │
│                                         │
└─────────────────────────────────────────┘

Layout: Label-Value pairs
- Label: text-muted, 12px
- Value: text-foreground, 14px, font-medium
- Refresh button: icon-only, top-right corner
```

#### Quick Action Buttons

```
Button Specifications:

┌────────────────────────────────────┐
│  ⚡  Reboot EDL                    │
└────────────────────────────────────┘

Size: Full width, height 44px
Padding: 12px 16px
Border-radius: 8px
Background: var(--bg-elevated)
Border: 1px solid var(--border)
Icon: 20px, left-aligned
Text: 14px, font-medium

Hover: 
  - Background: var(--bg-hover)
  - Border: var(--border-hover)

Disabled:
  - Opacity: 0.5
  - Cursor: not-allowed

Special: Power Off button
  - Border-color: var(--error)
  - Text-color: var(--error)
  - Hover: bg-error/10
```

---

## 🔧 Fastboot Mode Page Design

### Full Page Wireframe

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🔷 Q-Flash    [EDL] [ADB] [Fastboot ▼]   │  Guide  Downloads  Support  🌐  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─ Fastboot Mode ─────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  ┌─ Connection ─────────────────────────────────────────────────┐   │  │
│  │  │                                                               │   │  │
│  │  │   [🔧 Connect Fastboot]          Status: ● Disconnected       │   │  │
│  │  │                                                               │   │  │
│  │  └───────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  │  ┌─ Device Variables ───────────────┐ ┌─ Bootloader ─────────────┐  │  │
│  │  │                                  │ │                          │  │  │
│  │  │  🔧 Connect device to view vars  │ │  Status: 🔒 Unknown      │  │  │
│  │  │                                  │ │                          │  │  │
│  │  │  Product:     —                  │ │  ┌──────────────────────┐│  │  │
│  │  │  Variant:     —                  │ │  │  🔓 Unlock           ││  │  │
│  │  │  Serial:      —                  │ │  └──────────────────────┘│  │  │
│  │  │  Bootloader:  —                  │ │  ┌──────────────────────┐│  │  │
│  │  │  Secure:      —                  │ │  │  🔒 Lock             ││  │  │
│  │  │  Slot:        —                  │ │  └──────────────────────┘│  │  │
│  │  │  Battery:     —                  │ │                          │  │  │
│  │  │                                  │ │  ⚠️ These actions will   │  │  │
│  │  │  [🔄 Refresh]                    │ │  erase all device data   │  │  │
│  │  │                                  │ │                          │  │  │
│  │  └──────────────────────────────────┘ └──────────────────────────┘  │  │
│  │                                                                      │  │
│  │  ┌─ Flash Partitions ────────────────────────────────────────────┐  │  │
│  │  │                                                                │  │  │
│  │  │  [📦 Flash Boot]  [📦 Flash Recovery]  [📦 Flash Vbmeta]      │  │  │
│  │  │                                                                │  │  │
│  │  │  [🗑️ Erase Partition ▼]                                       │  │  │
│  │  │                                                                │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  │  ┌─ Reboot ───────────────────────────────────────────────────────┐ │  │
│  │  │                                                                 │ │  │
│  │  │  [🔄 Reboot System]  [🔧 Reboot Bootloader]  [🔄 Reboot Recovery]│ │  │
│  │  │                                                                 │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─ Terminal Log ───────────────────────────────────── [Copy] [Clear] ─┐  │
│  │                                                                      │  │
│  │  [11:35:00] Welcome to Fastboot Mode                                 │  │
│  │  [11:35:00] Ensure device is in Fastboot/Bootloader mode             │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Connected State (Unlocked Bootloader)

```
┌─ Device Variables ───────────────┐ ┌─ Bootloader ─────────────┐
│                                  │ │                          │
│  🔧 cheetah (Pixel 7 Pro)        │ │  Status: 🔓 Unlocked     │
│                                  │ │  (green badge)           │
│  Product:     cheetah            │ │                          │
│  Variant:     MP                 │ │  ┌──────────────────────┐│
│  Serial:      XXXXXXXXXXXX       │ │  │  🔓 Unlock (disabled)││
│  Bootloader:  🔓 Unlocked        │ │  └──────────────────────┘│
│  Secure:      Yes                │ │  ┌──────────────────────┐│
│  Slot:        a (of 2)           │ │  │  🔒 Lock             ││
│  Battery:     85%                │ │  └──────────────────────┘│
│                                  │ │                          │
│  [🔄 Refresh]                    │ │  ⚠️ Lock will erase data │
│                                  │ │                          │
└──────────────────────────────────┘ └──────────────────────────┘
```

### Connected State (Locked Bootloader)

```
┌─ Device Variables ───────────────┐ ┌─ Bootloader ─────────────┐
│                                  │ │                          │
│  🔧 cheetah (Pixel 7 Pro)        │ │  Status: 🔒 Locked       │
│                                  │ │  (red badge)             │
│  Product:     cheetah            │ │                          │
│  Variant:     MP                 │ │  ┌──────────────────────┐│
│  Serial:      XXXXXXXXXXXX       │ │  │  🔓 Unlock           ││
│  Bootloader:  🔒 Locked          │ │  └──────────────────────┘│
│  Secure:      Yes                │ │  ┌──────────────────────┐│
│  Slot:        a (of 2)           │ │  │  🔒 Lock (disabled)  ││
│  Battery:     85%                │ │  └──────────────────────┘│
│                                  │ │                          │
│  [🔄 Refresh]                    │ │  ⚠️ Unlock erases data   │
│                                  │ │                          │
└──────────────────────────────────┘ └──────────────────────────┘
```

### Bootloader Unlock Confirmation Dialog

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│    ⚠️  Unlock Bootloader                                          │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│    WARNING: This will ERASE ALL DATA on your device!              │
│                                                                   │
│    ┌─────────────────────────────────────────────────────────┐   │
│    │  • All apps and data will be deleted                    │   │
│    │  • Device will factory reset                            │   │
│    │  • You must confirm on the device screen                │   │
│    │  • Device security features may be affected             │   │
│    └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│    Are you sure you want to unlock the bootloader?               │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│              [Cancel]                    [⚠️ Unlock Bootloader]    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Button Styles:
- Cancel: Ghost button, neutral
- Unlock: Warning background (orange/amber), bold text
```

### Flash Partition Flow

#### Step 1: Click Flash Button → File Picker Opens

```
OS File Picker Dialog
- Filter: .img files
- Title: "Select boot.img to flash"
```

#### Step 2: Confirm Flash Dialog

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│    📦  Flash Partition                                            │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│    You are about to flash:                                        │
│                                                                   │
│    ┌─────────────────────────────────────────────────────────┐   │
│    │  File:       boot.img                                   │   │
│    │  Size:       67.2 MB                                    │   │
│    │  Partition:  boot                                       │   │
│    └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│    This will overwrite the current boot partition.               │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│              [Cancel]                         [📦 Flash Now]       │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

#### Step 3: Flash Progress

```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│    📦  Flashing boot.img...                                       │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│    ████████████████████████░░░░░░░░░░░░░░░░░░  65%                │
│                                                                   │
│    43.7 MB / 67.2 MB                                             │
│                                                                   │
│    ⏱️ Estimated time remaining: ~5 seconds                        │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│              [Cancel]  (disabled during flash)                    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

#### Step 4: Complete

```
Toast Notification (bottom-right):
┌─────────────────────────────────────────┐
│  ✓  boot.img flashed successfully       │
│     67.2 MB in 8 seconds                │
└─────────────────────────────────────────┘
```

### Erase Partition Dropdown

```
┌─ Flash Partitions ────────────────────────────────────────────┐
│                                                                │
│  [📦 Flash Boot]  [📦 Flash Recovery]  [📦 Flash Vbmeta]      │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  🗑️ Erase Partition                               ▼     │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  userdata    (User data - factory reset)                │  │
│  │  cache       (Cache partition)                          │  │
│  │  metadata    (Encryption metadata)                      │  │
│  │  ─────────────────────────────────────────────────────  │  │
│  │  [Enter partition name manually...]                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 📐 Responsive Layout

### Desktop (1280px+)

```
┌────────────────────────────────────────────────────────────────┐
│  Header                                                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─ Left Column (50%) ──────┐ ┌─ Right Column (50%) ────────┐ │
│  │                          │ │                              │ │
│  │  Device Info / Variables │ │  Quick Actions / Bootloader  │ │
│  │                          │ │                              │ │
│  └──────────────────────────┘ └──────────────────────────────┘ │
│                                                                │
│  ┌─ Full Width ────────────────────────────────────────────┐  │
│  │  Flash Partitions / Reboot Actions                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─ Terminal Log ───────────────────────────────────────────┐ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Tablet (768px - 1279px)

```
┌────────────────────────────────────────────────┐
│  Header (Mode Selector as Dropdown)            │
├────────────────────────────────────────────────┤
│                                                │
│  ┌─ Full Width ──────────────────────────────┐│
│  │  Device Info / Variables                   ││
│  └────────────────────────────────────────────┘│
│                                                │
│  ┌─ Full Width ──────────────────────────────┐│
│  │  Quick Actions / Bootloader                ││
│  └────────────────────────────────────────────┘│
│                                                │
│  ┌─ Full Width ──────────────────────────────┐│
│  │  Flash Partitions                          ││
│  └────────────────────────────────────────────┘│
│                                                │
│  ┌─ Terminal (Collapsible Drawer) ───────────┐│
│  └────────────────────────────────────────────┘│
│                                                │
└────────────────────────────────────────────────┘
```

---

## 🎨 Color Theme Details

### Mode-Specific Accents

```css
/* ADB Mode */
.adb-accent {
  --mode-primary: #3b82f6;      /* Blue-500 */
  --mode-primary-hover: #2563eb; /* Blue-600 */
  --mode-glow: rgba(59, 130, 246, 0.25);
}

/* Fastboot Mode */
.fastboot-accent {
  --mode-primary: #f97316;       /* Orange-500 */
  --mode-primary-hover: #ea580c; /* Orange-600 */
  --mode-glow: rgba(249, 115, 22, 0.25);
}

/* Apply to Connect button when in that mode */
.adb-mode .connect-btn {
  background: var(--mode-primary);
}

.fastboot-mode .connect-btn {
  background: var(--mode-primary);
}
```

### Bootloader Status Badge

```css
.bootloader-badge {
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
}

.bootloader-badge.unlocked {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.bootloader-badge.locked {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
```

---

## ✨ Animations

### Mode Switch Transition

```css
/* Page content fade transition */
.mode-page-enter {
  opacity: 0;
  transform: translateY(8px);
}

.mode-page-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 200ms ease-out;
}

.mode-page-exit {
  opacity: 1;
}

.mode-page-exit-active {
  opacity: 0;
  transition: opacity 150ms ease-in;
}
```

### Connection Status Pulse

```css
@keyframes status-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.status-dot.connecting {
  animation: status-pulse 1s ease-in-out infinite;
}
```

### Button Loading State

```css
.btn-loading {
  position: relative;
  color: transparent;
}

.btn-loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

---

## 📱 Mobile Warning

Since ADB/Fastboot require USB connection:

```
┌─────────────────────────────────────────────┐
│                                             │
│         🖥️ Desktop Required                 │
│                                             │
│  ADB and Fastboot modes require a          │
│  desktop browser with USB support.          │
│                                             │
│  Please access this page from:              │
│  • Chrome on Windows/Mac/Linux             │
│  • Edge on Windows                          │
│                                             │
│  [📖 View Guide]                            │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔤 i18n Text Strings

### English

```json
{
  "mode": {
    "edl": "EDL",
    "adb": "ADB",
    "fastboot": "Fastboot",
    "switchDisabled": "Disconnect device to change mode"
  },
  "adb": {
    "title": "ADB Mode",
    "connect": "Connect ADB",
    "disconnect": "Disconnect",
    "deviceInfo": {
      "title": "Device Information",
      "connectPrompt": "Connect device to view info",
      "model": "Model",
      "android": "Android Version",
      "build": "Build Number",
      "serial": "Serial Number",
      "manufacturer": "Manufacturer",
      "device": "Device"
    },
    "quickActions": {
      "title": "Quick Actions",
      "rebootEdl": "Reboot EDL",
      "rebootFastboot": "Reboot Fastboot",
      "rebootRecovery": "Reboot Recovery",
      "reboot": "Reboot System",
      "shutdown": "Power Off",
      "hint": "After reboot, switch to the appropriate mode tab"
    }
  },
  "fastboot": {
    "title": "Fastboot Mode",
    "connect": "Connect Fastboot",
    "variables": {
      "title": "Device Variables",
      "product": "Product",
      "variant": "Variant",
      "serial": "Serial Number",
      "bootloader": "Bootloader",
      "secure": "Secure Boot",
      "slot": "Current Slot",
      "battery": "Battery"
    },
    "bootloader": {
      "title": "Bootloader",
      "status": "Status",
      "unlocked": "Unlocked",
      "locked": "Locked",
      "unlock": "Unlock Bootloader",
      "lock": "Lock Bootloader",
      "unlockWarning": "WARNING: Unlocking will ERASE ALL DATA!",
      "lockWarning": "WARNING: Locking will erase data and prevent custom ROMs."
    },
    "flash": {
      "title": "Flash Partitions",
      "boot": "Flash Boot",
      "recovery": "Flash Recovery",
      "vbmeta": "Flash Vbmeta (Disable AVB)",
      "erase": "Erase Partition",
      "flashing": "Flashing...",
      "success": "Flashed successfully"
    },
    "reboot": {
      "title": "Reboot",
      "system": "Reboot System",
      "bootloader": "Reboot Bootloader",
      "recovery": "Reboot Recovery"
    }
  }
}
```

### Vietnamese

```json
{
  "mode": {
    "edl": "EDL",
    "adb": "ADB",
    "fastboot": "Fastboot",
    "switchDisabled": "Ngắt kết nối thiết bị để đổi chế độ"
  },
  "adb": {
    "title": "Chế Độ ADB",
    "connect": "Kết Nối ADB",
    "disconnect": "Ngắt Kết Nối",
    "deviceInfo": {
      "title": "Thông Tin Thiết Bị",
      "connectPrompt": "Kết nối thiết bị để xem thông tin",
      "model": "Model",
      "android": "Phiên Bản Android",
      "build": "Số Build",
      "serial": "Số Serial",
      "manufacturer": "Nhà Sản Xuất",
      "device": "Thiết Bị"
    },
    "quickActions": {
      "title": "Thao Tác Nhanh",
      "rebootEdl": "Khởi động lại EDL",
      "rebootFastboot": "Khởi động lại Fastboot",
      "rebootRecovery": "Khởi động lại Recovery",
      "reboot": "Khởi động lại Hệ thống",
      "shutdown": "Tắt Nguồn",
      "hint": "Sau khi khởi động lại, chuyển sang tab chế độ tương ứng"
    }
  },
  "fastboot": {
    "title": "Chế Độ Fastboot",
    "connect": "Kết Nối Fastboot",
    "variables": {
      "title": "Thông Số Thiết Bị",
      "product": "Sản Phẩm",
      "variant": "Biến Thể",
      "serial": "Số Serial",
      "bootloader": "Bootloader",
      "secure": "Secure Boot",
      "slot": "Slot Hiện Tại",
      "battery": "Pin"
    },
    "bootloader": {
      "title": "Bootloader",
      "status": "Trạng Thái",
      "unlocked": "Đã Mở Khóa",
      "locked": "Đã Khóa",
      "unlock": "Mở Khóa Bootloader",
      "lock": "Khóa Bootloader",
      "unlockWarning": "CẢNH BÁO: Mở khóa sẽ XÓA TOÀN BỘ DỮ LIỆU!",
      "lockWarning": "CẢNH BÁO: Khóa sẽ xóa dữ liệu và ngăn cài custom ROM."
    },
    "flash": {
      "title": "Flash Phân Vùng",
      "boot": "Flash Boot",
      "recovery": "Flash Recovery",
      "vbmeta": "Flash Vbmeta (Tắt AVB)",
      "erase": "Xóa Phân Vùng",
      "flashing": "Đang flash...",
      "success": "Flash thành công"
    },
    "reboot": {
      "title": "Khởi Động Lại",
      "system": "Khởi động lại Hệ thống",
      "bootloader": "Khởi động lại Bootloader",
      "recovery": "Khởi động lại Recovery"
    }
  }
}
```

---

## ✅ Design Checklist

### Before Implementation

- [ ] Review wireframes with stakeholder
- [ ] Finalize color accents for each mode
- [ ] Confirm button placement and grouping
- [ ] Validate warning dialog text

### During Implementation

- [ ] Test on Chrome and Edge
- [ ] Verify responsive breakpoints
- [ ] Test with real device connection
- [ ] Validate all animations

### After Implementation

- [ ] Usability testing with target users
- [ ] Performance check (no jank on animations)
- [ ] Accessibility audit (keyboard navigation, screen reader)

---

_This UX Design extends the main specification for ADB/Fastboot modes._  
_Date: 2025-12-30_  
_Author: Nguyen & UX Designer Agent_

_Next: Begin implementation with Story 6.1 (Install Libraries)._
