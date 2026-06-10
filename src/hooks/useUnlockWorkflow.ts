import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getAssetBaseUrl } from "../domain/assets";
import type { Manifest, SupportedModel } from "../domain/schemas";
import { BrowserAdbClient } from "../services/adb";
import { ServerAssetClient } from "../services/assetClient";
import {
  BlazerMockAdbClient,
  BlazerMockAssetClient,
  BlazerMockFastbootClient,
  blazerMockModel,
} from "../services/blazerMock";
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
  WorkflowMode,
} from "../workflow/types";

type DestructivePhase = "flash-ftd" | "unlock-payload" | "restore-gpt";
export type ResumePhase = "prepare-assets" | DestructivePhase;

const destructivePhases: readonly DestructivePhase[] = ["flash-ftd", "unlock-payload", "restore-gpt"];
export const resumePhaseOrder: readonly ResumePhase[] = ["prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt"];
export const phaseOrder: readonly PhaseId[] = [
  "preflight",
  "connect-device",
  "prepare-assets",
  "flash-ftd",
  "unlock-payload",
  "restore-gpt",
  "finished",
];

export const phaseLabels: Record<PhaseId, string> = {
  preflight: "Kiểm tra ban đầu",
  "connect-device": "Kết nối thiết bị",
  "prepare-assets": "Chuẩn bị tệp ROM",
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

const acceptedPreflight = (): PreflightState => ({
  ...detectPreflight(),
  backedUp: true,
  acceptsDataLoss: true,
  hasStockRom: true,
});

const initialConfirmations = () =>
  Object.fromEntries(destructivePhases.map((phase) => [phase, false])) as Record<DestructivePhase, boolean>;

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

export const workflowPhaseOrder = () => phaseOrder;
export const resumePhaseOrderForFamily = () => resumePhaseOrder;

export const useUnlockWorkflow = () => {
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
  const [mockMode, setMockMode] = useState(false);
  const [workflowMode, setWorkflowModeState] = useState<WorkflowMode>("standard");
  const runnerRef = useRef<UnlockWorkflowRunner | undefined>(undefined);

  const appendLog = useCallback((log: WorkflowLog) => {
    setLogs((current) => [...current, log].slice(-500));
  }, []);

  const appendSystemLog = useCallback(
    (level: WorkflowLog["level"], message: string) => {
      appendLog({ time: logTime(), level, message });
    },
    [appendLog],
  );

  const createRunner = useCallback(
    () =>
      new UnlockWorkflowRunner({
        assets: new ServerAssetClient(getAssetBaseUrl()),
        createAdbClient: () => new BrowserAdbClient(),
        createFastbootClient: () => new BrowserFastbootClient(),
        onDeviceStatus: setDeviceStatus,
        onPhaseStatus: (phase, status) => setStatuses((current) => ({ ...current, [phase]: status })),
        onProgress: setProgress,
        onModelDetected: (target) => {
          setModel(target.model);
          setDetectedProduct(target.fastbootProduct ?? target.adbProduct ?? target.model.product);
          setTargetDetection(target);
        },
        onLog: appendLog,
      }),
    [appendLog],
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
    setMockMode(false);

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
  }, [createRunner]);

  useEffect(() => {
    setStatuses((current) => ({
      ...current,
      preflight: isPreflightReady(preflight) && manifest ? "done" : current.preflight === "failed" ? "failed" : "pending",
    }));
  }, [manifest, preflight]);

  const visiblePhaseOrder = useMemo(() => workflowPhaseOrder(), []);
  const visibleResumePhaseOrder = useMemo(() => resumePhaseOrderForFamily(), []);

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

  const mainButton = useMemo(() => {
    if (busy) {
      return "Đang chạy";
    }

    const labels: Record<PhaseId, string> = {
      preflight: "Kết nối thiết bị",
      "connect-device": "Kết nối thiết bị",
      "prepare-assets": "Tải và kiểm tra ROM FTD",
      "flash-ftd": "Kết nối Fastboot và flash FTD",
      "unlock-payload": "Chạy payload mở khóa",
      "restore-gpt": "Khôi phục GPT cuối",
      finished: "Tải nhật ký",
    };

    return labels[nextPhase];
  }, [busy, nextPhase]);

  const canRun =
    !busy &&
    manifest !== undefined &&
    nextPhase !== "preflight" &&
    nextPhase !== "connect-device" &&
    (!requiresPreflightReady || isPreflightReady(preflight)) &&
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
  const canRunFastbootTerminalCommand = !busy && preflight.isHttps && preflight.hasWebUsb && runnerRef.current !== undefined;
  const canPrepareAssetsEarly =
    !busy &&
    manifest !== undefined &&
    runnerRef.current !== undefined &&
    model !== undefined &&
    targetDetection?.verified === true &&
    statuses["prepare-assets"] !== "done" &&
    statuses["prepare-assets"] !== "running";
  const canSwitchWorkflowMode =
    !busy &&
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
    setMockMode(false);
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
      onDeviceStatus: setDeviceStatus,
      onPhaseStatus: (phase, status) => setStatuses((current) => ({ ...current, [phase]: status })),
      onProgress: setProgress,
      onModelDetected: (target) => {
        setModel(target.model);
        setDetectedProduct(target.fastbootProduct ?? target.adbProduct ?? target.model.product);
        setTargetDetection(target);
      },
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
      setPhaseConfirmations({
        "flash-ftd": true,
        "unlock-payload": true,
        "restore-gpt": true,
      });
      appendSystemLog("warn", "MOCK blazer mode: khong goi WebUSB that, khong flash that, dung fixture Xiaomi 15 Ultra.");
      await runner.prepareAssetsForSelectedModel();
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
      if (!manifest || busy || !runnerRef.current) {
        return;
      }

      const overrideModel = manifest.models.find((entry) => entry.id === modelId);

      if (!overrideModel) {
        return;
      }

      runnerRef.current.overrideTargetModel(overrideModel);
      setPreflight(acceptedPreflight());
      setStatuses(statusesForResume(phase));
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
    [appendSystemLog, busy, manifest],
  );

  const setWorkflowMode = useCallback(
    (mode: WorkflowMode) => {
      if (!canSwitchWorkflowMode) {
        return;
      }

      runnerRef.current?.setWorkflowMode(mode);
      setWorkflowModeState(mode);
      setProgress(undefined);
      setError(undefined);
      appendSystemLog("warn", `Workflow mode: ${mode}.`);
    },
    [appendSystemLog, canSwitchWorkflowMode],
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
    if (nextPhase === "finished" || !runnerRef.current || !canRun) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      if (nextPhase === "prepare-assets") {
        await runnerRef.current.prepareAssetsForSelectedModel();
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
    workflowMode,
    visiblePhaseOrder,
    visibleResumePhaseOrder,
    canRebootAdbToFastboot: false,
    canPrepareAssetsEarly,
    canSwitchWorkflowMode,
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
