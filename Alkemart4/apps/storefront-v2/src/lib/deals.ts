import { apiJson } from "./http"
import { getWorkersAccessToken } from "./auth"
import { getActiveMarket } from "./market"

/** A buyer's price offer. Amounts are minor-unit strings from the API. */
export type Deal = {
  id: string
  offerId: string
  productId: string
  sellerName: string | null
  qty: number
  listPricePesewas: string
  amountPesewas: string
  counterPesewas: string | null
  agreedPesewas: string | null
  status: "pending" | "countered" | "accepted" | "declined" | "expired" | "used" | "withdrawn"
  respondBy: string | null
  validUntil: string | null
}

const opts = (init?: RequestInit) => ({ ...init, token: getWorkersAccessToken() })

export const negotiable = (offerIds: string[]) =>
  apiJson<{ negotiable: Record<string, boolean> }>(`/store/deals/negotiable?offerIds=${encodeURIComponent(offerIds.join(","))}`).then((r) => r.negotiable)
export const myDeals = (offerId?: string) => apiJson<{ items: Deal[] }>(`/store/deals${offerId ? `?offerId=${encodeURIComponent(offerId)}` : ""}`, opts()).then((r) => r.items)
export const makeOffer = (input: { offerId: string; qty: number; amountPesewas: string }) =>
  apiJson<{ deal: Deal; autoDeclined: boolean }>("/store/deals", opts({ method: "POST", body: JSON.stringify(input) }))
export const dealAction = (id: string, action: "accept" | "decline" | "withdraw") =>
  apiJson<{ deal: Deal }>(`/store/deals/${encodeURIComponent(id)}/${action}`, opts({ method: "POST" }))

/** "1500" or "1500.50" → minor units as a string (market decides the scale); null if not a price. */
export function majorToMinor(text: string): string | null {
  const t = text.replace(/[,\s]/g, "")
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null
  const per = getActiveMarket().currency.minorUnitsPerMajor
  const decimals = Math.round(Math.log10(per))
  const [whole, frac = ""] = t.split(".")
  const minor = BigInt(whole!) * BigInt(per) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0")
  return minor > 0n ? minor.toString() : null
}

export const minorToMajor = (minor: string | null | undefined) => (minor == null ? null : Number(minor) / getActiveMarket().currency.minorUnitsPerMajor)
