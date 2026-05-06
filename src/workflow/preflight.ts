import type { PreflightState } from "./types";

export const detectPreflight = (): Pick<PreflightState, "isHttps" | "hasWebUsb"> => ({
  isHttps:
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1",
  hasWebUsb: "usb" in navigator,
});

export const isPreflightReady = (preflight: PreflightState) =>
  preflight.isHttps &&
  preflight.hasWebUsb &&
  preflight.backedUp &&
  preflight.acceptsDataLoss &&
  preflight.hasStockRom;
