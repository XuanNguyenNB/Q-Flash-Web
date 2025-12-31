# Bug Fix: Device Not Connected After Sahara

## Vấn đề

Sau khi Sahara handshake hoàn tất, thiết bị chuyển sang chế độ Firehose nhưng gặp lỗi "Device not connected" khi cố gắng configure Firehose protocol.

### Triệu chứng

```
[Sahara] Handshake complete ✅
[USB] Waiting for device to settle...
[USB] Clearing buffer...
[USB] Verifying Firehose mode...
[USB] Device not responding ❌
[ERROR] Device not connected ❌
```

## Root Cause

**Bước `ping()` sau Sahara không ổn định** vì:

1. Sau Sahara, thiết bị đang chuyển mode (Sahara → Firehose)
2. `ping()` cố gắng đọc data từ USB nhưng thiết bị chưa sẵn sàng phản hồi
3. Kết quả không ổn định: đôi khi thành công, đôi khi thất bại
4. VIP authentication tự động kiểm tra kết nối khi gửi digest/signature

## Giải pháp

### 1. Bỏ bước ping() sau Sahara

**File:** `src/hooks/useConnectionFlow.ts`

```typescript
// ❌ TRƯỚC (không ổn định):
await new Promise(resolve => setTimeout(resolve, 5000));
await usbManager.clearBuffer();
const pingResult = await usbManager.ping();  // ← BỎ BƯỚC NÀY
if (!pingResult) {
    const reconnected = await usbManager.reconnect();
    if (!reconnected) throw new Error(...);
}

// ✅ SAU (ổn định):
await new Promise(resolve => setTimeout(resolve, 5000));
try {
    await usbManager.clearBuffer();
} catch (error) {
    log('info', `Buffer clear warning: ${error.message}`);
}
// Chạy thẳng VIP auth hoặc Firehose configure
```

### 2. Cập nhật DeviceProfile Interface

**File:** `src/stores/deviceStore.ts`

Thêm các field cần thiết để hỗ trợ VIP authentication detection:

```typescript
export interface DeviceProfile {
    id: string;
    brand: string;              // ← THÊM MỚI
    name: string;
    codename?: string;          // ← THÊM MỚI
    chipset: string;
    chipsetName?: string;       // ← THÊM MỚI
    chipsetFolder: string;
    authMethod?: 'oppo_vip' | 'none';  // ← THÊM MỚI (QUAN TRỌNG!)
    presetId?: string | null;   // ← THÊM MỚI
    firehoseUrls?: {
        programmer: string;
        digest?: string;
        signature?: string;
    };
    status: 'tested' | 'beta' | 'coming';
}
```

### 3. Tăng timeout cho Firehose response

**File:** `src/core/FirehoseProtocol.ts`

```typescript
// Tăng từ 10 lần × 50ms (500ms) lên 50 lần × 100ms (5 giây)
private async sendCommand(command: string): Promise<FirehoseResponse> {
    const sendResult = await this.usb.transferOut(stringToBytes(command));
    if (!sendResult.success) {
        return { success: false, error: sendResult.error };
    }

    let fullResponse = '';
    const MAX_RETRIES = 50;     // ← Tăng từ 10
    const RETRY_DELAY = 100;    // ← Tăng từ 50ms
    
    for (let i = 0; i < MAX_RETRIES; i++) {
        const result = await this.usb.transferIn(READ_BUFFER_SIZE);
        if (!result.success || !result.data || result.data.length === 0) {
            // Log every 10 retries
            if (i > 0 && i % 10 === 0) {
                this.onLog(`Waiting for response... (${i * RETRY_DELAY}ms)`, 'debug');
            }
            await this.delay(RETRY_DELAY);
            continue;
        }

        fullResponse += bytesToString(result.data);

        if (fullResponse.includes('ACK') || fullResponse.includes('NAK')) {
            break;
        }
    }

    this.onLog(`RX: ${fullResponse}`, 'debug');
    // ...
}
```

### 4. Cải thiện reconnect logic

**File:** `src/core/WebUSBManager.ts`

```typescript
async reconnect(): Promise<boolean> {
    if (!WebUSBManager.isSupported()) return false;

    // Thử tối đa 5 lần với delay 1s giữa mỗi lần
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));

            const devices = await navigator.usb.getDevices();
            const device = devices.find(d => d.vendorId === QUALCOMM_VID && d.productId === EDL_PID);

            if (!device) {
                console.log(`Reconnect attempt ${attempt}/${MAX_RETRIES}: Device not found`);
                continue;
            }

            // Close old handle if exists
            if (this.device && this.device.opened) {
                try {
                    await this.device.close();
                } catch {
                    // Ignore errors
                }
            }

            this.device = device;
            await this.device.open();
            if (this.device.configuration === null) {
                await this.device.selectConfiguration(1);
            }
            await this.findAndClaimInterface();
            this.detectEndpoints();
            
            console.log(`Reconnect successful on attempt ${attempt}`);
            return true;
        } catch (e) {
            console.error(`Reconnect attempt ${attempt}/${MAX_RETRIES} failed:`, e);
            if (attempt === MAX_RETRIES) {
                return false;
            }
        }
    }

    return false;
}
```

### 5. Sửa logic deviceNeedsVIP

**File:** `src/hooks/useConnectionFlow.ts`

```typescript
function deviceNeedsVIP(device: DeviceProfile | null): boolean {
    if (!device) return false;
    
    // Check authMethod (most reliable)
    if (device.authMethod === 'oppo_vip') return true;
    
    // Fallback: check brand
    const oemBrands = ['oppo', 'oneplus', 'realme'];
    if (device.brand && oemBrands.includes(device.brand.toLowerCase())) {
        return true;
    }
    
    // Last fallback: check device name
    return oemBrands.some(brand => 
        device.name.toLowerCase().includes(brand)
    );
}
```

## Luồng hoạt động mới

```
1. USB Connect
   ↓
2. Sahara Handshake
   - Upload programmer (1.5MB)
   - Receive DONE response
   ↓
3. Wait 5 seconds (device mode transition)
   ↓
4. Clear USB buffer (with try-catch)
   ↓
5. VIP Authentication (if authMethod === 'oppo_vip')
   - Send digest (33KB)
   - Send verify command
   - Send signature (4KB)
   - Send SHA256Init
   ↓
6. Firehose Configure
   - Send configure command
   - Wait up to 5 seconds for response
   ↓
7. Read Partition Table (all LUNs)
   ↓
8. Device Ready
```

## Kết quả

### Trước khi sửa (Log8 - Thất bại)
```
[18:13:06] [USB] Verifying Firehose mode...
[18:13:06] [USB] Device not responding, attempting reconnect...
[18:13:11] [ERROR] SAHARA_ERROR: Device not responding after Sahara
```

### Sau khi sửa (Log7, Log9 - Thành công)
```
[18:10:50] [USB] Ready for Firehose protocol
[18:10:50] [VIP] Device: Find X7 Ultra, Brand: oppo, AuthMethod: oppo_vip, NeedsVIP: true
[18:10:50] [VIP] Authenticating with OEM server...
[18:10:52] [VIP] Authentication successful
[18:10:52] [Firehose] Protocol configured, ready for operations
[18:10:56] [Partitions] Found 145 partitions
[18:10:56] [Connection] Device ready for operations
```

## Thiết bị đã test

- ✅ **Oppo Find X7 Ultra** (SM8650) - 145 partitions
- ✅ **OnePlus Ace 5** (SM8650) - 141 partitions

## Ghi chú

- Các thiết bị cùng chipset (ví dụ: SM8650) có thể dùng chung firehose files
- VIP authentication là BẮT BUỘC cho tất cả thiết bị Oppo/OnePlus/Realme
- Không cần ping() sau Sahara vì VIP auth tự động kiểm tra kết nối
- Timeout 5 giây cho Firehose response là đủ cho lần configure đầu tiên

## Tham khảo

- [Log7 - Find X7 Ultra Success](../log7.txt)
- [Log8 - Failed with ping()](../log8.txt)
- [Log9 - OnePlus Ace 5 Success](../log9.txt)
