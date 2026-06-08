import { FastbootDevice } from "android-fastboot";

export type FastbootRebootTarget = "bootloader" | "system";

export interface FastbootClient {
  connect(): Promise<void>;
  close(): Promise<void>;
  getvar(name: string): Promise<string>;
  getSerial(): Promise<string>;
  runRaw(command: string): Promise<string>;
  erase(partition: string): Promise<void>;
  flash(partition: string, blob: Blob, onProgress?: (progress: number) => void): Promise<void>;
  boot(blob: Blob, onProgress?: (progress: number) => void): Promise<void>;
  setActive(slot: "a" | "b"): Promise<void>;
  reboot(target?: FastbootRebootTarget): Promise<void>;
  rebootBootloaderAndWait(onReconnect?: () => void): Promise<void>;
}

const FASTBOOT_RECONNECT_TIMEOUT_MS = 10000;

type FastbootDeviceLike = {
  readonly isConnected?: boolean;
  connect(): Promise<void>;
  waitForConnect(onReconnect?: () => void): Promise<void>;
  runCommand(command: string): Promise<{ text: string; dataSize?: string }>;
  getVariable(name: string): Promise<string | null>;
  reboot(target?: string, wait?: boolean, onReconnect?: () => void): Promise<void>;
  flashBlob(partition: string, blob: Blob, onProgress?: (progress: number) => void): Promise<void>;
  bootBlob(blob: Blob, onProgress?: (progress: number) => void): Promise<void>;
};

type BrowserUsbDevice = {
  opened: boolean;
  configurations: Array<{
    interfaces: Array<{
      claimed?: boolean;
    }>;
  }>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  close(): Promise<void>;
};

export type ParsedFastbootTerminalCommand =
  | { kind: "devices"; display: string }
  | { kind: "getvar"; display: string; name: string }
  | { kind: "erase"; display: string; partition: string }
  | { kind: "setActive"; display: string; slot: "a" | "b" }
  | { kind: "reboot"; display: string; target?: FastbootRebootTarget }
  | { kind: "raw"; display: string; protocolCommand: string };

const tokenizeFastbootCommand = (input: string) => {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaping = false;

  for (const char of input.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }

  if (quote) {
    throw new Error("Lệnh Fastboot thiếu dấu quote đóng.");
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
};

const assertArity = (command: string, tokens: string[], expected: number) => {
  if (tokens.length !== expected) {
    throw new Error(`Cú pháp đúng: fastboot ${command}.`);
  }
};

export const parseFastbootTerminalCommand = (input: string): ParsedFastbootTerminalCommand => {
  const tokens = tokenizeFastbootCommand(input);

  if (tokens[0]?.toLowerCase() === "fastboot") {
    tokens.shift();
  }

  if (!tokens.length) {
    throw new Error("Nhập lệnh Fastboot trước khi gửi.");
  }

  const command = tokens[0].toLowerCase();
  const display = `fastboot ${tokens.join(" ")}`;

  if (command === "devices") {
    assertArity("devices", tokens, 1);
    return { kind: "devices", display };
  }

  if (command === "getvar") {
    assertArity("getvar <name>", tokens, 2);
    return { kind: "getvar", display, name: tokens[1] };
  }

  if (command === "erase") {
    assertArity("erase <partition>", tokens, 2);
    return { kind: "erase", display, partition: tokens[1] };
  }

  if (command === "set_active") {
    assertArity("set_active <a|b>", tokens, 2);
    const slot = tokens[1].replace(/^_/, "").toLowerCase();

    if (slot !== "a" && slot !== "b") {
      throw new Error("fastboot set_active chỉ hỗ trợ slot a hoặc b.");
    }

    return { kind: "setActive", display, slot };
  }

  if (command === "reboot") {
    if (tokens.length > 2) {
      throw new Error("Cú pháp đúng: fastboot reboot [bootloader|system].");
    }

    const target = tokens[1]?.toLowerCase();

    if (!target) {
      return { kind: "reboot", display };
    }

    if (target === "bootloader" || target === "system") {
      return { kind: "reboot", display, target };
    }

    throw new Error("Terminal chỉ hỗ trợ fastboot reboot, reboot bootloader hoặc reboot system.");
  }

  if (command === "flash") {
    throw new Error("Terminal text-only không hỗ trợ fastboot flash vì cần upload tệp.");
  }

  if (command === "boot") {
    throw new Error("Terminal text-only không hỗ trợ fastboot boot vì cần upload tệp.");
  }

  return {
    kind: "raw",
    display,
    protocolCommand: tokens.join(" "),
  };
};

const isExpectedRebootDisconnectError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (name === "FastbootError" || message.includes("bootloader replied")) {
    return false;
  }

  return (
    name === "NetworkError" ||
    name === "InvalidStateError" ||
    message.includes("disconnected") ||
    message.includes("disconnect") ||
    message.includes("transfer")
  );
};

export class BrowserFastbootClient implements FastbootClient {
  private readonly device: FastbootDeviceLike;

  constructor(device: FastbootDeviceLike = new FastbootDevice()) {
    this.device = device;
  }

  async connect() {
    await this.device.connect();
  }

  async close() {
    const holder = this.device as unknown as {
      device?: BrowserUsbDevice | null;
      epIn?: number | null;
      epOut?: number | null;
    };
    const usbDevice = holder.device;

    if (usbDevice?.opened) {
      try {
        if (usbDevice.configurations[0]?.interfaces[0]?.claimed) {
          await usbDevice.releaseInterface(0);
        }
      } catch {
        // Best-effort cleanup only; the browser also releases the device on page close.
      }

      try {
        await usbDevice.close();
      } catch {
        // Best-effort cleanup only.
      }
    }

    holder.device = null;
    holder.epIn = null;
    holder.epOut = null;
  }

  async getvar(name: string) {
    return (await this.device.getVariable(name)) ?? "";
  }

  async getSerial() {
    const serialno = (await this.getvar("serialno")).trim();

    if (serialno) {
      return serialno;
    }

    return (await this.getvar("serial")).trim();
  }

  async runRaw(command: string) {
    return (await this.device.runCommand(command)).text.trim();
  }

  async erase(partition: string) {
    await this.runRaw(`erase:${partition}`);
  }

  async flash(partition: string, blob: Blob, onProgress?: (progress: number) => void) {
    await this.device.flashBlob(partition, blob, onProgress);
  }

  async boot(blob: Blob, onProgress?: (progress: number) => void) {
    await this.device.bootBlob(blob, onProgress);
  }

  async setActive(slot: "a" | "b") {
    await this.runRaw(`set_active:${slot}`);
  }

  async reboot(target?: FastbootRebootTarget) {
    try {
      await this.device.reboot(target === "bootloader" ? "bootloader" : "");
    } catch (error) {
      if (!isExpectedRebootDisconnectError(error)) {
        throw error;
      }
    }
  }

  async rebootBootloaderAndWait(onReconnect?: () => void) {
    await this.reboot("bootloader");

    const reconnect = this.device.waitForConnect(onReconnect).then(() => "connected" as const);
    const timeout = new Promise<"timeout">((resolve) => {
      window.setTimeout(() => resolve("timeout"), FASTBOOT_RECONNECT_TIMEOUT_MS);
    });

    const result = await Promise.race([reconnect, timeout]);

    if (result === "timeout") {
      reconnect.catch(() => undefined);
      onReconnect?.();
      await this.connect();
    }
  }
}
