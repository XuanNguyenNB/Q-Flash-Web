import { readFile } from "node:fs/promises";

import { badRequest, notFound } from "../errors.js";

export type FirmwareKey = {
  key: string;
  iv: string;
};

export type FirmwareKeys = Record<string, FirmwareKey>;

const assertHex = (value: string, label: string) => {
  if (!/^[0-9a-fA-F]+$/.test(value)) {
    throw badRequest("INVALID_ASSET_KEY", `${label} must be hex.`);
  }
};

export class AssetKeyStore {
  private readonly keys: FirmwareKeys;

  constructor(keys: FirmwareKeys) {
    this.keys = keys;
  }

  static async fromFile(path: string) {
    const parsed = JSON.parse(await readFile(path, "utf8")) as FirmwareKeys;
    return new AssetKeyStore(parsed);
  }

  getMany(paths: readonly string[]) {
    const result: FirmwareKeys = {};

    for (const path of paths) {
      const entry = this.keys[path];

      if (!entry) {
        throw notFound("ASSET_KEY_NOT_FOUND", `No key configured for ${path}.`);
      }

      assertHex(entry.key, `key for ${path}`);
      assertHex(entry.iv, `iv for ${path}`);
      result[path] = entry;
    }

    return result;
  }
}
