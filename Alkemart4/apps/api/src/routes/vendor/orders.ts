import { checkSendPermission, InvalidFulfillmentTransitionError } from "@alkemart/domain"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { requireSeller } from "../../middleware/auth"
import { toE164Ghana } from "../../sms"

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

/**
 * Queue the buyer SMS for a fulfillment flip. Fire-and-forget by design:
 * enqueue failures never roll back the status write — the order already
 * flipped, and the dispatch job retries. No phone → no message, no error.
 * Classified transactional (the buyer's own order truth): preference
 * enforcement never blocks these, by Phase 7A rule.
 */
async function enqueueFulfillmentSms(
  c: {
    get: (k: "checkoutRepo") => {
      getOrderGroup(id: string): Promise<{ paymentIntentId: string } | null>
      getPaymentIntent(id: string): Promise<{ shippingAddress: { phone?: string } | null } | null>
      enqueueNotification(input: {
        key: string
        recipient: string
        body: string
        category?: "transactional" | "promotional" | "operational"
      }): Promise<unknown>
    }
  },
  order: { id: string; orderGroupId: string },
  status: "shipped" | "delivered",
) {
  try {
    const group = await c.get("checkoutRepo").getOrderGroup(order.orderGroupId)
    const intent = group ? await c.get("checkoutRepo").getPaymentIntent(group.paymentIntentId) : null
    const rawPhone = intent?.shippingAddress?.phone
    const to = typeof rawPhone === "string" ? toE164Ghana(rawPhone) : null
    if (!to) return
    const body =
      status === "shipped"
        ? `Alkemart: your order ${order.id.slice(0, 8)} is on its way. Track it in your orders.`
        : `Alkemart: your order ${order.id.slice(0, 8)} was delivered. Enjoy — reply here if anything is wrong.`
    await c.get("checkoutRepo").enqueueNotification({
      key: `${order.id}:${status}`,
      recipient: to,
      body,
      category: "transactional",
    })
  } catch {
    /* outbox write failed; status already flipped — dispatch retries nothing, ops sees no row */
  }
}

/**
 * Phase 7B — verified-purchase review request on delivery. Operational:
 * rides along unless the buyer refused (default allow), capped at 3
 * journey SMS per contact per day, one row per order (re-runs no-op).
 * Fire-and-forget like every other send here.
 */
async function enqueueReviewRequestSms(
  c: {
    get: (k: "checkoutRepo") => {
      getOrderGroup(id: string): Promise<{ buyerEmail: string; paymentIntentId: string } | null>
      getPaymentIntent(id: string): Promise<{ shippingAddress: { phone?: string } | null } | null>
      listNotificationPreferences(
        ownerType: "buyer" | "seller",
        ownerId: string,
      ): Promise<{ channel: string; category: string; topic: string | null; optedIn: boolean }[]>
      countRecentSends(recipient: string, channel: string, since: Date): Promise<number>
      enqueueNotification(input: {
        key: string
        recipient: string
        body: string
        category?: "transactional" | "promotional" | "operational"
      }): Promise<unknown>
    }
  },
  order: { id: string; orderGroupId: string },
) {
  try {
    const checkout = c.get("checkoutRepo")
    const group = await checkout.getOrderGroup(order.orderGroupId)
    if (!group) return
    const email = group.buyerEmail?.toLowerCase() ?? null
    if (!email) return
    const prefs = await checkout.listNotificationPreferences("buyer", email).catch(() => [])
    const decision = checkSendPermission(
      prefs.map((p) => ({
        channel: p.channel,
        category: p.category,
        topic: p.topic,
        optedIn: p.optedIn,
        frequencyCap: null,
      })),
      { channel: "sms", category: "operational" },
    )
    if (!decision.allowed) return
    const intent = await checkout.getPaymentIntent(group.paymentIntentId).catch(() => null)
    const rawPhone = intent?.shippingAddress?.phone
    const to = typeof rawPhone === "string" ? toE164Ghana(rawPhone) : null
    if (!to) return
    const sent = await checkout
      .countRecentSends(to, "sms", new Date(Date.now() - 24 * 3_600_000))
      .catch(() => 0)
    if (sent >= 3) return
    await checkout.enqueueNotification({
      key: `${order.id}:review-request`,
      recipient: to,
      body: `Alkemart: how was order ${order.id.slice(0, 8)}? Your verified review helps other buyers — find it on your orders page.`,
      category: "operational",
    })
  } catch {
    /* fire-and-forget */
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
      void enqueueFulfillmentSms(c, order, "shipped")
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
      void enqueueFulfillmentSms(c, order, "delivered")
      void enqueueReviewRequestSms(c, order)
      return c.json({ order: publicOrder(order) })
    } catch (err) {
      if (err instanceof InvalidFulfillmentTransitionError) {
        throw new HTTPException(400, { message: err.message })
      }
      throw err
    }
  })
