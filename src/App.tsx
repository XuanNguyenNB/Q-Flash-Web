import {
  Check,
  ChevronDown,
  Circle,
  Cpu,
  Database,
  Download,
  ExternalLink,
  HardDrive,
  HeartHandshake,
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
import QRCode from "qrcode";

import mascotLogo from "./assets/unlock-xiaomi-mascot.png";
import { phaseLabels, useUnlockWorkflow, workflowPhaseOrder } from "./hooks/useUnlockWorkflow";
import {
  auditDeveloperOverride,
  getDeveloperOverrideStatus,
  loginDeveloperOverride,
  logoutDeveloperOverride,
  type ActiveDeveloperOverrideMode,
  type DeveloperOverrideSession,
} from "./services/developerOverrideApi";
import { createDonation, getDonation, type Donation } from "./services/paymentApi";
import { isPreflightReady } from "./workflow/preflight";
import {
  overrideGateIds,
  type CompatibilityVerdict,
  type DeviceStatus,
  type OverrideGateId,
  type PhaseId,
  type PhaseStatus,
  type ProgressEvent,
  type WorkflowMode,
  type WorkflowLog,
} from "./workflow/types";

type WorkflowState = ReturnType<typeof useUnlockWorkflow>;

const operationProgressStates = new Set(["flashing", "booting", "sahara", "configuring"]);
const donationSuggestions = [20000, 50000, 100000, 200000] as const;
const donationMinVnd = 10000;
const donationMaxVnd = 5000000;
const donationPollMs = 4000;
const developerOverrideModes: readonly ActiveDeveloperOverrideMode[] = ["resume", "selective_bypass", "full_override"];

const developerOverrideModeLabels: Record<ActiveDeveloperOverrideMode, string> = {
  resume: "Resume",
  selective_bypass: "Selective Bypass",
  full_override: "Full Override",
};

const developerOverrideGateLabels: Record<OverrideGateId, string> = {
  model_verification: "Model verification",
  preflight: "Preflight",
  payment: "Payment",
  destructive_confirmation: "Confirmation",
  asset_verification: "Asset verification",
  asset_key_authorization: "Asset key",
  antirollback: "Antirollback",
  compatibility: "Compatibility",
  fastboot_product: "Fastboot product",
  efisp_unlock_verification: "EFISP unlock",
};

const destructiveCopy = (workflow: WorkflowState): Partial<Record<PhaseId, string>> => ({
  "boot-permissive":
    workflow.model?.family === "legacy-ftd"
      ? "Tôi xác nhận đúng thiết bị legacy 8E đã được xác minh qua ADB/Fastboot và đồng ý boot Android với SELinux permissive để ghi ABL."
      : "Tôi xác nhận đúng thiết bị EFISP Gen 5 đã được xác minh qua ADB/Fastboot và đồng ý boot Android với SELinux permissive.",
  "write-abl":
    "Toi xac nhan may dang o Android permissive, dung model va dong y ghi ABL engineering vao abl_a/abl_b qua MQSAS.",
  "write-efisp":
    "Tôi xác nhận ADB đã được cho phép từ máy tính này và đồng ý ghi gbl_efi_unlock.efi vào phân vùng efisp qua MQSAS.",
  "cleanup-data":
    "Tôi xác nhận app đã đọc được unlocked: yes và đồng ý xóa efisp, metadata, userdata. Toàn bộ dữ liệu người dùng sẽ mất.",
  "flash-ftd":
    workflow.model?.family === "legacy-ftd" && workflow.model.adbExploit
      ? "Tôi xác nhận thiết bị đang ở màn hình Android chính, đã bật USB Debugging, đồng ý chạy ADB Exploit và flash FTD."
      : workflow.workflowMode === "edl-standard"
        ? "Tôi xác nhận ABL engineering đã được nạp thủ công, đồng ý chạy fastboot erase frp để verify, rồi flash FTD đúng mẫu máy."
        : "Tôi xác nhận ABL/parcel đã sẵn sàng, đồng ý chạy fastboot erase frp để verify, rồi flash FTD đúng mẫu máy.",
  "unlock-payload":
    "Tôi xác nhận máy đang ở Fastboot sau bước ABL/FTD; app sẽ nạp unlock payload rồi boot tạm vào Ennea kernel.",
  "restore-gpt": "Tôi xác nhận khôi phục GPT cuối, sau đó flash ROM gốc bằng MiFlash Clean All.",
});

const workflowModeCopy = {
  standard: {
    title: "Standard",
    detail: "ADB-first, boot Android permissive, ghi ABL qua MQSAS nếu model hỗ trợ, rồi chạy các bước unlock đúng batch.",
  },
  "edl-standard": {
    title: "EDL_Standard",
    detail: "Flow Fastboot sau khi ABL engineering đã nạp bằng tool/manual bên ngoài; app không nạp ABL qua browser.",
  },
};

const edlModeInfo =
  "EDL_Standard không nạp ABL qua browser; hãy nạp ABL engineering bằng tool/manual bên ngoài trước, rồi app chạy tiếp các bước Fastboot.";

const fixedWarnings = [
  "Sai mẫu máy hoặc sai gói có thể làm máy lỗi nặng.",
  "EFISP Gen 5 chỉ chạy khi security patch không mới hơn 2026-02-01.",
  "Cleanup EFISP chỉ được chạy sau khi Fastboot trả về unlocked: yes.",
  "Web không flash ROM gốc dung lượng lớn; bước cuối vẫn dùng MiFlash khi cần.",
  "Không chọn Clean All and Lock trong MiFlash.",
  "Không rút cáp khi đang flash phân vùng hoặc GPT.",
];

const productFlow = [
  {
    title: "01 Kiểm tra máy",
    text: "Đọc đúng model Xiaomi, Android/HyperOS và bản vá bảo mật trước khi làm bước tiếp theo.",
  },
  {
    title: "02 Xác nhận thiết bị",
    text: "So khớp Fastboot product và serial để tránh chọn nhầm máy hoặc nhầm dòng máy Xiaomi.",
  },
  {
    title: "03 Chuẩn bị tệp",
    text: "Tải dữ liệu cần thiết, kiểm tra SHA-256 và lưu cache trình duyệt trước khi mở khóa.",
  },
  {
    title: "04 Thanh toán",
    text: "Mã thanh toán chỉ áp dụng cho đúng máy đã xác minh, không dùng chung serial khác.",
  },
  {
    title: "05 Thực hiện mở khóa",
    text: "Chạy từng bước có cảnh báo rõ ràng, xác nhận rủi ro và theo dõi nhật ký thao tác.",
  },
];

const preparationItems = [
  "Dùng Chrome hoặc Edge để trình duyệt nhận được thiết bị qua USB.",
  "Sao lưu dữ liệu quan trọng trước khi bắt đầu.",
  "Không rút cáp khi hệ thống đang thao tác với máy.",
  "Nếu gặp lỗi lặp lại, hãy dừng lại và kiểm tra bằng phương án kỹ thuật phù hợp.",
];

const riskGuides = [
  "Mở khóa Xiaomi có thể làm mất dữ liệu nếu thao tác sai.",
  "Chỉ chạy khi đã kiểm tra máy Xiaomi và xác nhận đúng model.",
  "EDL WebUSB vẫn là tính năng thử nghiệm, không phải phương án cứu máy chính.",
];

const workflowLabel = (workflow: WorkflowState) =>
  workflow.model?.family === "efisp-8e-gen5" ? "EFISP 8E Gen 5" : workflowModeCopy[workflow.workflowMode].title;

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
    row: "border-amber-100/10 bg-amber-100/[0.025] text-stone-500",
    dot: "border-stone-700 text-stone-500",
    label: "Chờ",
    connector: "bg-amber-100/10",
  },
  running: {
    row: "border-amber-400/45 bg-amber-400/[0.12] text-amber-50",
    dot: "border-amber-400 bg-amber-400/20 text-amber-200",
    label: "Đang chạy",
    connector: "bg-amber-400/45",
  },
  done: {
    row: "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100",
    dot: "border-emerald-300 bg-emerald-300/18 text-emerald-200",
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
    row: "border-stone-500/20 bg-white/[0.015] text-stone-500",
    dot: "border-stone-700 text-stone-600",
    label: "Bỏ qua",
    connector: "bg-amber-100/10",
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
      ? "Thiết bị đã được nhận diện, phiên bản Android và Fastboot được ghi lại trong panel bên dưới."
      : workflow.awaitingFastbootVerification
        ? "Máy đã reboot từ Android sang Fastboot. Bấm Kết nối Fastboot và chọn lại thiết bị."
        : !workflow.manifest
          ? "Đang tải danh sách file trước khi mở hộp chọn thiết bị."
          : !workflow.preflight.isHttps || !workflow.preflight.hasWebUsb
            ? "Cần HTTPS/localhost và Chrome hoặc Edge có WebUSB."
            : "Bắt đầu từ Android/ADB, bật Gỡ lỗi USB và chọn “Luôn cho phép từ máy tính này” khi điện thoại hỏi.";
  const actionHint = workflow.busy
    ? "Đang chạy bước hiện tại."
    : workflow.awaitingFastbootVerification
      ? "Máy đang reboot sang Fastboot. Khi thấy màn Fastboot, bấm Kết nối Fastboot để xác minh mẫu máy."
      : workflow.nextPhase === "connect-device"
        ? "Kết nối ADB Android trước để app đọc codename và phiên bản. Nếu máy đang ở Fastboot, hãy reboot về Android rồi bắt đầu lại."
        : workflow.nextPhase === "flash-ftd"
          ? (workflow.model?.family === "legacy-ftd" && workflow.model.adbExploit
            ? "Thiết bị sẽ chạy ADB Exploit để lấy root và nạp engineering ABL, sau đó tự reboot vào Fastboot để tiếp tục flash FTD."
            : "Trước khi flash FTD, app sẽ chạy fastboot erase frp. Nếu fail thì ABL engineering/parcel chưa OK hoặc Fastboot chưa đúng trạng thái.")
          : workflow.nextPhase === "boot-permissive"
            ? "Kết nối Fastboot đúng máy, đặt tham số SELinux permissive rồi tiếp tục boot Android."
          : workflow.nextPhase === "write-abl"
            ? "Kết nối lại ADB Android permissive, app sẽ xác minh đúng codename rồi ghi ABL engineering vào abl_a/abl_b qua MQSAS."
          : workflow.nextPhase === "write-efisp"
            ? "Khi Android lên, kết nối lại ADB, chấp nhận RSA, rồi app đẩy EFI đã kiểm tra SHA-256 và ghi efisp qua MQSAS."
          : workflow.nextPhase === "verify-unlock"
            ? "Kết nối lại Fastboot để app đọc getvar unlocked. Cleanup vẫn bị khóa nếu kết quả không phải yes."
          : workflow.nextPhase === "cleanup-data"
            ? "App sẽ kiểm tra lại unlocked: yes ngay trước khi xóa efisp, metadata và userdata."
          : workflow.workflowMode !== "edl-standard" && !preflightReady
            ? "Tick đủ kiểm tra ban đầu để bật bước tiếp theo sau khi đã nhận diện máy."
          : workflow.requiresConfirmation && workflow.compatibilityReport?.verdict === "warning" && !workflow.compatibilityWarningsAccepted
            ? "Đọc cảnh báo phiên bản máy và tick xác nhận đã hiểu trước khi vào bước nguy hiểm."
            : workflow.requiresConfirmation && !workflow.canRun
              ? "Tick xác nhận của bước nguy hiểm để tiếp tục."
              : workflow.nextPhase === "finished"
                ? "Có thể tải nhật ký sau khi quy trình hoàn tất."
                : "Sẵn sàng chạy bước hiện tại.";

  return (
    <main className="min-h-dvh overflow-x-hidden text-stone-950">
      <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden">
        <TopBar workflow={workflow} progressPercent={progressPercent} completedSteps={completedSteps} totalSteps={visiblePhaseOrder.length} />

        <ProductHero workflow={workflow} completedSteps={completedSteps} totalSteps={visiblePhaseOrder.length} />

        <DonationPanel />

        <section
          id="workflow-console"
          className="grid flex-1 scroll-mt-20 gap-4 bg-[var(--workspace-bg)] px-4 pb-16 pt-10 text-stone-100 lg:px-8 xl:grid-cols-[300px_minmax(0,1fr)_400px] xl:items-start 2xl:grid-cols-[330px_minmax(440px,1fr)_420px]"
        >
          <div className="xl:col-span-3">
            <div className="mx-auto mb-3 flex max-w-[1540px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase text-amber-500">Khu vực thao tác</div>
                <h2 className="mt-2 text-4xl font-black leading-tight text-white sm:text-5xl">Theo dõi toàn bộ quá trình mở khóa</h2>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-stone-400">
                  Khu vực này dành cho kỹ thuật viên khi trực tiếp thao tác với máy. Các nút chính, điều kiện an toàn, trạng thái thanh toán và nhật ký đều nằm trong một màn hình để dễ kiểm soát.
                </p>
              </div>
              <div className="grid gap-2 text-xs font-black sm:grid-cols-3">
                <TopPill icon={<Cpu className="h-3.5 w-3.5" />} label="Máy" value={workflow.model?.name ?? "Chưa chọn"} tone={workflow.model ? "good" : "muted"} />
                <TopPill icon={<PlugZap className="h-3.5 w-3.5" />} label="Kết nối" value={deviceStatusCopy[workflow.deviceStatus].label} tone={deviceStatusCopy[workflow.deviceStatus].tone} />
                <TopPill icon={<LockKeyhole className="h-3.5 w-3.5" />} label="Thanh toán" value={workflow.paymentReady ? "Pass sẵn sàng" : "Chưa hoàn tất"} tone={workflow.paymentReady ? "good" : "warn"} />
              </div>
            </div>
          </div>
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
    <header className="sticky top-0 z-30 overflow-x-hidden border-b border-amber-950/10 bg-[var(--public-bg)]/94 px-4 py-2.5 shadow-sm backdrop-blur-md lg:px-8">
      <div className="mx-auto flex min-w-0 max-w-[1540px] flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-4">
        <a href="#tong-quan" className="flex min-w-0 items-center gap-2.5">
          <img src={mascotLogo} alt="Unlock Xiaomi mascot logo" className="h-9 w-9 shrink-0 rounded-md object-contain" />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-2 text-sm font-extrabold text-stone-950">
              Unlock Xiaomi
              {workflow.mockMode && (
                <span className="rounded-sm bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-800">MOCK</span>
              )}
            </div>
            <div className="truncate text-[11px] font-semibold text-stone-600">Mở khóa Xiaomi qua trình duyệt</div>
          </div>
        </a>

        <nav aria-label="Điều hướng chính" className="flex w-full min-w-0 max-w-full justify-between gap-1 overflow-x-auto md:w-auto md:max-w-[430px] md:justify-start">
          <TopNavLink href="#tong-quan">Tổng quan</TopNavLink>
          <TopNavLink href="#quy-trinh">Quy trình</TopNavLink>
          <TopNavLink href="#ung-ho">Ủng hộ</TopNavLink>
          <TopNavLink href="#ho-tro">Thiết bị</TopNavLink>
          <TopNavLink href="#workflow-console">Workspace</TopNavLink>
        </nav>

        <div className="hidden w-full min-w-0 flex-wrap items-center gap-1.5 md:flex md:w-auto md:flex-1">
          <TopPill icon={<Cpu className="h-3.5 w-3.5" />} label={workflow.model?.name ?? "Chưa chọn máy"} value={product || undefined} tone={workflow.model ? "good" : "muted"} />
          <TopPill icon={<Database className="h-3.5 w-3.5" />} label="Bước" value={`${completedSteps}/${totalSteps}`} tone="neutral" />
          <TopPill icon={<HardDrive className="h-3.5 w-3.5" />} label="Dữ liệu" value={progressPercent === undefined ? "—" : `${progressPercent}%`} tone="info" />
          <TopPill icon={<PlugZap className="h-3.5 w-3.5" />} label={workflowLabel(workflow)} tone="neutral" mono />
        </div>

        <div className="flex items-center justify-between gap-2 md:justify-end">
          <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-xs font-bold ${toneClass(status.tone)}`}>
            <span className={`h-2 w-2 rounded-full ${status.tone === "good" ? "bg-emerald-500" : status.tone === "info" ? "bg-amber-500" : status.tone === "warn" ? "bg-amber-500" : "bg-stone-400"} ${workflow.deviceStatus !== "disconnected" ? "animate-pulse" : ""}`} />
            {status.label}
          </span>
          <button
            type="button"
            disabled={!workflow.canDisconnect}
            onClick={workflow.resetSession}
            title="Ngắt kết nối / đặt lại phiên"
            aria-label="Ngắt kết nối / đặt lại phiên"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-sm border border-amber-950/15 bg-white px-2.5 text-xs font-bold text-stone-800 transition hover:border-amber-500 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-stone-400"
          >
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Đặt lại</span>
          </button>
        </div>
      </div>
    </header>
  );
};

const TopNavLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    className="inline-flex h-8 shrink-0 items-center justify-center rounded-sm px-1.5 text-xs font-bold text-stone-600 transition hover:bg-amber-100 hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 sm:px-2.5"
  >
    {children}
  </a>
);

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
  <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${toneClass(tone)}`}>
    <span className="shrink-0 opacity-80">{icon}</span>
    <span className="min-w-0 truncate font-medium">{label}</span>
    {value && <span className={`min-w-0 truncate text-current/70 ${mono ? "font-mono" : "font-semibold"}`}>{value}</span>}
  </span>
);

const ProductHero = ({
  workflow,
  completedSteps,
  totalSteps,
}: {
  workflow: WorkflowState;
  completedSteps: number;
  totalSteps: number;
}) => {
  const supportedModels = workflow.manifest?.models ?? [];
  const legacyCount = supportedModels.filter((model) => model.family === "legacy-ftd").length;
  const efispCount = supportedModels.filter((model) => model.family === "efisp-8e-gen5").length;
  const workflowProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const browserReady = workflow.preflight.isHttps && workflow.preflight.hasWebUsb;
  const currentModel = workflow.model?.name ?? "Chưa khóa mẫu";
  const currentProduct = workflow.targetDetection?.fastbootProduct ?? workflow.targetDetection?.adbProduct ?? workflow.detectedProduct;

  return (
    <>
      <section id="tong-quan" className="product-hero-panel relative w-full scroll-mt-20 overflow-hidden border-b border-amber-950/10 bg-[var(--public-bg)] px-4 py-10 lg:px-8 xl:py-14">
        <div className="relative z-10 mx-auto grid max-w-[1540px] gap-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center xl:grid-cols-[minmax(0,1fr)_640px]">
          <div className="min-w-0">
            <div className="grid max-w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap sm:items-center">
              <span className="rounded-sm border border-amber-400/45 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                Dịch vụ mở khóa Xiaomi
              </span>
              <span className="rounded-sm border border-amber-950/15 bg-white px-2 py-1 text-xs font-bold text-stone-700">
                Chi phí rõ ràng
              </span>
              <span className={`rounded-sm border px-2 py-1 text-xs font-bold ${browserReady ? toneClass("good") : toneClass("bad")}`}>
                {browserReady ? "Trình duyệt sẵn sàng" : "Cần Chrome/Edge WebUSB"}
              </span>
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-black leading-[1.04] tracking-normal text-stone-950 sm:text-6xl lg:text-7xl">
              Mở khóa Xiaomi <span className="block w-fit bg-amber-500 px-2 text-stone-950 sm:inline-block">dễ hiểu</span>
              <span className="block">ngay trên trình duyệt</span>
            </h1>
            <p className="mt-5 max-w-3xl break-words text-base leading-7 text-stone-700 sm:text-lg">
              Unlock Xiaomi giúp kỹ thuật viên và cửa hàng kiểm tra máy Xiaomi, chuẩn bị dữ liệu cần thiết và thực hiện quy trình mở khóa theo từng bước rõ ràng. Giao diện được thiết kế để hạn chế chọn nhầm máy, nhầm tệp và bỏ sót cảnh báo quan trọng.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => document.getElementById("workflow-console")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-sm border border-amber-600 bg-amber-500 px-4 py-2.5 text-sm font-black text-stone-950 transition hover:bg-amber-400"
              >
                <PlugZap className="h-4 w-4" />
                <span className="truncate">Kiểm tra máy ngay</span>
              </button>
              <a
                href="#quy-trinh"
                className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-sm border border-amber-950/20 bg-white px-4 py-2.5 text-sm font-black text-stone-900 transition hover:border-amber-500 hover:bg-amber-50"
              >
                <Info className="h-4 w-4" />
                <span className="truncate">Xem quy trình an toàn</span>
              </a>
              <a
                href="#ung-ho"
                className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-sm border border-amber-950/20 bg-white px-4 py-2.5 text-sm font-black text-stone-900 transition hover:border-amber-500 hover:bg-amber-50"
              >
                <HeartHandshake className="h-4 w-4" />
                <span className="truncate">Ủng hộ dự án</span>
              </a>
              <button
                type="button"
                onClick={() => document.getElementById("terminal-log")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-sm border border-amber-950/20 bg-white px-4 py-2.5 text-sm font-black text-stone-900 transition hover:border-amber-500 hover:bg-amber-50"
              >
                <Terminal className="h-4 w-4" />
                <span className="truncate">Mở nhật ký</span>
              </button>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <ProductMetric label="Kiểm tra máy" value={currentProduct ? `${currentModel} · ${currentProduct}` : "Đúng đời máy"} tone={workflow.model ? "good" : "muted"} />
              <ProductMetric label="Dữ liệu" value={workflow.paymentReady ? "Đã xác minh" : "Đã xác minh"} tone="info" />
              <ProductMetric label="Thanh toán" value={workflow.paymentReady ? "Theo từng máy" : "Theo từng máy"} tone="neutral" />
            </div>
          </div>

          <div className="relative min-w-0 overflow-hidden border border-stone-950/35 bg-white p-5 shadow-[12px_14px_0_rgba(245,158,11,0.16)]">
            <div className="flex items-center justify-between gap-3 border-b border-stone-950/15 pb-3">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase text-stone-950">Quy trình mở khóa an toàn</div>
                <div className="mt-0.5 truncate text-xs font-bold text-stone-500">{workflowLabel(workflow)}</div>
              </div>
              <span className="rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase text-amber-800">
                Chờ thanh toán
              </span>
            </div>
            <div className="grid gap-4 py-5 sm:grid-cols-2">
              {productFlow.slice(0, 4).map((item, index) => (
                <div
                  key={item.title}
                  className={`min-h-24 border p-4 ${
                    index === 0 || index === 2
                      ? "border-amber-400/65 bg-amber-50"
                      : index === 3
                        ? "border-emerald-400/45 bg-emerald-50"
                        : "border-sky-400/35 bg-sky-50"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h2 className="text-sm font-black text-stone-950">{item.title.replace(/^\d+\s/, "")}</h2>
                    <Circle className={`h-2.5 w-2.5 shrink-0 fill-current ${index === 1 ? "text-sky-600" : index === 3 ? "text-emerald-600" : "text-amber-600"}`} />
                  </div>
                  <p className="text-xs font-semibold leading-5 text-stone-600">{item.text}</p>
                </div>
              ))}
              <div className="min-h-24 border border-rose-300 bg-rose-50 p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="text-sm font-black text-stone-950">Bước rủi ro</h2>
                  <Circle className="h-2.5 w-2.5 shrink-0 fill-current text-rose-600" />
                </div>
                <p className="text-xs font-semibold leading-5 text-stone-600">Cần xác nhận rõ trước khi thao tác có thể mất dữ liệu.</p>
              </div>
              <div className="min-h-24 border border-stone-300 bg-stone-50 p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="text-sm font-black text-stone-950">Nhật ký thao tác</h2>
                  <Circle className="h-2.5 w-2.5 shrink-0 fill-current text-stone-900" />
                </div>
                <p className="text-xs font-semibold leading-5 text-stone-600">Theo dõi ADB/Fastboot và trạng thái thanh toán.</p>
              </div>
            </div>
            <p className="border-t border-stone-950/15 pt-3 text-xs font-semibold leading-5 text-stone-600">
              Ủng hộ dự án không mở khóa máy - chỉ chạy bước xóa dữ liệu sau khi đã xác nhận thành công.
            </p>
          </div>
        </div>
      </section>

      <section id="quy-trinh" className="w-full scroll-mt-20 overflow-hidden border-b border-amber-950/10 bg-white px-4 py-12 lg:px-8">
        <div className="mx-auto max-w-[1540px]">
          <div className="mb-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <div className="text-xs font-black uppercase text-amber-700">Quy trình dành cho cửa hàng và kỹ thuật viên</div>
              <h2 className="mt-2 max-w-3xl text-4xl font-black leading-tight text-stone-950 sm:text-5xl">Mở khóa Xiaomi theo từng bước rõ ràng</h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
                Người dùng chỉ cần làm theo các bước trên màn hình: kiểm tra máy, xác nhận đúng thiết bị, chuẩn bị tệp cần thiết, hoàn tất thanh toán và đọc kỹ cảnh báo trước thao tác có thể mất dữ liệu.
              </p>
            </div>
            <div className="border border-stone-950/30 bg-amber-50 p-4 text-xs font-bold text-stone-700">
              <InfoGrid
                rows={[
                  ["Trình duyệt", "Chrome / Edge"],
                  ["Thanh toán", "Theo từng máy"],
                  ["Chế độ nâng cao", workflow.showAdvancedEdl ? "Đang bật" : "Chỉ dùng khi cần"],
                ]}
              />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="min-w-0">
            <div className="grid gap-3 md:grid-cols-5">
              {productFlow.map((item) => (
                <FlowStep key={item.title} title={item.title} text={item.text} />
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <GuideList icon={<Check className="h-4 w-4" />} title="Lưu ý trước khi mở khóa Xiaomi" items={preparationItems} tone="info" />
            <GuideList icon={<ShieldAlert className="h-4 w-4" />} title="Rủi ro cần chốt" items={riskGuides} tone="warn" />
          </div>
          </div>
        </div>
      </section>

      <section id="ho-tro" className="w-full scroll-mt-20 overflow-hidden border-b border-amber-950/10 bg-[var(--public-bg)] px-4 py-8 lg:px-8">
        <div className="mx-auto grid max-w-[1540px] gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-start">
          <div className="min-w-0">
            <div className="border border-stone-950/35 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-stone-950">Các dòng máy Xiaomi được hỗ trợ</h2>
              <span className="text-xs font-semibold text-stone-500">Cập nhật theo gói dữ liệu hiện có</span>
            </div>
            <p className="text-sm leading-6 text-stone-600">
              {workflow.manifest ? `${legacyCount} legacy FTD · ${efispCount} EFISP Gen 5` : "Đang tải manifest"}
              <span className="text-stone-400"> · </span>
              dữ liệu được tải từ R2 release 20260617-001.
            </p>

            <div className="mt-4 grid gap-2">
              <SupportedRow label="Dòng mới" models={supportedModels.filter((model) => model.family === "efisp-8e-gen5").slice(0, 5).map((model) => model.name)} fallback="Xiaomi 17 Ultra, Redmi K90 Pro Max" />
              <SupportedRow label="Phổ biến" models={supportedModels.filter((model) => model.family === "legacy-ftd").slice(0, 4).map((model) => model.name)} fallback="Xiaomi 15 Ultra, Redmi K70 Pro, Pad 7 Pro" />
              <SupportedRow label="Nâng cao" models={supportedModels.slice(4, 8).map((model) => model.name)} fallback="Một số máy cần kiểm tra thêm trước khi chạy" />
            </div>
            </div>
          </div>

          <div className="border border-amber-500 bg-amber-50 p-5">
            <h2 className="text-xl font-black text-stone-950">Lưu ý trước khi mở khóa Xiaomi</h2>
            <ul className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-stone-700">
              {preparationItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <Circle className="mt-2 h-2 w-2 shrink-0 fill-amber-500 text-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-amber-400/40 pt-3 font-mono text-xs text-stone-600">
              HTTPS {workflow.preflight.isHttps ? "OK" : "FAIL"} · WebUSB {workflow.preflight.hasWebUsb ? "OK" : "FAIL"} · Tiến trình {workflowProgress}%
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

const DonationPanel = () => {
  const [amountInput, setAmountInput] = useState("50000");
  const [donation, setDonation] = useState<Donation | undefined>();
  const [qrDataUrl, setQrDataUrl] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [qrError, setQrError] = useState<string | undefined>();

  const amount = Number(amountInput || 0);
  const amountValid = Number.isInteger(amount) && amount >= donationMinVnd && amount <= donationMaxVnd;
  const canCreate = amountValid && !creating;
  const pending = donation?.status === "pending";
  const paid = donation?.status === "paid";
  const finalFailure = donation?.status === "expired" || donation?.status === "failed" || donation?.status === "cancelled";

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(undefined);
    setQrError(undefined);

    if (!donation?.qrCode) {
      return () => {
        cancelled = true;
      };
    }

    QRCode.toString(donation.qrCode, {
      type: "svg",
      margin: 1,
      width: 256,
      color: {
        dark: "#020617",
        light: "#ffffff",
      },
    })
      .then((svg) => {
        if (!cancelled) {
          setQrDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrError("Không render được QR trong trình duyệt. Hãy dùng link checkout dự phòng.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [donation?.qrCode]);

  useEffect(() => {
    if (!donation?.id || donation.status !== "pending") {
      return;
    }

    let stopped = false;
    const poll = async () => {
      setPolling(true);
      try {
        const result = await getDonation(donation.id);
        if (!stopped) {
          setDonation(result.donation);
        }
      } catch (caught) {
        if (!stopped) {
          setError(caught instanceof Error ? caught.message : "Không kiểm tra được trạng thái ủng hộ.");
        }
      } finally {
        if (!stopped) {
          setPolling(false);
        }
      }
    };

    const timer = window.setInterval(poll, donationPollMs);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [donation?.id, donation?.status]);

  const onAmountChange = (value: string) => {
    setAmountInput(value.replace(/\D/g, "").slice(0, 7));
    setError(undefined);
  };

  const onCreateDonation = async () => {
    if (!amountValid) {
      setError(`Số tiền phải từ ${formatVnd(donationMinVnd)} đến ${formatVnd(donationMaxVnd)}.`);
      return;
    }

    setCreating(true);
    setError(undefined);
    try {
      const result = await createDonation(amount);
      setDonation(result.donation);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được mã QR ủng hộ.");
    } finally {
      setCreating(false);
    }
  };

  const resetDonation = () => {
    setDonation(undefined);
    setQrDataUrl(undefined);
    setQrError(undefined);
    setError(undefined);
  };

  return (
    <section id="ung-ho" className="w-full scroll-mt-20 overflow-hidden border-b border-amber-950/10 bg-[var(--public-bg)] px-4 py-12 lg:px-8">
      <div className="mx-auto grid max-w-[1540px] gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.7fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-amber-400/45 bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">
              Ủng hộ dự án
            </span>
            <span className="rounded-sm border border-stone-950/15 bg-white px-2 py-1 text-xs font-black text-stone-700">
              Không phải phí mở khóa
            </span>
          </div>

          <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight text-stone-950 sm:text-5xl">Ủng hộ Unlock Xiaomi để duy trì dịch vụ</h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            Bạn có thể ủng hộ dự án bằng mã QR payOS ngay trên website. Khoản ủng hộ chỉ dùng để duy trì server, lưu trữ dữ liệu và thời gian kiểm thử, không tạo quyền mở khóa máy, không cấp unlock pass và không mở asset key.
          </p>

          <div className="mt-6 grid gap-3 border border-stone-950/35 bg-white p-5">
            <div>
              <label htmlFor="donation-amount" className="text-sm font-black text-stone-950">
                Nhập số tiền muốn ủng hộ
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative min-w-0">
                  <input
                    id="donation-amount"
                    inputMode="numeric"
                    value={amountInput}
                    onChange={(event) => onAmountChange(event.target.value)}
                    className="min-h-12 w-full border border-stone-950/20 bg-amber-50 px-3 pr-14 font-mono text-base font-black text-stone-950 placeholder:text-stone-400"
                    placeholder="50000"
                    aria-invalid={!amountValid}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-stone-500">VND</span>
                </div>
                <button
                  type="button"
                  disabled={!canCreate}
                  onClick={onCreateDonation}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border border-amber-600 bg-amber-500 px-4 py-2.5 text-sm font-black text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-500"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
                  Tạo QR ủng hộ
                </button>
              </div>
              <p className={`mt-2 text-xs font-semibold ${amountValid ? "text-stone-500" : "text-amber-700"}`}>
                Nhập số nguyên từ {formatVnd(donationMinVnd)} đến {formatVnd(donationMaxVnd)}. Mã QR hết hạn sau khoảng 10 phút.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {donationSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onAmountChange(String(suggestion))}
                  className={`rounded-sm border px-3 py-2 text-sm font-black transition ${
                    amount === suggestion ? "border-amber-500 bg-amber-100 text-stone-950" : "border-stone-950/15 bg-white text-stone-600 hover:border-amber-500"
                  }`}
                >
                  {formatVnd(suggestion)}
                </button>
              ))}
            </div>

            {error && <ErrorBox message={error} />}
          </div>
        </div>

        <div className={`border p-5 ${paid ? "border-emerald-500 bg-emerald-50" : finalFailure ? "border-amber-500 bg-amber-50" : "border-stone-950/35 bg-white"}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-xl font-black text-stone-950">
              Mã QR ủng hộ
            </div>
            <span className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] font-black uppercase ${donationStatusClass(donation?.status)}`}>
              {donationStatusLabel(donation?.status)}
            </span>
          </div>

          {!donation ? (
            <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-stone-950/20 bg-amber-50 p-5 text-center">
              <HeartHandshake className="h-9 w-9 text-amber-600" />
              <p className="mt-3 text-sm font-black text-stone-800">Chưa tạo mã QR</p>
              <p className="mt-1 max-w-xs text-xs font-semibold leading-5 text-stone-500">Chọn số tiền rồi bấm “Tạo QR ủng hộ”. QR sẽ hiển thị ngay trên website.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {paid ? (
                <div className="rounded-md border border-emerald-300/25 bg-emerald-300/[0.08] p-4 text-center">
                  <Check className="mx-auto h-8 w-8 text-emerald-200" />
                  <div className="mt-2 text-base font-semibold text-emerald-50">Đã nhận ủng hộ. Cảm ơn anh.</div>
                  <p className="mt-1 text-xs leading-5 text-emerald-100/75">Donation đã được ghi nhận độc lập, không cấp unlock pass.</p>
                </div>
              ) : qrDataUrl && !finalFailure ? (
                <div className="border border-stone-950/15 bg-white p-3">
                  <img src={qrDataUrl} alt={`QR ủng hộ ${formatVnd(donation.amount)}`} className="mx-auto h-64 w-64 max-w-full" />
                </div>
              ) : finalFailure ? (
                <div className="rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-4 text-center">
                  <XCircle className="mx-auto h-8 w-8 text-amber-200" />
                  <div className="mt-2 text-base font-semibold text-amber-50">Mã QR không còn thanh toán được</div>
                  <p className="mt-1 text-xs leading-5 text-amber-100/75">Hãy tạo mã mới nếu anh vẫn muốn ủng hộ.</p>
                </div>
              ) : (
                <div className="flex min-h-64 items-center justify-center rounded-md border border-white/8 bg-white/[0.02]">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-200" />
                </div>
              )}

              {qrError && <InlineNotice tone="muted" title="QR fallback" text={qrError} />}

              <InfoGrid
                rows={[
                  ["Số tiền", `${formatVnd(donation.amount)} ${donation.currency}`],
                  ["Mã đơn", String(donation.orderCode)],
                  ["Trạng thái", donationStatusLabel(donation.status)],
                  ["Hết hạn", formatDateTime(donation.expiresAt)],
                ]}
              />

              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href={donation.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm border border-stone-950/20 bg-white px-4 py-2.5 text-sm font-black text-stone-900 transition hover:border-amber-500 hover:bg-amber-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Mở checkout dự phòng
                </a>
                <button
                  type="button"
                  onClick={resetDonation}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm border border-stone-950/20 bg-white px-4 py-2.5 text-sm font-black text-stone-900 transition hover:border-amber-500 hover:bg-amber-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Tạo mã mới
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                {pending && polling ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" /> : <Circle className="h-2 w-2 fill-stone-500 text-stone-500" />}
                {pending ? "Đang tự kiểm tra trạng thái thanh toán..." : "Website tự kiểm tra trạng thái thanh toán. Ủng hộ không cấp quyền mở khóa."}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const ProductMetric = ({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: string;
  tone: ToneTag;
  compact?: boolean;
}) => (
  <div className={`min-w-0 border ${compact ? "px-3 py-2" : "px-3 py-2.5"} ${publicToneClass(tone)}`}>
    <div className="text-[11px] font-black text-current/70">{label}</div>
    <div className="mt-1 min-w-0 break-words text-xs font-black text-current">{value}</div>
  </div>
);

const publicToneClass = (tone: ToneTag) =>
  ({
    good: "border-emerald-500/35 bg-emerald-50 text-stone-900",
    bad: "border-rose-500/35 bg-rose-50 text-stone-900",
    muted: "border-stone-950/15 bg-white text-stone-700",
    neutral: "border-stone-950/20 bg-white text-stone-900",
    info: "border-amber-500/45 bg-amber-50 text-stone-900",
    warn: "border-amber-500/45 bg-amber-50 text-stone-900",
  })[tone];

const FlowStep = ({ title, text }: { title: string; text: string }) => (
  <div className="min-w-0 border border-stone-950/25 bg-amber-50 p-4">
    <div className="mb-5 text-xs font-black text-amber-700">{title.slice(0, 2)}</div>
    <div className="text-base font-black text-stone-950">{title.replace(/^\d+\s/, "")}</div>
    <p className="mt-1 break-words text-sm font-semibold leading-6 text-stone-600">{text}</p>
  </div>
);

const SupportedRow = ({ label, models, fallback }: { label: string; models: string[]; fallback: string }) => (
  <div className="grid gap-2 border border-stone-950/10 bg-amber-50 px-3 py-2 text-sm sm:grid-cols-[110px_1fr]">
    <span className="font-black text-stone-950">{label}</span>
    <span className="font-semibold text-stone-600">{models.length > 0 ? models.join(", ") : fallback}</span>
  </div>
);

const GuideList = ({
  icon,
  title,
  items,
  tone,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
  tone: ToneTag;
}) => (
  <div className={`border p-4 ${tone === "warn" ? "border-amber-500 bg-amber-50 text-stone-800" : "border-stone-950/20 bg-white text-stone-800"}`}>
    <div className="flex items-center gap-2 text-sm font-black text-current">
      {icon}
      {title}
    </div>
    <ul className="mt-3 grid gap-2 text-xs font-semibold leading-5 text-current/80">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
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
      const provenance = workflow.phaseProvenance[phase];
      const active = workflow.nextPhase === phase;
      const styles = statusStyles[status];
      const isLast = index === workflow.visiblePhaseOrder.length - 1;
      const provenanceLabel =
        provenance === "manually_assumed" ? "manually assumed" : provenance === "bypassed" ? "bypassed" : undefined;

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
              <div className="truncate font-mono text-[10px] text-current/45">
                {phase}
                {provenanceLabel ? ` / ${provenanceLabel}` : ""}
              </div>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wide text-current/55">
              {provenanceLabel ?? styles.label}
            </span>
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
      <div className="text-sm font-semibold text-white">Quy trình thiết bị</div>
      <span className="hidden rounded-sm border border-white/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-400 sm:inline">
        {workflowLabel(workflow)}
      </span>
    </div>
    {workflow.model?.family === "efisp-8e-gen5" ? (
      <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <LockKeyhole className="h-4 w-4" />
          EFISP 8E Gen 5
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          ADB-first, hard gate security patch ≤ 2026-02-01, ghi EFI qua MQSAS và chỉ cleanup sau unlocked: yes.
        </p>
      </div>
    ) : workflow.showAdvancedEdl ? (
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
                  ? "bg-amber-500 text-stone-950 shadow-[0_8px_24px_rgba(245,158,11,0.22)]"
                  : "text-stone-400 hover:bg-amber-100/10 hover:text-stone-100"
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
    ) : (
      <div className="rounded-md border border-amber-400/20 bg-amber-400/[0.07] p-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <PlugZap className="h-4 w-4" />
          Standard
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Bắt đầu bằng Android/ADB, kiểm tra phiên bản, xác minh Fastboot rồi chạy đúng flow batch của model.
        </p>
      </div>
    )}
  </div>
);

const AssetPreloadPanel = ({ workflow }: { workflow: WorkflowState }) => {
  const status = workflow.statuses["prepare-assets"];
  const done = status === "done";
  const running = status === "running";
  const isEfisp = workflow.model?.family === "efisp-8e-gen5";
  const assetName = isEfisp ? "EFI unlock" : "tệp unlock/ROM";
  const title = done ? `${assetName} đã chuẩn bị` : running ? `Đang chuẩn bị ${assetName}` : `Chuẩn bị ${assetName} trước`;
  const detail = done
    ? "Tệp đã được tải, kiểm tra SHA-256 và lưu trong bộ nhớ đệm."
    : running
      ? "Đang tải và kiểm tra asset; bước Chuẩn bị tệp sẽ tự hoàn tất khi xong."
      : workflow.model
        ? "Có thể tải và kiểm tra đúng asset ngay sau khi đã khóa mẫu máy."
        : "Khóa và xác minh mẫu máy trước để biết đúng asset cần tải.";

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
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.025] disabled:text-slate-500"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
          {done ? "Đã chuẩn bị" : running ? "Đang tải" : "Chuẩn bị"}
        </button>
      </div>
    </div>
  );
};

const remainingMsFromSession = (session: DeveloperOverrideSession | undefined, nowMs: number) => {
  if (!session) {
    return 0;
  }

  const expiresAtMs = Date.parse(session.expiresAt);
  if (Number.isFinite(expiresAtMs)) {
    return Math.max(0, expiresAtMs - nowMs);
  }

  return Math.max(0, session.remainingMs);
};

const formatOverrideRemaining = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ":" + String(seconds).padStart(2, "0");
};

type SelectableOverridePhase = Exclude<PhaseId, "finished">;
const isSelectableOverridePhase = (phase: PhaseId): phase is SelectableOverridePhase => phase !== "finished";

const gatesForMode = (mode: ActiveDeveloperOverrideMode, selectedGates: readonly OverrideGateId[]) =>
  mode === "full_override" ? overrideGateIds : mode === "selective_bypass" ? selectedGates : [];

const DeveloperOverridePanel = ({ workflow }: { workflow: WorkflowState }) => {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<DeveloperOverrideSession>();
  const [loginKey, setLoginKey] = useState("");
  const [mode, setMode] = useState<ActiveDeveloperOverrideMode>("resume");
  const [selectedGates, setSelectedGates] = useState<OverrideGateId[]>([]);
  const [selectedWorkflowMode, setSelectedWorkflowMode] = useState<WorkflowMode>("standard");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<PhaseId>("prepare-assets");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const statusRequestIdRef = useRef(0);

  const remainingMs = remainingMsFromSession(session, nowMs);
  const sessionActive = Boolean(session && remainingMs > 0);
  const effectiveBypassedGates = gatesForMode(mode, selectedGates);
  const clearDeveloperOverride = workflow.clearDeveloperOverride;
  const availableModels = workflow.manifest?.models ?? [];
  const selectedModel = availableModels.find((entry) => entry.id === selectedModelId) ?? availableModels[0];
  const effectiveWorkflowMode = selectedModel?.family === "efisp-8e-gen5" ? "standard" : selectedWorkflowMode;
  const selectableWorkflowModes: WorkflowMode[] = workflow.showAdvancedEdl ? ["standard", "edl-standard"] : ["standard"];
  const selectablePhaseOrder = selectedModel
    ? workflowPhaseOrder(selectedModel, effectiveWorkflowMode).filter(isSelectableOverridePhase)
    : workflow.visiblePhaseOrder.filter(isSelectableOverridePhase);
  const selectedPhaseIsSelectable = isSelectableOverridePhase(selectedPhase) && selectablePhaseOrder.includes(selectedPhase);
  const canApplyOverride = sessionActive && Boolean(selectedModel && selectedPhaseIsSelectable);

  useEffect(() => {
    if (!open) {
      return;
    }

    setNowMs(Date.now());
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const refreshStatus = async () => {
      const requestId = statusRequestIdRef.current + 1;
      statusRequestIdRef.current = requestId;
      setChecking(true);
      try {
        const result = await getDeveloperOverrideStatus();
        if (!cancelled && requestId === statusRequestIdRef.current) {
          const activeSession = result.session.remainingMs > 0 ? result.session : undefined;
          setSession(activeSession);
          if (!activeSession) {
            clearDeveloperOverride();
          }
        }
      } catch {
        if (!cancelled && requestId === statusRequestIdRef.current) {
          setSession(undefined);
          clearDeveloperOverride();
        }
      } finally {
        if (!cancelled && requestId === statusRequestIdRef.current) {
          setChecking(false);
        }
      }
    };

    void refreshStatus();
    const interval = window.setInterval(refreshStatus, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [clearDeveloperOverride, open]);

  useEffect(() => {
    if (session && remainingMs <= 0) {
      setSession(undefined);
      setSelectedGates([]);
      clearDeveloperOverride();
      setNotice("Phiên override đã hết hạn.");
    }
  }, [clearDeveloperOverride, remainingMs, session]);

  useEffect(() => {
    if (!sessionActive || availableModels.length === 0) {
      return;
    }

    if (!selectedModelId || !availableModels.some((entry) => entry.id === selectedModelId)) {
      setSelectedModelId(workflow.model?.id ?? availableModels[0].id);
    }
  }, [availableModels, selectedModelId, sessionActive, workflow.model?.id]);

  useEffect(() => {
    if (selectedModel?.family === "efisp-8e-gen5" && selectedWorkflowMode !== "standard") {
      setSelectedWorkflowMode("standard");
    }
  }, [selectedModel?.family, selectedWorkflowMode]);

  useEffect(() => {
    if (selectablePhaseOrder.length > 0 && !selectedPhaseIsSelectable) {
      setSelectedPhase(selectablePhaseOrder[0]);
    }
  }, [selectablePhaseOrder, selectedPhaseIsSelectable]);

  const auditPanelEvent = (event: Parameters<typeof auditDeveloperOverride>[0]) => {
    if (!sessionActive) {
      return;
    }

    void auditDeveloperOverride(event).catch(() => {
      setNotice("Không ghi được audit override.");
    });
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loginKey.trim()) {
      return;
    }

    statusRequestIdRef.current += 1;
    setBusy(true);
    setChecking(false);
    setNotice("");
    try {
      const result = await loginDeveloperOverride(loginKey);
      setSession(result.session);
      setLoginKey("");
      setMode("resume");
      setSelectedGates([]);
      setSelectedWorkflowMode(workflow.workflowMode);
      setSelectedModelId(workflow.model?.id ?? availableModels[0]?.id ?? "");
      setSelectedPhase(workflow.nextPhase === "finished" ? "prepare-assets" : workflow.nextPhase);
      setNotice("Phiên override đã mở.");
    } catch (error) {
      setSession(undefined);
      setLoginKey("");
      setSelectedGates([]);
      setNotice(error instanceof Error ? error.message : "Không mở được phiên override.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    statusRequestIdRef.current += 1;
    setBusy(true);
    setChecking(false);
    setNotice("");
    try {
      await logoutDeveloperOverride();
      setNotice("Đã khóa Developer Override V2.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không logout được phiên override.");
    } finally {
      setSession(undefined);
      setLoginKey("");
      setSelectedGates([]);
      clearDeveloperOverride();
      setBusy(false);
    }
  };

  const handleModeChange = (nextMode: ActiveDeveloperOverrideMode) => {
    const nextGates = gatesForMode(nextMode, selectedGates);
    setMode(nextMode);
    auditPanelEvent({
      eventType: "mode_change",
      mode: nextMode,
      workflowMode: workflow.workflowMode,
      bypassedGates: nextGates,
      commandType: "session",
      result: "ok",
    });
  };

  const handleGateToggle = (gate: OverrideGateId, checked: boolean) => {
    if (mode !== "selective_bypass") {
      return;
    }

    const nextGates = checked ? [...selectedGates, gate] : selectedGates.filter((entry) => entry !== gate);
    setSelectedGates(nextGates);
    auditPanelEvent({
      eventType: "gate_policy",
      mode,
      workflowMode: workflow.workflowMode,
      bypassedGates: nextGates,
      commandType: "session",
      result: "ok",
    });
  };

  const handleApplyOverride = () => {
    if (!sessionActive) {
      return;
    }

    if (!selectedModel || !selectedPhaseIsSelectable) {
      setNotice("No model available for override resume.");
      return;
    }

    const applied = workflow.applyDeveloperOverrideSession({
      mode,
      workflowMode: effectiveWorkflowMode,
      modelId: selectedModel.id,
      phase: selectedPhase,
      bypassedGates: effectiveBypassedGates,
    });

    if (!applied) {
      setNotice("Override selection was not applied.");
      return;
    }

    auditPanelEvent({
      eventType: "phase_select",
      mode,
      workflowMode: effectiveWorkflowMode,
      modelId: selectedModel.id,
      phase: selectedPhase,
      bypassedGates: effectiveBypassedGates,
      commandType: "session",
      result: effectiveBypassedGates.length > 0 ? "bypassed" : "ok",
    });
    setNotice(`${developerOverrideModeLabels[mode]} applied to ${selectedModel.name} / ${phaseLabels[selectedPhase]}.`);
  };

  return (
    <div className="rounded-md border border-amber-300/15 bg-amber-300/[0.04]">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <Wrench className="h-4 w-4" />
          Developer Override V2
        </span>
        <span className="ml-auto rounded-sm border border-white/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-slate-400">
          {sessionActive ? developerOverrideModeLabels[mode] : "Locked"}
        </span>
        <ChevronDown className={open ? "h-4 w-4 rotate-180 text-amber-100/70 transition" : "h-4 w-4 text-amber-100/70 transition"} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-amber-200/10 px-3 py-3">
          <div
            role="status"
            className={
              "rounded-md border px-3 py-2 text-xs leading-5 " +
              (sessionActive
                ? "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100"
                : "border-amber-300/20 bg-black/15 text-amber-100/80")
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-semibold">
                {sessionActive ? <Check className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
                {sessionActive ? "Phiên override hợp lệ" : checking ? "Đang kiểm tra phiên override" : "Panel đang khóa"}
              </span>
              {sessionActive && <span className="font-mono text-[11px]">{formatOverrideRemaining(remainingMs)}</span>}
            </div>
            {notice && <div className="mt-1 text-current/75">{notice}</div>}
          </div>

          {!sessionActive ? (
            <form className="grid gap-2" onSubmit={handleLogin}>
              <label className="space-y-1 text-xs font-medium text-amber-100/80">
                Master key
                <input
                  type="password"
                  value={loginKey}
                  onChange={(event) => setLoginKey(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="min-h-10 w-full rounded-md border border-white/10 bg-[var(--bg-base)] px-3 text-sm text-slate-100 outline-none focus:border-amber-200/40"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !loginKey.trim()}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                Mở Developer Override
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-rose-300/25 bg-rose-400/[0.08] p-3 text-xs leading-5 text-rose-100">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  Nguy hiểm: lựa chọn trong panel này chỉ ghi nhận trạng thái override, không xác nhận thiết bị hay dữ liệu thay cho lệnh thật.
                </div>
              </div>

              <label className="space-y-1 text-xs font-medium text-amber-100/80">
                Override mode
                <select
                  value={mode}
                  onChange={(event) => handleModeChange(event.target.value as ActiveDeveloperOverrideMode)}
                  className="min-h-10 w-full rounded-md border border-white/10 bg-[var(--bg-base)] px-3 text-sm text-slate-100 outline-none focus:border-amber-200/40"
                >
                  {developerOverrideModes.map((entry) => (
                    <option key={entry} value={entry}>
                      {developerOverrideModeLabels[entry]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2">
                <label className="space-y-1 text-xs font-medium text-amber-100/80">
                  Workflow
                  <select
                    value={effectiveWorkflowMode}
                    disabled={selectedModel?.family === "efisp-8e-gen5"}
                    onChange={(event) => setSelectedWorkflowMode(event.target.value as WorkflowMode)}
                    className="min-h-10 w-full rounded-md border border-white/10 bg-[var(--bg-base)] px-3 text-sm text-slate-100 outline-none focus:border-amber-200/40 disabled:opacity-60"
                  >
                    {selectableWorkflowModes.map((entry) => (
                      <option key={entry} value={entry}>
                        {workflowModeCopy[entry].title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-medium text-amber-100/80">
                  Model
                  <select
                    value={selectedModel?.id ?? ""}
                    onChange={(event) => setSelectedModelId(event.target.value)}
                    className="min-h-10 w-full rounded-md border border-white/10 bg-[var(--bg-base)] px-3 text-sm text-slate-100 outline-none focus:border-amber-200/40"
                  >
                    {availableModels.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-medium text-amber-100/80">
                  Resume phase
                  <select
                    value={selectedPhase}
                    onChange={(event) => setSelectedPhase(event.target.value as PhaseId)}
                    className="min-h-10 w-full rounded-md border border-white/10 bg-[var(--bg-base)] px-3 text-sm text-slate-100 outline-none focus:border-amber-200/40"
                  >
                    {selectablePhaseOrder.map((phase) => (
                      <option key={phase} value={phase}>
                        {phaseLabels[phase]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-semibold text-amber-100/80">Bypass gates</div>
                <div className="grid gap-1.5">
                  {overrideGateIds.map((gate) => (
                    <label
                      key={gate}
                      className="flex min-h-8 items-center gap-2 rounded-md border border-white/8 bg-black/15 px-2.5 py-1.5 text-xs text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={effectiveBypassedGates.includes(gate)}
                        disabled={mode !== "selective_bypass"}
                        onChange={(event) => handleGateToggle(gate, event.target.checked)}
                        className="h-4 w-4 rounded border-amber-200/40 bg-transparent accent-amber-300 disabled:opacity-60"
                      />
                      <span className="min-w-0 flex-1 truncate">{developerOverrideGateLabels[gate]}</span>
                      {effectiveBypassedGates.includes(gate) && <span className="font-mono text-[10px] uppercase text-amber-200">bypassed</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-md border border-white/8 bg-black/15 p-1 text-center font-mono text-[10px] uppercase text-slate-400">
                <span className="rounded-sm bg-emerald-300/[0.08] px-1.5 py-1 text-emerald-100">verified</span>
                <span className="rounded-sm bg-sky-300/[0.08] px-1.5 py-1 text-sky-100">manually assumed</span>
                <span className="rounded-sm bg-amber-300/[0.08] px-1.5 py-1 text-amber-100">bypassed</span>
              </div>

              <button
                type="button"
                onClick={handleApplyOverride}
                disabled={!canApplyOverride}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                <Wrench className="h-4 w-4" />
                Apply override
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={busy}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-slate-500"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Khóa override
              </button>
            </div>
          )}
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
    <PreflightChecklist workflow={workflow} />

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
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-amber-500 px-5 py-3 text-base font-black text-stone-950 transition duration-200 hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
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

    <CompatibilityPanel workflow={workflow} />
    <PaymentPanel workflow={workflow} />

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

const PaymentPanel = ({ workflow }: { workflow: WorkflowState }) => {
  const target = workflow.paymentTarget;
  const order = workflow.paymentOrder;
  const pass = workflow.unlockPass;
  const ready = workflow.paymentReady;
  const amount = order ? `${order.amount.toLocaleString("vi-VN")} ${order.currency}` : "10.000 VND";

  if (!target && !order && !pass) {
    return (
      <div className="mt-4 rounded-md border border-white/8 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <LockKeyhole className="h-4 w-4 text-amber-200" />
          Thanh toán unlock pass
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Sau khi app xác minh Fastboot serial/model, tạo đơn payOS 10.000 VND để nhận unlock pass.
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-4 rounded-md border p-4 ${ready ? "border-emerald-300/20 bg-emerald-300/[0.06]" : "border-amber-400/25 bg-amber-400/[0.08]"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <LockKeyhole className="h-4 w-4 text-amber-200" />
          Thanh toán unlock pass
        </div>
        <span className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${ready ? toneClass("good") : toneClass("info")}`}>
          {ready ? "pass ready" : order?.status ?? "required"}
        </span>
      </div>

      <InfoGrid
        rows={[
          ["Giá", amount],
          ["Model", target?.modelName ?? order?.modelName ?? "—"],
          ["Serial", target?.serial ?? order?.serial ?? "—"],
          ["Pass", pass?.status ?? "—"],
        ]}
      />

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {!ready && !order && (
          <button
            type="button"
            disabled={!workflow.canCreatePayment}
            onClick={workflow.createUnlockPayment}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-black text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
          >
            <LockKeyhole className="h-4 w-4" />
            Tạo đơn payOS
          </button>
        )}
        {order?.checkoutUrl && !ready && (
          <a
            href={order.checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-black text-stone-950 transition hover:bg-amber-400"
          >
            Mở trang thanh toán
          </a>
        )}
        {order && !ready && (
          <button
            type="button"
            disabled={workflow.busy}
            onClick={workflow.refreshUnlockPayment}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/25 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-slate-500"
          >
            {workflow.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Kiểm tra thanh toán
          </button>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        Pass chỉ dùng cho đúng serial/model này. Chuẩn bị file không consume pass; pass được consume ngay trước bước nguy hiểm đầu tiên.
      </p>
    </div>
  );
};

const PreflightChecklist = ({ workflow }: { workflow: WorkflowState }) => {
  const items = [
    {
      key: "backedUp" as const,
      label: "Đã sao lưu dữ liệu quan trọng.",
    },
    {
      key: "acceptsDataLoss" as const,
      label: "Chấp nhận mất toàn bộ dữ liệu và rủi ro brick máy.",
    },
    {
      key: "hasStockRom" as const,
      label:
        workflow.model?.family === "efisp-8e-gen5"
          ? "Đã chuẩn bị phương án khôi phục/ROM gốc đúng model."
          : "Đã có ROM gốc đúng model để hoàn tất bằng MiFlash.",
    },
  ];

  return (
    <div className="mb-4 rounded-md border border-white/8 bg-black/15 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white">Kiểm tra trước khi chạy</span>
        <span className={`font-mono text-[10px] font-semibold uppercase ${isPreflightReady(workflow.preflight) ? "text-emerald-300" : "text-slate-500"}`}>
          {isPreflightReady(workflow.preflight) ? "ready" : "required"}
        </span>
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <label key={item.key} className="flex items-start gap-2.5 text-xs leading-5 text-slate-300">
            <input
              type="checkbox"
              checked={workflow.preflight[item.key]}
              onChange={(event) =>
                workflow.setPreflight((current) => ({
                  ...current,
                  [item.key]: event.target.checked,
                }))
              }
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-amber-400"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

const CompatibilityPanel = ({ workflow }: { workflow: WorkflowState }) => {
  const report = workflow.compatibilityReport;
  const adb = report?.adb;
  const fastboot = report?.fastboot;
  const model = workflow.model;
  const xiaomiOs = formatXiaomiOs(adb);
  const hasWarnings = Boolean(report?.warnings.length);
  const showWarningCheckbox = report?.verdict === "warning";
  const fastbootAliasAccepted = fastboot?.productMatch === "post-abl-alias";
  const fastbootMatchLabel = fastbootAliasAccepted
    ? `Alias sau ABL -> ${fastboot?.canonicalProduct ?? model?.product ?? "—"}`
    : fastboot?.productMatch === "exact"
      ? "Khớp codename"
      : "—";

  if (!report && !model) {
    return (
      <EmptyState
        icon={<Cpu className="h-4 w-4" />}
        title="Phiên bản máy"
        text="Kết nối ADB Android để app đọc codename, Android/HyperOS, security patch rồi mới xác minh Fastboot."
      />
    );
  }

  return (
    <div className="mt-4 rounded-md border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Cpu className="h-4 w-4 text-amber-200" />
          Phiên bản máy
        </div>
        <span className={`rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${compatibilityTone(report?.verdict)}`}>
          {report?.verdict ?? "chưa kiểm tra"}
        </span>
      </div>

      <InfoGrid
        rows={[
          ["Mẫu máy", report?.modelName ?? model?.name ?? "—"],
          ["Codename", report?.product ?? model?.product ?? (workflow.detectedProduct || "—")],
          ["Android", adb?.androidRelease ?? "—"],
          ["HyperOS/MIUI", xiaomiOs],
          ["Security", adb?.securityPatch ?? "—"],
          ["Fastboot", fastboot?.product ?? workflow.targetDetection?.fastbootProduct ?? "—"],
          ["Fastboot match", fastbootMatchLabel],
          ["Serial", fastboot?.serial ?? workflow.targetDetection?.fastbootSerial ?? "—"],
          ["Anti", fastboot?.anti ?? "—"],
          ["Trạng thái", workflow.targetDetection?.verified ? "Đã xác minh khớp" : "Chờ xác minh Fastboot"],
          ["Workflow", model?.family === "efisp-8e-gen5" ? "EFISP 8E Gen 5" : "Legacy FTD"],
          ["Asset", model && "ftdPackage" in model ? model.ftdPackage : model?.efispUnlockFile ?? "—"],
        ]}
      />

      {fastbootAliasAccepted && (
        <div className="mt-3 flex gap-2 rounded-md border border-amber-400/25 bg-amber-400/[0.08] p-3 text-xs leading-5 text-amber-50/85">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
          <span>
            Fastboot đang trả <code className="font-mono text-amber-100">{fastboot?.product}</code>, được chấp nhận là alias sau ABL của{" "}
            <code className="font-mono text-amber-100">{fastboot?.canonicalProduct ?? model?.product}</code>. App sẽ không flash FTD cho case này.
          </span>
        </div>
      )}

      {hasWarnings && (
        <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-100">
            <ShieldAlert className="h-4 w-4" />
            Cảnh báo phiên bản
          </div>
          <ul className="grid gap-1 text-xs leading-5 text-amber-50/85">
            {report!.warnings.map((warning) => (
              <li key={warning} className="flex gap-1.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-300/70" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
          {showWarningCheckbox && (
            <label className="mt-3 flex items-start gap-3 border-t border-amber-200/10 pt-3 text-xs leading-5 text-amber-50/90">
              <input
                type="checkbox"
                checked={workflow.compatibilityWarningsAccepted}
                onChange={(event) => workflow.setCompatibilityWarningsAccepted(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-200/40 bg-transparent accent-amber-300"
              />
              Tôi đã đọc cảnh báo phiên bản và vẫn muốn tiếp tục các bước nguy hiểm.
            </label>
          )}
        </div>
      )}
    </div>
  );
};

const PhaseHero = ({ workflow, actionHint }: { workflow: WorkflowState; actionHint: string }) => (
  <div className="mb-5">
    <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase text-amber-400">
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
  const showFastboot = workflow.awaitingFastbootVerification || workflow.showAdvancedEdl;

  return (
    <div className="space-y-2">
      <div className={`grid gap-3 ${showFastboot ? "sm:grid-cols-2" : ""}`}>
        <button
          type="button"
          disabled={!canConnectDevice || workflow.busy}
          onClick={workflow.connectAdbEntry}
          className={`${buttonBase} border border-emerald-300/20 bg-emerald-300 text-slate-950 hover:bg-emerald-200`}
        >
          {workflow.busy && workflow.nextPhase === "connect-device" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Usb className="h-4 w-4" />}
          Kết nối ADB Android
        </button>
        {showFastboot && (
          <button
            type="button"
            disabled={!workflow.canConnectFastbootEntry || workflow.busy}
            onClick={workflow.connectFastbootEntry}
            className={`${buttonBase} border border-amber-500/30 bg-amber-500 text-stone-950 hover:bg-amber-400`}
          >
            {workflow.busy && workflow.nextPhase === "connect-device" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            Xác minh Fastboot
          </button>
        )}
      </div>
      {!showFastboot && (
        <p className="text-xs leading-5 text-slate-500">
          Người mới hãy bắt đầu từ Android/ADB để app kiểm tra phiên bản trước khi sang Fastboot.
        </p>
      )}
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
        <ProgressMeter title="Tổng tiến trình" detail={progressCount} percent={progressPercent} barClassName="bg-amber-500" />
        <ProgressMeter title={itemTitle} detail={itemLabel} percent={itemProgress} barClassName={itemIsOperation ? "bg-emerald-400" : "bg-amber-400"} />
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
    <aside id="terminal-log" className={`flex scroll-mt-20 flex-col rounded-lg border border-white/8 bg-[var(--bg-elevated)]/90 p-4 xl:sticky xl:top-[4.25rem] xl:max-h-[calc(100dvh-5rem)] xl:self-start ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Terminal className="h-4 w-4 text-amber-200" />
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
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-amber-300/80">{">"}</span>
          <input
            id="fastboot-terminal-command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            disabled={commandDisabled}
            placeholder="fastboot devices"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full min-w-0 rounded-md border border-white/8 bg-[var(--bg-inset)] pl-7 pr-3 font-mono text-xs text-stone-100 outline-none transition placeholder:text-stone-700 focus:border-amber-400/55 disabled:cursor-not-allowed disabled:text-stone-600"
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          title="Gửi lệnh Fastboot"
          aria-label="Gửi lệnh Fastboot"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-amber-500/25 bg-amber-500 text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-stone-800 disabled:text-stone-600"
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
  <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/25 bg-amber-400/[0.08] px-2.5 py-1 text-xs font-bold text-amber-100">
    <Circle className="h-2 w-2 fill-amber-400 text-amber-400" />
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
        <span className="text-current/60">{label}</span>
        <span className="min-w-0 break-all text-right font-mono font-semibold text-current">{value}</span>
      </div>
    ))}
  </div>
);

const formatXiaomiOs = (adb: NonNullable<WorkflowState["compatibilityReport"]>["adb"]) => {
  if (!adb) {
    return "—";
  }

  const hyperOs = [adb.hyperOsVersionName, adb.hyperOsVersionCode].filter(Boolean).join(" ");
  const miui = [adb.miuiVersionName, adb.miuiVersionCode].filter(Boolean).join(" ");
  return hyperOs || miui || adb.incremental || "—";
};

const compatibilityTone = (verdict?: CompatibilityVerdict) => {
  if (verdict === "compatible") {
    return "border-emerald-500/35 bg-emerald-50 text-emerald-900";
  }

  if (verdict === "warning") {
    return "border-amber-500/40 bg-amber-50 text-amber-900";
  }

  return "border-stone-950/15 bg-white text-stone-600";
};

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
    good: "border-emerald-500/35 bg-emerald-50 text-emerald-900",
    bad: "border-rose-500/35 bg-rose-50 text-rose-900",
    muted: "border-stone-950/15 bg-white text-stone-600",
    neutral: "border-stone-950/20 bg-white text-stone-800",
    info: "border-amber-500/40 bg-amber-50 text-amber-900",
    warn: "border-amber-500/40 bg-amber-50 text-amber-900",
  })[tone];

const progressToPercent = (progress?: number) => {
  if (progress === undefined || !Number.isFinite(progress)) {
    return undefined;
  }
  return Math.round(Math.max(0, Math.min(1, progress)) * 100);
};

const formatPercent = (percent?: number) => (percent === undefined ? "—" : `${percent}%`);

const formatVnd = (amount: number) => `${amount.toLocaleString("vi-VN")}đ`;

const formatDateTime = (value?: string) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

const donationStatusLabel = (status?: Donation["status"]) => {
  switch (status) {
    case "pending":
      return "Chờ thanh toán";
    case "paid":
      return "Đã nhận";
    case "expired":
      return "Hết hạn";
    case "failed":
      return "Thất bại";
    case "cancelled":
      return "Đã hủy";
    default:
      return "Chưa tạo";
  }
};

const donationStatusClass = (status?: Donation["status"]) => {
  switch (status) {
    case "paid":
      return toneClass("good");
    case "pending":
      return toneClass("info");
    case "expired":
    case "failed":
    case "cancelled":
      return toneClass("warn");
    default:
      return toneClass("muted");
  }
};

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
    return "text-amber-300";
  }
  return "text-slate-300";
};

export default App;
