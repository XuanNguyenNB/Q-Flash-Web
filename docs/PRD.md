# Q-Flash-Web - Product Requirements Document (PRD)

> **Version:** 1.0  
> **Date:** 2025-12-29  
> **Author:** John (PM Agent) with Nguyen  
> **Status:** Draft → Review  
> **Project Type:** Brownfield Web Application Enhancement

---

## 📋 Executive Summary

### Product Vision

**Q-Flash-Web** is a browser-based Universal Qualcomm Flash Tool that enables users to flash firmware, backup partitions, and perform recovery operations on Qualcomm-based devices (Oppo, OnePlus, Realme) directly from their web browser using the WebUSB API.

### The Magic ✨

> **"Flash Qualcomm devices directly in your browser - no installation required!"**

Users can unbrick, customize partitions, and flash ROM with just a browser - fast, convenient, and without installing complex native software.

### Target Users

| User Segment | Needs | Usage Pattern |
|--------------|-------|---------------|
| **Phone Repair Technicians** | Fast, reliable tool without software dependencies | Daily, multiple devices |
| **Advanced Users** | Self-unbrick/flash ROM without learning complex tools | Occasional, personal devices |
| **ROM Developers** | Quick firmware testing across devices | Frequent, development cycle |

---

## 🎯 Success Criteria

### Core Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **First-Time Success Rate** | >80% complete flash successfully | Analytics + user feedback |
| **Daily Active Users** | 100+ DAU within 3 months | Google Analytics |
| **Device Coverage** | 13 chipset families (40+ devices) | devices.json entries |
| **Support Reduction** | <10 usage questions/week | Telegram/Facebook messages |
| **Page Load Time** | <3 seconds on 4G | Lighthouse score |

### Business Metrics (Future)

| Metric | Target | Timeline |
|--------|--------|----------|
| **Donation Conversion** | 1-2% of users | Ongoing |
| **Ad Revenue** | $50-100/month | Growth phase |
| **Affiliate Clicks** | Track Q-FLASH-FORGE downloads | Growth phase |

---

## 📦 Scope Definition

### Phase 1: MVP+ (Immediate Priority)

**Goal:** Make the web tool fully functional with proper onboarding and expanded device support.

| ID | Feature | Priority | Effort |
|----|---------|----------|--------|
| F1 | First-Time User Wizard | 🔴 Critical | Medium |
| F2 | Expanded Guide Page | 🔴 Critical | Medium |
| F3 | Downloads Page Enhancement | 🔴 Critical | Low |
| F4 | Device Config Update (13 chipsets) | 🔴 Critical | Low |
| F5 | Auto-detect Firehose by Chipset | 🟡 High | Medium |

### Phase 2: Growth (Next Sprint)

| ID | Feature | Priority | Effort |
|----|---------|----------|--------|
| F6 | Google Ads Integration | 🟡 High | Low |
| F7 | Affiliate Link Tracking | 🟡 High | Low |
| F8 | Performance Optimization | 🟡 High | High |
| F9 | Google Analytics 4 | 🟢 Medium | Low |

### Phase 3: Vision (Future)

| ID | Feature | Priority |
|----|---------|----------|
| F10 | Xiaomi/Samsung Qualcomm Support | 🟢 Medium |
| F11 | Community ROM Hub | 🔵 Low |
| F12 | Premium Features | 🔵 Low |

---

## 🔧 Functional Requirements

### F1: First-Time User Wizard

**Description:** Modal dialog that appears when a new user visits the Tool page for the first time. Guides them through essential setup steps.

**User Story:**
> As a new user, I want to be guided through the setup process so that I can successfully flash my device on my first attempt.

**Acceptance Criteria:**

| # | Criteria |
|---|----------|
| AC1.1 | Modal appears on first visit to Tool page (check localStorage flag) |
| AC1.2 | Modal has 4-5 steps with Next/Back/Skip buttons |
| AC1.3 | Steps cover: Device selection → Driver installation → File loading → Connection |
| AC1.4 | User can dismiss and never see again (checkbox "Don't show again") |
| AC1.5 | "Show Guide" button in header to re-open wizard |
| AC1.6 | Wizard is fully translated (Vietnamese + English) |

**UI Flow:**

```
Step 1: Welcome
├─ "Chào mừng đến Q-Flash! Hãy để tôi hướng dẫn bạn..."
├─ Brief explanation of what the tool does
└─ [Next] button

Step 2: Prerequisites  
├─ "Để sử dụng công cụ, bạn cần..."
├─ ✓ Chrome/Edge browser
├─ ✓ Windows PC with USB
├─ ✓ WinUSB Driver (link to download)
├─ ✓ Q-FLASH-FORGE for ROM processing
└─ [Next] [Skip] buttons

Step 3: Device Selection
├─ "Chọn thiết bị của bạn"
├─ Dropdown mirroring the main device selector
├─ Show selected chipset info
└─ [Next] [Back] buttons

Step 4: Connect Device
├─ "Đưa thiết bị vào chế độ EDL (9008)"
├─ Instructions: "Giữ Volume Down + Power khi cắm cáp"
├─ Animated GIF/diagram (optional)
└─ [Finish] button

Step 5: Ready!
├─ "Bạn đã sẵn sàng!"
├─ Quick reference card
├─ [ ] Don't show this again
└─ [Start Flashing] button
```

---

### F2: Expanded Guide Page

**Description:** Transform the current "Drivers" page into a comprehensive "Guide" page with full usage instructions.

**User Story:**
> As a user who wants detailed instructions, I want a comprehensive guide page so that I can learn all advanced features.

**Acceptance Criteria:**

| # | Criteria |
|---|----------|
| AC2.1 | Rename "Drivers" → "Guide" in navigation |
| AC2.2 | Page has sections: Quick Start, Driver Installation, Using the Tool, Troubleshooting |
| AC2.3 | Each section is collapsible accordion |
| AC2.4 | Include screenshots/diagrams |
| AC2.5 | Link to video tutorials (YouTube) if available |
| AC2.6 | FAQ section at bottom |
| AC2.7 | Fully translated (Vietnamese + English) |

**Content Structure:**

```markdown
# 📚 Guide

## Quick Start (3-step summary)

## 🔧 Prerequisites
- Browser requirements
- USB cable requirements  
- Device compatibility

## 📥 Installing Drivers
- Download WinUSB driver
- Using Zadig tool
- Troubleshooting driver issues

## 📱 Entering EDL Mode
- Method 1: Hardware buttons
- Method 2: ADB command
- Method 3: Test point (advanced)

## 🔌 Using Q-Flash Tool
- Connecting device
- Loading firehose files
- Reading partition table
- Backup partitions
- Flash partitions
- Batch operations

## 🛠️ ROM Processing (Q-FLASH-FORGE)
- What is Q-FLASH-FORGE
- Converting sparse images
- Preparing ROM files

## ❓ Troubleshooting
- "Device not found"
- "Bulk transfer timeout"
- "VIP authentication failed"
- "Session limit reached"

## 💬 FAQ
```

---

### F3: Downloads Page Enhancement

**Description:** Add Q-FLASH-FORGE tool and driver downloads to the existing Downloads page.

**User Story:**
> As a user, I want to download all necessary tools from one place so that I don't have to search for them.

**Acceptance Criteria:**

| # | Criteria |
|---|----------|
| AC3.1 | Add "Companion Tools" section above "Stock ROMs" |
| AC3.2 | Add Q-FLASH-FORGE card with GitHub link |
| AC3.3 | Add WinUSB Driver download card |
| AC3.4 | Add Zadig tool download link |
| AC3.5 | Each tool card shows: Name, Description, Version, Download links |
| AC3.6 | Track download clicks (for analytics) |

**Tool Cards to Add:**

1. **Q-FLASH-FORGE**
   - Description: "ROM conversion tool - Convert OZIP to flashable format"
   - Link: GitHub releases
   
2. **WinUSB Driver**
   - Description: "Required driver for EDL mode connection"
   - Link: Direct download or Zadig
   
3. **Zadig**
   - Description: "Driver installation utility"
   - Link: zadig.akeo.ie

---

### F4: Device Config Update

**Description:** Update devices.json to include all 13 chipset families with proper firehose folder mappings.

**User Story:**
> As a user with various Qualcomm devices, I want my device to be listed so that I can use the tool.

**Acceptance Criteria:**

| # | Criteria |
|---|----------|
| AC4.1 | devices.json includes entries for all 13 chipset folders |
| AC4.2 | Each device entry has correct firehose URLs pointing to folder |
| AC4.3 | Devices grouped by chipset in dropdown |
| AC4.4 | Status field reflects testing status (tested/beta/coming) |
| AC4.5 | Devices page shows all supported devices |

**Chipset Folders to Map:**

| Folder | Chipsets | Example Devices |
|--------|----------|-----------------|
| `710_670_712` | SD 710/670/712 | Oppo Reno, Realme 3 Pro |
| `765G_765_768G_732_730G_730_678_675` | SD 7xx series | OnePlus Nord, Realme 7 Pro |
| `SDM845` | SD 845 | OnePlus 6/6T, Oppo Find X |
| `SM6115_460_662` | SD 460/662/6115 | Realme C series |
| `SM6375_695_6sGen3` | SD 695/6s Gen3 | Realme 9/10 series |
| `SM7675_7+Gen3` | SD 7+ Gen 3 | OnePlus 12R |
| `SM8350_888_888+` | SD 888/888+ | OnePlus 9 series |
| `SM8475_8+Gen1` | SD 8+ Gen 1 | OnePlus 10T |
| `SM8550_8Gen2` | SD 8 Gen 2 | OnePlus 11 |
| `SM8650_8Gen3` | SD 8 Gen 3 | Oppo Find X7 Ultra |
| `SM8735_8sGen4` | SD 8s Gen 4 | TBD |
| `SM8750_8E` | SD 8 Elite | OnePlus 13 |
| `SM8750_8Elite` | SD 8 Elite (variant) | Find X8 Pro |

---

### F5: Auto-detect Firehose by Chipset

**Description:** When user selects a device, automatically determine and load the correct firehose folder.

**User Story:**
> As a user, I want the tool to automatically load the correct files for my device so that I don't have to manually select files.

**Acceptance Criteria:**

| # | Criteria |
|---|----------|
| AC5.1 | Device config includes chipset folder mapping |
| AC5.2 | On device selection, construct firehose URLs from folder |
| AC5.3 | Support fallback to manual file selection if auto fails |
| AC5.4 | Show loading progress when fetching files |
| AC5.5 | Cache loaded firehose in memory for session |

**Technical Implementation:**

```typescript
// devices.json structure
{
  "id": "oneplus-12r",
  "chipset": "SM7675",
  "chipsetFolder": "SM7675_7+Gen3",
  "firehose": {
    "programmerUrl": "/firehose/SM7675_7+Gen3/programmer.melf",
    "digestUrl": "/firehose/SM7675_7+Gen3/digest.elf", 
    "signatureUrl": "/firehose/SM7675_7+Gen3/signature.bin"
  }
}
```

---

### F6: Google Ads Integration (Growth Phase)

**Description:** Integrate Google AdSense for banner advertisements.

**Acceptance Criteria:**

| # | Criteria |
|---|----------|
| AC6.1 | AdSense script loaded on all pages |
| AC6.2 | Banner ad slot on Downloads page (top or sidebar) |
| AC6.3 | Banner ad slot on Support page |
| AC6.4 | NO ads on Tool page (don't interrupt workflow) |
| AC6.5 | Ads respect dark theme styling |
| AC6.6 | Ad blocker detection with polite message |

---

### F7: Affiliate Link Tracking (Growth Phase)

**Description:** Track clicks to external tools for potential affiliate partnerships.

**Acceptance Criteria:**

| # | Criteria |
|---|----------|
| AC7.1 | All external links have tracking parameters |
| AC7.2 | Click events sent to Google Analytics |
| AC7.3 | Dashboard shows top clicked links |
| AC7.4 | Support UTM parameters for campaign tracking |

---

### F8: Performance Optimization (Growth Phase)

**Description:** Optimize large file handling and streaming performance.

**Acceptance Criteria:**

| # | Criteria |
|---|----------|
| AC8.1 | Files >1GB use streaming write without memory buffering |
| AC8.2 | Progress updates every 1% for large files |
| AC8.3 | Implement retry logic for failed chunks |
| AC8.4 | Session limit handling with auto-reauthentication |
| AC8.5 | Reduce timeout errors on slow connections |

---

## 🎨 UX Principles

### Visual Design

| Principle | Implementation |
|-----------|----------------|
| **Dark Theme** | Maintain current dark aesthetic - professional, technical feel |
| **Minimal Clutter** | Tool page stays focused, no distractions |
| **Clear Feedback** | Loading states, progress bars, success/error toasts |
| **Accessibility** | Keyboard navigation, screen reader support |

### Key Interactions

| Interaction | UX Pattern |
|-------------|------------|
| **First Visit** | Wizard modal - friendly onboarding |
| **Device Selection** | Grouped dropdown with search |
| **Long Operations** | Progress bar with percentage, ETA if possible |
| **Errors** | Clear error message with suggested actions |
| **Success** | Celebratory toast + next step suggestion |

### Responsive Design

| Breakpoint | Behavior |
|------------|----------|
| **Desktop** | Full 3-column layout (sidebar, main, log) |
| **Tablet** | 2-column (sidebar collapses) |
| **Mobile** | Tool page: Show warning "Desktop recommended" |

---

## 🔒 Security & Privacy

### Data Handling

| Data Type | Handling |
|-----------|----------|
| **Partition Data** | Never uploaded - stays local |
| **Device Info** | Not logged or transmitted |
| **Usage Analytics** | Anonymous, aggregated only |
| **Firehose Files** | Downloaded from own server, no 3rd party |

### Security Considerations

- VIP authentication files (digest/signature) are device-specific
- Protected partitions (LUN5) have warning before operations
- No cloud backup of user data

---

## 📱 Technical Constraints

### Browser Requirements

| Requirement | Minimum |
|-------------|---------|
| **Chrome** | 89+ (WebUSB stable) |
| **Edge** | 89+ (Chromium-based) |
| **HTTPS** | Required for WebUSB |
| **USB** | Direct connection (no hub recommended) |

### Known Limitations

1. **WebUSB Browsers Only** - Firefox/Safari not supported
2. **Windows Mainly** - macOS/Linux need extra driver setup
3. **Session Limits** - Oppo devices have ~1.8GB per-session limit
4. **Large Files** - Files >4GB require File System Access API

---

## 📊 Analytics & Tracking

### Events to Track (GA4)

| Event | Parameters |
|-------|------------|
| `wizard_started` | step_number |
| `wizard_completed` | - |
| `wizard_skipped` | step_number |
| `device_selected` | device_id, chipset |
| `flash_started` | partition_names |
| `flash_completed` | partition_count, duration |
| `flash_error` | error_type, partition |
| `tool_downloaded` | tool_name |
| `page_view` | standard |

---

## 🚀 Release Plan

### MVP+ Release (Target: 1-2 weeks)

| Task | Owner | Status |
|------|-------|--------|
| F1: First-Time Wizard | Dev | 🔲 Not Started |
| F2: Expanded Guide Page | Dev | 🔲 Not Started |
| F3: Downloads Enhancement | Dev | 🔲 Not Started |
| F4: Device Config Update | Dev | 🔲 Not Started |
| F5: Auto-detect Firehose | Dev | 🔲 Not Started |
| Testing | QA | 🔲 Not Started |
| Documentation | Dev | 🔲 Not Started |

### Growth Release (Target: 4-6 weeks)

| Task | Status |
|------|--------|
| F6: Google Ads | 🔲 Planned |
| F7: Affiliate Tracking | 🔲 Planned |
| F8: Performance | 🔲 Planned |
| F9: Analytics | 🔲 Planned |

---

## 📎 Appendix

### A. Related Documents

- [Project Documentation Index](./index.md)
- [Architecture](./architecture.md)
- [Development Guide](./development-guide.md)
- [Component Inventory](./component-inventory.md)

### B. External Resources

- [Q-FLASH-FORGE GitHub](https://github.com/XuanNguyenNB/Q-FLASH-FORGE)
- [Zadig Driver Tool](https://zadig.akeo.ie/)
- [WebUSB API Specification](https://wicg.github.io/webusb/)

### C. Glossary

| Term | Definition |
|------|------------|
| **EDL** | Emergency Download Mode (Qualcomm 9008) |
| **Firehose** | Qualcomm protocol for flash operations |
| **Sahara** | Bootloader upload protocol |
| **VIP** | Oppo authentication handshake |
| **LUN** | Logical Unit Number (partition group) |
| **GPT** | GUID Partition Table |

---

## ✅ Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Owner | Nguyen | 2025-12-29 | ⏳ Pending |
| PM | John (Agent) | 2025-12-29 | ✅ Drafted |

---

*This PRD is a living document. It will be updated as requirements evolve.*
