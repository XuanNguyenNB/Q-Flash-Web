import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { loadScriptEnv } from "./script-env";

loadScriptEnv();

type CliOptions = {
  sourceDir: string;
  remote: string;
  bucket: string;
  assetDomain: string;
  release: string;
  prefix: string;
  transfers: string;
  checkers: string;
  dryRun: boolean;
};

const args = process.argv.slice(2);

const readArg = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const hasArg = (name: string) => args.includes(name);

const requireValue = (value: string | undefined, label: string) => {
  if (!value?.trim()) {
    throw new Error(`Missing ${label}. Set it via env or CLI.`);
  }

  return value.trim();
};

const normalizePrefix = (prefix: string) =>
  prefix
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");

const joinUrl = (base: string, prefix: string) => `${base.replace(/\/+$/, "")}/${normalizePrefix(prefix)}`;

const quoteArg = (value: string) => (/[\\\s",]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);

const commandLine = (bin: string, commandArgs: readonly string[]) => [bin, ...commandArgs].map(quoteArg).join(" ");

const resolveOptions = (): CliOptions => {
  const release = requireValue(readArg("--release") ?? process.env.R2_RELEASE, "R2_RELEASE");
  const defaultPrefix = `xiaomi-webusb/releases/${release}`;
  const prefix = normalizePrefix(readArg("--prefix") ?? process.env.R2_PREFIX ?? defaultPrefix);

  return {
    sourceDir: path.resolve(readArg("--source") ?? process.env.R2_SOURCE_DIR ?? "dist-assets"),
    remote: readArg("--remote") ?? process.env.R2_REMOTE ?? "r2",
    bucket: requireValue(readArg("--bucket") ?? process.env.R2_BUCKET, "R2_BUCKET"),
    assetDomain: requireValue(readArg("--asset-domain") ?? process.env.R2_ASSET_DOMAIN, "R2_ASSET_DOMAIN"),
    release,
    prefix,
    transfers: readArg("--transfers") ?? process.env.R2_TRANSFERS ?? "8",
    checkers: readArg("--checkers") ?? process.env.R2_CHECKERS ?? "16",
    dryRun: hasArg("--dry-run"),
  };
};

const assertDirectory = async (directory: string) => {
  const entry = await stat(directory).catch(() => undefined);

  if (!entry?.isDirectory()) {
    throw new Error(`Asset source directory does not exist: ${directory}`);
  }
};

const findForbiddenKeyFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...(await findForbiddenKeyFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase() === "keys.json") {
      found.push(path.relative(directory, fullPath) || entry.name);
    }
  }

  return found;
};

const assertNoPublicKeyFiles = async (sourceDir: string) => {
  const found = await findForbiddenKeyFiles(sourceDir);

  if (found.length > 0) {
    throw new Error(
      `Refusing to sync public asset keys from ${sourceDir}: ${found.join(", ")}. Run npm run build:assets to regenerate a clean paid-asset layout.`,
    );
  }
};

const run = async (commandArgs: string[], dryRun: boolean) => {
  console.log(commandLine("rclone", commandArgs));

  if (dryRun) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn("rclone", commandArgs, {
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`rclone exited with code ${code}`));
      }
    });
  });
};

const main = async () => {
  const options = resolveOptions();
  await assertDirectory(options.sourceDir);
  await assertNoPublicKeyFiles(options.sourceDir);

  const destination = `${options.remote}:${options.bucket}/${options.prefix}`;
  const publicBaseUrl = joinUrl(options.assetDomain, options.prefix);
  const binaryCache = "public, max-age=31536000, immutable";
  const jsonCache = "no-cache";

  console.log(`Source: ${options.sourceDir}`);
  console.log(`Destination: ${destination}`);
  console.log(`Public base URL: ${publicBaseUrl}`);
  console.log(`Release: ${options.release}`);
  console.log(`Mode: ${options.dryRun ? "dry-run" : "upload"}`);

  const sharedArgs = [
    options.sourceDir,
    destination,
    "--fast-list",
    "--transfers",
    options.transfers,
    "--checkers",
    options.checkers,
    "--progress",
  ];

  await run(
    [
      "copy",
      ...sharedArgs,
      "--exclude",
      "keys.json",
      "--exclude",
      "**/keys.json",
      "--exclude",
      "*.json",
      "--exclude",
      "**/*.json",
      "--header-upload",
      `Cache-Control: ${binaryCache}`,
    ],
    options.dryRun,
  );

  await run(
    [
      "copy",
      ...sharedArgs,
      "--exclude",
      "keys.json",
      "--exclude",
      "**/keys.json",
      "--include",
      "*.json",
      "--include",
      "**/*.json",
      "--exclude",
      "*",
      "--header-upload",
      `Cache-Control: ${jsonCache}`,
    ],
    options.dryRun,
  );

  console.log("R2 asset sync complete.");
  console.log(`Set VITE_ASSET_BASE_URL=${publicBaseUrl} before building the app.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
