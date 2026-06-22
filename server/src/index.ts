import { AssetKeyStore } from "./assets/keyStore.js";
import { loadServerConfig } from "./config.js";
import { PaymentStore } from "./db/store.js";
import { createPaymentProvider } from "./payments/provider.js";
import { createApp } from "./routes.js";

const config = loadServerConfig();
const store = PaymentStore.open(config.databasePath);
const provider = createPaymentProvider(config);
const keyStore = config.assetKeysPath ? await AssetKeyStore.fromFile(config.assetKeysPath) : undefined;
const app = createApp({ config, store, provider, keyStore });

const server = app.listen(config.port, () => {
  console.log(`Q Flash payments API listening on http://127.0.0.1:${config.port}`);
});

const shutdown = () => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
