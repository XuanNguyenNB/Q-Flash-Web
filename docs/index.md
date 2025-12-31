# Q-Flash-Web - Project Documentation Index

> **Generated:** 2025-12-29 | **Scan Level:** Exhaustive | **Mode:** Initial Scan

---

## 📋 Project Overview

| Property | Value |
|----------|-------|
| **Project Name** | Q-Flash-Web (oppo-webusb-tool) |
| **Type** | Monolith - Web Application |
| **Primary Language** | TypeScript |
| **Framework** | Vite + Vanilla TypeScript SPA |
| **Architecture** | Component-based SPA with WebUSB Hardware Integration |
| **Author** | Xuan Nguyen |

### Quick Description

**Q-Flash** is a **Universal Qualcomm Flash Tool** that runs entirely in the browser using **WebUSB API**. It enables users to flash firmware, backup partitions, and perform recovery operations on Qualcomm-based devices (Oppo, OnePlus, Realme) in **EDL (Emergency Download Mode - 9008)**.

---

## 🔧 Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Build Tool** | Vite | ^7.2.4 | Fast development server & bundler |
| **Language** | TypeScript | ~5.9.3 | Type-safe JavaScript |
| **Target** | ES2022 + DOM | - | Modern browser environment |
| **Web API** | WebUSB | - | Direct USB device communication |
| **Styling** | Vanilla CSS | - | Custom design system |
| **i18n** | Custom | - | Vietnamese & English support |
| **Fonts** | Google Fonts | - | Inter, JetBrains Mono |

---

## 📂 Source Tree

```
Q-Flash-Web/
├── index.html              # Entry point HTML
├── package.json            # NPM configuration
├── tsconfig.json           # TypeScript configuration
├── src/                    # Source code
│   ├── main.ts             # Application entry point
│   ├── router.ts           # Hash-based SPA router
│   ├── tool.ts             # Main flash tool logic (3042 lines)
│   ├── style.css           # Global styles (~57KB)
│   ├── presets.ts          # Device preset configurations
│   ├── core/               # Protocol implementations
│   │   ├── FirehoseProtocol.ts   # Qualcomm Firehose XML protocol
│   │   ├── SaharaProtocol.ts     # Qualcomm Sahara upload protocol
│   │   └── WebUSBManager.ts      # WebUSB device management
│   ├── components/         # Reusable UI components
│   │   ├── ai-chat.ts      # AI Assistant chat panel
│   │   └── sidebar.ts      # Navigation sidebar
│   ├── pages/              # Page components
│   │   ├── tool.ts         # Flash Tool page
│   │   ├── downloads.ts    # ROM Downloads page
│   │   ├── devices.ts      # Supported Devices page
│   │   ├── drivers.ts      # Driver Installation guide
│   │   ├── donate.ts       # Donation page
│   │   └── support.ts      # Support/FAQ page
│   ├── services/           # Business logic services
│   │   └── deviceConfig.ts # Device configuration loader
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # All app types & interfaces
│   ├── i18n/               # Internationalization
│   │   ├── i18n.ts         # i18n service
│   │   └── translations/   # Translation files
│   │       ├── en.json     # English
│   │       └── vi.json     # Vietnamese
│   └── ui/                 # UI utilities
│       └── Terminal.ts     # CLI-style log terminal
├── public/                 # Static assets
│   ├── configs/            # JSON configurations
│   │   ├── devices.json    # Supported devices list
│   │   └── downloads.json  # Available downloads
│   ├── firehose/           # EDL programmer files
│   └── presets/            # Device preset binaries
├── docs/                   # Documentation (this folder)
└── bmad/                   # BMAD workflow system
```

---

## 📖 Generated Documentation

### Core Documentation

- [Project Overview](./project-overview.md) - Executive summary & architecture
- [Architecture](./architecture.md) - Detailed system architecture
- [Source Tree Analysis](./source-tree-analysis.md) - Folder structure explained
- [Development Guide](./development-guide.md) - Setup & development workflow

### Technical References

- [API Contracts](./api-contracts.md) - Internal module APIs
- [Component Inventory](./component-inventory.md) - UI components catalog
- [Protocol Documentation](./protocol-docs.md) - Qualcomm protocol details

### Operational Guides

- [Deployment Guide](./deployment-guide.md) _(To be generated)_

---

## 🧩 Core Modules

### 1. WebUSB Layer (`src/core/WebUSBManager.ts`)

Handles low-level USB communication:
- Device detection (Qualcomm 9008 EDL mode)
- Bulk IN/OUT transfers with timeout
- Interface claiming/release
- Connection state management

### 2. Sahara Protocol (`src/core/SaharaProtocol.ts`)

First-stage bootloader protocol:
- Upload EDL programmer (Firehose)
- Handle HELLO/READ_DATA exchanges
- Support 64-bit offsets for modern devices

### 3. Firehose Protocol (`src/core/FirehoseProtocol.ts`)

Main device interaction protocol:
- XML-based command/response
- Read/Write partitions
- GPT manipulation
- VIP authentication (Oppo-specific)

### 4. Tool Module (`src/tool.ts`)

Main UI and orchestration:
- Device selection & connection
- Partition table display
- Batch read/write operations
- Progress tracking

---

## 🌐 Supported Devices

Dynamic device support via `/configs/devices.json`:

| Brand | Status Types |
|-------|--------------|
| **Oppo** | Tested, Beta, Coming |
| **OnePlus** | Tested, Beta |
| **Realme** | Beta, Coming |

---

## 🔧 Development

### Prerequisites

- Node.js 18+
- Modern browser with WebUSB support (Chrome, Edge)
- Windows with WinUSB driver for EDL devices

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + Vite build |
| `npm run preview` | Preview production build |

---

## 🔒 Security Considerations

1. **VIP Authentication** - Oppo devices require special handshake with digest/signature files
2. **Protected Partitions** - Critical partitions (LUN5) contain IMEI/calibration data
3. **WebUSB Permissions** - User must explicitly grant USB access

---

## 📝 Notes for AI-Assisted Development

When creating PRDs or implementing features:

1. **Reference this index** for project structure understanding
2. **Core protocols** are in `src/core/` - these are critical and well-tested
3. **UI changes** should maintain the current dark theme aesthetic
4. **i18n** - All user-facing strings should use the `t()` function
5. **Device support** - Add new devices via `/configs/devices.json`

---

## 📞 Contact

- **Author:** Xuan Nguyen
- **Telegram:** [@mitomtreem](https://t.me/mitomtreem)
- **Facebook:** [xuannguyen030923](https://www.facebook.com/xuannguyen030923)
