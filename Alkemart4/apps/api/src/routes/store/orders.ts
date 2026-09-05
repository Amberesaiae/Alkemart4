import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import type {
  CheckoutRepository,
  OrderGroupRow,
  OrderItemRow,
  OrderRow,
} from "../../checkout-repository"
import { verifySessionJwt } from "../../lib/jwt"
import { requireAuth } from "../../middleware/auth"

function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function publicItem(item: OrderItemRow) {
  return {
    id: item.id,
    offerId: item.offerId,
    sellerId: item.sellerId,
    productId: item.productId,
    title: item.title,
    qty: item.qty,
    unitPricePesewas: item.unitPricePesewas.toString(),
  }
}

function publicOrder(order: OrderRow, items: OrderItemRow[]) {
  return {
    id: order.id,
    orderGroupId: order.orderGroupId,
    sellerId: order.sellerId,
    status: order.status,
    subtotalPesewas: order.subtotalPesewas.toString(),
    deliveryFeePesewas: order.deliveryFeePesewas.toString(),
    items: items.map(publicItem),
  }
}

async function serializeGroup(
  checkout: CheckoutRepository,
  group: OrderGroupRow & { createdAt?: Date },
) {
  const orders = await checkout.listOrdersForGroup(group.id)
  const withItems = await Promise.all(
    orders.map(async (order) => {
      const items = await checkout.listOrderItems(order.id)
      return publicOrder(order, items)
    }),
  )
  const fulfillmentStatuses = withItems.map((o) => o.status)
  let fulfillmentStatus = "placed"
  if (fulfillmentStatuses.every((s) => s === "delivered")) fulfillmentStatus = "delivered"
  else if (fulfillmentStatuses.some((s) => s === "shipped" || s === "delivered")) {
    fulfillmentStatus = "shipped"
  } else if (fulfillmentStatuses.some((s) => s === "cancelled")) {
    fulfillmentStatus = "cancelled"
  }

  const intent = await checkout.getPaymentIntent(group.paymentIntentId)

  return {
    id: group.id,
    buyerEmail: group.buyerEmail,
    totalPesewas: group.totalPesewas.toString(),
    currency: group.currency,
    createdAt: group.createdAt?.toISOString() ?? null,
    paymentStatus: "captured",
    fulfillmentStatus,
    shippingAddress: intent?.shippingAddress ?? null,
    orders: withItems,
  }
}

async function resolveGroupByIdOrOrderId(checkout: CheckoutRepository, id: string) {
  const asGroup = await checkout.getOrderGroup(id)
  if (asGroup) return asGroup
  const asOrder = await checkout.getOrder(id)
  if (!asOrder) return null
  return checkout.getOrderGroup(asOrder.orderGroupId)
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, token, extra] = header.split(" ")
  if (!scheme || !token || extra || scheme.toLowerCase() !== "bearer") return null
  return token
}

const LookupBody = z.object({
  orderId: z.string().min(1),
  email: z.string().email(),
})

export const storeOrders = new Hono<AppEnv>()
  .get("/", requireAuth, async (c) => {
    const auth = c.get("auth")
    const user = await c.get("authRepo").findUserById(auth.userId)
    if (!user) throw new HTTPException(401, { message: "unauthorized" })

    const groups = await c.get("checkoutRepo").listOrderGroupsByBuyerEmail(user.email)
    const items = await Promise.all(
      groups.map((g) => serializeGroup(c.get("checkoutRepo"), g)),
    )
    return c.json({ items })
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id")
    const checkout = c.get("checkoutRepo")
    const group = await resolveGroupByIdOrOrderId(checkout, id)
    if (!group) throw new HTTPException(404, { message: "order not found" })

    const token = bearerToken(c.req.header("Authorization"))
    const secret = c.get("jwtSecret")
    if (token && secret) {
      try {
        const auth = await verifySessionJwt(token, secret)
        const user = await c.get("authRepo").findUserById(auth.userId)
        if (user && emailsMatch(user.email, group.buyerEmail)) {
          return c.json({ orderGroup: await serializeGroup(checkout, group) })
        }
      } catch {
        /* guests use POST /lookup */
      }
    }

    throw new HTTPException(404, { message: "order not found" })
  })
  .post("/lookup", async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      throw new HTTPException(400, { message: "invalid json" })
    }
    const parsed = LookupBody.safeParse(body)
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })

    const checkout = c.get("checkoutRepo")
    const group = await resolveGroupByIdOrOrderId(checkout, parsed.data.orderId)
    // Anti-enumeration: same 404 whether missing or email mismatch.
    if (!group || !emailsMatch(group.buyerEmail, parsed.data.email)) {
      throw new HTTPException(404, { message: "order not found" })
    }
    return c.json({ orderGroup: await serializeGroup(checkout, group) })
  })
