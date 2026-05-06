import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAssetBaseUrl } from "../domain/assets";
import type { Manifest, SupportedModel } from "../domain/schemas";
import { BrowserAdbClient } from "../services/adb";
import { ServerAssetClient } from "../services/assetClient";
import {
  BlazerMockAdbClient,
  BlazerMockAssetClient,
  BlazerMockEdlClient,
  BlazerMockFastbootClient,
  blazerMockModel,
} from "../services/blazerMock";
import { BrowserEdlClient } from "../services/edl";
import { BrowserFastbootClient } from "../services/fastboot";
import { errorAdvice, toWorkflowError, type WorkflowErrorCode } from "../workflow/errors";
import { detectPreflight, isPreflightReady } from "../workflow/preflight";
import { UnlockWorkflowRunner } from "../workflow/runner";
import type {
  DeviceStatus,
  PhaseId,
  PhaseStatus,
  PreflightState,
  ProgressEvent,
  TargetDetection,
  WorkflowLog,
  WorkflowFamily,
  WorkflowMode,
} from "../workflow/types";

type DestructivePhase =
  | "write-efisp"
  | "cleanup-data"
  | "downgrade-abl"
  | "flash-ftd"
  | "unlock-payload"
  | "restore-gpt";
export type ResumePhase =
  | "prepare-assets"
  | "boot-permissive"
  | "write-efisp"
  | "verify-unlock"
  | "cleanup-data"
  | "downgrade-abl"
  | "flash-ftd"
  | "unlock-payload"
  | "restore-gpt";

const destructivePhases: readonly DestructivePhase[] = [
  "write-efisp",
  "cleanup-data",
  "downgrade-abl",
  "flash-ftd",
  "unlock-payload",
  "restore-gpt",
];

const fastbootRequiredPhases: readonly PhaseId[] = [
  "boot-permissive",
  "verify-unlock",
  "cleanup-data",
  "flash-ftd",
  "unlock-payload",
  "restore-gpt",
];

export const resumePhaseOrder: readonly ResumePhase[] = [
  "prepare-assets",
  "boot-permissive",
  "write-efisp",
  "verify-unlock",
  "cleanup-data",
  "downgrade-abl",
  "flash-ftd",
  "unlock-payload",
  "restore-gpt",
];

export const phaseOrder: readonly PhaseId[] = [
  "preflight",
  "connect-device",
  "prepare-assets",
  "boot-permissive",
  "write-efisp",
  "verify-unlock",
  "cleanup-data",
  "downgrade-abl",
  "flash-ftd",
  "unlock-payload",
  "restore-gpt",
  "finished",
];

export const phaseLabels: Record<PhaseId, string> = {
  preflight: "Kiểm tra ban đầu",
  "connect-device": "Kết nối thiết bị",
  "prepare-assets": "Chuẩn bị tệp ROM",
  "boot-permissive": "Boot Android permissive",
  "write-efisp": "Ghi EFISP unlock",
  "verify-unlock": "Xac minh unlocked",
  "cleanup-data": "Xoa EFISP/du lieu",
  "downgrade-abl": "Hạ ABL",
  "flash-ftd": "Flash gói FTD",
  "unlock-payload": "Chạy payload mở khóa",
  "restore-gpt": "Khôi phục GPT cuối",
  finished: "MiFlash ROM gốc",
};

const initialStatuses = () =>
  Object.fromEntries(phaseOrder.map((phase) => [phase, phase === "preflight" ? "running" : "pending"])) as Record<
    PhaseId,
    PhaseStatus
  >;

const statusesForWorkflow = (family: WorkflowFamily, mode: WorkflowMode) => {
  const statuses = initialStatuses();

  if (family === "legacy-ftd" && mode === "c06-edl") {
    statuses["boot-permissive"] = "skipped";
  }

  return statuses;
};

const initialPreflight = (): PreflightState => ({
  ...detectPreflight(),
  backedUp: false,
  acceptsDataLoss: false,
  hasStockRom: false,
});

const initialConfirmations = () =>
  Object.fromEntries(destructivePhases.map((phase) => [phase, false])) as Record<DestructivePhase, boolean>;

const acceptedPreflight = (): PreflightState => ({
  ...detectPreflight(),
  backedUp: true,
  acceptsDataLoss: true,
  hasStockRom: true,
});

const logTime = () =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

const statusesForResume = (phase: ResumePhase) => {
  const selectedIndex = phaseOrder.indexOf(phase);

  return Object.fromEntries(
    phaseOrder.map((entry, index) => [
      entry,
      entry === "finished" ? "pending" : index < selectedIndex ? "done" : "pending",
    ]),
  ) as Record<PhaseId, PhaseStatus>;
};

const isPhaseComplete = (status: PhaseStatus) => status === "done" || status === "skipped";

export const workflowPhaseOrder = (family: WorkflowFamily, mode: WorkflowMode) => {
  if (family === "efisp-8e-gen5") {
    return [
      "preflight",
      "connect-device",
      "prepare-assets",
      "boot-permissive",
      "write-efisp",
      "verify-unlock",
      "cleanup-data",
      "finished",
    ] as const;
  }

  return mode === "c06-edl"
    ? phaseOrder.filter((phase) => !["boot-permissive", "write-efisp", "verify-unlock", "cleanup-data"].includes(phase))
    : phaseOrder.filter((phase) => !["write-efisp", "verify-unlock", "cleanup-data"].includes(phase));
};

export const resumePhaseOrderForFamily = (family: WorkflowFamily) =>
  family === "efisp-8e-gen5"
    ? (["prepare-assets", "boot-permissive", "write-efisp", "verify-unlock", "cleanup-data"] as const)
    : (["prepare-assets", "boot-permissive", "downgrade-abl", "flash-ftd", "unlock-payload", "restore-gpt"] as const);

export const useUnlockWorkflow = () => {
  const [preflight, setPreflight] = useState<PreflightState>(() => initialPreflight());
  const [statuses, setStatuses] = useState<Record<PhaseId, PhaseStatus>>(() => initialStatuses());
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("disconnected");
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [manifest, setManifest] = useState<Manifest | undefined>();
  const [model, setModel] = useState<SupportedModel | undefined>();
  const [detectedProduct, setDetectedProduct] = useState<string>("");
  const [targetDetection, setTargetDetection] = useState<TargetDetection | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: WorkflowErrorCode; message: string } | undefined>();
  const [progress, setProgress] = useState<ProgressEvent | undefined>();
  const [phaseConfirmations, setPhaseConfirmations] = useState(() => initialConfirmations());
  const [mockMode, setMockMode] = useState(false);
  const [workflowFamily, setWorkflowFamilyState] = useState<WorkflowFamily>("legacy-ftd");
  const [workflowMode, setWorkflowModeState] = useState<WorkflowMode>("standard-mqsas");
  const runnerRef = useRef<UnlockWorkflowRunner | undefined>(undefined);

  const appendLog = useCallback((log: WorkflowLog) => {
    setLogs((current) => [...current, log].slice(-500));
  }, []);

  const appendSystemLog = useCallback(
    (level: WorkflowLog["level"], message: string) => {
      appendLog({
        time: logTime(),
        level,
        message,
      });
    },
    [appendLog],
  );

  useEffect(() => {
    let cancelled = false;
    const nextPreflight = initialPreflight();

    setPreflight(nextPreflight);
    setStatuses(statusesForWorkflow(workflowFamily, workflowMode));
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
    setMockMode(false);

    try {
      const runner = new UnlockWorkflowRunner({
        assets: new ServerAssetClient(getAssetBaseUrl()),
        createAdbClient: () => new BrowserAdbClient(),
        createFastbootClient: () => new BrowserFastbootClient(),
        createEdlClient: () => new BrowserEdlClient(),
        onDeviceStatus: setDeviceStatus,
        onPhaseStatus: (phase, status) => {
          setStatuses((current) => ({ ...current, [phase]: status }));
        },
        onProgress: setProgress,
        onModelDetected: (target) => {
          setModel(target.model);
          setDetectedProduct(target.fastbootProduct ?? target.adbProduct ?? target.model.product);
          setTargetDetection(target);
        },
        onLog: appendLog,
      });

      runner.setWorkflowFamily(workflowFamily);
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
            preflight: isPreflightReady(nextPreflight) ? "done" : "running",
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
    } catch (cause) {
      const workflowError = toWorkflowError(cause, "MANIFEST_INVALID");
      setError({ code: workflowError.code, message: workflowError.message });
      setStatuses((current) => ({ ...current, preflight: "failed" }));
    }

    return () => {
      cancelled = true;
    };
  }, [appendLog]);

  useEffect(() => {
    setStatuses((current) => ({
      ...current,
      preflight: isPreflightReady(preflight) && manifest ? "done" : current.preflight === "failed" ? "failed" : "running",
    }));
  }, [manifest, preflight]);

  const visiblePhaseOrder = useMemo(() => workflowPhaseOrder(workflowFamily, workflowMode), [workflowFamily, workflowMode]);
  const visibleResumePhaseOrder = useMemo(() => resumePhaseOrderForFamily(workflowFamily), [workflowFamily]);

  const nextPhase = useMemo(() => {
    if (!manifest) {
      return "preflight";
    }

    if (!isPhaseComplete(statuses["connect-device"])) {
      return "connect-device";
    }

    if (!isPreflightReady(preflight)) {
      return "preflight";
    }

    return (
      visiblePhaseOrder.find(
        (phase) => phase !== "preflight" && phase !== "connect-device" && !isPhaseComplete(statuses[phase]),
      ) ?? "finished"
    );
  }, [manifest, preflight, statuses, visiblePhaseOrder]);

  const requiresConfirmation = destructivePhases.includes(nextPhase as DestructivePhase);

  const mainButton = useMemo(() => {
    if (busy) {
      return "Đang chạy";
    }

    const labels: Record<PhaseId, string> = {
      "write-efisp": "Ket noi ADB va ghi EFISP",
      "verify-unlock": "Kiem tra unlocked",
      "cleanup-data": "Xoa EFISP/metadata/userdata",
      preflight: "Kết nối thiết bị",
      "connect-device": "Kết nối thiết bị",
      "prepare-assets": "Tải và kiểm tra ROM FTD",
      "boot-permissive": "Tiếp tục",
      "downgrade-abl": workflowMode === "c06-edl" ? "Nạp ABL qua EDL mode" : "Kết nối ADB và hạ ABL",
      "flash-ftd": "Kết nối lại Fastboot và flash FTD",
      "unlock-payload": "Chạy payload mở khóa",
      "restore-gpt": "Khôi phục GPT cuối",
      finished: "Tải nhật ký",
    };

    return labels[nextPhase];
  }, [busy, nextPhase, workflowMode]);

  const canRun =
    !busy &&
    manifest !== undefined &&
    nextPhase !== "preflight" &&
    nextPhase !== "connect-device" &&
    isPreflightReady(preflight) &&
    (requiresConfirmation ? phaseConfirmations[nextPhase as DestructivePhase] : true);

  const canConnectEntry =
    !busy &&
    manifest !== undefined &&
    nextPhase === "connect-device" &&
    preflight.isHttps &&
    preflight.hasWebUsb;

  const awaitingFastbootVerification =
    targetDetection?.source === "adb" && !targetDetection.verified && statuses["connect-device"] !== "done";

  const canDisconnect = !busy && runnerRef.current !== undefined;
  const canRunFastbootTerminalCommand =
    !busy && preflight.isHttps && preflight.hasWebUsb && runnerRef.current !== undefined;
  const canRebootAdbToFastboot =
    !busy &&
    manifest !== undefined &&
    runnerRef.current !== undefined &&
    model !== undefined &&
    targetDetection?.verified === true &&
    preflight.isHttps &&
    preflight.hasWebUsb &&
    fastbootRequiredPhases.includes(nextPhase);
  const canPrepareAssetsEarly =
    !busy &&
    manifest !== undefined &&
    runnerRef.current !== undefined &&
    model !== undefined &&
    targetDetection?.verified === true &&
    statuses["prepare-assets"] !== "done" &&
    statuses["prepare-assets"] !== "running";
  const canSwitchWorkflowFamily =
    !busy &&
    !isPhaseComplete(statuses["connect-device"]) &&
    !destructivePhases.some((phase) => isPhaseComplete(statuses[phase]));
  const canSwitchWorkflowMode =
    !busy &&
    workflowFamily === "legacy-ftd" &&
    !isPhaseComplete(statuses["downgrade-abl"]) &&
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
    setStatuses(statusesForWorkflow(workflowFamily, workflowMode));
    setDeviceStatus("disconnected");
    setLogs([]);
    setManifest(undefined);
    setModel(undefined);
    setDetectedProduct("");
    setTargetDetection(undefined);
    setProgress(undefined);
    setPhaseConfirmations(initialConfirmations());
    setMockMode(false);
    appendSystemLog("info", "Reset session: da ngat browser USB, giu nguyen ROM cache trong IndexedDB.");

    const runner = new UnlockWorkflowRunner({
      assets: new ServerAssetClient(getAssetBaseUrl()),
      createAdbClient: () => new BrowserAdbClient(),
      createFastbootClient: () => new BrowserFastbootClient(),
      createEdlClient: () => new BrowserEdlClient(),
      onDeviceStatus: setDeviceStatus,
      onPhaseStatus: (phase, status) => {
        setStatuses((current) => ({ ...current, [phase]: status }));
      },
      onProgress: setProgress,
      onModelDetected: (target) => {
        setModel(target.model);
        setDetectedProduct(target.fastbootProduct ?? target.adbProduct ?? target.model.product);
        setTargetDetection(target);
      },
      onLog: appendLog,
    });
    runner.setWorkflowFamily(workflowFamily);
    runner.setWorkflowMode(workflowMode);

    runnerRef.current = runner;

    try {
      const loadedManifest = await runner.initialize();
      setManifest(loadedManifest);
      setStatuses((current) => ({
        ...current,
        preflight: isPreflightReady(nextPreflight) ? "done" : "running",
      }));
    } catch (cause) {
      const workflowError = toWorkflowError(cause, "MANIFEST_INVALID");
      setError({ code: workflowError.code, message: workflowError.message });
      setStatuses((current) => ({ ...current, preflight: "failed" }));
    } finally {
      setBusy(false);
    }
  }, [
    appendLog,
    appendSystemLog,
    busy,
    preflight.acceptsDataLoss,
    preflight.backedUp,
    preflight.hasStockRom,
    workflowMode,
    workflowFamily,
  ]);

  const startBlazerMock = useCallback(async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(undefined);
    setMockMode(true);
    setWorkflowFamilyState("legacy-ftd");
    setWorkflowModeState("standard-mqsas");
    setLogs([]);
    setProgress(undefined);

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
      createEdlClient: () => new BlazerMockEdlClient(),
      onDeviceStatus: setDeviceStatus,
      onPhaseStatus: (phase, status) => {
        setStatuses((current) => ({ ...current, [phase]: status }));
      },
      onProgress: setProgress,
      onModelDetected: (target) => {
        setModel(target.model);
        setDetectedProduct(target.fastbootProduct ?? target.adbProduct ?? target.model.product);
        setTargetDetection(target);
      },
      onLog: appendLog,
    });
    runner.setWorkflowFamily("legacy-ftd");

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
        source: "override",
        verified: true,
      });
      setPhaseConfirmations({
        "write-efisp": true,
        "cleanup-data": true,
        "downgrade-abl": true,
        "flash-ftd": true,
        "unlock-payload": true,
        "restore-gpt": true,
      });
      appendSystemLog("warn", "MOCK blazer mode: khong goi WebUSB that, khong flash that, dung fixture Xiaomi 15 Ultra.");
      await runner.prepareAssetsForSelectedModel();
      await runner.bootAndroidPermissive();
      await runner.downgradeAbl(true);
      await runner.flashFtdPackage(true);
      await runner.runUnlockPayload(true);
      await runner.restoreFinalGpt(true);
      setStatuses((current) => ({ ...current, finished: "done" }));
      appendSystemLog("success", "MOCK blazer flow da chay het; day chi la mo phong UI/log/progress.");
    } catch (cause) {
      const workflowError = toWorkflowError(cause);
      setError({ code: workflowError.code, message: workflowError.message });
    } finally {
      setBusy(false);
    }
  }, [appendLog, appendSystemLog, busy]);

  const applyDeveloperOverride = useCallback(
    (modelId: string, phase: ResumePhase) => {
      if (!manifest || busy) {
        return;
      }

      const overrideModel = manifest.models.find((entry) => entry.id === modelId);

      if (!overrideModel || !runnerRef.current) {
        return;
      }

      const nextFamily = overrideModel.family;
      runnerRef.current.overrideTargetModel(overrideModel);
      setWorkflowFamilyState(nextFamily);
      setPreflight(acceptedPreflight());
      setStatuses({
        ...statusesForResume(phase),
        "boot-permissive":
          nextFamily === "legacy-ftd" && workflowMode === "c06-edl"
            ? "skipped"
            : statusesForResume(phase)["boot-permissive"],
      });
      setModel(overrideModel);
      setDetectedProduct(overrideModel.product);
      setTargetDetection({
        model: overrideModel,
        fastbootProduct: overrideModel.product,
        source: "override",
        verified: true,
      });
      setProgress(undefined);
      setError(undefined);
      const nextConfirmations = initialConfirmations();

      if (destructivePhases.includes(phase as DestructivePhase)) {
        nextConfirmations[phase as DestructivePhase] = true;
      }

      setPhaseConfirmations(nextConfirmations);
      appendSystemLog("warn", `Developer override: ${overrideModel.name} -> ${phase}.`);
      appendSystemLog("warn", "Developer override: da chap nhan preflight cho phien resume/debug nay.");
    },
    [appendSystemLog, busy, manifest, workflowMode],
  );

  const setWorkflowMode = useCallback(
    (mode: WorkflowMode) => {
      if (!canSwitchWorkflowMode) {
        return;
      }

      runnerRef.current?.setWorkflowMode(mode);
      setWorkflowModeState(mode);
      setStatuses((current) => ({
        ...current,
        "boot-permissive":
          mode === "c06-edl"
            ? current["boot-permissive"] === "done"
              ? "done"
              : "skipped"
            : current["boot-permissive"] === "skipped"
              ? "pending"
              : current["boot-permissive"],
      }));
      setProgress(undefined);
      setError(undefined);
      appendSystemLog("warn", `Workflow mode: ${mode}.`);
    },
    [appendSystemLog, canSwitchWorkflowMode],
  );

  const setWorkflowFamily = useCallback(
    (family: WorkflowFamily) => {
      if (!canSwitchWorkflowFamily) {
        return;
      }

      runnerRef.current?.setWorkflowFamily(family);
      setWorkflowFamilyState(family);
      setWorkflowModeState("standard-mqsas");
      setStatuses(statusesForWorkflow(family, "standard-mqsas"));
      setModel(undefined);
      setDetectedProduct("");
      setTargetDetection(undefined);
      setProgress(undefined);
      setError(undefined);
      setPhaseConfirmations(initialConfirmations());
      appendSystemLog("warn", `Workflow family: ${family}.`);
    },
    [appendSystemLog, canSwitchWorkflowFamily],
  );

  const runWorkflowAction = useCallback(
    async (work: () => Promise<unknown>) => {
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
    },
    [],
  );

  const runFastbootTerminalCommand = useCallback(
    async (command: string) => {
      if (!runnerRef.current || !canRunFastbootTerminalCommand) {
        return;
      }

      await runWorkflowAction(() => runnerRef.current!.runFastbootTerminalCommand(command));
    },
    [canRunFastbootTerminalCommand, runWorkflowAction],
  );

  const prepareAssetsEarly = useCallback(async () => {
    if (!runnerRef.current || !canPrepareAssetsEarly) {
      return;
    }

    await runWorkflowAction(() => runnerRef.current!.prepareAssetsForSelectedModel());
  }, [canPrepareAssetsEarly, runWorkflowAction]);

  const rebootAdbToFastboot = useCallback(async () => {
    if (!runnerRef.current || !canRebootAdbToFastboot) {
      return;
    }

    await runWorkflowAction(() => runnerRef.current!.rebootAdbToBootloaderForSelectedModel());
  }, [canRebootAdbToFastboot, runWorkflowAction]);

  const connectAdbEntry = useCallback(async () => {
    if (!canConnectEntry || !runnerRef.current) {
      return;
    }

    await runWorkflowAction(() => runnerRef.current!.connectInitialAdb());
  }, [canConnectEntry, runWorkflowAction]);

  const connectFastbootEntry = useCallback(async () => {
    if (!canConnectEntry || !runnerRef.current) {
      return;
    }

    await runWorkflowAction(() => runnerRef.current!.connectFastboot());
  }, [canConnectEntry, runWorkflowAction]);

  const runNext = useCallback(async () => {
    if (nextPhase === "finished") {
      return;
    }

    if (!runnerRef.current || !canRun) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      if (nextPhase === "prepare-assets") {
        await runnerRef.current.prepareAssetsForSelectedModel();
      } else if (nextPhase === "boot-permissive") {
        await runnerRef.current.bootAndroidPermissive();
      } else if (nextPhase === "write-efisp") {
        await runnerRef.current.writeEfisp(phaseConfirmations["write-efisp"]);
      } else if (nextPhase === "verify-unlock") {
        await runnerRef.current.verifyUnlock();
      } else if (nextPhase === "cleanup-data") {
        await runnerRef.current.cleanupData(phaseConfirmations["cleanup-data"]);
        setStatuses((current) => ({ ...current, finished: "done" }));
      } else if (nextPhase === "downgrade-abl") {
        await runnerRef.current.downgradeAbl(phaseConfirmations["downgrade-abl"]);
      } else if (nextPhase === "flash-ftd") {
        await runnerRef.current.flashFtdPackage(phaseConfirmations["flash-ftd"]);
      } else if (nextPhase === "unlock-payload") {
        await runnerRef.current.runUnlockPayload(phaseConfirmations["unlock-payload"]);
      } else if (nextPhase === "restore-gpt") {
        await runnerRef.current.restoreFinalGpt(phaseConfirmations["restore-gpt"]);
        setStatuses((current) => ({ ...current, finished: "done" }));
      }
    } catch (cause) {
      const workflowError = toWorkflowError(cause);
      setError({ code: workflowError.code, message: workflowError.message });
    } finally {
      setBusy(false);
    }
  }, [canRun, nextPhase, phaseConfirmations]);

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
    deviceStatus,
    logs,
    manifest,
    model,
    detectedProduct,
    targetDetection,
    awaitingFastbootVerification,
    busy,
    error,
    progress,
    workflowFamily,
    workflowMode,
    visiblePhaseOrder,
    visibleResumePhaseOrder,
    canRebootAdbToFastboot,
    canPrepareAssetsEarly,
    canSwitchWorkflowFamily,
    canSwitchWorkflowMode,
    setWorkflowFamily,
    setWorkflowMode,
    phaseConfirmations,
    setPhaseConfirmations,
    nextPhase,
    requiresConfirmation,
    canRun,
    canConnectEntry,
    canDisconnect,
    canRunFastbootTerminalCommand,
    mockMode,
    mainButton,
    runNext,
    rebootAdbToFastboot,
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
