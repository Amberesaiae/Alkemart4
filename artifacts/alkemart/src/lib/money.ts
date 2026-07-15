/**
 * Shared money formatting for the storefront.
 * Catalog/checkout remain GHS (pesewas) until multi-currency pricing exists.
 * Display symbol can follow user preferred currency when it matches live market.
 */
import {
  DEFAULT_CURRENCY,
  DEFAULT_CURRENCY_SYMBOL,
} from "@workspace/platform-config";
import { marketByCode, type Market } from "./markets";

/** Live checkout currency today. */
export const LIVE_CURRENCY_CODE = DEFAULT_CURRENCY;
export const LIVE_CURRENCY_SYMBOL = DEFAULT_CURRENCY_SYMBOL;

export function currencySymbolForCode(code?: string | null): string {
  if (!code) return LIVE_CURRENCY_SYMBOL;
  if (code === "GHS" || code === "GH₵") return LIVE_CURRENCY_SYMBOL;
  // Country code (e.g. GH) → market symbol
  if (code.length === 2) {
    return marketByCode(code).currencySymbol;
  }
  // ISO currency code → first matching market
  const byCurrency = (["GH", "NG", "KE", "ZA", "US", "GB"] as const)
    .map((c) => marketByCode(c))
    .find((m) => m.currency === code);
  return byCurrency?.currencySymbol ?? (code.length <= 3 ? code : LIVE_CURRENCY_SYMBOL);
}

/** Symbol for a market or live default. */
export function currencySymbolForMarket(market?: Market | null): string {
  return market?.currencySymbol ?? LIVE_CURRENCY_SYMBOL;
}

export function pesewasToMajor(pesewas: number): number {
  return pesewas / 100;
}

/** e.g. 19900 → "199.00" (no symbol) */
export function pesewasToPrice(pesewas: number): string {
  return pesewasToMajor(pesewas).toFixed(2);
}

/**
 * e.g. 19900 → "GH₵199.00"
 * Pass ISO currency (GHS) or symbol. Non-GHS codes still format major units
 * but catalog amounts remain GHS until multi-currency exists.
 */
export function pesewasToLabel(pesewas: number, currency?: string | null): string {
  const symbol = currencySymbolForCode(currency ?? LIVE_CURRENCY_CODE);
  return `${symbol}${pesewasToPrice(pesewas)}`;
}

/** e.g. "19.50" → display major units string (already major) */
export function formatMajorPrice(
  major: string | number,
  currency: string | null | undefined = LIVE_CURRENCY_SYMBOL,
): string {
  const symbol = currencySymbolForCode(currency);
  const n = typeof major === "number" ? major : Number.parseFloat(String(major));
  if (Number.isNaN(n)) return `${symbol}—`;
  return `${symbol}${n.toFixed(2)}`;
}

/** Zero amount label for empty carts/summaries. */
export function zeroMoneyLabel(currency?: string | null): string {
  return pesewasToLabel(0, currency);
}
