# Scrcpy Screen Mirror - Rebuild Implementation Plan

**Created:** 2025-12-30  
**Story:** 7.6 - ADB Scrcpy Integration  
**Objective:** Làm lại tính năng Screen Mirror từ đầu với chiến lược đơn giản, ổn định

---

## 📋 Tổng Quan Vấn Đền

### Vấn Đề Hiện Tại
- **White screen issue**: Video không hiển thị hoặc chỉ thấy màn hình trắng
- **Code phức tạp**: 527 dòng với nhiều edge cases
- **Decoder issues**: Logic fallback phức tạp giữa WebCodecs và TinyH264
- **Control bugs**: Touch/mouse mapping không chính xác

### Root Causes
1. **Codec negotiation problems**: Không stable giữa H.264 và H.265
2. **Frame rendering pipeline**: Canvas drawing không sync với decoder output
3. **Server setup failures**: scrcpy-server.jar push/execute issues
4. **Touch coordinates**: Scaling calculation không đúng

---

## 🎯 Chiến Lược Mới: KISS Principle

### Phase 1: Minimal Viable Implementation (MVP)
**Timeline**: 2-3 giờ  
**Goal**: Có màn hình hiển thị được, không cần fancy features

#### Approach
1. **Chỉ dùng H.264** (bỏ H.265 support tạm thời)
2. **WebCodecs only** (bỏ TinyH264 fallback ban đầu)
3. **Fixed resolution**: 720p (không Native hoặc custom)
4. **Basic touch**: Chỉ tap, không swipe/gesture phức tạp
5. **No audio**: Bỏ audio stream

#### Technical Stack
```typescript
// Core dependencies
@yume-chan/adb                    // ADB connection
@yume-chan/adb-scrcpy            // Scrcpy client
@yume-chan/scrcpy-decoder-webcodecs  // Video decoder
@yume-chan/stream-extra          // Stream handling
```

---

## 🔧 Implementation Steps

### Step 1: Clean Slate Setup (30 phút)

**Files to modify:**
- `src/components/features/adb/ScrcpyPanel.tsx` - Simplify drastically
- `public/scrcpy-server.jar` - Ensure correct version (đã có)

**Actions:**
1. ✅ Backup current ScrcpyPanel.tsx
2. ✅ Create new simplified version
3. ✅ Remove all experimental features
4. ✅ Keep only essential state

**Simplified State:**
```typescript
const [isStreaming, setIsStreaming] = useState(false);
const [error, setError] = useState<string | null>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
const clientRef = useRef<AdbScrcpyClient | null>(null);
const decoderRef = useRef<any>(null);
```

---

### Step 2: Server Push Logic (30 phút)

**Critical Requirements:**
- Fetch scrcpy-server.jar from `/public`
- Push to `/data/local/tmp/scrcpy-server.jar`
- Verify file exists before starting

**Simplified Code:**
```typescript
const serverPath = '/data/local/tmp/scrcpy-server.jar';

// Fetch binary
const response = await fetch('/scrcpy-server.jar');
const arrayBuffer = await response.arrayBuffer();

// Create stream
const stream = new PushReadableStream(async (controller) => {
  await controller.enqueue(new Uint8Array(arrayBuffer));
  controller.close();
});

// Push to device
await AdbScrcpyClient.pushServer(
  adb.adbInstance,
  stream,
  serverPath
);
```

**Verification:**
- Log size of pushed file
- Optional: shell `ls -l /data/local/tmp/scrcpy-server.jar`

---

### Step 3: Options Configuration (SIMPLE) (15 phút)

**Fixed Safe Config:**
```typescript
const options = new AdbScrcpyOptionsLatest({
  // Video
  video: true,
  audio: false,  // Disabled for simplicity
  
  // Quality (CONSERVATIVE)
  maxSize: 720,           // Safe resolution
  videoBitRate: 2_000_000, // 2 Mbps - not too high
  maxFps: 30,             // Lower FPS = more stable
  
  // Codec
  videoCodec: 'h264',     // Only H.264
  
  // Control
  control: true,
  sendDeviceMeta: false,  // Disable for simplicity
  sendDummyByte: true,
  tunnelForward: false,
});
```

**Why these values?**
- **720p**: Best balance between quality and performance
- **2 Mbps**: Won't overwhelm WebUSB bandwidth
- **30 FPS**: Smooth enough, stable
- **H.264**: Universal support, no compatibility issues

---

### Step 4: Client Start & Video Stream (45 phút)

**Critical Points:**
1. Await client.videoStream
2. Get metadata (codec, size)
3. Setup decoder
4. Pipe stream to decoder

**Simplified Flow:**
```typescript
// 1. Start client
const client = await AdbScrcpyClient.start(
  adb.adbInstance,
  serverPath,
  options
);

clientRef.current = client;

// 2. Wait for video stream
const videoPacket = await client.videoStream;
const { metadata, stream } = videoPacket;

log('info', `Video: ${metadata.width}x${metadata.height}`);

// 3. Setup decoder
const decoder = new WebCodecsVideoDecoder({
  codec: 'avc1.42E01E',  // H.264 Baseline
  renderer: (frame: VideoFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Resize canvas if needed
    if (canvas.width !== frame.displayWidth) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }
    
    // Draw frame
    ctx.drawImage(frame, 0, 0);
    frame.close();
  }
});

// 4. Pipe
await stream.pipeTo(decoder.writable);
```

---

### Step 5: Canvas Rendering (30 phút)

**HTML Structure:**
```tsx
<div className="relative w-full h-full bg-black">
  <canvas
    ref={canvasRef}
    className="max-w-full max-h-full object-contain"
    onMouseDown={handleTouch}
  />
</div>
```

**Renderer Logic:**
```typescript
const renderer = {
  draw(frame: VideoFrame) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    
    if (!canvas || !ctx) {
      frame.close();
      return;
    }
    
    // Auto-resize canvas
    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }
    
    // Draw
    ctx.drawImage(frame, 0, 0);
    frame.close();
  }
};
```

**Canvas Context Options:**
- `alpha: false` - Performance boost
- No `desynchronized` initially (can add later if needed)

---

### Step 6: Basic Touch Control (30 phút)

**Only TAP for MVP:**
```typescript
const handleTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
  if (!clientRef.current || !clientRef.current.controller) return;
  
  const canvas = e.currentTarget;
  const rect = canvas.getBoundingClientRect();
  
  // Calculate device coordinates
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  
  // Send tap
  clientRef.current.controller.injectTouch({
    action: 0,  // AMOTION_EVENT_ACTION_DOWN
    pointerId: 0n,
    pointerX: x,
    pointerY: y,
    screenWidth: canvas.width,
    screenHeight: canvas.height,
    pressure: 1,
    actionButton: 0,
    buttons: 1
  });
  
  // Release
  setTimeout(() => {
    clientRef.current!.controller!.injectTouch({
      action: 1, // AMOTION_EVENT_ACTION_UP
      pointerId: 0n,
      pointerX: x,
      pointerY: y,
      screenWidth: canvas.width,
      screenHeight: canvas.height,
      pressure: 0,
      actionButton: 0,
      buttons: 0
    });
  }, 50);
};
```

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Server push thành công (check terminal log)
- [ ] Client start không lỗi
- [ ] Video stream xuất hiện
- [ ] Canvas hiển thị video (không white screen)
- [ ] FPS ổn định (~30 FPS)
- [ ] Tap hoạt động đúng vị trí

### Debugging Steps
1. **If white screen:**
   - Check browser console for WebCodecs errors
   - Verify canvas context is created
   - Log frame count in renderer
   - Check `pipeTo` resolves

2. **If black screen:**
   - Device might not support scrcpy
   - Check scrcpy server log output
   - Try manual `adb shell app_process` with scrcpy

3. **If tap not working:**
   - Log calculated coordinates
   - Verify controller exists
   - Check touch event args format

---

## 📦 Phase 2: Enhancements (Optional, Later)

### After MVP works:
1. **Add TinyH264 fallback** (if WebCodecs fails)
2. **Resolution selector** (480p / 720p / 1080p / Native)
3. **FPS customization**
4. **H.265 support** (if device supports)
5. **Swipe/scroll gestures**
6. **Keyboard input**
7. **Bitrate selector**
8. **Audio support**
9. **Recording feature**

---

## 🚨 Known Issues & Solutions

### Issue 1: scrcpy-server version mismatch
**Solution:** Use scrcpy-server.jar v2.0+ (compatible with @yume-chan/adb-scrcpy latest)

### Issue 2: WebCodecs not supported
**Solution:** Show error message, recommend Chrome/Edge

### Issue 3: Device screen rotation
**Solution:** Handle rotation via metadata change events

### Issue 4: Performance lag
**Solution:** 
- Lower FPS to 15-20
- Reduce bitrate to 1 Mbps
- Use 480p resolution

---

## 💡 Key Learnings

### Do's
✅ Start simple, add complexity later  
✅ Use fixed configs before adding customization  
✅ Log everything during development  
✅ Test on real device, not emulator  
✅ Handle cleanup properly (`clientRef.current?.close()`)

### Don'ts
❌ Don't enable all codecs at once  
❌ Don't try Native resolution first  
❌ Don't implement gestures before tap works  
❌ Don't skip server push verification  
❌ Don't ignore stream errors

---

## 📚 Reference Links

- Scrcpy Protocol: https://github.com/Genymobile/scrcpy/blob/master/doc/protocol.md
- @yume-chan/adb-scrcpy: https://github.com/yume-chan/ya-webadb
- WebCodecs API: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API

---

## ✅ Success Criteria

**MVP Complete when:**
1. Click "Start" button
2. Video appears within 5 seconds
3. No white/black screen
4. Can tap on screen and device responds
5. Stop button works and cleans up properly

**Estimate: 3 giờ coding + 1 giờ debugging = 4 giờ total**

---

## Next Actions

1. [ ] Backup current ScrcpyPanel.tsx
2. [ ] Implement Step 1-6 theo plan
3. [ ] Test với device thật
4. [ ] Document issues gặp phải
5. [ ] Nếu MVP works → Update sprint-status.yaml → mark `done`
6. [ ] Nếu MVP works → Consider Phase 2 features

---

**Author:** Dev Agent  
**Review Status:** Pending  
**Implementation Status:** Ready to Start
