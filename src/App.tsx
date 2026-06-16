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
import type { DeviceStatus, PhaseId, PhaseStatus, ProgressEvent, WorkflowLog } from "./workflow/types";

type WorkflowState = ReturnType<typeof useUnlockWorkflow>;

const operationProgressStates = new Set(["flashing", "booting", "sahara", "configuring"]);
const preferredLegacyModelId = "xiaomi15ultra";

const destructiveCopy = (workflow: WorkflowState): Partial<Record<PhaseId, string>> => ({
  "flash-ftd":
    workflow.model?.family === "legacy-ftd" && workflow.model.adbExploit
      ? "Tôi xác nhận thiết bị đang ở màn hình Android chính, đã bật USB Debugging, đồng ý chạy ADB Exploit và flash FTD."
      : workflow.workflowMode === "edl-standard"
        ? "Tôi xác nhận ABL engineering đã được nạp thủ công, đồng ý chạy fastboot erase frp để verify, rồi flash FTD đúng mẫu máy."
        : "Tôi xác nhận ABL/parcel đã sẵn sàng, đồng ý chạy fastboot erase frp để verify, rồi flash FTD đúng mẫu máy.",
  "unlock-payload":
    "Tôi xác nhận máy đang ở Fastboot từ FTD; app sẽ nạp unlock payload riêng cho máy này rồi boot tạm vào Ennea kernel.",
  "restore-gpt": "Tôi xác nhận khôi phục GPT cuối, sau đó flash ROM gốc bằng MiFlash Clean All.",
});

const workflowModeCopy = {
  standard: {
    title: "Standard",
    detail: "Detect product, tải ROM FTD, flash FTD, chạy payload mở khóa và khôi phục GPT.",
  },
  "edl-standard": {
    title: "EDL_Standard",
    detail: "Flow Fastboot/FTD sau khi ABL engineering đã nạp thủ công; app verify bằng fastboot erase frp trước khi flash.",
  },
};

const edlModeInfo =
  "EDL_Standard không nạp ABL qua browser; hãy nạp ABL engineering thủ công trước, rồi app sẽ verify bằng fastboot erase frp trước khi flash FTD.";

const fixedWarnings = [
  "Sai mẫu máy hoặc sai gói có thể brick máy.",
  "Web không flash ROM gốc 8-12GB; bước cuối dùng MiFlash.",
  "Không chọn Clean All and Lock trong MiFlash.",
  "Không rút cáp khi đang flash phân vùng hoặc GPT.",
  "Chỉ hỗ trợ 18 mẫu SM8550/8650/8635/8735/8750 — xem danh sách đầy đủ trong panel trái.",
];

const deviceStatusCopy: Record<DeviceStatus, { label: string; tone: ToneTag }> = {
  disconnected: { label: "Chưa kết nối", tone: "muted" },
  adb: { label: "ADB Android", tone: "good" },
  fastboot: { label: "Fastboot", tone: "info" },
  edl: { label: "EDL", tone: "warn" },
  firehose: { label: "Firehose", tone: "warn" },
  "waiting-manual-reboot": { label: "Chờ reboot thủ công", tone: "warn" },
};

type ToneTag = "good" | "bad" | "muted" | "neutral" | "info" | "warn";

const statusStyles: Record<PhaseStatus, { row: string; dot: string; label: string; connector: string }> = {
  pending: {
    row: "border-white/8 bg-white/[0.02] text-slate-500",
    dot: "border-slate-700 text-slate-600",
    label: "Chờ",
    connector: "bg-white/10",
  },
  running: {
    row: "border-cyan-300/40 bg-cyan-300/[0.07] text-cyan-50",
    dot: "border-cyan-300 bg-cyan-300/15 text-cyan-200",
    label: "Đang chạy",
    connector: "bg-cyan-300/40",
  },
  done: {
    row: "border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-100",
    dot: "border-emerald-300 bg-emerald-300/15 text-emerald-200",
    label: "Xong",
    connector: "bg-emerald-300/40",
  },
  failed: {
    row: "border-rose-300/40 bg-rose-400/[0.08] text-rose-100",
    dot: "border-rose-300 bg-rose-300/15 text-rose-200",
    label: "Lỗi",
    connector: "bg-rose-300/40",
  },
  skipped: {
    row: "border-slate-500/20 bg-white/[0.015] text-slate-500",
    dot: "border-slate-700 text-slate-600",
    label: "Bỏ qua",
    connector: "bg-white/10",
  },
};

function App() {
  const [riskOpen, setRiskOpen] = useState(false);
  const workflow = useUnlockWorkflow();
  const visiblePhaseOrder = workflow.visiblePhaseOrder;
  const progressPercent = progressToPercent(workflow.progress?.overallProgress ?? workflow.progress?.progress);
  const preflightReady = isPreflightReady(workflow.preflight);
  const completedSteps = visiblePhaseOrder.filter((phase) => workflow.statuses[phase] === "done").length;
  const mainDisabled = workflow.nextPhase === "finished" ? workflow.logs.length === 0 : !workflow.canRun;
  const connectHint =
    workflow.statuses["connect-device"] === "done"
      ? "Thiết bị đã được nhận diện, product và serial Fastboot đã được ghi lại nếu bootloader trả về."
      : workflow.awaitingFastbootVerification
        ? "Máy đã reboot từ Android sang Fastboot. Bấm Kết nối Fastboot và chọn lại thiết bị."
        : !workflow.manifest
          ? "Đang tải danh sách file trước khi mở hộp chọn thiết bị."
          : !workflow.preflight.isHttps || !workflow.preflight.hasWebUsb
            ? "Cần HTTPS/localhost và Chrome hoặc Edge có WebUSB."
            : "Chọn ADB Android (yêu cầu bật USB Debugging) để bắt đầu. Với Xiaomi 13/14, Redmi K60/K70/K80 (HyperOS 2.0), quy trình bắt đầu từ màn hình Android chính.";
  const actionHint = workflow.busy
    ? "Đang chạy bước hiện tại."
    : workflow.awaitingFastbootVerification
      ? "Máy đang reboot sang Fastboot. Khi thấy màn Fastboot, bấm Kết nối Fastboot để xác minh mẫu máy."
      : workflow.nextPhase === "connect-device"
        ? "Kết nối ADB Android để nhận diện, hoặc kết nối Fastboot nếu máy đã ở bootloader."
        : workflow.nextPhase === "flash-ftd"
          ? (workflow.model?.family === "legacy-ftd" && workflow.model.adbExploit
            ? "Thiết bị sẽ chạy ADB Exploit để lấy root và nạp engineering ABL, sau đó tự reboot vào Fastboot để tiếp tục flash FTD."
            : "Trước khi flash FTD, app sẽ chạy fastboot erase frp. Nếu fail thì ABL engineering/parcel chưa OK hoặc Fastboot chưa đúng trạng thái.")
          : workflow.workflowMode !== "edl-standard" && !preflightReady
            ? "Tick đủ kiểm tra ban đầu để bật bước tiếp theo sau khi đã nhận diện máy."
            : workflow.requiresConfirmation && !workflow.canRun
              ? "Tick xác nhận của bước nguy hiểm để tiếp tục."
              : workflow.nextPhase === "finished"
                ? "Có thể tải nhật ký sau khi quy trình hoàn tất."
                : "Sẵn sàng chạy bước hiện tại.";

  return (
    <main className="min-h-dvh text-slate-100">
      <div className="relative mx-auto flex min-h-dvh max-w-[1720px] flex-col">
        <TopBar workflow={workflow} progressPercent={progressPercent} completedSteps={completedSteps} totalSteps={visiblePhaseOrder.length} />

        <section className="grid flex-1 gap-4 px-4 py-4 lg:px-6 xl:grid-cols-[300px_minmax(0,1fr)_400px] xl:items-start 2xl:grid-cols-[330px_minmax(440px,1fr)_420px]">
          <ControlTower className="order-1 xl:order-1" workflow={workflow} riskOpen={riskOpen} setRiskOpen={setRiskOpen} />
          <ControlPanel
            className="order-2 xl:order-2"
            workflow={workflow}
            progressPercent={progressPercent}
            actionHint={actionHint}
            connectHint={connectHint}
            mainDisabled={mainDisabled}
            preflightReady={preflightReady}
          />
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

const TopBar = ({
  workflow,
  progressPercent,
  completedSteps,
  totalSteps,
}: {
  workflow: WorkflowState;
  progressPercent?: number;
  completedSteps: number;
  totalSteps: number;
}) => {
  const status = deviceStatusCopy[workflow.deviceStatus];
  const product = workflow.targetDetection?.fastbootProduct ?? workflow.targetDetection?.adbProduct ?? workflow.detectedProduct;

  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-[var(--bg-panel)]/92 px-4 py-2.5 backdrop-blur-md lg:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
            <LockKeyhole className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              Xiaomi WebUSB Unlock
              {workflow.mockMode && (
                <span className="rounded-sm bg-amber-300/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-200">MOCK</span>
              )}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">detect → flash FTD → unlock → restore GPT</div>
          </div>
        </div>

        <div className="hidden h-7 w-px bg-white/10 sm:block" />

        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          <TopPill icon={<Cpu className="h-3.5 w-3.5" />} label={workflow.model?.name ?? "Chưa khóa mẫu"} value={product || undefined} tone={workflow.model ? "good" : "muted"} />
          <TopPill icon={<Database className="h-3.5 w-3.5" />} label="Bước" value={`${completedSteps}/${totalSteps}`} tone="neutral" />
          <TopPill icon={<HardDrive className="h-3.5 w-3.5" />} label="ROM" value={progressPercent === undefined ? "—" : `${progressPercent}%`} tone="info" />
          <TopPill icon={<PlugZap className="h-3.5 w-3.5" />} label={workflowModeCopy[workflow.workflowMode].title} tone="neutral" mono />
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${toneClass(status.tone)}`}>
            <span className={`h-2 w-2 rounded-full ${status.tone === "good" ? "bg-emerald-300" : status.tone === "info" ? "bg-cyan-300" : status.tone === "warn" ? "bg-amber-300" : "bg-slate-500"} ${workflow.deviceStatus !== "disconnected" ? "animate-pulse" : ""}`} />
            {status.label}
          </span>
          <button
            type="button"
            disabled={!workflow.canDisconnect}
            onClick={workflow.resetSession}
            title="Ngắt kết nối / đặt lại phiên"
            aria-label="Ngắt kết nối / đặt lại phiên"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-slate-600"
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Đặt lại</span>
          </button>
        </div>
      </div>
    </header>
  );
};

const TopPill = ({
  icon,
  label,
  value,
  tone,
  mono = false,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  tone: ToneTag;
  mono?: boolean;
}) => (
  <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${toneClass(tone)}`}>
    <span className="shrink-0 opacity-80">{icon}</span>
    <span className="truncate font-medium">{label}</span>
    {value && <span className={`shrink-0 truncate text-current/70 ${mono ? "font-mono" : "font-mono"}`}>{value}</span>}
  </span>
);

const ControlTower = ({
  workflow,
  riskOpen,
  setRiskOpen,
  className = "",
}: {
  workflow: WorkflowState;
  riskOpen: boolean;
  setRiskOpen: (value: boolean) => void;
  className?: string;
}) => (
  <aside className={`flex flex-col gap-3 rounded-lg border border-white/8 bg-[var(--bg-panel)]/90 p-3.5 shadow-[0_22px_70px_rgba(0,0,0,0.22)] xl:sticky xl:top-[4.25rem] xl:max-h-[calc(100dvh-5rem)] xl:overflow-y-auto ${className}`}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-white">Tiến trình quy trình</h2>
      <CurrentPhaseBadge phase={workflow.nextPhase} />
    </div>
    <Stepper workflow={workflow} />
    <WorkflowModePanel workflow={workflow} />
    <AssetPreloadPanel workflow={workflow} />
    <RiskPanel riskOpen={riskOpen} setRiskOpen={setRiskOpen} />
    <DeveloperOverridePanel workflow={workflow} />
  </aside>
);

const Stepper = ({ workflow }: { workflow: WorkflowState }) => (
  <ol className="relative grid gap-1">
    {workflow.visiblePhaseOrder.map((phase, index) => {
      const status = workflow.statuses[phase];
      const active = workflow.nextPhase === phase;
      const styles = statusStyles[status];
      const isLast = index === workflow.visiblePhaseOrder.length - 1;

      return (
        <li key={phase} className="relative">
          <div
            className={`grid grid-cols-[28px_1fr_auto] items-center gap-2.5 rounded-md border px-2.5 py-2 transition duration-200 ${styles.row} ${active && status === "running" ? "phase-glow" : ""}`}
          >
            <div className={`flex h-7 w-7 items-center justify-center rounded-md border font-mono text-[11px] ${styles.dot}`}>
              {status === "done" ? (
                <Check className="h-4 w-4" />
              ) : status === "failed" ? (
                <XCircle className="h-4 w-4" />
              ) : status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                index + 1
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{phaseLabels[phase]}</div>
              <div className="truncate font-mono text-[10px] text-current/45">{phase}</div>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wide text-current/55">{styles.label}</span>
          </div>
          {!isLast && <span className={`ml-[1.55rem] block h-2 w-px ${styles.connector}`} />}
        </li>
      );
    })}
  </ol>
);

const RiskPanel = ({ riskOpen, setRiskOpen }: { riskOpen: boolean; setRiskOpen: (value: boolean) => void }) => (
  <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.05]">
    <button
      type="button"
      onClick={() => setRiskOpen(!riskOpen)}
      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-amber-100">
        <ShieldAlert className="h-4 w-4 text-amber-200/80" />
        Cảnh báo rủi ro
      </span>
      <ChevronDown className={`h-4 w-4 text-amber-100/70 transition ${riskOpen ? "rotate-180" : ""}`} />
    </button>
    {riskOpen && (
      <ul className="grid gap-1 border-t border-amber-200/10 px-3 py-2 text-xs leading-5 text-amber-50/85">
        {fixedWarnings.map((warning) => (
          <li key={warning} className="flex gap-1.5">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-300/70" />
            {warning}
          </li>
        ))}
      </ul>
    )}
  </div>
);

const WorkflowModePanel = ({ workflow }: { workflow: WorkflowState }) => (
  <div className="rounded-md border border-white/8 bg-black/15 p-2.5">
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="text-sm font-semibold text-white">Quy trình FTD</div>
      <span className="hidden rounded-sm border border-white/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-400 sm:inline">
        {workflowModeCopy[workflow.workflowMode].title}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-1 rounded-md border border-white/8 bg-white/[0.02] p-1">
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
            className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded px-2 text-center text-xs font-semibold transition disabled:cursor-not-allowed ${
              active
                ? "bg-cyan-300 text-slate-950 shadow-[0_8px_24px_rgba(34,211,238,0.18)]"
                : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
            } ${!workflow.canSwitchWorkflowMode && !active ? "opacity-45" : ""}`}
          >
            {mode === "edl-standard" ? <Usb className="h-3.5 w-3.5" /> : <PlugZap className="h-3.5 w-3.5" />}
            <span className="truncate">{copy.title}</span>
            {mode === "edl-standard" && (
              <span className="group relative inline-flex" title={edlModeInfo}>
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="pointer-events-none absolute left-1/2 top-6 z-20 w-56 -translate-x-1/2 rounded-md border border-white/10 bg-[var(--bg-inset)] px-2.5 py-2 text-xs font-medium leading-5 text-slate-200 opacity-0 shadow-xl transition group-hover:opacity-100">
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
  const title = done ? "ROM đã chuẩn bị" : running ? "Đang chuẩn bị ROM" : "Chuẩn bị ROM trước";
  const detail = done
    ? "Tệp ROM đã được tải, kiểm tra SHA-256 và lưu trong bộ nhớ đệm."
    : running
      ? "Đang tải và kiểm tra ROM; bước Chuẩn bị tệp ROM sẽ tự hoàn tất khi xong."
      : workflow.model
        ? "Có thể tải và kiểm tra ROM ngay sau khi đã khóa mẫu máy."
        : "Khóa và xác minh mẫu máy trước để biết đúng gói ROM cần tải.";

  return (
    <div className="rounded-md border border-white/8 bg-white/[0.02] p-2.5">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-0.5 text-xs leading-5 text-slate-500" title={detail}>
            {detail}
          </div>
        </div>
        <button
          type="button"
          disabled={!workflow.canPrepareAssetsEarly}
          onClick={workflow.prepareAssetsEarly}
          aria-label={title}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.025] disabled:text-slate-500"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
          {done ? "Đã chuẩn bị" : running ? "Đang tải" : "Chuẩn bị"}
        </button>
      </div>
    </div>
  );
};

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
    <div className="rounded-md border border-amber-300/15 bg-amber-300/[0.04]">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <Wrench className="h-4 w-4" />
          Ghi đè lập trình viên
        </span>
        <ChevronDown className={`h-4 w-4 text-amber-100/70 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-amber-200/10 px-3 py-3">
          <p className="text-xs leading-5 text-amber-100/70">
            Chỉ dùng khi cần tiếp tục thủ công hoặc gỡ lỗi. App vẫn kiểm tra và cache file trước khi chạy lệnh nguy hiểm.
          </p>
          <button
            type="button"
            disabled={workflow.busy}
            onClick={workflow.startBlazerMock}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-amber-200/20 bg-amber-200/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/15 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            <Wrench className="h-4 w-4" />
            Chạy mô phỏng blazer → Xiaomi 15 Ultra
          </button>
          <div className="grid gap-3">
            <label className="space-y-1 text-xs font-medium text-amber-100/80">
              Mẫu máy
              <select
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                className="min-h-10 w-full rounded-md border border-white/10 bg-[var(--bg-base)] px-3 text-sm text-slate-100 outline-none focus:border-amber-200/40"
              >
                {selectableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.product})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-amber-100/80">
              Bước cần tiếp tục
              <select
                value={phase}
                onChange={(event) => setPhase(event.target.value as ResumePhase)}
                className="min-h-10 w-full rounded-md border border-white/10 bg-[var(--bg-base)] px-3 text-sm text-slate-100 outline-none focus:border-amber-200/40"
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
            Tôi hiểu ghi đè có thể làm sai thứ tự thao tác nếu chọn nhầm mẫu máy/bước.
          </label>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => workflow.applyDeveloperOverride(modelId, phase)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            <Wrench className="h-4 w-4" />
            Áp dụng ghi đè tiếp tục
          </button>
        </div>
      )}
    </div>
  );
};

const ControlPanel = ({
  workflow,
  progressPercent,
  actionHint,
  connectHint,
  mainDisabled,
  preflightReady,
  className = "",
}: {
  workflow: WorkflowState;
  progressPercent?: number;
  actionHint: string;
  connectHint: string;
  mainDisabled: boolean;
  preflightReady: boolean;
  className?: string;
}) => (
  <section className={`rounded-lg border border-white/8 bg-[var(--bg-elevated)]/90 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.24)] ${className}`}>
    <PhaseHero workflow={workflow} actionHint={actionHint} />

    {workflow.requiresConfirmation && (
      <label className="mb-4 flex items-start gap-3 rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-3 text-sm leading-6 text-amber-100">
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
      <div className="space-y-2">
        <EntryConnectActions workflow={workflow} canConnectDevice={workflow.canConnectEntry} />
        <p className="text-xs leading-5 text-slate-500">{connectHint}</p>
      </div>
    ) : (
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <button
          type="button"
          disabled={mainDisabled}
          onClick={workflow.nextPhase === "finished" ? workflow.downloadLog : workflow.runNext}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-cyan-300 to-teal-300 px-5 py-3 text-base font-semibold text-slate-950 transition duration-200 hover:-translate-y-0.5 hover:from-cyan-200 hover:to-teal-200 active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
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
          Tải nhật ký
        </button>
      </div>
    )}

    <ProgressPanel workflow={workflow} progressPercent={progressPercent} />

    {workflow.model ? (
      <div className="mt-4 rounded-md border border-white/8 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Cpu className="h-4 w-4 text-cyan-200" />
          Thiết bị đã nhận diện
        </div>
        <InfoGrid
          rows={[
            ["Mẫu máy", workflow.model.name],
            ["ADB", workflow.targetDetection?.adbProduct ?? "—"],
            ["Fastboot", workflow.targetDetection?.fastbootProduct ?? "—"],
            ["Serial", workflow.targetDetection?.fastbootSerial ?? "—"],
            ["Trạng thái", workflow.targetDetection?.verified ? "Đã xác minh khớp" : "Chờ xác minh Fastboot"],
            ["Gói", "ftdPackage" in workflow.model ? workflow.model.ftdPackage : "—"],
          ]}
        />
      </div>
    ) : (
      <EmptyState icon={<Cpu className="h-4 w-4" />} title="Mẫu máy chưa khóa" text="Kết nối ADB Android hoặc Fastboot để nhận diện mẫu máy." />
    )}

    <div className="mt-4">
      {workflow.error ? (
        <ErrorBox message={workflow.error.message} advice={workflow.errorAdvice} />
      ) : (
        <InlineNotice
          tone={preflightReady ? "good" : "muted"}
          title={preflightReady ? "Kiểm tra ban đầu sẵn sàng" : "Kiểm tra ban đầu chưa xong"}
          text={preflightReady ? "Có thể chạy bước tiếp theo khi danh sách tệp tải xong." : "Hoàn tất các ô xác nhận trước khi chạy bước sau kết nối."}
        />
      )}
    </div>
  </section>
);

const PhaseHero = ({ workflow, actionHint }: { workflow: WorkflowState; actionHint: string }) => (
  <div className="mb-5">
    <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-200/80">
      <PlugZap className="h-3.5 w-3.5" />
      Điều khiển chính
    </div>
    <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">{phaseLabels[workflow.nextPhase]}</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{actionHint}</p>
  </div>
);

const EntryConnectActions = ({
  workflow,
  canConnectDevice,
}: {
  workflow: WorkflowState;
  canConnectDevice: boolean;
}) => {
  const buttonBase =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-500";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        disabled={!canConnectDevice || workflow.busy}
        onClick={workflow.connectAdbEntry}
        className={`${buttonBase} border border-emerald-300/20 bg-emerald-300 text-slate-950 hover:bg-emerald-200`}
      >
        {workflow.busy && workflow.nextPhase === "connect-device" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Usb className="h-4 w-4" />}
        Kết nối ADB Android
      </button>
      <button
        type="button"
        disabled={!canConnectDevice || workflow.busy}
        onClick={workflow.connectFastbootEntry}
        className={`${buttonBase} border border-cyan-300/20 bg-cyan-300 text-slate-950 hover:bg-cyan-200`}
      >
        {workflow.busy && workflow.nextPhase === "connect-device" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
        Kết nối Fastboot
      </button>
    </div>
  );
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
  const itemTitle = itemIsOperation ? "Thao tác hiện tại" : "Tệp hiện tại";
  const itemLabel = progress?.itemLabel ?? progress?.path ?? progress?.label ?? "—";
  const itemProgress = progressToPercent(progress?.itemProgress ?? progress?.progress);
  const progressCount = formatProgressCount(progress, itemIsOperation);

  return (
    <div className="mt-5 rounded-md border border-white/8 bg-[var(--bg-inset)]/60 p-4">
      <div className="mb-3 flex min-h-6 justify-between gap-3 text-sm">
        <span className="min-w-0 truncate leading-5 text-slate-300">{progress?.label ?? "Chưa có tác vụ tệp"}</span>
        <span className="shrink-0 font-mono text-slate-400">{formatPercent(progressPercent)}</span>
      </div>
      <div className="space-y-3">
        <ProgressMeter title="Tổng tiến trình" detail={progressCount} percent={progressPercent} barClassName="bg-gradient-to-r from-cyan-300 to-teal-300" />
        <ProgressMeter title={itemTitle} detail={itemLabel} percent={itemProgress} barClassName={itemIsOperation ? "bg-emerald-300" : "bg-cyan-300"} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Trạng thái" value={progress?.state ?? "—"} />
        <Metric label="Tệp" value={progressCount} />
        <Metric label="Dữ liệu" value={formatBytePair(progress?.receivedBytes, progress?.totalBytes)} />
        <Metric label="Tốc độ" value={progress?.bytesPerSecond ? formatRate(progress.bytesPerSecond) : "—"} />
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
    <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
      <div className={`h-full rounded-full transition-[width] duration-300 ${barClassName}`} style={{ width: `${percent ?? 0}%` }} />
    </div>
    <div className="mt-1 truncate font-mono text-[11px] text-slate-500">{detail}</div>
  </div>
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
    <aside className={`flex flex-col rounded-lg border border-white/8 bg-[var(--bg-elevated)]/90 p-4 xl:sticky xl:top-[4.25rem] xl:max-h-[calc(100dvh-5rem)] xl:self-start ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Terminal className="h-4 w-4 text-cyan-200" />
          Nhật ký terminal
        </div>
        <span className="font-mono text-xs text-slate-500">{logs.length} dòng</span>
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
          Lệnh Fastboot
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-300/70">{">"}</span>
          <input
            id="fastboot-terminal-command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            disabled={commandDisabled}
            placeholder="fastboot devices"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full min-w-0 rounded-md border border-white/8 bg-[var(--bg-inset)] pl-7 pr-3 font-mono text-xs text-slate-100 outline-none transition placeholder:text-slate-700 focus:border-cyan-300/45 disabled:cursor-not-allowed disabled:text-slate-600"
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          title="Gửi lệnh Fastboot"
          aria-label="Gửi lệnh Fastboot"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-600"
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
        className="h-[320px] flex-1 overflow-auto rounded-md border border-white/8 bg-[var(--bg-inset)] p-4 font-mono text-xs leading-5 shadow-inner xl:h-auto xl:min-h-[360px]"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-slate-600">
            Nhật ký ADB/Fastboot sẽ xuất hiện ở đây. Gõ fastboot devices để lấy serial.
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

const CurrentPhaseBadge = ({ phase }: { phase: PhaseId }) => (
  <div className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-2.5 py-1 text-xs font-medium text-cyan-100">
    <Circle className="h-2 w-2 fill-cyan-300 text-cyan-300" />
    {phaseLabels[phase]}
  </div>
);

const EmptyState = ({ icon, title, text }: { icon: ReactNode; title: string; text: string }) => (
  <div className="mt-4 rounded-md border border-dashed border-white/10 bg-black/15 p-4">
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
        <span className="min-w-0 break-all text-right font-mono font-medium text-slate-200">{value}</span>
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

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-sm border border-white/8 bg-white/[0.025] px-2 py-1.5">
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</div>
    <div className="mt-0.5 truncate font-mono text-[11px] text-slate-300">{value}</div>
  </div>
);

const toneClass = (tone: ToneTag) =>
  ({
    good: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100",
    bad: "border-rose-300/25 bg-rose-300/[0.08] text-rose-100",
    muted: "border-white/8 bg-white/[0.03] text-slate-300",
    neutral: "border-white/10 bg-white/[0.04] text-slate-200",
    info: "border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-100",
    warn: "border-amber-300/20 bg-amber-300/[0.07] text-amber-100",
  })[tone];

const progressToPercent = (progress?: number) => {
  if (progress === undefined || !Number.isFinite(progress)) {
    return undefined;
  }
  return Math.round(Math.max(0, Math.min(1, progress)) * 100);
};

const formatPercent = (percent?: number) => (percent === undefined ? "—" : `${percent}%`);

const formatProgressCount = (progress: ProgressEvent | undefined, operationMode: boolean) => {
  if (progress?.completedItems !== undefined && progress.totalItems !== undefined) {
    return `${progress.completedItems}/${progress.totalItems} ${operationMode ? "thao tác" : "tệp"}`;
  }
  if (progress?.completedFiles !== undefined && progress.totalFiles !== undefined) {
    return `${progress.completedFiles}/${progress.totalFiles} tệp`;
  }
  return "—";
};

const formatBytes = (bytes?: number) => {
  if (bytes === undefined) {
    return "—";
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
    return "—";
  }
  return `${formatBytes(received)} / ${formatBytes(total)}`;
};

const formatRate = (bytesPerSecond: number) => `${formatBytes(bytesPerSecond)}/s`;

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
    return "text-cyan-300";
  }
  return "text-slate-300";
};

export default App;
