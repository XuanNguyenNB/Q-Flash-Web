import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { overrideGateIds } from "./workflow/types";

const qrCode = vi.hoisted(() => ({
  toString: vi.fn(),
}));

const developerOverrideApi = vi.hoisted(() => ({
  auditDeveloperOverride: vi.fn(),
  getDeveloperOverrideStatus: vi.fn(),
  loginDeveloperOverride: vi.fn(),
  logoutDeveloperOverride: vi.fn(),
}));

const { workflow, setWorkflowMode, runFastbootTerminalCommand, setCompatibilityWarningsAccepted, createUnlockPayment } = vi.hoisted(() => {
  const setWorkflowModeMock = vi.fn();
  const runFastbootTerminalCommandMock = vi.fn();
  const setCompatibilityWarningsAcceptedMock = vi.fn();
  const createUnlockPaymentMock = vi.fn();
  const refreshUnlockPaymentMock = vi.fn();
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
    setCompatibilityWarningsAccepted: setCompatibilityWarningsAcceptedMock,
    createUnlockPayment: createUnlockPaymentMock,
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
      phaseProvenance: {},
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
          {
            family: "efisp-8e-gen5",
            id: "xiaomi17",
            name: "Xiaomi 17",
            product: "pudding",
            efispUnlockFile: "efisp/gbl_efi_unlock.efi",
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
      compatibilityReport: {
        modelId: "xiaomi15",
        modelName: "Xiaomi 15",
        product: "dada",
        chip: "8E",
        verdict: "compatible",
        warnings: [],
        adb: {
          productProps: {
            "ro.product.device": "dada",
            "ro.product.vendor.device": "dada",
            "ro.build.product": "dada",
          },
          androidRelease: "15",
          securityPatch: "2025-01-01",
          hyperOsVersionName: "OS2.0",
        },
        fastboot: {
          product: "dada",
          serial: "SERIAL123",
          anti: "0",
          verifiedWithAdb: true,
        },
      },
      paymentOrder: undefined,
      unlockPass: undefined,
      paymentTarget: {
        modelId: "xiaomi15",
        modelName: "Xiaomi 15",
        product: "dada",
        serial: "SERIAL123",
      },
      paymentRequired: true,
      paymentReady: true,
      canCreatePayment: false,
      createUnlockPayment: createUnlockPaymentMock,
      refreshUnlockPayment: refreshUnlockPaymentMock,
      compatibilityWarningsAccepted: false,
      setCompatibilityWarningsAccepted: setCompatibilityWarningsAcceptedMock,
      awaitingFastbootVerification: false,
      busy: false,
      error: undefined,
      progress: undefined,
      workflowMode: "standard",
      overrideGatePolicy: { mode: "none", bypassedGates: [] },
      visiblePhaseOrder,
      visibleResumePhaseOrder: ["prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt"],
      canRebootAdbToFastboot: false,
      canPrepareAssetsEarly: false,
      canSwitchWorkflowMode: true,
      setWorkflowMode: setWorkflowModeMock,
      applyDeveloperOverrideSession: vi.fn(),
      clearDeveloperOverride: vi.fn(),
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
      canConnectFastbootEntry: false,
      canDisconnect: true,
      canRunFastbootTerminalCommand: true,
      mockMode: false,
      showAdvancedEdl: false,
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
  phaseOrder: [
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
  ],
  resumePhaseOrder: ["prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt"],
  workflowPhaseOrder: (model?: { family?: string }, workflowMode = "standard") => {
    if (model?.family === "efisp-8e-gen5") {
      return ["preflight", "connect-device", "prepare-assets", "boot-permissive", "write-efisp", "verify-unlock", "cleanup-data", "finished"];
    }
    return workflowMode === "edl-standard"
      ? ["preflight", "connect-device", "prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt", "verify-unlock", "finished"]
      : ["preflight", "connect-device", "prepare-assets", "flash-ftd", "unlock-payload", "restore-gpt", "finished"];
  },
  phaseLabels: {
    preflight: "Kiem tra ban dau",
    "connect-device": "Ket noi thiet bi",
    "prepare-assets": "Chuan bi tep ROM",
    "boot-permissive": "Boot Android permissive",
    "write-abl": "Ghi ABL qua MQSAS",
    "write-efisp": "Ghi EFI unlock qua MQSAS",
    "verify-unlock": "Xac minh bootloader",
    "cleanup-data": "Don EFISP va du lieu",
    "flash-ftd": "Flash goi FTD",
    "unlock-payload": "Chay payload mo khoa",
    "restore-gpt": "Khoi phuc GPT cuoi",
    finished: "MiFlash ROM goc",
  },
  useUnlockWorkflow: () => workflow,
}));

vi.mock("qrcode", () => ({
  default: qrCode,
}));

vi.mock("./services/developerOverrideApi", () => developerOverrideApi);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("App simplified FTD workflow", () => {
  const activeOverrideSession = (durationMs = 15 * 60 * 1000) => ({
    expiresAt: new Date(Date.now() + durationMs).toISOString(),
    remainingMs: durationMs,
  });

  beforeEach(() => {
    setWorkflowMode.mockClear();
    runFastbootTerminalCommand.mockClear();
    setCompatibilityWarningsAccepted.mockClear();
    createUnlockPayment.mockClear();
    developerOverrideApi.auditDeveloperOverride.mockReset();
    developerOverrideApi.getDeveloperOverrideStatus.mockReset();
    developerOverrideApi.loginDeveloperOverride.mockReset();
    developerOverrideApi.logoutDeveloperOverride.mockReset();
    workflow.applyDeveloperOverride.mockClear();
    workflow.applyDeveloperOverrideSession.mockClear();
    workflow.applyDeveloperOverrideSession.mockReturnValue(true);
    workflow.clearDeveloperOverride.mockClear();
    workflow.startBlazerMock.mockClear();
    developerOverrideApi.auditDeveloperOverride.mockResolvedValue({ ok: true });
    developerOverrideApi.getDeveloperOverrideStatus.mockRejectedValue(new Error("No override session"));
    developerOverrideApi.logoutDeveloperOverride.mockResolvedValue({ ok: true });
    qrCode.toString.mockReset();
    qrCode.toString.mockResolvedValue("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    runFastbootTerminalCommand.mockResolvedValue("");
    workflow.workflowMode = "standard";
    workflow.nextPhase = "prepare-assets";
    workflow.requiresConfirmation = false;
    workflow.canRun = true;
    workflow.canConnectEntry = false;
    workflow.canConnectFastbootEntry = false;
    workflow.awaitingFastbootVerification = false;
    workflow.showAdvancedEdl = false;
    workflow.compatibilityWarningsAccepted = false;
    workflow.model.family = "legacy-ftd";
    workflow.model.id = "xiaomi15";
    workflow.model.name = "Xiaomi 15";
    workflow.model.product = "dada";
    workflow.visiblePhaseOrder = [
      "preflight",
      "connect-device",
      "prepare-assets",
      "flash-ftd",
      "unlock-payload",
      "restore-gpt",
      "finished",
    ];
    workflow.progress = undefined;
    workflow.logs = [];
    workflow.compatibilityReport = {
      modelId: "xiaomi15",
      modelName: "Xiaomi 15",
      product: "dada",
      chip: "8E",
      verdict: "compatible",
      warnings: [],
      adb: {
        productProps: {
          "ro.product.device": "dada",
          "ro.product.vendor.device": "dada",
          "ro.build.product": "dada",
        },
        androidRelease: "15",
        securityPatch: "2025-01-01",
        hyperOsVersionName: "OS2.0",
      },
      fastboot: {
        product: "dada",
        serial: "SERIAL123",
        anti: "0",
        verifiedWithAdb: true,
      },
    };
    workflow.paymentOrder = undefined;
    workflow.unlockPass = undefined;
    workflow.paymentTarget = {
      modelId: "xiaomi15",
      modelName: "Xiaomi 15",
      product: "dada",
      serial: "SERIAL123",
    };
    workflow.paymentRequired = true;
    workflow.paymentReady = true;
    workflow.canCreatePayment = false;
    workflow.targetDetection.fastbootSerial = "SERIAL123";
    workflow.targetDetection.fastbootProduct = "dada";
    workflow.targetDetection.source = "fastboot";
    workflow.targetDetection.verified = true;
    workflow.statuses = {
      preflight: "done",
      "connect-device": "done",
      "prepare-assets": "pending",
      "flash-ftd": "pending",
      "unlock-payload": "pending",
      "restore-gpt": "pending",
      finished: "pending",
    };
    workflow.phaseProvenance = {};
    workflow.overrideGatePolicy = { mode: "none", bypassedGates: [] };
  });

  it("shows Unlock Xiaomi amber product framing and keeps EDL_Standard hidden by default", () => {
    render(<App />);

    expect(screen.getAllByText(/Unlock Xiaomi/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Chi phí rõ ràng/i)).toBeInTheDocument();
    expect(screen.getByText(/Trình duyệt sẵn sàng/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kiểm tra máy ngay/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mở nhật ký/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Quy trình/i }).some((link) => link.getAttribute("href") === "#quy-trinh")).toBe(true);
    expect(screen.getByText(/Mở khóa Xiaomi theo từng bước rõ ràng/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Lưu ý trước khi mở khóa Xiaomi/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Standard$/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /EDL_Standard/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Xiaomi 17/i)).toBeInTheDocument();
    expect(screen.getAllByText(/1 legacy FTD · 1 EFISP Gen 5/i).length).toBeGreaterThan(0);
  });

  it("keeps Developer Override V2 locked without a backend session", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));

    await waitFor(() => expect(developerOverrideApi.getDeveloperOverrideStatus).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Panel đang khóa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Master key/i)).toHaveAttribute("type", "password");
    expect(screen.queryByRole("button", { name: /Apply override/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Áp dụng ghi đè/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mô phỏng blazer/i })).not.toBeInTheDocument();
    expect(workflow.applyDeveloperOverride).not.toHaveBeenCalled();
    expect(workflow.applyDeveloperOverrideSession).not.toHaveBeenCalled();
    expect(workflow.startBlazerMock).not.toHaveBeenCalled();
  });

  it("opens only the session shell after backend override login succeeds", async () => {
    const enteredKey = `runtime-${Math.random().toString(36).slice(2)}`;
    developerOverrideApi.loginDeveloperOverride.mockResolvedValueOnce({ session: activeOverrideSession() });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));
    fireEvent.change(screen.getByLabelText(/Master key/i), { target: { value: enteredKey } });
    fireEvent.click(screen.getByRole("button", { name: /Mở Developer Override/i }));

    await waitFor(() => expect(developerOverrideApi.loginDeveloperOverride).toHaveBeenCalledWith(enteredKey));
    await waitFor(() => expect(screen.getByText(/Phiên override hợp lệ/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/Override mode/i)).toHaveValue("resume");
    expect(screen.getByText(/Bypass gates/i)).toBeInTheDocument();
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
    expect(screen.getByText(/manually assumed/i)).toBeInTheDocument();
    expect(screen.getByText(/bypassed/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Master key/i)).not.toBeInTheDocument();
    expect(workflow.applyDeveloperOverride).not.toHaveBeenCalled();
  });

  it("applies Resume with selected workflow model and phase through the locked session", async () => {
    developerOverrideApi.loginDeveloperOverride.mockResolvedValueOnce({ session: activeOverrideSession() });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));
    fireEvent.change(screen.getByLabelText(/Master key/i), { target: { value: `runtime-${Math.random().toString(36).slice(2)}` } });
    fireEvent.click(screen.getByRole("button", { name: /Developer Override$/i }));

    await waitFor(() => expect(screen.getByLabelText(/Override mode/i)).toHaveValue("resume"));
    fireEvent.change(screen.getByLabelText(/Resume phase/i), { target: { value: "flash-ftd" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply override/i }));

    expect(workflow.applyDeveloperOverrideSession).toHaveBeenCalledWith({
      mode: "resume",
      workflowMode: "standard",
      modelId: "xiaomi15",
      phase: "flash-ftd",
      bypassedGates: [],
    });
    await waitFor(() =>
      expect(developerOverrideApi.auditDeveloperOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "phase_select",
          mode: "resume",
          workflowMode: "standard",
          modelId: "xiaomi15",
          phase: "flash-ftd",
          bypassedGates: [],
          commandType: "session",
          result: "ok",
        }),
      ),
    );
  });

  it("applies Selective Bypass with only the checked gates", async () => {
    developerOverrideApi.loginDeveloperOverride.mockResolvedValueOnce({ session: activeOverrideSession() });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));
    fireEvent.change(screen.getByLabelText(/Master key/i), { target: { value: `runtime-${Math.random().toString(36).slice(2)}` } });
    fireEvent.click(screen.getByRole("button", { name: /Developer Override$/i }));

    await waitFor(() => expect(screen.getByLabelText(/Override mode/i)).toHaveValue("resume"));
    fireEvent.change(screen.getByLabelText(/Override mode/i), { target: { value: "selective_bypass" } });
    fireEvent.click(screen.getByLabelText(/^Payment$/i));
    fireEvent.click(screen.getByLabelText(/^Antirollback$/i));
    fireEvent.change(screen.getByLabelText(/^Model$/i), { target: { value: "xiaomi17" } });
    fireEvent.change(screen.getByLabelText(/Resume phase/i), { target: { value: "write-efisp" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply override/i }));

    expect(workflow.applyDeveloperOverrideSession).toHaveBeenCalledWith({
      mode: "selective_bypass",
      workflowMode: "standard",
      modelId: "xiaomi17",
      phase: "write-efisp",
      bypassedGates: ["payment", "antirollback"],
    });
    await waitFor(() =>
      expect(developerOverrideApi.auditDeveloperOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "phase_select",
          mode: "selective_bypass",
          modelId: "xiaomi17",
          phase: "write-efisp",
          bypassedGates: ["payment", "antirollback"],
          result: "bypassed",
        }),
      ),
    );
  });

  it("applies Full Override for a legacy Standard phase with every gate bypassed", async () => {
    developerOverrideApi.loginDeveloperOverride.mockResolvedValueOnce({ session: activeOverrideSession() });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));
    fireEvent.change(screen.getByLabelText(/Master key/i), { target: { value: `runtime-${Math.random().toString(36).slice(2)}` } });
    fireEvent.click(screen.getByRole("button", { name: /Developer Override$/i }));

    await waitFor(() => expect(screen.getByLabelText(/Override mode/i)).toHaveValue("resume"));
    fireEvent.change(screen.getByLabelText(/Override mode/i), { target: { value: "full_override" } });

    expect(screen.getByRole("button", { name: /Apply override/i })).toBeEnabled();
    expect(screen.getByLabelText(/Payment/i)).toBeChecked();
    fireEvent.change(screen.getByLabelText(/Resume phase/i), { target: { value: "flash-ftd" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply override/i }));

    expect(workflow.applyDeveloperOverrideSession).toHaveBeenCalledWith({
      mode: "full_override",
      workflowMode: "standard",
      modelId: "xiaomi15",
      phase: "flash-ftd",
      bypassedGates: overrideGateIds,
    });
    await waitFor(() =>
      expect(developerOverrideApi.auditDeveloperOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "phase_select",
          mode: "full_override",
          workflowMode: "standard",
          modelId: "xiaomi15",
          phase: "flash-ftd",
          bypassedGates: overrideGateIds,
          commandType: "session",
          result: "bypassed",
        }),
      ),
    );
  });

  it("applies Full Override for EFISP phases while forcing Standard workflow mode", async () => {
    developerOverrideApi.loginDeveloperOverride.mockResolvedValueOnce({ session: activeOverrideSession() });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));
    fireEvent.change(screen.getByLabelText(/Master key/i), { target: { value: `runtime-${Math.random().toString(36).slice(2)}` } });
    fireEvent.click(screen.getByRole("button", { name: /Developer Override$/i }));

    await waitFor(() => expect(screen.getByLabelText(/Override mode/i)).toHaveValue("resume"));
    fireEvent.change(screen.getByLabelText(/Override mode/i), { target: { value: "full_override" } });
    fireEvent.change(screen.getByLabelText(/^Model$/i), { target: { value: "xiaomi17" } });
    fireEvent.change(screen.getByLabelText(/Resume phase/i), { target: { value: "write-efisp" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply override/i }));

    expect(workflow.applyDeveloperOverrideSession).toHaveBeenCalledWith({
      mode: "full_override",
      workflowMode: "standard",
      modelId: "xiaomi17",
      phase: "write-efisp",
      bypassedGates: overrideGateIds,
    });
    await waitFor(() =>
      expect(developerOverrideApi.auditDeveloperOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "phase_select",
          mode: "full_override",
          workflowMode: "standard",
          modelId: "xiaomi17",
          phase: "write-efisp",
          bypassedGates: overrideGateIds,
          result: "bypassed",
        }),
      ),
    );
  });

  it("applies Full Override for advanced EDL_Standard without adding an EDL command surface", async () => {
    workflow.showAdvancedEdl = true;
    developerOverrideApi.loginDeveloperOverride.mockResolvedValueOnce({ session: activeOverrideSession() });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));
    fireEvent.change(screen.getByLabelText(/Master key/i), { target: { value: `runtime-${Math.random().toString(36).slice(2)}` } });
    fireEvent.click(screen.getByRole("button", { name: /Developer Override$/i }));

    await waitFor(() => expect(screen.getByLabelText(/Override mode/i)).toHaveValue("resume"));
    fireEvent.change(screen.getByLabelText(/Override mode/i), { target: { value: "full_override" } });
    fireEvent.change(screen.getByLabelText(/^Workflow$/i), { target: { value: "edl-standard" } });
    fireEvent.change(screen.getByLabelText(/Resume phase/i), { target: { value: "flash-ftd" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply override/i }));

    expect(workflow.applyDeveloperOverrideSession).toHaveBeenCalledWith({
      mode: "full_override",
      workflowMode: "edl-standard",
      modelId: "xiaomi15",
      phase: "flash-ftd",
      bypassedGates: overrideGateIds,
    });
    expect(screen.queryByText(/EDL terminal|raw EDL|BrowserEdlClient/i)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(developerOverrideApi.auditDeveloperOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "phase_select",
          mode: "full_override",
          workflowMode: "edl-standard",
          modelId: "xiaomi15",
          phase: "flash-ftd",
          bypassedGates: overrideGateIds,
          result: "bypassed",
        }),
      ),
    );
  });

  it("audits mode and gate shell changes without applying runner override", async () => {
    developerOverrideApi.loginDeveloperOverride.mockResolvedValueOnce({ session: activeOverrideSession() });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));
    fireEvent.change(screen.getByLabelText(/Master key/i), { target: { value: `runtime-${Math.random().toString(36).slice(2)}` } });
    fireEvent.click(screen.getByRole("button", { name: /Mở Developer Override/i }));

    await waitFor(() => expect(screen.getByLabelText(/Override mode/i)).toHaveValue("resume"));
    fireEvent.change(screen.getByLabelText(/Override mode/i), { target: { value: "selective_bypass" } });

    await waitFor(() =>
      expect(developerOverrideApi.auditDeveloperOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "mode_change",
          mode: "selective_bypass",
          bypassedGates: [],
          commandType: "session",
          result: "ok",
        }),
      ),
    );

    fireEvent.click(screen.getByLabelText(/^Payment$/i));

    await waitFor(() =>
      expect(developerOverrideApi.auditDeveloperOverride).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "gate_policy",
          mode: "selective_bypass",
          bypassedGates: ["payment"],
          commandType: "session",
          result: "ok",
        }),
      ),
    );
    expect(workflow.applyDeveloperOverride).not.toHaveBeenCalled();
  });

  it("locks the panel on logout and local session expiry", async () => {
    developerOverrideApi.loginDeveloperOverride.mockResolvedValueOnce({ session: activeOverrideSession() });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));
    fireEvent.change(screen.getByLabelText(/Master key/i), { target: { value: `runtime-${Math.random().toString(36).slice(2)}` } });
    fireEvent.click(screen.getByRole("button", { name: /Mở Developer Override/i }));

    await waitFor(() => expect(screen.getByText(/Phiên override hợp lệ/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Override mode/i), { target: { value: "full_override" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply override/i }));
    expect(workflow.applyDeveloperOverrideSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "full_override",
        bypassedGates: overrideGateIds,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Khóa override/i }));

    await waitFor(() => expect(developerOverrideApi.logoutDeveloperOverride).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/Panel đang khóa/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/Master key/i)).toBeInTheDocument();
    expect(workflow.clearDeveloperOverride).toHaveBeenCalled();

    cleanup();
    workflow.clearDeveloperOverride.mockClear();
    developerOverrideApi.loginDeveloperOverride.mockResolvedValueOnce({ session: activeOverrideSession(900) });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Developer Override V2/i }));
    fireEvent.change(screen.getByLabelText(/Master key/i), { target: { value: `runtime-${Math.random().toString(36).slice(2)}` } });
    fireEvent.click(screen.getByRole("button", { name: /Mở Developer Override/i }));

    await waitFor(() => expect(screen.getByText(/Phiên override hợp lệ/i)).toBeInTheDocument());
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1100));
    });
    expect(screen.getByText(/Phiên override đã hết hạn/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Master key/i)).toBeInTheDocument();
    expect(workflow.clearDeveloperOverride).toHaveBeenCalled();
  });

  it("shows EDL_Standard only when the advanced flag is active", () => {
    workflow.showAdvancedEdl = true;

    render(<App />);

    expect(screen.getByRole("button", { name: /^Standard$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /EDL_Standard/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /EDL_Standard/i }));

    expect(setWorkflowMode).toHaveBeenCalledWith("edl-standard");
  });

  it("shows the manual EDL note for EDL_Standard flash FTD", () => {
    workflow.showAdvancedEdl = true;
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

  it("shows the K80 Pro post-ABL alias while keeping FTD out of the phase rail", () => {
    workflow.model.id = "redmi-k80pro";
    workflow.model.name = "Redmi K80 Pro";
    workflow.model.product = "miro";
    workflow.model.ftdPackage = "packages/redmi-k80pro";
    Object.assign(workflow.model, { postAblFastbootAliases: ["dada"] });
    workflow.detectedProduct = "miro";
    workflow.visiblePhaseOrder = [
      "preflight",
      "connect-device",
      "prepare-assets",
      "boot-permissive",
      "write-abl",
      "unlock-payload",
      "restore-gpt",
      "verify-unlock",
      "finished",
    ];
    workflow.statuses = {
      ...workflow.statuses,
      "boot-permissive": "pending",
      "write-abl": "pending",
      "verify-unlock": "pending",
    };
    workflow.targetDetection.adbProduct = "miro";
    workflow.targetDetection.fastbootProduct = "miro";
    workflow.compatibilityReport = {
      modelId: "redmi-k80pro",
      modelName: "Redmi K80 Pro",
      product: "miro",
      chip: "8E",
      verdict: "compatible",
      warnings: [],
      adb: {
        productProps: {
          "ro.product.device": "miro",
          "ro.product.vendor.device": "miro",
          "ro.build.product": "miro",
        },
        androidRelease: "15",
        securityPatch: "2025-01-01",
        hyperOsVersionName: "OS2.0",
      },
      fastboot: {
        product: "dada",
        serial: "SERIAL123",
        anti: "0",
        verifiedWithAdb: true,
        productMatch: "post-abl-alias",
        canonicalProduct: "miro",
      },
    };
    workflow.paymentTarget = {
      modelId: "redmi-k80pro",
      modelName: "Redmi K80 Pro",
      product: "miro",
      serial: "SERIAL123",
    };

    render(<App />);

    expect(screen.getByText(/Alias sau ABL -> miro/i)).toBeInTheDocument();
    expect(
      screen.getAllByText((_, node) =>
        Boolean(node?.textContent?.includes("Fastboot đang trả dada") && node.textContent.includes("App sẽ không flash FTD")),
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Chay payload mo khoa").length).toBeGreaterThan(0);
    expect(screen.queryByText("Flash goi FTD")).not.toBeInTheDocument();
  });

  it("shows the EFISP family phase rail after runtime detection", () => {
    workflow.model.family = "efisp-8e-gen5";
    workflow.model.id = "xiaomi17";
    workflow.model.name = "Xiaomi 17";
    workflow.model.product = "pudding";
    workflow.visiblePhaseOrder = [
      "preflight",
      "connect-device",
      "prepare-assets",
      "boot-permissive",
      "write-efisp",
      "verify-unlock",
      "cleanup-data",
      "finished",
    ];
    workflow.statuses = {
      ...workflow.statuses,
      "boot-permissive": "pending",
      "write-efisp": "pending",
      "verify-unlock": "pending",
      "cleanup-data": "pending",
    };

    render(<App />);

    expect(screen.getAllByText(/EFISP 8E Gen 5/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Boot Android permissive").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ghi EFI unlock qua MQSAS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Xac minh bootloader").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Don EFISP va du lieu").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /EDL_Standard/i })).not.toBeInTheDocument();
  });

  it("shows fastboot serial in the device card", () => {
    render(<App />);

    expect(screen.getAllByText("Serial").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SERIAL123").length).toBeGreaterThan(0);
  });

  it("shows the payOS payment gate before pass readiness", () => {
    workflow.paymentReady = false;
    workflow.canRun = false;
    workflow.canCreatePayment = true;

    render(<App />);

    expect(screen.getByText("Thanh toán unlock pass")).toBeInTheDocument();
    expect(screen.getByText("10.000 VND")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tai va kiem tra ROM FTD/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Tạo đơn payOS/i }));

    expect(createUnlockPayment).toHaveBeenCalledTimes(1);
  });

  it("creates a donation QR without touching unlock payment readiness", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          donation: {
            id: "donation-1",
            orderCode: 654321,
            status: "pending",
            amount: 50000,
            currency: "VND",
            checkoutUrl: "https://pay.payos.vn/donate",
            qrCode: "vietqr-payload",
            provider: "payos",
            providerPaymentLinkId: "link-1",
            createdAt: "2026-06-21T00:00:00.000Z",
            expiresAt: "2026-06-21T00:10:00.000Z",
            updatedAt: "2026-06-21T00:00:00.000Z",
          },
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(screen.getAllByText(/Ủng hộ dự án/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Tạo QR ủng hộ/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/donations", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(screen.getByAltText(/QR ủng hộ/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Mở checkout dự phòng/i })).toHaveAttribute("href", "https://pay.payos.vn/donate");
    expect(createUnlockPayment).not.toHaveBeenCalled();
  });

  it("shows compatibility details and requires acknowledging version warnings", () => {
    workflow.nextPhase = "flash-ftd";
    workflow.requiresConfirmation = true;
    workflow.canRun = false;
    workflow.compatibilityReport = {
      ...workflow.compatibilityReport,
      verdict: "warning",
      warnings: ["security patch 2026-03-05 >= 2026-02-01"],
      adb: {
        ...workflow.compatibilityReport.adb,
        securityPatch: "2026-03-05",
      },
      fastboot: {
        ...workflow.compatibilityReport.fastboot,
        anti: "2",
      },
    };

    render(<App />);

    expect(screen.getByText("Phiên bản máy")).toBeInTheDocument();
    expect(screen.getByText("2026-03-05")).toBeInTheDocument();
    expect(screen.getByText("OS2.0")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText(/security patch 2026-03-05/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Tôi đã đọc cảnh báo phiên bản/i));

    expect(setCompatibilityWarningsAccepted).toHaveBeenCalledWith(true);
  });

  it("hides Fastboot entry until ADB has requested verification", () => {
    workflow.nextPhase = "connect-device";
    workflow.statuses = {
      ...workflow.statuses,
      "connect-device": "pending",
    };
    workflow.canConnectEntry = true;

    render(<App />);

    expect(screen.getByRole("button", { name: /Kết nối ADB Android/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác minh Fastboot/i })).not.toBeInTheDocument();

    cleanup();
    workflow.awaitingFastbootVerification = true;
    workflow.canConnectFastbootEntry = true;

    render(<App />);

    expect(screen.getByRole("button", { name: /Xác minh Fastboot/i })).toBeInTheDocument();
  });

  it("uses fastboot devices as the terminal helper", () => {
    render(<App />);

    const input = screen.getByPlaceholderText("fastboot devices");
    fireEvent.change(input, { target: { value: "fastboot devices" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi lệnh/i }));

    expect(runFastbootTerminalCommand).toHaveBeenCalledWith("fastboot devices");
  });
});
