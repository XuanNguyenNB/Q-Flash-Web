import type { AdbClient } from "../services/adb";
import type { AssetClient } from "../services/assetClient";
import type { FastbootClient } from "../services/fastboot";
import type { SupportedModel } from "../domain/schemas";

export type DeviceStatus = "disconnected" | "fastboot" | "adb" | "edl" | "firehose" | "waiting-manual-reboot";

export type WorkflowMode = "standard" | "edl-standard";

export type PhaseId =
  | "preflight"
  | "connect-device"
  | "prepare-assets"
  | "flash-ftd"
  | "unlock-payload"
  | "restore-gpt"
  | "finished";

export type PhaseStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type ProgressEvent = {
  label: string;
  path?: string;
  completedFiles?: number;
  totalFiles?: number;
  receivedBytes?: number;
  totalBytes?: number;
  fileReceivedBytes?: number;
  fileTotalBytes?: number;
  bytesPerSecond?: number;
  etaSeconds?: number;
  state?:
    | "checking-cache"
    | "cached"
    | "downloading"
    | "verifying"
    | "stored"
    | "flashing"
    | "booting"
    | "sahara"
    | "configuring";
  progress?: number;
  overallProgress?: number;
  itemProgress?: number;
  itemLabel?: string;
  completedItems?: number;
  totalItems?: number;
};

export type WorkflowLog = {
  time: string;
  level: "info" | "success" | "warn" | "error" | "command";
  message: string;
};

export type TargetDetection = {
  model: SupportedModel;
  adbProduct?: string;
  fastbootProduct?: string;
  fastbootSerial?: string;
  source: "adb" | "fastboot" | "verified" | "override";
  verified: boolean;
};

export type WorkflowCallbacks = {
  onDeviceStatus?: (status: DeviceStatus) => void;
  onPhaseStatus?: (phase: PhaseId, status: PhaseStatus) => void;
  onProgress?: (event: ProgressEvent) => void;
  onModelDetected?: (target: TargetDetection) => void;
  onLog?: (log: WorkflowLog) => void;
};

export type WorkflowDependencies = WorkflowCallbacks & {
  assets: AssetClient;
  createFastbootClient: () => FastbootClient;
  createAdbClient: () => AdbClient;
};

export type PreflightState = {
  isHttps: boolean;
  hasWebUsb: boolean;
  backedUp: boolean;
  acceptsDataLoss: boolean;
  hasStockRom: boolean;
};
