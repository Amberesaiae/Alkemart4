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

/**
 * Medusa v2 Store/Admin pricing for GHS uses **major units** (e.g. 1899 = GH₵1899).
 * Alkemart domain layer uses **integer pesewas** (e.g. 189900).
 * Convert at the adapter boundary only — never mix layers.
 */
export const MEDUSA_AMOUNT_IS_MAJOR_UNITS = true;

/** Medusa calculated/list amount → Alkemart pesewas. */
export function medusaAmountToPesewas(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  const n = Math.round(amount);
  return MEDUSA_AMOUNT_IS_MAJOR_UNITS ? n * 100 : n;
}

/** Alkemart pesewas → Medusa amount for create/update price APIs. */
export function pesewasToMedusaAmount(pesewas: number): number {
  if (!Number.isFinite(pesewas)) return 0;
  const n = Math.round(pesewas);
  return MEDUSA_AMOUNT_IS_MAJOR_UNITS ? n / 100 : n;
}
