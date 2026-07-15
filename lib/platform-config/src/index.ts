/**
 * Shared non-secret platform defaults for SPA and backend.
 * Secrets and env overrides live in Medusa env.ts / SPA Vite / api-server platform-config.
 */

/** ISO 4217 display/checkout currency (uppercase for app layer). */
export const DEFAULT_CURRENCY = "GHS";
export const DEFAULT_CURRENCY_SYMBOL = "GH₵";
export const DEFAULT_COUNTRY_CODE = "GH";
export const DEFAULT_LOCALE = "en-GH";
/** New vendor commission bps (700 = 7%). */
export const DEFAULT_COMMISSION_BPS = 700;
export const LIVE_CURRENCY_MINOR_NAME = "pesewas";
/** Medusa region currency is often lowercase */
export const MEDUSA_CURRENCY_CODE = "ghs";
