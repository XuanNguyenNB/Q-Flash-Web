# Q-Flash-Web - Development Guide

> **Generated:** 2025-12-29 | **Scan Level:** Exhaustive

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime |
| **npm** | 9+ | Package manager |
| **Browser** | Chrome/Edge | WebUSB support required |

### Recommended Tools

| Tool | Purpose |
|------|---------|
| **VS Code** | IDE with TypeScript support |
| **Zadig** | WinUSB driver installation (Windows) |

---

## Quick Start

### 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/XuanNguyenNB/Q-Flash-Web.git
cd Q-Flash-Web

# Install dependencies
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

This starts Vite dev server at `http://localhost:5173`

### 3. Open in Browser

Navigate to `http://localhost:5173` in Chrome or Edge.

---

## Project Structure

```
Q-Flash-Web/
├── src/                    # Source code
│   ├── main.ts             # Entry point - app bootstrap
│   ├── router.ts           # SPA hash router
│   ├── tool.ts             # Main tool logic (~3000 lines)
│   ├── style.css           # Global styles
│   ├── presets.ts          # Device preset imports
│   │
│   ├── core/               # Protocol implementations
│   │   ├── WebUSBManager.ts
│   │   ├── SaharaProtocol.ts
│   │   └── FirehoseProtocol.ts
│   │
│   ├── components/         # Reusable UI components
│   │   ├── sidebar.ts
│   │   └── ai-chat.ts
│   │
│   ├── pages/              # Page components
│   │   ├── tool.ts
│   │   ├── downloads.ts
│   │   ├── devices.ts
│   │   ├── drivers.ts
│   │   ├── donate.ts
│   │   └── support.ts
│   │
│   ├── services/           # Business logic
│   │   └── deviceConfig.ts
│   │
│   ├── types/              # TypeScript definitions
│   │   └── index.ts
│   │
│   ├── i18n/               # Internationalization
│   │   ├── i18n.ts
│   │   └── translations/
│   │       ├── en.json
│   │       └── vi.json
│   │
│   └── ui/                 # UI utilities
│       └── Terminal.ts
│
├── public/                 # Static assets (served as-is)
│   ├── configs/
│   │   ├── devices.json    # Device profiles
│   │   └── downloads.json  # Download catalog
│   ├── firehose/           # Programmer files by device
│   └── presets/            # Preset binaries
│
├── index.html              # HTML entry point
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript config
└── vite.config.ts          # Vite config (if exists)
```

---

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start development server with HMR |
| `build` | `tsc && vite build` | Type-check then production build |
| `preview` | `vite preview` | Preview production build locally |

---

## Development Workflow

### Adding a New Page

1. **Create page component** in `src/pages/`:

```typescript
// src/pages/mypage.ts
export function renderMyPage(): string {
  return `
    <div class="page my-page">
      <div class="page-header">
        <h1>🆕 My New Page</h1>
      </div>
      <section>
        <!-- Page content -->
      </section>
    </div>
  `;
}
```

2. **Register route** in `src/main.ts`:

```typescript
import { renderMyPage } from './pages/mypage';

function registerRoutes(): void {
  // ... existing routes
  
  router.register({
    path: 'mypage',
    title: 'My Page',
    icon: '🆕',
    render: () => renderMyPage(),
  });
}
```

3. **Add to sidebar** in `src/components/sidebar.ts`:

```typescript
const NAV_ITEMS: NavItem[] = [
  // ... existing items
  { route: 'mypage', icon: '🆕', label: 'My Page' },
];
```

4. **Update route type** in `src/router.ts`:

```typescript
export type Route = 'tool' | 'downloads' | ... | 'mypage';
```

---

### Adding Translations

1. **Add keys** to both `src/i18n/translations/en.json` and `vi.json`:

```json
{
  "mypage": {
    "title": "My Page",
    "description": "This is my new page"
  }
}
```

2. **Use in component**:

```typescript
import { t } from '../i18n/i18n';

const title = t('mypage.title'); // Returns translated string
```

---

### Adding a New Device

Edit `public/configs/devices.json`:

```json
{
  "id": "brand-device-name",
  "brand": "oppo",
  "name": "Device Name",
  "codename": "CODENAME",
  "chipset": "SM8650",
  "chipsetName": "Snapdragon 8 Gen 3",
  "status": "beta",
  "authMethod": "oppo_vip",
  "presetId": null,
  "firehose": {
    "programmerUrl": "/firehose/device/programmer.melf",
    "digestUrl": "/firehose/device/digest.elf",
    "signatureUrl": "/firehose/device/signature.bin"
  }
}
```

Then add firehose files to `public/firehose/device/`.

---

### Modifying Styles

All styles are in `src/style.css` using CSS custom properties:

```css
:root {
  /* Colors */
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --text-primary: #c9d1d9;
  --text-secondary: #8b949e;
  --accent-primary: #58a6ff;
  --accent-success: #3fb950;
  --accent-warning: #d29922;
  --accent-error: #f85149;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* Borders */
  --border-radius: 6px;
  --border-color: #30363d;
}
```

---

## TypeScript Conventions

### Type Definitions

All types are centralized in `src/types/index.ts`:

```typescript
// Prefer interfaces for objects
export interface PartitionInfo {
  name: string;
  startSector: bigint;
  endSector: bigint;
  sizeInSectors: bigint;
  sizeFormatted: string;
  lun?: number;
}

// Use enums for fixed values
export enum AppStage {
  IDLE = 0,
  CONNECTING = 1,
  // ...
}
```

### Import Convention

```typescript
// Type-only imports
import type { PartitionInfo } from './types';

// Value imports
import { AppStage } from './types';
```

---

## Working with WebUSB

### Testing Without Hardware

The application requires a real Qualcomm device in EDL mode. For development without hardware:

1. **Mock the WebUSBManager** class
2. **Use recorded protocol traces** for testing

### Driver Installation (Windows)

1. Put device in EDL mode (hold Volume Down + Power while connecting)
2. Run **Zadig** as administrator
3. Select "Qualcomm HS-USB QDLoader 9008"
4. Replace driver with **WinUSB**

---

## Debugging

### Terminal Logs

The application has a built-in terminal that shows all protocol messages:

- **INFO** - General information
- **SUCCESS** - Successful operations
- **WARNING** - Non-fatal issues
- **ERROR** - Failed operations
- **DEBUG** - Detailed protocol data (hidden by default)

Enable DEBUG logs by checking "Show DEBUG logs" checkbox.

### Browser DevTools

```typescript
// Console logging is used throughout
console.log('Q-Flash Universal Qualcomm Tool initialized');
console.error('Router render error:', error);
```

### Protocol Debugging

The `FirehoseProtocol` class logs all XML commands and responses:

```typescript
this.onLog(`TX: ${xmlCommand}`, 'debug');
this.onLog(`RX: ${response}`, 'debug');
```

---

## Common Issues

### "navigator.usb is undefined"

- Ensure you're using Chrome/Edge
- Must be on HTTPS (or localhost)
- WebUSB not available in Firefox/Safari

### "Device not found"

- Install WinUSB driver via Zadig
- Device must be in EDL mode (9008)
- Try different USB cable/port

### "Bulk OUT transfer timeout"

- Device may have session limit
- Disconnect and reconnect device
- Re-run VIP authentication

### TypeScript Errors

```bash
# Check for type errors
npx tsc --noEmit

# Output saved to tsc_output.txt
npm run build 2>&1 | tee tsc_output.txt
```

---

## Building for Production

```bash
# Full build
npm run build

# Output in /dist/
# - index.html
# - assets/*.js
# - assets/*.css
# - configs/
# - firehose/
# - presets/
```

### Deployment

The `/dist/` folder can be deployed to any static hosting:

- **GitHub Pages**
- **Netlify**
- **Vercel**
- **Any HTTP server**

**Important:** Must be served over HTTPS for WebUSB to work.

---

## Contributing

### Code Style

- **Indentation:** 2 spaces
- **Quotes:** Single quotes
- **Semicolons:** Required
- **Trailing commas:** Yes

### Commit Convention

```
feat: Add new device support
fix: Resolve timeout issue on large partitions
docs: Update README
refactor: Simplify protocol handling
```

### Pull Request Process

1. Fork the repository
2. Create feature branch
3. Make changes with clear commits
4. Test with real device if possible
5. Submit PR with description

---

## Contact

- **Author:** Xuan Nguyen
- **Telegram:** https://t.me/mitomtreem
- **Facebook:** https://www.facebook.com/xuannguyen030923
