import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { parseFlashAllBat } from "./flashPlanParser";
import { v1ModelSources } from "./models";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workspaceRoot = path.resolve(projectRoot, "..");
const sourceRoot = path.join(workspaceRoot, "Unlock_8E_Xiaomi", "Unlock_8E_Xiaomi", "Goi_ha_cap");
const unrarPath = path.join(workspaceRoot, "auto-unlock-standalone", "assets", "UnRAR.exe");
const tempRoot = mkdtempSync(path.join(tmpdir(), "flash-plan-test-"));

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

const isFile = (filePath: string) => {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const findFlashAll = (packageDir: string, depth = 0): string | undefined => {
  const direct = path.join(packageDir, "flash_all.bat");

  if (isFile(direct)) {
    return direct;
  }

  if (depth >= 2 || !existsSync(packageDir)) {
    return undefined;
  }

  for (const entry of readdirSync(packageDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const match = findFlashAll(path.join(packageDir, entry.name), depth + 1);

    if (match) {
      return match;
    }
  }

  return undefined;
};

const archiveCandidatesFor = (localPackageDir: string) => {
  const firstPathPart = localPackageDir.split(/[\\/]+/)[0];
  const candidates = [firstPathPart ? `${firstPathPart}.rar` : undefined, `${path.basename(localPackageDir)}.rar`];

  if (firstPathPart?.startsWith("Xiaomi15主板")) {
    candidates.push("Xiaomi15.rar");
  }

  if (firstPathPart?.startsWith("Xiaomi15Pro")) {
    candidates.push("Xiaomi15Pro.rar");
  }

  return [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate)))];
};

const extractArchiveFor = (localPackageDir: string) => {
  if (!isFile(unrarPath)) {
    throw new Error(`Missing UnRAR.exe at ${unrarPath}`);
  }

  const archive = archiveCandidatesFor(localPackageDir)
    .map((candidate) => path.join(sourceRoot, candidate))
    .find((candidate) => isFile(candidate));

  if (!archive) {
    throw new Error(`Missing archive for ${localPackageDir}`);
  }

  const extractRoot = path.join(tempRoot, Buffer.from(localPackageDir).toString("hex").slice(0, 24));
  rmSync(extractRoot, { recursive: true, force: true });
  execFileSync(unrarPath, ["x", "-y", archive, `${extractRoot}${path.sep}`], {
    stdio: "ignore",
    windowsHide: true,
  });
  return extractRoot;
};

const flashAllFor = (localPackageDir: string) => {
  const localPackage = path.join(sourceRoot, localPackageDir);
  const localFlashAll = findFlashAll(localPackage);

  if (localFlashAll) {
    return readFileSync(localFlashAll, "utf8");
  }

  const extractedFlashAll = findFlashAll(extractArchiveFor(localPackageDir));

  if (!extractedFlashAll) {
    throw new Error(`Cannot find flash_all.bat for ${localPackageDir}`);
  }

  return readFileSync(extractedFlashAll, "utf8");
};

describe("flash_all.bat parser", () => {
  it("parses all v1 downgrade packages into ordered flash plans", () => {
    for (const model of v1ModelSources) {
      const plan = parseFlashAllBat(flashAllFor(model.localPackageDir), {
        modelId: model.id,
        product: model.product,
        hasAntiRollbackFile: true,
      });

      expect(plan.modelId).toBe(model.id);
      expect(plan.product).toBe(model.product);
      expect(plan.antiRollbackFile).toBe("images/anti_version.txt");
      expect(plan.operations.length).toBeGreaterThan(45);
      expect(plan.operations.at(-1)).toEqual({ type: "reboot", target: undefined });
      expect(plan.operations.filter((operation) => operation.type === "flash").length).toBeGreaterThan(35);
    }
  });

  it("keeps product checks when present and does not invent one for K80 Pro", () => {
    const xiaomi15 = v1ModelSources.find((model) => model.id === "xiaomi15");
    const k80Pro = v1ModelSources.find((model) => model.id === "redmi-k80pro");

    expect(xiaomi15).toBeDefined();
    expect(k80Pro).toBeDefined();

    const xiaomi15Plan = parseFlashAllBat(flashAllFor(xiaomi15!.localPackageDir), {
      modelId: xiaomi15!.id,
      product: xiaomi15!.product,
    });
    const k80Plan = parseFlashAllBat(flashAllFor(k80Pro!.localPackageDir), {
      modelId: k80Pro!.id,
      product: k80Pro!.product,
    });

    expect(xiaomi15Plan.operations[0]).toEqual({ type: "getvar", name: "product", expect: "dada" });
    expect(k80Plan.operations.some((operation) => operation.type === "getvar" && operation.name === "product")).toBe(false);
  });

  it("normalizes flash file paths", () => {
    const model = v1ModelSources.find((entry) => entry.id === "xiaomi15ultra")!;
    const plan = parseFlashAllBat(flashAllFor(model.localPackageDir), {
      modelId: model.id,
      product: model.product,
    });
    const flash = plan.operations.find((operation) => operation.type === "flash");

    expect(flash).toMatchObject({ type: "flash", file: "images/abl.elf" });
  });
});
