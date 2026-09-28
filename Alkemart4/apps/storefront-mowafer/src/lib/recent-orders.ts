const KEY = "alkemart.mowafer.recent_order_ids"
const MAX = 5

export function listRecentOrderIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX)
  } catch {
    return []
  }
}

export function rememberOrderId(id: string): void {
  const clean = id.trim()
  if (!clean) return
  try {
    const next = [clean, ...listRecentOrderIds().filter((x) => x !== clean)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
}
