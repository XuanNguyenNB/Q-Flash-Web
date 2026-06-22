import type { AdbClient } from "../services/adb";
import type { AssetClient } from "../services/assetClient";
import type { FastbootClient } from "../services/fastboot";
import type { SupportedModel } from "../domain/schemas";

export type DeviceStatus = "disconnected" | "fastboot" | "adb" | "edl" | "firehose" | "waiting-manual-reboot";

export type WorkflowMode = "standard" | "edl-standard";

export type CompatibilityVerdict = "compatible" | "warning" | "unknown";

export type AdbVersionInfo = {
  productProps: Partial<Record<string, string>>;
  androidRelease?: string;
  securityPatch?: string;
  incremental?: string;
  miuiVersionName?: string;
  miuiVersionCode?: string;
  hyperOsVersionName?: string;
  hyperOsVersionCode?: string;
};

export type FastbootVersionInfo = {
  product?: string;
  serial?: string;
  anti?: string;
  verifiedWithAdb?: boolean;
  productMatch?: "exact" | "post-abl-alias";
  canonicalProduct?: string;
};

export type DeviceCompatibilityReport = {
  modelId: string;
  modelName: string;
  product: string;
  chip?: string;
  verdict: CompatibilityVerdict;
  warnings: string[];
  adb?: AdbVersionInfo;
  fastboot?: FastbootVersionInfo;
};

export type PhaseId =
  | "preflight"
  | "connect-device"
  | "prepare-assets"
  | "boot-permissive"
  | "write-abl"
  | "write-efisp"
  | "verify-unlock"
  | "cleanup-data"
  | "flash-ftd"
  | "unlock-payload"
  | "restore-gpt"
  | "finished";

export type PhaseStatus = "pending" | "running" | "done" | "failed" | "skipped";
export type PhaseProvenance = "verified" | "manually_assumed" | "bypassed";

export type DeveloperOverrideMode = "none" | "resume" | "selective_bypass" | "full_override";

export const overrideGateIds = [
  "model_verification",
  "preflight",
  "payment",
  "destructive_confirmation",
  "asset_verification",
  "asset_key_authorization",
  "antirollback",
  "compatibility",
  "fastboot_product",
  "efisp_unlock_verification",
] as const;

export type OverrideGateId = (typeof overrideGateIds)[number];

export type OverrideGatePolicy = {
  mode: DeveloperOverrideMode;
  bypassedGates: readonly OverrideGateId[];
};

const emptyOverrideGates: readonly OverrideGateId[] = Object.freeze([]);

export const noOverrideGatePolicy: OverrideGatePolicy = Object.freeze({
  mode: "none",
  bypassedGates: emptyOverrideGates,
});

export const normalizeOverrideGatePolicy = (policy?: OverrideGatePolicy): OverrideGatePolicy => {
  if (!policy || policy.mode === "none") {
    return noOverrideGatePolicy;
  }

  const bypassedGates =
    policy.mode === "full_override"
      ? overrideGateIds
      : overrideGateIds.filter((gate) => policy.bypassedGates.includes(gate));

  return {
    mode: policy.mode,
    bypassedGates,
  };
};

export const isOverrideGateBypassed = (policy: OverrideGatePolicy | undefined, gate: OverrideGateId) =>
  Boolean(normalizeOverrideGatePolicy(policy).bypassedGates.includes(gate));

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
  provenance?: PhaseProvenance;
};

export type WorkflowCallbacks = {
  onDeviceStatus?: (status: DeviceStatus) => void;
  onPhaseStatus?: (phase: PhaseId, status: PhaseStatus) => void;
  onProgress?: (event: ProgressEvent) => void;
  onModelDetected?: (target: TargetDetection) => void;
  onCompatibilityReport?: (report: DeviceCompatibilityReport) => void;
  onLog?: (log: WorkflowLog) => void;
};

export type WorkflowDependencies = WorkflowCallbacks & {
  assets: AssetClient;
  createFastbootClient: () => FastbootClient;
  createAdbClient: () => AdbClient;
  overrideGatePolicy?: OverrideGatePolicy;
};

export type PreflightState = {
  isHttps: boolean;
  hasWebUsb: boolean;
  backedUp: boolean;
  acceptsDataLoss: boolean;
  hasStockRom: boolean;
};
