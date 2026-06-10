import {
  Check,
  ChevronDown,
  Circle,
  Cpu,
  Database,
  Download,
  HardDrive,
  Info,
  Loader2,
  LockKeyhole,
  PlugZap,
  RefreshCcw,
  SendHorizontal,
  ShieldAlert,
  Terminal,
  Usb,
  Wrench,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { phaseLabels, useUnlockWorkflow, type ResumePhase } from "./hooks/useUnlockWorkflow";
import { isPreflightReady } from "./workflow/preflight";
import type { PhaseId, PhaseStatus, ProgressEvent, WorkflowLog } from "./workflow/types";

type WorkflowState = ReturnType<typeof useUnlockWorkflow>;

const operationProgressStates = new Set(["flashing", "booting", "sahara", "configuring"]);
const preferredLegacyModelId = "xiaomi15ultra";

const destructiveCopy = (workflow: WorkflowState): Partial<Record<PhaseId, string>> => ({
  "flash-ftd":
    workflow.workflowMode === "edl-standard"
      ? "Toi xac nhan ABL engineering da duoc nap thu cong, dong y chay fastboot erase frp de verify, roi flash FTD dung mau may."
      : "Toi xac nhan ABL/parcel da san sang, dong y chay fastboot erase frp de verify, roi flash FTD dung mau may.",
  "unlock-payload": "Toi xac nhan may dang o Fastboot tu FTD de chay payload unlock.",
  "restore-gpt": "Toi xac nhan khoi phuc GPT cuoi, sau do flash ROM goc bang MiFlash Clean All.",
});

const workflowModeCopy = {
  standard: {
    title: "Standard",
    detail: "Detect product, tai ROM FTD, flash FTD, chay payload unlock va restore GPT.",
  },
  "edl-standard": {
    title: "EDL_Standard",
    detail: "Flow Fastboot/FTD sau khi ABL engineering da nap thu cong; app verify bang fastboot erase frp truoc khi flash.",
  },
};

const edlModeInfo =
  "EDL_Standard khong nap ABL qua browser; hay nap ABL engineering thu cong truoc, roi app se verify bang fastboot erase frp truoc khi flash FTD.";

const fixedWarnings = [
  "Sai mau may hoac sai goi co the brick may.",
  "Web khong flash ROM goc 8-12GB; buoc cuoi dung MiFlash.",
  "Khong chon Clean All and Lock trong MiFlash.",
  "Khong rut cap khi dang flash phan vung hoac GPT.",
  "Chi ho tro legacy FTD: dada, haotian, xuanyuan, miro, annibale, piano.",
];

const statusStyles: Record<PhaseStatus, { row: string; dot: string; label: string }> = {
  pending: {
    row: "border-white/8 bg-white/[0.025] text-slate-500",
    dot: "border-slate-600 text-slate-600",
    label: "Cho",
  },
  running: {
    row: "border-sky-300/35 bg-sky-300/[0.08] text-sky-100 shadow-[0_0_26px_rgba(56,189,248,0.08)]",
    dot: "border-sky-300 bg-sky-300/15 text-sky-200",
    label: "Dang chay",
  },
  done: {
    row: "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100",
    dot: "border-emerald-300 bg-emerald-300/15 text-emerald-200",
    label: "Xong",
  },
  failed: {
    row: "border-rose-300/35 bg-rose-400/[0.09] text-rose-100",
    dot: "border-rose-300 bg-rose-300/15 text-rose-200",
    label: "Loi",
  },
  skipped: {
    row: "border-slate-500/20 bg-white/[0.018] text-slate-500",
    dot: "border-slate-600 text-slate-600",
    label: "Bo qua",
  },
};

function App() {
  const [riskOpen, setRiskOpen] = useState(false);
  const workflow = useUnlockWorkflow();
  const visiblePhaseOrder = workflow.visiblePhaseOrder;
  const progressPercent = progressToPercent(workflow.progress?.overallProgress ?? workflow.progress?.progress);
  const preflightReady = isPreflightReady(workflow.preflight);
  const completedSteps = visiblePhaseOrder.filter((phase) => workflow.statuses[phase] === "done").length;
  const canConnectDevice = workflow.nextPhase === "connect-device" && workflow.canConnectEntry;
  const mainDisabled = workflow.nextPhase === "finished" ? workflow.logs.length === 0 : !workflow.canRun;
  const connectButtonLabel =
    workflow.busy && workflow.nextPhase === "connect-device"
      ? "Dang mo WebUSB"
      : workflow.statuses["connect-device"] === "done"
        ? "Da ket noi thiet bi"
        : workflow.awaitingFastbootVerification
          ? "Cho xac minh Fastboot"
          : "Ket noi WebUSB";
  const connectHint =
    workflow.statuses["connect-device"] === "done"
      ? "Thiet bi da duoc nhan dien, product va serial Fastboot da duoc ghi lai neu bootloader tra ve."
      : workflow.awaitingFastbootVerification
        ? "May da reboot tu Android sang Fastboot. Bam Ket noi Fastboot va chon lai thiet bi."
        : !workflow.manifest
          ? "Dang tai danh sach file truoc khi mo hop chon thiet bi."
          : !workflow.preflight.isHttps || !workflow.preflight.hasWebUsb
            ? "Can HTTPS/localhost va Chrome hoac Edge co WebUSB."
            : "Chon ADB Android neu may dang vao he dieu hanh, hoac Fastboot neu may da o bootloader.";
  const actionHint = workflow.busy
    ? "Dang chay buoc hien tai."
    : workflow.awaitingFastbootVerification
      ? "May dang reboot sang Fastboot. Khi thay man Fastboot, bam Ket noi Fastboot de xac minh mau may."
      : workflow.nextPhase === "connect-device"
        ? "Ket noi ADB Android de nhan dien va reboot bootloader, hoac ket noi Fastboot neu may da o bootloader."
        : workflow.nextPhase === "flash-ftd"
          ? "Truoc khi flash FTD, app se chay fastboot erase frp. Neu fail thi ABL engineering/parcel chua OK hoac Fastboot chua dung trang thai."
          : workflow.workflowMode !== "edl-standard" && !preflightReady
            ? "Tick du kiem tra ban dau de bat buoc tiep theo sau khi da nhan dien may."
            : workflow.requiresConfirmation && !workflow.canRun
              ? "Tick xac nhan cua buoc nguy hiem de tiep tuc."
              : workflow.nextPhase === "finished"
                ? "Co the tai nhat ky sau khi quy trinh hoan tat."
                : "San sang chay buoc hien tai.";

  return (
    <main className="min-h-dvh overflow-hidden bg-[#0b0d10] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.14),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(20,184,166,0.10),transparent_24%)]" />
      <div className="relative mx-auto min-h-dvh max-w-[1660px]">
        <header className="border-b border-white/8 bg-[#0f1217]/95 px-4 py-3 lg:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <span>Cong cu WebUSB thu nghiem</span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span>Legacy FTD only</span>
                {workflow.mockMode && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-amber-500/70" />
                    <span className="rounded-sm bg-amber-300/15 px-2 py-1 text-amber-100">MOCK BLAZER</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">Xiaomi WebUSB Unlock</h1>
              <p className="mt-1 max-w-3xl truncate text-sm leading-6 text-slate-400">
                Flow Xiaomi 8 Elite / FTD: detect product, flash FTD, unlock payload, restore GPT.
              </p>
            </div>

            <ConnectionCard
              workflow={workflow}
              canConnectDevice={canConnectDevice}
              connectButtonLabel={connectButtonLabel}
              connectHint={connectHint}
            />
          </div>
        </header>

        <StatusStrip
          workflow={workflow}
          progressPercent={progressPercent}
          completedSteps={completedSteps}
          totalSteps={visiblePhaseOrder.length}
          riskOpen={riskOpen}
          setRiskOpen={setRiskOpen}
        />

        <section className="grid gap-4 px-4 py-4 lg:px-6 xl:grid-cols-[320px_minmax(0,1fr)_390px] xl:items-start 2xl:grid-cols-[340px_minmax(420px,1fr)_410px]">
          <ControlPanel
            className="order-1 xl:order-2"
            workflow={workflow}
            progressPercent={progressPercent}
            actionHint={actionHint}
            mainDisabled={mainDisabled}
            preflightReady={preflightReady}
          />
          <WorkflowRail className="order-2 xl:order-1" workflow={workflow} />
          <TerminalPanel
            className="order-3 xl:order-3"
            logs={workflow.logs}
            canRunCommand={workflow.canRunFastbootTerminalCommand}
            running={workflow.busy}
            onRunCommand={workflow.runFastbootTerminalCommand}
          />
        </section>
      </div>
    </main>
  );
}

const ConnectionCard = ({
  workflow,
  canConnectDevice,
  connectButtonLabel,
  connectHint,
}: {
  workflow: WorkflowState;
  canConnectDevice: boolean;
  connectButtonLabel: string;
  connectHint: string;
}) => (
  <div className="w-full space-y-2 xl:max-w-[540px]">
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{connectButtonLabel}</div>
          <div className="text-xs text-slate-500">ADB/Fastboot qua navigator.usb.requestDevice</div>
        </div>
        {workflow.busy && workflow.nextPhase === "connect-device" ? (
          <Loader2 className="h-5 w-5 animate-spin text-sky-200" />
        ) : (
          <Usb className="h-5 w-5 text-sky-200" />
        )}
      </div>
      <EntryConnectActions workflow={workflow} canConnectDevice={canConnectDevice} compact />
      <button
        type="button"
        disabled={!workflow.canDisconnect}
        onClick={workflow.resetSession}
        className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-slate-200 transition duration-200 hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-slate-600"
      >
        <RefreshCcw className="h-4 w-4" />
        Ngat ket noi / dat lai phien
      </button>
    </div>
    <p className="text-xs leading-5 text-slate-500">{connectHint}</p>
  </div>
);

const EntryConnectActions = ({
  workflow,
  canConnectDevice,
  compact = false,
}: {
  workflow: WorkflowState;
  canConnectDevice: boolean;
  compact?: boolean;
}) => {
  const buttonBase =
    `inline-flex items-center justify-center gap-2 rounded-md font-semibold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-500 ${
      compact ? "min-h-10 px-3 py-2 text-xs" : "min-h-12 px-4 py-2.5 text-sm"
    }`;
  const layout = compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2";

  return (
    <div className={layout}>
      <button
        type="button"
        disabled={!canConnectDevice || workflow.busy}
        onClick={workflow.connectAdbEntry}
        className={`${buttonBase} border border-emerald-300/20 bg-emerald-300 text-slate-950 hover:bg-emerald-200`}
      >
        {workflow.busy && workflow.nextPhase === "connect-device" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Usb className="h-4 w-4" />
        )}
        Ket noi ADB Android
      </button>
      <button
        type="button"
        disabled={!canConnectDevice || workflow.busy}
        onClick={workflow.connectFastbootEntry}
        className={`${buttonBase} border border-sky-300/20 bg-sky-300 text-slate-950 hover:bg-sky-200`}
      >
        {workflow.busy && workflow.nextPhase === "connect-device" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PlugZap className="h-4 w-4" />
        )}
        Ket noi Fastboot
      </button>
    </div>
  );
};

const StatusStrip = ({
  workflow,
  progressPercent,
  completedSteps,
  totalSteps,
  riskOpen,
  setRiskOpen,
}: {
  workflow: WorkflowState;
  progressPercent?: number;
  completedSteps: number;
  totalSteps: number;
  riskOpen: boolean;
  setRiskOpen: (value: boolean) => void;
}) => {
  const preflightCount = [
    workflow.preflight.isHttps,
    workflow.preflight.hasWebUsb,
    workflow.preflight.backedUp,
    workflow.preflight.acceptsDataLoss,
    workflow.preflight.hasStockRom,
  ].filter(Boolean).length;

  return (
    <div className="border-b border-white/8 bg-[#0b0f14]/88 px-4 py-2 lg:px-6">
      <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
        <StatusChip
          icon={<LockKeyhole />}
          label="Kiem tra"
          value={`${preflightCount}/5`}
          detail="Cong an toan"
          tone={preflightCount === 5 ? "good" : "muted"}
        />
        <StatusChip
          icon={<Cpu />}
          label="Thiet bi"
          value={workflow.model?.name ?? "Chua khoa"}
          detail={targetDetail(workflow)}
          tone={workflow.model ? "good" : "muted"}
        />
        <StatusChip
          icon={<HardDrive />}
          label="ROM"
          value={progressPercent === undefined ? "Cho tien trinh" : `${progressPercent}%`}
          detail={assetDetail(workflow)}
          tone="neutral"
        />
        <RiskStatusChip riskOpen={riskOpen} setRiskOpen={setRiskOpen} />
        <StatusChip
          icon={<Database />}
          label="Buoc"
          value={`${completedSteps}/${totalSteps}`}
          detail={`${workflow.manifest?.models.length.toString() ?? "--"} mau may`}
          tone="neutral"
        />
      </div>
      {riskOpen && (
        <ul className="mt-2 grid gap-1 rounded-md border border-amber-200/15 bg-amber-300/[0.055] p-2 text-xs leading-5 text-amber-50/82 md:grid-cols-2 xl:grid-cols-3">
          {fixedWarnings.map((warning) => (
            <li key={warning} className="truncate" title={warning}>
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const targetDetail = (workflow: WorkflowState) => {
  if (!workflow.targetDetection) {
    return "Ket noi truoc";
  }

  const serial = workflow.targetDetection.fastbootSerial ? ` / ${workflow.targetDetection.fastbootSerial}` : "";

  if (workflow.targetDetection.verified) {
    return `Da xac minh ${workflow.targetDetection.fastbootProduct ?? workflow.detectedProduct}${serial}`;
  }

  return `ADB ${workflow.targetDetection.adbProduct ?? workflow.detectedProduct}; cho Fastboot`;
};

const assetDetail = (workflow: WorkflowState) => {
  if (!workflow.progress) {
    return "Duong dan tep tinh";
  }

  if (workflow.progress.bytesPerSecond) {
    return `${formatRate(workflow.progress.bytesPerSecond)} / con lai ${formatEta(workflow.progress.etaSeconds)}`;
  }

  return workflow.progress.state ?? workflow.progress.label;
};

const ProgressPanel = ({
  workflow,
  progressPercent,
}: {
  workflow: WorkflowState;
  progressPercent?: number;
}) => {
  const progress = workflow.progress;
  const itemIsOperation = operationProgressStates.has(progress?.state ?? "");
  const itemTitle = itemIsOperation ? "Thao tac hien tai" : "Tep hien tai";
  const itemLabel = progress?.itemLabel ?? progress?.path ?? progress?.label ?? "--";
  const itemProgress = progressToPercent(progress?.itemProgress ?? progress?.progress);
  const progressCount = formatProgressCount(progress, itemIsOperation);

  return (
    <div className="mt-5 rounded-md border border-white/8 bg-black/10 p-4">
      <div className="mb-3 flex min-h-6 justify-between gap-3 text-sm">
        <span className="min-w-0 truncate leading-5 text-slate-300">{progress?.label ?? "Chua co tac vu tep"}</span>
        <span className="shrink-0 font-mono text-slate-400">{formatPercent(progressPercent)}</span>
      </div>
      <div className="space-y-3">
        <ProgressMeter title="Tong tien trinh" detail={progressCount} percent={progressPercent} barClassName="bg-sky-300" />
        <ProgressMeter title={itemTitle} detail={itemLabel} percent={itemProgress} barClassName={itemIsOperation ? "bg-emerald-300" : "bg-cyan-300"} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Trang thai" value={progress?.state ?? "--"} />
        <Metric label="Tep" value={progressCount} />
        <Metric label="Du lieu" value={formatBytePair(progress?.receivedBytes, progress?.totalBytes)} />
        <Metric label="Toc do" value={progress?.bytesPerSecond ? formatRate(progress.bytesPerSecond) : "--"} />
      </div>
    </div>
  );
};

const ProgressMeter = ({
  title,
  detail,
  percent,
  barClassName,
}: {
  title: string;
  detail: string;
  percent?: number;
  barClassName: string;
}) => (
  <div>
    <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3 text-xs">
      <span className="font-semibold text-slate-300">{title}</span>
      <span className="shrink-0 font-mono text-slate-400">{formatPercent(percent)}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-sm bg-white/8">
      <div className={`h-full transition-[width] duration-300 ${barClassName}`} style={{ width: `${percent ?? 0}%` }} />
    </div>
    <div className="mt-1 truncate text-xs text-slate-500">{detail}</div>
  </div>
);

const DeveloperOverridePanel = ({ workflow }: { workflow: WorkflowState }) => {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [phase, setPhase] = useState<ResumePhase>("prepare-assets");
  const [modelId, setModelId] = useState("");

  const selectableModels = workflow.manifest?.models ?? [];
  const preferredModel = selectableModels.find((model) => model.id === preferredLegacyModelId) ?? selectableModels[0];
  const canApply = Boolean(workflow.manifest && modelId && selectableModels.some((model) => model.id === modelId) && accepted && !workflow.busy);

  useEffect(() => {
    if (selectableModels.length === 0) {
      setModelId("");
      return;
    }

    if (!selectableModels.some((model) => model.id === modelId)) {
      setModelId(workflow.model?.id ?? preferredModel?.id ?? "");
    }

    if (!(workflow.visibleResumePhaseOrder as readonly ResumePhase[]).includes(phase)) {
      setPhase(workflow.visibleResumePhaseOrder[0] ?? "prepare-assets");
    }
  }, [modelId, phase, selectableModels, workflow.model, workflow.visibleResumePhaseOrder, preferredModel]);

  return (
    <div className="mt-4 rounded-md border border-amber-300/15 bg-amber-300/[0.045] p-3">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <Wrench className="h-4 w-4" />
          Ghi de lap trinh vien / tiep tuc tu buoc
        </span>
        <ChevronDown className={`h-4 w-4 text-amber-100/70 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-amber-200/10 pt-3">
          <p className="text-xs leading-5 text-amber-100/70">
            Chi dung khi can tiep tuc thu cong hoac go loi. App van kiem tra va cache file truoc khi chay lenh nguy hiem.
          </p>
          <button
            type="button"
            disabled={workflow.busy}
            onClick={workflow.startBlazerMock}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-amber-200/20 bg-amber-200/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/15 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            <Wrench className="h-4 w-4" />
            Chay mo phong blazer {"->"} Xiaomi 15 Ultra
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-amber-100/80">
              Mau may
              <select
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                className="min-h-10 w-full rounded-md border border-white/10 bg-[#0b0d10] px-3 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              >
                {selectableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.product})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-amber-100/80">
              Buoc can tiep tuc
              <select
                value={phase}
                onChange={(event) => setPhase(event.target.value as ResumePhase)}
                className="min-h-10 w-full rounded-md border border-white/10 bg-[#0b0d10] px-3 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              >
                {workflow.visibleResumePhaseOrder.map((entry) => (
                  <option key={entry} value={entry}>
                    {phaseLabels[entry]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-start gap-3 text-xs leading-5 text-amber-100/80">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-amber-200/40 bg-transparent accent-amber-300"
            />
            Toi hieu ghi de co the lam sai thu tu thao tac neu chon nham mau may/buoc.
          </label>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => workflow.applyDeveloperOverride(modelId, phase)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            <Wrench className="h-4 w-4" />
            Ap dung ghi de tiep tuc
          </button>
        </div>
      )}
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-sm border border-white/8 bg-white/[0.025] px-2 py-1.5">
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</div>
    <div className="mt-0.5 truncate font-mono text-[11px] text-slate-300">{value}</div>
  </div>
);

const RiskStatusChip = ({ riskOpen, setRiskOpen }: { riskOpen: boolean; setRiskOpen: (value: boolean) => void }) => (
  <button
    type="button"
    onClick={() => setRiskOpen(!riskOpen)}
    className="grid h-12 min-w-[230px] grid-cols-[18px_1fr_16px] items-center gap-x-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-3 text-left text-amber-50 transition hover:border-amber-200/35 hover:bg-amber-300/[0.09]"
  >
    <ShieldAlert className="row-span-2 h-4 w-4 text-amber-100/75" />
    <div className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100/60">Rui ro</div>
    <ChevronDown className={`row-span-2 h-4 w-4 text-amber-100/70 transition ${riskOpen ? "rotate-180" : ""}`} />
    <div className="min-w-0 truncate text-xs font-medium text-amber-50/80">Sai mau may co the brick may</div>
  </button>
);

const WorkflowModePanel = ({ workflow }: { workflow: WorkflowState }) => (
  <div className="mb-3 rounded-md border border-white/8 bg-black/10 p-2.5">
    <div className="mb-2 flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-white">Quy trinh FTD</div>
        <div className="text-xs leading-5 text-slate-500">Standard hoac EDL_Standard sau khi nap ABL thu cong.</div>
      </div>
      <span className="hidden rounded-sm border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-400 sm:inline">
        {workflowModeCopy[workflow.workflowMode].title}
      </span>
    </div>
    <div className="grid rounded-md border border-white/8 bg-white/[0.025] p-1 sm:grid-cols-2">
      {(["standard", "edl-standard"] as const).map((mode) => {
        const active = workflow.workflowMode === mode;
        const copy = workflowModeCopy[mode];

        return (
          <button
            key={mode}
            type="button"
            disabled={!workflow.canSwitchWorkflowMode}
            title={copy.detail}
            onClick={() => workflow.setWorkflowMode(mode)}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded px-2.5 text-center text-xs font-semibold transition disabled:cursor-not-allowed ${
              active
                ? "bg-sky-300 text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.14)]"
                : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-200"
            } ${!workflow.canSwitchWorkflowMode && !active ? "opacity-45" : ""}`}
          >
            {mode === "edl-standard" ? <Usb className="h-3.5 w-3.5" /> : <PlugZap className="h-3.5 w-3.5" />}
            <span className="truncate">{copy.title}</span>
            {mode === "edl-standard" && (
              <span className="group relative inline-flex" title={edlModeInfo}>
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="pointer-events-none absolute left-1/2 top-6 z-20 w-56 -translate-x-1/2 rounded-md border border-white/10 bg-[#05070a] px-2.5 py-2 text-xs font-medium leading-5 text-slate-200 opacity-0 shadow-xl transition group-hover:opacity-100">
                  {edlModeInfo}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

const AssetPreloadPanel = ({ workflow }: { workflow: WorkflowState }) => {
  const status = workflow.statuses["prepare-assets"];
  const done = status === "done";
  const running = status === "running";
  const title = done ? "ROM da chuan bi" : running ? "Dang chuan bi ROM" : "Chuan bi ROM truoc";
  const detail = done
    ? "Tep ROM da duoc tai, kiem tra SHA-256 va luu trong bo nho dem."
    : running
      ? "Dang tai va kiem tra ROM; buoc Chuan bi tep ROM se tu hoan tat khi xong."
      : workflow.model
        ? "Co the tai va kiem tra ROM ngay sau khi da khoa mau may."
        : "Khoa va xac minh mau may truoc de biet dung goi ROM can tai.";

  return (
    <div className="mb-3 rounded-md border border-white/8 bg-white/[0.025] p-2.5">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-0.5 truncate text-xs leading-5 text-slate-500" title={detail}>
            {detail}
          </div>
        </div>
        <button
          type="button"
          disabled={!workflow.canPrepareAssetsEarly}
          onClick={workflow.prepareAssetsEarly}
          aria-label={title}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.025] disabled:text-slate-500"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
          {done ? "Da chuan bi" : running ? "Dang tai" : "Chuan bi"}
        </button>
      </div>
    </div>
  );
};

const WorkflowRail = ({ workflow, className = "" }: { workflow: WorkflowState; className?: string }) => (
  <aside className={`rounded-lg border border-white/8 bg-[#12161d]/90 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.18)] xl:sticky xl:top-4 xl:max-h-[calc(100dvh-7.25rem)] xl:overflow-y-auto ${className}`}>
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-white">Tien trinh quy trinh</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">ADB/Fastboot theo dung thu tu FTD.</p>
      </div>
      <CurrentPhaseBadge phase={workflow.nextPhase} />
    </div>
    <WorkflowModePanel workflow={workflow} />
    <AssetPreloadPanel workflow={workflow} />
    <ol className="grid gap-1.5">
      {workflow.visiblePhaseOrder.map((phase, index) => (
        <WorkflowStep key={phase} index={index + 1} phase={phase} status={workflow.statuses[phase]} active={workflow.nextPhase === phase} />
      ))}
    </ol>
  </aside>
);

const ControlPanel = ({
  workflow,
  progressPercent,
  actionHint,
  mainDisabled,
  preflightReady,
  className = "",
}: {
  workflow: WorkflowState;
  progressPercent?: number;
  actionHint: string;
  mainDisabled: boolean;
  preflightReady: boolean;
  className?: string;
}) => (
  <section className={`rounded-lg border border-white/8 bg-[#12161d]/90 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] ${className}`}>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          <PlugZap className="h-4 w-4 text-sky-200" />
          Dieu khien chinh
        </div>
        <h2 className="text-2xl font-semibold text-white">{phaseLabels[workflow.nextPhase]}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{actionHint}</p>
      </div>
    </div>

    {workflow.requiresConfirmation && (
      <label className="mb-4 flex items-start gap-3 rounded-md border border-amber-300/20 bg-amber-300/[0.08] p-3 text-sm leading-6 text-amber-100">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-amber-200/40 bg-transparent accent-amber-300"
          checked={workflow.phaseConfirmations[workflow.nextPhase as keyof typeof workflow.phaseConfirmations]}
          onChange={(event) =>
            workflow.setPhaseConfirmations((current) => ({
              ...current,
              [workflow.nextPhase]: event.target.checked,
            }))
          }
        />
        <span>{destructiveCopy(workflow)[workflow.nextPhase]}</span>
      </label>
    )}

    {workflow.nextPhase === "connect-device" ? (
      <EntryConnectActions workflow={workflow} canConnectDevice={workflow.canConnectEntry} />
    ) : (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <button
            type="button"
            disabled={mainDisabled}
            onClick={workflow.nextPhase === "finished" ? workflow.downloadLog : workflow.runNext}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-sky-300 px-5 py-3 text-base font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:bg-sky-200 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {workflow.busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : workflow.nextPhase === "finished" ? (
              <Download className="h-5 w-5" />
            ) : (
              <PlugZap className="h-5 w-5" />
            )}
            {workflow.mainButton}
          </button>
          <button
            type="button"
            onClick={workflow.downloadLog}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-200 transition duration-200 hover:border-white/20 hover:bg-white/[0.06] active:translate-y-px"
          >
            <Download className="h-4 w-4" />
            Tai nhat ky
          </button>
        </div>
      </div>
    )}

    <ProgressPanel workflow={workflow} progressPercent={progressPercent} />
    <DeveloperOverridePanel workflow={workflow} />

    {workflow.model ? (
      <div className="mt-4 rounded-md border border-white/8 bg-white/[0.025] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Cpu className="h-4 w-4 text-sky-200" />
          Thiet bi da nhan dien
        </div>
        <InfoGrid
          rows={[
            ["Mau may", workflow.model.name],
            ["ADB", workflow.targetDetection?.adbProduct ?? "--"],
            ["Fastboot", workflow.targetDetection?.fastbootProduct ?? "--"],
            ["Serial", workflow.targetDetection?.fastbootSerial ?? "--"],
            ["Trang thai", workflow.targetDetection?.verified ? "Da xac minh khop" : "Cho xac minh Fastboot"],
            ["Goi", "ftdPackage" in workflow.model ? workflow.model.ftdPackage : "--"],
          ]}
        />
      </div>
    ) : (
      <EmptyState icon={<Cpu className="h-4 w-4" />} title="Mau may chua khoa" text="Ket noi ADB Android hoac Fastboot de nhan dien mau may." />
    )}

    <div className="mt-4">
      {workflow.error ? (
        <ErrorBox message={workflow.error.message} advice={workflow.errorAdvice} />
      ) : (
        <InlineNotice
          tone={preflightReady ? "good" : "muted"}
          title={preflightReady ? "Kiem tra ban dau san sang" : "Kiem tra ban dau chua xong"}
          text={preflightReady ? "Co the chay buoc tiep theo khi danh sach tep tai xong." : "Hoan tat cac o xac nhan truoc khi chay buoc sau ket noi."}
        />
      )}
    </div>
  </section>
);

const TerminalPanel = ({
  logs,
  className = "",
  canRunCommand,
  running,
  onRunCommand,
}: {
  logs: WorkflowLog[];
  className?: string;
  canRunCommand: boolean;
  running: boolean;
  onRunCommand: (command: string) => Promise<void>;
}) => {
  const [command, setCommand] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const trimmedCommand = command.trim();
  const commandDisabled = !canRunCommand || running;
  const canSubmit = !commandDisabled && trimmedCommand.length > 0;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !stickToBottomRef.current) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [logs.length]);

  return (
    <aside className={`rounded-lg border border-white/8 bg-[#12161d]/90 p-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-7.25rem)] xl:self-start xl:overflow-hidden ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Terminal className="h-4 w-4 text-sky-200" />
          Nhat ky terminal
        </div>
        <span className="font-mono text-xs text-slate-500">{logs.length} dong</span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            return;
          }
          const nextCommand = trimmedCommand;
          setCommand("");
          void onRunCommand(nextCommand).catch(() => undefined);
        }}
        className="mb-3 grid grid-cols-[minmax(0,1fr)_44px] gap-2"
      >
        <label className="sr-only" htmlFor="fastboot-terminal-command">
          Lenh Fastboot
        </label>
        <input
          id="fastboot-terminal-command"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          disabled={commandDisabled}
          placeholder="fastboot devices"
          autoComplete="off"
          spellCheck={false}
          className="h-11 min-w-0 rounded-md border border-white/8 bg-[#05070a] px-3 font-mono text-xs text-slate-100 outline-none transition placeholder:text-slate-700 focus:border-sky-300/45 disabled:cursor-not-allowed disabled:text-slate-600"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          title="Gui lenh Fastboot"
          aria-label="Gui lenh Fastboot"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-sky-300/20 bg-sky-300 text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-600"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </button>
      </form>
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
        }}
        className="h-[320px] overflow-auto rounded-md border border-white/8 bg-[#05070a] p-4 font-mono text-xs leading-5 shadow-inner xl:h-[calc(100dvh-17rem)] xl:min-h-[360px]"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-slate-600">
            Nhat ky ADB/Fastboot se xuat hien o day. Go fastboot devices de lay serial.
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={`${log.time}-${index}`} className={logColor(log.level)}>
              <span className="text-slate-700">[{log.time}]</span> {log.message}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

const WorkflowStep = ({
  index,
  phase,
  status,
  active,
}: {
  index: number;
  phase: PhaseId;
  status: PhaseStatus;
  active: boolean;
}) => {
  const styles = statusStyles[status];

  return (
    <li className={`grid min-h-12 grid-cols-[34px_1fr_auto] items-center gap-2 rounded-md border px-2.5 transition duration-200 ${styles.row}`}>
      <div className={`flex h-7 w-7 items-center justify-center rounded-md border font-mono text-[11px] ${styles.dot}`}>
        {status === "done" ? <Check className="h-4 w-4" /> : status === "failed" ? <XCircle className="h-4 w-4" /> : status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : index}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{phaseLabels[phase]}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-current/45">{phase}</div>
      </div>
      <div className="flex items-center gap-2">
        {active && <span className="hidden rounded-sm bg-sky-300/10 px-2 py-1 text-[11px] font-semibold text-sky-100 2xl:inline">Hien tai</span>}
        <span className="text-xs text-current/55">{styles.label}</span>
      </div>
    </li>
  );
};

const CurrentPhaseBadge = ({ phase }: { phase: PhaseId }) => (
  <div className="inline-flex items-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/[0.07] px-3 py-2 text-sm font-medium text-sky-100">
    <Circle className="h-2.5 w-2.5 fill-sky-300 text-sky-300" />
    {phaseLabels[phase]}
  </div>
);

const EmptyState = ({ icon, title, text }: { icon: ReactNode; title: string; text: string }) => (
  <div className="mt-4 rounded-md border border-dashed border-white/10 bg-black/10 p-4">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
      <span className="text-slate-500">{icon}</span>
      {title}
    </div>
    <p className="text-sm leading-6 text-slate-500">{text}</p>
  </div>
);

const InfoGrid = ({ rows }: { rows: Array<[string, string]> }) => (
  <div className="space-y-2 text-sm">
    {rows.map(([label, value]) => (
      <div key={label} className="grid grid-cols-[88px_1fr] gap-3">
        <span className="text-slate-500">{label}</span>
        <span className="min-w-0 break-all text-right font-medium text-slate-200">{value}</span>
      </div>
    ))}
  </div>
);

const InlineNotice = ({ title, text, tone }: { title: string; text: string; tone: "good" | "muted" }) => (
  <div className={tone === "good" ? "rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-3" : "rounded-md border border-white/8 bg-white/[0.03] p-3"}>
    <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">{title}</div>
    <p className="text-sm leading-6 text-slate-400">{text}</p>
  </div>
);

const ErrorBox = ({ message, advice }: { message: string; advice?: string }) => (
  <div className="rounded-md border border-rose-300/30 bg-rose-400/[0.09] p-3">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-100">
      <XCircle className="h-4 w-4" />
      {message}
    </div>
    {advice && <p className="text-sm leading-6 text-rose-100/75">{advice}</p>}
  </div>
);

const StatusChip = ({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "bad" | "muted" | "neutral";
}) => {
  const toneClass = {
    good: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100",
    bad: "border-rose-300/25 bg-rose-300/[0.08] text-rose-100",
    muted: "border-white/8 bg-white/[0.03] text-slate-300",
    neutral: "border-sky-300/15 bg-sky-300/[0.06] text-sky-100",
  }[tone];

  return (
    <div className={`grid h-12 min-w-[190px] grid-cols-[18px_1fr] items-center gap-x-2 rounded-md border px-3 ${toneClass}`}>
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-current/60">{label}</div>
      <div />
      <div className="min-w-0 truncate text-xs font-semibold">{value}</div>
      <div />
      <div className="min-w-0 truncate text-[11px] text-current/55">{detail}</div>
    </div>
  );
};

const progressToPercent = (progress?: number) => {
  if (progress === undefined || !Number.isFinite(progress)) {
    return undefined;
  }
  return Math.round(Math.max(0, Math.min(1, progress)) * 100);
};

const formatPercent = (percent?: number) => (percent === undefined ? "--" : `${percent}%`);

const formatProgressCount = (progress: ProgressEvent | undefined, operationMode: boolean) => {
  if (progress?.completedItems !== undefined && progress.totalItems !== undefined) {
    return `${progress.completedItems}/${progress.totalItems} ${operationMode ? "thao tac" : "tep"}`;
  }
  if (progress?.completedFiles !== undefined && progress.totalFiles !== undefined) {
    return `${progress.completedFiles}/${progress.totalFiles} tep`;
  }
  return "--";
};

const formatBytes = (bytes?: number) => {
  if (bytes === undefined) {
    return "--";
  }
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

const formatBytePair = (received?: number, total?: number) => {
  if (received === undefined && total === undefined) {
    return "--";
  }
  return `${formatBytes(received)} / ${formatBytes(total)}`;
};

const formatRate = (bytesPerSecond: number) => `${formatBytes(bytesPerSecond)}/s`;

const formatEta = (seconds?: number) => {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return "--";
  }
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

const logColor = (level: WorkflowLog["level"]) => {
  if (level === "error") {
    return "text-rose-300";
  }
  if (level === "warn") {
    return "text-amber-300";
  }
  if (level === "success") {
    return "text-emerald-300";
  }
  if (level === "command") {
    return "text-sky-300";
  }
  return "text-slate-300";
};

export default App;
