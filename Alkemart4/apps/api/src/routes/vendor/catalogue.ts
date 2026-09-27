import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { CatalogConflictError, CatalogValidationError } from "../../catalog-repository"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

/**
 * "Sell one like this" (phase 6): find a product already in the catalogue
 * and add your own price and stock to it. No new listing to write or wait on
 * review for; buyers compare your offer with the others on the same page.
 */
const SellBody = z.object({
  variantId: z.string().min(1).optional(),
  pricePesewas: z.string().regex(/^\d{1,12}$/),
  onHand: z.number().int().min(0).max(100_000),
  condition: z.enum(["new", "used_like_new", "used_good", "used_fair", "refurbished"]).optional(),
})

function sellerOf(c: Context<AppEnv>) {
  const id = c.get("auth").sellerId
  if (!id) throw new HTTPException(403, { message: "forbidden" })
  return id
}

export const vendorCatalogue = new Hono<AppEnv>()
  .use("*", requireSeller)
  /** Published products matching `q`, marking the ones you already sell. */
  .get("/search", async (c) => {
    const sellerId = sellerOf(c)
    const q = (c.req.query("q") ?? "").trim()
    if (q.length < 2) return c.json({ items: [] })
    const repo = c.get("repo")
    const [found, mine] = await Promise.all([repo.listCatalog({ q, limit: 20, offset: 0 }), repo.listVendorProducts(sellerId)])
    const sold = new Set(mine.map((p) => p.product.id))
    return c.json({
      items: found.items.map((p) => ({
        productId: p.productId,
        title: p.title,
        imageUrl: p.imageUrl,
        categoryName: p.categoryName,
        fromPricePesewas: p.fromPricePesewas,
        offerCount: p.offerCount,
        youSellThis: sold.has(p.productId),
      })),
    })
  })
  /** The versions (variants) of a product you could sell, with the lowest price on each. */
  .get("/:productId", async (c) => {
    sellerOf(c)
    const detail = await c.get("repo").getProduct(c.req.param("productId")).catch(() => null)
    if (!detail) throw new HTTPException(404, { message: "product not found" })
    // One entry per distinct version (option set); its variant comes from any offer on it.
    const seen = new Map<string, string>()
    for (const k of detail.combos) {
      const label = Object.values(k.options ?? {}).join(" · ") || "Standard"
      if (!seen.has(label)) seen.set(label, k.offerId)
    }
    const checkout = c.get("checkoutRepo")
    const versions = await Promise.all(
      [...seen.entries()].map(async ([label, offerId]) => ({ variantId: (await checkout.getOfferView(offerId).catch(() => null))?.offer.variantId ?? null, label })),
    )
    return c.json({
      productId: detail.productId,
      title: detail.title,
      imageUrl: detail.imageUrls[0] ?? null,
      versions: versions.length ? versions.filter((v) => v.variantId) : [{ variantId: null, label: "Standard" }],
      lowestPricePesewas: detail.offers.reduce<string | null>((m, o) => (m === null || BigInt(o.pricePesewas) < BigInt(m) ? o.pricePesewas : m), null),
      offerCount: detail.offers.length,
    })
  })
  .post("/:productId/sell", async (c) => {
    const sellerId = sellerOf(c)
    const parsed = SellBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Enter a price like 1500 or 1500.50 and how many you have." })
    const price = BigInt(parsed.data.pricePesewas)
    if (price <= 0n) throw new HTTPException(400, { message: "Enter a price above zero." })
    try {
      const r = await c.get("repo").addOfferToExistingProduct({
        sellerId,
        productId: c.req.param("productId"),
        variantId: parsed.data.variantId ?? null,
        pricePesewas: price,
        onHand: parsed.data.onHand,
        condition: parsed.data.condition ?? "new",
      })
      return c.json({ ok: true, ...r, productId: c.req.param("productId") }, 201)
    } catch (e) {
      if (e instanceof CatalogConflictError) throw new HTTPException(409, { message: "You already sell this. Change its price and stock from Products." })
      if (e instanceof CatalogValidationError) throw new HTTPException(400, { message: e.message })
      throw e
    }
  })
