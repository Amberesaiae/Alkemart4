/**
 * Order ids this device placed or opened — ids only, never order data.
 * Lets a guest get back to an order without an account.
 */
const KEY = "alkemart.storefront.recent_order_ids"
const MAX = 12

export function listRecentOrderIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, MAX) : []
  } catch {
    return []
  }
}

export function rememberOrderId(orderId: string): void {
  const id = orderId.trim()
  if (!id) return
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...listRecentOrderIds().filter((x) => x !== id)].slice(0, MAX)))
  } catch {
    /* private mode */
  }
}
