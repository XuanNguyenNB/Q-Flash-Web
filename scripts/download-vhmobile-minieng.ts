import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { parseFlashAllBat } from "../src/domain/flashPlanParser";
import { type FlashPlan, flashPlanSchema } from "../src/domain/schemas";
import {
  defaultVhmobileMiniEngRoot,
  type VhmobileMiniEngEntry,
  vhmobileAvailableMiniEngEntries,
  vhmobileMiniEngEntries,
  vhmobileMissingMiniEngEntries,
} from "./vhmobile-minieng-manifest";
import { loadScriptEnv } from "./script-env";

loadScriptEnv();

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const defaultUnrarPath =
  process.env.UNRAR_PATH ?? path.resolve(projectRoot, "..", "auto-unlock-standalone", "assets", "UnRAR.exe");
const defaultSevenZipPath = process.env.SEVEN_ZIP_PATH ?? "C:\\Program Files\\7-Zip\\7z.exe";
const defaultArchivePasswords = (process.env.VHMOBILE_ARCHIVE_PASSWORDS ?? "123456789aa,168duongvanbe")
  .split(/[;,]/)
  .map((password) => password.trim())
  .filter(Boolean);

type CliOptions = {
  outRoot: string;
  lockPath: string;
  unrarPath: string;
  sevenZipPath: string;
  archivePasswords: string[];
  dryRun: boolean;
  auditOnly: boolean;
  skipExtract: boolean;
};

type LockEntry = {
  chip: string;
  modelId: string;
  modelName: string;
  codename: string;
  status: VhmobileMiniEngEntry["status"];
  archiveName?: string;
  url?: string;
  expectedSize?: number;
  size?: number;
  sha256?: string;
  flashFileCount?: number;
  auditedAt?: string;
};

type LockFile = {
  version: 1;
  generatedAt: string;
  source: string;
  entries: Record<string, LockEntry>;
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    outRoot: path.resolve(process.env.VHMOBILE_MINIENG_ROOT ?? defaultVhmobileMiniEngRoot),
    lockPath: "",
    unrarPath: defaultUnrarPath,
    sevenZipPath: defaultSevenZipPath,
    archivePasswords: defaultArchivePasswords,
    dryRun: false,
    auditOnly: false,
    skipExtract: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--out" && next) {
      options.outRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--lock" && next) {
      options.lockPath = path.resolve(next);
      index += 1;
    } else if (arg === "--unrar" && next) {
      options.unrarPath = path.resolve(next);
      index += 1;
    } else if (arg === "--7z" && next) {
      options.sevenZipPath = path.resolve(next);
      index += 1;
    } else if (arg === "--password" && next) {
      options.archivePasswords.push(next);
      index += 1;
    } else if (arg === "--passwords" && next) {
      options.archivePasswords = next
        .split(/[;,]/)
        .map((password) => password.trim())
        .filter(Boolean);
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--audit-only") {
      options.auditOnly = true;
    } else if (arg === "--skip-extract") {
      options.skipExtract = true;
    }
  }

  if (!options.lockPath) {
    options.lockPath = path.join(options.outRoot, "vhmobile-minieng.lock.json");
  }

  return options;
};

const isFile = async (filePath: string) => {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
};

const sha256File = async (filePath: string) => {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
};

const fileSize = async (filePath: string) => (await stat(filePath)).size;

const loadExistingLock = async (lockPath: string): Promise<LockFile | undefined> => {
  if (!(await isFile(lockPath))) {
    return undefined;
  }

  return JSON.parse(await readFile(lockPath, "utf8")) as LockFile;
};

const findFlashAll = async (packageDir: string, depth = 0): Promise<string> => {
  const direct = path.join(packageDir, "flash_all.bat");

  if (await isFile(direct)) {
    return direct;
  }

  const entries = await readdir(packageDir, { withFileTypes: true });
  const fallbackFlashAll = entries.find(
    (entry) => entry.isFile() && /^flash_all[_-].*\.bat$/i.test(entry.name),
  );

  if (fallbackFlashAll) {
    return path.join(packageDir, fallbackFlashAll.name);
  }

  if (depth >= 3) {
    throw new Error(`Cannot find flash_all.bat in ${packageDir}`);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      return await findFlashAll(path.join(packageDir, entry.name), depth + 1);
    } catch {
      // Keep searching.
    }
  }

  throw new Error(`Cannot find flash_all.bat in ${packageDir}`);
};

const runExtractorAttempt = async (
  command: string,
  args: string[],
  extractRoot: string,
  passwordLabel: string,
) => {
  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });
  await execFileAsync(command, args, {
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${passwordLabel}: ${message}`);
  });
};

const extractArchive = async (
  archivePath: string,
  extractRoot: string,
  unrarPath: string,
  sevenZipPath: string,
  archivePasswords: readonly string[],
) => {
  const extension = path.extname(archivePath).toLowerCase();
  const passwords = archivePasswords.length > 0 ? archivePasswords : [""];
  const errors: string[] = [];

  if (extension === ".rar") {
    if (await isFile(unrarPath)) {
      for (const password of passwords) {
        try {
          await runExtractorAttempt(
            unrarPath,
            ["x", "-y", `-p${password}`, archivePath, `${extractRoot}${path.sep}`],
            extractRoot,
            `UnRAR password ${password ? "(provided)" : "(empty)"}`,
          );
          return;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    }

    if (await isFile(sevenZipPath)) {
      for (const password of passwords) {
        try {
          await runExtractorAttempt(
            sevenZipPath,
            ["x", "-y", `-p${password}`, archivePath, `-o${extractRoot}`],
            extractRoot,
            `7-Zip password ${password ? "(provided)" : "(empty)"}`,
          );
          return;
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
    }

    throw new Error(
      `Cannot extract RAR. Tried UnRAR: ${unrarPath}; 7-Zip: ${sevenZipPath}.\n${errors.join("\n")}`,
    );
  }

  if ((extension === ".zip" || extension === ".7z") && (await isFile(sevenZipPath))) {
    for (const password of passwords) {
      try {
        await runExtractorAttempt(
          sevenZipPath,
          ["x", "-y", `-p${password}`, archivePath, `-o${extractRoot}`],
          extractRoot,
          `7-Zip password ${password ? "(provided)" : "(empty)"}`,
        );
        return;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (extension === ".zip" || extension === ".7z") {
    await runExtractorAttempt("tar", ["-xf", archivePath, "-C", extractRoot], extractRoot, "tar");
    return;
  }

  throw new Error(`Unsupported archive type: ${archivePath}`);
};

const assertPlanFilesExist = async (plan: FlashPlan, packageRoot: string) => {
  const missing: string[] = [];

  if (plan.antiRollbackFile && !(await isFile(path.join(packageRoot, plan.antiRollbackFile)))) {
    missing.push(plan.antiRollbackFile);
  }

  for (const operation of plan.operations) {
    if (operation.type !== "flash") {
      continue;
    }

    if (!(await isFile(path.join(packageRoot, operation.file)))) {
      missing.push(operation.file);
    }
  }

  return missing;
};

const auditArchive = async (
  entry: VhmobileMiniEngEntry,
  archivePath: string,
  tempRoot: string,
  unrarPath: string,
  sevenZipPath: string,
  archivePasswords: readonly string[],
) => {
  const extractRoot = path.join(tempRoot, entry.modelId);
  await extractArchive(archivePath, extractRoot, unrarPath, sevenZipPath, archivePasswords);

  const flashAll = await findFlashAll(extractRoot);
  const packageRoot = path.dirname(flashAll);
  const imagesDir = path.join(packageRoot, "images");
  const plan = flashPlanSchema.parse(
    parseFlashAllBat(await readFile(flashAll, "utf8"), {
      modelId: entry.modelId,
      product: entry.codename,
      hasAntiRollbackFile: await isFile(path.join(imagesDir, "anti_version.txt")),
    }),
  );
  const missingFiles = await assertPlanFilesExist(plan, packageRoot);

  if (plan.product.toLowerCase() !== entry.codename.toLowerCase()) {
    throw new Error(`Plan product ${plan.product} does not match ${entry.codename} for ${entry.modelId}`);
  }

  if (missingFiles.length > 0) {
    throw new Error(`Archive ${entry.archiveName} references missing files: ${missingFiles.join(", ")}`);
  }

  return plan.operations.filter((operation) => operation.type === "flash").length;
};

const headEntry = async (entry: VhmobileMiniEngEntry) => {
  if (!entry.url) {
    return undefined;
  }

  const response = await fetch(entry.url, { method: "HEAD" });
  return {
    status: response.status,
    contentLength: response.headers.get("content-length"),
    contentType: response.headers.get("content-type"),
  };
};

const downloadEntry = async (entry: VhmobileMiniEngEntry, destPath: string) => {
  if (!entry.url) {
    throw new Error(`Missing URL for ${entry.modelId}`);
  }

  const response = await fetch(entry.url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading ${entry.url}`);
  }

  const tmpPath = `${destPath}.tmp`;
  try {
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(tmpPath, bytes);
    await rename(tmpPath, destPath);
  } catch (error) {
    await unlink(tmpPath).catch(() => undefined);
    throw error;
  }
};

const assertMiniArchiveName = (entry: VhmobileMiniEngEntry) => {
  if (!entry.archiveName || !/mini[_-]?eng|minieng|mineng/i.test(entry.archiveName)) {
    throw new Error(`Archive for ${entry.modelId} is not mini ENG: ${entry.archiveName ?? "(missing)"}`);
  }
};

const main = async () => {
  const options = parseArgs();
  const availableCount = vhmobileAvailableMiniEngEntries.length;
  const missingCount = vhmobileMissingMiniEngEntries.length;

  console.log(`VHMOBILE mini ENG manifest: ${availableCount} available, ${missingCount} missing-mini-eng.`);

  if (options.dryRun) {
    for (const entry of vhmobileMiniEngEntries) {
      if (entry.status === "missing-mini-eng") {
        console.log(`  - missing ${entry.codename} (${entry.modelId})`);
        continue;
      }

      assertMiniArchiveName(entry);
      const head = await headEntry(entry);
      console.log(
        `  + available ${entry.codename} (${entry.modelId}) ${entry.archiveName} ` +
          `expected=${entry.expectedSize} head=${head?.status ?? "n/a"} length=${head?.contentLength ?? "n/a"}`,
      );
    }
    return;
  }

  await mkdir(options.outRoot, { recursive: true });
  const existingLock = await loadExistingLock(options.lockPath);
  const lock: LockFile = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "https://vhmobile.io.vn/FIRMWARE/Xiaomi/",
    entries: {},
  };
  const tempRoot = await mkdtemp(path.join(tmpdir(), "vhmobile-minieng-"));

  try {
    for (const entry of vhmobileMiniEngEntries) {
      if (entry.status === "missing-mini-eng") {
        lock.entries[entry.modelId] = {
          chip: entry.chip,
          modelId: entry.modelId,
          modelName: entry.modelName,
          codename: entry.codename,
          status: entry.status,
        };
        console.log(`  - missing ${entry.codename} (${entry.modelId})`);
        continue;
      }

      assertMiniArchiveName(entry);

      if (!entry.archiveName || !entry.expectedSize) {
        throw new Error(`Incomplete available entry for ${entry.modelId}`);
      }

      const archivePath = path.join(options.outRoot, entry.archiveName);
      const hasArchive = await isFile(archivePath);
      const currentSize = hasArchive ? await fileSize(archivePath) : undefined;

      if (options.auditOnly) {
        if (!hasArchive) {
          throw new Error(`Missing local archive for audit: ${archivePath}`);
        }
      } else if (!hasArchive || currentSize !== entry.expectedSize) {
        console.log(`  ↓ downloading ${entry.codename} (${entry.archiveName})`);
        await downloadEntry(entry, archivePath);
      } else {
        console.log(`  = skip download ${entry.codename} (${entry.archiveName}), size OK`);
      }

      const size = await fileSize(archivePath);
      if (size !== entry.expectedSize) {
        throw new Error(`Size mismatch for ${entry.archiveName}: expected ${entry.expectedSize}, got ${size}`);
      }

      const sha256 = await sha256File(archivePath);
      const previous = existingLock?.entries[entry.modelId];

      if (previous?.sha256 && previous.archiveName === entry.archiveName && previous.sha256 !== sha256) {
        throw new Error(
          `SHA-256 changed for ${entry.modelId}/${entry.archiveName}: previous ${previous.sha256}, current ${sha256}`,
        );
      }

      let flashFileCount: number | undefined;
      if (!options.skipExtract) {
        flashFileCount = await auditArchive(
          entry,
          archivePath,
          tempRoot,
          options.unrarPath,
          options.sevenZipPath,
          options.archivePasswords,
        );
      }

      lock.entries[entry.modelId] = {
        chip: entry.chip,
        modelId: entry.modelId,
        modelName: entry.modelName,
        codename: entry.codename,
        status: entry.status,
        archiveName: entry.archiveName,
        url: entry.url,
        expectedSize: entry.expectedSize,
        size,
        sha256,
        flashFileCount,
        auditedAt: new Date().toISOString(),
      };
      console.log(
        `  + OK ${entry.codename} (${entry.modelId}) ${entry.archiveName} ` +
          `sha256=${sha256.slice(0, 16)} files=${flashFileCount ?? "skipped"}`,
      );
    }

    await writeFile(options.lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`Wrote ${options.lockPath}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
