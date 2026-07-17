/**
 * Server-side money formatting for emails, errors, and logs.
 * Catalog amounts are integer pesewas (GHS minor units).
 */
import { DEFAULT_CURRENCY, DEFAULT_CURRENCY_SYMBOL } from "./platform-config";

export function pesewasToMajor(pesewas: number): number {
  return pesewas / 100;
}

export function pesewasToPrice(pesewas: number): string {
  return pesewasToMajor(pesewas).toFixed(2);
}

/** e.g. 19900 → "GH₵199.00" */
export function pesewasToLabel(pesewas: number, symbol = DEFAULT_CURRENCY_SYMBOL): string {
  return `${symbol}${pesewasToPrice(pesewas)}`;
}

/** e.g. 19900 → "GHS 199.00" (code-style, common in email) */
export function pesewasToCodeLabel(pesewas: number, code = DEFAULT_CURRENCY): string {
  return `${code} ${pesewasToPrice(pesewas)}`;
}
