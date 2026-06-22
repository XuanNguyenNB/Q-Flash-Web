import { execFile } from "node:child_process";
import { createCipheriv, createHash, createPrivateKey, type KeyObject, randomBytes, sign } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { parseFlashAllBat } from "../src/domain/flashPlanParser";
import { efisp8eUnlockFile, v1LegacyModelSources, v1ManifestModels } from "../src/domain/models";
import { flashPlanSchema, manifestSchema, type Sha256Sums } from "../src/domain/schemas";
import { loadScriptEnv } from "./script-env";
import {
  defaultVhmobileMiniEngRoot as defaultVhmobileMiniEngRootFromManifest,
  vhmobileMiniEngByModelId,
} from "./vhmobile-minieng-manifest";

loadScriptEnv();

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const defaultFirmwareSourceRoot = path.join(projectRoot, "firmware-source");
const defaultOutRoot = path.join(projectRoot, "dist-assets");
const defaultFtdPackagesRoot =
  process.env.FTD_PACKAGES_ROOT ?? path.resolve(projectRoot, "..", "Unlock_8E_Xiaomi", "Unlock_8E_Xiaomi", "Goi_ha_cap");
const defaultFtdPackagesFallback =
  process.env.FTD_PACKAGES_FALLBACK ?? "C:\\Users\\XuanNguyen\\Downloads\\minieng";
const defaultVhmobileMiniEngRoot = path.resolve(
  process.env.VHMOBILE_MINIENG_ROOT ?? defaultVhmobileMiniEngRootFromManifest,
);
const defaultFtdPackageExtraRoots = process.env.FTD_PACKAGES_EXTRA_ROOTS
  ? process.env.FTD_PACKAGES_EXTRA_ROOTS.split(path.delimiter).filter(Boolean)
  : [
      "C:\\Users\\XuanNguyen\\Downloads\\github-engrom",
      "C:\\Users\\XuanNguyen\\Downloads\\Mi8e-unlock-windows-auto-release\\unlockFolder\\factoryImages",
      "C:\\Users\\XuanNguyen\\Downloads\\Mi8g3-unlock-highversion-windows-auto-release\\unlockFolder\\factoryImages",
      "C:\\Users\\XuanNguyen\\Downloads\\Mi8sg3orMi7pg3-unlock-windows-auto\\unlockFolder\\factoryImages",
      "C:\\Users\\XuanNguyen\\Downloads\\Mi8sg3orMi7pg3-highversion-unlock-windows-auto\\unlockFolder\\factoryImages",
    ];
const defaultUnrarPath =
  process.env.UNRAR_PATH ?? path.resolve(projectRoot, "..", "auto-unlock-standalone", "assets", "UnRAR.exe");
const defaultSevenZipPath = process.env.SEVEN_ZIP_PATH ?? "C:\\Program Files\\7-Zip\\7z.exe";
const defaultArchivePasswords = (process.env.VHMOBILE_ARCHIVE_PASSWORDS ?? "123456789aa,168duongvanbe")
  .split(/[;,]/)
  .map((password) => password.trim())
  .filter(Boolean);
const expectedEfispUnlockSha256 = "88918dd212fefe9d51c584513cbb7babebf395879d9edc2a02acd4246b5bcf5d";

type ModelSource = (typeof v1LegacyModelSources)[number];

type CliOptions = {
  firmwareSourceRoot: string;
  ftdPackagesRoot: string;
  ftdPackagesFallback: string;
  ftdPackageExtraRoots: string[];
  vhmobileMiniEngRoot: string;
  unrarPath: string;
  sevenZipPath: string;
  archivePasswords: string[];
  outRoot: string;
  clean: boolean;
  skipEncrypted: boolean;
};

type FirmwareKeys = Record<string, { key: string; iv: string }>;

const archiveNamesByModelId: Record<string, string[]> = {
  xiaomi15: ["Mi15_ENG_FIX.zip", "Xiaomi15.rar"],
  xiaomi15pro: ["Mi15Pro_ENG_FIX.7z", "Xiaomi15Pro.rar"],
  xiaomi15ultra: ["小米15ultra降级小包2025.04.08.rar"],
  "redmi-k80pro": ["K80P_ENG_FIX.7z", "Redmi_K80Pro.rar"],
  "redmi-k90": ["红米k90降级小包2026.02.23.rar"],
  "xiaomi-pad8pro": ["小米平板8pro降级小包.rar"],
  xiaomi14: ["Mi14_ENG_FIX.7z"],
  xiaomi14pro: ["Mi14Pro_ENG_FIX.7z"],
  xiaomi14ultra: ["Mi14U_ENG_FIX.7z"],
  "redmi-k70pro": ["K70P_ENG_FIX.7z"],
  "redmi-k80": ["K80_ENG_FIX.7z"],
  xiaomimixfold4: ["MixFold4_ENG_FIX.7z"],
  xiaomimixflip: ["MixFlip_ENG_FIX.zip"],
  xiaomi13: ["Mi13_ENG_FIX.7z"],
  xiaomi13pro: ["Mi13Pro_ENG_FIX.7z"],
  xiaomi13ultra: ["Mi13U_ENG_FIX.7z"],
  "redmi-k60pro": ["K60P_ENG_FIX.zip"],
  "redmi-k70": ["K70_6SPro_ENG_FIX.zip"],
  "xiaomi-pad6spro": ["PAD6SPRO_abl.7z", "K70_6SPro_ENG_FIX.zip"],
  "xiaomi-civi4pro": ["civi4pro_minieng.rar"],
  "redmi-turbo4pro": ["turbo4pro_minieng.rar"],
};

archiveNamesByModelId.xiaomi15ultra.unshift("Mi15U_ENG_FIX.7z");
archiveNamesByModelId["redmi-k90"].unshift("K90_ENG_FIX.7z");
archiveNamesByModelId["xiaomi-pad8pro"].unshift("Pad8Pro_UBL_Fix_table.7z");

const packageDirectoryNamesByModelId: Record<string, string[]> = {
  xiaomi15: ["Xiaomi15"],
  xiaomi15pro: ["Xiaomi15pro"],
  xiaomi15ultra: ["Xiaomi15ultra"],
  "redmi-k80pro": ["Redmik80pro"],
  "redmi-k90": ["Redmik90"],
  "xiaomi-pad8pro": ["Xiaomipad8pro"],
  xiaomi14: ["Xiaomi14"],
  xiaomi14pro: ["Xiaomi14pro"],
  xiaomi14ultra: ["Xiaomi14ultra"],
  "redmi-k70pro": ["Redmik70pro"],
  "redmi-k80": ["Redmik80"],
  xiaomimixfold4: ["Xiaomimixfold4"],
  xiaomimixflip: ["Xiaomimixflip"],
  "redmi-k60pro": ["Redmik60pro"],
  "xiaomi-pad7pro": ["Xiaomipad7pro"],
  "xiaomi-civi4pro": ["Xiaomicivi4pro"],
  "redmi-turbo3": ["Redmiturbo3"],
  "xiaomi-pad7": ["Xiaomipad7"],
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    firmwareSourceRoot: defaultFirmwareSourceRoot,
    ftdPackagesRoot: defaultFtdPackagesRoot,
    ftdPackagesFallback: defaultFtdPackagesFallback,
    ftdPackageExtraRoots: defaultFtdPackageExtraRoots.map((root) => path.resolve(root)),
    vhmobileMiniEngRoot: defaultVhmobileMiniEngRoot,
    unrarPath: defaultUnrarPath,
    sevenZipPath: defaultSevenZipPath,
    archivePasswords: defaultArchivePasswords,
    outRoot: defaultOutRoot,
    clean: false,
    skipEncrypted: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--firmware-source" && next) {
      options.firmwareSourceRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--ftd-packages-root" && next) {
      options.ftdPackagesRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--ftd-packages-fallback" && next) {
      options.ftdPackagesFallback = path.resolve(next);
      index += 1;
    } else if (arg === "--ftd-packages-extra-root" && next) {
      options.ftdPackageExtraRoots.push(path.resolve(next));
      index += 1;
    } else if (arg === "--vhmobile-minieng-root" && next) {
      options.vhmobileMiniEngRoot = path.resolve(next);
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
    } else if (arg === "--out" && next) {
      options.outRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--clean") {
      options.clean = true;
    } else if (arg === "--skip-encrypted") {
      options.skipEncrypted = true;
    }
  }

  return options;
};

const normalize = (filePath: string) => filePath.split(path.sep).join("/");

const isFile = async (filePath: string) => {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
};

const requireFile = async (filePath: string, label: string) => {
  if (!(await isFile(filePath))) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
};

const sha256File = async (filePath: string) => {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
};

const loadSigningKey = (): KeyObject | undefined => {
  const pem = process.env.ASSET_SIGNING_KEY_PEM;

  if (!pem || !pem.trim()) {
    return undefined;
  }

  const normalized = pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
  const key = createPrivateKey({ key: normalized, format: "pem" });

  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(`ASSET_SIGNING_KEY_PEM must be Ed25519, got ${key.asymmetricKeyType}.`);
  }

  return key;
};

const writeDetachedSignature = async (filePath: string, key: KeyObject | undefined) => {
  if (!key) {
    return;
  }

  const bytes = await readFile(filePath);
  const signature = sign(null, bytes, key);
  await writeFile(`${filePath}.sig`, `${signature.toString("base64")}\n`);
};

const collectSha256 = async (root: string, subdir = ""): Promise<Sha256Sums> => {
  const dir = path.join(root, subdir);
  const entries = await readdir(dir, { withFileTypes: true });
  const sums: Sha256Sums = {};

  for (const entry of entries) {
    const relative = path.join(subdir, entry.name);
    const absolute = path.join(root, relative);

    if (entry.isDirectory()) {
      Object.assign(sums, await collectSha256(root, relative));
    } else if (
      entry.isFile() &&
      entry.name !== "sha256sums.json" &&
      entry.name !== "keys.json" &&
      !entry.name.endsWith(".enc")
    ) {
      sums[normalize(relative)] = await sha256File(absolute);
    }
  }

  return sums;
};

const copyFileEnsuringDir = async (from: string, to: string) => {
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to);
};

const encryptAndWrite = async (
  srcPath: string,
  destPath: string,
): Promise<{ key: string; iv: string; plaintextSha256: string }> => {
  const plaintext = await readFile(srcPath);
  const key = randomBytes(32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, encrypted);
  const plaintextSha256 = createHash("sha256").update(plaintext).digest("hex");
  return { key: key.toString("hex"), iv: iv.toString("hex"), plaintextSha256 };
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

  if (depth >= 2) {
    throw new Error(`Cannot find flash_all.bat in ${packageDir}`);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    try {
      return await findFlashAll(path.join(packageDir, entry.name), depth + 1);
    } catch {
      // Keep searching sibling directories.
    }
  }

  throw new Error(`Cannot find flash_all.bat in ${packageDir}`);
};

const archiveCandidatesFor = (model: ModelSource) => {
  const firstPathPart = model.localPackageDir.split(/[\\/]+/)[0];
  const candidates = [
    firstPathPart ? `${firstPathPart}.rar` : undefined,
    `${path.basename(model.localPackageDir)}.rar`,
    ...(archiveNamesByModelId[model.id] ?? []),
  ];

  return [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate)))];
};

const archiveDirectoryCandidatesFor = (model: ModelSource) =>
  [
    ...(packageDirectoryNamesByModelId[model.id] ?? []),
    ...archiveCandidatesFor(model).map((candidate) => path.basename(candidate, path.extname(candidate))),
  ];

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

  const extractWithPasswords = async (
    command: string,
    makeArgs: (password: string) => string[],
    label: string,
  ) => {
    const errors: string[] = [];
    for (const password of passwords) {
      try {
        await runExtractorAttempt(
          command,
          makeArgs(password),
          extractRoot,
          `${label} password ${password ? "(provided)" : "(empty)"}`,
        );
        return;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(errors.join("\n"));
  };

  if (extension === ".rar") {
    if (await isFile(unrarPath)) {
      return extractWithPasswords(
        unrarPath,
        (password) => ["x", "-y", `-p${password}`, archivePath, `${extractRoot}${path.sep}`],
        "UnRAR",
      );
    }

    if (await isFile(sevenZipPath)) {
      return extractWithPasswords(
        sevenZipPath,
        (password) => ["x", "-y", `-p${password}`, archivePath, `-o${extractRoot}`],
        "7-Zip",
      );
    }

    await requireFile(unrarPath, `UnRAR.exe or 7-Zip (${sevenZipPath})`);
  }

  if ((extension === ".zip" || extension === ".7z") && (await isFile(sevenZipPath))) {
    return extractWithPasswords(
      sevenZipPath,
      (password) => ["x", "-y", `-p${password}`, archivePath, `-o${extractRoot}`],
      "7-Zip",
    );
  }

  if (extension === ".zip" || extension === ".7z") {
    return runExtractorAttempt("tar", ["-xf", archivePath, "-C", extractRoot], extractRoot, "tar");
  }

  throw new Error(`Unsupported archive type for ${archivePath}`);
};

const resolvePackageSource = async (model: ModelSource, options: CliOptions, tempRoot: string) => {
  const directRoots = [...options.ftdPackageExtraRoots, options.ftdPackagesRoot, options.ftdPackagesFallback];

  for (const root of directRoots) {
    // 1. Local extracted directory in this root
    const candidate = path.join(root, model.localPackageDir);
    try {
      const flashAll = await findFlashAll(candidate);
      return { flashAll, imagesDir: path.join(path.dirname(flashAll), "images") };
    } catch {
      // continue to next root
    }

    // 1b. Local extracted directory named after an archive candidate
    for (const dirname of archiveDirectoryCandidatesFor(model)) {
      const directoryCandidate = path.join(root, dirname);
      try {
        const flashAll = await findFlashAll(directoryCandidate);
        return { flashAll, imagesDir: path.join(path.dirname(flashAll), "images") };
      } catch {
        // continue to next candidate
      }
    }

    // 2. Archive in this root
    for (const filename of archiveCandidatesFor(model)) {
      const archivePath = path.join(root, filename);
      if (await isFile(archivePath)) {
        const extractRoot = path.join(tempRoot, model.id);
        await extractArchive(
          archivePath,
          extractRoot,
          options.unrarPath,
          options.sevenZipPath,
          options.archivePasswords,
        );
        const flashAll = await findFlashAll(extractRoot);
        return { flashAll, imagesDir: path.join(path.dirname(flashAll), "images") };
      }
    }
  }

  throw new Error(
    `Cannot find FTD package for ${model.id} in:\n  ${directRoots.join("\n  ")}\n` +
    `Tried: ${archiveCandidatesFor(model).join(", ")} or extracted dir ${model.localPackageDir}`,
  );
};

const isMiniEngArchiveName = (filename: string) => /mini[_-]?eng|minieng|mineng/i.test(filename);

const resolveVhmobileMiniEngSource = async (model: ModelSource, options: CliOptions, tempRoot: string) => {
  const entry = vhmobileMiniEngByModelId[model.id];

  if (!entry || entry.status !== "available" || !entry.archiveName || !entry.expectedSize) {
    throw new Error(`No VHMOBILE mini ENG manifest entry for ${model.id} (${model.product})`);
  }

  if (!isMiniEngArchiveName(entry.archiveName)) {
    throw new Error(`Refusing non-mini ENG archive for ${model.id}: ${entry.archiveName}`);
  }

  const archivePath = path.join(options.vhmobileMiniEngRoot, entry.archiveName);

  if (!(await isFile(archivePath))) {
    throw new Error(
      `Missing VHMOBILE mini ENG archive for ${model.id}: ${archivePath} ` +
        `(run npm run download:vhmobile-minieng first)`,
    );
  }

  const archiveStat = await stat(archivePath);
  if (archiveStat.size !== entry.expectedSize) {
    throw new Error(
      `Size mismatch for ${entry.archiveName}: expected ${entry.expectedSize}, got ${archiveStat.size}`,
    );
  }

  const extractRoot = path.join(tempRoot, model.id);
  await extractArchive(
    archivePath,
    extractRoot,
    options.unrarPath,
    options.sevenZipPath,
    options.archivePasswords,
  );
  const flashAll = await findFlashAll(extractRoot);
  return { flashAll, imagesDir: path.join(path.dirname(flashAll), "images") };
};

const resolveMiniEngPackageSource = async (model: ModelSource, options: CliOptions, tempRoot: string) => {
  const entry = vhmobileMiniEngByModelId[model.id];

  if (entry?.status === "available") {
    return resolveVhmobileMiniEngSource(model, options, tempRoot);
  }

  return resolvePackageSource(model, options, tempRoot);
};

type FirmwareCopySpec = { srcPath: string; dest: string };

const buildEncryptedSpecs = (firmwareSourceRoot: string): FirmwareCopySpec[] => {
  const specs: FirmwareCopySpec[] = [];
  const enneaDone = new Set<string>();

  for (const model of v1LegacyModelSources) {
    const chipDir = path.join(firmwareSourceRoot, model.chip);
    const slugDir = path.join(chipDir, model.id);

    if (model.unlock.payloadFile) {
      specs.push({
        srcPath: path.join(slugDir, "payload.bin"),
        dest: model.unlock.payloadFile,
      });
    }

    if (model.unlock.finalGptFile) {
      specs.push({
        srcPath: path.join(slugDir, "final_gpt.bin"),
        dest: model.unlock.finalGptFile,
      });
    }

    if (model.unlock.enneaFile && !enneaDone.has(model.unlock.enneaFile)) {
      enneaDone.add(model.unlock.enneaFile);
      specs.push({
        srcPath: path.join(chipDir, "ennea.img"),
        dest: model.unlock.enneaFile,
      });
    }
  }

  return specs;
};

const adbExploitAssetPathsForModel = (model: ModelSource) => {
  const adbExploit = model.adbExploit;

  if (!adbExploit) {
    return [];
  }

  if (adbExploit.candidates?.length) {
    return adbExploit.candidates.flatMap((candidate) => [candidate.exploitFile, candidate.suFile]);
  }

  if (adbExploit.exploitFile && adbExploit.suFile) {
    return [adbExploit.exploitFile, adbExploit.suFile];
  }

  return [];
};

const main = async () => {
  const options = parseArgs();
  await requireFile(path.join(options.firmwareSourceRoot, "README.md"), "firmware-source/README.md (run scripts/populate-firmware-source.ps1 first)");

  const signingKey = loadSigningKey();
  const isProductionBuild = process.env.NODE_ENV === "production" || process.env.QFLASH_REQUIRE_SIGNING === "true";

  if (!signingKey && isProductionBuild) {
    throw new Error(
      "ASSET_SIGNING_KEY_PEM is required for production asset builds. Generate an Ed25519 keypair and set the PEM via env.",
    );
  }

  if (!signingKey) {
    console.warn("⚠️  ASSET_SIGNING_KEY_PEM not set — assets will be built without Ed25519 signatures. Do NOT deploy to production.");
  }

  const tempRoot = await mkdtemp(path.join(tmpdir(), "webusb-assets-"));

  try {
    if (options.clean) {
      await rm(options.outRoot, { recursive: true, force: true });
    }

    await mkdir(options.outRoot, { recursive: true });

    const manifest = manifestSchema.parse({
      version: 1,
      generatedAt: new Date().toISOString(),
      models: v1ManifestModels,
    });

    const manifestPath = path.join(options.outRoot, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await writeDetachedSignature(manifestPath, signingKey);

    // Generic 8 Elite payload (shared boot.img + gpt_both4.bin)
    await copyFileEnsuringDir(
      path.join(options.firmwareSourceRoot, "shared", "unlock_generic", "boot.img"),
      path.join(options.outRoot, "unlock", "boot.img"),
    );
    await copyFileEnsuringDir(
      path.join(options.firmwareSourceRoot, "shared", "unlock_generic", "gpt_both4.bin"),
      path.join(options.outRoot, "unlock", "gpt_both4.bin"),
    );

    // Efisp loader for 8 Elite Gen 5
    const efispSourcePath = path.join(
      options.firmwareSourceRoot,
      "shared",
      "efisp",
      path.basename(efisp8eUnlockFile),
    );
    await requireFile(efispSourcePath, "EFISP Gen 5 unlock file");
    const efispSourceSha256 = await sha256File(efispSourcePath);

    if (efispSourceSha256 !== expectedEfispUnlockSha256) {
      throw new Error(
        `EFISP hash mismatch for ${efispSourcePath}: expected ${expectedEfispUnlockSha256}, got ${efispSourceSha256}`,
      );
    }

    await copyFileEnsuringDir(efispSourcePath, path.join(options.outRoot, efisp8eUnlockFile));

    const adbExploitPaths = [
      ...new Set(v1LegacyModelSources.flatMap((model) => adbExploitAssetPathsForModel(model)).map(normalize)),
    ];

    for (const dest of adbExploitPaths) {
      const sourceRelative = dest.replace(/^bin\//, "");
      await copyFileEnsuringDir(
        path.join(options.firmwareSourceRoot, "shared", "exploits", sourceRelative),
        path.join(options.outRoot, dest),
      );
    }

    const skippedFtd: string[] = [];
    const failedFtd: string[] = [];

    for (const model of v1LegacyModelSources) {
      // ABL: firmware-source/<chip>/<slug>/abl.elf → abl/<basename>
      const ablSrc = path.join(options.firmwareSourceRoot, model.chip, model.id, "abl.elf");
      await copyFileEnsuringDir(ablSrc, path.join(options.outRoot, model.ablFile));

      if (model.edlAbl) {
        await copyFileEnsuringDir(
          path.join(options.firmwareSourceRoot, "shared", "firehose", path.basename(model.edlAbl.firehoseFile)),
          path.join(options.outRoot, model.edlAbl.firehoseFile),
        );
      }

      // FTD package — skip nếu model đánh dấu skipFtdPackage hoặc không tìm thấy .rar
      if (model.packageStatus === "missing-mini-eng") {
        skippedFtd.push(`${model.id} (missing mini ENG package for ${model.product})`);
        continue;
      }

      if (model.skipFtdPackage) {
        skippedFtd.push(`${model.id} (marked skipFtdPackage: true)`);
        continue;
      }

      let flashAll: string;
      let imagesDir: string;
      try {
        ({ flashAll, imagesDir } = await resolveMiniEngPackageSource(model, options, tempRoot));
      } catch (error) {
        failedFtd.push(`${model.id} (${(error as Error).message.split("\n")[0]})`);
        continue;
      }

      const packageOut = path.join(options.outRoot, model.ftdPackage);
      const packageImagesOut = path.join(packageOut, "images");

      await rm(packageOut, { recursive: true, force: true });
      await cp(imagesDir, packageImagesOut, { recursive: true });

      const plan = flashPlanSchema.parse(
        parseFlashAllBat(await readFile(flashAll, "utf8"), {
          modelId: model.id,
          product: model.product,
          hasAntiRollbackFile: await isFile(path.join(imagesDir, "anti_version.txt")),
        }),
      );

      const planPath = path.join(packageOut, "flash-plan.json");
      await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
      await writeDetachedSignature(planPath, signingKey);
      const packageSumsPath = path.join(packageOut, "sha256sums.json");
      await writeFile(
        packageSumsPath,
        `${JSON.stringify(await collectSha256(packageOut), null, 2)}\n`,
      );
      await writeDetachedSignature(packageSumsPath, signingKey);
    }

    if (failedFtd.length > 0) {
      throw new Error(
        `Failed mini ENG packages (${failedFtd.length}):\n${failedFtd.map((entry) => `  - ${entry}`).join("\n")}`,
      );
    }

    if (skippedFtd.length > 0) {
      console.log(`\nSkipped FTD packages (${skippedFtd.length}):`);
      for (const entry of skippedFtd) {
        console.log(`  - ${entry}`);
      }
      console.log();
    }

    // ── Encrypted firmware pipeline ──────────────────────────────────────────
    const encryptedSpecs = buildEncryptedSpecs(options.firmwareSourceRoot);

    if (!options.skipEncrypted) {
      const firmwareKeys: FirmwareKeys = {};
      const encryptedSha256s: Record<string, string> = {};

      const missing: string[] = [];
      for (const { srcPath, dest } of encryptedSpecs) {
        if (!(await isFile(srcPath))) {
          missing.push(`${dest} <- ${srcPath}`);
        }
      }

      if (missing.length > 0) {
        throw new Error(
          `Missing firmware sources (${missing.length}) — run scripts/populate-firmware-source.ps1 to bring them in:\n${missing.map((m) => `  ${m}`).join("\n")}`,
        );
      }

      console.log(`Encrypting ${encryptedSpecs.length} firmware files...`);

      for (const { srcPath, dest } of encryptedSpecs) {
        const destPath = path.join(options.outRoot, `${dest}.enc`);
        const { key, iv, plaintextSha256 } = await encryptAndWrite(srcPath, destPath);
        firmwareKeys[dest] = { key, iv };
        encryptedSha256s[dest] = plaintextSha256;
        console.log(`  Encrypted ${dest}`);
      }

      const keysPath = path.resolve(
        process.env.PAYMENTS_ASSET_KEYS_PATH ?? path.join(projectRoot, "server", "data", "payment-asset-keys.local.json"),
      );
      await mkdir(path.dirname(keysPath), { recursive: true });
      await writeFile(keysPath, `${JSON.stringify(firmwareKeys, null, 2)}\n`);

      console.log(`Wrote backend-only asset keys to ${keysPath} with ${Object.keys(firmwareKeys).length} entries`);

      const rootSums = await collectSha256(options.outRoot);
      Object.assign(rootSums, encryptedSha256s);

      const rootSumsPath = path.join(options.outRoot, "sha256sums.json");
      await writeFile(rootSumsPath, `${JSON.stringify(rootSums, null, 2)}\n`);
      await writeDetachedSignature(rootSumsPath, signingKey);
    } else {
      const rootSumsPath = path.join(options.outRoot, "sha256sums.json");
      await writeFile(rootSumsPath, `${JSON.stringify(await collectSha256(options.outRoot), null, 2)}\n`);
      await writeDetachedSignature(rootSumsPath, signingKey);
    }

    console.log(`Asset layout generated at ${options.outRoot}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
