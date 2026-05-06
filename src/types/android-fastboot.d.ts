declare module "android-fastboot" {
  export class FastbootError extends Error {
    status: string;
  }

  export class UsbError extends Error {}

  export class TimeoutError extends Error {
    timeout: number;
  }

  export class FastbootDevice {
    readonly isConnected: boolean;
    connect(): Promise<void>;
    waitForDisconnect(): Promise<void>;
    waitForConnect(onReconnect?: () => void): Promise<void>;
    runCommand(command: string): Promise<{ text: string; dataSize?: string }>;
    getVariable(name: string): Promise<string | null>;
    reboot(target?: string, wait?: boolean, onReconnect?: () => void): Promise<void>;
    flashBlob(partition: string, blob: Blob, onProgress?: (progress: number) => void): Promise<void>;
    bootBlob(blob: Blob, onProgress?: (progress: number) => void): Promise<void>;
  }

  export function setDebugLevel(level: number): void;
}
