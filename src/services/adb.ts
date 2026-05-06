import { Adb, AdbDaemonTransport, LinuxFileType } from "@yume-chan/adb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import type { MaybeConsumable, ReadableStream as AdbReadableStream } from "@yume-chan/stream-extra";

import { WorkflowError } from "../workflow/errors";

export type AdbShellResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export interface AdbClient {
  connect(): Promise<void>;
  shell(command: string): Promise<AdbShellResult>;
  push(filename: string, blob: Blob): Promise<void>;
  rebootBootloader(): Promise<void>;
  close(): Promise<void>;
}

const blobToReadableStream = (blob: Blob) =>
  new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
      controller.close();
    },
  }) as unknown as AdbReadableStream<MaybeConsumable<Uint8Array>>;

export class BrowserAdbClient implements AdbClient {
  private adb: Adb | undefined;

  async connect() {
    const manager = AdbDaemonWebUsbDeviceManager.BROWSER;

    if (!manager) {
      throw new WorkflowError("WEBUSB_UNAVAILABLE");
    }

    const device = await manager.requestDevice();

    if (!device) {
      throw new WorkflowError("USB_PICKER_CANCELLED");
    }

    const connection = await device.connect();
    const credentialStore = new AdbWebCredentialStore("xiaomi-webusb-unlock");
    const transport = await AdbDaemonTransport.authenticate({
      serial: device.serial,
      connection,
      credentialStore,
    });

    this.adb = new Adb(transport);
  }

  async shell(command: string): Promise<AdbShellResult> {
    const adb = this.requireAdb();
    const shellProtocol = adb.subprocess.shellProtocol;

    if (shellProtocol?.isSupported) {
      return shellProtocol.spawnWaitText(command);
    }

    return {
      stdout: await adb.subprocess.noneProtocol.spawnWaitText(command),
      stderr: "",
      exitCode: 0,
    };
  }

  async push(filename: string, blob: Blob) {
    const sync = await this.requireAdb().sync();

    try {
      await sync.write({
        filename,
        file: blobToReadableStream(blob),
        type: LinuxFileType.File,
        permission: 0o644,
        mtime: Math.floor(Date.now() / 1000),
      });
    } finally {
      await sync.dispose();
    }
  }

  async rebootBootloader() {
    await this.requireAdb().power.bootloader();
  }

  async close() {
    await this.adb?.close();
    this.adb = undefined;
  }

  private requireAdb() {
    if (!this.adb) {
      throw new WorkflowError("DEVICE_NOT_FOUND", "ADB chưa kết nối.");
    }

    return this.adb;
  }
}
