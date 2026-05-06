import type { AdbClient } from "../services/adb";
import type { AssetClient } from "../services/assetClient";
import type { EdlClient } from "../services/edl";
import type { FastbootClient } from "../services/fastboot";
import type { SupportedModel } from "../domain/schemas";

export type DeviceStatus = "disconnected" | "fastboot" | "adb" | "edl" | "firehose" | "waiting-manual-reboot";

export type WorkflowFamily = "efisp-8e-gen5" | "legacy-ftd";

export type WorkflowMode = "standard-mqsas" | "c06-edl";

export type PhaseId =
  | "preflight"
  | "connect-device"
  | "prepare-assets"
  | "boot-permissive"
  | "write-efisp"
  | "verify-unlock"
  | "cleanup-data"
  | "downgrade-abl"
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
  createEdlClient: () => EdlClient;
};

export type PreflightState = {
  isHttps: boolean;
  hasWebUsb: boolean;
  backedUp: boolean;
  acceptsDataLoss: boolean;
  hasStockRom: boolean;
};
