/**
 * Load seller-scoped analytics from the live API.
 * Uses GET /vendor/alkemart/stats (Postgres via Medusa graph) — not mock data.
 */

declare const __BACKEND_URL__: string

export type SellerReadinessSlice = {
  phase: string
  setup_complete: boolean
  can_propose_products: boolean
  can_create_offers: boolean
  checklist?: Record<string, boolean>
  next_action?: { code: string; label: string } | null
  mercur_status?: string
}

export type SellerStatsPayload = {
  generated_at: string
  source?: "medusa_graph"
  scope?: "seller"
  seller_id?: string
  products: { published: number; draft: number; total: number }
  sellers: { open: number; total: number }
  offers: { total: number }
  orders: {
    total: number
    gmv_by_currency: Record<string, number>
    by_status: { name: string; value: number }[]
  }
  series: {
    days: { date: string; orders: number; gmv: number }[]
    primary_currency: string
  }
  catalog_mix: { name: string; value: number }[]
  /** Present when /vendor/alkemart/stats includes readiness (onboarding ADR) */
  readiness?: SellerReadinessSlice | null
}

function backendBase(): string {
  const raw =
    typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__
      ? __BACKEND_URL__
      : "http://localhost:9000"
  return raw.replace(/\/$/, "")
}

/**
 * Prefer server-side aggregation (order_seller + product_seller + offers).
 * Falls back to vendor list endpoints if the stats route is unavailable.
 */
export async function loadSellerStats(): Promise<SellerStatsPayload> {
  const base = backendBase()
  const res = await fetch(`${base}/vendor/alkemart/stats`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
  if (res.ok) {
    return (await res.json()) as SellerStatsPayload
  }
  if (res.status === 401) {
    throw new Error("Sign in required to load analytics.")
  }
  if (res.status === 400) {
    throw new Error(
      "Select your store first (store picker), then open Analytics.",
    )
  }

  // Fallback: client-side aggregation from vendor lists (still live, not mock)
  return loadSellerStatsFromLists(base)
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

function money(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  if (v && typeof v === "object" && "value" in (v as object)) {
    const n = Number((v as { value: unknown }).value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function lastNDays(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    out.push(dayKey(d))
  }
  return out
}

async function loadSellerStatsFromLists(
  base: string,
): Promise<SellerStatsPayload> {
  const days = lastNDays(30)
  const dayOrders = new Map(days.map((d) => [d, 0]))
  const dayGmv = new Map(days.map((d) => [d, 0]))
  const statusCounts = new Map<string, number>()
  const gmv: Record<string, number> = {}
  let ordersTotal = 0
  let offersTotal = 0
  let productsPublished = 0
  let productsDraft = 0

  try {
    const raw = (await getJson(
      `${base}/vendor/orders?limit=200&fields=id,created_at,total,currency_code,status`,
    )) as { orders?: Record<string, unknown>[]; count?: number }
    const list = Array.isArray(raw.orders) ? raw.orders : []
    ordersTotal = typeof raw.count === "number" ? raw.count : list.length
    for (const o of list) {
      const cur = String(o.currency_code ?? "ghs").toLowerCase()
      const total = money(o.total)
      gmv[cur] = (gmv[cur] ?? 0) + total
      const st = String(o.status ?? "unknown").toLowerCase()
      statusCounts.set(st, (statusCounts.get(st) ?? 0) + 1)
      const created = o.created_at ? new Date(String(o.created_at)) : null
      if (created && !Number.isNaN(created.getTime())) {
        const k = dayKey(created)
        if (dayOrders.has(k)) {
          dayOrders.set(k, (dayOrders.get(k) ?? 0) + 1)
          dayGmv.set(k, (dayGmv.get(k) ?? 0) + total)
        }
      }
    }
  } catch {
    /* */
  }

  try {
    const raw = (await getJson(`${base}/vendor/offers?limit=200&fields=id`)) as {
      offers?: unknown[]
      count?: number
    }
    offersTotal =
      typeof raw.count === "number"
        ? raw.count
        : Array.isArray(raw.offers)
          ? raw.offers.length
          : 0
  } catch {
    /* */
  }

  try {
    const raw = (await getJson(
      `${base}/vendor/alkemart/products?limit=100`,
    )) as { products?: { status?: string }[]; count?: number }
    const list = Array.isArray(raw.products) ? raw.products : []
    for (const p of list) {
      const st = String(p.status ?? "").toLowerCase()
      if (st === "published") productsPublished += 1
      else productsDraft += 1
    }
    if (!list.length && typeof raw.count === "number") {
      productsPublished = raw.count
    }
  } catch {
    /* */
  }

  const primary_currency =
    Object.entries(gmv).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "ghs"

  return {
    generated_at: new Date().toISOString(),
    source: "medusa_graph",
    scope: "seller",
    products: {
      published: productsPublished,
      draft: productsDraft,
      total: productsPublished + productsDraft,
    },
    sellers: { open: 1, total: 1 },
    offers: { total: offersTotal },
    orders: {
      total: ordersTotal,
      gmv_by_currency: gmv,
      by_status: Array.from(statusCounts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    },
    series: {
      days: days.map((date) => ({
        date,
        orders: dayOrders.get(date) ?? 0,
        gmv: dayGmv.get(date) ?? 0,
      })),
      primary_currency,
    },
    catalog_mix: [
      { name: "Your offers", value: offersTotal },
      { name: "Published products", value: productsPublished },
      { name: "Orders", value: ordersTotal },
    ].filter((x) => x.value > 0),
  }
}
