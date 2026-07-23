/**
 * Market / locale catalog for the storefront.
 * Ghana is the live market; others are listed for dial-code selection UX
 * but checkout/currency remain GHS until multi-market pricing exists.
 */

export type MarketCode = "GH" | "NG" | "KE" | "ZA" | "US" | "GB";

export interface Market {
  code: MarketCode;
  name: string;
  dialCode: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  /** Whether this market is fully supported for checkout/currency. */
  live: boolean;
}

export const MARKETS: Market[] = [
  { code: "GH", name: "Ghana", dialCode: "+233", currency: "GHS", currencySymbol: "GH₵", locale: "en-GH", live: true },
  { code: "NG", name: "Nigeria", dialCode: "+234", currency: "NGN", currencySymbol: "₦", locale: "en-NG", live: false },
  { code: "KE", name: "Kenya", dialCode: "+254", currency: "KES", currencySymbol: "KSh", locale: "en-KE", live: false },
  { code: "ZA", name: "South Africa", dialCode: "+27", currency: "ZAR", currencySymbol: "R", locale: "en-ZA", live: false },
  { code: "US", name: "United States", dialCode: "+1", currency: "USD", currencySymbol: "$", locale: "en-US", live: false },
  { code: "GB", name: "United Kingdom", dialCode: "+44", currency: "GBP", currencySymbol: "£", locale: "en-GB", live: false },
];

export const DEFAULT_MARKET = MARKETS[0]!;

export const COUNTRY_CODES = MARKETS.map((m) => m.code) as [MarketCode, ...MarketCode[]];
export const CURRENCIES = ["GHS", "NGN", "KES", "ZAR", "USD", "GBP"] as const;
export const LOCALES = ["en-GH", "en-NG", "en-KE", "en-ZA", "en-US", "en-GB"] as const;

export function marketByCode(code?: string | null): Market {
  return MARKETS.find((m) => m.code === code) ?? DEFAULT_MARKET;
}

export function marketByDial(dial?: string | null): Market {
  return MARKETS.find((m) => m.dialCode === dial) ?? DEFAULT_MARKET;
}
