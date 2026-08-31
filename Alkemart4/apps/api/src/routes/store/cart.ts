import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"

const AddItemBody = z.object({
  offerId: z.string().min(1),
  qty: z.number().int().positive(),
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
  .get("/:id", async (c) => {
    const checkout = c.get("checkoutRepo")
    const cart = await checkout.getCart(c.req.param("id"))
    if (!cart) throw new HTTPException(404, { message: "cart not found" })
    const items = await checkout.listCartItems(cart.id)
    const quote = await checkout.quote(cart.id)
    return c.json({
      cart: { id: cart.id, currency: cart.currency },
      items: items.map((i) => ({
        id: i.id,
        offerId: i.offerId,
        sellerId: i.sellerId,
        qty: i.qty,
      })),
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
