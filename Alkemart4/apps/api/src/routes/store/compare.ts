import { CompareRuleError, DEFAULT_COMPARE_POLICY, compareSelection, nextRefillAt, type CompareWallet, type ProductDetailDto } from "@alkemart/domain"
import { Hono, type Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { clockOf, shopReturnDaysAt } from "../../lib/returns"
import { readJsonBody } from "../../lib/session"
import { requireFreshSession } from "../../middleware/auth"

/**
 * ⚖ Compare mode. Signed-in buyers pick 2–4 products; opening the side-by-side
 * view uses one token (5 on joining, topped back up every two weeks). A saved
 * comparison reopens free. Rows are built from the live catalogue, so prices
 * are always today's; nothing here ranks or hides a seller.
 */
const OpenBody = z.object({ productIds: z.array(z.string().min(1)).max(10) })

const policy = DEFAULT_COMPARE_POLICY

const walletJson = (w: CompareWallet) => ({
  balance: w.balance,
  grant: policy.grant,
  nextRefillAt: nextRefillAt(w, policy).toISOString(),
  maxItems: policy.maxItems,
})

/** One column of the comparison: the cheapest delivered offer and the facts buyers weigh. */
async function column(c: Context<AppEnv>, p: ProductDetailDto) {
  const inStock = p.offers.filter((o) => o.available > 0)
  const pool = inStock.length ? inStock : p.offers
  const total = (o: (typeof pool)[number]) => BigInt(o.pricePesewas) + BigInt(o.deliveryFeePesewas)
  const best = [...pool].sort((a, b) => (total(a) < total(b) ? -1 : total(a) > total(b) ? 1 : 0))[0] ?? null
  let policies
  try {
    policies = c.get("policies")
  } catch {
    policies = undefined
  }
  const returnsDays = best ? await shopReturnDaysAt(policies, best.sellerId, null) : null
  return {
    productId: p.productId,
    slug: p.slug,
    title: p.title,
    imageUrl: p.imageUrls[0] ?? null,
    brand: p.identity.brand,
    model: p.identity.model,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    shops: new Set(p.offers.map((o) => o.sellerId)).size,
    inStock: inStock.length > 0,
    best: best
      ? {
          offerId: best.offerId,
          sellerName: best.sellerName,
          sellerHandle: best.sellerHandle,
          pricePesewas: best.pricePesewas,
          deliveryFeePesewas: best.deliveryFeePesewas,
          totalPesewas: total(best).toString(),
          currency: best.currency,
          condition: best.condition,
          warranty: best.warrantyRef,
          deliveryPromise: best.deliveryPromise,
        }
      : null,
    returnsDays,
    attributes: p.attributes,
  }
}

async function me(c: Context<AppEnv>) {
  return c.get("auth").userId
}

export const storeCompare = new Hono<AppEnv>()
  .use("*", requireFreshSession)
  .get("/tokens", async (c) => {
    const w = await c.get("compare").wallet(await me(c), clockOf(c.get("checkoutRepo")), policy)
    return c.json(walletJson(w))
  })
  /** Spend one token and save the comparison; the page then opens it by id. */
  .post("/", async (c) => {
    const parsed = OpenBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Pick the products to compare." })
    let ids: string[]
    try {
      ids = compareSelection(parsed.data.productIds, policy)
    } catch (e) {
      throw new HTTPException(400, { message: (e as Error).message })
    }
    const found = await Promise.all(ids.map((id) => c.get("repo").getProduct(id).catch(() => null)))
    if (found.some((p) => !p)) throw new HTTPException(404, { message: "One of those products isn't available any more." })
    try {
      const { wallet, comparison } = await c.get("compare").open(await me(c), ids, clockOf(c.get("checkoutRepo")), policy)
      return c.json({ id: comparison.id, tokens: walletJson(wallet) }, 201)
    } catch (e) {
      if (e instanceof CompareRuleError) throw new HTTPException(402, { message: e.message })
      throw e
    }
  })
  .get("/:id", async (c) => {
    const saved = await c.get("compare").get(c.req.param("id"))
    if (!saved || saved.userId !== (await me(c))) throw new HTTPException(404, { message: "comparison not found" })
    const products = await Promise.all(saved.productIds.map((id) => c.get("repo").getProduct(id).catch(() => null)))
    const columns = await Promise.all(products.filter((p): p is ProductDetailDto => !!p).map((p) => column(c, p)))
    const w = await c.get("compare").wallet(saved.userId, clockOf(c.get("checkoutRepo")), policy)
    return c.json({ id: saved.id, createdAt: saved.createdAt.toISOString(), columns, missing: products.length - columns.length, tokens: walletJson(w) })
  })
