import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { platformSummary } from "../../lib/business"
import { requireAdmin } from "../../middleware/auth"

/**
 * GET /admin/stats — the admin Overview's marketplace numbers. Every sales
 * figure comes from the same domain summary as Insights → Business (orders
 * not cancelled, item value without delivery fees, one order per shop), so
 * the two screens can never disagree. Amounts in GHS major units.
 */
export const adminStats = new Hono<AppEnv>().use("*", requireAdmin).get("/", async (c) => {
  const [allTime, month, sellers, products] = await Promise.all([
    platformSummary(c, "all"),
    platformSummary(c, "30d"),
    c.get("authRepo").listSellers(),
    c.get("repo").listAdminProducts(),
  ])

  // Display-only GHS majors, deterministic to 2dp. Ledger math stays in
  // pesewas integers upstream; floats never flow back into money paths.
  const ghs = (pesewas: bigint): number => Number((Number(pesewas) / 100).toFixed(2))
  const thumbs = new Map(products.map((p) => [p.id, p.imageUrl]))

  return c.json({
    total_orders: allTime.orders,
    total_gmv_ghs: ghs(allTime.salesPesewas),
    active_sellers: sellers.filter((s) => s.status === "open").length,
    // What buyers can find — not drafts, listings in review or rejected ones.
    catalog_size: products.filter((p) => p.status === "published").length,
    gmv_last_30_days: month.series.map((p) => ({ date: p.key, amount: ghs(p.salesPesewas) })),
    top_products: allTime.topProducts.map((item) => ({
      title: item.title,
      thumbnail: thumbs.get(item.productId) ?? null,
      units: item.units,
      gmv: ghs(item.salesPesewas),
    })),
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
