# ADB Tab Redesign Proposal

## Overview
This document outlines the proposed redesign for the ADB Mode tab in Q-Flash-Web.
The goal is to enhance the user experience by organizing features into a centralized navigation hub, separating distinct functionalities into dedicated sub-tabs while maintaining the familiar sidebar and log panel.

## Layout Structure
- **Sidebar (Left)**: Unchanged.
- **Log Panel**: Unchanged (Global visibility).
- **Center Content**: New Tabbed Interface.

## Navigation Tabs
The main area will be divided into 4 primary tabs:

1.  **Quick View** (Dashboard)
2.  **App Manager**
3.  **File Manager**
4.  **Terminal**

---

## Tab Details

### 1. Quick View
**Layout**: Split View (1/3 Left : 2/3 Right)

*   **Left Column (1/3): Quick Actions**
    *   Vertical list of reboot commands.
    *   **Buttons**:
        *   Reboot EDL
        *   Reboot Bootloader
        *   Reboot FastbootD
        *   Reboot Recovery
        *   Reboot System
        *   Power Off
    *   *Implementation*: Refine existing `ADBQuickActions` to fit the vertical column.

*   **Right Column (2/3): View Screen (Scrcpy)**
    *   Existing `ScrcpyPanel`.
    *   Maintains current functionality (Screen mirroring, touch control).

### 2. App Manager
**Style**: "Partition/Grid" view (Similar to EDL Partition Manager).

*   **Display**: Grid of installed packages.
    *   Icon (default Android icon if extraction difficult, or generic).
    *   Package Name (e.g., `com.android.settings`).
    *   App Label (if retrieval possible).
*   **Toolbar Functions**:
    *   **Install APK**: File picker -> `adb install`.
    *   **Backup APK**: Select App -> Pull .apk -> Save to PC.
    *   **Uninstall**: Select Single/Multiple -> Prompt "Want Backup?" -> Confirm -> `adb uninstall`.
    *   **Set Permission**: Select App -> UI to grant/revoke permissions (e.g., `pm grant`).

### 3. File Manager
**Style**: Windows Explorer / File Explorer.

*   **UI Elements**:
    *   Breadcrumb navigation (e.g., `/sdcard/Download`).
    *   File List: Icon, Name, Size, Date.
    *   Folders are clickable to navigate.
*   **Actions**:
    *   **Push**: Upload file from PC to current folder.
    *   **Pull**: Download selected file/folder to PC.
    *   **Delete**: Remove file/folder.
    *   **Create Folder**: New directory.

### 4. Terminal
**Style**: Interactive Command Line.

*   **Display**:
    *   **CMD Screen**: A dedicated output area (separate from the global Log Panel) that shows the STDOUT/STDERR of commands run *in this tab*.
    *   **Input**: "Freeform" text input with `adb` preset.
        *   Example: User types `reboot bootloader`, system sends `adb reboot bootloader`.
        *   Example: User types `shell ls -la`, system sends `adb shell ls -la`.
*   **Presets**: Common command buttons for quick access (optional).

---

## UI Components Required
1.  **Tabs Component**: A new `Tabs` UI component (likely Shadcn UI compatible) for switching views.
2.  **ADBAppManager**: New component for app grid and logic.
3.  **ADBFileManager**: New component for filesystem browsing.
4.  **ADBTerminal**: Enhanced version of the current terminal component.

## Implementation Steps
1.  **Create `Tabs` UI component**.
2.  **Refactor `ADBPage.tsx`**: Replace current grid with the Tabs layout.
3.  **Implement `Quick View`**: Re-arrange `ADBQuickActions` and `ScrcpyPanel` into the split layout.
4.  **Implement `App Manager`**: Build the grid view and backend `pm` command logic.
5.  **Implement `File Manager`**: Build the explorer view and `ls/push/pull` logic.
6.  **Refine `Terminal`**: Add the dedicated output screen.

---
**Status**: DRAFT - Waiting for User Approval.
