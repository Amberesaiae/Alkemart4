import {
  carts,
  cartItems,
  experimentExposures,
  experiments,
  notificationPreferences,
  notifications,
  offers,
  orders,
  orderGroups,
  orderEvents,
  orderItems,
  paymentIntents,
  payoutEvents,
  payoutHolds,
  payoutLines,
  payouts,
  paystackEvents,
  products,
  returnCases,
  reviews,
  sellers,
  stockSubscriptions,
  stockReservations,
} from "@alkemart/db"
import {
  assertFulfillmentTransition,
  assertPaymentTransition,
  canMovePayout,
  computePayoutBatch,
  freezePromise,
  InvalidFulfillmentTransitionError,
  isSellable,
  quoteCart,
  type DeliveryConfirmedBy,
  type OrderFact,
  type OrderFulfillmentStatus,
  type PayoutFact,
  type PaymentIntentStatus,
  type ReturnReason,
  type ReturnStatus,
  type ReturnWish,
  applyRecoveries,
} from "@alkemart/domain"
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { marketCurrency } from "@alkemart/shared/markets"
import { PostgresLedgerStore, payoutEntry, payoutReversalEntry, refundEntries, saleEntries, type LedgerStore } from "./ledger"
import { deliveryPromiseFromMetadata } from "./lib/delivery-promise"
import type {
  CartItemRow,
  CartRow,
  CheckoutOfferView,
  CheckoutRepository,
  ExperimentDto,
  NotificationPreferenceDto,
  OrderGroupRow,
  PaymentIntentRow,
  PayoutRow,
  PaystackEventRow,
  OrderActor,
  OrderEventRow,
  SellerOrderSummary,
  ShippingAddress,
  OrderRow,
  OrderFactFilter,
  ReturnCaseChange,
  ReturnCaseFilter,
  ReturnCaseRow,
  ReturnTimelineEntry,
  StockSubscriptionDto,
} from "./checkout-repository"
import { ReturnCaseOpenError, PayoutBlockedError, feesFromFulfillment, orderFulfillment, withDeals, withFees, type IntentDeals } from "./checkout-repository"

type Db = PostgresJsDatabase

/** Walks the cause chain for a Postgres unique-violation (23505), matching on constraint name. */
function isUniqueViolation(err: unknown, constraintFragment: string): boolean {
  let current: unknown = err
  while (current && typeof current === "object") {
    const rec = current as Record<string, unknown>
    const constraint = typeof rec.constraint === "string" ? rec.constraint : ""
    if (rec.code === "23505" && constraint.includes(constraintFragment)) return true
    current = rec.cause
  }
  return false
}

function mapOrder(row: typeof orders.$inferSelect, payoutId: string | null = null): OrderRow {
  return {
    id: row.id,
    orderGroupId: row.orderGroupId,
    sellerId: row.sellerId,
    subtotalPesewas: row.subtotalPesewas,
    deliveryFeePesewas: row.deliveryFeePesewas,
    status: row.status as OrderFulfillmentStatus,
    payoutId,
    dispatchBy: row.dispatchBy ?? null,
    deliverEarliest: row.deliverEarliest ?? null,
    deliverLatest: row.deliverLatest ?? null,
    fulfillmentMethod: row.fulfillmentMethod,
    deliveryZone: row.deliveryZone ?? null,
    handoverCode: row.handoverCode ?? null,
    handoverFailures: row.handoverFailures,
    deliveryConfirmedBy: row.deliveryConfirmedBy ?? null,
    payoutReleaseAt: row.payoutReleaseAt ?? null,
    refundedPesewas: row.refundedPesewas ?? 0n,
  }
}

function mapReturnCase(r: typeof returnCases.$inferSelect): ReturnCaseRow {
  return {
    id: r.id,
    orderId: r.orderId,
    sellerId: r.sellerId,
    buyerEmail: r.buyerEmail,
    reason: r.reason as ReturnReason,
    wish: r.wish as ReturnWish,
    note: r.note,
    status: r.status as ReturnStatus,
    respondBy: r.respondBy,
    declineReason: r.declineReason,
    outcome: r.outcome as ReturnCaseRow["outcome"],
    refundPesewas: r.refundPesewas,
    refundVia: r.refundVia ?? null,
    refundStatus: r.refundStatus ?? null,
    refundRef: r.refundRef,
    sellerRecoveryPesewas: r.sellerRecoveryPesewas,
    recoveredPayoutId: r.recoveredPayoutId,
    adminNote: r.adminNote,
    timeline: (r.timeline ?? []) as ReturnTimelineEntry[],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    closedAt: r.closedAt,
  }
}

function mapIntent(row: typeof paymentIntents.$inferSelect): PaymentIntentRow {
  return {
    id: row.id,
    cartId: row.cartId,
    method: row.method,
    status: row.status as PaymentIntentStatus,
    amountPesewas: row.amountPesewas,
    currency: row.currency,
    paystackReference: row.paystackReference,
    buyerEmail: row.buyerEmail,
    momoProvider: row.momoProvider,
    momoPhone: row.momoPhone,
    shippingAddress: (row.shippingAddress as ShippingAddress | null) ?? null,
    fulfillment: row.fulfillment ?? null,
    deals: row.deals ?? null,
    createdAt: row.createdAt,
  }
}

export class PostgresCheckoutRepository implements CheckoutRepository {
  constructor(
    private readonly db: Db,
    readonly ledger: LedgerStore = new PostgresLedgerStore(db),
  ) {}

  async createCart(): Promise<CartRow> {
    const id = crypto.randomUUID()
    const [row] = await this.db
      .insert(carts)
      .values({ id, currency: marketCurrency(), buyerEmail: null })
      .returning()
    if (!row) throw new Error("failed to create cart")
    return { id: row.id, currency: row.currency, buyerEmail: row.buyerEmail }
  }

  async getCart(cartId: string) {
    const [row] = await this.db.select().from(carts).where(eq(carts.id, cartId)).limit(1)
    return row ? { id: row.id, currency: row.currency, buyerEmail: row.buyerEmail } : null
  }

  async getOfferView(offerId: string): Promise<CheckoutOfferView | null> {
    const views = await this.getOfferViews([offerId])
    return views.get(offerId) ?? null
  }

  /** Batched offer views — one join query for N cart lines instead of N. */
  async getOfferViews(offerIds: string[]): Promise<Map<string, CheckoutOfferView>> {
    const out = new Map<string, CheckoutOfferView>()
    if (offerIds.length === 0) return out
    const rows = await this.db
      .select({
        offer: offers,
        productStatus: products.status,
        productTitle: products.title,
        sellerStatus: sellers.status,
        sellerName: sellers.name,
        sellerHandle: sellers.handle,
        deliveryFeePesewas: sellers.deliveryFeePesewas,
      })
      .from(offers)
      .innerJoin(products, eq(products.id, offers.productId))
      .innerJoin(sellers, eq(sellers.id, offers.sellerId))
      .where(inArray(offers.id, offerIds))
    for (const row of rows) {
      out.set(row.offer.id, {
        offer: {
          id: row.offer.id,
          sellerId: row.offer.sellerId,
          productId: row.offer.productId,
          variantId: row.offer.variantId,
          pricePesewas: row.offer.pricePesewas,
          onHand: row.offer.onHand,
          reserved: row.offer.reserved,
          currency: row.offer.currency,
          active: row.offer.active,
        },
        productStatus: row.productStatus,
        sellerStatus: row.sellerStatus,
        deliveryFeePesewas: row.deliveryFeePesewas,
        productTitle: row.productTitle,
        sellerName: row.sellerName,
        sellerHandle: row.sellerHandle,
      })
    }
    return out
  }

  async addCartItem(cartId: string, offerId: string, qty: number) {
    if (qty <= 0) throw new Error("invalid qty")
    if (!(await this.getCart(cartId))) throw new Error("cart not found")
    const view = await this.getOfferView(offerId)
    if (!view) throw new Error("offer not found")
    if (
      !isSellable({
        productStatus: view.productStatus,
        sellerStatus: view.sellerStatus,
        offerActive: view.offer.active,
        onHand: view.offer.onHand,
        reserved: view.offer.reserved,
        pricePesewas: view.offer.pricePesewas,
      })
    ) {
      throw new Error("offer not sellable")
    }

    // Atomic upsert on (cartId, offerId): concurrent adds either insert or
    // increment — never duplicate rows, never lost quantity updates.
    const [row] = await this.db
      .insert(cartItems)
      .values({
        id: crypto.randomUUID(),
        cartId,
        offerId,
        sellerId: view.offer.sellerId,
        qty,
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.offerId],
        set: { qty: sql`${cartItems.qty} + excluded.qty` },
      })
      .returning()
    if (!row) throw new Error("failed to add cart item")
    return {
      id: row.id,
      cartId: row.cartId,
      offerId: row.offerId,
      sellerId: row.sellerId,
      qty: row.qty,
    }
  }

  async setCartItemQty(cartId: string, itemId: string, qty: number): Promise<CartItemRow | null> {
    if (!(await this.getCart(cartId))) throw new Error("cart not found")
    const [current] = await this.db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.id, itemId)))
      .limit(1)
    if (!current) return null
    if (qty <= 0) {
      await this.db.delete(cartItems).where(eq(cartItems.id, itemId))
      return null
    }
    const [updated] = await this.db
      .update(cartItems)
      .set({ qty })
      .where(eq(cartItems.id, itemId))
      .returning()
    if (!updated) return null
    return {
      id: updated.id,
      cartId: updated.cartId,
      offerId: updated.offerId,
      sellerId: updated.sellerId,
      qty: updated.qty,
    }
  }

  async listCartItems(cartId: string): Promise<CartItemRow[]> {
    const rows = await this.db.select().from(cartItems).where(eq(cartItems.cartId, cartId))
    return rows.map((r) => ({
      id: r.id,
      cartId: r.cartId,
      offerId: r.offerId,
      sellerId: r.sellerId,
      qty: r.qty,
    }))
  }

  async quote(cartId: string, fees?: Map<string, bigint>, deals?: IntentDeals | null) {
    const items = await this.listCartItems(cartId)
    const [cart] = await this.db.select().from(carts).where(eq(carts.id, cartId)).limit(1)
    const currency = cart?.currency ?? marketCurrency()
    if (items.length === 0) return quoteCart([], currency)
    const views = await this.getOfferViews(items.map((i) => i.offerId))
    const lines = items.map((item) => {
      const view = views.get(item.offerId)
      if (!view) throw new Error(`offer missing: ${item.offerId}`)
      return {
        offerId: item.offerId,
        sellerId: item.sellerId,
        qty: item.qty,
        unitPricePesewas: view.offer.pricePesewas,
        deliveryFeePesewas: view.deliveryFeePesewas,
      }
    })
    return quoteCart(withDeals(withFees(lines, fees), deals), currency)
  }

  async createPaymentIntent(
    input: Omit<PaymentIntentRow, "status"> & { status: PaymentIntentStatus },
  ) {
    const [row] = await this.db
      .insert(paymentIntents)
      .values({
        id: input.id,
        cartId: input.cartId,
        method: input.method,
        status: input.status,
        amountPesewas: input.amountPesewas,
        currency: input.currency,
        paystackReference: input.paystackReference,
        buyerEmail: input.buyerEmail,
        momoProvider: input.momoProvider,
        momoPhone: input.momoPhone,
        shippingAddress: input.shippingAddress,
        fulfillment: input.fulfillment ?? null,
        deals: input.deals ?? null,
      })
      .returning()
    if (!row) throw new Error("failed to create payment intent")
    return mapIntent(row)
  }

  async getPaymentIntent(id: string) {
    const [row] = await this.db.select().from(paymentIntents).where(eq(paymentIntents.id, id)).limit(1)
    return row ? mapIntent(row) : null
  }

  async getPaymentIntentByReference(ref: string) {
    const [row] = await this.db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.paystackReference, ref))
      .limit(1)
    return row ? mapIntent(row) : null
  }

  async updatePaymentIntentStatus(id: string, status: PaymentIntentStatus) {
    const current = await this.getPaymentIntent(id)
    if (!current) throw new Error("payment intent not found")
    assertPaymentTransition(current.status, status)
    // Compare-and-swap on the observed status: a webhook and the status poll can
    // race; the first writer wins and the loser observes the row no longer in
    // `current.status` instead of silently overwriting it.
    const [row] = await this.db
      .update(paymentIntents)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(paymentIntents.id, id), eq(paymentIntents.status, current.status)))
      .returning()
    if (!row) {
      throw new Error(`payment intent status changed concurrently (${current.status})`)
    }
    return mapIntent(row)
  }

  async reserveStock(paymentIntentId: string, lines: Array<{ offerId: string; qty: number }>) {
    await this.db.transaction(async (tx) => {
      for (const line of lines) {
        // Atomic conditional reserve: the increment only lands when the offer
        // still has enough available. Check-then-update here would let two
        // concurrent checkouts both pass the check and oversell.
        const reservedRows = await tx
          .update(offers)
          .set({ reserved: sql`${offers.reserved} + ${line.qty}` })
          .where(
            and(
              eq(offers.id, line.offerId),
              sql`${offers.onHand} - ${offers.reserved} >= ${line.qty}`,
            ),
          )
          .returning({ id: offers.id })
        if (reservedRows.length === 0) {
          throw new Error(`insufficient stock for ${line.offerId}`)
        }
        await tx.insert(stockReservations).values({
          id: crypto.randomUUID(),
          paymentIntentId,
          offerId: line.offerId,
          qty: line.qty,
        })
      }
    })
  }

  async releaseReservations(paymentIntentId: string) {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(stockReservations)
        .where(eq(stockReservations.paymentIntentId, paymentIntentId))
      for (const row of rows) {
        await tx
          .update(offers)
          .set({ reserved: sql`greatest(${offers.reserved} - ${row.qty}, 0)` })
          .where(eq(offers.id, row.offerId))
      }
      await tx
        .delete(stockReservations)
        .where(eq(stockReservations.paymentIntentId, paymentIntentId))
    })
  }

  async getOrderGroupByPaymentIntent(paymentIntentId: string) {
    const [row] = await this.db
      .select()
      .from(orderGroups)
      .where(eq(orderGroups.paymentIntentId, paymentIntentId))
      .limit(1)
    return row
      ? {
          id: row.id,
          paymentIntentId: row.paymentIntentId,
          buyerEmail: row.buyerEmail,
          totalPesewas: row.totalPesewas,
          currency: row.currency,
        }
      : null
  }

  async getOrderGroup(id: string) {
    const [row] = await this.db.select().from(orderGroups).where(eq(orderGroups.id, id)).limit(1)
    if (!row) return null
    return {
      id: row.id,
      paymentIntentId: row.paymentIntentId,
      buyerEmail: row.buyerEmail,
      totalPesewas: row.totalPesewas,
      currency: row.currency,
      createdAt: row.createdAt,
    }
  }

  async listOrderGroupsByBuyerEmail(email: string) {
    const normalized = email.trim().toLowerCase()
    const rows = await this.db
      .select()
      .from(orderGroups)
      .where(sql`lower(${orderGroups.buyerEmail}) = ${normalized}`)
      .orderBy(desc(orderGroups.createdAt))
    return rows.map((row) => ({
      id: row.id,
      paymentIntentId: row.paymentIntentId,
      buyerEmail: row.buyerEmail,
      totalPesewas: row.totalPesewas,
      currency: row.currency,
      createdAt: row.createdAt,
    }))
  }

  async listOrdersForGroup(orderGroupId: string) {
    const rows = await this.db.select().from(orders).where(eq(orders.orderGroupId, orderGroupId))
    return rows.map((r) => mapOrder(r))
  }

  async listOrderItems(orderId: string) {
    const rows = await this.db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      offerId: r.offerId,
      sellerId: r.sellerId,
      productId: r.productId,
      title: r.title,
      qty: r.qty,
      unitPricePesewas: r.unitPricePesewas,
    }))
  }

  async getLatestPaymentIntentByCartId(cartId: string) {
    const [row] = await this.db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.cartId, cartId))
      .orderBy(desc(paymentIntents.createdAt))
      .limit(1)
    return row ? mapIntent(row) : null
  }

  async listStalePendingIntents(cutoff: Date): Promise<PaymentIntentRow[]> {
    const rows = await this.db
      .select()
      .from(paymentIntents)
      .where(
        and(
          inArray(paymentIntents.status, ["pending", "initiated"]),
          inArray(paymentIntents.method, ["momo", "card"]),
          sql`${paymentIntents.createdAt} < ${cutoff.toISOString()}`,
        ),
      )
      .limit(100)
    return rows.map(mapIntent)
  }

  async confirmPaidOrder(paymentIntentId: string) {
    const existing = await this.getOrderGroupByPaymentIntent(paymentIntentId)
    if (existing) {
      return { orderGroup: existing, orders: await this.listOrdersForGroup(existing.id) }
    }

    try {
      return await this.confirmPaidOrderTx(paymentIntentId)
    } catch (err) {
      // Two confirmations raced past the pre-check; the unique constraint on
      // order_groups.payment_intent_id makes the second insert fail — return
      // the winner's group instead of a 500.
      if (isUniqueViolation(err, "payment_intent_id")) {
        const raced = await this.getOrderGroupByPaymentIntent(paymentIntentId)
        if (raced) {
          return { orderGroup: raced, orders: await this.listOrdersForGroup(raced.id) }
        }
      }
      throw err
    }
  }

  private async confirmPaidOrderTx(paymentIntentId: string) {
    return this.db.transaction(async (tx) => {
      const [intent] = await tx
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.id, paymentIntentId))
        .limit(1)
      if (!intent) throw new Error("payment intent not found")

      const items = await tx.select().from(cartItems).where(eq(cartItems.cartId, intent.cartId))
      const quoteLines = []
      for (const item of items) {
        const [joined] = await tx
          .select({
            offer: offers,
            productTitle: products.title,
            deliveryFeePesewas: sellers.deliveryFeePesewas,
          })
          .from(offers)
          .innerJoin(products, eq(products.id, offers.productId))
          .innerJoin(sellers, eq(sellers.id, offers.sellerId))
          .where(eq(offers.id, item.offerId))
          .limit(1)
        if (!joined) throw new Error(`offer missing: ${item.offerId}`)
        quoteLines.push({
          offerId: item.offerId,
          sellerId: item.sellerId,
          qty: item.qty,
          unitPricePesewas: joined.offer.pricePesewas,
          deliveryFeePesewas: joined.deliveryFeePesewas,
          productId: joined.offer.productId,
          productTitle: joined.productTitle,
        })
      }
      const quote = quoteCart(withDeals(withFees(quoteLines, feesFromFulfillment(intent.fulfillment)), intent.deals), intent.currency)
      if (quote.totalPesewas !== intent.amountPesewas) {
        throw new Error("quote total mismatch")
      }

      const orderGroupId = crypto.randomUUID()
      const [group] = await tx
        .insert(orderGroups)
        .values({
          id: orderGroupId,
          paymentIntentId,
          buyerEmail: intent.buyerEmail,
          totalPesewas: intent.amountPesewas,
          currency: intent.currency,
        })
        .returning()
      if (!group) throw new Error("failed to create order group")

      const createdOrders: OrderRow[] = []
      for (const seller of quote.sellers) {
        const orderId = crypto.randomUUID()
        // Freeze the seller's delivery promise onto the order (0036).
        const [meta] = await tx
          .select({ metadata: sellers.metadata })
          .from(sellers)
          .where(eq(sellers.id, seller.sellerId))
          .limit(1)
        const promise = freezePromise(group.createdAt, deliveryPromiseFromMetadata(meta?.metadata))
        const [order] = await tx
          .insert(orders)
          .values({
            id: orderId,
            orderGroupId,
            sellerId: seller.sellerId,
            subtotalPesewas: seller.subtotalPesewas,
            deliveryFeePesewas: seller.deliveryFeePesewas,
            status: "placed",
            dispatchBy: promise.dispatchBy,
            deliverEarliest: promise.deliverEarliest,
            deliverLatest: promise.deliverLatest,
            ...orderFulfillment(intent.fulfillment?.[seller.sellerId]),
          })
          .returning()
        if (!order) throw new Error("failed to create order")
        await tx
          .insert(orderEvents)
          .values({ id: crypto.randomUUID(), orderId, status: "placed", actor: "buyer", at: group.createdAt })
          .onConflictDoNothing()
        createdOrders.push(mapOrder(order))

        for (const line of seller.lines) {
          const meta = quoteLines.find((q) => q.offerId === line.offerId)!
          await tx.insert(orderItems).values({
            id: crypto.randomUUID(),
            orderId,
            offerId: line.offerId,
            sellerId: line.sellerId,
            productId: meta.productId,
            title: meta.productTitle,
            qty: line.qty,
            unitPricePesewas: line.unitPricePesewas,
          })
          await tx
            .update(offers)
            .set({
              onHand: sql`${offers.onHand} - ${line.qty}`,
              reserved: sql`greatest(${offers.reserved} - ${line.qty}, 0)`,
            })
            .where(eq(offers.id, line.offerId))
        }
      }

      await tx
        .delete(stockReservations)
        .where(eq(stockReservations.paymentIntentId, paymentIntentId))

      // Ledger in the same tx: sale + platform_fee per seller order. Replay
      // converges via the early-return above and idempotency keys.
      const txLedger = new PostgresLedgerStore(tx)
      for (const order of createdOrders) {
        const [seller] = await tx
          .select({ commissionBps: sellers.commissionBps })
          .from(sellers)
          .where(eq(sellers.id, order.sellerId))
          .limit(1)
        if (!seller) throw new Error(`seller missing for ledger: ${order.sellerId}`)
        for (const entry of saleEntries({
          orderId: order.id,
          intentId: paymentIntentId,
          sellerId: order.sellerId,
          subtotalMinor: order.subtotalPesewas,
          currency: intent.currency,
          commissionBps: seller.commissionBps,
        })) {
          await txLedger.append(entry)
        }
      }

      let nextStatus = intent.status as PaymentIntentStatus
      if (nextStatus === "pending") {
        assertPaymentTransition(nextStatus, "succeeded")
        nextStatus = "succeeded"
        await tx
          .update(paymentIntents)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(paymentIntents.id, paymentIntentId))
      }
      assertPaymentTransition(nextStatus, "completed")
      await tx
        .update(paymentIntents)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(paymentIntents.id, paymentIntentId))

      const orderGroup: OrderGroupRow = {
        id: group.id,
        paymentIntentId: group.paymentIntentId,
        buyerEmail: group.buyerEmail,
        totalPesewas: group.totalPesewas,
        currency: group.currency,
      }
      return { orderGroup, orders: createdOrders }
    })
  }

  async getOrder(orderId: string) {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!row) return null
    const [pl] = await this.db
      .select()
      .from(payoutLines)
      .where(eq(payoutLines.orderId, orderId))
      .limit(1)
    return mapOrder(row, pl?.payoutId ?? null)
  }

  async listOrdersForSeller(sellerId: string) {
    const rows = await this.db.select().from(orders).where(eq(orders.sellerId, sellerId))
    return rows.map((r) => mapOrder(r))
  }

  /** Two queries regardless of order count: orders⋈group⋈intent, then items. */
  async listSellerOrderSummaries(sellerId: string): Promise<SellerOrderSummary[]> {
    const rows = await this.db
      .select({
        order: orders,
        placedAt: orderGroups.createdAt,
        shippingAddress: paymentIntents.shippingAddress,
        method: paymentIntents.method,
      })
      .from(orders)
      .leftJoin(orderGroups, eq(orderGroups.id, orders.orderGroupId))
      .leftJoin(paymentIntents, eq(paymentIntents.id, orderGroups.paymentIntentId))
      .where(eq(orders.sellerId, sellerId))
      .orderBy(desc(orderGroups.createdAt))
    const ids = rows.map((r) => r.order.id)
    const itemRows = ids.length
      ? await this.db
          .select({ orderId: orderItems.orderId, productId: orderItems.productId, title: orderItems.title, qty: orderItems.qty })
          .from(orderItems)
          .where(inArray(orderItems.orderId, ids))
      : []
    const itemsByOrder = new Map<string, SellerOrderSummary["items"]>()
    for (const i of itemRows) {
      const list = itemsByOrder.get(i.orderId) ?? []
      list.push({ productId: i.productId, title: i.title, qty: i.qty })
      itemsByOrder.set(i.orderId, list)
    }
    return rows.map((r) => {
      const addr = (r.shippingAddress as ShippingAddress | null) ?? null
      return {
        ...mapOrder(r.order),
        placedAt: r.placedAt ?? null,
        items: itemsByOrder.get(r.order.id) ?? [],
        shipTo: addr ? { city: addr.city || null, region: addr.province ?? null } : null,
        paymentMethod: r.method ?? null,
      }
    })
  }

  async listRecentOrderGroups(limit = 50) {
    const take = Math.max(1, Math.min(limit, 200))
    const rows = await this.db
      .select()
      .from(orderGroups)
      .orderBy(desc(orderGroups.createdAt))
      .limit(take)
    return rows.map((row) => ({
      id: row.id,
      paymentIntentId: row.paymentIntentId,
      buyerEmail: row.buyerEmail,
      totalPesewas: row.totalPesewas,
      currency: row.currency,
      createdAt: row.createdAt,
    }))
  }

  async orderTotalsBySeller(): Promise<Map<string, { orders: number; gmvPesewas: bigint }>> {
    const rows = await this.db
      .select({
        sellerId: orders.sellerId,
        orders: sql<number>`count(*)`,
        gmv: sql<string | number | bigint>`sum(${orders.subtotalPesewas})`,
      })
      .from(orders)
      .groupBy(orders.sellerId)
    const totals = new Map<string, { orders: number; gmvPesewas: bigint }>()
    for (const r of rows) {
      totals.set(r.sellerId, {
        orders: Number(r.orders),
        gmvPesewas: typeof r.gmv === "bigint" ? r.gmv : BigInt(r.gmv ?? 0),
      })
    }
    return totals
  }

  async productUnitsSince(since: Date): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        productId: orderItems.productId,
        units: sql<number>`sum(${orderItems.qty})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(orderGroups, eq(orderGroups.id, orders.orderGroupId))
      .where(and(eq(orders.status, "delivered"), gte(orderGroups.createdAt, since)))
      .groupBy(orderItems.productId)
    const units = new Map<string, number>()
    for (const r of rows) {
      if (r.productId) units.set(r.productId, Number(r.units))
    }
    return units
  }

  async latestBuyerPhone(buyerEmail: string): Promise<string | null> {
    const [row] = await this.db
      .select({
        momoPhone: paymentIntents.momoPhone,
        shippingAddress: paymentIntents.shippingAddress,
      })
      .from(paymentIntents)
      .where(eq(paymentIntents.buyerEmail, buyerEmail.trim().toLowerCase()))
      .orderBy(desc(paymentIntents.createdAt))
      .limit(1)
    const shipPhone =
      row?.shippingAddress && typeof row.shippingAddress.phone === "string"
        ? row.shippingAddress.phone.trim()
        : ""
    if (shipPhone) return shipPhone
    const momo = row?.momoPhone?.trim()
    return momo || null
  }

  async listOrderFacts(filter: OrderFactFilter): Promise<OrderFact[]> {
    const deliveredAt = sql<Date | null>`(SELECT min(e.at) FROM order_events e WHERE e.order_id = ${orders.id} AND e.status = 'delivered')`
    const conds = [
      filter.sellerId ? eq(orders.sellerId, filter.sellerId) : undefined,
      filter.placedFrom ? gte(orderGroups.createdAt, filter.placedFrom) : undefined,
      filter.placedTo ? lt(orderGroups.createdAt, filter.placedTo) : undefined,
      // This aggregate is raw SQL, so it has no timestamp-column encoder.
      filter.deliveredFrom ? sql`${deliveredAt} >= ${filter.deliveredFrom.toISOString()}` : undefined,
      filter.deliveredTo ? sql`${deliveredAt} < ${filter.deliveredTo.toISOString()}` : undefined,
    ].filter((c) => c !== undefined)
    const rows = await this.db
      .select({
        order: orders,
        placedAt: orderGroups.createdAt,
        buyerEmail: orderGroups.buyerEmail,
        method: paymentIntents.method,
        shippingAddress: paymentIntents.shippingAddress,
        deliveredAt,
      })
      .from(orders)
      .innerJoin(orderGroups, eq(orderGroups.id, orders.orderGroupId))
      .leftJoin(paymentIntents, eq(paymentIntents.id, orderGroups.paymentIntentId))
      .where(conds.length ? and(...conds) : undefined)
    if (!rows.length) return []
    const items = await this.db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, rows.map((r) => r.order.id)))
    const byOrder = new Map<string, OrderFact["items"]>()
    for (const i of items) {
      const list = byOrder.get(i.orderId) ?? []
      list.push({ productId: i.productId, title: i.title, qty: i.qty, amountPesewas: i.unitPricePesewas * BigInt(i.qty) })
      byOrder.set(i.orderId, list)
    }
    return rows.map((r) => {
      const addr = (r.shippingAddress as ShippingAddress | null) ?? null
      const delivered = r.deliveredAt ? new Date(r.deliveredAt) : null
      return {
        orderId: r.order.id,
        orderGroupId: r.order.orderGroupId,
        sellerId: r.order.sellerId,
        placedAt: r.placedAt,
        status: r.order.status as OrderFact["status"],
        deliveredAt: r.order.status === "delivered" ? delivered : null,
        subtotalPesewas: r.order.subtotalPesewas,
        deliveryFeePesewas: r.order.deliveryFeePesewas,
        paymentMethod: (r.method as OrderFact["paymentMethod"]) ?? null,
        fulfillmentMethod: r.order.fulfillmentMethod ?? "delivery",
        buyerKey: r.buyerEmail?.trim().toLowerCase() || null,
        region: addr?.province ?? null,
        city: addr?.city ?? null,
        items: byOrder.get(r.order.id) ?? [],
      }
    })
  }

  async listPayoutFacts(filter: { sellerId?: string; paidFrom?: Date; paidTo?: Date }): Promise<PayoutFact[]> {
    const conds = [
      filter.sellerId ? eq(payouts.sellerId, filter.sellerId) : undefined,
      filter.paidFrom ? gte(payouts.paidAt, filter.paidFrom) : undefined,
      filter.paidTo ? lt(payouts.paidAt, filter.paidTo) : undefined,
    ].filter((c) => c !== undefined)
    const rows = await this.db.select().from(payouts).where(conds.length ? and(...conds) : undefined)
    return rows.map((p) => ({
      payoutId: p.id,
      sellerId: p.sellerId,
      status: p.status,
      grossPesewas: p.grossPesewas,
      commissionPesewas: p.commissionPesewas,
      netPesewas: p.netPesewas,
      paidAt: p.paidAt ?? null,
      reference: p.paystackReference,
    }))
  }

  async recordDeliveryConfirmation(orderId: string, by: DeliveryConfirmedBy, releaseAt: Date) {
    await this.db.update(orders).set({ deliveryConfirmedBy: by, payoutReleaseAt: releaseAt }).where(eq(orders.id, orderId))
  }

  async recordHandoverFailure(orderId: string) {
    const [row] = await this.db
      .update(orders)
      .set({ handoverFailures: sql`${orders.handoverFailures} + 1` })
      .where(eq(orders.id, orderId))
      .returning({ n: orders.handoverFailures })
    return row?.n ?? 0
  }

  async updateOrderStatus(
    orderId: string,
    sellerId: string,
    status: OrderFulfillmentStatus,
    actor?: { kind: OrderActor; id?: string | null; note?: string | null },
  ) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.sellerId, sellerId)))
        .limit(1)
      if (!row) return null
      const from = row.status as OrderFulfillmentStatus
      assertFulfillmentTransition(from, status)
      // Conditional on the status we read: a concurrent transition wins once.
      const [updated] = await tx
        .update(orders)
        .set({ status })
        .where(and(eq(orders.id, orderId), eq(orders.status, row.status)))
        .returning()
      if (!updated) throw new InvalidFulfillmentTransitionError(from, status)
      await tx
        .insert(orderEvents)
        .values({
          id: crypto.randomUUID(),
          orderId,
          status,
          actor: actor?.kind ?? "seller",
          actorId: actor?.id ?? null,
          note: actor?.note ?? null,
        })
        .onConflictDoNothing()
      return mapOrder(updated)
    })
  }

  async listOrderEvents(orderIds: string[]): Promise<OrderEventRow[]> {
    if (orderIds.length === 0) return []
    const rows = await this.db
      .select()
      .from(orderEvents)
      .where(inArray(orderEvents.orderId, orderIds))
      .orderBy(asc(orderEvents.at))
    return rows.map((r) => ({
      orderId: r.orderId,
      status: r.status as OrderFulfillmentStatus,
      actor: r.actor as OrderActor,
      at: r.at,
      note: r.note,
    }))
  }

  async listDeliveredUnpaidOrders(sellerId: string) {
    const rows = await this.db
      .select({ order: orders, payoutLineId: payoutLines.id })
      .from(orders)
      .leftJoin(payoutLines, eq(payoutLines.orderId, orders.id))
      .leftJoin(orderGroups, eq(orderGroups.id, orders.orderGroupId))
      .leftJoin(paymentIntents, eq(paymentIntents.id, orderGroups.paymentIntentId))
      .where(
        and(
          eq(orders.sellerId, sellerId),
          eq(orders.status, "delivered"),
          isNull(payoutLines.id),
          // COD cash is already with the seller — never payable.
          or(isNull(paymentIntents.method), ne(paymentIntents.method, "cod")),
          // A held order is not payable until an admin releases the hold.
          sql`NOT EXISTS (SELECT 1 FROM payout_holds h WHERE h.order_id = ${orders.id} AND h.status = 'held')`,
          // Seller-only confirmations wait out the buyer's report window.
          or(isNull(orders.payoutReleaseAt), sql`${orders.payoutReleaseAt} <= now()`),
          // Fully refunded: nothing left to pay the seller.
          sql`${orders.subtotalPesewas} > ${orders.refundedPesewas}`,
        ),
      )
    return rows.map((r) => mapOrder(r.order))
  }

  async reservePayout(input: { sellerId: string; commissionBps: number; reference: string; createdBy: string }) {
    return this.db.transaction(async (tx) => {
      const [accountHold] = await tx
        .select()
        .from(payoutHolds)
        .where(and(eq(payoutHolds.sellerId, input.sellerId), eq(payoutHolds.status, "held"), isNull(payoutHolds.orderId)))
        .limit(1)
      if (accountHold) throw new PayoutBlockedError("seller_hold", `Payouts are on hold for this seller: ${accountHold.reason}`)

      // Eligibility read inside the transaction; unique payout_lines.order_id
      // makes a concurrent reserve of the same order fail instead of paying twice.
      const eligible = await tx
        .select({ order: orders, currency: paymentIntents.currency })
        .from(orders)
        .leftJoin(payoutLines, eq(payoutLines.orderId, orders.id))
        .innerJoin(orderGroups, eq(orderGroups.id, orders.orderGroupId))
        .innerJoin(paymentIntents, eq(paymentIntents.id, orderGroups.paymentIntentId))
        .where(
          and(
            eq(orders.sellerId, input.sellerId),
            eq(orders.status, "delivered"),
            isNull(payoutLines.id),
            ne(paymentIntents.method, "cod"),
            sql`NOT EXISTS (SELECT 1 FROM payout_holds h WHERE h.order_id = ${orders.id} AND h.status = 'held')`,
          // Seller-only confirmations wait out the buyer's report window.
          or(isNull(orders.payoutReleaseAt), sql`${orders.payoutReleaseAt} <= now()`),
          sql`${orders.subtotalPesewas} > ${orders.refundedPesewas}`,
          ),
        )
      if (!eligible.length) throw new PayoutBlockedError("nothing_payable", "No delivered, paid-online orders are waiting for a payout.")
      if (new Set(eligible.map((r) => r.currency)).size !== 1) {
        throw new PayoutBlockedError("mixed_currency", "These orders were paid in different currencies; pay them out separately.")
      }
      const batch = computePayoutBatch(
        input.sellerId,
        input.commissionBps,
        eligible.map((r) => ({ orderId: r.order.id, sellerId: r.order.sellerId, subtotalPesewas: r.order.subtotalPesewas - r.order.refundedPesewas })),
      )
      // Refunds on orders already paid out come off this payout, oldest first.
      const owedRows = await tx
        .select({ id: returnCases.id, amountMinor: returnCases.sellerRecoveryPesewas })
        .from(returnCases)
        .where(
          and(
            eq(returnCases.sellerId, input.sellerId),
            sql`${returnCases.sellerRecoveryPesewas} > 0`,
            isNull(returnCases.recoveredPayoutId),
            or(isNull(returnCases.refundStatus), ne(returnCases.refundStatus, "failed")),
          ),
        )
        .orderBy(asc(returnCases.createdAt))
        .for("update")
      const recovered = applyRecoveries(batch.netPesewas, owedRows)
      const payoutId = crypto.randomUUID()
      const [row] = await tx
        .insert(payouts)
        .values({
          id: payoutId,
          sellerId: input.sellerId,
          status: "pending",
          grossPesewas: batch.grossPesewas,
          commissionPesewas: batch.commissionPesewas,
          netPesewas: batch.netPesewas - recovered.totalMinor,
          recoveredPesewas: recovered.totalMinor,
          commissionBps: input.commissionBps,
          paystackReference: input.reference,
          createdBy: input.createdBy,
        })
        .returning()
      if (!row) throw new Error("failed to create payout")
      for (const line of batch.lines) {
        await tx.insert(payoutLines).values({
          id: crypto.randomUUID(),
          payoutId,
          orderId: line.orderId,
          grossPesewas: line.grossPesewas,
          commissionPesewas: line.commissionPesewas,
          netPesewas: line.netPesewas,
        })
      }
      await tx.insert(payoutEvents).values({
        id: crypto.randomUUID(),
        payoutId,
        status: "created",
        actor: input.createdBy,
        detail: `${batch.lines.length} order${batch.lines.length === 1 ? "" : "s"}${recovered.totalMinor > 0n ? ` · ${recovered.applied.length} refund${recovered.applied.length === 1 ? "" : "s"} taken back` : ""}`,
      })
      if (recovered.applied.length) {
        await tx.update(returnCases).set({ recoveredPayoutId: payoutId }).where(inArray(returnCases.id, recovered.applied.map((r) => r.id)))
      }
      return toPayout(row)
    })
  }

  async markPayoutSent(payoutId: string, transferCode: string | null, actor: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(payouts)
        .set({ status: "processing", paystackTransferCode: transferCode, updatedAt: new Date() })
        .where(and(eq(payouts.id, payoutId), eq(payouts.status, "pending")))
        .returning()
      if (row) {
        await tx.insert(payoutEvents).values({ id: crypto.randomUUID(), payoutId, status: "sent", actor, detail: transferCode })
        return toPayout(row)
      }
      const [cur] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1)
      return cur ? toPayout(cur) : null
    })
  }

  async settlePayout(payoutId: string, to: "paid" | "failed" | "reversed", opts: { actor: string; reason?: string | null; transferCode?: string | null }) {
    return this.db.transaction(async (tx) => {
      const [cur] = await tx.select().from(payouts).where(eq(payouts.id, payoutId)).for("update").limit(1)
      if (!cur) return { payout: null, changed: false }
      if (cur.status === to || !canMovePayout(cur.status, to)) return { payout: toPayout(cur), changed: false }
      const now = new Date()
      const [row] = await tx
        .update(payouts)
        .set({
          status: to,
          updatedAt: now,
          ...(opts.transferCode ? { paystackTransferCode: opts.transferCode } : {}),
          ...(to === "paid" ? { paidAt: now } : { failureReason: opts.reason ?? null }),
        })
        .where(eq(payouts.id, payoutId))
        .returning()
      const [cur2] = await tx
        .select({ currency: paymentIntents.currency })
        .from(payoutLines)
        .innerJoin(orders, eq(orders.id, payoutLines.orderId))
        .innerJoin(orderGroups, eq(orderGroups.id, orders.orderGroupId))
        .innerJoin(paymentIntents, eq(paymentIntents.id, orderGroups.paymentIntentId))
        .where(eq(payoutLines.payoutId, payoutId))
        .limit(1)
      const ledger = new PostgresLedgerStore(tx)
      if (to === "paid") {
        if (!cur2) throw new Error("payout has no lines to resolve currency")
        await ledger.append(payoutEntry({ payoutId, sellerId: cur.sellerId, netMinor: cur.netPesewas, currency: cur2.currency }))
      } else {
        if (to === "reversed" && cur2) {
          await ledger.append(payoutReversalEntry({ payoutId, sellerId: cur.sellerId, netMinor: cur.netPesewas, currency: cur2.currency }))
        }
        // The money never arrived: those orders go back into the next payout.
        const back = await tx.select({ orderId: payoutLines.orderId }).from(payoutLines).where(eq(payoutLines.payoutId, payoutId))
        if (back.length) {
          // Refunded while in this payout: the order now pays only what's left,
          // so there's nothing to take back any more.
          await tx
            .update(returnCases)
            .set({ sellerRecoveryPesewas: 0n })
            .where(and(inArray(returnCases.orderId, back.map((b) => b.orderId)), isNull(returnCases.recoveredPayoutId)))
        }
        await tx.delete(payoutLines).where(eq(payoutLines.payoutId, payoutId))
        // Refunds it took back are owed again.
        await tx.update(returnCases).set({ recoveredPayoutId: null }).where(eq(returnCases.recoveredPayoutId, payoutId))
      }
      await tx.insert(payoutEvents).values({ id: crypto.randomUUID(), payoutId, status: to, actor: opts.actor, detail: opts.reason ?? null })
      return { payout: row ? toPayout(row) : null, changed: true }
    })
  }

  async getPayoutByReference(reference: string) {
    const [row] = await this.db.select().from(payouts).where(eq(payouts.paystackReference, reference)).limit(1)
    return row ? toPayout(row) : null
  }

  async listPayoutLines(payoutId: string) {
    const rows = await this.db.select().from(payoutLines).where(eq(payoutLines.payoutId, payoutId))
    return rows.map((r) => ({ orderId: r.orderId, grossPesewas: r.grossPesewas, commissionPesewas: r.commissionPesewas, netPesewas: r.netPesewas }))
  }

  async listPayoutEvents(payoutIds: string[]) {
    if (!payoutIds.length) return []
    const rows = await this.db.select().from(payoutEvents).where(inArray(payoutEvents.payoutId, payoutIds)).orderBy(asc(payoutEvents.createdAt))
    return rows.map((r) => ({ ...r }))
  }

  async addPayoutEvent(payoutId: string, status: string, actor: string, detail: string | null = null) {
    await this.db.insert(payoutEvents).values({ id: crypto.randomUUID(), payoutId, status, actor, detail })
  }

  async recordPaystackEvent(row: Omit<PaystackEventRow, "receivedAt">) {
    await this.db
      .insert(paystackEvents)
      .values(row)
      .onConflictDoUpdate({ target: paystackEvents.id, set: { outcome: row.outcome, detail: row.detail, status: row.status } })
  }

  async listPaystackEvents(limit = 100) {
    const rows = await this.db.select().from(paystackEvents).orderBy(desc(paystackEvents.receivedAt)).limit(Math.max(1, Math.min(limit, 500)))
    return rows.map((r) => ({ ...r }))
  }

  async createPayout(input: {
    sellerId: string
    commissionBps: number
    paystackTransferCode: string
    paystackReference: string
  }) {
    const reserved = await this.reservePayout({ ...input, reference: input.paystackReference, createdBy: "system" })
    await this.markPayoutSent(reserved.id, input.paystackTransferCode, "system")
    const { payout } = await this.settlePayout(reserved.id, "paid", { actor: "system" })
    return payout!
  }

  async getPayout(id: string) {
    const [row] = await this.db.select().from(payouts).where(eq(payouts.id, id)).limit(1)
    return row ? toPayout(row) : null
  }

  async listRecentPayouts(limit = 50) {
    const take = Math.max(1, Math.min(limit, 200))
    const rows = await this.db
      .select()
      .from(payouts)
      .orderBy(desc(payouts.createdAt))
      .limit(take)
    return rows.map((row) => ({ ...toPayout(row), createdAt: row.createdAt }))
  }

  async listPayoutsForSeller(sellerId: string) {
    const rows = await this.db
      .select()
      .from(payouts)
      .where(eq(payouts.sellerId, sellerId))
      .orderBy(desc(payouts.createdAt))
    return rows.map((row) => ({ ...toPayout(row), createdAt: row.createdAt }))
  }

  async listPaidLinesForSeller(sellerId: string) {
    const rows = await this.db
      .select({
        payoutId: payoutLines.payoutId,
        orderId: payoutLines.orderId,
        grossPesewas: payoutLines.grossPesewas,
        commissionPesewas: payoutLines.commissionPesewas,
        netPesewas: payoutLines.netPesewas,
        payoutStatus: payouts.status,
        paidAt: payouts.paidAt,
      })
      .from(payoutLines)
      .innerJoin(payouts, eq(payouts.id, payoutLines.payoutId))
      .where(eq(payouts.sellerId, sellerId))
    return rows.map((r) => ({
      payoutId: r.payoutId,
      orderId: r.orderId,
      grossPesewas: r.grossPesewas,
      commissionPesewas: r.commissionPesewas,
      netPesewas: r.netPesewas,
      payoutStatus: r.payoutStatus,
      paidAt: r.paidAt,
    }))
  }

  async listPayoutHolds(sellerId: string, activeOnly = true) {
    const rows = await this.db
      .select()
      .from(payoutHolds)
      .where(
        activeOnly
          ? and(eq(payoutHolds.sellerId, sellerId), eq(payoutHolds.status, "held"))
          : eq(payoutHolds.sellerId, sellerId),
      )
      .orderBy(desc(payoutHolds.createdAt))
    return rows.map((r) => ({
      id: r.id,
      sellerId: r.sellerId,
      orderId: r.orderId,
      amountPesewas: r.amountPesewas,
      reason: r.reason,
      status: r.status,
      createdBy: r.createdBy,
      releasedBy: r.releasedBy,
      releasedAt: r.releasedAt,
      createdAt: r.createdAt,
    }))
  }

  async createPayoutHold(input: {
    sellerId: string
    orderId?: string | null
    amountPesewas?: bigint | null
    reason: string
    createdBy: string
  }) {
    const reason = input.reason?.trim()
    if (!reason) throw new Error("reason required")
    if (input.orderId) {
      const [order] = await this.db
        .select({ id: orders.id, sellerId: orders.sellerId })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1)
      if (!order || order.sellerId !== input.sellerId) {
        throw new Error("order not in this seller's orders")
      }
    }
    if (input.amountPesewas !== undefined && input.amountPesewas !== null && input.amountPesewas < 0n) {
      throw new Error("amount must be >= 0")
    }
    const id = crypto.randomUUID()
    try {
      const [row] = await this.db
        .insert(payoutHolds)
        .values({
          id,
          sellerId: input.sellerId,
          orderId: input.orderId ?? null,
          amountPesewas: input.amountPesewas ?? null,
          reason,
          status: "held",
          createdBy: input.createdBy,
        })
        .returning()
      if (!row) throw new Error("hold insert failed")
      return {
        id: row.id,
        sellerId: row.sellerId,
        orderId: row.orderId,
        amountPesewas: row.amountPesewas,
        reason: row.reason,
        status: row.status,
        createdBy: row.createdBy,
        releasedBy: row.releasedBy,
        releasedAt: row.releasedAt,
        createdAt: row.createdAt,
      }
    } catch (err) {
      // Honors the Phase 4 gate: writes require 0023, applied via
      // POST /admin/migrate/blueprint-phase4.
      throw new Error(
        "payout hold store unavailable - POST /admin/migrate/blueprint-phase4",
        { cause: err },
      )
    }
  }

  async releasePayoutHold(id: string, releasedBy: string) {
    const [row] = await this.db
      .select()
      .from(payoutHolds)
      .where(eq(payoutHolds.id, id))
      .limit(1)
    if (!row) return null
    const [updated] = await this.db
      .update(payoutHolds)
      .set({ status: "released", releasedBy, releasedAt: new Date() })
      .where(eq(payoutHolds.id, id))
      .returning()
    if (!updated) return null
    return {
      id: updated.id,
      sellerId: updated.sellerId,
      orderId: updated.orderId,
      amountPesewas: updated.amountPesewas,
      reason: updated.reason,
      status: updated.status,
      createdBy: updated.createdBy,
      releasedBy: updated.releasedBy,
      releasedAt: updated.releasedAt,
      createdAt: updated.createdAt,
    }
  }

  async createReturnCase(input: {
    orderId: string
    sellerId: string
    buyerEmail: string
    reason: ReturnReason
    wish: ReturnWish
    note: string
    respondBy: Date
  }): Promise<ReturnCaseRow> {
    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: orders.id, sellerId: orders.sellerId, payoutLineId: payoutLines.id })
        .from(orders)
        .leftJoin(payoutLines, eq(payoutLines.orderId, orders.id))
        .where(eq(orders.id, input.orderId))
        .for("update", { of: orders })
        .limit(1)
      if (!order || order.sellerId !== input.sellerId) throw new Error("order not in this seller's orders")
      const [open] = await tx
        .select({ id: returnCases.id })
        .from(returnCases)
        .where(and(eq(returnCases.orderId, input.orderId), ne(returnCases.status, "closed")))
        .limit(1)
      if (open) throw new ReturnCaseOpenError(open.id)
      const now = new Date()
      let row: typeof returnCases.$inferSelect | undefined
      try {
        ;[row] = await tx
          .insert(returnCases)
          .values({
            id: crypto.randomUUID(),
            ...input,
            status: "requested",
            timeline: [{ at: now.toISOString(), by: "buyer", status: "requested", note: "Buyer asked for a return" }],
          })
          .returning()
      } catch (err) {
        if (isUniqueViolation(err, "return_cases_one_open")) throw new ReturnCaseOpenError("")
        throw err
      }
      if (!row) throw new Error("failed to open return")
      // The order's payout waits while the case is open (if it hasn't gone out yet).
      if (!order.payoutLineId) {
        const [held] = await tx
          .select({ id: payoutHolds.id })
          .from(payoutHolds)
          .where(and(eq(payoutHolds.orderId, input.orderId), eq(payoutHolds.status, "held"), eq(payoutHolds.createdBy, "buyer")))
          .limit(1)
        if (!held) {
          await tx.insert(payoutHolds).values({
            id: crypto.randomUUID(),
            sellerId: input.sellerId,
            orderId: input.orderId,
            reason: `Return requested: ${input.note}`,
            status: "held",
            createdBy: "buyer",
          })
        }
      }
      return mapReturnCase(row)
    })
  }

  async getReturnCase(id: string) {
    const [row] = await this.db.select().from(returnCases).where(eq(returnCases.id, id)).limit(1)
    return row ? mapReturnCase(row) : null
  }

  async listReturnCases(f: ReturnCaseFilter) {
    const where = [
      f.sellerId ? eq(returnCases.sellerId, f.sellerId) : undefined,
      f.orderIds ? (f.orderIds.length ? inArray(returnCases.orderId, f.orderIds) : sql`false`) : undefined,
      f.buyerEmail ? sql`lower(${returnCases.buyerEmail}) = ${f.buyerEmail.toLowerCase()}` : undefined,
      f.statuses ? (f.statuses.length ? inArray(returnCases.status, f.statuses) : sql`false`) : undefined,
      f.dueAt ? and(ne(returnCases.status, "closed"), lte(returnCases.respondBy, f.dueAt)) : undefined,
      f.refundPending ? and(eq(returnCases.refundVia, "provider"), eq(returnCases.refundStatus, "pending")) : undefined,
    ].filter(Boolean)
    const rows = await this.db
      .select()
      .from(returnCases)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(returnCases.createdAt))
      .limit(500)
    return rows.map(mapReturnCase)
  }

  async advanceReturnCase(id: string, from: ReturnStatus, change: ReturnCaseChange) {
    return this.db.transaction(async (tx) => {
      const now = new Date()
      const entry: ReturnTimelineEntry = { at: now.toISOString(), by: change.entry.by, status: change.status, note: change.entry.note }
      const money = change.refund && change.refund.minor > 0n ? change.refund : null
      const [row] = await tx
        .update(returnCases)
        .set({
          status: change.status,
          respondBy: change.respondBy,
          updatedAt: now,
          timeline: sql`${returnCases.timeline} || ${JSON.stringify([entry])}::jsonb`,
          ...(change.declineReason !== undefined ? { declineReason: change.declineReason } : {}),
          ...(change.outcome !== undefined ? { outcome: change.outcome } : {}),
          ...(change.adminNote !== undefined ? { adminNote: change.adminNote } : {}),
          ...(change.status === "closed" ? { closedAt: now } : {}),
          ...(money
            ? {
                refundPesewas: money.minor,
                refundVia: money.via,
                refundStatus: money.status,
                refundRef: money.ref ?? null,
                sellerRecoveryPesewas: money.sellerRecoveryMinor,
              }
            : {}),
        })
        .where(and(eq(returnCases.id, id), eq(returnCases.status, from)))
        .returning()
      if (!row) return null
      if (money) {
        await tx
          .update(orders)
          .set({ refundedPesewas: sql`${orders.refundedPesewas} + ${money.minor}` })
          .where(eq(orders.id, row.orderId))
        const ledger = new PostgresLedgerStore(tx)
        for (const e of refundEntries({ caseId: row.id, orderId: row.orderId, intentId: money.intentId, sellerId: row.sellerId, refundMinor: money.minor, platformMinor: money.platformMinor, currency: money.currency })) {
          await ledger.append(e)
        }
      }
      if (change.status === "closed") {
        await tx
          .update(payoutHolds)
          .set({ status: "released", releasedBy: "return closed", releasedAt: now })
          .where(and(eq(payoutHolds.orderId, row.orderId), eq(payoutHolds.status, "held"), eq(payoutHolds.createdBy, "buyer")))
      }
      return mapReturnCase(row)
    })
  }

  async setReturnRefund(id: string, patch: { status: "pending" | "paid" | "failed" | "owed"; ref?: string | null; entry?: { by: ReturnCaseRow["timeline"][number]["by"]; note: string } }) {
    const now = new Date()
    const [cur] = await this.db.select({ status: returnCases.status }).from(returnCases).where(eq(returnCases.id, id)).limit(1)
    if (!cur) return null
    const entry = patch.entry ? [{ at: now.toISOString(), by: patch.entry.by, status: cur.status, note: patch.entry.note }] : []
    const [row] = await this.db
      .update(returnCases)
      .set({
        refundStatus: patch.status,
        updatedAt: now,
        ...(patch.ref !== undefined ? { refundRef: patch.ref } : {}),
        ...(entry.length ? { timeline: sql`${returnCases.timeline} || ${JSON.stringify(entry)}::jsonb` } : {}),
      })
      .where(and(eq(returnCases.id, id), sql`${returnCases.refundPesewas} > 0`))
      .returning()
    return row ? mapReturnCase(row) : null
  }

  async enqueueNotification(input: {
    key: string
    recipient: string
    body: string
    channel?: string
    category?: "transactional" | "promotional" | "operational"
  }) {
    const inserted = await this.db
      .insert(notifications)
      .values({
        id: crypto.randomUUID(),
        key: input.key,
        recipient: input.recipient,
        body: input.body,
        channel: input.channel ?? "sms",
        category: input.category ?? "transactional",
      })
      .onConflictDoNothing({ target: notifications.key })
      .returning({ id: notifications.id })
    return { inserted: inserted.length > 0 }
  }

  async countRecentSends(recipient: string, channel: string, since: Date): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipient, recipient),
          eq(notifications.channel, channel),
          gte(notifications.createdAt, since),
        ),
      )
    return Number(rows[0]?.count ?? 0)
  }

  async claimPendingNotifications(limit = 50, maxAttempts = 5) {
    const take = Math.max(1, Math.min(limit, 200))
    const rows = await this.db.execute(sql`
      UPDATE notifications SET attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM notifications
        WHERE status = 'pending' OR (status = 'failed' AND attempts < ${maxAttempts})
        ORDER BY created_at ASC LIMIT ${take}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, key, channel, recipient, body, category, status, attempts, last_error, created_at, sent_at
    `)
    return (rows as unknown as Array<{
      id: string
      key: string
      channel: string
      recipient: string
      body: string
      category: string
      status: "pending" | "sent" | "failed"
      attempts: number
      last_error: string | null
      created_at: Date
      sent_at: Date | null
    }>).map((r) => ({
      id: r.id,
      key: r.key,
      channel: r.channel,
      recipient: r.recipient,
      body: r.body,
      category: r.category,
      status: r.status,
      attempts: r.attempts,
      lastError: r.last_error,
      createdAt: r.created_at,
      sentAt: r.sent_at,
    }))
  }

  async markNotificationSent(id: string) {
    await this.db
      .update(notifications)
      .set({ status: "sent", lastError: null, sentAt: new Date() })
      .where(eq(notifications.id, id))
  }

  async markNotificationFailed(id: string, error: string) {
    await this.db
      .update(notifications)
      .set({ status: "failed", lastError: error.slice(0, 500) })
      .where(eq(notifications.id, id))
  }

  async productHasOrders(productId: string) {
    const rows = await this.db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.productId, productId))
      .limit(1)
    return rows.length > 0
  }

  private toReviewRow(r: typeof reviews.$inferSelect) {
    return {
      id: r.id,
      orderId: r.orderId,
      productId: r.productId,
      sellerId: r.sellerId,
      buyerEmail: r.buyerEmail,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status as "pending" | "published" | "hidden",
      vendorResponse: r.vendorResponse,
      respondedAt: r.respondedAt,
      createdAt: r.createdAt,
    }
  }

  async createReview(input: {
    orderId: string
    productId: string
    sellerId: string
    buyerEmail: string
    rating: number
    title: string | null
    body: string
    status?: "pending" | "published"
  }) {
    try {
      const [row] = await this.db
        .insert(reviews)
        .values({ id: crypto.randomUUID(), ...input })
        .returning()
      return row ? this.toReviewRow(row) : null
    } catch {
      // Unique order_id (or FK) violation → duplicate review attempt.
      return null
    }
  }

  async getReview(id: string) {
    const [row] = await this.db.select().from(reviews).where(eq(reviews.id, id)).limit(1)
    return row ? this.toReviewRow(row) : null
  }

  async listReviewsBySeller(sellerId: string) {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.sellerId, sellerId))
      .orderBy(desc(reviews.createdAt))
    return rows.map((r) => this.toReviewRow(r))
  }

  async productOrderCounts(since?: Date) {
    const rows = await this.db
      .select({
        productId: orderItems.productId,
        units: sql<string | number>`sum(${orderItems.qty})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(orderGroups, eq(orderGroups.id, orders.orderGroupId))
      .where(since ? gte(orderGroups.createdAt, since) : undefined)
      .groupBy(orderItems.productId)
    const out = new Map<string, number>()
    for (const r of rows) out.set(r.productId, Number(r.units))
    return out
  }

  async reviewTotalsBySeller() {
    const rows = await this.db
      .select({
        sellerId: reviews.sellerId,
        count: sql<number>`count(*)`,
        avg: sql<string | number>`avg(${reviews.rating})`,
      })
      .from(reviews)
      .where(eq(reviews.status, "published"))
      .groupBy(reviews.sellerId)
    const out = new Map<string, { count: number; avg: number }>()
    for (const r of rows) {
      const count = Number(r.count)
      if (count <= 0) continue
      out.set(r.sellerId, {
        count,
        avg: Math.round(Number(r.avg) * 10) / 10,
      })
    }
    return out
  }

  async reviewTotalsByProduct() {
    const rows = await this.db
      .select({
        productId: reviews.productId,
        count: sql<number>`count(*)`,
        avg: sql<string | number>`avg(${reviews.rating})`,
      })
      .from(reviews)
      .where(eq(reviews.status, "published"))
      .groupBy(reviews.productId)
    const out = new Map<string, { count: number; avg: number }>()
    for (const r of rows) {
      const count = Number(r.count)
      if (count <= 0) continue
      out.set(r.productId, {
        count,
        avg: Math.round(Number(r.avg) * 10) / 10,
      })
    }
    return out
  }

  async listPublishedReviewsByProduct(productId: string) {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.status, "published")))
      .orderBy(desc(reviews.createdAt))
    return rows.map((r) => this.toReviewRow(r))
  }

  // ── Phase 7A: preference center ──

  private toPreferenceDto(
    row: typeof notificationPreferences.$inferSelect,
  ): NotificationPreferenceDto {
    return {
      id: row.id,
      ownerType: row.ownerType === "seller" ? "seller" : "buyer",
      ownerId: row.ownerId,
      channel: row.channel,
      category:
        row.category === "promotional" || row.category === "operational"
          ? row.category
          : "transactional",
      topic: row.topic,
      optedIn: row.optedIn === 1,
      frequencyCap: row.frequencyCap,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  async listNotificationPreferences(
    ownerType: "buyer" | "seller",
    ownerId: string,
  ): Promise<NotificationPreferenceDto[]> {
    const rows = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.ownerType, ownerType),
          eq(notificationPreferences.ownerId, ownerId),
        ),
      )
      .orderBy(asc(notificationPreferences.category))
    return rows.map((r) => this.toPreferenceDto(r))
  }

  async setNotificationPreference(input: {
    ownerType: "buyer" | "seller"
    ownerId: string
    channel: string
    category: "transactional" | "promotional" | "operational"
    topic?: string | null
    optedIn: boolean
    frequencyCap?: number | null
  }): Promise<NotificationPreferenceDto> {
    const topic = input.topic ?? null
    const [existing] = await this.db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.ownerType, input.ownerType),
          eq(notificationPreferences.ownerId, input.ownerId),
          eq(notificationPreferences.channel, input.channel),
          eq(notificationPreferences.category, input.category),
          input.topic == null
            ? isNull(notificationPreferences.topic)
            : eq(notificationPreferences.topic, input.topic),
        ),
      )
      .limit(1)
    const now = new Date()
    if (existing) {
      const [updated] = await this.db
        .update(notificationPreferences)
        .set({
          optedIn: input.optedIn ? 1 : 0,
          frequencyCap: input.frequencyCap ?? null,
          updatedAt: now,
        })
        .where(eq(notificationPreferences.id, existing.id))
        .returning()
      if (!updated) throw new Error("preference update failed")
      return this.toPreferenceDto(updated)
    }
    const [row] = await this.db
      .insert(notificationPreferences)
      .values({
        id: crypto.randomUUID(),
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        channel: input.channel,
        category: input.category,
        topic,
        optedIn: input.optedIn ? 1 : 0,
        frequencyCap: input.frequencyCap ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    if (!row) throw new Error("preference insert failed")
    return this.toPreferenceDto(row)
  }

  // ── Phase 7B: alert subscriptions ──

  private toSubscriptionDto(
    row: typeof stockSubscriptions.$inferSelect,
  ): StockSubscriptionDto {
    return {
      id: row.id,
      buyerEmail: row.buyerEmail,
      productId: row.productId,
      offerId: row.offerId,
      kind: row.kind === "price_drop" ? "price_drop" : "back_in_stock",
      belowPesewas: row.belowPesewas != null ? row.belowPesewas.toString() : null,
      channel: row.channel,
      createdAt: row.createdAt,
    }
  }

  async listStockSubscriptions(filters: {
    offerId?: string
    buyerEmail?: string
  }): Promise<StockSubscriptionDto[]> {
    const conds = []
    if (filters.offerId) conds.push(eq(stockSubscriptions.offerId, filters.offerId))
    if (filters.buyerEmail) {
      conds.push(eq(stockSubscriptions.buyerEmail, filters.buyerEmail.trim().toLowerCase()))
    }
    const rows = await this.db
      .select()
      .from(stockSubscriptions)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(asc(stockSubscriptions.createdAt))
    return rows.map((r) => this.toSubscriptionDto(r))
  }

  async createStockSubscription(input: {
    buyerEmail: string
    productId: string
    offerId?: string | null
    kind: "back_in_stock" | "price_drop"
    belowPesewas?: bigint | null
    channel?: string
  }): Promise<StockSubscriptionDto> {
    const email = input.buyerEmail.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("invalid buyer email")
    if (input.kind === "price_drop" && (input.belowPesewas == null || input.belowPesewas < 0n)) {
      throw new Error("price_drop needs a target belowPesewas >= 0")
    }
    try {
      const [row] = await this.db
        .insert(stockSubscriptions)
        .values({
          id: crypto.randomUUID(),
          buyerEmail: email,
          productId: input.productId,
          offerId: input.offerId ?? null,
          kind: input.kind,
          belowPesewas: input.belowPesewas ?? null,
          channel: input.channel ?? "sms",
        })
        .returning()
      if (!row) throw new Error("subscription insert failed")
      return this.toSubscriptionDto(row)
    } catch (err) {
      throw new Error("subscription store unavailable - POST /admin/migrate/blueprint-phase7", {
        cause: err,
      })
    }
  }

  async deleteStockSubscription(id: string, buyerEmail: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: stockSubscriptions.id, buyerEmail: stockSubscriptions.buyerEmail })
      .from(stockSubscriptions)
      .where(eq(stockSubscriptions.id, id))
      .limit(1)
    if (!row || row.buyerEmail !== buyerEmail.trim().toLowerCase()) return false
    await this.db.delete(stockSubscriptions).where(eq(stockSubscriptions.id, id))
    return true
  }

  // ── Phase 7D: experiment registry ──

  private toExperimentDto(row: typeof experiments.$inferSelect): ExperimentDto {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      status: row.status,
      controlPct: row.controlPct,
      primaryMetric: row.primaryMetric,
      guardrails: row.guardrails,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    }
  }

  async listExperiments(status?: ExperimentDto["status"]): Promise<ExperimentDto[]> {
    const rows = await this.db
      .select()
      .from(experiments)
      .where(status ? eq(experiments.status, status) : undefined)
      .orderBy(desc(experiments.createdAt))
    return rows.map((r) => this.toExperimentDto(r))
  }

  async getExperiment(id: string): Promise<ExperimentDto | null> {
    const [row] = await this.db.select().from(experiments).where(eq(experiments.id, id)).limit(1)
    return row ? this.toExperimentDto(row) : null
  }

  async createExperiment(input: {
    key: string
    name: string
    description?: string | null
    controlPct?: number
    primaryMetric?: string | null
    guardrails?: unknown
    createdBy: string
  }): Promise<ExperimentDto> {
    const key = input.key.trim()
    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(key)) {
      throw new Error("key must be kebab-case (3-64 chars)")
    }
    const name = input.name?.trim()
    if (!name) throw new Error("name required")
    const controlPct = input.controlPct ?? 50
    if (!Number.isInteger(controlPct) || controlPct < 0 || controlPct > 100) {
      throw new Error("controlPct must be 0-100")
    }
    if (!input.createdBy?.trim()) throw new Error("createdBy required")
    try {
      const [row] = await this.db
        .insert(experiments)
        .values({
          id: crypto.randomUUID(),
          key,
          name,
          description: input.description?.trim() || null,
          status: "draft",
          controlPct,
          primaryMetric: input.primaryMetric?.trim() || null,
          guardrails: input.guardrails ?? null,
          createdBy: input.createdBy.trim(),
        })
        .returning()
      if (!row) throw new Error("experiment insert failed")
      return this.toExperimentDto(row)
    } catch (err) {
      const [existing] = await this.db.select({ id: experiments.id }).from(experiments).where(eq(experiments.key, key)).limit(1).catch(() => [])
      if (existing) throw new Error("experiment key already used")
      throw new Error("experiment store unavailable - POST /admin/migrate/blueprint-phase7", {
        cause: err,
      })
    }
  }

  async updateExperiment(id: string, patch: {
    name?: string
    description?: string | null
    controlPct?: number
    primaryMetric?: string | null
    guardrails?: unknown
    status?: ExperimentDto["status"]
  }): Promise<ExperimentDto | null> {
    const [row] = await this.db.select().from(experiments).where(eq(experiments.id, id)).limit(1)
    if (!row) return null
    const set: Partial<typeof experiments.$inferInsert> = {}
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name) throw new Error("name required")
      set.name = name
    }
    if (patch.description !== undefined) set.description = patch.description?.trim() || null
    if (patch.controlPct !== undefined) {
      if (row.status === "running" || row.status === "ended") {
        throw new Error("controlPct is frozen once running")
      }
      if (!Number.isInteger(patch.controlPct) || patch.controlPct < 0 || patch.controlPct > 100) {
        throw new Error("controlPct must be 0-100")
      }
      set.controlPct = patch.controlPct
    }
    if (patch.primaryMetric !== undefined) set.primaryMetric = patch.primaryMetric?.trim() || null
    if (patch.guardrails !== undefined) set.guardrails = patch.guardrails ?? null
    if (patch.status !== undefined) {
      const ok =
        (row.status === "draft" && patch.status === "running") ||
        (row.status === "running" && (patch.status === "paused" || patch.status === "ended")) ||
        (row.status === "paused" && (patch.status === "running" || patch.status === "ended"))
      if (!ok) throw new Error(`cannot move ${row.status} to ${patch.status}`)
      set.status = patch.status
      const now = new Date()
      if (patch.status === "running" && !row.startedAt) set.startedAt = now
      if (patch.status === "ended") set.endedAt = now
    }
    if (Object.keys(set).length === 0) return this.toExperimentDto(row)
    const [fresh] = await this.db.update(experiments).set(set).where(eq(experiments.id, id)).returning()
    if (!fresh) return null
    return this.toExperimentDto(fresh)
  }

  async assignExperiment(
    experimentKey: string,
    unitId: string,
  ): Promise<{ experimentId: string; bucket: "control" | "exposed" } | null> {
    const [exp] = await this.db
      .select()
      .from(experiments)
      .where(eq(experiments.key, experimentKey.trim()))
      .limit(1)
    if (!exp) return null
    const unit = unitId.trim()
    if (!unit) return null
    if (exp.status !== "running") return { experimentId: exp.id, bucket: "control" }
    const [seen] = await this.db
      .select()
      .from(experimentExposures)
      .where(and(eq(experimentExposures.experimentId, exp.id), eq(experimentExposures.unitId, unit)))
      .limit(1)
    if (seen) return { experimentId: exp.id, bucket: seen.bucket === "exposed" ? "exposed" : "control" }
    let hash = 2166136261
    const input = `${exp.id}:${unit}`
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    const bucket = (hash >>> 0) % 100 < exp.controlPct ? "control" : "exposed"
    await this.db
      .insert(experimentExposures)
      .values({ id: crypto.randomUUID(), experimentId: exp.id, unitId: unit, bucket })
      .onConflictDoNothing({ target: [experimentExposures.experimentId, experimentExposures.unitId] })
    return { experimentId: exp.id, bucket }
  }

  async reportExperiment(id: string): Promise<{ control: number; exposed: number } | null> {
    const [exp] = await this.db.select({ id: experiments.id }).from(experiments).where(eq(experiments.id, id)).limit(1)
    if (!exp) return null
    const rows = await this.db
      .select({ bucket: experimentExposures.bucket })
      .from(experimentExposures)
      .where(eq(experimentExposures.experimentId, id))
    let control = 0
    let exposed = 0
    for (const r of rows) {
      if (r.bucket === "exposed") exposed += 1
      else control += 1
    }
    return { control, exposed }
  }

  async listPendingReviews() {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.status, "pending"))
      .orderBy(reviews.createdAt)
    return rows.map((r) => this.toReviewRow(r))
  }

  async listRecentPublishedReviews(limit: number) {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.status, "published"))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
    return rows.map((r) => this.toReviewRow(r))
  }

  async updateReviewStatus(id: string, status: "published" | "hidden") {
    const [row] = await this.db
      .update(reviews)
      .set({ status })
      .where(eq(reviews.id, id))
      .returning()
    return row ? this.toReviewRow(row) : null
  }

  async respondToReview(id: string, sellerId: string, message: string) {
    const [row] = await this.db
      .update(reviews)
      .set({ vendorResponse: message, respondedAt: new Date() })
      .where(and(eq(reviews.id, id), eq(reviews.sellerId, sellerId)))
      .returning()
    return row ? this.toReviewRow(row) : null
  }
}

function toPayout(row: typeof payouts.$inferSelect): PayoutRow {
  return {
    id: row.id,
    sellerId: row.sellerId,
    status: row.status,
    grossPesewas: row.grossPesewas,
    commissionPesewas: row.commissionPesewas,
    netPesewas: row.netPesewas,
    commissionBps: row.commissionBps,
    paystackTransferCode: row.paystackTransferCode,
    paystackReference: row.paystackReference,
    failureReason: row.failureReason,
    paidAt: row.paidAt,
    createdBy: row.createdBy,
    recoveredPesewas: row.recoveredPesewas ?? 0n,
  }
}
