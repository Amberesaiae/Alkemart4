import { orderReference } from "@alkemart/shared/order-ref"
import { orderClock, paymentState } from "../../lib/order-clock"
import { enqueueOrderStatusEmail, orderEmailLinks } from "../../lib/order-emails"
import {
  HANDOVER_MAX_FAILURES,
  checkSendPermission,
  handoverMatches,
  InvalidFulfillmentTransitionError,
  payoutReleaseAt,
  type DeliveryConfirmedBy,
} from "@alkemart/domain"
import { readJsonBody } from "../../lib/session"
import { deliveryPolicy } from "../../lib/delivery-policy"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { requireSeller } from "../../middleware/auth"
import { DEFAULT_PAYOUT_POLICY } from "@alkemart/domain"
import { MAX_QUEUE_DELAY_SECONDS, autoPayoutMessage, publishJob } from "../../jobs"
import { autoPayAfter } from "../../lib/payouts"
import { toE164Ghana } from "../../sms"
import { publicReturnCase, returnPolicy, sweepDueReturns } from "../../lib/returns"

function publicOrder(order: {
  id: string
  orderGroupId: string
  sellerId: string
  subtotalPesewas: bigint
  deliveryFeePesewas: bigint
  status: string
  dispatchBy?: Date | null
  deliverLatest?: Date | null
  fulfillmentMethod?: "delivery" | "pickup"
  deliveryZone?: string | null
  handoverCode?: string | null
  handoverFailures?: number
  deliveryConfirmedBy?: string | null
  payoutReleaseAt?: Date | null
}, handoverMaxFailures = HANDOVER_MAX_FAILURES) {
  return {
    id: order.id,
    orderGroupId: order.orderGroupId,
    sellerId: order.sellerId,
    subtotalPesewas: order.subtotalPesewas.toString(),
    deliveryFeePesewas: order.deliveryFeePesewas.toString(),
    status: order.status,
    // Deadlines the seller works to (0036); null on legacy orders.
    dispatchBy: order.dispatchBy?.toISOString() ?? null,
    deliverBy: order.deliverLatest?.toISOString() ?? null,
    fulfillmentMethod: order.fulfillmentMethod ?? "delivery",
    deliveryZone: order.deliveryZone ?? null,
    // The code itself never reaches the seller — only whether one is needed.
    handoverAvailable: !!order.handoverCode && (order.handoverFailures ?? 0) < handoverMaxFailures,
    deliveryConfirmedBy: order.deliveryConfirmedBy ?? null,
    // Only while still waiting out the buyer's report window; null once payable.
    payoutReleaseAt: order.payoutReleaseAt && order.payoutReleaseAt.getTime() > Date.now() ? order.payoutReleaseAt.toISOString() : null,
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
        ? `Alkemart: your order ${orderReference(order.orderGroupId)} is on its way. Track it in your orders.`
        : `Alkemart: your order ${orderReference(order.orderGroupId)} was delivered. Enjoy — reply here if anything is wrong.`
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
      body: `Alkemart: how was order ${orderReference(order.orderGroupId)}? Your verified review helps other buyers — find it on your orders page.`,
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
    const limit = Math.max(1, Math.min(Number(c.req.query("limit") ?? 50) || 50, 200))
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0)
    // Newest first, with date, items, delivery area and payment method so the
    // seller's list can show "what to pack" without opening every order.
    // Additive over the original fields (vendor v1 ignores the extras).
    const checkout = c.get("checkoutRepo")
    await sweepDueReturns({ checkout, policy: await returnPolicy(c), links: orderEmailLinks(c) }).catch(() => 0)
    const orders = await checkout.listSellerOrderSummaries(sellerId)
    const page = orders.slice(offset, offset + limit)
    // Latest return per order, so the list can flag "Return asked".
    const cases = new Map<string, { status: string; waitingOnYou: boolean }>()
    for (const r of await checkout.listReturnCases({ sellerId, orderIds: page.map((o) => o.id) }).catch(() => [])) {
      if (!cases.has(r.orderId)) cases.set(r.orderId, { status: r.status, waitingOnYou: r.status === "requested" })
    }
    return c.json({
      items: page.map((o) => ({
        ...publicOrder(o),
        placedAt: o.placedAt ? o.placedAt.toISOString() : null,
        itemCount: o.items.reduce((n, i) => n + i.qty, 0),
        items: o.items,
        shipTo: o.shipTo,
        paymentMethod: o.paymentMethod,
        returnCase: cases.get(o.id) ?? null,
      })),
      count: orders.length,
      limit,
      offset,
    })
  })
  .get("/:id", async (c) => {
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    const checkout = c.get("checkoutRepo")
    const order = await checkout.getOrder(c.req.param("id"))
    if (!order || order.sellerId !== sellerId) {
      throw new HTTPException(404, { message: "order not found" })
    }
    await sweepDueReturns({ checkout, policy: await returnPolicy(c), links: orderEmailLinks(c) }).catch(() => 0)
    const items = await checkout.listOrderItems(order.id)
    const events = await checkout.listOrderEvents([order.id]).catch(() => [])
    const returnCase = (await checkout.listReturnCases({ orderIds: [order.id] }).catch(() => []))[0] ?? null
    const group = await checkout.getOrderGroup(order.orderGroupId)
    const intent = group
      ? await checkout.getPaymentIntent(group.paymentIntentId)
      : null
    return c.json({
      order: {
        ...publicOrder(order, (await deliveryPolicy(c)).handoverMaxFailures),
        returnCase: returnCase ? publicReturnCase(returnCase, "seller", { paidOut: !!order.payoutId, payOnDelivery: intent?.method === "cod" }) : null,
        refundedPesewas: (order.refundedPesewas ?? 0n).toString(),
        // The payout this order went out in, if any — so "next payout" is never shown for money already sent.
        payout: order.payoutId
          ? await checkout
              .getPayout(order.payoutId)
              .then((p) => (p ? { status: p.status, paidAt: p.paidAt?.toISOString() ?? null } : null))
              .catch(() => null)
          : null,
        // A phase-1 note from the buyer (no return case open).
        problem: returnCase && returnCase.status !== "closed" ? null : await checkout
          .listPayoutHolds(sellerId, true)
          .then((hs) => hs.find((h) => h.orderId === order.id && h.createdBy === "buyer"))
          .then((h) => (h ? { note: h.reason.replace(/^Buyer reported: /, ""), at: h.createdAt.toISOString() } : null))
          .catch(() => null),
        buyerEmail: group?.buyerEmail ?? null,
        shippingAddress: intent?.shippingAddress ?? null,
        placedAt: (group as { createdAt?: Date } | null)?.createdAt?.toISOString() ?? null,
        paymentMethod: intent?.method ?? null,
        paymentStatus: intent?.status ?? null,
        paymentState: paymentState(intent?.method, intent?.status, order.status),
        ...orderClock(order, events),
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
        { kind: "seller", id: c.get("auth").userId },
      )
      if (!order) throw new HTTPException(404, { message: "order not found" })
      void enqueueFulfillmentSms(c, order, "shipped")
      const shop = await c.get("authRepo").findSellerById(sellerId).catch(() => null)
      await enqueueOrderStatusEmail(c.get("checkoutRepo"), { order, status: "shipped", sellerName: shop?.name ?? "The seller", links: orderEmailLinks(c) })
      return c.json({ order: publicOrder(order) })
    } catch (err) {
      if (err instanceof InvalidFulfillmentTransitionError) {
        // 409: the order is in a state that doesn't allow this step (already
        // moved on, or cancelled). A repeat of the same step is a no-op 200.
        throw new HTTPException(409, { message: err.message })
      }
      throw err
    }
  })
  .post("/:id/deliver", async (c) => {
    const sellerId = c.get("auth").sellerId
    if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
    // Trust by default: a seller can always mark delivered. The buyer's code
    // is optional proof — with it the online payout is released at once;
    // without it the buyer gets a short window to report a problem first.
    const checkout = c.get("checkoutRepo")
    const current = await checkout.getOrder(c.req.param("id"))
    if (!current || current.sellerId !== sellerId) throw new HTTPException(404, { message: "order not found" })
    const body = (await readJsonBody(c).catch(() => ({}))) as { code?: unknown }
    const code = typeof body.code === "string" ? body.code.trim() : ""
    const policy = await deliveryPolicy(c)
    let confirmedBy: DeliveryConfirmedBy = "seller"
    if (code && current.handoverCode && current.status !== "delivered") {
      if ((current.handoverFailures ?? 0) >= policy.handoverMaxFailures) {
        throw new HTTPException(423, { message: "Code checking is off for this order after too many wrong tries. Mark it delivered without the code." })
      }
      if (!handoverMatches(current.handoverCode, code)) {
        const n = await checkout.recordHandoverFailure(current.id)
        const left = Math.max(0, policy.handoverMaxFailures - n)
        throw new HTTPException(422, {
          message: left > 0 ? `That code doesn't match. ${left} ${left === 1 ? "try" : "tries"} left — or mark it delivered without the code.` : "That code doesn't match. Mark it delivered without the code.",
        })
      }
      confirmedBy = "buyer_code"
    }
    try {
      // One tap is enough: a same-day rider or a pickup has no separate "sent" step.
      if (current.status === "placed") {
        await checkout.updateOrderStatus(current.id, sellerId, "shipped", { kind: "seller", id: c.get("auth").userId })
      }
      const order = await c.get("checkoutRepo").updateOrderStatus(
        c.req.param("id"),
        sellerId,
        "delivered",
        { kind: "seller", id: c.get("auth").userId },
      )
      if (!order) throw new HTTPException(404, { message: "order not found" })
      const group = await checkout.getOrderGroup(order.orderGroupId).catch(() => null)
      const releaseAt = payoutReleaseAt({ deliveredAt: new Date(), confirmedBy, placedAt: group?.createdAt ?? null, deliverLatest: order.deliverLatest ?? null }, policy)
      await checkout.recordDeliveryConfirmation(order.id, confirmedBy, releaseAt)
      // Automatic payout: with the buyer's code the money goes now; on the
      // seller's word alone it goes when the buyer's report window ends.
      const waitSec = Math.ceil((releaseAt.getTime() - Date.now()) / 1000)
      if (waitSec <= 0) await autoPayAfter(c, sellerId)
      else {
        const jobs = c.get("jobs")
        if (jobs && DEFAULT_PAYOUT_POLICY.autoPayout) await publishJob(jobs, "expiry", autoPayoutMessage(order.id, sellerId, releaseAt), { delaySeconds: Math.min(MAX_QUEUE_DELAY_SECONDS, waitSec) })
      }
      void enqueueFulfillmentSms(c, order, "delivered")
      const shop = await c.get("authRepo").findSellerById(sellerId).catch(() => null)
      await enqueueOrderStatusEmail(c.get("checkoutRepo"), { order, status: "delivered", sellerName: shop?.name ?? "The seller", links: orderEmailLinks(c) })
      void enqueueReviewRequestSms(c, order)
      // Answer with what was just stored (who confirmed, when money releases).
      return c.json({ order: publicOrder({ ...order, deliveryConfirmedBy: confirmedBy, payoutReleaseAt: releaseAt }) })
    } catch (err) {
      if (err instanceof InvalidFulfillmentTransitionError) {
        // 409: the order is in a state that doesn't allow this step (already
        // moved on, or cancelled). A repeat of the same step is a no-op 200.
        throw new HTTPException(409, { message: err.message })
      }
      throw err
    }
  })
