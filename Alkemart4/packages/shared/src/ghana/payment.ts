import { detectMobileOperator } from "./phone"

export const MOMO_PROVIDERS = {
  MTN: { name: "MTN Mobile Money", marketShare: 0.73, prefix: "+233" },
  VODAFONE: { name: "Vodafone Cash", marketShare: 0.23, prefix: "+233" },
  AIRTELTIGO: { name: "AirtelTigo Money", marketShare: 0.04, prefix: "+233" },
} as const

export type MomoProvider = keyof typeof MOMO_PROVIDERS

export function detectMomoProvider(phone: string): MomoProvider | null {
  const operator = detectMobileOperator(phone)
  if (operator === "GLOBACOM") return null
  if (operator === "MTN") return "MTN"
  if (operator === "VODAFONE") return "VODAFONE"
  if (operator === "AIRTELTIGO") return "AIRTELTIGO"
  return null
}
