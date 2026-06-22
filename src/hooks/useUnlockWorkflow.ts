import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAssetBaseUrl } from "../domain/assets";
import { isLegacyFtdModel, legacyAblProvisioning, shouldRunPreUnlockFlashPlan } from "../domain/models";
import type { Manifest, SupportedModel } from "../domain/schemas";
import { BrowserAdbClient } from "../services/adb";
import { CryptoAssetClient } from "../services/cryptoAssetClient";
import { auditDeveloperOverride } from "../services/developerOverrideApi";
import {
  BlazerMockAdbClient,
  BlazerMockAssetClient,
  BlazerMockFastbootClient,
  blazerMockModel,
} from "../services/blazerMock";
import { BrowserFastbootClient, parseFastbootTerminalCommand } from "../services/fastboot";
import {
  authorizeAssetKeys,
  consumeUnlockPass,
  createPaymentOrder,
  getPaymentOrder,
  type PaymentOrder,
  type PaymentTarget,
  type UnlockPass,
} from "../services/paymentApi";
import { errorAdvice, toWorkflowError, WorkflowError, type WorkflowErrorCode } from "../workflow/errors";
import { detectPreflight, isPreflightReady, isWorkflowSafetyReady } from "../workflow/preflight";
import { UnlockWorkflowRunner } from "../workflow/runner";
import {
  isOverrideGateBypassed,
  noOverrideGatePolicy,
  normalizeOverrideGatePolicy,
  type DeveloperOverrideMode,
  type DeviceCompatibilityReport,
  type DeviceStatus,
  type OverrideGateId,
  type OverrideGatePolicy,
  type PhaseId,
  type PhaseProvenance,
  type PhaseStatus,
  type PreflightState,
  type ProgressEvent,
  type TargetDetection,
  type WorkflowLog,
  type WorkflowMode,
} from "../workflow/types";

type DestructivePhase =
  | "boot-permissive"
  | "write-abl"
  | "write-efisp"
  | "cleanup-data"
  | "flash-ftd"
  | "unlock-payload"
  | "restore-gpt";
export type ResumePhase = PhaseId;
type ActiveOverrideMode = Exclude<DeveloperOverrideMode, "none">;

type ApplyDeveloperOverrideSessionOptions = {
  mode: ActiveOverrideMode;
  workflowMode: WorkflowMode;
  modelId: string;
  phase: PhaseId;
  bypassedGates: readonly OverrideGateId[];
};

const destructivePhases: readonly DestructivePhase[] = [
  "boot-permissive",
  "write-abl",
  "write-efisp",
  "cleanup-data",
  "flash-ftd",
  "unlock-payload",
  "restore-gpt",
];
export const resumePhaseOrder: readonly ResumePhase[] = ["prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt"];
export const phaseOrder: readonly PhaseId[] = [
  "preflight",
  "connect-device",
  "prepare-assets",
  "boot-permissive",
  "write-abl",
  "write-efisp",
  "verify-unlock",
  "cleanup-data",
  "flash-ftd",
  "unlock-payload",
  "restore-gpt",
  "finished",
];
const efispPhaseOrder: readonly PhaseId[] = [
  "preflight",
  "connect-device",
  "prepare-assets",
  "boot-permissive",
  "write-efisp",
  "verify-unlock",
  "cleanup-data",
  "finished",
];
const initialPhaseOrder: readonly PhaseId[] = ["preflight", "connect-device", "prepare-assets", "finished"];

export const phaseLabels: Record<PhaseId, string> = {
  preflight: "Kiểm tra ban đầu",
  "connect-device": "Kết nối thiết bị",
  "prepare-assets": "Chuẩn bị tệp",
  "boot-permissive": "Boot Android permissive",
  "write-abl": "Ghi ABL qua MQSAS",
  "write-efisp": "Ghi EFI unlock qua MQSAS",
  "verify-unlock": "Xác minh bootloader",
  "cleanup-data": "Dọn EFISP và dữ liệu",
  "flash-ftd": "Flash gói FTD",
  "unlock-payload": "Chạy payload mở khóa",
  "restore-gpt": "Khôi phục GPT cuối",
  finished: "MiFlash ROM gốc",
};

const initialStatuses = () =>
  Object.fromEntries(phaseOrder.map((phase) => [phase, "pending"])) as Record<PhaseId, PhaseStatus>;

const initialPreflight = (): PreflightState => ({
  ...detectPreflight(),
  backedUp: false,
  acceptsDataLoss: false,
  hasStockRom: false,
});

const initialConfirmations = () =>
  Object.fromEntries(destructivePhases.map((phase) => [phase, false])) as Record<DestructivePhase, boolean>;

const logTime = () =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

const statusesForResume = (phase: PhaseId, visibleOrder: readonly PhaseId[] = phaseOrder) => {
  const selectedIndex = visibleOrder.indexOf(phase);
  const next = initialStatuses();

  if (selectedIndex < 0) {
    return next;
  }

  for (const [index, entry] of visibleOrder.entries()) {
    if (entry !== "finished" && index < selectedIndex) {
      next[entry] = "done";
    }
  }

  return next;
};

const provenanceForResume = (phase: PhaseId, visibleOrder: readonly PhaseId[]) => {
  const selectedIndex = visibleOrder.indexOf(phase);
  const next: Partial<Record<PhaseId, PhaseProvenance>> = {};

  if (selectedIndex < 0) {
    return next;
  }

  for (const [index, entry] of visibleOrder.entries()) {
    if (entry !== "finished" && index < selectedIndex) {
      next[entry] = "manually_assumed";
    }
  }

  return next;
};

const isPhaseComplete = (status: PhaseStatus) => status === "done" || status === "skipped";

export const workflowPhaseOrder = (model?: SupportedModel, workflowMode: WorkflowMode = "standard") => {
  if (model?.family === "efisp-8e-gen5") {
    return efispPhaseOrder;
  }

  if (!model || !isLegacyFtdModel(model)) {
    return initialPhaseOrder;
  }

  const phases: PhaseId[] = ["preflight", "connect-device", "prepare-assets"];

  if (workflowMode === "standard" && legacyAblProvisioning(model) === "mqsas-permissive") {
    phases.push("boot-permissive", "write-abl");
  }

  if (shouldRunPreUnlockFlashPlan(model)) {
    phases.push("flash-ftd");
  }

  phases.push("unlock-payload", "restore-gpt", "verify-unlock", "finished");
  return phases;
};
export const resumePhaseOrderForFamily = () => resumePhaseOrder;

export const useUnlockWorkflow = () => {
  const showAdvancedEdl = import.meta.env.VITE_ALLOW_ADVANCED_EDL === "true";
  const [preflight, setPreflight] = useState<PreflightState>(() => initialPreflight());
  const [statuses, setStatuses] = useState<Record<PhaseId, PhaseStatus>>(() => initialStatuses());
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("disconnected");
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [manifest, setManifest] = useState<Manifest | undefined>();
  const [model, setModel] = useState<SupportedModel | undefined>();
  const [detectedProduct, setDetectedProduct] = useState("");
  const [targetDetection, setTargetDetection] = useState<TargetDetection | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: WorkflowErrorCode; message: string } | undefined>();
  const [progress, setProgress] = useState<ProgressEvent | undefined>();
  const [phaseConfirmations, setPhaseConfirmations] = useState(() => initialConfirmations());
  const [compatibilityReport, setCompatibilityReport] = useState<DeviceCompatibilityReport | undefined>();
  const [compatibilityWarningsAccepted, setCompatibilityWarningsAccepted] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [workflowMode, setWorkflowModeState] = useState<WorkflowMode>("standard");
  const [overrideGatePolicy, setOverrideGatePolicyState] = useState<OverrideGatePolicy>(noOverrideGatePolicy);
  const overrideGatePolicyRef = useRef<OverrideGatePolicy>(noOverrideGatePolicy);
  const [phaseProvenance, setPhaseProvenance] = useState<Partial<Record<PhaseId, PhaseProvenance>>>({});
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | undefined>();
  const [unlockPass, setUnlockPass] = useState<UnlockPass | undefined>();
  const runnerRef = useRef<UnlockWorkflowRunner | undefined>(undefined);
  const paymentAuthRef = useRef<{ target: PaymentTarget; passToken: string } | undefined>(undefined);
  const compatibilityReportKeyRef = useRef("");

  const appendLog = useCallback((log: WorkflowLog) => {
    setLogs((current) => [...current, log].slice(-500));
  }, []);

  const appendSystemLog = useCallback(
    (level: WorkflowLog["level"], message: string) => {
      appendLog({ time: logTime(), level, message });
    },
    [appendLog],
  );

  const handleCompatibilityReport = useCallback((report: DeviceCompatibilityReport) => {
    const nextKey = `${report.modelId}\0${report.warnings.join("\0")}`;

    if (compatibilityReportKeyRef.current !== nextKey) {
      compatibilityReportKeyRef.current = nextKey;
      setCompatibilityWarningsAccepted(false);
    }

    setCompatibilityReport(report);
  }, []);

  const setActiveOverrideGatePolicy = useCallback((policy: OverrideGatePolicy = noOverrideGatePolicy) => {
    const normalized = normalizeOverrideGatePolicy(policy);
    overrideGatePolicyRef.current = normalized;
    setOverrideGatePolicyState(normalized);
    runnerRef.current?.setOverrideGatePolicy(normalized);
  }, []);

  const paymentTarget = useMemo<PaymentTarget | undefined>(() => {
    const serial = targetDetection?.fastbootSerial ?? compatibilityReport?.fastboot?.serial;

    if (!model || targetDetection?.verified !== true || !serial) {
      return undefined;
    }

    return {
      modelId: model.id,
      modelName: model.name,
      product: model.product,
      serial,
    };
  }, [compatibilityReport?.fastboot?.serial, model, targetDetection]);

  const unlockPassReady = useMemo(() => {
    if (mockMode) {
      return true;
    }

    if (!unlockPass || !paymentTarget) {
      return false;
    }

    const nowIso = new Date().toISOString();

    if (unlockPass.status === "active") {
      return unlockPass.expiresAt > nowIso;
    }

    return unlockPass.status === "consumed" && Boolean(unlockPass.retryUntil && unlockPass.retryUntil > nowIso);
  }, [mockMode, paymentTarget, unlockPass]);

  useEffect(() => {
    paymentAuthRef.current =
      paymentTarget && unlockPassReady && unlockPass
        ? { target: paymentTarget, passToken: unlockPass.token }
        : undefined;
  }, [paymentTarget, unlockPass, unlockPassReady]);

  const createRunner = useCallback(
    () =>
      new UnlockWorkflowRunner({
        assets: new CryptoAssetClient(getAssetBaseUrl(), async (paths) => {
          const auth = paymentAuthRef.current;

          if (!auth) {
            if (isOverrideGateBypassed(overrideGatePolicyRef.current, "asset_key_authorization")) {
              throw new WorkflowError(
                "PAYMENT_REQUIRED",
                `Asset key authorization bypassed; encrypted asset keys were not requested for ${paths.join(", ")}.`,
              );
            }

            throw new Error("unlock pass required for asset keys");
          }

          return (await authorizeAssetKeys(auth.passToken, auth.target, paths)).keys;
        }),
        createAdbClient: () => new BrowserAdbClient(),
        createFastbootClient: () => new BrowserFastbootClient(),
        overrideGatePolicy: overrideGatePolicyRef.current,
        onDeviceStatus: setDeviceStatus,
        onPhaseStatus: (phase, status) => {
          setStatuses((current) => ({ ...current, [phase]: status }));
          if (status === "done") {
            setPhaseProvenance((current) => (current[phase] ? current : { ...current, [phase]: "verified" }));
          }
        },
        onProgress: setProgress,
        onModelDetected: (target) => {
          setModel(target.model);
          setDetectedProduct(target.fastbootProduct ?? target.adbProduct ?? target.model.product);
          setTargetDetection(target);
          if (target.model.family === "efisp-8e-gen5") {
            setWorkflowModeState("standard");
          }
        },
        onCompatibilityReport: handleCompatibilityReport,
        onLog: appendLog,
      }),
    [appendLog, handleCompatibilityReport],
  );

  useEffect(() => {
    let cancelled = false;
    const nextPreflight = initialPreflight();

    setPreflight(nextPreflight);
    setStatuses(initialStatuses());
    setDeviceStatus("disconnected");
    setLogs([]);
    setManifest(undefined);
    setModel(undefined);
    setDetectedProduct("");
    setTargetDetection(undefined);
    setBusy(false);
    setError(undefined);
    setProgress(undefined);
    setPhaseConfirmations(initialConfirmations());
    setPhaseProvenance({});
    compatibilityReportKeyRef.current = "";
    setCompatibilityReport(undefined);
    setCompatibilityWarningsAccepted(false);
    setMockMode(false);
    setPaymentOrder(undefined);
    setUnlockPass(undefined);
    setActiveOverrideGatePolicy(noOverrideGatePolicy);

    const runner = createRunner();
    runner.setWorkflowMode(workflowMode);
    runnerRef.current = runner;
    runner
      .initialize()
      .then((loadedManifest) => {
        if (cancelled) {
          return;
        }

        setManifest(loadedManifest);
        setStatuses((current) => ({
          ...current,
          preflight: isPreflightReady(nextPreflight) ? "done" : "pending",
        }));
      })
      .catch((cause) => {
        if (cancelled) {
          return;
        }

        const workflowError = toWorkflowError(cause, "MANIFEST_INVALID");
        setError({ code: workflowError.code, message: workflowError.message });
        setStatuses((current) => ({ ...current, preflight: "failed" }));
      });

    return () => {
      cancelled = true;
    };
  }, [createRunner, setActiveOverrideGatePolicy]);

  useEffect(() => {
    setStatuses((current) => ({
      ...current,
      preflight: isPreflightReady(preflight) && manifest ? "done" : current.preflight === "failed" ? "failed" : "pending",
    }));
  }, [manifest, preflight]);

  const visiblePhaseOrder = useMemo(() => workflowPhaseOrder(model, workflowMode), [model, workflowMode]);
  const visibleResumePhaseOrder = useMemo(
    () => visiblePhaseOrder.filter((phase) => phase !== "finished") as PhaseId[],
    [visiblePhaseOrder],
  );

  const nextPhase = useMemo(() => {
    if (!manifest) {
      return "preflight";
    }

    if (!isPhaseComplete(statuses["connect-device"])) {
      return "connect-device";
    }

    return (
      visiblePhaseOrder.find(
        (phase) => phase !== "preflight" && phase !== "connect-device" && !isPhaseComplete(statuses[phase]),
      ) ?? "finished"
    );
  }, [manifest, statuses, visiblePhaseOrder]);

  const requiresConfirmation = destructivePhases.includes(nextPhase as DestructivePhase);
  const requiresPreflightReady = destructivePhases.includes(nextPhase as DestructivePhase);
  const requiresCompatibilityWarningAcceptance =
    destructivePhases.includes(nextPhase as DestructivePhase) && compatibilityReport?.verdict === "warning";
  const preflightGateBypassed = isOverrideGateBypassed(overrideGatePolicy, "preflight");
  const paymentGateBypassed = isOverrideGateBypassed(overrideGatePolicy, "payment");
  const confirmationGateBypassed = isOverrideGateBypassed(overrideGatePolicy, "destructive_confirmation");
  const compatibilityGateBypassed = isOverrideGateBypassed(overrideGatePolicy, "compatibility");
  const modelVerificationGateBypassed = isOverrideGateBypassed(overrideGatePolicy, "model_verification");
  const effectiveSafetyMode = model?.family === "efisp-8e-gen5" ? "standard" : workflowMode;
  const destructiveSafetyReady = isWorkflowSafetyReady(preflight, effectiveSafetyMode);
  const requiresPaymentReady =
    !mockMode && nextPhase !== "preflight" && nextPhase !== "connect-device" && nextPhase !== "finished";

  const mainButton = useMemo(() => {
    if (busy) {
      return "Đang chạy";
    }

    const labels: Record<PhaseId, string> = {
      preflight: "Kết nối thiết bị",
      "connect-device": "Kết nối thiết bị",
      "prepare-assets": model?.family === "efisp-8e-gen5" ? "Tải và kiểm tra EFI unlock" : "Tải và kiểm tra tệp unlock/ROM",
      "boot-permissive": "Boot Android permissive",
      "write-abl": "Ket noi ADB va ghi ABL",
      "write-efisp": "Kết nối ADB và ghi EFISP",
      "verify-unlock": "Kết nối Fastboot và kiểm tra unlock",
      "cleanup-data": "Xóa EFISP, metadata và userdata",
      "flash-ftd": "Kết nối Fastboot và flash FTD",
      "unlock-payload": "Chạy payload mở khóa",
      "restore-gpt": "Khôi phục GPT cuối",
      finished: "Tải nhật ký",
    };

    return labels[nextPhase];
  }, [busy, model?.family, nextPhase]);

  const canRun =
    !busy &&
    manifest !== undefined &&
    nextPhase !== "preflight" &&
    nextPhase !== "connect-device" &&
    (!requiresPreflightReady || destructiveSafetyReady || preflightGateBypassed) &&
    (!requiresPaymentReady || unlockPassReady || paymentGateBypassed) &&
    (!requiresCompatibilityWarningAcceptance || compatibilityWarningsAccepted || compatibilityGateBypassed) &&
    (requiresConfirmation ? phaseConfirmations[nextPhase as DestructivePhase] || confirmationGateBypassed : true);

  const canConnectEntry =
    !busy &&
    manifest !== undefined &&
    nextPhase === "connect-device" &&
    preflight.isHttps &&
    preflight.hasWebUsb;

  const awaitingFastbootVerification =
    targetDetection?.source === "adb" && !targetDetection.verified && statuses["connect-device"] !== "done";

  const canConnectFastbootEntry = canConnectEntry && (awaitingFastbootVerification || showAdvancedEdl);

  const canDisconnect = !busy && runnerRef.current !== undefined;
  const canRunFastbootTerminalCommand = !busy && preflight.isHttps && preflight.hasWebUsb && runnerRef.current !== undefined;
  const canPrepareAssetsEarly =
    !busy &&
    manifest !== undefined &&
    runnerRef.current !== undefined &&
    model !== undefined &&
    (targetDetection?.verified === true || modelVerificationGateBypassed) &&
    (unlockPassReady || paymentGateBypassed) &&
    statuses["prepare-assets"] !== "done" &&
    statuses["prepare-assets"] !== "running";
  const canSwitchWorkflowMode =
    !busy &&
    model?.family !== "efisp-8e-gen5" &&
    !isPhaseComplete(statuses["boot-permissive"]) &&
    !isPhaseComplete(statuses["write-abl"]) &&
    !isPhaseComplete(statuses["flash-ftd"]) &&
    !isPhaseComplete(statuses["unlock-payload"]) &&
    !isPhaseComplete(statuses["restore-gpt"]);

  const resetSession = useCallback(async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      await runnerRef.current?.disconnectSession();
    } catch (cause) {
      const workflowError = toWorkflowError(cause);
      setError({ code: workflowError.code, message: workflowError.message });
    }

    const nextPreflight: PreflightState = {
      ...detectPreflight(),
      backedUp: preflight.backedUp,
      acceptsDataLoss: preflight.acceptsDataLoss,
      hasStockRom: preflight.hasStockRom,
    };

    setPreflight(nextPreflight);
    setStatuses(initialStatuses());
    setDeviceStatus("disconnected");
    setLogs([]);
    setManifest(undefined);
    setModel(undefined);
    setDetectedProduct("");
    setTargetDetection(undefined);
    setProgress(undefined);
    setPhaseConfirmations(initialConfirmations());
    setPhaseProvenance({});
    compatibilityReportKeyRef.current = "";
    setCompatibilityReport(undefined);
    setCompatibilityWarningsAccepted(false);
    setMockMode(false);
    setPaymentOrder(undefined);
    setUnlockPass(undefined);
    appendSystemLog("info", "Reset session: da ngat browser USB, giu nguyen ROM cache trong IndexedDB.");

    const runner = createRunner();
    runner.setWorkflowMode(workflowMode);
    runnerRef.current = runner;

    try {
      const loadedManifest = await runner.initialize();
      setManifest(loadedManifest);
      setStatuses((current) => ({
        ...current,
        preflight: isPreflightReady(nextPreflight) ? "done" : "pending",
      }));
    } catch (cause) {
      const workflowError = toWorkflowError(cause, "MANIFEST_INVALID");
      setError({ code: workflowError.code, message: workflowError.message });
      setStatuses((current) => ({ ...current, preflight: "failed" }));
    } finally {
      setBusy(false);
    }
  }, [
    appendSystemLog,
    busy,
    createRunner,
    preflight.acceptsDataLoss,
    preflight.backedUp,
    preflight.hasStockRom,
    workflowMode,
  ]);

  const startBlazerMock = useCallback(async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(undefined);
    setMockMode(true);
    setWorkflowModeState("standard");
    setLogs([]);
    setProgress(undefined);
    setPhaseProvenance({});
    compatibilityReportKeyRef.current = "";
    setCompatibilityReport(undefined);
    setCompatibilityWarningsAccepted(false);

    const nextPreflight: PreflightState = {
      isHttps: true,
      hasWebUsb: true,
      backedUp: true,
      acceptsDataLoss: true,
      hasStockRom: true,
    };

    const runner = new UnlockWorkflowRunner({
      assets: new BlazerMockAssetClient(),
      createAdbClient: () => new BlazerMockAdbClient(),
      createFastbootClient: () => new BlazerMockFastbootClient(),
      overrideGatePolicy: noOverrideGatePolicy,
      onDeviceStatus: setDeviceStatus,
      onPhaseStatus: (phase, status) => setStatuses((current) => ({ ...current, [phase]: status })),
      onProgress: setProgress,
      onModelDetected: (target) => {
        setModel(target.model);
        setDetectedProduct(target.fastbootProduct ?? target.adbProduct ?? target.model.product);
        setTargetDetection(target);
      },
      onCompatibilityReport: handleCompatibilityReport,
      onLog: appendLog,
    });

    runnerRef.current = runner;

    try {
      const loadedManifest = await runner.initialize();
      runner.overrideTargetModel(blazerMockModel);
      setPreflight(nextPreflight);
      setManifest(loadedManifest);
      setStatuses(statusesForResume("prepare-assets"));
      setDeviceStatus("fastboot");
      setModel(blazerMockModel);
      setDetectedProduct("blazer -> xuanyuan");
      setTargetDetection({
        model: blazerMockModel,
        adbProduct: "blazer",
        fastbootProduct: "xuanyuan",
        fastbootSerial: "mock-fastboot",
        source: "override",
        verified: true,
      });
      setCompatibilityReport({
        modelId: blazerMockModel.id,
        modelName: blazerMockModel.name,
        product: blazerMockModel.product,
        chip: "chip" in blazerMockModel ? blazerMockModel.chip : undefined,
        verdict: "compatible",
        warnings: [],
        adb: {
          productProps: {
            "ro.product.device": "blazer",
            "ro.product.vendor.device": "blazer",
            "ro.build.product": "blazer",
          },
          androidRelease: "mock",
          securityPatch: "2025-01-01",
        },
        fastboot: {
          product: "xuanyuan",
          serial: "mock-fastboot",
          anti: "0",
          verifiedWithAdb: true,
        },
      });
      setPhaseConfirmations({
        ...initialConfirmations(),
        "boot-permissive": true,
        "write-abl": true,
        "unlock-payload": true,
        "restore-gpt": true,
      });
      appendSystemLog("warn", "MOCK blazer mode: khong goi WebUSB that, khong flash that, dung fixture Xiaomi 15 Ultra.");
      await runner.prepareAssetsForSelectedModel();
      await runner.bootLegacyAblPermissive(true);
      await runner.writeLegacyAblViaMqsas(true);
      await runner.runUnlockPayload(true);
      await runner.restoreFinalGpt(true);
      await runner.verifyLegacyUnlock();
      setStatuses((current) => ({ ...current, finished: "done" }));
      appendSystemLog("success", "MOCK blazer flow da chay het; day chi la mo phong UI/log/progress.");
    } catch (cause) {
      const workflowError = toWorkflowError(cause);
      setError({ code: workflowError.code, message: workflowError.message });
    } finally {
      setBusy(false);
    }
  }, [appendLog, appendSystemLog, busy, handleCompatibilityReport]);

  const setWorkflowMode = useCallback(
    (mode: WorkflowMode) => {
      if (!canSwitchWorkflowMode) {
        return;
      }

      if (mode === "edl-standard" && !showAdvancedEdl) {
        appendSystemLog("warn", "EDL_Standard dang bi an; bat VITE_ALLOW_ADVANCED_EDL=true cho phien ky thuat.");
        return;
      }

      runnerRef.current?.setWorkflowMode(mode);
      setWorkflowModeState(mode);
      setProgress(undefined);
      setError(undefined);
      appendSystemLog("warn", `Workflow mode: ${mode}.`);
    },
    [appendSystemLog, canSwitchWorkflowMode, showAdvancedEdl],
  );

  const auditOverrideTechnicalCommand = useCallback(
    (phase: PhaseId | string, result: "ok" | "failed" | "blocked" | "cancelled" | "bypassed", metadata?: Record<string, unknown>) => {
      const policy = overrideGatePolicyRef.current;

      if (policy.mode === "none") {
        return;
      }

      void auditDeveloperOverride({
        eventType: "technical_command",
        mode: policy.mode as ActiveOverrideMode,
        workflowMode,
        modelId: model?.id,
        phase,
        bypassedGates: policy.bypassedGates,
        commandType: "workflow",
        result,
        metadata,
      }).catch(() => {
        appendSystemLog("warn", "Developer override audit failed for workflow command.");
      });
    },
    [appendSystemLog, model?.id, workflowMode],
  );

  const applyDeveloperOverrideSession = useCallback(
    (options: ApplyDeveloperOverrideSessionOptions) => {
      if (!manifest || busy || !runnerRef.current) {
        return false;
      }

      const overrideModel = manifest.models.find((entry) => entry.id === options.modelId);

      if (!overrideModel) {
        return false;
      }

      const nextWorkflowMode = options.workflowMode === "edl-standard" && !showAdvancedEdl ? "standard" : options.workflowMode;
      const nextPolicy = normalizeOverrideGatePolicy({
        mode: options.mode,
        bypassedGates: options.mode === "selective_bypass" ? options.bypassedGates : [],
      });
      const nextVisibleOrder = workflowPhaseOrder(overrideModel, nextWorkflowMode);
      const nextPhase = nextVisibleOrder.includes(options.phase) ? options.phase : nextVisibleOrder[0] ?? "preflight";

      runnerRef.current.setWorkflowMode(nextWorkflowMode);
      runnerRef.current.assumeTargetModel(overrideModel);
      setActiveOverrideGatePolicy(nextPolicy);
      setWorkflowModeState(nextWorkflowMode);
      setStatuses(statusesForResume(nextPhase, nextVisibleOrder));
      setPhaseProvenance(provenanceForResume(nextPhase, nextVisibleOrder));
      setModel(overrideModel);
      setDetectedProduct(overrideModel.product);
      setTargetDetection({
        model: overrideModel,
        fastbootProduct: overrideModel.product,
        fastbootSerial: undefined,
        source: "override",
        verified: false,
        provenance: "manually_assumed",
      });
      setProgress(undefined);
      setError(undefined);
      setPaymentOrder(undefined);
      setUnlockPass(undefined);
      setCompatibilityWarningsAccepted(false);
      setPhaseConfirmations(initialConfirmations());
      appendSystemLog("warn", `Developer override resume: ${overrideModel.name} -> ${nextPhase}.`);
      appendSystemLog("warn", "Developer override resume: previous phases are manually assumed, not verified.");
      if (nextPolicy.bypassedGates.length > 0) {
        appendSystemLog("warn", `Developer override bypassed gates: ${nextPolicy.bypassedGates.join(", ")}.`);
      }

      return true;
    },
    [appendSystemLog, busy, manifest, setActiveOverrideGatePolicy, showAdvancedEdl],
  );

  const clearDeveloperOverride = useCallback(() => {
    if (overrideGatePolicyRef.current.mode !== "none") {
      appendSystemLog("warn", "Developer override session inactive; gate policy cleared.");
    }
    setActiveOverrideGatePolicy(noOverrideGatePolicy);
    setPhaseProvenance({});
  }, [appendSystemLog, setActiveOverrideGatePolicy]);

  const applyDeveloperOverride = useCallback(
    (modelId: string, phase: ResumePhase) => {
      applyDeveloperOverrideSession({
        mode: "resume",
        workflowMode,
        modelId,
        phase,
        bypassedGates: [],
      });
    },
    [applyDeveloperOverrideSession, workflowMode],
  );

  const runWorkflowAction = useCallback(async (work: () => Promise<unknown>) => {
    if (!runnerRef.current) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      await work();
    } catch (cause) {
      const workflowError = toWorkflowError(cause);
      setError({ code: workflowError.code, message: workflowError.message });
    } finally {
      setBusy(false);
    }
  }, []);

  const createUnlockPayment = useCallback(async () => {
    if (!paymentTarget || busy) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      const result = await createPaymentOrder(paymentTarget);
      setPaymentOrder(result.order);
      setUnlockPass(result.pass);
      appendSystemLog("success", `Da tao don payOS ${result.order.amount} ${result.order.currency}: ${result.order.orderCode}.`);
    } catch (cause) {
      const workflowError = toWorkflowError(cause, "PAYMENT_REQUIRED");
      setError({ code: workflowError.code, message: workflowError.message });
    } finally {
      setBusy(false);
    }
  }, [appendSystemLog, busy, paymentTarget]);

  const refreshUnlockPayment = useCallback(async () => {
    if (!paymentOrder || busy) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      const result = await getPaymentOrder(paymentOrder.id);
      setPaymentOrder(result.order);
      setUnlockPass(result.pass);
      if (result.pass) {
        appendSystemLog("success", `Unlock pass san sang cho ${result.pass.serial}/${result.pass.modelId}.`);
      }
    } catch (cause) {
      const workflowError = toWorkflowError(cause, "PAYMENT_REQUIRED");
      setError({ code: workflowError.code, message: workflowError.message });
    } finally {
      setBusy(false);
    }
  }, [appendSystemLog, busy, paymentOrder]);

  const ensurePassConsumedForDangerousPhase = useCallback(async () => {
    if (mockMode || !destructivePhases.includes(nextPhase as DestructivePhase)) {
      return;
    }

    if (isOverrideGateBypassed(overrideGatePolicyRef.current, "payment")) {
      appendSystemLog("warn", "Developer override bypassed payment: unlock pass was not consumed for this dangerous phase.");
      return;
    }

    if (!paymentTarget || !unlockPass) {
      throw new Error("unlock pass required before dangerous phase");
    }

    if (unlockPass.status === "consumed") {
      return;
    }

    const result = await consumeUnlockPass(unlockPass.token, paymentTarget);
    setUnlockPass(result.pass);
    appendSystemLog(
      "success",
      result.mode === "retry" ? "Unlock pass retry window hop le." : "Unlock pass da duoc consume truoc buoc nguy hiem.",
    );
  }, [appendSystemLog, mockMode, nextPhase, paymentTarget, unlockPass]);

  const ensurePassConsumedForManualFastbootCommand = useCallback(
    async (command: string, confirmed: boolean) => {
      if (mockMode || !confirmed) {
        return;
      }

      const parsed = parseFastbootTerminalCommand(command);
      const destructiveCommand = parsed.kind === "erase" || parsed.kind === "setActive" || parsed.kind === "raw";

      if (!destructiveCommand) {
        return;
      }

      if (isOverrideGateBypassed(overrideGatePolicyRef.current, "payment")) {
        appendSystemLog("warn", "Developer override bypassed payment: unlock pass was not consumed for this Fastboot command.");
        return;
      }

      if (!paymentTarget || !unlockPass) {
        throw new Error("unlock pass required before destructive fastboot command");
      }

      if (unlockPass.status === "consumed") {
        return;
      }

      const result = await consumeUnlockPass(unlockPass.token, paymentTarget);
      setUnlockPass(result.pass);
      appendSystemLog(
        "success",
        result.mode === "retry"
          ? "Unlock pass retry window hop le cho lenh Fastboot thu cong."
          : "Unlock pass da duoc consume truoc lenh Fastboot thu cong nguy hiem.",
      );
    },
    [appendSystemLog, mockMode, paymentTarget, unlockPass],
  );

  const runFastbootTerminalCommand = useCallback(
    async (command: string, confirmed = false) => {
      if (!runnerRef.current || !canRunFastbootTerminalCommand) {
        return;
      }

      await runWorkflowAction(async () => {
        try {
          await ensurePassConsumedForManualFastbootCommand(command, confirmed);
          await runnerRef.current!.runFastbootTerminalCommand(command, confirmed);
          auditOverrideTechnicalCommand("fastboot-terminal", "ok", { confirmed, commandKind: parseFastbootTerminalCommand(command).kind });
        } catch (error) {
          auditOverrideTechnicalCommand("fastboot-terminal", "failed", { confirmed });
          throw error;
        }
      });
    },
    [auditOverrideTechnicalCommand, canRunFastbootTerminalCommand, ensurePassConsumedForManualFastbootCommand, runWorkflowAction],
  );

  const prepareAssetsEarly = useCallback(async () => {
    if (!runnerRef.current || !canPrepareAssetsEarly) {
      return;
    }

    await runWorkflowAction(() => runnerRef.current!.prepareAssetsForSelectedModel());
  }, [canPrepareAssetsEarly, runWorkflowAction]);

  const connectAdbEntry = useCallback(async () => {
    if (!canConnectEntry || !runnerRef.current) {
      return;
    }

    await runWorkflowAction(() => runnerRef.current!.connectInitialAdb());
  }, [canConnectEntry, runWorkflowAction]);

  const connectFastbootEntry = useCallback(async () => {
    if (!canConnectFastbootEntry || !runnerRef.current) {
      return;
    }

    await runWorkflowAction(() => runnerRef.current!.connectFastboot());
  }, [canConnectFastbootEntry, runWorkflowAction]);

  const runNext = useCallback(async () => {
    if (nextPhase === "finished" || !runnerRef.current || !canRun) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      if (nextPhase === "prepare-assets") {
        await runnerRef.current.prepareAssetsForSelectedModel();
      } else if (nextPhase === "boot-permissive") {
        await ensurePassConsumedForDangerousPhase();
        if (model?.family === "efisp-8e-gen5") {
          await runnerRef.current.bootEfispPermissive(phaseConfirmations["boot-permissive"]);
        } else {
          await runnerRef.current.bootLegacyAblPermissive(phaseConfirmations["boot-permissive"]);
        }
      } else if (nextPhase === "write-abl") {
        await ensurePassConsumedForDangerousPhase();
        await runnerRef.current.writeLegacyAblViaMqsas(phaseConfirmations["write-abl"]);
      } else if (nextPhase === "write-efisp") {
        await ensurePassConsumedForDangerousPhase();
        await runnerRef.current.writeEfispUnlock(phaseConfirmations["write-efisp"]);
      } else if (nextPhase === "verify-unlock") {
        if (model?.family === "efisp-8e-gen5") {
          await runnerRef.current.verifyEfispUnlock();
        } else {
          await runnerRef.current.verifyLegacyUnlock();
          setStatuses((current) => ({ ...current, finished: "done" }));
        }
      } else if (nextPhase === "cleanup-data") {
        await ensurePassConsumedForDangerousPhase();
        await runnerRef.current.cleanupEfispData(phaseConfirmations["cleanup-data"]);
        setStatuses((current) => ({ ...current, finished: "done" }));
      } else if (nextPhase === "flash-ftd") {
        await ensurePassConsumedForDangerousPhase();
        await runnerRef.current.flashFtdPackage(phaseConfirmations["flash-ftd"]);
      } else if (nextPhase === "unlock-payload") {
        await ensurePassConsumedForDangerousPhase();
        await runnerRef.current.runUnlockPayload(phaseConfirmations["unlock-payload"]);
      } else if (nextPhase === "restore-gpt") {
        await ensurePassConsumedForDangerousPhase();
        await runnerRef.current.restoreFinalGpt(phaseConfirmations["restore-gpt"]);
      }
      auditOverrideTechnicalCommand(nextPhase, "ok");
    } catch (cause) {
      const workflowError = toWorkflowError(cause);
      setError({ code: workflowError.code, message: workflowError.message });
      auditOverrideTechnicalCommand(nextPhase, "failed", { code: workflowError.code });
    } finally {
      setBusy(false);
    }
  }, [auditOverrideTechnicalCommand, canRun, ensurePassConsumedForDangerousPhase, model?.family, nextPhase, phaseConfirmations]);

  const downloadLog = useCallback(() => {
    const text = logs.map((log) => `[${log.time}] ${log.level.toUpperCase()} ${log.message}`).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `xiaomi-webusb-unlock-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  return {
    preflight,
    setPreflight,
    statuses,
    phaseProvenance,
    deviceStatus,
    logs,
    manifest,
    model,
    detectedProduct,
    targetDetection,
    compatibilityReport,
    paymentOrder,
    unlockPass,
    paymentTarget,
    paymentRequired: requiresPaymentReady,
    paymentReady: unlockPassReady,
    canCreatePayment: Boolean(paymentTarget && !unlockPassReady && !busy),
    createUnlockPayment,
    refreshUnlockPayment,
    compatibilityWarningsAccepted,
    setCompatibilityWarningsAccepted,
    awaitingFastbootVerification,
    busy,
    error,
    progress,
    workflowMode,
    overrideGatePolicy,
    visiblePhaseOrder,
    visibleResumePhaseOrder,
    canRebootAdbToFastboot: false,
    canPrepareAssetsEarly,
    canSwitchWorkflowMode,
    setWorkflowMode,
    applyDeveloperOverrideSession,
    clearDeveloperOverride,
    phaseConfirmations,
    setPhaseConfirmations,
    nextPhase,
    requiresConfirmation,
    canRun,
    canConnectEntry,
    canConnectFastbootEntry,
    canDisconnect,
    canRunFastbootTerminalCommand,
    mockMode,
    showAdvancedEdl,
    mainButton,
    runNext,
    rebootAdbToFastboot: async () => undefined,
    prepareAssetsEarly,
    runFastbootTerminalCommand,
    connectAdbEntry,
    connectFastbootEntry,
    resetSession,
    startBlazerMock,
    applyDeveloperOverride,
    downloadLog,
    errorAdvice: error ? errorAdvice[error.code] : undefined,
  };
};
