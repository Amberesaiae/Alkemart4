/**
 * Local-only list of order ids the buyer has opened or just placed.
 * Never invents order data — only stores ids the user already has.
 */

const STORAGE_KEY = "alkemart.storefront.recent_order_ids"
const MAX = 12

export function listRecentOrderIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim())
      .slice(0, MAX)
  } catch {
    return []
  }
}

export function rememberOrderId(orderId: string): void {
  const id = orderId.trim()
  if (!id) return
  try {
    const next = [id, ...listRecentOrderIds().filter((x) => x !== id)].slice(
      0,
      MAX,
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
}

export function clearRecentOrderIds(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
