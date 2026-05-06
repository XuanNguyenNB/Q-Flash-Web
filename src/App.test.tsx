import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const { workflow, setWorkflowFamily, setWorkflowMode, prepareAssetsEarly, rebootAdbToFastboot } = vi.hoisted(() => {
  const setWorkflowFamilyMock = vi.fn();
  const setWorkflowModeMock = vi.fn();
  const prepareAssetsEarlyMock = vi.fn();
  const rebootAdbToFastbootMock = vi.fn();
  const visiblePhaseOrder = [
    "preflight",
    "connect-device",
    "prepare-assets",
    "boot-permissive",
    "downgrade-abl",
    "flash-ftd",
    "unlock-payload",
    "restore-gpt",
    "finished",
  ];

  return {
    setWorkflowFamily: setWorkflowFamilyMock,
    setWorkflowMode: setWorkflowModeMock,
    prepareAssetsEarly: prepareAssetsEarlyMock,
    rebootAdbToFastboot: rebootAdbToFastbootMock,
    workflow: {
      preflight: {
        isHttps: true,
        hasWebUsb: true,
        backedUp: true,
        acceptsDataLoss: true,
        hasStockRom: true,
      },
      setPreflight: vi.fn(),
      statuses: {
        preflight: "done",
        "connect-device": "pending",
        "prepare-assets": "pending",
        "boot-permissive": "pending",
        "write-efisp": "pending",
        "verify-unlock": "pending",
        "cleanup-data": "pending",
        "downgrade-abl": "pending",
        "flash-ftd": "pending",
        "unlock-payload": "pending",
        "restore-gpt": "pending",
        finished: "pending",
      },
      deviceStatus: "disconnected",
      logs: [],
      manifest: { version: 1, models: [] },
      model: undefined,
      detectedProduct: "",
      targetDetection: undefined,
      awaitingFastbootVerification: false,
      busy: false,
      error: undefined,
      progress: undefined,
      workflowFamily: "legacy-ftd",
      workflowMode: "standard-mqsas",
      visiblePhaseOrder,
      visibleResumePhaseOrder: ["prepare-assets", "boot-permissive", "downgrade-abl", "flash-ftd", "unlock-payload", "restore-gpt"],
      canRebootAdbToFastboot: false,
      canPrepareAssetsEarly: false,
      canSwitchWorkflowFamily: true,
      canSwitchWorkflowMode: true,
      setWorkflowFamily: setWorkflowFamilyMock,
      setWorkflowMode: setWorkflowModeMock,
      phaseConfirmations: {
        "write-efisp": false,
        "cleanup-data": false,
        "downgrade-abl": false,
        "flash-ftd": false,
        "unlock-payload": false,
        "restore-gpt": false,
      },
      setPhaseConfirmations: vi.fn(),
      nextPhase: "connect-device",
      requiresConfirmation: false,
      canRun: false,
      canConnectEntry: true,
      canDisconnect: true,
      canRunFastbootTerminalCommand: true,
      mockMode: false,
      mainButton: "Kết nối thiết bị",
      rebootAdbToFastboot: rebootAdbToFastbootMock,
      prepareAssetsEarly: prepareAssetsEarlyMock,
      runNext: vi.fn(),
      runFastbootTerminalCommand: vi.fn(),
      connectAdbEntry: vi.fn(),
      connectFastbootEntry: vi.fn(),
      resetSession: vi.fn(),
      startBlazerMock: vi.fn(),
      applyDeveloperOverride: vi.fn(),
      downloadLog: vi.fn(),
      errorAdvice: undefined,
    },
  };
});

vi.mock("./hooks/useUnlockWorkflow", () => ({
  phaseOrder: [
    "preflight",
    "connect-device",
    "prepare-assets",
    "boot-permissive",
    "downgrade-abl",
    "flash-ftd",
    "unlock-payload",
    "restore-gpt",
    "finished",
  ],
  resumePhaseOrder: [
    "prepare-assets",
    "boot-permissive",
    "write-efisp",
    "verify-unlock",
    "cleanup-data",
    "downgrade-abl",
    "flash-ftd",
    "unlock-payload",
    "restore-gpt",
  ],
  phaseLabels: {
    preflight: "Kiểm tra ban đầu",
    "connect-device": "Kết nối thiết bị",
    "prepare-assets": "Chuẩn bị asset ROM",
    "boot-permissive": "Boot Android Permissive",
    "write-efisp": "Ghi EFISP unlock",
    "verify-unlock": "Xac minh unlocked",
    "cleanup-data": "Xoa EFISP/du lieu",
    "downgrade-abl": "Hạ ABL",
    "flash-ftd": "Flash gói FTD",
    "unlock-payload": "Chạy payload unlock",
    "restore-gpt": "Khôi phục GPT cuối",
    finished: "MiFlash ROM gốc",
  },
  useUnlockWorkflow: () => workflow,
}));

afterEach(() => {
  cleanup();
});

describe("App workflow selector", () => {
  beforeEach(() => {
    setWorkflowFamily.mockClear();
    setWorkflowMode.mockClear();
    prepareAssetsEarly.mockClear();
    rebootAdbToFastboot.mockClear();
    workflow.runNext.mockClear();
    workflow.workflowFamily = "legacy-ftd";
    workflow.workflowMode = "standard-mqsas";
    workflow.visiblePhaseOrder = [
      "preflight",
      "connect-device",
      "prepare-assets",
      "boot-permissive",
      "downgrade-abl",
      "flash-ftd",
      "unlock-payload",
      "restore-gpt",
      "finished",
    ];
    workflow.visibleResumePhaseOrder = ["prepare-assets", "boot-permissive", "downgrade-abl", "flash-ftd", "unlock-payload", "restore-gpt"];
    workflow.statuses["prepare-assets"] = "pending";
    workflow.statuses["boot-permissive"] = "pending";
    workflow.statuses["write-efisp"] = "pending";
    workflow.statuses["verify-unlock"] = "pending";
    workflow.statuses["cleanup-data"] = "pending";
    workflow.nextPhase = "connect-device";
    workflow.requiresConfirmation = false;
    workflow.mainButton = "Kết nối thiết bị";
    workflow.model = undefined;
    workflow.targetDetection = undefined;
    workflow.progress = undefined;
    workflow.canRebootAdbToFastboot = false;
    workflow.canPrepareAssetsEarly = false;
  });

  it("renders both ABL workflows and lets the user select EDL mode", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /Quy trình thường MQSAS/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nạp ABL qua EDL mode/i })).toBeInTheDocument();
    expect(screen.getByText(/Dành cho các thiết bị có bản cập nhật đuôi C06, C07, C08/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Nạp ABL qua EDL mode/i }));

    expect(setWorkflowMode).toHaveBeenCalledWith("c06-edl");
  });

  it("lets the user prepare ROM assets before the prepare-assets phase", () => {
    workflow.model = { family: "legacy-ftd", id: "xiaomi15", name: "Xiaomi 15", product: "dada", ftdPackage: "packages/xiaomi15" };
    workflow.canPrepareAssetsEarly = true;

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Chuẩn bị ROM trước/i }));

    expect(prepareAssetsEarly).toHaveBeenCalled();
  });

  it("uses the EDL-specific timeline without the Android permissive step", () => {
    workflow.workflowMode = "c06-edl";
    workflow.visiblePhaseOrder = [
      "preflight",
      "connect-device",
      "prepare-assets",
      "downgrade-abl",
      "flash-ftd",
      "unlock-payload",
      "restore-gpt",
      "finished",
    ];
    workflow.statuses["boot-permissive"] = "skipped";

    render(<App />);

    expect(screen.queryByText("Boot Android Permissive")).not.toBeInTheDocument();
    expect(screen.getByText("Hạ ABL")).toBeInTheDocument();
    expect(screen.getByText("Flash gói FTD")).toBeInTheDocument();
  });

  it("shows an ADB reboot helper on Fastboot-required phases and keeps the main action separate", () => {
    workflow.nextPhase = "boot-permissive";
    workflow.mainButton = "Tiếp tục";
    workflow.model = { family: "legacy-ftd", id: "xiaomi15", name: "Xiaomi 15", product: "dada", ftdPackage: "packages/xiaomi15" };
    workflow.targetDetection = {
      model: workflow.model,
      fastbootProduct: "dada",
      source: "fastboot",
      verified: true,
    };
    workflow.canRun = true;
    workflow.canRebootAdbToFastboot = true;

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Máy đang ở Android: reboot bootloader/i }));

    expect(rebootAdbToFastboot).toHaveBeenCalled();
    expect(workflow.runNext).not.toHaveBeenCalled();
    expect(screen.getByText(/Sau khi máy vào Fastboot, bấm nút chính/i)).toBeInTheDocument();
  });

  it("hides the ADB reboot helper on phases that do not require Fastboot", () => {
    for (const phase of ["connect-device", "prepare-assets", "downgrade-abl"] as const) {
      workflow.nextPhase = phase;
      workflow.canRebootAdbToFastboot = false;

      render(<App />);

      expect(screen.queryByRole("button", { name: /Máy đang ở Android: reboot bootloader/i })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it("renders separate overall and current file progress bars while preparing assets", () => {
    workflow.nextPhase = "prepare-assets";
    workflow.progress = {
      label: "Đang tải packages/xiaomi15/images/vendor_boot.img",
      path: "packages/xiaomi15/images/vendor_boot.img",
      completedFiles: 44,
      totalFiles: 56,
      completedItems: 44,
      totalItems: 56,
      receivedBytes: 155_400_000,
      totalBytes: 242_700_000,
      fileReceivedBytes: 8_600_000,
      fileTotalBytes: 96_000_000,
      bytesPerSecond: 5_900_000,
      etaSeconds: 15,
      state: "downloading",
      progress: 0.79,
      overallProgress: 0.79,
      itemProgress: 0.09,
      itemLabel: "packages/xiaomi15/images/vendor_boot.img",
    };

    render(<App />);

    expect(screen.getByText("Tổng tiến trình")).toBeInTheDocument();
    expect(screen.getAllByText("Tệp hiện tại").length).toBeGreaterThan(0);
    expect(screen.getAllByText("44/56 tệp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("79%").length).toBeGreaterThan(0);
    expect(screen.getByText("9%")).toBeInTheDocument();
  });

  it("renders current operation progress while flashing", () => {
    workflow.nextPhase = "flash-ftd";
    workflow.progress = {
      label: "[3/5] Flash boot_ab",
      state: "flashing",
      progress: 0.42,
      overallProgress: 0.48,
      itemProgress: 0.42,
      itemLabel: "[3/5] Flash boot_ab",
      completedItems: 2,
      totalItems: 5,
    };

    render(<App />);

    expect(screen.getByText("Tổng tiến trình")).toBeInTheDocument();
    expect(screen.getByText("Thao tác hiện tại")).toBeInTheDocument();
    expect(screen.getAllByText("2/5 thao tác").length).toBeGreaterThan(0);
    expect(screen.getAllByText("48%").length).toBeGreaterThan(0);
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("shows the EDL confirmation text on the ABL phase", () => {
    workflow.workflowMode = "c06-edl";
    workflow.nextPhase = "downgrade-abl";
    workflow.requiresConfirmation = true;
    workflow.mainButton = "Nạp ABL qua EDL mode";

    render(<App />);

    expect(screen.getByText(/Tôi xác nhận máy đang ở EDL 9008/i)).toBeInTheDocument();
  });

  it("shows System destroyed recovery guidance before flashing FTD after EDL", () => {
    workflow.workflowMode = "c06-edl";
    workflow.nextPhase = "flash-ftd";
    workflow.requiresConfirmation = true;
    workflow.mainButton = "Kết nối lại Fastboot và flash FTD";

    render(<App />);

    expect(screen.getAllByText(/System destroyed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/10-15 giây/i).length).toBeGreaterThan(0);
  });
});
