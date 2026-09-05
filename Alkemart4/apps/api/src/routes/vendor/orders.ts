import { InvalidFulfillmentTransitionError } from "@alkemart/domain"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { requireSeller } from "../../middleware/auth"

function publicOrder(order: {
  id: string
  orderGroupId: string
  sellerId: string
  subtotalPesewas: bigint
  deliveryFeePesewas: bigint
  status: string
}) {
  return {
    id: order.id,
    orderGroupId: order.orderGroupId,
    sellerId: order.sellerId,
    subtotalPesewas: order.subtotalPesewas.toString(),
    deliveryFeePesewas: order.deliveryFeePesewas.toString(),
    status: order.status,
  }
}

export const vendorOrders = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/", async (c) => {
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    const orders = await c.get("checkoutRepo").listOrdersForSeller(sellerId)
    return c.json({ items: orders.map(publicOrder) })
  })
  .get("/:id", async (c) => {
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    const checkout = c.get("checkoutRepo")
    const order = await checkout.getOrder(c.req.param("id"))
    if (!order || order.sellerId !== sellerId) {
      throw new HTTPException(404, { message: "order not found" })
    }
    const items = await checkout.listOrderItems(order.id)
    const group = await checkout.getOrderGroup(order.orderGroupId)
    const intent = group
      ? await checkout.getPaymentIntent(group.paymentIntentId)
      : null
    return c.json({
      order: {
        ...publicOrder(order),
        buyerEmail: group?.buyerEmail ?? null,
        shippingAddress: intent?.shippingAddress ?? null,
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          qty: item.qty,
          unitPricePesewas: item.unitPricePesewas.toString(),
          productId: item.productId,
          offerId: item.offerId,
        })),
      },
    })
  })
  .post("/:id/ship", async (c) => {
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    try {
      const order = await c.get("checkoutRepo").updateOrderStatus(
        c.req.param("id"),
        sellerId,
        "shipped",
      )
      if (!order) throw new HTTPException(404, { message: "order not found" })
      return c.json({ order: publicOrder(order) })
    } catch (err) {
      if (err instanceof InvalidFulfillmentTransitionError) {
        throw new HTTPException(400, { message: err.message })
      }
      throw err
    }
  })
  .post("/:id/deliver", async (c) => {
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    try {
      const order = await c.get("checkoutRepo").updateOrderStatus(
        c.req.param("id"),
        sellerId,
        "delivered",
      )
      if (!order) throw new HTTPException(404, { message: "order not found" })
      return c.json({ order: publicOrder(order) })
    } catch (err) {
      if (err instanceof InvalidFulfillmentTransitionError) {
        throw new HTTPException(400, { message: err.message })
      }
      throw err
    }
  })
