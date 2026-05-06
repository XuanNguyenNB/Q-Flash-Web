import type { FlashOperation, FlashPlan } from "./schemas";

type ParseOptions = {
  modelId: string;
  product: string;
  hasAntiRollbackFile?: boolean;
};

const stripConditionTail = (line: string) => line.split("||")[0]?.trim() ?? "";

const stripRedirectAndPipe = (line: string) => line.split("|")[0]?.replace(/\s+2>\^?&1/g, "").trim() ?? "";

const normalizeFilePath = (path: string) =>
  path
    .replace(/^"+|"+$/g, "")
    .replace(/^%~dp0/i, "")
    .replace(/^\.?[\\/]+/, "")
    .replace(/\\/g, "/");

const isIgnoredLine = (line: string) => {
  const trimmed = line.trim().toLowerCase();
  return (
    trimmed.length === 0 ||
    trimmed.startsWith("::") ||
    trimmed.startsWith("rem ") ||
    trimmed.startsWith("@echo") ||
    trimmed.startsWith("echo ") ||
    trimmed.startsWith("pause") ||
    trimmed.startsWith("timeout") ||
    trimmed.startsWith("if ") ||
    trimmed.startsWith("for ") ||
    trimmed.startsWith("set ") ||
    trimmed.includes("findstr") && !trimmed.startsWith("fastboot")
  );
};

const extractExpectedValue = (line: string) => {
  const match = line.match(/findstr\s+.*?\/c:"\^?([^"]+)"/i);

  if (!match) {
    return undefined;
  }

  const expression = match[1] ?? "";
  const value = expression.includes(":")
    ? (expression.split(":").at(-1) ?? "").replace(/^\s*\*/, "").trim()
    : expression.trim();

  return value || undefined;
};

const dedupeConsecutiveGetvar = (operations: FlashOperation[], operation: FlashOperation) => {
  const previous = operations.at(-1);

  if (
    previous?.type === "getvar" &&
    operation.type === "getvar" &&
    previous.name === operation.name &&
    previous.expect === operation.expect
  ) {
    return;
  }

  operations.push(operation);
};

export const parseFlashAllBat = (content: string, options: ParseOptions): FlashPlan => {
  const operations: FlashOperation[] = [];
  let antiRollbackFile = options.hasAntiRollbackFile ? "images/anti_version.txt" : undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    const lower = trimmed.toLowerCase();

    if (lower.includes("anti_version.txt")) {
      antiRollbackFile = "images/anti_version.txt";
      continue;
    }

    if (isIgnoredLine(trimmed)) {
      continue;
    }

    const fastbootIndex = lower.indexOf("fastboot");

    if (fastbootIndex === -1) {
      continue;
    }

    const commandLine = stripRedirectAndPipe(stripConditionTail(trimmed.slice(fastbootIndex)));
    const withoutFastboot = commandLine.replace(/^fastboot\s+/i, "").replace(/^%\*\s+/, "").trim();
    const tokens = withoutFastboot.match(/"[^"]+"|\S+/g) ?? [];
    const command = tokens[0]?.toLowerCase();

    if (!command) {
      continue;
    }

    if (command === "getvar") {
      const name = tokens[1];

      if (!name || name.toLowerCase() === "anti") {
        continue;
      }

      dedupeConsecutiveGetvar(operations, {
        type: "getvar",
        name,
        expect: extractExpectedValue(trimmed),
      });
      continue;
    }

    if (command === "erase") {
      const partition = tokens[1];

      if (partition) {
        operations.push({ type: "erase", partition });
      }

      continue;
    }

    if (command === "flash") {
      const partition = tokens[1];
      const file = tokens[2];

      if (partition && file) {
        operations.push({
          type: "flash",
          partition,
          file: normalizeFilePath(file),
        });
      }

      continue;
    }

    if (command === "set_active") {
      const slot = tokens[1]?.toLowerCase();

      if (slot === "a" || slot === "b") {
        operations.push({ type: "set_active", slot });
      }

      continue;
    }

    if (command === "reboot") {
      const target = tokens[1]?.toLowerCase();

      operations.push({
        type: "reboot",
        target: target === "bootloader" ? "bootloader" : undefined,
      });
    }
  }

  return {
    modelId: options.modelId,
    product: options.product,
    operations,
    antiRollbackFile,
  };
};
