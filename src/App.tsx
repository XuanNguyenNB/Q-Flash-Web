import {
  Check,
  CheckCircle2,
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

import { getAssetBaseUrl } from "./domain/assets";
import { phaseLabels, useUnlockWorkflow, type ResumePhase } from "./hooks/useUnlockWorkflow";
import { isPreflightReady } from "./workflow/preflight";
import type { PhaseId, PhaseStatus, ProgressEvent, WorkflowLog } from "./workflow/types";

type WorkflowState = ReturnType<typeof useUnlockWorkflow>;

const assetBaseUrl = getAssetBaseUrl();
const operationProgressStates = new Set(["flashing", "booting", "sahara", "configuring"]);

const preferredLegacyModelId = "xiaomi15ultra";

const destructiveCopy = (workflow: WorkflowState): Partial<Record<PhaseId, string>> => ({
  "write-efisp": "Toi xac nhan dang ghi gbl_efi_unlock.efi vao phan vung efisp dung model 8E Gen 5 da nhan dien.",
  "cleanup-data": "Toi xac nhan xoa efisp, metadata va userdata sau khi fastboot da bao unlocked: yes.",
  "downgrade-abl":
    workflow.workflowMode === "c06-edl"
      ? "Tôi xác nhận máy đang ở EDL 9008 và đang ghi ABL đúng mẫu máy qua Firehose SM8750."
      : "Tôi xác nhận đang ghi ABL cho đúng mẫu máy đã nhận diện.",
  "flash-ftd":
    workflow.workflowMode === "c06-edl"
      ? "Tôi xác nhận đã xử lý màn System destroyed sau EDL: bấm nguồn 1 lần để tắt, giữ Giảm âm 10-15 giây để vào lại Fastboot, rồi flash FTD đúng mẫu máy."
      : "Tôi xác nhận flash gói FTD đúng mẫu máy và chấp nhận mất dữ liệu.",
  "unlock-payload": "Tôi xác nhận máy đang ở Fastboot từ FTD để chạy payload unlock.",
  "restore-gpt": "Tôi xác nhận khôi phục GPT cuối, sau đó flash ROM gốc bằng MiFlash Clean All.",
});

const workflowModeCopy = {
  "standard-mqsas": {
    title: "Quy trình thường MQSAS",
    detail: "Boot Android permissive rồi ghi ABL qua MQSAS.",
  },
  "c06-edl": {
    title: "Nạp ABL qua EDL mode",
    detail: "Ghi ABL_A/ABL_B bằng Firehose khi máy đang ở Qualcomm 9008.",
  },
};

const workflowFamilyCopy = {
  "legacy-ftd": {
    title: "Xiaomi 15 Ultra / Legacy FTD",
    detail: "Dùng flow ABL + FTD + unlock payload + GPT như bản v1.",
  },
  "efisp-8e-gen5": {
    title: "Xiaomi 17 / K90 Pro Max 8E Gen 5",
    detail: "Chỉ ghi EFISP unlock, không dùng ABL/FTD/GPT của Mi15.",
  },
};

const edlModeInfo = "Dành cho các thiết bị có bản cập nhật đuôi C06, C07, C08.";

const fixedWarnings = [
  "Sai mẫu máy hoặc sai gói có thể brick máy.",
  "Web v1 không flash ROM gốc 8-12GB; bước cuối dùng MiFlash.",
  "Không chọn Clean All and Lock trong MiFlash.",
  "Không rút cáp khi đang flash phân vùng hoặc GPT.",
  "Flow 8E Gen 5 chi ho tro pudding, pandora, popsicle, nezha, myron.",
  "Legacy flow chi ho tro dada, haotian, xuanyuan, miro, annibale, piano.",
];

const statusStyles: Record<PhaseStatus, { row: string; dot: string; label: string }> = {
  pending: {
    row: "border-white/8 bg-white/[0.025] text-slate-500",
    dot: "border-slate-600 text-slate-600",
    label: "Chờ",
  },
  running: {
    row: "border-sky-300/35 bg-sky-300/[0.08] text-sky-100 shadow-[0_0_26px_rgba(56,189,248,0.08)]",
    dot: "border-sky-300 bg-sky-300/15 text-sky-200",
    label: "Đang chạy",
  },
  done: {
    row: "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100",
    dot: "border-emerald-300 bg-emerald-300/15 text-emerald-200",
    label: "Xong",
  },
  failed: {
    row: "border-rose-300/35 bg-rose-400/[0.09] text-rose-100",
    dot: "border-rose-300 bg-rose-300/15 text-rose-200",
    label: "Lỗi",
  },
  skipped: {
    row: "border-slate-500/20 bg-white/[0.018] text-slate-500",
    dot: "border-slate-600 text-slate-600",
    label: "Bỏ qua",
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
      ? "Đang mở WebUSB"
      : workflow.statuses["connect-device"] === "done"
        ? "Đã kết nối thiết bị"
        : workflow.awaitingFastbootVerification
          ? "Chờ xác minh Fastboot"
          : "Kết nối WebUSB";
  const connectHint =
    workflow.statuses["connect-device"] === "done"
      ? "Thiết bị đã được nhận diện và mẫu máy đã xác minh."
      : workflow.awaitingFastbootVerification
        ? "Máy đã reboot từ Android sang Fastboot. Bấm Kết nối Fastboot và chọn lại thiết bị."
      : !workflow.manifest
        ? "Đang tải danh sách tệp trước khi mở hộp chọn thiết bị."
        : !workflow.preflight.isHttps || !workflow.preflight.hasWebUsb
          ? "Cần HTTPS/localhost và Chrome hoặc Edge có WebUSB."
          : "Chọn ADB Android nếu máy đang vào hệ điều hành, hoặc Fastboot nếu máy đã ở bootloader.";
  const actionHint = workflow.busy
    ? "Đang chạy bước hiện tại."
    : workflow.awaitingFastbootVerification
      ? "Máy đang reboot sang Fastboot. Khi thấy màn Fastboot, bấm Kết nối Fastboot để xác minh mẫu máy."
      : workflow.nextPhase === "flash-ftd" && workflow.workflowMode === "c06-edl"
        ? "Sau khi nạp EDL, màn System destroyed là bình thường. Yên tâm, không sao: bấm nút nguồn 1 lần để tắt, giữ Giảm âm 10-15 giây để vào Fastboot, rồi bấm Kết nối lại Fastboot và flash FTD."
      : workflow.nextPhase === "write-efisp"
        ? "Ket noi ADB Android, kiem tra codename va SELinux Permissive truoc khi ghi gbl_efi_unlock.efi vao efisp."
        : workflow.nextPhase === "verify-unlock"
          ? "Ket noi lai Fastboot de doc unlocked. Chi tiep tuc cleanup khi fastboot bao unlocked: yes."
          : workflow.nextPhase === "cleanup-data"
            ? "Xoa efisp, metadata va userdata sau khi unlock thanh cong."
    : workflow.nextPhase === "connect-device"
      ? "Kết nối ADB Android để nhận diện và reboot bootloader, hoặc kết nối Fastboot nếu máy đã ở Fastboot."
      : !preflightReady
        ? "Tick đủ kiểm tra ban đầu để bật bước tiếp theo sau khi đã nhận diện máy."
        : !workflow.manifest
          ? "Đang tải danh sách tệp từ máy chủ."
          : workflow.requiresConfirmation && !workflow.canRun
            ? "Tick xác nhận của bước nguy hiểm để tiếp tục."
            : workflow.nextPhase === "finished"
              ? "Có thể tải nhật ký sau khi quy trình hoàn tất."
              : "Sẵn sàng chạy bước hiện tại.";

  return (
    <main className="min-h-dvh overflow-hidden bg-[#0b0d10] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.14),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(20,184,166,0.10),transparent_24%)]" />
      <div className="relative mx-auto min-h-dvh max-w-[1660px]">
        <header className="border-b border-white/8 bg-[#0f1217]/95 px-5 py-5 lg:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <span>Công cụ WebUSB thử nghiệm</span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span>ADB + Fastboot</span>
                {workflow.mockMode && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-amber-500/70" />
                    <span className="rounded-sm bg-amber-300/15 px-2 py-1 text-amber-100">MOCK BLAZER</span>
                  </>
                )}
              </div>
              <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">Xiaomi WebUSB Unlock</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Quy trình thử nghiệm cho Xiaomi 15 Ultra và các model legacy FTD. Tệp được kiểm tra SHA-256 và lưu bộ nhớ đệm trước khi chạy lệnh nguy hiểm.
              </p>
            </div>

            <ConnectionCard
              workflow={workflow}
              canConnectDevice={canConnectDevice}
              connectButtonLabel={connectButtonLabel}
              connectHint={connectHint}
            />
          </div>

          <TopStatusCards
            workflow={workflow}
            progressPercent={progressPercent}
            completedSteps={completedSteps}
            totalSteps={visiblePhaseOrder.length}
            riskOpen={riskOpen}
            setRiskOpen={setRiskOpen}
          />
        </header>

        <section className="grid gap-5 p-5 lg:p-6 xl:grid-cols-[340px_minmax(0,1fr)_400px] 2xl:grid-cols-[360px_minmax(420px,1fr)_420px]">
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
  <div className="w-full space-y-3 xl:max-w-[600px]">
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
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
        className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-200 transition duration-200 hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-slate-600"
      >
        <RefreshCcw className="h-4 w-4" />
        Ngắt kết nối / đặt lại phiên
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
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-500";
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
        Kết nối ADB Android
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
        Kết nối Fastboot
      </button>
    </div>
  );
};

const TopStatusCards = ({
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
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <CompactCard icon={<LockKeyhole />} label="Kiểm tra" value={`${preflightCount}/5`} detail="Cổng an toàn" tone={preflightCount === 5 ? "good" : "muted"} />
      <CompactCard
        icon={<Cpu />}
        label="Thiết bị"
        value={workflow.model?.name ?? "Chưa khóa"}
        detail={targetDetail(workflow)}
        tone={workflow.model ? "good" : "muted"}
      />
      <CompactCard
        icon={<HardDrive />}
        label="Tệp ROM"
        value={progressPercent === undefined ? assetBaseUrl : `${progressPercent}%`}
        detail={assetDetail(workflow)}
        tone="neutral"
      />
      <RiskDetails riskOpen={riskOpen} setRiskOpen={setRiskOpen} />
      <CompactCard
        icon={<Database />}
        label="Danh sách"
        value={workflow.manifest?.models.length.toString() ?? "--"}
        detail={`Bước ${completedSteps}/${totalSteps}`}
        tone="neutral"
      />
    </div>
  );
};

const targetDetail = (workflow: WorkflowState) => {
  if (!workflow.targetDetection) {
    return "Kết nối trước";
  }

  if (workflow.targetDetection.verified) {
    return `Đã xác minh ${workflow.targetDetection.fastbootProduct ?? workflow.detectedProduct}`;
  }

  return `ADB ${workflow.targetDetection.adbProduct ?? workflow.detectedProduct}; chờ Fastboot`;
};

const assetDetail = (workflow: WorkflowState) => {
  if (!workflow.progress) {
    return "Đường dẫn tệp tĩnh";
  }

  if (workflow.progress.bytesPerSecond) {
    return `${formatRate(workflow.progress.bytesPerSecond)} / còn lại ${formatEta(workflow.progress.etaSeconds)}`;
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
  const itemTitle = itemIsOperation ? "Thao tác hiện tại" : "Tệp hiện tại";
  const itemLabel = progress?.itemLabel ?? progress?.path ?? progress?.label ?? "--";
  const itemProgress = progressToPercent(progress?.itemProgress ?? progress?.progress);
  const progressCount = formatProgressCount(progress, itemIsOperation);

  return (
    <div className="mt-5 rounded-md border border-white/8 bg-black/10 p-4">
      <div className="mb-3 flex min-h-6 justify-between gap-3 text-sm">
        <span className="min-w-0 truncate leading-5 text-slate-300">{progress?.label ?? "Chưa có tác vụ tệp"}</span>
        <span className="shrink-0 font-mono text-slate-400">{formatPercent(progressPercent)}</span>
      </div>
      <div className="space-y-3">
        <ProgressMeter
          title="Tổng tiến trình"
          detail={progressCount}
          percent={progressPercent}
          barClassName="bg-sky-300"
        />
        <ProgressMeter
          title={itemTitle}
          detail={itemLabel}
          percent={itemProgress}
          barClassName={itemIsOperation ? "bg-emerald-300" : "bg-cyan-300"}
        />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Trạng thái" value={progress?.state ?? "--"} />
        <Metric label="Tệp" value={progressCount} />
        <Metric label="Dữ liệu" value={formatBytePair(progress?.receivedBytes, progress?.totalBytes)} />
        <Metric label="Tốc độ" value={progress?.bytesPerSecond ? formatRate(progress.bytesPerSecond) : "--"} />
      </div>
      <div className="mt-2 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <Metric label="Tệp hiện tại" value={progress?.path ?? progress?.itemLabel ?? "--"} />
        <Metric label="Dung lượng tệp" value={formatBytePair(progress?.fileReceivedBytes, progress?.fileTotalBytes)} />
      </div>
      <div className="mt-2 text-xs text-slate-500">Còn lại: {formatEta(progress?.etaSeconds)}</div>
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

  const selectableModels = (workflow.manifest?.models ?? []).filter((model) => model.family === workflow.workflowFamily);
  const preferredModel = selectableModels.find((model) => model.id === preferredLegacyModelId) ?? selectableModels[0];
  const canApply = Boolean(
    workflow.manifest && modelId && selectableModels.some((model) => model.id === modelId) && accepted && !workflow.busy,
  );

  useEffect(() => {
    if (selectableModels.length === 0) {
      setModelId("");
      return;
    }

    if (!selectableModels.some((model) => model.id === modelId)) {
      setModelId(
        workflow.model?.family === workflow.workflowFamily ? workflow.model.id : preferredModel?.id || "",
      );
    }

    if (!(workflow.visibleResumePhaseOrder as readonly ResumePhase[]).includes(phase)) {
      setPhase(workflow.visibleResumePhaseOrder[0] ?? "prepare-assets");
    }
  }, [modelId, phase, selectableModels, workflow.model, workflow.visibleResumePhaseOrder, workflow.workflowFamily]);

  return (
    <div className="mt-4 rounded-md border border-amber-300/15 bg-amber-300/[0.045] p-3">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <Wrench className="h-4 w-4" />
          Ghi đè lập trình viên / tiếp tục từ bước
        </span>
        <ChevronDown className={`h-4 w-4 text-amber-100/70 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-amber-200/10 pt-3">
          <p className="text-xs leading-5 text-amber-100/70">
            Chỉ dùng khi cần tiếp tục thủ công hoặc gỡ lỗi. Ứng dụng vẫn kiểm tra và lưu tệp vào bộ nhớ đệm trước khi chạy lệnh, nhưng mẫu máy/bước do bạn tự chọn.
          </p>
          <button
            type="button"
            disabled={workflow.busy}
            onClick={workflow.startBlazerMock}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-amber-200/20 bg-amber-200/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/15 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            <Wrench className="h-4 w-4" />
            Chạy mô phỏng blazer {"->"} Xiaomi 15 Ultra
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-amber-100/80">
              Mẫu máy
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
              Bước cần tiếp tục
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

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 rounded-sm border border-white/8 bg-white/[0.025] px-2 py-1.5">
    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</div>
    <div className="mt-0.5 truncate font-mono text-[11px] text-slate-300">{value}</div>
  </div>
);

const RiskDetails = ({ riskOpen, setRiskOpen }: { riskOpen: boolean; setRiskOpen: (value: boolean) => void }) => (
  <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 text-amber-50">
    <button type="button" onClick={() => setRiskOpen(!riskOpen)} className="flex w-full items-start justify-between gap-3 text-left">
      <span>
        <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/70">
          <ShieldAlert className="h-3.5 w-3.5" />
          Rủi ro
        </span>
        <span className="block text-sm font-semibold">Sai mẫu máy có thể brick máy</span>
        <span className="mt-1 block truncate text-xs text-amber-100/65">MiFlash cuối cùng: chỉ Clean All</span>
      </span>
      <ChevronDown className={`mt-1 h-4 w-4 shrink-0 transition ${riskOpen ? "rotate-180" : ""}`} />
    </button>
    {riskOpen && (
      <ul className="mt-3 space-y-2 border-t border-amber-200/10 pt-3 text-xs leading-5 text-amber-50/80">
        {fixedWarnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    )}
  </div>
);

const WorkflowFamilyPanel = ({ workflow }: { workflow: WorkflowState }) => (
  <div className="mb-4 rounded-md border border-white/8 bg-black/10 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-white">Chon dong quy trinh</div>
        <div className="text-xs leading-5 text-slate-500">8E Gen 5 tach rieng EFISP; legacy giu flow FTD cu.</div>
      </div>
      <span className="hidden rounded-sm border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-400 sm:inline">
        {workflowFamilyCopy[workflow.workflowFamily].title}
      </span>
    </div>
    <div className="grid gap-2">
      {(["legacy-ftd", "efisp-8e-gen5"] as const).map((family) => {
        const active = workflow.workflowFamily === family;
        const copy = workflowFamilyCopy[family];

        return (
          <button
            key={family}
            type="button"
            disabled={!workflow.canSwitchWorkflowFamily}
            onClick={() => workflow.setWorkflowFamily(family)}
            className={`min-h-[70px] rounded-md border p-3 text-left transition disabled:cursor-not-allowed ${
              active
                ? "border-emerald-300/35 bg-emerald-300/[0.08] text-emerald-50"
                : "border-white/8 bg-white/[0.025] text-slate-300 hover:border-white/18 hover:bg-white/[0.05]"
            } ${!workflow.canSwitchWorkflowFamily && !active ? "opacity-45" : ""}`}
          >
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
              {family === "efisp-8e-gen5" ? <Cpu className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}
              {copy.title}
            </span>
            <span className="block text-xs leading-5 text-current/65">{copy.detail}</span>
          </button>
        );
      })}
    </div>
  </div>
);

const WorkflowModePanel = ({ workflow }: { workflow: WorkflowState }) => (
  <div className="mb-4 rounded-md border border-white/8 bg-black/10 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-white">Chọn quy trình ABL</div>
        <div className="text-xs leading-5 text-slate-500">Chọn MQSAS cho flow thường; EDL mode dành cho máy cần nạp ABL qua 9008.</div>
      </div>
      <span className="hidden rounded-sm border border-white/10 px-2 py-1 text-[11px] font-semibold text-slate-400 sm:inline">
        {workflowModeCopy[workflow.workflowMode].title}
      </span>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {(["standard-mqsas", "c06-edl"] as const).map((mode) => {
        const active = workflow.workflowMode === mode;
        const copy = workflowModeCopy[mode];

        return (
          <button
            key={mode}
            type="button"
            disabled={!workflow.canSwitchWorkflowMode}
            onClick={() => workflow.setWorkflowMode(mode)}
            className={`min-h-[74px] rounded-md border p-3 text-left transition disabled:cursor-not-allowed ${
              active
                ? "border-sky-300/35 bg-sky-300/[0.08] text-sky-50"
                : "border-white/8 bg-white/[0.025] text-slate-300 hover:border-white/18 hover:bg-white/[0.05]"
            } ${!workflow.canSwitchWorkflowMode && !active ? "opacity-45" : ""}`}
          >
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
              {mode === "c06-edl" ? <Usb className="h-4 w-4" /> : <PlugZap className="h-4 w-4" />}
              {copy.title}
              {mode === "c06-edl" && (
                <span className="group relative inline-flex" title={edlModeInfo}>
                  <Info className="h-3.5 w-3.5 text-sky-100/75" aria-hidden="true" />
                  <span className="pointer-events-none absolute left-1/2 top-6 z-20 w-56 -translate-x-1/2 rounded-md border border-white/10 bg-[#05070a] px-2.5 py-2 text-xs font-medium leading-5 text-slate-200 opacity-0 shadow-xl transition group-hover:opacity-100">
                    {edlModeInfo}
                  </span>
                </span>
              )}
            </span>
            <span className="block text-xs leading-5 text-current/65">{copy.detail}</span>
          </button>
        );
      })}
    </div>
    {!workflow.canSwitchWorkflowMode && (
      <p className="mt-2 text-xs leading-5 text-slate-500">Không đổi quy trình sau khi đã bắt đầu bước hạ ABL.</p>
    )}
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
        ? "Có thể tải và kiểm tra ROM ngay sau khi đã khóa mẫu máy, không cần chờ tới bước Chuẩn bị tệp ROM."
        : "Khóa và xác minh mẫu máy trước để biết đúng gói ROM cần tải.";

  return (
    <div className="mb-4 rounded-md border border-white/8 bg-white/[0.025] p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
        </div>
        {running ? <Loader2 className="h-4 w-4 animate-spin text-sky-200" /> : <HardDrive className="h-4 w-4 text-sky-200" />}
      </div>
      <button
        type="button"
        disabled={!workflow.canPrepareAssetsEarly}
        onClick={workflow.prepareAssetsEarly}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.025] disabled:text-slate-500"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
        {title}
      </button>
    </div>
  );
};

const WorkflowRail = ({ workflow, className = "" }: { workflow: WorkflowState; className?: string }) => (
  <aside className={`rounded-lg border border-white/8 bg-[#12161d]/90 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.18)] ${className}`}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-white">Tiến trình quy trình</h2>
        <p className="mt-1 text-sm leading-6 text-slate-400">Tiến trình ADB/Fastboot/EDL theo đúng thứ tự công cụ.</p>
      </div>
      <CurrentPhaseBadge phase={workflow.nextPhase} />
    </div>
    <WorkflowFamilyPanel workflow={workflow} />
    {workflow.workflowFamily === "legacy-ftd" && <WorkflowModePanel workflow={workflow} />}
    <AssetPreloadPanel workflow={workflow} />
    <ol className="grid gap-2">
      {workflow.visiblePhaseOrder.map((phase, index) => (
        <WorkflowStep
          key={phase}
          index={index + 1}
          phase={phase}
          status={workflow.statuses[phase]}
          active={workflow.nextPhase === phase}
        />
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
          Điều khiển chính
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
            Tải nhật ký
          </button>
        </div>
        {workflow.canRebootAdbToFastboot && (
          <div className="rounded-md border border-white/8 bg-white/[0.025] p-3">
            <button
              type="button"
              onClick={workflow.rebootAdbToFastboot}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
            >
              <Usb className="h-4 w-4" />
              Máy đang ở Android: reboot bootloader
            </button>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Dùng khi máy vẫn vào Android/ADB. Sau khi máy vào Fastboot, bấm nút chính để chạy tiếp bước hiện tại.
            </p>
          </div>
        )}
      </div>
    )}

    <ProgressPanel workflow={workflow} progressPercent={progressPercent} />
    <DeveloperOverridePanel workflow={workflow} />

    {workflow.model ? (
      <div className="mt-4 rounded-md border border-white/8 bg-white/[0.025] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Cpu className="h-4 w-4 text-sky-200" />
          Thiết bị đã nhận diện
        </div>
        <InfoGrid
          rows={[
            ["Mẫu máy", workflow.model.name],
            ["ADB", workflow.targetDetection?.adbProduct ?? "--"],
            ["Fastboot", workflow.targetDetection?.fastbootProduct ?? "--"],
            ["Trạng thái", workflow.targetDetection?.verified ? "Đã xác minh khớp" : "Chờ xác minh Fastboot"],
            workflow.model.family === "legacy-ftd"
              ? ["Gói", workflow.model.ftdPackage]
              : ["EFISP", workflow.model.efispUnlockFile],
          ]}
        />
      </div>
    ) : (
      <EmptyState
        icon={<Cpu className="h-4 w-4" />}
        title="Mẫu máy chưa khóa"
        text="Kết nối ADB Android hoặc Fastboot để nhận diện mẫu máy."
      />
    )}

    <div className="mt-4">
      {workflow.error ? (
        <ErrorBox message={workflow.error.message} advice={workflow.errorAdvice} />
      ) : (
        <InlineNotice
          tone={preflightReady ? "good" : "muted"}
          title={preflightReady ? "Kiểm tra ban đầu sẵn sàng" : "Kiểm tra ban đầu chưa xong"}
          text={
            preflightReady
              ? "Có thể chạy bước tiếp theo khi danh sách tệp tải xong."
              : "Hoàn tất các ô xác nhận trước khi chạy bước sau kết nối."
          }
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
    <aside className={`rounded-lg border border-white/8 bg-[#12161d]/90 p-5 xl:sticky xl:top-5 xl:self-start ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Terminal className="h-4 w-4 text-sky-200" />
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
        <input
          id="fastboot-terminal-command"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          disabled={commandDisabled}
          placeholder="fastboot getvar product"
          autoComplete="off"
          spellCheck={false}
          className="h-11 min-w-0 rounded-md border border-white/8 bg-[#05070a] px-3 font-mono text-xs text-slate-100 outline-none transition placeholder:text-slate-700 focus:border-sky-300/45 disabled:cursor-not-allowed disabled:text-slate-600"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          title="Gửi lệnh Fastboot"
          aria-label="Gửi lệnh Fastboot"
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
        className="h-[320px] overflow-auto rounded-md border border-white/8 bg-[#05070a] p-4 font-mono text-xs leading-5 shadow-inner xl:h-[calc(100dvh-210px)] xl:min-h-[420px]"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-slate-600">
            Nhật ký ADB/Fastboot sẽ xuất hiện ở đây theo từng lệnh.
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

const CompactCard = ({
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
    <div className={`min-h-[96px] rounded-lg border p-3 ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-current/60">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div className="truncate text-sm font-semibold">{value}</div>
      <div className="mt-1 truncate text-xs text-current/55">{detail}</div>
    </div>
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
    <li className={`grid min-h-14 grid-cols-[42px_1fr_auto] items-center gap-3 rounded-md border px-3 transition duration-200 ${styles.row}`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-md border font-mono text-xs ${styles.dot}`}>
        {status === "done" ? <Check className="h-4 w-4" /> : status === "failed" ? <XCircle className="h-4 w-4" /> : status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : index}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{phaseLabels[phase]}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-current/45">{phase}</div>
      </div>
      <div className="flex items-center gap-2">
        {active && <span className="hidden rounded-sm bg-sky-300/10 px-2 py-1 text-[11px] font-semibold text-sky-100 sm:inline">Hiện tại</span>}
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
  <div
    className={
      tone === "good"
        ? "rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-3"
        : "rounded-md border border-white/8 bg-white/[0.03] p-3"
    }
  >
    <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
      <CheckCircle2 className={tone === "good" ? "h-4 w-4 text-emerald-200" : "h-4 w-4 text-slate-500"} />
      {title}
    </div>
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

const progressToPercent = (progress?: number) => {
  if (progress === undefined || !Number.isFinite(progress)) {
    return undefined;
  }

  return Math.round(Math.max(0, Math.min(1, progress)) * 100);
};

const formatPercent = (percent?: number) => (percent === undefined ? "--" : `${percent}%`);

const formatProgressCount = (progress: ProgressEvent | undefined, operationMode: boolean) => {
  if (progress?.completedItems !== undefined && progress.totalItems !== undefined) {
    return `${progress.completedItems}/${progress.totalItems} ${operationMode ? "thao tác" : "tệp"}`;
  }

  if (progress?.completedFiles !== undefined && progress.totalFiles !== undefined) {
    return `${progress.completedFiles}/${progress.totalFiles} tệp`;
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
