export type PaymentsProviderMode = "mock" | "payos";

export type ServerConfig = {
  port: number;
  databasePath: string;
  provider: PaymentsProviderMode;
  publicBaseUrl: string;
  adminToken: string;
  assetKeysPath?: string;
  developerOverride: {
    masterKey?: string;
    sessionTtlMs: number;
    cookieName: string;
  };
  payos: {
    clientId?: string;
    apiKey?: string;
    checksumKey?: string;
    returnUrl: string;
    cancelUrl: string;
    webhookUrl?: string;
  };
};

const read = (env: NodeJS.ProcessEnv, key: string, fallback = "") => env[key] || fallback;
const enabled = (value: string | undefined) => /^(1|true|yes)$/i.test(value ?? "");
const DEVELOPER_OVERRIDE_SESSION_TTL_MS = 15 * 60 * 1000;

export const loadServerConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  const providerInput = read(env, "PAYMENTS_PROVIDER", "mock");
  if (providerInput !== "mock" && providerInput !== "payos") {
    throw new Error("PAYMENTS_PROVIDER must be either mock or payos.");
  }

  const provider: PaymentsProviderMode = providerInput;
  const publicBaseUrl = read(env, "PAYMENTS_PUBLIC_BASE_URL", "http://localhost:5173").replace(/\/+$/, "");
  const adminToken = read(env, "PAYMENTS_ADMIN_TOKEN", "");
  const assetKeysPath = read(env, "PAYMENTS_ASSET_KEYS_PATH") || undefined;
  const payos = {
    clientId: read(env, "PAYOS_CLIENT_ID") || undefined,
    apiKey: read(env, "PAYOS_API_KEY") || undefined,
    checksumKey: read(env, "PAYOS_CHECKSUM_KEY") || undefined,
    returnUrl: read(env, "PAYOS_RETURN_URL", `${publicBaseUrl}/payment/return`),
    cancelUrl: read(env, "PAYOS_CANCEL_URL", `${publicBaseUrl}/payment/cancel`),
    webhookUrl: read(env, "PAYOS_WEBHOOK_URL") || undefined,
  };

  if (read(env, "NODE_ENV") === "production") {
    if (provider === "mock" && !enabled(read(env, "PAYMENTS_ALLOW_MOCK_IN_PRODUCTION"))) {
      throw new Error("PAYMENTS_PROVIDER=mock is blocked in production.");
    }

    if (!adminToken) {
      throw new Error("PAYMENTS_ADMIN_TOKEN is required in production.");
    }

    if (!assetKeysPath) {
      throw new Error("PAYMENTS_ASSET_KEYS_PATH is required in production.");
    }
  }

  if (provider === "payos") {
    const missing = [
      payos.clientId ? "" : "PAYOS_CLIENT_ID",
      payos.apiKey ? "" : "PAYOS_API_KEY",
      payos.checksumKey ? "" : "PAYOS_CHECKSUM_KEY",
    ].filter(Boolean);

    if (missing.length) {
      throw new Error(`Missing payOS configuration: ${missing.join(", ")}.`);
    }
  }

  return {
    port: Number(read(env, "PAYMENTS_PORT", "8787")) || 8787,
    databasePath: read(env, "PAYMENTS_DATABASE_PATH", "server/data/payments.db"),
    provider,
    publicBaseUrl,
    adminToken,
    assetKeysPath,
    developerOverride: {
      masterKey: read(env, "DEVELOPER_OVERRIDE_MASTER_KEY") || undefined,
      sessionTtlMs: DEVELOPER_OVERRIDE_SESSION_TTL_MS,
      cookieName: "qflash_dev_override",
    },
    payos,
  };
};
