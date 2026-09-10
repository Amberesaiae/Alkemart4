import { shopViews } from "@alkemart/db"
import { and, eq, gte, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type ShopTrafficPoint = { date: string; views: number }
export type TopViewedProduct = { productId: string; views: number }

export type TopViewedSeller = { sellerId: string; views: number }

export interface TrafficStore {
  /** Fire-and-forget view counter. Never throws. */
  recordView(sellerId: string, productId: string | null, day: Date): Promise<void>
  /** Last-30-day daily views + top products for one seller. */
  shopStats(sellerId: string, days?: number): Promise<{ series: ShopTrafficPoint[]; top: TopViewedProduct[] }>
  /** Platform-wide daily views + top sellers by views. */
  platformStats(days?: number): Promise<{ series: ShopTrafficPoint[]; topSellers: TopViewedSeller[] }>
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Fire-and-forget view counter for read routes. Reads never wait on it.
 * Uses waitUntil when an execution context exists (Workers runtime);
 * falls back to inline recording otherwise (unit tests). Never throws.
 */
export function trackView(
  c: {
    get(key: "traffic"): TrafficStore
    executionCtx: { waitUntil(promise: Promise<unknown>): void }
  },
  sellerId: string | undefined,
  productId: string | null,
): void {
  if (!sellerId) return
  const run = () => c.get("traffic").recordView(sellerId, productId, new Date())
  try {
    // Accessing executionCtx throws outside the runtime — hence try/catch.
    c.executionCtx.waitUntil(run())
  } catch {
    void run().catch(() => {})
  }
}

export class PostgresTrafficStore implements TrafficStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async recordView(sellerId: string, productId: string | null, day: Date): Promise<void> {
    try {
      const dayStr = dayKey(day)
      if (productId) {
        await this.db.execute(sql`
          INSERT INTO shop_views (seller_id, product_id, day, views)
          VALUES (${sellerId}, ${productId}, ${dayStr}, 1)
          ON CONFLICT (seller_id, product_id, day)
          DO UPDATE SET views = shop_views.views + 1`)
      } else {
        await this.db.execute(sql`
          INSERT INTO shop_views (seller_id, product_id, day, views)
          VALUES (${sellerId}, NULL, ${dayStr}, 1)
          ON CONFLICT (seller_id, day) WHERE product_id IS NULL
          DO UPDATE SET views = shop_views.views + 1`)
      }
    } catch (err) {
      console.warn(`[traffic] recordView failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  async shopStats(sellerId: string, days = 30): Promise<{ series: ShopTrafficPoint[]; top: TopViewedProduct[] }> {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))
    const rows = await this.db
      .select()
      .from(shopViews)
      .where(and(eq(shopViews.sellerId, sellerId), gte(shopViews.day, since)))
    const byDay = new Map<string, number>()
    const byProduct = new Map<string, number>()
    for (const r of rows) {
      const key = dayKey(r.day)
      byDay.set(key, (byDay.get(key) ?? 0) + (r.views ?? 0))
      if (r.productId) byProduct.set(r.productId, (byProduct.get(r.productId) ?? 0) + (r.views ?? 0))
    }
    const series: ShopTrafficPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(since.getTime() + (days - 1 - i) * 86_400_000)
      const key = dayKey(d)
      series.push({ date: key, views: byDay.get(key) ?? 0 })
    }
    const top = [...byProduct]
      .map(([productId, views]) => ({ productId, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
    return { series, top }
  }

  async platformStats(days = 30): Promise<{ series: ShopTrafficPoint[]; topSellers: TopViewedSeller[] }> {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))
    const rows = await this.db
      .select()
      .from(shopViews)
      .where(gte(shopViews.day, since))
    const byDay = new Map<string, number>()
    const bySeller = new Map<string, number>()
    for (const r of rows) {
      const key = dayKey(r.day)
      byDay.set(key, (byDay.get(key) ?? 0) + (r.views ?? 0))
      bySeller.set(r.sellerId, (bySeller.get(r.sellerId) ?? 0) + (r.views ?? 0))
    }
    const series: ShopTrafficPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(since.getTime() + (days - 1 - i) * 86_400_000)
      const key = dayKey(d)
      series.push({ date: key, views: byDay.get(key) ?? 0 })
    }
    const topSellers = [...bySeller]
      .map(([sellerId, views]) => ({ sellerId, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
    return { series, topSellers }
  }
}

export class InMemoryTrafficStore implements TrafficStore {
  private readonly counts = new Map<string, number>()

  async recordView(sellerId: string, productId: string | null, day: Date): Promise<void> {
    const key = `${sellerId}|${productId ?? ""}|${dayKey(day)}`
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1)
  }

  async shopStats(sellerId: string, days = 30): Promise<{ series: ShopTrafficPoint[]; top: TopViewedProduct[] }> {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))
    const byDay = new Map<string, number>()
    const byProduct = new Map<string, number>()
    for (const [key, views] of this.counts) {
      const [sid, pid, day] = key.split("|")
      if (sid !== sellerId) continue
      if (new Date(`${day}T00:00:00Z`) < since) continue
      byDay.set(day, (byDay.get(day) ?? 0) + views)
      if (pid) byProduct.set(pid, (byProduct.get(pid) ?? 0) + views)
    }
    const series: ShopTrafficPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(since.getTime() + (days - 1 - i) * 86_400_000)
      const key = dayKey(d)
      series.push({ date: key, views: byDay.get(key) ?? 0 })
    }
    const top = [...byProduct]
      .map(([productId, views]) => ({ productId, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
    return { series, top }
  }

  async platformStats(days = 30): Promise<{ series: ShopTrafficPoint[]; topSellers: TopViewedSeller[] }> {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))
    const byDay = new Map<string, number>()
    const bySeller = new Map<string, number>()
    for (const [key, views] of this.counts) {
      const [sid, , day] = key.split("|")
      if (new Date(`${day}T00:00:00Z`) < since) continue
      byDay.set(day, (byDay.get(day) ?? 0) + views)
      bySeller.set(sid, (bySeller.get(sid) ?? 0) + views)
    }
    const series: ShopTrafficPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(since.getTime() + (days - 1 - i) * 86_400_000)
      const key = dayKey(d)
      series.push({ date: key, views: byDay.get(key) ?? 0 })
    }
    const topSellers = [...bySeller]
      .map(([sellerId, views]) => ({ sellerId, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
    return { series, topSellers }
  }
}
