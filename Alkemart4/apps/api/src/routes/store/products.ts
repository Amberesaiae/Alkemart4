import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { trackView } from "../../traffic"

export const products = new Hono<AppEnv>()
  /**
   * Phase 8A — governed alternatives: attribute-aware similar products for
   * the PDP "related alternatives" rail. Never peer offers (comparison
   * stays variant-exact); sellable-only with per-seller diversity caps.
   */
  .get("/:id/alternatives", async (c) => {
    const limit = Math.min(12, Math.max(1, Number(c.req.query("limit") ?? 8) || 8))
    const alternatives = await c.get("repo").listSimilarProducts(c.req.param("id"), limit)
    return c.json({ productId: c.req.param("id"), alternatives })
  })
  /**
   * Phase 3B — variant-safe peer comparison for one canonical product.
   * Confidence-gated: `seller_specific` products return
   * `{ comparisonEligible: false, offers: [] }` (no comparison claims).
   * Query: `?variant_id=<variantId>&sort=total|price|delivery|trust`.
   */
  .get("/:id/peers", async (c) => {
    const id = c.req.param("id")
    const rawSort = c.req.query("sort") ?? "total"
    const sort =
      rawSort === "price" || rawSort === "delivery" || rawSort === "trust" ? rawSort : "total"
    const variantId = c.req.query("variant_id")?.trim() || undefined
    const peers = await c.get("repo").peersForProduct(id, variantId, sort)
    if (!peers) throw new HTTPException(404, { message: "product not found" })
    // Phase 3A — recent integrity trail per offer (last 5 moves; empty when
    // the price never moved, never invented).
    const priceHistory: Record<string, unknown[]> = {}
    await Promise.all(
      peers.offers.map(async (o) => {
        priceHistory[o.offerId] = await c.get("repo").listOfferPriceHistory(o.offerId, 5).catch(() => [])
      }),
    )
    return c.json({ ...peers, priceHistory })
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id")
    const reviews = await c.get("checkoutRepo").listPublishedReviewsByProduct(id).catch(() => [])
    const detail = await c.get("repo").getProduct(id, reviews)
    if (!detail) throw new HTTPException(404, { message: "product not found" })
    trackView(c, detail.offers[0]?.sellerId, detail.productId)
    return c.json(detail)
  })
