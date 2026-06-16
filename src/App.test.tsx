import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const { workflow, setWorkflowMode, runFastbootTerminalCommand } = vi.hoisted(() => {
  const setWorkflowModeMock = vi.fn();
  const runFastbootTerminalCommandMock = vi.fn();
  const statuses = {
    preflight: "done",
    "connect-device": "done",
    "prepare-assets": "pending",
    "flash-ftd": "pending",
    "unlock-payload": "pending",
    "restore-gpt": "pending",
    finished: "pending",
  };
  const visiblePhaseOrder = [
    "preflight",
    "connect-device",
    "prepare-assets",
    "flash-ftd",
    "unlock-payload",
    "restore-gpt",
    "finished",
  ];

  return {
    setWorkflowMode: setWorkflowModeMock,
    runFastbootTerminalCommand: runFastbootTerminalCommandMock,
    workflow: {
      preflight: {
        isHttps: true,
        hasWebUsb: true,
        backedUp: true,
        acceptsDataLoss: true,
        hasStockRom: true,
      },
      setPreflight: vi.fn(),
      statuses,
      deviceStatus: "fastboot",
      logs: [],
      manifest: {
        version: 1,
        models: [
          {
            family: "legacy-ftd",
            id: "xiaomi15",
            name: "Xiaomi 15",
            product: "dada",
            ablFile: "abl/mi15.elf",
            ftdPackage: "packages/xiaomi15",
            unlock: { gptBoth4: "unlock/gpt_both4.bin", bootImage: "unlock/boot.img" },
            finalGpt: [
              "packages/xiaomi15/images/gpt_both0.bin",
              "packages/xiaomi15/images/gpt_both1.bin",
              "packages/xiaomi15/images/gpt_both2.bin",
              "packages/xiaomi15/images/gpt_both3.bin",
              "packages/xiaomi15/images/gpt_both4.bin",
              "packages/xiaomi15/images/gpt_both5.bin",
            ],
          },
        ],
      },
      model: {
        family: "legacy-ftd",
        id: "xiaomi15",
        name: "Xiaomi 15",
        product: "dada",
        ablFile: "abl/mi15.elf",
        ftdPackage: "packages/xiaomi15",
        unlock: { gptBoth4: "unlock/gpt_both4.bin", bootImage: "unlock/boot.img" },
        finalGpt: [
          "packages/xiaomi15/images/gpt_both0.bin",
          "packages/xiaomi15/images/gpt_both1.bin",
          "packages/xiaomi15/images/gpt_both2.bin",
          "packages/xiaomi15/images/gpt_both3.bin",
          "packages/xiaomi15/images/gpt_both4.bin",
          "packages/xiaomi15/images/gpt_both5.bin",
        ],
      },
      detectedProduct: "dada",
      targetDetection: {
        model: undefined,
        fastbootProduct: "dada",
        fastbootSerial: "SERIAL123",
        source: "fastboot",
        verified: true,
      },
      awaitingFastbootVerification: false,
      busy: false,
      error: undefined,
      progress: undefined,
      workflowMode: "standard",
      visiblePhaseOrder,
      visibleResumePhaseOrder: ["prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt"],
      canRebootAdbToFastboot: false,
      canPrepareAssetsEarly: false,
      canSwitchWorkflowMode: true,
      setWorkflowMode: setWorkflowModeMock,
      phaseConfirmations: {
        "flash-ftd": false,
        "unlock-payload": false,
        "restore-gpt": false,
      },
      setPhaseConfirmations: vi.fn(),
      nextPhase: "prepare-assets",
      requiresConfirmation: false,
      canRun: true,
      canConnectEntry: false,
      canDisconnect: true,
      canRunFastbootTerminalCommand: true,
      mockMode: false,
      mainButton: "Tai va kiem tra ROM FTD",
      rebootAdbToFastboot: vi.fn(),
      prepareAssetsEarly: vi.fn(),
      runNext: vi.fn(),
      runFastbootTerminalCommand: runFastbootTerminalCommandMock,
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
  phaseOrder: ["preflight", "connect-device", "prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt", "finished"],
  resumePhaseOrder: ["prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt"],
  phaseLabels: {
    preflight: "Kiem tra ban dau",
    "connect-device": "Ket noi thiet bi",
    "prepare-assets": "Chuan bi tep ROM",
    "flash-ftd": "Flash goi FTD",
    "unlock-payload": "Chay payload mo khoa",
    "restore-gpt": "Khoi phuc GPT cuoi",
    finished: "MiFlash ROM goc",
  },
  useUnlockWorkflow: () => workflow,
}));

afterEach(() => {
  cleanup();
});

describe("App simplified FTD workflow", () => {
  beforeEach(() => {
    setWorkflowMode.mockClear();
    runFastbootTerminalCommand.mockClear();
    runFastbootTerminalCommand.mockResolvedValue("");
    workflow.workflowMode = "standard";
    workflow.nextPhase = "prepare-assets";
    workflow.requiresConfirmation = false;
    workflow.progress = undefined;
    workflow.logs = [];
    workflow.targetDetection.fastbootSerial = "SERIAL123";
    workflow.statuses = {
      preflight: "done",
      "connect-device": "done",
      "prepare-assets": "pending",
      "flash-ftd": "pending",
      "unlock-payload": "pending",
      "restore-gpt": "pending",
      finished: "pending",
    };
  });

  it("renders only Standard and EDL_Standard modes", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /^Standard$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /EDL_Standard/i })).toBeInTheDocument();
    expect(screen.queryByText(/Xiaomi 17/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/EFISP/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /EDL_Standard/i }));

    expect(setWorkflowMode).toHaveBeenCalledWith("edl-standard");
  });

  it("shows the manual EDL note for EDL_Standard flash FTD", () => {
    workflow.workflowMode = "edl-standard";
    workflow.nextPhase = "flash-ftd";
    workflow.requiresConfirmation = true;

    render(<App />);

    expect(screen.getAllByText(/ABL engineering/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/fastboot erase frp/i).length).toBeGreaterThan(0);
  });

  it("shows the simplified phase order without removed phases", () => {
    render(<App />);

    expect(screen.getAllByText("Chuan bi tep ROM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Flash goi FTD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chay payload mo khoa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Khoi phuc GPT cuoi").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Boot Android/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ha ABL/i)).not.toBeInTheDocument();
  });

  it("shows fastboot serial in the device card", () => {
    render(<App />);

    expect(screen.getByText("Serial")).toBeInTheDocument();
    expect(screen.getByText("SERIAL123")).toBeInTheDocument();
  });

  it("uses fastboot devices as the terminal helper", () => {
    render(<App />);

    const input = screen.getByPlaceholderText("fastboot devices");
    fireEvent.change(input, { target: { value: "fastboot devices" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi lệnh/i }));

    expect(runFastbootTerminalCommand).toHaveBeenCalledWith("fastboot devices");
  });
});
