# Tango ADB - Hướng Dẫn Triển Khai Chi Tiết

## Mục Lục
1. [Giới Thiệu Tango ADB](#giới-thiệu-tango-adb)
2. [Kiến Trúc & Transports](#kiến-trúc--transports)
3. [Cài Đặt & Thiết Lập](#cài-đặt--thiết-lập)
4. [Hướng Dẫn Sử Dụng](#hướng-dẫn-sử-dụng)
5. [Triển Khai View Phone Trên Web](#triển-khai-view-phone-trên-web)
6. [API Chính & Ví Dụ Code](#api-chính--ví-dụ-code)
7. [Xử Lý Lỗi & Tối Ưu Hóa](#xử-lý-lỗi--tối-ưu-hóa)
8. [Tài Nguyên & Liên Kết](#tài-nguyên--liên-kết)

---

## Giới Thiệu Tango ADB

### Tango ADB là gì?

Tango ADB là một **TypeScript re-implementation của Android Debug Bridge (ADB)** client được thiết kế cho các môi trường:
- **Web browsers** (hiện đại với WebUSB API)
- **Node.js**
- **Electron**

Nó cho phép bạn **kết nối trực tiếp với Android devices** từ ứng dụng web, không cần cài đặt Google ADB executable trên máy chủ.

### Ưu Điểm Chính

| Tính Năng | Lợi Ích |
|-----------|---------|
| **TypeScript/JavaScript** | Sử dụng ngôn ngữ quen thuộc, type-safe |
| **Không cần Google ADB** | Kết nối trực tiếp với ADB daemon trên device |
| **WebUSB API Support** | Kết nối USB trực tiếp từ trình duyệt |
| **Wi-Fi/ADB over TCP** | Kết nối không dây từ Node.js/Electron |
| **Fully Programmatic** | API linh hoạt, không cần command-line |
| **Cross-Platform** | Chạy trên các nền tảng khác nhau |

### So Sánh: Traditional ADB vs Tango ADB

```bash
# Traditional ADB (Command-line)
adb pull /sdcard/DCIM/Camera .
adb shell input text "Hello"
adb push file.txt /sdcard/

# Tango ADB (Programmatic)
await adb.sync.read("/sdcard/DCIM/Camera");
await adb.exec("input", ["text", "Hello"]);
await adb.sync.write("file.txt", "/sdcard/");
```

---

## Kiến Trúc & Transports

### Hai Loại Transport Chính

#### 1. **Daemon Transport** (Khuyên Dùng Cho Web)

**Hoạt động:**
- Kết nối **trực tiếp** đến ADB daemon trên Android device
- **Không cần** Google ADB server chạy trên máy
- Sử dụng **WebUSB API** cho Web browsers

**Ưu điểm:**
- ✅ Không cần cài đặt Google ADB
- ✅ Kết nối USB trực tiếp từ browser
- ✅ Độc lập, không cần infrastructure bên ngoài

**Hạn chế:**
- ❌ Web: Chỉ USB, không Wi-Fi
- ❌ Yêu cầu device bật "USB Debugging"

**Hỗ Trợ Platform:**

| Platform | USB | Wi-Fi |
|----------|-----|-------|
| Web | ✅ | ❌ |
| Node.js | ✅ | ✅ |
| Electron | ✅ | ✅ |

#### 2. **Server Transport** (Cho Node.js/Electron)

**Hoạt động:**
- Kết nối đến **Google ADB server** thông qua TCP sockets
- ADB server quản lý kết nối với devices
- Cho Web: Cần "bridge program" để convert TCP → WebSocket

**Ưu điểm:**
- ✅ Hỗ trợ multiple devices
- ✅ Tích hợp với hệ thống ADB hiện tại
- ✅ Wi-Fi/Network connections

**Hạn chế:**
- ❌ Cần cài Google ADB
- ❌ Web cần additional bridge program
- ❌ Phức tạp hơn Daemon Transport

### Chọn Transport Nào?

```
┌─ Đang xây dựng web application?
│  └─ Cần kết nối USB từ browser?
│     ├─ YES → Daemon Transport + WebUSB ✅
│     └─ NO  → Server Transport + Bridge ❌
│
├─ Đang xây dựng Node.js/Electron app?
│  ├─ Cần USB & Wi-Fi? → Daemon Transport ✅
│  ├─ Chỉ cần Wi-Fi?  → Server Transport ✅
│  └─ Có Google ADB?  → Server Transport ✅
```

---

## Cài Đặt & Thiết Lập

### Bước 1: Cài Đặt Dependencies

#### Core Packages (Bắt Buộc)

```bash
# npm
npm install @yume-chan/adb @yume-chan/stream-extra

# yarn
yarn add @yume-chan/adb @yume-chan/stream-extra

# pnpm
pnpm add @yume-chan/adb @yume-chan/stream-extra

# bun
bun add @yume-chan/adb @yume-chan/stream-extra
```

#### Additional Packages (Tùy Theo Nhu Cầu)

```bash
# Cho Web + WebUSB (Daemon Transport)
npm install @yume-chan/adb-usb

# Cho Node.js (Server Transport hoặc Daemon Transport Wi-Fi)
npm install @yume-chan/adb-socket

# Cho Electron
npm install @yume-chan/adb-usb @yume-chan/adb-socket

# Utilities (Optional)
npm install @yume-chan/adb-credential-web
```

### Bước 2: Cấu Hình TypeScript (Nếu Dùng)

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Bước 3: Kiểm Tra Prerequisites

#### Cho Web:
- ✅ Trình duyệt hỗ trợ **WebUSB** (Chrome, Edge, Opera)
- ✅ Device bật **USB Debugging** (Developer Options)
- ✅ Cập nhật ADB daemon trên device

#### Cho Node.js:
- ✅ Google ADB installed: `adb version`
- ✅ ADB server đang chạy: `adb devices`
- ✅ Device connected & authorized

---

## Hướng Dẫn Sử Dụng

### 1. Khởi Tạo ADB Client

#### Web (Daemon Transport + WebUSB)

```typescript
import Adb from "@yume-chan/adb";
import { AdbWebUsb } from "@yume-chan/adb-usb";

// Bước 1: Yêu cầu người dùng chọn device
const device = await AdbWebUsb.requestDevice();

// Bước 2: Khởi tạo transport
const transport = await AdbWebUsb.connect(device);

// Bước 3: Khởi tạo ADB client
const adb = new Adb(transport);

// Bước 4: Kết nối
await adb.connect();

console.log("✅ Connected to device:", adb.device);
```

#### Node.js (Server Transport)

```typescript
import Adb from "@yume-chan/adb";
import { AdbSocket } from "@yume-chan/adb-socket";

// Bước 1: Tạo transport đến ADB server
const socket = new AdbSocket("127.0.0.1", 5037);

// Bước 2: Khởi tạo ADB client
const adb = new Adb(socket);

// Bước 3: Kết nối
await adb.connect();

console.log("✅ Connected!");
```

#### Node.js (Daemon Transport - Wi-Fi)

```typescript
import Adb from "@yume-chan/adb";
import { AdbSocket } from "@yume-chan/adb-socket";

// Kết nối trực tiếp đến device qua Wi-Fi
const socket = new AdbSocket("192.168.1.100", 5555);
const adb = new Adb(socket);
await adb.connect();

console.log("✅ Connected via Wi-Fi!");
```

### 2. Thực Hiện Shell Commands

#### Lấy Thông Tin Device

```typescript
// Lấy model
const model = await adb.exec("getprop", ["ro.product.model"]);
console.log("Model:", model.stdout);

// Lấy Android version
const version = await adb.exec("getprop", ["ro.build.version.release"]);
console.log("Android Version:", version.stdout);

// Lấy serial number
const serial = await adb.exec("getprop", ["ro.serialno"]);
console.log("Serial:", serial.stdout);
```

#### Input & Control

```typescript
// Gõ text
await adb.exec("input", ["text", "Hello World"]);

// Click screen
await adb.exec("input", ["tap", "500", "1000"]);

// Kéo screen
await adb.exec("input", ["swipe", "100", "100", "500", "500", "500"]);

// Nhấn nút (back, home, recent, volume, power)
await adb.exec("input", ["keyevent", "KEYCODE_HOME"]);
await adb.exec("input", ["keyevent", "KEYCODE_BACK"]);
await adb.exec("input", ["keyevent", "KEYCODE_POWER"]);
```

### 3. File Transfer (Sync Protocol)

#### Pull Files (Device → Local)

```typescript
// Pull single file
const file = await adb.sync.read("/sdcard/sample.txt");
const text = new TextDecoder().decode(file);
console.log("File content:", text);

// Pull directory (phải duyệt đệ quy)
async function pullDirectory(adb: Adb, source: string, destination: string) {
  const entries = await adb.sync.list(source);
  
  for (const entry of entries) {
    if (entry.isDirectory) {
      await pullDirectory(adb, `${source}/${entry.name}`, `${destination}/${entry.name}`);
    } else {
      const content = await adb.sync.read(`${source}/${entry.name}`);
      // Lưu file...
    }
  }
}

await pullDirectory(adb, "/sdcard/DCIM/Camera", "./photos");
```

#### Push Files (Local → Device)

```typescript
// Push file đơn giản
const fileContent = new TextEncoder().encode("Hello Android!");
await adb.sync.write("/sdcard/test.txt", fileContent);

// Push file với thông tin meta
const mode = 0o644; // Quyền file (optional)
await adb.sync.write("/sdcard/test.txt", fileContent, {
  mode: mode,
  mtime: Date.now(),
});
```

### 4. Package & App Management

```typescript
// Liệt kê packages
const packages = await adb.exec("pm", ["list", "packages"]);
console.log(packages.stdout);

// Kiểm tra app đã cài hay chưa
const installed = await adb.exec("pm", ["list", "packages", "|", "grep", "com.example"]);

// Install APK
await adb.sync.write("/data/local/tmp/app.apk", apkBuffer);
await adb.exec("pm", ["install", "/data/local/tmp/app.apk"]);

// Uninstall app
await adb.exec("pm", ["uninstall", "com.example.app"]);

// Clear app data
await adb.exec("pm", ["clear", "com.example.app"]);
```

### 5. Screen & Display Control

```typescript
// Lấy kích thước màn hình
const size = await adb.exec("wm", ["size"]);
console.log(size.stdout); // "Physical size: 1080x1920"

// Lấy density
const density = await adb.exec("wm", ["density"]);
console.log(density.stdout); // "Physical density: 420"

// Screen brightness
await adb.exec("settings", ["put", "system", "screen_brightness", "128"]);

// Screen timeout
await adb.exec("settings", ["put", "system", "screen_off_timeout", "60000"]);
```

---

## Triển Khai View Phone Trên Web

### Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────┐
│      Web Browser Application         │
│  ┌──────────────────────────────┐   │
│  │   React/Vue Component        │   │
│  │  - Device List              │   │
│  │  - Screen Mirror            │   │
│  │  - Control Panel            │   │
│  └──────────────────────────────┘   │
│          ↓        ↓        ↓         │
│  ┌──────────────────────────────┐   │
│  │   Tango ADB Client           │   │
│  │  - WebUSB Transport          │   │
│  │  - Command Execution         │   │
│  │  - Event Handling            │   │
│  └──────────────────────────────┘   │
└──────────────────────┬───────────────┘
                       ↓
         ┌─────────────────────────────┐
         │   Android Device (USB)      │
         │  - ADB Daemon              │
         │  - Screen Content          │
         │  - Input Handler           │
         └─────────────────────────────┘
```

### Ví Dụ: React Component (Screen Mirror)

#### 1. Device Connection Component

```typescript
// DeviceSelector.tsx
import React, { useState } from 'react';
import Adb from '@yume-chan/adb';
import { AdbWebUsb } from '@yume-chan/adb-usb';

interface Props {
  onConnect: (adb: Adb) => void;
}

export const DeviceSelector: React.FC<Props> = ({ onConnect }) => {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      // Yêu cầu người dùng chọn device
      const device = await AdbWebUsb.requestDevice();
      
      // Kết nối
      const transport = await AdbWebUsb.connect(device);
      const adb = new Adb(transport);
      await adb.connect();

      console.log('✅ Kết nối thành công:', adb.device);
      onConnect(adb);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Kết nối thất bại';
      setError(errorMsg);
      console.error('❌ Connection error:', err);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="device-selector">
      <button 
        onClick={handleConnect}
        disabled={connecting}
        className="btn-primary"
      >
        {connecting ? 'Đang kết nối...' : 'Chọn Device'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
};
```

#### 2. Device Info Display

```typescript
// DeviceInfo.tsx
import React, { useEffect, useState } from 'react';
import Adb from '@yume-chan/adb';

interface DeviceInfo {
  model: string;
  version: string;
  serial: string;
  screenSize: string;
  screenDensity: string;
}

interface Props {
  adb: Adb;
}

export const DeviceInfo: React.FC<Props> = ({ adb }) => {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const [model, version, serial, screenSize, screenDensity] = await Promise.all([
          adb.exec("getprop", ["ro.product.model"]).then(r => r.stdout.trim()),
          adb.exec("getprop", ["ro.build.version.release"]).then(r => r.stdout.trim()),
          adb.exec("getprop", ["ro.serialno"]).then(r => r.stdout.trim()),
          adb.exec("wm", ["size"]).then(r => r.stdout.trim()),
          adb.exec("wm", ["density"]).then(r => r.stdout.trim()),
        ]);

        setInfo({
          model,
          version,
          serial,
          screenSize,
          screenDensity,
        });
      } catch (err) {
        console.error('❌ Lỗi lấy thông tin device:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [adb]);

  if (loading) return <div>Đang tải...</div>;
  if (!info) return <div>Không thể lấy thông tin</div>;

  return (
    <div className="device-info">
      <h2>Thông Tin Device</h2>
      <div className="info-grid">
        <div className="info-item">
          <label>Model:</label>
          <span>{info.model}</span>
        </div>
        <div className="info-item">
          <label>Android Version:</label>
          <span>{info.version}</span>
        </div>
        <div className="info-item">
          <label>Serial:</label>
          <span>{info.serial}</span>
        </div>
        <div className="info-item">
          <label>Screen Size:</label>
          <span>{info.screenSize}</span>
        </div>
        <div className="info-item">
          <label>Screen Density:</label>
          <span>{info.screenDensity}</span>
        </div>
      </div>
    </div>
  );
};
```

#### 3. Control Panel

```typescript
// ControlPanel.tsx
import React from 'react';
import Adb from '@yume-chan/adb';

interface Props {
  adb: Adb;
}

export const ControlPanel: React.FC<Props> = ({ adb }) => {
  const handleInput = async (command: string, args: string[]) => {
    try {
      await adb.exec(command, args);
      console.log(`✅ ${command} ${args.join(' ')}`);
    } catch (err) {
      console.error(`❌ Command failed:`, err);
    }
  };

  return (
    <div className="control-panel">
      <h2>Điều Khiển Device</h2>
      
      <div className="control-section">
        <h3>Navigation</h3>
        <button onClick={() => handleInput("input", ["keyevent", "KEYCODE_HOME"])}>
          🏠 Home
        </button>
        <button onClick={() => handleInput("input", ["keyevent", "KEYCODE_BACK"])}>
          ← Back
        </button>
        <button onClick={() => handleInput("input", ["keyevent", "KEYCODE_APP_SWITCH"])}>
          📋 Recent Apps
        </button>
      </div>

      <div className="control-section">
        <h3>Power</h3>
        <button onClick={() => handleInput("input", ["keyevent", "KEYCODE_POWER"])}>
          ⚡ Power
        </button>
        <button onClick={() => handleInput("reboot", [])}>
          🔄 Reboot
        </button>
      </div>

      <div className="control-section">
        <h3>Volume</h3>
        <button onClick={() => handleInput("input", ["keyevent", "KEYCODE_VOLUME_UP"])}>
          🔊 Volume +
        </button>
        <button onClick={() => handleInput("input", ["keyevent", "KEYCODE_VOLUME_DOWN"])}>
          🔉 Volume -
        </button>
      </div>

      <div className="control-section">
        <h3>Text Input</h3>
        <input 
          type="text" 
          placeholder="Nhập text..."
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              const text = (e.target as HTMLInputElement).value;
              handleInput("input", ["text", text]);
              (e.target as HTMLInputElement).value = '';
            }
          }}
        />
      </div>
    </div>
  );
};
```

#### 4. Main App Component

```typescript
// App.tsx
import React, { useState } from 'react';
import Adb from '@yume-chan/adb';
import { DeviceSelector } from './components/DeviceSelector';
import { DeviceInfo } from './components/DeviceInfo';
import { ControlPanel } from './components/ControlPanel';
import './App.css';

export const App: React.FC = () => {
  const [adb, setAdb] = useState<Adb | null>(null);

  const handleDisconnect = async () => {
    if (adb) {
      try {
        await adb.close();
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
      setAdb(null);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📱 Tango ADB - Phone View & Control</h1>
      </header>

      <main className="app-main">
        {!adb ? (
          <DeviceSelector onConnect={setAdb} />
        ) : (
          <div className="connected-view">
            <button onClick={handleDisconnect} className="btn-disconnect">
              🔌 Ngắt Kết Nối
            </button>

            <div className="content-grid">
              <div className="panel">
                <DeviceInfo adb={adb} />
              </div>
              <div className="panel">
                <ControlPanel adb={adb} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
```

#### 5. CSS Styling

```css
/* App.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
}

.app-header {
  text-align: center;
  color: white;
  margin-bottom: 40px;
}

.app-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.app-main {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.device-selector {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.btn-primary {
  padding: 15px 40px;
  font-size: 18px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.connected-view {
  position: relative;
}

.btn-disconnect {
  position: absolute;
  top: 0;
  right: 0;
  padding: 10px 20px;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.btn-disconnect:hover {
  background: #ff5252;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

.panel {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #e9ecef;
}

.device-info h2,
.control-panel h2 {
  color: #333;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.info-item {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.info-item label {
  color: #666;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 5px;
}

.info-item span {
  color: #333;
  font-size: 1rem;
  word-break: break-all;
}

.control-section {
  margin-bottom: 20px;
}

.control-section h3 {
  color: #666;
  font-size: 0.95rem;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.control-section button {
  display: block;
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  background: white;
  color: #333;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: all 0.2s;
}

.control-section button:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.control-section input {
  display: block;
  width: 100%;
  padding: 12px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 1rem;
  margin-bottom: 8px;
}

.control-section input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.error {
  color: #ff6b6b;
  padding: 15px;
  background: #ffe0e0;
  border-radius: 6px;
  margin-top: 15px;
  border-left: 4px solid #ff6b6b;
}
```

---

## API Chính & Ví Dụ Code

### Adb Class - Core Methods

```typescript
// Kết nối device
await adb.connect(): Promise<void>

// Ngắt kết nối
await adb.close(): Promise<void>

// Thực hiện shell command
await adb.exec(command: string, args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>

// Lấy thông tin device
adb.device: AdbDevice
adb.socket: AdbTransport
adb.sync: AdbSync // Giao thức đồng bộ file

// Shell stream (cho long-running commands)
const stream = await adb.shell(command: string): Promise<AdbCommandResult>
```

### File Sync Methods

```typescript
// Đọc file từ device
await adb.sync.read(path: string, progress?: (current, total) => void): Promise<Uint8Array>

// Ghi file vào device
await adb.sync.write(
  path: string, 
  data: Uint8Array, 
  options?: { mode: number, mtime: number }
): Promise<void>

// Liệt kê thư mục
await adb.sync.list(path: string): Promise<AdbSyncEntry[]>

// Xóa file
await adb.sync.stat(path: string): Promise<AdbSyncStat>

// Lấy kích thước file
await adb.sync.lstat(path: string): Promise<AdbSyncStat>
```

### Useful Shell Commands

```typescript
// Device Info
await adb.exec("getprop", ["ro.product.model"])
await adb.exec("getprop", ["ro.build.version.release"])
await adb.exec("getprop", ["ro.serialno"])
await adb.exec("getprop", ["ro.build.fingerprint"])

// Screen
await adb.exec("wm", ["size"])
await adb.exec("wm", ["density"])

// Battery
await adb.exec("dumpsys", ["battery"])

// Memory
await adb.exec("dumpsys", ["meminfo"])

// Processes
await adb.exec("ps", ["aux"])

// Network
await adb.exec("ifconfig")
await adb.exec("ip", ["addr"])

// Installed packages
await adb.exec("pm", ["list", "packages"])

// Screenshot (save to /sdcard/screen.png)
await adb.exec("screencap", ["-p", "/sdcard/screen.png"])

// Record screen
await adb.exec("screenrecord", ["--time-limit", "10", "/sdcard/record.mp4"])
```

### Advanced: Screenshot & Video Streaming

```typescript
// Pull screenshot
async function takeScreenshot(adb: Adb): Promise<Blob> {
  // Lấy screenshot
  await adb.exec("screencap", ["-p", "/sdcard/screen.png"]);
  
  // Pull file
  const data = await adb.sync.read("/sdcard/screen.png");
  
  // Tạo Blob
  return new Blob([data], { type: "image/png" });
}

// Display screenshot
const blob = await takeScreenshot(adb);
const url = URL.createObjectURL(blob);
const img = document.querySelector('img') as HTMLImageElement;
img.src = url;

// Screen mirroring loop (với interval)
async function startScreenMirroring(
  adb: Adb,
  element: HTMLImageElement,
  interval: number = 500
) {
  const screenshot = async () => {
    try {
      const blob = await takeScreenshot(adb);
      element.src = URL.createObjectURL(blob);
    } catch (err) {
      console.error('Screenshot failed:', err);
    }
  };

  // Initial screenshot
  await screenshot();

  // Periodic updates
  return setInterval(screenshot, interval);
}
```

---

## Xử Lý Lỗi & Tối Ưu Hóa

### Common Errors & Solutions

#### 1. "No compatible USB devices found"

```typescript
// Nguyên nhân: Browser không hỗ trợ WebUSB hoặc device chưa được phép

// Kiểm tra hỗ trợ
if (!navigator.usb) {
  console.error("WebUSB not supported");
  // Hướng dẫn user dùng Chrome/Edge
}

// Đảm bảo USB Debugging bật
// Settings → Developer Options → USB Debugging → ON
```

#### 2. "Device offline"

```typescript
// Lý do: Device bị ngắt USB, ADB daemon crash, timeout

// Kiểm tra connection
try {
  await adb.connect();
} catch (err) {
  if (err.message.includes('offline')) {
    // Device offline, cần reconnect USB
    console.error("Device offline, reconnect USB");
  }
}

// Timeout handling
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error("Timeout")), 10000)
);

try {
  await Promise.race([adb.exec("getprop", ["ro.serialno"]), timeoutPromise]);
} catch (err) {
  console.error("Command timed out");
}
```

#### 3. "Permission denied" / "Read-only file system"

```typescript
// Lý do: Không có quyền truy cập /sdcard hoặc system partition

// Kiểm tra quyền
const result = await adb.exec("ls", ["-ld", "/sdcard"]);

// Dùng /sdcard/Android/data thay vì /sdcard root
await adb.sync.write("/sdcard/Android/data/file.txt", data);

// Hoặc /data/local/tmp (thường có quyền ghi)
await adb.sync.write("/data/local/tmp/file.txt", data);
```

#### 4. "Command not found"

```typescript
// Lý do: Command không available trên device

// Kiểm tra thử trước
try {
  await adb.exec("which", ["screencap"]);
} catch {
  console.log("screencap not available on this device");
}

// Thay thế bằng alternatives
const result = await adb.exec("pm", ["list", "packages"]);
```

### Best Practices

#### 1. Connection Pool

```typescript
class AdbConnectionPool {
  private connections = new Map<string, Adb>();

  async getConnection(deviceId: string): Promise<Adb> {
    if (this.connections.has(deviceId)) {
      return this.connections.get(deviceId)!;
    }

    const adb = new Adb(transport);
    await adb.connect();
    this.connections.set(deviceId, adb);

    return adb;
  }

  async closeConnection(deviceId: string) {
    const adb = this.connections.get(deviceId);
    if (adb) {
      await adb.close();
      this.connections.delete(deviceId);
    }
  }

  async closeAll() {
    for (const [, adb] of this.connections) {
      await adb.close();
    }
    this.connections.clear();
  }
}
```

#### 2. Retry Logic

```typescript
async function executeWithRetry(
  fn: () => Promise<any>,
  maxAttempts: number = 3,
  delayMs: number = 1000
) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxAttempts - 1) throw err;
      console.warn(`Attempt ${i + 1} failed, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Usage
const result = await executeWithRetry(
  () => adb.exec("dumpsys", ["battery"]),
  3,
  500
);
```

#### 3. Progress Tracking

```typescript
// Screenshot with progress
async function takeScreenshotWithProgress(
  adb: Adb,
  onProgress?: (percent: number) => void
) {
  onProgress?.(10); // Starting

  // Capture
  await adb.exec("screencap", ["-p", "/sdcard/screen.png"]);
  onProgress?.(50);

  // Pull
  const data = await adb.sync.read("/sdcard/screen.png", (current, total) => {
    const percent = 50 + (current / total) * 50;
    onProgress?.(Math.round(percent));
  });

  onProgress?.(100);
  return new Blob([data], { type: "image/png" });
}
```

#### 4. Caching & Memoization

```typescript
class DeviceInfoCache {
  private cache = new Map<string, any>();
  private ttl = new Map<string, number>();

  constructor(private adb: Adb, private cacheDurationMs = 60000) {}

  async getProperty(key: string): Promise<string> {
    // Kiểm tra cache
    if (this.cache.has(key)) {
      const expiry = this.ttl.get(key);
      if (expiry && Date.now() < expiry) {
        return this.cache.get(key);
      }
      this.cache.delete(key);
      this.ttl.delete(key);
    }

    // Fetch from device
    const result = await this.adb.exec("getprop", [key]);
    const value = result.stdout.trim();

    // Cache result
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + this.cacheDurationMs);

    return value;
  }

  clear() {
    this.cache.clear();
    this.ttl.clear();
  }
}
```

### Performance Optimization

```typescript
// 1. Parallel operations
const [model, version, serial] = await Promise.all([
  adb.exec("getprop", ["ro.product.model"]),
  adb.exec("getprop", ["ro.build.version.release"]),
  adb.exec("getprop", ["ro.serialno"]),
]);

// 2. Batch commands
await adb.shell("getprop ro.product.model && getprop ro.build.version.release");

// 3. Stream large files
const file = await adb.sync.read("/sdcard/large_file.bin", (current, total) => {
  console.log(`Downloaded ${(current/total*100).toFixed(1)}%`);
});

// 4. Reuse connections
const adb = await establishConnection(); // Establish once
for (let i = 0; i < 100; i++) {
  await adb.exec("getprop", ["ro.product.model"]); // Reuse
}
await adb.close();
```

---

## Tài Nguyên & Liên Kết

### Tài Liệu Chính

- **Tango ADB Official**: https://tangoadb.dev/
- **GitHub Repository**: https://github.com/yume-chan/adb-ts
- **npm Packages**:
  - [@yume-chan/adb](https://www.npmjs.com/package/@yume-chan/adb)
  - [@yume-chan/adb-usb](https://www.npmjs.com/package/@yume-chan/adb-usb)
  - [@yume-chan/adb-socket](https://www.npmjs.com/package/@yume-chan/adb-socket)

### Liên Quan

- **WebUSB Specification**: https://wicg.github.io/webusb/
- **Android ADB Documentation**: https://developer.android.com/studio/command-line/adb
- **Tango Web App**: https://app.tangoapp.dev/

### Learning Resources

```markdown
## Bước Tiếp Theo

1. **Cài đặt & Test**: 
   - Cài npm packages
   - Kết nối device lần đầu
   - Test các commands cơ bản

2. **Xây dựng Component**:
   - Device selector
   - Info display
   - Control panel

3. **Advanced Features**:
   - Screen mirroring
   - File transfer
   - App management
   - Custom shells

4. **Optimization**:
   - Connection pooling
   - Caching
   - Error handling
   - Performance tuning

5. **Deployment**:
   - CORS configuration
   - Security considerations
   - Browser compatibility
   - Production setup
```

### Troubleshooting Checklist

- [ ] WebUSB supported trên browser?
- [ ] USB Debugging enabled trên device?
- [ ] Device authorized for debugging? (Check dialog)
- [ ] Device connected & recognized? (`adb devices`)
- [ ] ADB daemon running? (Check with `adb shell`)
- [ ] Correct transport được sử dụng?
- [ ] Permissions đúng cho file operations?

---

## Kết Luận

Tango ADB cung cấp một cách hiện đại, TypeScript-first để tương tác với Android devices từ Web. Với WebUSB API, bạn có thể xây dựng các ứng dụng web mạnh mẽ để:

✅ Control Android devices từ browser  
✅ Mirror screen & input  
✅ Transfer files  
✅ Manage apps & settings  
✅ Automate tasks  

**Bắt đầu ngay hôm nay và khám phá khả năng vô hạn! 🚀**
