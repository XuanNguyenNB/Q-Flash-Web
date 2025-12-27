# Q-Flash Web

**Universal Qualcomm WebUSB Flashing Tool**

Q-Flash Web (formerly Oppo WebUSB Tool) is a browser-based utility for interacting with Qualcomm devices in EDL (Emergency Download) mode directly from your web browser.

## Features

- **WebUSB Based:** No compiled drivers or external tools required (WinUSB via Zadig is needed on Windows).
- **Universal Qualcomm Support:** Designed to work with various Qualcomm devices (Snapdragon 8 Gen 2, Gen 3, etc.).
- **Partition Management:** Read, backup, flash, and erase partitions.
- **Compact UI:** Modern, window-like interface designed for ease of use.
- **Cross-Platform:** Works on any OS with a compatible browser (Chrome, Edge).

## Getting Started

1.  **Prerequisites:**
    -   A Qualcomm device in EDL Mode (9008).
    -   [Zadig](https://zadig.akeo.ie/) to install the `WinUSB` driver for the device.
    -   A Chromium-based browser (Chrome, Edge).

2.  **Usage:**
    -   Open the tool in your browser.
    -   Load your device's Loader (`prog_firehose_ddr.elf`).
    -   Connect to the device.
    -   Perform operations.

## Development

1.  Clone the repository:
    ```bash
    git clone https://github.com/XuanNguyenNB/Q-Flash-Web.git
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run dev server:
    ```bash
    npm run dev
    ```

## License

[MIT](LICENSE) (If applicable)

## Author

XuanNguyenNB
