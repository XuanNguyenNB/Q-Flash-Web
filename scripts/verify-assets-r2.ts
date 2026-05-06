import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { buildAssetUrl, normalizePath } from "../src/domain/assets";
import { manifestSchema, type Manifest, type Sha256Sums } from "../src/domain/schemas";
import { loadScriptEnv } from "./script-env";

loadScriptEnv();

type CliOptions = {
  baseUrl: string;
  origin: string;
  distDir: string;
  dryRun: boolean;
};

const args = process.argv.slice(2);

const readArg = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const hasArg = (name: string) => args.includes(name);

const normalizePrefix = (prefix: string) =>
  prefix
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");

const joinUrl = (base: string, prefix: string) => `${base.replace(/\/+$/, "")}/${normalizePrefix(prefix)}`;

const resolveBaseUrl = () => {
  const explicit = readArg("--base-url") ?? process.env.VITE_ASSET_BASE_URL;

  if (explicit?.trim()) {
    return explicit.trim().replace(/\/+$/, "");
  }

  const assetDomain = readArg("--asset-domain") ?? process.env.R2_ASSET_DOMAIN;
  const release = readArg("--release") ?? process.env.R2_RELEASE;

  if (!assetDomain?.trim() || !release?.trim()) {
    throw new Error("Missing asset base URL. Set VITE_ASSET_BASE_URL or R2_ASSET_DOMAIN + R2_RELEASE.");
  }

  const prefix = readArg("--prefix") ?? process.env.R2_PREFIX ?? `xiaomi-webusb/releases/${release.trim()}`;
  return joinUrl(assetDomain.trim(), prefix);
};

const resolveOptions = (): CliOptions => ({
  baseUrl: resolveBaseUrl(),
  origin: readArg("--origin") ?? process.env.R2_VERIFY_ORIGIN ?? "http://localhost:5173",
  distDir: path.resolve(readArg("--dist") ?? process.env.R2_VERIFY_DIST ?? "dist"),
  dryRun: hasArg("--dry-run"),
});

const assertOk = (response: Response, label: string) => {
  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }
};

const assertCors = (response: Response, origin: string, label: string) => {
  const allowOrigin = response.headers.get("access-control-allow-origin");

  if (!allowOrigin) {
    throw new Error(`${label} is missing Access-Control-Allow-Origin.`);
  }

  if (allowOrigin !== "*" && allowOrigin !== origin) {
    throw new Error(`${label} has Access-Control-Allow-Origin=${allowOrigin}, expected * or ${origin}.`);
  }

  const expose = response.headers.get("access-control-expose-headers")?.toLowerCase() ?? "";
  const requiredExpose = ["content-length", "content-range", "etag", "accept-ranges"];
  const missing = requiredExpose.filter((header) => !expose.includes(header));

  if (missing.length) {
    throw new Error(`${label} is missing exposed CORS headers: ${missing.join(", ")}.`);
  }
};

const fetchJson = async <T>(options: CliOptions, assetPath: string) => {
  const url = buildAssetUrl(options.baseUrl, assetPath);
  const response = await fetch(url, {
    headers: { Origin: options.origin },
  });

  assertOk(response, assetPath);
  assertCors(response, options.origin, assetPath);

  return (await response.json()) as T;
};

const assertHead = async (options: CliOptions, assetPath: string) => {
  const url = buildAssetUrl(options.baseUrl, assetPath);
  const response = await fetch(url, {
    method: "HEAD",
    headers: { Origin: options.origin, "Accept-Encoding": "identity" },
  });

  assertOk(response, assetPath);
  assertCors(response, options.origin, assetPath);

  const length = Number(response.headers.get("content-length") ?? "0");

  if (!Number.isFinite(length) || length <= 0) {
    throw new Error(`${assetPath} is missing a positive Content-Length header.`);
  }

  return length;
};

const collectDistFiles = async (root: string): Promise<string[]> => {
  const entry = await stat(root).catch(() => undefined);

  if (!entry?.isDirectory()) {
    return [];
  }

  const output: string[] = [];
  const visit = async (directory: string) => {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);

      if (item.isDirectory()) {
        await visit(absolute);
      } else if (item.isFile() && /\.(html|js)$/.test(item.name)) {
        output.push(absolute);
      }
    }
  };

  await visit(root);
  return output;
};

const assertBuiltAppUsesBaseUrl = async (options: CliOptions) => {
  const files = await collectDistFiles(options.distDir);

  if (!files.length) {
    console.warn(`Skip dist check: no built app files found in ${options.distDir}`);
    return;
  }

  for (const file of files) {
    const text = await readFile(file, "utf8");

    if (text.includes(options.baseUrl)) {
      return;
    }
  }

  throw new Error(`Built app in ${options.distDir} does not contain VITE_ASSET_BASE_URL=${options.baseUrl}.`);
};

const sampleAssetPaths = async (options: CliOptions, manifest: Manifest, rootSha: Sha256Sums) => {
  const firstEfispModel = manifest.models.find((model) => model.family === "efisp-8e-gen5");
  const firstModel = manifest.models.find((model) => model.family === "legacy-ftd");

  if (!firstModel || !firstEfispModel) {
    throw new Error("manifest.json must contain EFISP and legacy models.");
  }

  const flashPlanPath = `${firstModel.ftdPackage}/flash-plan.json`;
  const plan = await fetchJson<{ operations?: Array<{ type?: string; file?: string }> }>(options, flashPlanPath);
  const firstFlashFile = plan.operations?.find((operation) => operation.type === "flash" && operation.file)?.file;
  const paths = [
    firstEfispModel.efispUnlockFile,
    firstModel.ablFile,
    firstModel.edlAbl?.firehoseFile,
    firstModel.finalGpt[0],
    firstFlashFile ? `${firstModel.ftdPackage}/${firstFlashFile}` : undefined,
  ].filter((assetPath): assetPath is string => Boolean(assetPath));

  for (const assetPath of paths) {
    const normalized = normalizePath(assetPath);

    if (!rootSha[normalized]) {
      throw new Error(`sha256sums.json does not contain ${normalized}.`);
    }
  }

  return paths;
};

const main = async () => {
  const options = resolveOptions();

  console.log(`Verify base URL: ${options.baseUrl}`);
  console.log(`Verify origin: ${options.origin}`);

  if (options.dryRun) {
    console.log("Dry-run only; no HTTP requests were sent.");
    return;
  }

  const manifest = manifestSchema.parse(await fetchJson<unknown>(options, "manifest.json"));
  const rootSha = await fetchJson<Sha256Sums>(options, "sha256sums.json");
  const samplePaths = await sampleAssetPaths(options, manifest, rootSha);

  await assertHead(options, "manifest.json");
  await assertHead(options, "sha256sums.json");

  for (const assetPath of samplePaths) {
    const length = await assertHead(options, assetPath);
    console.log(`OK ${assetPath} (${length} bytes)`);
  }

  await assertBuiltAppUsesBaseUrl(options);
  console.log("R2 asset verification complete.");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
