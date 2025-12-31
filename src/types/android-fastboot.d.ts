// Type declarations for android-fastboot (fastboot.js)
// https://github.com/kdrag0n/fastboot.js

declare module 'android-fastboot' {
    /**
     * Set the debug logging level for fastboot operations
     * @param level - Debug level (0-4, higher = more verbose)
     */
    export function setDebugLevel(level: number): void;

    /**
     * Callback for progress updates during flash operations
     */
    export type ProgressCallback = (progress: number) => void;

    /**
     * Represents a Fastboot device connected via WebUSB
     */
    export class FastbootDevice {
        /**
         * Whether the device is currently connected
         */
        connected: boolean;

        /**
         * Connect to a fastboot device using WebUSB
         * Prompts user to select a device
         */
        connect(): Promise<void>;

        /**
         * Reconnect to the same device
         */
        reconnect(): Promise<void>;

        /**
         * Close the USB connection
         */
        close(): Promise<void>;

        /**
         * Get a variable from the bootloader
         * @param varname - Variable name (e.g., 'serial', 'product', 'version-bootloader')
         * @returns Variable value
         */
        getVariable(varname: string): Promise<string>;

        /**
         * Run a raw fastboot command
         * @param command - Command string
         * @returns Response from bootloader
         */
        runCommand(command: string): Promise<string>;

        /**
         * Flash a partition with data
         * @param partition - Partition name (e.g., 'boot', 'system')
         * @param blob - Image data as Blob
         * @param onProgress - Optional progress callback
         */
        flashBlob(partition: string, blob: Blob, onProgress?: ProgressCallback): Promise<void>;

        /**
         * Flash a factory image zip file
         * @param blob - Factory image zip as Blob
         * @param onProgress - Optional progress callback
         */
        flashFactoryZip(blob: Blob, onProgress?: ProgressCallback): Promise<void>;

        /**
         * Reboot the device
         * @param target - Reboot target ('', 'bootloader', 'recovery', 'fastbootd')
         */
        reboot(target?: string): Promise<void>;

        /**
         * Get all variables from the bootloader
         * @returns Map of variable names to values
         */
        getVariables(): Promise<Map<string, string>>;

        /**
         * Erase a partition
         * @param partition - Partition name
         */
        erase(partition: string): Promise<void>;

        /**
         * Unlock the bootloader
         */
        unlock(): Promise<void>;

        /**
         * Lock the bootloader
         */
        lock(): Promise<void>;

        /**
         * Set the active slot for A/B partitioned devices
         * @param slot - Slot name ('a' or 'b')
         */
        setActive(slot: string): Promise<void>;
    }
}
