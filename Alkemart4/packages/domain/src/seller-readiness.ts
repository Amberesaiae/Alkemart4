import { getRegionById } from "@alkemart/shared/ghana"

export type SellerReadinessInput = {
  name?: string | null
  packRegion?: string | null
  recipientCode?: string | null
  /** Lab-only: skip the Paystack recipient_code gate. Never invent a recipient code. */
  skipPaystackRecipient?: boolean
}

export type SellerReadiness = {
  ready: boolean
  missing: string[]
}

function present(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0
}

export function evaluateSellerReadiness(seller: SellerReadinessInput): SellerReadiness {
  const missing: string[] = []
  if (!present(seller.name)) missing.push("name")
  const region = seller.packRegion?.trim() ?? ""
  if (!region || !getRegionById(region)) missing.push("region")
  if (!seller.skipPaystackRecipient && !present(seller.recipientCode)) {
    missing.push("recipient_code")
  }
  return { ready: missing.length === 0, missing }
}
