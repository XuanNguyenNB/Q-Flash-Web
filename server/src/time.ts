export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const toIso = (date: Date) => date.toISOString();
export const addMs = (date: Date, ms: number) => new Date(date.getTime() + ms);
export const now = () => new Date();
