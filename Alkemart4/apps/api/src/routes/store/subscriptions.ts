import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAuth } from "../../middleware/auth"

const PesewasString = z.string().regex(/^\d+$/)

const CreateBody = z.object({
  productId: z.string().min(1),
  offerId: z.string().min(1).optional().nullable(),
  kind: z.enum(["back_in_stock", "price_drop"]),
  belowPesewas: PesewasString.optional().nullable(),
})

async function buyerEmail(c: {
  get(k: "auth"): AppEnv["Variables"]["auth"]
  get(k: "authRepo"): AppEnv["Variables"]["authRepo"]
}): Promise<string> {
  const auth = c.get("auth")
  if (auth.role !== "buyer") throw new HTTPException(403, { message: "buyer account required" })
  const user = await c.get("authRepo").findUserById(auth.userId)
  if (!user) throw new HTTPException(401, { message: "unknown buyer" })
  return user.email.toLowerCase()
}

/**
 * Phase 7B — stock/price alert subscriptions. The contact always comes from
 * the authenticated buyer session — never from the body — so this endpoint
 * cannot be used as a spam cannon. Alerts fire one-shot: firing deletes
 * the subscription, and re-alerting needs a fresh subscribe.
 */
export const storeSubscriptions = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const email = await buyerEmail(c)
    const items = await c.get("checkoutRepo").listStockSubscriptions({ buyerEmail: email })
    return c.json({
      items: items.map((s) => ({
        id: s.id,
        productId: s.productId,
        offerId: s.offerId,
        kind: s.kind,
        belowPesewas: s.belowPesewas,
        createdAt: s.createdAt.toISOString(),
      })),
    })
  })
  .post("/", async (c) => {
    const parsed = CreateBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const email = await buyerEmail(c)
    const product = await c.get("repo").getProduct(parsed.data.productId).catch(() => null)
    if (!product) throw new HTTPException(404, { message: "product not found" })
    if (parsed.data.offerId) {
      const offers = [...(product.combos ?? []).map((co) => co.offerId), ...product.offers.map((o) => o.offerId)]
      if (!offers.includes(parsed.data.offerId)) {
        throw new HTTPException(400, { message: "offer is not on this product" })
      }
    }
    if (parsed.data.kind === "price_drop" && parsed.data.belowPesewas == null) {
      throw new HTTPException(400, { message: "price_drop needs belowPesewas" })
    }
    const sub = await c.get("checkoutRepo").createStockSubscription({
      buyerEmail: email,
      productId: parsed.data.productId,
      offerId: parsed.data.offerId ?? null,
      kind: parsed.data.kind,
      belowPesewas:
        parsed.data.belowPesewas !== undefined && parsed.data.belowPesewas !== null
          ? BigInt(parsed.data.belowPesewas)
          : null,
      channel: "sms",
    }).catch((err: unknown) => {
      throw new HTTPException(400, { message: err instanceof Error ? err.message : "invalid subscription" })
    })
    return c.json({
      subscription: {
        id: sub.id,
        productId: sub.productId,
        offerId: sub.offerId,
        kind: sub.kind,
        belowPesewas: sub.belowPesewas,
      },
    }, 201)
  })
  .delete("/:id", async (c) => {
    const email = await buyerEmail(c)
    const deleted = await c.get("checkoutRepo").deleteStockSubscription(c.req.param("id"), email)
    if (!deleted) throw new HTTPException(404, { message: "subscription not found" })
    return c.json({ deleted: true })
  })
