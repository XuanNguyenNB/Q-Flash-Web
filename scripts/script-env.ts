import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const parseValue = (raw: string) => {
  const value = raw.trim();
  const quote = value[0];

  if ((quote === `"` || quote === `'`) && value.endsWith(quote)) {
    return value.slice(1, -1);
  }

  return value;
};

export const loadScriptEnv = (files = [".env.local", ".env"]) => {
  for (const file of files) {
    const absolute = path.resolve(file);

    if (!existsSync(absolute)) {
      continue;
    }

    const lines = readFileSync(absolute, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");

      if (separator <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = parseValue(trimmed.slice(separator + 1));

      process.env[key] ??= value;
    }
  }
};
