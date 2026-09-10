import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { requireAdmin } from "../../middleware/auth"

const DAY_MS = 86_400_000

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * GET /admin/stats — platform analytics for the admin dashboard.
 * Totals + 30-day GMV series + top products. Amounts in GHS major units.
 */
export const adminStats = new Hono<AppEnv>().use("*", requireAdmin).get("/", async (c) => {
  const checkout = c.get("checkoutRepo")
  const authRepo = c.get("authRepo")
  const catalog = c.get("repo")

  const [orderStats, sellers, products] = await Promise.all([
    checkout.platformOrderStats(),
    authRepo.listSellers(),
    catalog.listAdminProducts(),
  ])

  const totalOrders = orderStats.groups.length
  const totalGmvPesewas = orderStats.groups.reduce((sum, g) => sum + g.totalPesewas, 0n)
  const activeSellers = sellers.filter((s) => s.status === "open").length

  const buckets = new Map<string, bigint>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 29; i >= 0; i--) {
    buckets.set(dayKey(new Date(today.getTime() - i * DAY_MS)), 0n)
  }
  for (const g of orderStats.groups) {
    const key = dayKey(g.createdAt)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0n) + g.totalPesewas)
  }
  const gmvLast30Days = [...buckets].map(([date, pesewas]) => ({
    date,
    amount: Number(pesewas) / 100,
  }))

  const thumbs = new Map(products.map((p) => [p.id, p.imageUrl]))
  const topProducts = orderStats.topItems.map((item) => ({
    title: item.title,
    thumbnail: thumbs.get(item.productId) ?? null,
    units: item.units,
    gmv: Number(item.gmvPesewas) / 100,
  }))

  return c.json({
    total_orders: totalOrders,
    total_gmv_ghs: Number(totalGmvPesewas) / 100,
    active_sellers: activeSellers,
    catalog_size: products.length,
    gmv_last_30_days: gmvLast30Days,
    top_products: topProducts,
  })
})

/**
 * GET /admin/stats/traffic — platform traffic for the admin dashboard.
 * 30-day view series + top shops by views (bucket pattern mirrors "/").
 */
export const adminTrafficStats = new Hono<AppEnv>().use("*", requireAdmin).get("/", async (c) => {
  const emptyTraffic: { series: { date: string; views: number }[]; topSellers: { sellerId: string; views: number }[] } = {
    series: [],
    topSellers: [],
  }
  const [{ series, topSellers }, sellers] = await Promise.all([
    c.get("traffic").platformStats().catch(() => emptyTraffic),
    c.get("authRepo").listSellers().catch(() => []),
  ])
  const byId = new Map(sellers.map((s) => [s.id, s]))
  const views30d = series.reduce((sum, d) => sum + d.views, 0)
  return c.json({
    views30d,
    series,
    top_shops: topSellers.map((t) => ({
      sellerId: t.sellerId,
      name: byId.get(t.sellerId)?.name ?? t.sellerId,
      handle: byId.get(t.sellerId)?.handle ?? null,
      views: t.views,
    })),
  })
})
