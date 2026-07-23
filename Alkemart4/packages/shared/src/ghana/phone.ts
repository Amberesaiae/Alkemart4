export const GHANA_COUNTRY_CODE = "+233" as const
export const GHANA_NSN_LENGTH = 9 as const

export const MOBILE_PREFIXES = {
  MTN: ["024", "025", "053", "054", "055", "059"] as const,
  VODAFONE: ["020", "050"] as const,
  AIRTELTIGO: ["026", "027", "056", "057"] as const,
  GLOBACOM: ["023"] as const,
} as const

export const LANDLINE_PREFIXES = {
  ACCRA: ["030"] as const,
  TAKORADI: ["031"] as const,
  KUMASI: ["032"] as const,
  CAPE_COAST: ["033"] as const,
  KOFORIDUA: ["034"] as const,
  SUNYANI: ["035"] as const,
  HO: ["036"] as const,
  TAMALE: ["037"] as const,
  BOLGATANGA: ["038"] as const,
  WA: ["039"] as const,
} as const

export function formatPhone(number: string): string {
  const cleaned = number.replace(/[\s\-\(\)]/g, "")
  const local = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned.startsWith("+233") ? cleaned.slice(4) : cleaned
  if (local.length !== 9) return number
  const prefix = local.slice(0, 3)
  const rest1 = local.slice(3, 6)
  const rest2 = local.slice(6)
  return `+233 ${prefix} ${rest1} ${rest2}`
}

export function detectMobileOperator(phone: string): keyof typeof MOBILE_PREFIXES | null {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "")
  const prefix = cleaned.startsWith("0") ? cleaned.slice(0, 3) : cleaned.startsWith("+233") ? "0" + cleaned.slice(4, 6) : cleaned.slice(0, 3)
  for (const [operator, prefixes] of Object.entries(MOBILE_PREFIXES)) {
    if ((prefixes as readonly string[]).includes(prefix)) return operator as keyof typeof MOBILE_PREFIXES
  }
  return null
}
