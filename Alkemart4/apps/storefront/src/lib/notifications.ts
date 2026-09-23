import { getAlkemartApiUrl, useCloudflareCatalog } from "./env"
import { getWorkersAccessToken } from "./auth"

export type BuyerPreference = {
  channel: string
  category: "promotional" | "operational"
  topic: string | null
  optedIn: boolean
  frequencyCap: number | null
}

export type StockSubscription = {
  id: string
  productId: string
  offerId: string | null
  kind: "back_in_stock" | "price_drop"
  belowPesewas: string | null
  createdAt: string
}

async function authed(path: string, init?: RequestInit) {
  const base = getAlkemartApiUrl()
  const token = getWorkersAccessToken()
  if (!base || !token) throw new Error("Sign in required")
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`)
  return data as Record<string, unknown>
}

/**
 * Buyer preference center client (Phase 7A). Workers-only: Medusa sessions
 * carry no Workers JWT, so these calls throw to sign-in when absent.
 */
export async function listBuyerPreferences(): Promise<BuyerPreference[]> {
  const data = await authed("/store/preferences")
  return Array.isArray(data.items) ? (data.items as BuyerPreference[]) : []
}

export async function setBuyerPreference(input: {
  category: "promotional" | "operational"
  optedIn: boolean
}): Promise<void> {
  await authed("/store/preferences", { method: "PUT", body: JSON.stringify(input) })
}

export async function listMySubscriptions(): Promise<StockSubscription[]> {
  const data = await authed("/store/subscriptions")
  return Array.isArray(data.items) ? (data.items as StockSubscription[]) : []
}

export async function createSubscription(input: {
  productId: string
  offerId?: string | null
  kind: "back_in_stock" | "price_drop"
  belowPesewas?: string | null
}): Promise<void> {
  await authed("/store/subscriptions", { method: "POST", body: JSON.stringify(input) })
}

export async function deleteSubscription(id: string): Promise<void> {
  const base = getAlkemartApiUrl()
  const token = getWorkersAccessToken()
  if (!base || !token) throw new Error("Sign in required")
  const res = await fetch(`${base}/store/subscriptions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Unsubscribe failed (${res.status})`)
}

export function alertsAvailable(): boolean {
  return useCloudflareCatalog() && Boolean(getAlkemartApiUrl())
}
