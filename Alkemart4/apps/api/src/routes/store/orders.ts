import { Hono, type Context } from "hono"
import { orderClock, paymentState } from "../../lib/order-clock"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import type {
  CheckoutRepository,
  OrderGroupRow,
  OrderEventRow,
  OrderItemRow,
  OrderRow,
  PayoutHoldRow,
} from "../../checkout-repository"
import { sellerFulfillment } from "../../lib/fulfillment"
import { orderReference } from "@alkemart/shared/order-ref"
import { encodeEmail } from "../../email"
import { sellerProblemReportedEmail } from "../../lib/email-templates"
import { orderEmailLinks } from "../../lib/order-emails"
import { readJsonBody } from "../../lib/session"
import { verifySessionJwt } from "../../lib/jwt"
import { requireFreshSession } from "../../middleware/auth"
import { RETURN_REASONS, assertCanAskForReturn, ReturnRuleError, type ReturnPolicy } from "@alkemart/domain"
import { ReturnCaseOpenError, type ReturnCaseRow } from "../../checkout-repository"
import type { ShopPolicyStore } from "../../shop-policies"
import { autoPayAfter } from "../../lib/payouts"
import {
  applyReturnAction,
  clockOf,
  isPaidOnline,
  loadOrderContext,
  notifyReturnOpened,
  publicReturnCase,
  publicReturnOptions,
  returnDeps,
  returnPolicy,
  returnableOf,
  shopReturnDaysAt,
  sweepDueReturns,
} from "../../lib/returns"

type SellerCard = {
  name: string
  handle: string
  /** Where to collect a pickup order; landmark is shared only with that buyer. */
  pickup: { place: string | null; landmark: string | null; lat: number | null; lng: number | null }
}

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

function publicOrder(
  order: OrderRow,
  items: OrderItemRow[],
  sellers: Map<string, SellerCard>,
) {
  const seller = sellers.get(order.sellerId)
  return {
    id: order.id,
    orderGroupId: order.orderGroupId,
    sellerId: order.sellerId,
    sellerName: seller?.name ?? null,
    sellerHandle: seller?.handle ?? null,
    status: order.status,
    subtotalPesewas: order.subtotalPesewas.toString(),
    deliveryFeePesewas: order.deliveryFeePesewas.toString(),
    fulfillmentMethod: order.fulfillmentMethod ?? "delivery",
    deliveryZone: order.deliveryZone ?? null,
    // The buyer's own code, shown until the handover is done.
    handoverCode: order.status === "delivered" || order.status === "cancelled" ? null : (order.handoverCode ?? null),
    pickup: order.fulfillmentMethod === "pickup" ? (seller?.pickup ?? null) : null,
    items: items.map(publicItem),
  }
}

type ReturnsView = { policy: ReturnPolicy; policies?: ShopPolicyStore }

async function serializeGroup(
  checkout: CheckoutRepository,
  group: OrderGroupRow & { createdAt?: Date },
  sellers: Map<string, SellerCard>,
  returns?: ReturnsView,
) {
  const orders = await checkout.listOrdersForGroup(group.id)
  const events = await checkout.listOrderEvents(orders.map((o) => o.id)).catch((): OrderEventRow[] => [])
  const cases = await checkout.listReturnCases({ orderIds: orders.map((o) => o.id) }).catch((): ReturnCaseRow[] => [])
  const intentForGroup = await checkout.getPaymentIntent(group.paymentIntentId).catch(() => null)
  const now = clockOf(checkout)
  const withItems = await Promise.all(
    orders.map(async (order) => {
      const items = await checkout.listOrderItems(order.id)
      const holds = await checkout.listPayoutHolds(order.sellerId, true).catch((): PayoutHoldRow[] => [])
      // Newest case on this order (open, or the last one that closed).
      const current = cases.find((r) => r.orderId === order.id) ?? null
      const open = current && current.status !== "closed" ? current : null
      let returnOptions: ReturnType<typeof publicReturnOptions> = null
      if (returns && !open) {
        const delivered = events.filter((e) => e.orderId === order.id && e.status === "delivered").at(-1)?.at ?? null
        const shopDays = await shopReturnDaysAt(returns.policies, order.sellerId, group.createdAt ?? null)
        returnOptions = publicReturnOptions(
          returnableOf(
            {
              order,
              group,
              intent: intentForGroup,
              placedAt: group.createdAt ?? null,
              deliveredAt: delivered,
              paidOnline: isPaidOnline(intentForGroup),
            },
            shopDays,
          ),
          now,
          returns.policy,
        )
      }
      return {
        ...publicOrder(order, items, sellers),
        ...orderClock(order, events),
        deliveryConfirmedBy: order.deliveryConfirmedBy ?? null,
        refundedPesewas: (order.refundedPesewas ?? 0n).toString(),
        // A phase-1 note ("just tell the seller"), not a return case.
        problemReported: !open && holds.some((h) => h.orderId === order.id && h.createdBy === "buyer"),
        returnCase: current ? publicReturnCase(current, "buyer") : null,
        returnOptions,
      }
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

  const intent = intentForGroup

  // Payment truth comes from the intent, never a constant: COD stays
  // pending until the rider collects; only succeeded intents read captured.
  const paymentStatus = isPaidOnline(intent) ? "captured" : "pending"

  return {
    id: group.id,
    buyerEmail: group.buyerEmail,
    totalPesewas: group.totalPesewas.toString(),
    currency: group.currency,
    createdAt: group.createdAt?.toISOString() ?? null,
    paymentMethod: intent?.method ?? null,
    paymentStatus,
    paymentState: paymentState(intent?.method, intent?.status, fulfillmentStatus),
    fulfillmentStatus,
    shippingAddress: intent?.shippingAddress ?? null,
    orders: withItems,
  }
}

async function sellerDirectory(
  c: { get(k: "authRepo"): AppEnv["Variables"]["authRepo"] },
): Promise<Map<string, SellerCard>> {
  const sellers = await c.get("authRepo").listSellers().catch(() => [])
  return new Map(
    sellers.map((s) => {
      const f = sellerFulfillment(s)
      const m = (s.metadata ?? {}) as Record<string, unknown>
      return [
        s.id,
        {
          name: s.name,
          handle: s.handle,
          pickup: { place: f.pickupPlace, landmark: typeof m.address_1 === "string" ? m.address_1 : null, lat: f.from.lat ?? null, lng: f.from.lng ?? null },
        },
      ]
    }),
  )
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

const BuyerProof = z.object({ email: z.string().email().optional() })
const ProblemBody = BuyerProof.extend({ note: z.string().trim().min(5).max(500) })

/**
 * The buyer of this order: signed in as the buyer, or (guests) the order id
 * plus the checkout email — the same proof the order lookup uses.
 */
async function buyerOrder(c: Context<AppEnv>, orderId: string, email: string | undefined) {
  const checkout = c.get("checkoutRepo")
  const order = await checkout.getOrder(orderId)
  const group = order ? await checkout.getOrderGroup(order.orderGroupId) : null
  if (!order || !group) throw new HTTPException(404, { message: "order not found" })
  if (email && emailsMatch(email, group.buyerEmail)) return { order, group }
  const token = bearerToken(c.req.header("Authorization"))
  const secret = c.get("jwtSecret")
  if (token && secret) {
    try {
      const auth = await verifySessionJwt(token, secret)
      const user = await c.get("authRepo").findUserById(auth.userId)
      if (user && emailsMatch(user.email, group.buyerEmail)) return { order, group }
    } catch {
      /* fall through */
    }
  }
  throw new HTTPException(404, { message: "order not found" })
}

const ReturnBody = BuyerProof.extend({
  reason: z.enum(RETURN_REASONS),
  wish: z.enum(["refund", "swap"]),
  note: z.string().trim().min(5).max(500),
})
const RespondBody = BuyerProof.extend({ action: z.enum(["accept", "escalate", "withdraw"]) })

/** Deadlines first, then policy and stores for showing returns. */
async function returnsView(c: Context<AppEnv>): Promise<ReturnsView> {
  const policy = await returnPolicy(c)
  await sweepDueReturns({ checkout: c.get("checkoutRepo"), policy, links: orderEmailLinks(c) }).catch(() => 0)
  let policies: ShopPolicyStore | undefined
  try {
    policies = c.get("policies")
  } catch {
    policies = undefined
  }
  return { policy, policies }
}

const LookupBody = z.object({
  orderId: z.string().min(1),
  email: z.string().email(),
})

export const storeOrders = new Hono<AppEnv>()
  .get("/", requireFreshSession, async (c) => {
    const auth = c.get("auth")
    const user = await c.get("authRepo").findUserById(auth.userId)
    if (!user) throw new HTTPException(401, { message: "unauthorized" })

    const view = await returnsView(c)
    const groups = await c.get("checkoutRepo").listOrderGroupsByBuyerEmail(user.email)
    const sellers = await sellerDirectory(c)
    const limit = Math.max(1, Math.min(Number(c.req.query("limit") ?? 20) || 20, 100))
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0)
    const page = groups.slice(offset, offset + limit)
    const items = await Promise.all(
      page.map((g) => serializeGroup(c.get("checkoutRepo"), g, sellers, view)),
    )
    return c.json({ items, count: groups.length, limit, offset })
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
          return c.json({ orderGroup: await serializeGroup(checkout, group, await sellerDirectory(c), await returnsView(c)) })
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
    return c.json({ orderGroup: await serializeGroup(checkout, group, await sellerDirectory(c), await returnsView(c)) })
  })
  /**
   * "I got it": the buyer's own confirmation. Counts as proof, so an
   * online payout for this order is released at once.
   */
  .post("/:orderId/received", async (c) => {
    const parsed = BuyerProof.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const { order } = await buyerOrder(c, c.req.param("orderId"), parsed.data.email)
    const checkout = c.get("checkoutRepo")
    if (order.status === "cancelled") throw new HTTPException(409, { message: "This order was cancelled." })
    const actor = { kind: "buyer" as const, note: "Buyer confirmed they received it" }
    if (order.status === "placed") await checkout.updateOrderStatus(order.id, order.sellerId, "shipped", actor)
    if (order.status !== "delivered") await checkout.updateOrderStatus(order.id, order.sellerId, "delivered", actor)
    await checkout.recordDeliveryConfirmation(order.id, "buyer", new Date())
    await autoPayAfter(c, order.sellerId)
    return c.json({ ok: true, status: "delivered" })
  })
  /**
   * "There's a problem": holds this order's payout (only this order) and
   * tells the seller. Buyer and seller sort it out; admin steps in only if
   * they can't.
   */
  .post("/:orderId/problem", async (c) => {
    const parsed = ProblemBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Tell the seller what's wrong in a few words." })
    const { order, group } = await buyerOrder(c, c.req.param("orderId"), parsed.data.email)
    const checkout = c.get("checkoutRepo")
    const open = (await checkout.listPayoutHolds(order.sellerId, true)).find((h) => h.orderId === order.id)
    if (open) return c.json({ ok: true, alreadyReported: true })
    await checkout.createPayoutHold({ sellerId: order.sellerId, orderId: order.id, reason: `Buyer reported: ${parsed.data.note}`, createdBy: "buyer" })
    const links = orderEmailLinks(c)
    const to = links.vendorUrl ? await links.sellerEmail?.(order.sellerId).catch(() => null) : null
    if (to && links.vendorUrl) {
      await checkout
        .enqueueNotification({
          key: `problem-reported:${order.id}`,
          recipient: to,
          channel: "email",
          category: "operational",
          body: encodeEmail(sellerProblemReportedEmail({ reference: orderReference(group.id), note: parsed.data.note, url: `${links.vendorUrl}/orders/${order.id}` })),
        })
        .catch(() => undefined)
    }
    return c.json({ ok: true })
  })
  /** "It's sorted": the buyer withdraws their report and the payout continues. */
  .post("/:orderId/problem/resolved", async (c) => {
    const parsed = BuyerProof.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const { order } = await buyerOrder(c, c.req.param("orderId"), parsed.data.email)
    const checkout = c.get("checkoutRepo")
    const openCase = (await checkout.listReturnCases({ orderIds: [order.id] })).find((r) => r.status !== "closed")
    if (openCase) {
      await applyReturnAction(returnDeps(c, await returnPolicy(c)), openCase, { by: "buyer", type: "withdraw" })
      return c.json({ ok: true })
    }
    const open = (await checkout.listPayoutHolds(order.sellerId, true)).find((h) => h.orderId === order.id && h.createdBy === "buyer")
    if (open) {
      await checkout.releasePayoutHold(open.id, "buyer")
      await autoPayAfter(c, order.sellerId)
    }
    return c.json({ ok: true })
  })
  /**
   * Ask for a return (or a replacement) on one seller's order. The domain
   * decides whether this reason is still open; the seller has a set time to
   * answer before alkemart steps in. The order's payout waits meanwhile.
   */
  .post("/:orderId/return", async (c) => {
    const parsed = ReturnBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "Pick what's wrong and tell the seller about it in a few words." })
    const { order, group } = await buyerOrder(c, c.req.param("orderId"), parsed.data.email)
    const checkout = c.get("checkoutRepo")
    const policy = await returnPolicy(c)
    const ctx = await loadOrderContext(checkout, order.id)
    if (!ctx) throw new HTTPException(404, { message: "order not found" })
    let policies: ShopPolicyStore | undefined
    try {
      policies = c.get("policies")
    } catch {
      policies = undefined
    }
    const now = clockOf(checkout)
    try {
      assertCanAskForReturn(returnableOf(ctx, await shopReturnDaysAt(policies, order.sellerId, ctx.placedAt)), parsed.data.reason, now, policy)
    } catch (e) {
      if (e instanceof ReturnRuleError) throw new HTTPException(409, { message: e.message })
      throw e
    }
    let row: ReturnCaseRow
    try {
      row = await checkout.createReturnCase({
        orderId: order.id,
        sellerId: order.sellerId,
        buyerEmail: group.buyerEmail,
        reason: parsed.data.reason,
        wish: parsed.data.wish,
        note: parsed.data.note,
        respondBy: new Date(now.getTime() + policy.sellerReplyHours * 3_600_000),
      })
    } catch (e) {
      if (e instanceof ReturnCaseOpenError) throw new HTTPException(409, { message: e.message })
      throw e
    }
    await notifyReturnOpened(returnDeps(c, policy), row)
    return c.json({ returnCase: publicReturnCase(row, "buyer") }, 201)
  })
  /** Answer the seller: accept their offer or decline, ask alkemart to decide, or close it. */
  .post("/:orderId/return/respond", async (c) => {
    const parsed = RespondBody.safeParse(await readJsonBody(c).catch(() => ({})))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const { order } = await buyerOrder(c, c.req.param("orderId"), parsed.data.email)
    const checkout = c.get("checkoutRepo")
    const policy = await returnPolicy(c)
    await sweepDueReturns({ checkout, policy, links: orderEmailLinks(c) }).catch(() => 0)
    const open = (await checkout.listReturnCases({ orderIds: [order.id] })).find((r) => r.status !== "closed")
    if (!open) throw new HTTPException(409, { message: "There's no open return on this order." })
    const row = await applyReturnAction(returnDeps(c, policy), open, { by: "buyer", type: parsed.data.action })
    return c.json({ returnCase: publicReturnCase(row, "buyer") })
  })
