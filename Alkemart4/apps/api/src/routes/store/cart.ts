import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"

const AddItemBody = z.object({
  offerId: z.string().min(1),
  qty: z.number().int().positive(),
})

const PatchItemBody = z.object({
  qty: z.number().int().min(0),
})

export const storeCart = new Hono<AppEnv>()
  .post("/", async (c) => {
    const cart = await c.get("checkoutRepo").createCart()
    return c.json({ cartId: cart.id }, 201)
  })
  .post("/:id/items", async (c) => {
    const parsed = AddItemBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const checkout = c.get("checkoutRepo")
    if (!(await checkout.getCart(c.req.param("id")))) {
      throw new HTTPException(404, { message: "cart not found" })
    }
    try {
      const item = await checkout.addCartItem(
        c.req.param("id"),
        parsed.data.offerId,
        parsed.data.qty,
      )
      return c.json({ item }, 201)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error"
      if (msg.includes("not sellable") || msg.includes("not found")) {
        throw new HTTPException(400, { message: msg })
      }
      throw err
    }
  })
  .patch("/:id/items/:itemId", async (c) => {
    const parsed = PatchItemBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const checkout = c.get("checkoutRepo")
    const cartId = c.req.param("id")
    const itemId = c.req.param("itemId")
    if (!(await checkout.getCart(cartId))) {
      throw new HTTPException(404, { message: "cart not found" })
    }
    try {
      const item = await checkout.setCartItemQty(cartId, itemId, parsed.data.qty)
      if (parsed.data.qty > 0 && !item) {
        throw new HTTPException(404, { message: "cart item not found" })
      }
      return c.json(item ? { item } : { ok: true })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      const msg = err instanceof Error ? err.message : "error"
      throw new HTTPException(400, { message: msg })
    }
  })
  .get("/:id", async (c) => {
    const checkout = c.get("checkoutRepo")
    const cart = await checkout.getCart(c.req.param("id"))
    if (!cart) throw new HTTPException(404, { message: "cart not found" })
    const items = await checkout.listCartItems(cart.id)
    const quote = await checkout.quote(cart.id)
    const enriched = []
    for (const i of items) {
      const view = await checkout.getOfferView(i.offerId)
      enriched.push({
        id: i.id,
        offerId: i.offerId,
        sellerId: i.sellerId,
        qty: i.qty,
        title: view?.productTitle ?? i.offerId,
        unitPricePesewas: (view?.offer.pricePesewas ?? 0n).toString(),
        sellerName: view?.sellerName ?? i.sellerId,
        sellerHandle: view?.sellerHandle ?? null,
      })
    }
    return c.json({
      cart: { id: cart.id, currency: cart.currency },
      items: enriched,
      quote: {
        currency: quote.currency,
        totalPesewas: quote.totalPesewas.toString(),
        sellers: quote.sellers.map((s) => ({
          sellerId: s.sellerId,
          subtotalPesewas: s.subtotalPesewas.toString(),
          deliveryFeePesewas: s.deliveryFeePesewas.toString(),
          sellerTotalPesewas: s.sellerTotalPesewas.toString(),
          lines: s.lines.map((l) => ({
            offerId: l.offerId,
            sellerId: l.sellerId,
            qty: l.qty,
            unitPricePesewas: l.unitPricePesewas.toString(),
            lineTotalPesewas: l.lineTotalPesewas.toString(),
          })),
        })),
      },
    })
  })
