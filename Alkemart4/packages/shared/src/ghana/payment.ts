import { detectMobileOperator } from "./phone"

export const MOMO_PROVIDERS = {
  MTN: { name: "MTN Mobile Money", marketShare: 0.73, prefix: "+233" },
  VODAFONE: { name: "Telecel Cash", marketShare: 0.23, prefix: "+233" },
  AIRTELTIGO: { name: "AirtelTigo Money", marketShare: 0.04, prefix: "+233" },
} as const

/** UI display key — uppercase enum of Ghana MoMo networks. */
export type MomoProviderKey = keyof typeof MOMO_PROVIDERS

/**
 * Paystack API slugs for MoMo charge/verify calls.
 * These are the canonical values passed to POST /charge and used in
 * all runtime payment flows. Keep in sync with Paystack docs.
 */
export type PaystackMomoProvider = "mtn" | "vodafone" | "airteltigo"

/** Lookup from display key to Paystack slug. */
export const MOMO_PROVIDER_SLUG: Record<MomoProviderKey, PaystackMomoProvider> = {
  MTN: "mtn",
  VODAFONE: "vodafone",
  AIRTELTIGO: "airteltigo",
} as const

export function detectMomoProvider(phone: string): PaystackMomoProvider | null {
  const operator = detectMobileOperator(phone)
  if (!operator || operator === "GLOBACOM") return null
  return MOMO_PROVIDER_SLUG[operator as MomoProviderKey] ?? null
}
