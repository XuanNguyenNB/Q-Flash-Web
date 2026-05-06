export const defaultAssetBaseUrl = "/dist-assets";

export const normalizePath = (path: string) =>
  path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");

export const getAssetBaseUrl = () => import.meta.env.VITE_ASSET_BASE_URL || defaultAssetBaseUrl;

export const buildAssetUrl = (baseUrl: string, path: string) => {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return `${cleanBase}/${normalizePath(path)}`;
};
