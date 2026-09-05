import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { CheckoutRepository, OrderGroupRow } from "../../checkout-repository"
import type { AppEnv } from "../../context"
import { requireAdmin } from "../../middleware/auth"

async function serializeAdminGroup(
  checkout: CheckoutRepository,
  group: OrderGroupRow & { createdAt?: Date },
) {
  const orders = await checkout.listOrdersForGroup(group.id)
  const intent = await checkout.getPaymentIntent(group.paymentIntentId)
  const withItems = await Promise.all(
    orders.map(async (o) => {
      const items = await checkout.listOrderItems(o.id)
      return {
        id: o.id,
        sellerId: o.sellerId,
        status: o.status,
        subtotalPesewas: o.subtotalPesewas.toString(),
        deliveryFeePesewas: o.deliveryFeePesewas.toString(),
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          qty: item.qty,
          unitPricePesewas: item.unitPricePesewas.toString(),
          productId: item.productId,
          offerId: item.offerId,
        })),
      }
    }),
  )
  return {
    id: group.id,
    buyerEmail: group.buyerEmail,
    totalPesewas: group.totalPesewas.toString(),
    currency: group.currency,
    createdAt: group.createdAt?.toISOString() ?? null,
    shippingAddress: intent?.shippingAddress ?? null,
    paymentMethod: intent?.method ?? null,
    paymentStatus: intent?.status ?? null,
    orders: withItems,
  }
}

export const adminOrders = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const limitRaw = Number(c.req.query("limit") ?? "50")
    const limit = Number.isFinite(limitRaw) ? limitRaw : 50
    const checkout = c.get("checkoutRepo")
    const groups = await checkout.listRecentOrderGroups(limit)
    const items = await Promise.all(
      groups.map((group) => serializeAdminGroup(checkout, group)),
    )
    return c.json({ items })
  })
  .get("/:id", async (c) => {
    const checkout = c.get("checkoutRepo")
    const id = c.req.param("id")
    let group = await checkout.getOrderGroup(id)
    if (!group) {
      const asOrder = await checkout.getOrder(id)
      if (asOrder) group = await checkout.getOrderGroup(asOrder.orderGroupId)
    }
    if (!group) throw new HTTPException(404, { message: "order not found" })
    return c.json({ orderGroup: await serializeAdminGroup(checkout, group) })
  })
