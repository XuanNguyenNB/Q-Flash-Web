import { describe, expect, it, vi } from "vitest";

import { BrowserFastbootClient, parseFastbootTerminalCommand } from "./fastboot";

class FakeFastbootDevice {
  commands: string[] = [];
  variables: Record<string, string> = {};
  rebootError: Error | undefined;
  waitPromise: Promise<void> = Promise.resolve();

  async connect() {
    this.commands.push("connect");
  }

  async waitForConnect(onReconnect?: () => void) {
    await this.waitPromise;
    onReconnect?.();
  }

  async runCommand(command: string) {
    this.commands.push(command);
    return { text: "" };
  }

  async getVariable(name: string) {
    this.commands.push(`getvar:${name}`);
    return this.variables[name] ?? "";
  }

  async reboot(target = "", wait = false) {
    this.commands.push(`reboot:${target}:${wait}`);

    if (this.rebootError) {
      throw this.rebootError;
    }
  }

  async flashBlob() {
    this.commands.push("flash");
  }

  async bootBlob() {
    this.commands.push("boot");
  }
}

describe("parseFastbootTerminalCommand", () => {
  it("accepts optional fastboot prefix and maps structured text commands", () => {
    expect(parseFastbootTerminalCommand("fastboot devices")).toEqual({
      kind: "devices",
      display: "fastboot devices",
    });
    expect(parseFastbootTerminalCommand("devices")).toEqual({
      kind: "devices",
      display: "fastboot devices",
    });
    expect(parseFastbootTerminalCommand("fastboot getvar product")).toEqual({
      kind: "getvar",
      display: "fastboot getvar product",
      name: "product",
    });
    expect(parseFastbootTerminalCommand("erase boot")).toEqual({
      kind: "erase",
      display: "fastboot erase boot",
      partition: "boot",
    });
    expect(parseFastbootTerminalCommand("set_active a")).toEqual({
      kind: "setActive",
      display: "fastboot set_active a",
      slot: "a",
    });
    expect(parseFastbootTerminalCommand("fastboot reboot bootloader")).toEqual({
      kind: "reboot",
      display: "fastboot reboot bootloader",
      target: "bootloader",
    });
  });

  it("passes raw text commands through", () => {
    expect(parseFastbootTerminalCommand("fastboot oem device-info")).toEqual({
      kind: "raw",
      display: "fastboot oem device-info",
      protocolCommand: "oem device-info",
    });
    expect(parseFastbootTerminalCommand("getvar:product")).toEqual({
      kind: "raw",
      display: "fastboot getvar:product",
      protocolCommand: "getvar:product",
    });
  });

  it("rejects payload commands that need file upload", () => {
    expect(() => parseFastbootTerminalCommand("fastboot flash boot boot.img")).toThrow(/không hỗ trợ/);
    expect(() => parseFastbootTerminalCommand("fastboot boot boot.img")).toThrow(/không hỗ trợ/);
  });
});

describe("BrowserFastbootClient reboot handling", () => {
  it("reads fastboot serialno and falls back to serial", async () => {
    const device = new FakeFastbootDevice();
    device.variables.serialno = "SERIALNO123";
    const client = new BrowserFastbootClient(device);

    await expect(client.getSerial()).resolves.toBe("SERIALNO123");
    expect(device.commands).toEqual(["getvar:serialno"]);

    const fallbackDevice = new FakeFastbootDevice();
    fallbackDevice.variables.serial = "SERIAL123";
    const fallbackClient = new BrowserFastbootClient(fallbackDevice);

    await expect(fallbackClient.getSerial()).resolves.toBe("SERIAL123");
    expect(fallbackDevice.commands).toEqual(["getvar:serialno", "getvar:serial"]);
  });

  it("treats disconnect during an intentional reboot command as expected", async () => {
    const device = new FakeFastbootDevice();
    device.rebootError = new DOMException("Transfer failed because device disconnected", "NetworkError");
    const client = new BrowserFastbootClient(device);

    await expect(client.reboot("bootloader")).resolves.toBeUndefined();
    expect(device.commands).toEqual(["reboot:bootloader:false"]);
  });

  it("still fails real bootloader errors during reboot", async () => {
    const device = new FakeFastbootDevice();
    device.rebootError = Object.assign(new Error("Bootloader replied with FAIL: nope"), { name: "FastbootError" });
    const client = new BrowserFastbootClient(device);

    await expect(client.reboot("bootloader")).rejects.toThrow(/Bootloader replied/);
  });

  it("falls back to picker connect without waiting on a stale reconnect promise", async () => {
    vi.useFakeTimers();
    const device = new FakeFastbootDevice();
    device.waitPromise = new Promise(() => undefined);
    const client = new BrowserFastbootClient(device);
    const onReconnect = vi.fn();

    const reconnect = client.rebootBootloaderAndWait(onReconnect);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10000);

    await expect(reconnect).resolves.toBeUndefined();
    expect(device.commands).toEqual(["reboot:bootloader:false", "connect"]);
    expect(onReconnect).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
