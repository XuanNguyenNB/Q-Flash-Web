# ViewPhone Feature Documentation

**Feature Name**: ViewPhone (formerly Scrcpy Integration)  
**Version**: 1.0.0 (MVP + Polish)  
**Date**: December 31, 2025  
**Module**: ADB / Screen Mirroring

## 1. Overview

**ViewPhone** is a high-performance, low-latency Android screen mirroring feature integrated directly into the Q-Flash-Web application. It allows users to view and control their Android devices from the browser via WebUSB, offering a near-native experience with support for mouse, keyboard, and navigation controls.

## 2. Key Features

### 🖥️ High-Performance Mirroring
- **WebCodecs Technology**: Utilizes the browser's native `VideoDecoder` for hardware-accelerated H.264 decoding.
- **Ultra Low Latency**: Optimized using `@yume-chan/adb-scrcpy` for minimal delay (<100ms on good connections).
- **Customizable Quality**: Users can select Resolution (720p, 1024p, 1600p) and Bitrate (2Mbps - 8Mbps) before streaming.

### ⌨️ PC Keyboard Integration (Seamless)
- **Direct Typing**: Type on your PC keyboard to send text to the device immediately when the ViewPhone panel is focused.
- **Navigation Keys**: Maps PC keys to Android actions:
  - `Esc` or `Right Click` → Back
  - `Home` → Home
  - `Ctrl+V` → Paste to Device
  - `Arrow Keys` → Navigation

### 🎛️ Control Sidebar
A sleek, non-intrusive sidebar attached to the device frame provides quick access to:
- **Navigation**: Back, Home, Recent Apps.
- **Hardware Keys**: Volume Up/Down, Power (Screen Toggle).
- **Tools**: Clipboard Paste.

### 🎨 Modern UI/UX
- **Setup Panel**: Elegant "Q-Mirror/ViewPhone" dashboard to configure settings before starting.
- **Transitions**: Smooth morphing animation from Setup Panel to Device Frame.
- **Device Frame**: A stylized container with subtle borders and shadows to mimic a physical device look.
- **Status Overlay**: Live status indicator showing Resolution and Bitrate.
- **Full Localization**: Complete English (ViewPhone) and Vietnamese (Chiếu màn hình) support.

## 3. Technical Implementation

### Core Libraries
- **`@yume-chan/adb`**: Core ADB protocol over WebUSB.
- **`@yume-chan/adb-scrcpy`**: Client implementation for the Scrcpy protocol.
- **`@yume-chan/scrcpy-decoder-webcodecs`**: Video decoding pipeline.

### Architecture
1.  **Connection**: `useADB` hook manages the WebUSB connection via `ADBProtocol`.
2.  **Configuration**: User selects Resolution/Bitrate in the Setup UI.
3.  **Initiation**:
    - `AdbScrcpyClient.pushServer()`: Pushes the version-matched `scrcpy-server.jar` to `/data/local/tmp/`.
    - `AdbScrcpyClient.start()`: Executes the server on the device with the chosen options.
4.  **Streaming**:
    - Raw H.264 stream is piped to `WebCodecsVideoDecoder`.
    - Decoded frames are rendered onto a `<canvas>` element.
5.  **Control**:
    - `InjectTouchControl`: Maps mouse clicks to touch events.
    - `InjectKeyControl`: Maps keyboard events (`keydown`) to Android KeyCodes.

### File Structure
- `src/components/features/adb/ScrcpyPanel.tsx`: Main component handling UI, state, and Scrcpy logic.
- `src/stores/adbStore.ts`: Manages global ADB state (device info).
- `src/hooks/useADB.ts`: Provides the `ADBProtocol` instance.

## 4. Development Summary & Changelog

This session focused on refining the initial MVP into a polished, user-friendly feature.

### 🛠️ Tasks Completed

1.  **PC Keyboard Input Refinement**:
    *   **Goal**: Enable seamless typing from PC.
    *   **Implementation**: Removed manual toggle button. Enabled keyboard capture by default when the panel container has focus (indicated by a blue ring).
    *   **Details**: Used `onKeyDown` on the container `div` to capture events and `injectText`/`injectKeyCode` to send them to the device.

2.  **UI Overhaul**:
    *   **Sidebar**: Redesigned to be attached to the device frame. Minimized width (12/14) for better space capability.
    *   **Frame**: Added a "Card Style" outer dashboard and a "Device Style" inner frame with borders and rounded corners.
    *   **Clipping Fix**: Adjusted padding and border-radius to ensure the video stream is not clipped (Square Canvas, Minimal Rounding).
    *   **Setup Panel**: Created a new pre-stream settings screen for Resolution/Bitrate selection with smooth exit animations.

3.  **Bug Fixes**:
    *   **White Screen**: Resolved by ensuring correct Codec configuration and stream piping.
    *   **Start Button Failure**: Fixed an issue where `adb` was undefined by switching from `adbStore.adb` to `useADB().getInstance().adbInstance`.
    *   **"Closed Codec" Error**: Implemented a catch block in the stream pipe to suppress benign errors during stream teardown/cleanup.
    *   **Trailing Backticks**: Fixed syntax errors caused by accidentally left-over markdown characters.

4.  **Localization (i18n)**:
    *   Added `scrcpy` namespace to `en.json` and `vi.json`.
    *   Translated all UI elements including titles, buttons, and status labels.

### 🐛 Challenges & Solutions
| Challenge | Cause | Solution |
|-----------|-------|----------|
| **Start Stream did nothing** | Code was accessing `deviceInfo.adb` or `store.adb` which didn't exist/didn't have the instance. | Updated `ScrcpyPanel` to use `useADB().getInstance().adbInstance`. |
| **Video Clipping** | `rounded-3xl` and `p-3` padding on the canvas container cut off device screen corners. | Removed padding (`p-0`) and reduced border radius to `rounded-xl` for the display area. |
| **Log Spam** | `VideoDecoder` threw "closed codec" errors when stopping the stream. | Added specific error filtering in the `catch` block of the stream pipe. |
| **PC Input Focus** | Global window listeners captured keys when typing elsewhere. | Moved listeners to the Panel `div` and added `tabIndex={0}` to scope events to the focused component only. |

## 5. Future Improvements
- **Audio Support**: Implement audio forwarding (requires newer Scrcpy server features and browser AudioWorklet).
- **File Drag & Drop**: Enable pushing files to the device by dragging them onto the canvas.
- **Recording**: Add client-side video recording of the stream.
