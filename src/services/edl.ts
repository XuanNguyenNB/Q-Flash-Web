import { WorkflowError } from "../workflow/errors";

export type EdlProgramTarget = {
  label: string;
  lun: number;
  startSector: string;
  maxSectors: number;
  sectorSize: number;
};

export interface EdlClient {
  connect9008(): Promise<void>;
  uploadProgrammer(blob: Blob, onProgress?: (progress: number) => void): Promise<void>;
  configureUfs(): Promise<void>;
  programRaw(target: EdlProgramTarget, blob: Blob, onProgress?: (progress: number) => void): Promise<void>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

type BrowserUsb = {
  requestDevice(options: { filters: Array<{ vendorId: number; productId: number }> }): Promise<BrowserUsbDevice>;
  getDevices?(): Promise<BrowserUsbDevice[]>;
};

type BrowserUsbDevice = {
  opened: boolean;
  vendorId?: number;
  productId?: number;
  configuration: BrowserUsbConfiguration | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface?(interfaceNumber: number, alternateSetting: number): Promise<void>;
  transferIn(endpointNumber: number, length: number): Promise<BrowserUsbInResult>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<BrowserUsbOutResult>;
};

type BrowserUsbConfiguration = {
  interfaces: BrowserUsbInterface[];
};

type BrowserUsbInterface = {
  interfaceNumber: number;
  alternates: BrowserUsbAlternateInterface[];
};

type BrowserUsbAlternateInterface = {
  alternateSetting: number;
  interfaceClass: number;
  endpoints: BrowserUsbEndpoint[];
};

type BrowserUsbEndpoint = {
  endpointNumber: number;
  direction: "in" | "out";
  type: string;
};

type BrowserUsbInResult = {
  data?: DataView;
  status?: string;
};

type BrowserUsbOutResult = {
  bytesWritten?: number;
  status?: string;
};

type SaharaHello = {
  version: number;
  versionSupported: number;
  maxCommandPacketSize: number;
  mode: number;
};

const QUALCOMM_VENDOR_ID = 0x05c6;
const EDL_9008_PRODUCT_ID = 0x9008;
const USB_TRANSFER_TIMEOUT_MS = 300000;
const SAHARA_PACKET_READ_BYTES = 4096;
const FIREHOSE_READ_BYTES = 8192;
const FIREHOSE_XML_PAYLOAD_BYTES = 4096;
const FIREHOSE_XML_WRITE_TIMEOUT_MS = 5000;
const FIREHOSE_SAFE_PAYLOAD_CANDIDATES = [32768, 16384, 4096] as const;
const FIREHOSE_DEFAULT_PAYLOAD_BYTES = FIREHOSE_SAFE_PAYLOAD_CANDIDATES[0];
const FIREHOSE_READY_DELAY_MS = 700;
const FIREHOSE_RECONNECT_DELAY_MS = 900;

const SAHARA = {
  HELLO: 0x01,
  HELLO_RESP: 0x02,
  READ_DATA: 0x03,
  END_TRANSFER: 0x04,
  DONE: 0x05,
  DONE_RESP: 0x06,
  CMD_READY: 0x0b,
  READ_DATA_64: 0x12,
} as const;

const SAHARA_MODE_IMAGE_TX_PENDING = 0x00;
const SAHARA_MODE_COMMAND = 0x03;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const delay = (ms: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));

const withTimeout = async <T>(work: Promise<T>, timeoutMs: number, message: string) => {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  }
};

const dataViewFor = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const toBytes = (view: DataView) => new Uint8Array(view.buffer, view.byteOffset, view.byteLength);

const firehoseText = (bytes: Uint8Array) => textDecoder.decode(bytes).replace(/\0/g, "");

const hasAck = (text: string) => /<response\b[^>]*value\s*=\s*["']ACK["']/i.test(text);

const hasNack = (text: string) => /<response\b[^>]*value\s*=\s*["']NAK["']/i.test(text);

const hasRawModeTrue = (text: string) => /rawmode\s*=\s*["']true["']/i.test(text);

const hasRawModeFalse = (text: string) => /rawmode\s*=\s*["']false["']/i.test(text);

const hasFirehoseError = (text: string) => /<log\b[^>]*value\s*=\s*["'][^"']*ERROR|ERROR/i.test(text);

const hasNackOrError = (text: string) => hasNack(text) || hasFirehoseError(text);

const summarizeFirehoseText = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 280) || "(empty)";

const isSaharaHelloTimeout = (error: unknown) =>
  error instanceof Error && error.message.includes("Sahara HELLO");

const firehoseNumberAttr = (text: string, attr: string) => {
  const pattern = new RegExp(`${attr}\\s*=\\s*["'](\\d+)["']`, "i");
  const match = pattern.exec(text);
  const value = match ? Number.parseInt(match[1], 10) : Number.NaN;

  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const xmlEscape = (value: string | number | boolean) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildFirehoseXml = (tag: string, attrs: Record<string, string | number | boolean>) => {
  const attributes = Object.entries(attrs)
    .map(([key, value]) => `${key}="${xmlEscape(value)}"`)
    .join(" ");

  return `<?xml version="1.0" ?><data><${tag} ${attributes} /></data>`;
};

export class BrowserEdlClient implements EdlClient {
  private device: BrowserUsbDevice | undefined;
  private interfaceNumber: number | undefined;
  private endpointIn = 1;
  private endpointOut = 1;
  private maxPayloadSizeToTarget: number = FIREHOSE_DEFAULT_PAYLOAD_BYTES;

  async connect9008() {
    const usb = (navigator as Navigator & { usb?: BrowserUsb }).usb;

    if (!usb) {
      throw new WorkflowError("WEBUSB_UNAVAILABLE");
    }

    const device = await usb.requestDevice({
      filters: [{ vendorId: QUALCOMM_VENDOR_ID, productId: EDL_9008_PRODUCT_ID }],
    });

    if (!device) {
      throw new WorkflowError("USB_PICKER_CANCELLED");
    }

    await this.openDevice(device);
  }

  async uploadProgrammer(blob: Blob, onProgress?: (progress: number) => void) {
    const programmer = new Uint8Array(await blob.arrayBuffer());
    const hello = await this.waitForSaharaHello().catch(async (error) => {
      if (!isSaharaHelloTimeout(error)) {
        throw error;
      }

      const reconnected = await this.reconnectGranted9008().catch(() => false);

      if (!reconnected) {
        throw error;
      }

      onProgress?.(1);
      return undefined;
    });

    if (!hello) {
      return;
    }

    await this.sendSaharaHelloResponse(hello);

    let maxOffsetSent = 0;

    while (true) {
      const packet = await this.read(SAHARA_PACKET_READ_BYTES, 30000);
      const view = dataViewFor(packet);

      if (packet.byteLength < 8) {
        throw new Error("Gói Sahara quá ngắn.");
      }

      const command = view.getUint32(0, true);

      if (command === SAHARA.READ_DATA || command === SAHARA.READ_DATA_64) {
        const request =
          command === SAHARA.READ_DATA
            ? {
                offset: view.getUint32(12, true),
                length: view.getUint32(16, true),
              }
            : {
                offset: Number(view.getBigUint64(16, true)),
                length: Number(view.getBigUint64(24, true)),
              };

        if (!Number.isSafeInteger(request.offset) || !Number.isSafeInteger(request.length)) {
          throw new Error("Sahara yêu cầu vùng programmer 64-bit không an toàn.");
        }

        if (request.offset < 0 || request.length < 0 || request.offset + request.length > programmer.byteLength) {
          throw new Error(`Sahara yêu cầu byte ngoài programmer: offset=${request.offset}, length=${request.length}.`);
        }

        const chunk = programmer.slice(request.offset, request.offset + request.length);
        await this.write(chunk);
        maxOffsetSent = Math.max(maxOffsetSent, request.offset + request.length);
        onProgress?.(programmer.byteLength ? maxOffsetSent / programmer.byteLength : 1);
        continue;
      }

      if (command === SAHARA.END_TRANSFER) {
        const status = packet.byteLength >= 16 ? view.getUint32(12, true) : 0;

        if (status !== 0) {
          throw new Error(`Sahara END_TRANSFER trả status ${status}.`);
        }

        break;
      }

      if (command === SAHARA.CMD_READY) {
        break;
      }

      throw new Error(`Lệnh Sahara không mong đợi 0x${command.toString(16)}.`);
    }

    await this.sendSaharaDone();
    await delay(FIREHOSE_READY_DELAY_MS);
    onProgress?.(1);
  }

  async configureUfs() {
    const candidates: number[] = [...FIREHOSE_SAFE_PAYLOAD_CANDIDATES];
    const errors: string[] = [];
    let reconnectedAfterSahara = false;

    if (await this.reconnectGranted9008().catch(() => false)) {
      reconnectedAfterSahara = true;
      await delay(FIREHOSE_RECONNECT_DELAY_MS);
    }

    while (candidates.length > 0) {
      const payloadSize = candidates.shift() ?? FIREHOSE_XML_PAYLOAD_BYTES;

      try {
        const text = await this.sendFirehoseCommand(
          buildFirehoseXml("configure", {
            MemoryName: "ufs",
            Verbose: 0,
            AlwaysValidate: 0,
            MaxPayloadSizeToTargetInBytes: payloadSize,
            MaxPayloadSizeFromTargetInBytes: FIREHOSE_XML_PAYLOAD_BYTES,
            MaxXMLSizeInBytes: FIREHOSE_XML_PAYLOAD_BYTES,
            SkipStorageInit: 0,
            SkipWrite: 0,
            ZLPAwareHost: 1,
          }),
          { label: `configure ${payloadSize}`, allowNak: true },
        );

        const supported =
          firehoseNumberAttr(text, "MaxPayloadSizeToTargetInBytesSupported") ??
          firehoseNumberAttr(text, "MaxPayloadSizeToTargetInBytes");

        if (hasAck(text)) {
          this.maxPayloadSizeToTarget = Math.max(4096, Math.min(payloadSize, supported ?? payloadSize));
          return;
        }

        if (supported && supported !== payloadSize) {
          const nextPayload = Math.max(4096, Math.min(payloadSize, supported));

          if (!candidates.includes(nextPayload)) {
            candidates.unshift(nextPayload);
          }
        }

        errors.push(`configure ${payloadSize} NAK: ${summarizeFirehoseText(text)}`);
      } catch (error) {
        errors.push(`configure ${payloadSize}: ${String(error)}`);

        if (!reconnectedAfterSahara && this.isUsbTransportError(error) && (await this.reconnectGranted9008())) {
          reconnectedAfterSahara = true;
          await delay(FIREHOSE_READY_DELAY_MS);
          candidates.unshift(payloadSize);
        }
      }
    }

    throw new Error(`Firehose configure thất bại sau Sahara/WinUSB: ${errors.join("; ")}`);
  }

  async programRaw(target: EdlProgramTarget, blob: Blob, onProgress?: (progress: number) => void) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const sectors = Math.ceil(data.byteLength / target.sectorSize);

    if (sectors < 1) {
      throw new Error(`Blob ABL cho ${target.label} đang rỗng.`);
    }

    if (sectors > target.maxSectors) {
      throw new Error(`${target.label} ABL cần ${sectors} sector, giới hạn tối đa là ${target.maxSectors}.`);
    }

    const paddedLength = sectors * target.sectorSize;
    const payload = data.byteLength === paddedLength ? data : new Uint8Array(paddedLength);

    if (payload !== data) {
      payload.set(data);
    }

    const command = buildFirehoseXml("program", {
      SECTOR_SIZE_IN_BYTES: target.sectorSize,
      file_sector_offset: 0,
      filename: "abl.elf",
      physical_partition_number: target.lun,
      label: target.label,
      start_sector: target.startSector,
      num_partition_sectors: sectors,
      partofsingleimage: "false",
      sparse: "false",
    });

    await this.sendFirehoseCommand(command, {
      label: `program ${target.label}`,
      rawMode: true,
    });

    let written = 0;
    const chunkSize = Math.max(4096, Math.min(this.maxPayloadSizeToTarget, FIREHOSE_DEFAULT_PAYLOAD_BYTES));

    while (written < payload.byteLength) {
      const next = Math.min(payload.byteLength, written + chunkSize);
      await this.write(payload.slice(written, next));
      written = next;
      onProgress?.(written / payload.byteLength);
    }

    await this.writeZeroLengthPacket();
    await this.readFirehoseUntil(
      (text) => hasAck(text) || hasRawModeFalse(text),
      30000,
      `final ACK after programming ${target.label}`,
    );
    onProgress?.(1);
  }

  async reset() {
    await this.write(
      textEncoder.encode(
        buildFirehoseXml("power", {
          DelayInSeconds: 0,
          value: "reset",
        }),
      ),
    );

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const chunk = await this.tryRead(FIREHOSE_READ_BYTES, 500).catch(() => undefined);

      if (!chunk) {
        await delay(150);
        continue;
      }

      const text = firehoseText(chunk);

      if (hasNackOrError(text)) {
        throw new Error(`Firehose từ chối reset: ${summarizeFirehoseText(text)}`);
      }
    }
  }

  async close() {
    const device = this.device;
    const interfaceNumber = this.interfaceNumber;

    if (!device) {
      return;
    }

    try {
      if (device.opened && interfaceNumber !== undefined) {
        await device.releaseInterface(interfaceNumber);
      }
    } catch {
      // Best-effort cleanup; the browser also releases WebUSB handles on page close.
    }

    try {
      if (device.opened) {
        await device.close();
      }
    } catch {
      // Best-effort cleanup.
    }

    this.device = undefined;
    this.interfaceNumber = undefined;
  }

  private async waitForSaharaHello() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const packet = await this.tryRead(48, 2200).catch(() => undefined);

      if (!packet || packet.byteLength < 48) {
        await delay(300);
        continue;
      }

      const view = dataViewFor(packet);

      if (view.getUint32(0, true) !== SAHARA.HELLO) {
        await delay(300);
        continue;
      }

      return {
        version: view.getUint32(8, true),
        versionSupported: view.getUint32(12, true),
        maxCommandPacketSize: view.getUint32(16, true),
        mode: view.getUint32(20, true),
      } satisfies SaharaHello;
    }

    throw new Error("Hết thời gian chờ Sahara HELLO từ EDL 9008.");
  }

  private async sendSaharaHelloResponse(hello: SaharaHello) {
    const response = new ArrayBuffer(48);
    const view = new DataView(response);

    view.setUint32(0, SAHARA.HELLO_RESP, true);
    view.setUint32(4, 48, true);
    view.setUint32(8, hello.version, true);
    view.setUint32(12, hello.versionSupported, true);
    view.setUint32(16, 0, true);
    view.setUint32(20, hello.mode === SAHARA_MODE_COMMAND ? SAHARA_MODE_COMMAND : SAHARA_MODE_IMAGE_TX_PENDING, true);

    await this.write(new Uint8Array(response));
  }

  private async sendSaharaDone() {
    const done = new ArrayBuffer(8);
    const view = new DataView(done);

    view.setUint32(0, SAHARA.DONE, true);
    view.setUint32(4, 8, true);
    await this.write(new Uint8Array(done));
  }

  private async sendFirehoseCommand(
    command: string,
    options: {
      label: string;
      rawMode?: boolean;
      allowNak?: boolean;
    },
  ) {
    await this.write(textEncoder.encode(command), FIREHOSE_XML_WRITE_TIMEOUT_MS);
    return this.readFirehoseUntil(
      (text) => hasAck(text) && (!options.rawMode || hasRawModeTrue(text)),
      15000,
      `${options.label} ACK${options.rawMode ? " rawmode=true" : ""}`,
      { allowNak: options.allowNak },
    );
  }

  private async readFirehoseUntil(
    predicate: (text: string) => boolean,
    timeoutMs: number,
    label: string,
    options: { allowNak?: boolean } = {},
  ) {
    const startedAt = performance.now();
    let text = "";

    while (performance.now() - startedAt < timeoutMs) {
      const remainingMs = Math.max(250, timeoutMs - (performance.now() - startedAt));
      const chunk = await this.tryRead(FIREHOSE_READ_BYTES, Math.min(1200, remainingMs)).catch(() => undefined);

      if (!chunk?.byteLength) {
        continue;
      }

      text += firehoseText(chunk);

      if (predicate(text)) {
        return text;
      }

      if (options.allowNak && hasNack(text)) {
        return text;
      }

      if (hasFirehoseError(text) || (hasNack(text) && !options.allowNak)) {
        throw new Error(`Firehose NAK/ERROR khi chờ ${label}: ${summarizeFirehoseText(text)}`);
      }
    }

    throw new Error(`Hết thời gian chờ Firehose ${label}: ${summarizeFirehoseText(text)}`);
  }

  private async read(length: number, timeoutMs = USB_TRANSFER_TIMEOUT_MS) {
    const device = this.requireDevice();
    const result = await withTimeout(device.transferIn(this.endpointIn, length), timeoutMs, "EDL bulk IN hết thời gian truyền.");

    if (result.status && result.status !== "ok") {
      throw new Error(`EDL bulk IN thất bại: ${result.status}.`);
    }

    if (!result.data) {
      return new Uint8Array();
    }

    return toBytes(result.data);
  }

  private async tryRead(length: number, timeoutMs: number) {
    return withTimeout(this.read(length, timeoutMs), timeoutMs + 50, "EDL quick read hết thời gian chờ.");
  }

  private async write(data: Uint8Array, timeoutMs = USB_TRANSFER_TIMEOUT_MS) {
    const device = this.requireDevice();
    const result = await withTimeout(
      device.transferOut(this.endpointOut, data as unknown as BufferSource),
      timeoutMs,
      "EDL bulk OUT hết thời gian truyền.",
    );

    if (result.status && result.status !== "ok") {
      throw new Error(`EDL bulk OUT thất bại: ${result.status}.`);
    }
  }

  private async writeZeroLengthPacket() {
    await this.write(new Uint8Array(), 5000).catch((error) => {
      throw new Error(`EDL bulk OUT ZLP thất bại: ${String(error)}`);
    });
  }

  private async openDevice(device: BrowserUsbDevice) {
    this.device = device;
    await device.open();

    if (!device.configuration) {
      await device.selectConfiguration(1);
    }

    const { interfaceNumber, alternate } = this.findBulkInterface();
    await device.claimInterface(interfaceNumber);

    if (alternate.alternateSetting !== 0) {
      await device.selectAlternateInterface?.(interfaceNumber, alternate.alternateSetting);
    }

    this.interfaceNumber = interfaceNumber;
    this.detectEndpoints(alternate);
  }

  private async reconnectGranted9008() {
    const usb = (navigator as Navigator & { usb?: BrowserUsb }).usb;
    const devices = (await usb?.getDevices?.()) ?? [];
    const device = devices.find((candidate) => candidate.vendorId === QUALCOMM_VENDOR_ID && candidate.productId === EDL_9008_PRODUCT_ID);

    if (!device) {
      return false;
    }

    await this.close();
    await this.openDevice(device);
    return true;
  }

  private isUsbTransportError(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes("transfer") ||
      message.includes("disconnected") ||
      message.includes("device unavailable") ||
      message.includes("device unavailable") ||
      message.includes("the device was disconnected") ||
      message.includes("bulk in") ||
      message.includes("bulk out") ||
      message.includes("truyền")
    );
  }

  private findBulkInterface() {
    const configuration = this.requireDevice().configuration;

    if (!configuration) {
      throw new Error("Chưa chọn cấu hình USB EDL.");
    }

    let fallback: { interfaceNumber: number; alternate: BrowserUsbAlternateInterface } | undefined;

    for (const usbInterface of configuration.interfaces) {
      for (const alternate of usbInterface.alternates) {
        const hasBulkIn = alternate.endpoints.some((endpoint) => endpoint.type === "bulk" && endpoint.direction === "in");
        const hasBulkOut = alternate.endpoints.some((endpoint) => endpoint.type === "bulk" && endpoint.direction === "out");

        if (!hasBulkIn || !hasBulkOut) {
          continue;
        }

        const candidate = { interfaceNumber: usbInterface.interfaceNumber, alternate };

        if (alternate.interfaceClass === 0xff || alternate.interfaceClass === 0x0a) {
          return candidate;
        }

        fallback ??= candidate;
      }
    }

    if (fallback) {
      return fallback;
    }

    throw new Error("Không tìm thấy endpoint EDL bulk IN/OUT.");
  }

  private detectEndpoints(alternate: BrowserUsbAlternateInterface) {
    const endpointIn = alternate.endpoints.find((endpoint) => endpoint.type === "bulk" && endpoint.direction === "in");
    const endpointOut = alternate.endpoints.find((endpoint) => endpoint.type === "bulk" && endpoint.direction === "out");

    if (!endpointIn || !endpointOut) {
      throw new Error("Nhận diện endpoint EDL bulk thất bại.");
    }

    this.endpointIn = endpointIn.endpointNumber;
    this.endpointOut = endpointOut.endpointNumber;
  }

  private requireDevice() {
    if (!this.device) {
      throw new WorkflowError("DEVICE_NOT_FOUND", "EDL 9008 chưa kết nối.");
    }

    return this.device;
  }
}
