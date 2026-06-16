import { execFile } from "node:child_process";
import { createCipheriv, createHash, createPrivateKey, type KeyObject, randomBytes, sign } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { parseFlashAllBat } from "../src/domain/flashPlanParser";
import { efisp8eUnlockFile, v1LegacyModelSources, v1ManifestModels } from "../src/domain/models";
import { flashPlanSchema, manifestSchema, type Sha256Sums } from "../src/domain/schemas";

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const defaultFirmwareSourceRoot = path.join(projectRoot, "firmware-source");
const defaultOutRoot = path.join(projectRoot, "dist-assets");
const defaultFtdPackagesRoot =
  process.env.FTD_PACKAGES_ROOT ?? path.resolve(projectRoot, "..", "Unlock_8E_Xiaomi", "Unlock_8E_Xiaomi", "Goi_ha_cap");
const defaultFtdPackagesFallback =
  process.env.FTD_PACKAGES_FALLBACK ?? "C:\\Users\\XuanNguyen\\Downloads\\minieng";
const defaultUnrarPath =
  process.env.UNRAR_PATH ?? path.resolve(projectRoot, "..", "auto-unlock-standalone", "assets", "UnRAR.exe");

type ModelSource = (typeof v1LegacyModelSources)[number];

type CliOptions = {
  firmwareSourceRoot: string;
  ftdPackagesRoot: string;
  ftdPackagesFallback: string;
  unrarPath: string;
  outRoot: string;
  clean: boolean;
  skipEncrypted: boolean;
};

type FirmwareKeys = Record<string, { key: string; iv: string }>;

const archiveNamesByModelId: Record<string, string[]> = {
  xiaomi15: ["Xiaomi15.rar"],
  xiaomi15pro: ["Xiaomi15Pro.rar"],
  xiaomi15ultra: ["小米15ultra降级小包2025.04.08.rar"],
  "redmi-k80pro": ["Redmi_K80Pro.rar"],
  "redmi-k90": ["红米k90降级小包2026.02.23.rar"],
  "xiaomi-pad8pro": ["小米平板8pro降级小包.rar"],
  "redmi-turbo4pro": ["turbo4pro_minieng.rar"],
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    firmwareSourceRoot: defaultFirmwareSourceRoot,
    ftdPackagesRoot: defaultFtdPackagesRoot,
    ftdPackagesFallback: defaultFtdPackagesFallback,
    unrarPath: defaultUnrarPath,
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
    } else if (arg === "--unrar" && next) {
      options.unrarPath = path.resolve(next);
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

  if (depth >= 2) {
    throw new Error(`Cannot find flash_all.bat in ${packageDir}`);
  }

  const entries = await readdir(packageDir, { withFileTypes: true });

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

const extractArchive = async (archivePath: string, extractRoot: string, unrarPath: string) => {
  await requireFile(unrarPath, "UnRAR.exe");
  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });
  await execFileAsync(unrarPath, ["x", "-y", archivePath, `${extractRoot}${path.sep}`], {
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
};

const resolvePackageSource = async (model: ModelSource, options: CliOptions, tempRoot: string) => {
  const directRoots = [options.ftdPackagesRoot, options.ftdPackagesFallback];

  // 1. Local extracted directory in either root
  for (const root of directRoots) {
    const candidate = path.join(root, model.localPackageDir);
    try {
      const flashAll = await findFlashAll(candidate);
      return { flashAll, imagesDir: path.join(path.dirname(flashAll), "images") };
    } catch {
      // continue to next root
    }
  }

  // 2. Archive in either root
  for (const root of directRoots) {
    for (const filename of archiveCandidatesFor(model)) {
      const archivePath = path.join(root, filename);
      if (await isFile(archivePath)) {
        const extractRoot = path.join(tempRoot, model.id);
        await extractArchive(archivePath, extractRoot, options.unrarPath);
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

type EncryptedSpec = { srcPath: string; dest: string };

const buildEncryptedSpecs = (firmwareSourceRoot: string): EncryptedSpec[] => {
  const specs: EncryptedSpec[] = [];
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
    await copyFileEnsuringDir(
      path.join(options.firmwareSourceRoot, "shared", "efisp", path.basename(efisp8eUnlockFile)),
      path.join(options.outRoot, efisp8eUnlockFile),
    );

    const skippedFtd: string[] = [];

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
      if (model.skipFtdPackage) {
        skippedFtd.push(`${model.id} (marked skipFtdPackage: true)`);
        continue;
      }

      let flashAll: string;
      let imagesDir: string;
      try {
        ({ flashAll, imagesDir } = await resolvePackageSource(model, options, tempRoot));
      } catch (error) {
        skippedFtd.push(`${model.id} (${(error as Error).message.split("\n")[0]})`);
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
          hasAntiRollbackFile: true,
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

      const keysPath = path.join(options.outRoot, "keys.json");
      await writeFile(keysPath, `${JSON.stringify(firmwareKeys, null, 2)}\n`);
      await writeDetachedSignature(keysPath, signingKey);

      console.log(`Wrote keys.json with ${Object.keys(firmwareKeys).length} entries`);

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
