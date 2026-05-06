import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { parseFlashAllBat } from "../src/domain/flashPlanParser";
import { efisp8eUnlockFile, v1LegacyModelSources, v1ManifestModels } from "../src/domain/models";
import { flashPlanSchema, manifestSchema, type Sha256Sums } from "../src/domain/schemas";

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const workspaceRoot = path.resolve(projectRoot, "..");
const defaultSourceRoot = path.join(workspaceRoot, "Unlock_8E_Xiaomi", "Unlock_8E_Xiaomi");
const defaultAblRoot = path.join(workspaceRoot, "downgrade-abl");
const defaultUnlockRoot = path.join(workspaceRoot, "auto-unlock-standalone", "assets");
const defaultFirehoseRoot = path.resolve(workspaceRoot, "..", "Unlock_Xiaomi_15U_C06");
const defaultEfispRoot =
  process.env.EFISP_ROOT ?? "C:\\Users\\nguye\\Documents\\Unlock_BL_Xiaomi_17_Series_8E_GEN5";
const defaultOutRoot = path.join(projectRoot, "dist-assets");

type ModelSource = (typeof v1LegacyModelSources)[number];

type CliOptions = {
  sourceRoot: string;
  ablRoot: string;
  unlockRoot: string;
  firehoseRoot: string;
  efispRoot: string;
  outRoot: string;
  clean: boolean;
};

const archiveNamesByModelId: Record<string, string[]> = {
  xiaomi15: ["Xiaomi15.rar"],
  xiaomi15pro: ["Xiaomi15Pro.rar"],
  xiaomi15ultra: ["小米15ultra降级小包2025.04.08.rar"],
  "redmi-k80pro": ["Redmi_K80Pro.rar"],
  "redmi-k90": ["红米k90降级小包2026.02.23.rar"],
  "xiaomi-pad8pro": ["小米平板8pro降级小包.rar"],
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    sourceRoot: defaultSourceRoot,
    ablRoot: defaultAblRoot,
    unlockRoot: defaultUnlockRoot,
    firehoseRoot: defaultFirehoseRoot,
    efispRoot: defaultEfispRoot,
    outRoot: defaultOutRoot,
    clean: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--source-root" && next) {
      options.sourceRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--abl-root" && next) {
      options.ablRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--unlock-root" && next) {
      options.unlockRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--firehose-root" && next) {
      options.firehoseRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--efisp-root" && next) {
      options.efispRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--out" && next) {
      options.outRoot = path.resolve(next);
      index += 1;
    } else if (arg === "--clean") {
      options.clean = true;
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

const collectSha256 = async (root: string, subdir = ""): Promise<Sha256Sums> => {
  const dir = path.join(root, subdir);
  const entries = await readdir(dir, { withFileTypes: true });
  const sums: Sha256Sums = {};

  for (const entry of entries) {
    const relative = path.join(subdir, entry.name);
    const absolute = path.join(root, relative);

    if (entry.isDirectory()) {
      Object.assign(sums, await collectSha256(root, relative));
    } else if (entry.isFile() && entry.name !== "sha256sums.json") {
      sums[normalize(relative)] = await sha256File(absolute);
    }
  }

  return sums;
};

const copyFileEnsuringDir = async (from: string, to: string) => {
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to);
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

const findArchiveForModel = async (sourceRoot: string, model: ModelSource) => {
  const packageRoot = path.join(sourceRoot, "Goi_ha_cap");

  for (const filename of archiveCandidatesFor(model)) {
    const candidate = path.join(packageRoot, filename);

    if (await isFile(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Cannot find .rar package for ${model.id} in ${packageRoot}`);
};

const extractArchive = async (archivePath: string, extractRoot: string, unlockRoot: string) => {
  const unrarPath = path.join(unlockRoot, "UnRAR.exe");
  await requireFile(unrarPath, "UnRAR.exe");
  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });
  await execFileAsync(unrarPath, ["x", "-y", archivePath, `${extractRoot}${path.sep}`], {
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
};

const resolvePackageSource = async (model: ModelSource, options: CliOptions, tempRoot: string) => {
  const localPackage = path.join(options.sourceRoot, "Goi_ha_cap", model.localPackageDir);

  try {
    const flashAll = await findFlashAll(localPackage);
    return { flashAll, imagesDir: path.join(path.dirname(flashAll), "images") };
  } catch {
    const archivePath = await findArchiveForModel(options.sourceRoot, model);
    const extractRoot = path.join(tempRoot, model.id);
    await extractArchive(archivePath, extractRoot, options.unlockRoot);
    const flashAll = await findFlashAll(extractRoot);
    return { flashAll, imagesDir: path.join(path.dirname(flashAll), "images") };
  }
};

const main = async () => {
  const options = parseArgs();
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

    await writeFile(path.join(options.outRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    await copyFileEnsuringDir(
      path.join(options.unlockRoot, "boot.img"),
      path.join(options.outRoot, "unlock", "boot.img"),
    );
    await copyFileEnsuringDir(
      path.join(options.unlockRoot, "gpt_both4.bin"),
      path.join(options.outRoot, "unlock", "gpt_both4.bin"),
    );
    await copyFileEnsuringDir(
      path.join(options.efispRoot, path.basename(efisp8eUnlockFile)),
      path.join(options.outRoot, efisp8eUnlockFile),
    );

    for (const model of v1LegacyModelSources) {
      await copyFileEnsuringDir(
        path.join(options.ablRoot, path.basename(model.ablFile)),
        path.join(options.outRoot, model.ablFile),
      );

      if (model.edlAbl) {
        await copyFileEnsuringDir(
          path.join(options.firehoseRoot, path.basename(model.edlAbl.firehoseFile)),
          path.join(options.outRoot, model.edlAbl.firehoseFile),
        );
      }

      const { flashAll, imagesDir } = await resolvePackageSource(model, options, tempRoot);
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

      await writeFile(path.join(packageOut, "flash-plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
      await writeFile(
        path.join(packageOut, "sha256sums.json"),
        `${JSON.stringify(await collectSha256(packageOut), null, 2)}\n`,
      );
    }

    await writeFile(
      path.join(options.outRoot, "sha256sums.json"),
      `${JSON.stringify(await collectSha256(options.outRoot), null, 2)}\n`,
    );
    console.log(`Asset layout generated at ${options.outRoot}`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
