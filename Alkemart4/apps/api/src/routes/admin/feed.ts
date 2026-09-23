import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { requireAdmin } from "../../middleware/auth"

type Mismatch = {
  productId: string
  field: "price" | "availability" | "brand"
  feed: string | null
  live: string | null
}

/**
 * Phase 6D — feed diagnostics. Re-derives price, availability, and brand
 * from the product-detail path (an independent mapping of the same
 * snapshot) and diffs it against the feed rows, plus exclusion counts for
 * missing images, brands, and identifiers.
 */
export const adminFeed = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/diagnostics", async (c) => {
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 100) || 100))
    const rows = await c.get("repo").listFeedProducts(limit, 0)
    const mismatches: Mismatch[] = []
    const exclusions = {
      missingImage: 0,
      missingBrand: 0,
      missingIdentifiers: 0,
      missingCondition: 0,
    }
    for (const row of rows) {
      if (!row.imageUrl) exclusions.missingImage += 1
      if (!row.brand) exclusions.missingBrand += 1
      if (!row.gtin && !row.mpn) exclusions.missingIdentifiers += 1
      if (!row.condition) exclusions.missingCondition += 1
      const detail = await c.get("repo").getProduct(row.productId).catch(() => null)
      if (!detail) {
        mismatches.push({ productId: row.productId, field: "availability", feed: "in_stock", live: "gone" })
        continue
      }
      const best = detail.offers[0] ?? null
      const livePrice = best ? BigInt(best.pricePesewas).toString() : null
      if (livePrice !== BigInt(row.pricePesewas).toString()) {
        mismatches.push({ productId: row.productId, field: "price", feed: row.pricePesewas, live: livePrice })
      }
      const liveBrand = detail.identity?.brand ?? null
      if ((liveBrand ?? null) !== row.brand) {
        mismatches.push({ productId: row.productId, field: "brand", feed: row.brand, live: liveBrand })
      }
    }
    return c.json({
      generatedAt: new Date().toISOString(),
      checked: rows.length,
      mismatches,
      mismatchCount: mismatches.length,
      exclusions,
    })
  })
