import {
  carts,
  cartItems,
  notifications,
  offers,
  orders,
  orderGroups,
  orderItems,
  paymentIntents,
  payoutLines,
  payouts,
  products,
  reviews,
  sellers,
  stockReservations,
} from "@alkemart/db"
import {
  assertFulfillmentTransition,
  assertPaymentTransition,
  computePayoutBatch,
  isSellable,
  quoteCart,
  type OrderFulfillmentStatus,
  type PaymentIntentStatus,
} from "@alkemart/domain"
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  CartItemRow,
  CartRow,
  CheckoutOfferView,
  CheckoutRepository,
  OrderGroupRow,
  PaymentIntentRow,
  PayoutRow,
  ShippingAddress,
  OrderRow,
} from "./checkout-repository"

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
    createdAt: row.createdAt,
  }
}

export class PostgresCheckoutRepository implements CheckoutRepository {
  constructor(private readonly db: Db) {}

  async createCart(): Promise<CartRow> {
    const id = crypto.randomUUID()
    const [row] = await this.db
      .insert(carts)
      .values({ id, currency: "ghs", buyerEmail: null })
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

  async quote(cartId: string) {
    const items = await this.listCartItems(cartId)
    if (items.length === 0) return quoteCart([])
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
    return quoteCart(lines)
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
      const quote = quoteCart(quoteLines)
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
        const [order] = await tx
          .insert(orders)
          .values({
            id: orderId,
            orderGroupId,
            sellerId: seller.sellerId,
            subtotalPesewas: seller.subtotalPesewas,
            deliveryFeePesewas: seller.deliveryFeePesewas,
            status: "placed",
          })
          .returning()
        if (!order) throw new Error("failed to create order")
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

  async platformOrderStats() {
    const toBig = (v: bigint | string | number): bigint =>
      typeof v === "bigint" ? v : BigInt(v)
    const groupRows = await this.db
      .select({ totalPesewas: orderGroups.totalPesewas, createdAt: orderGroups.createdAt })
      .from(orderGroups)
      .orderBy(desc(orderGroups.createdAt))
    const itemRows = await this.db
      .select({
        productId: orderItems.productId,
        title: orderItems.title,
        units: sql<number>`sum(${orderItems.qty})`,
        gmv: sql<string | number | bigint>`sum(${orderItems.qty} * ${orderItems.unitPricePesewas})`,
      })
      .from(orderItems)
      .groupBy(orderItems.productId, orderItems.title)
      .orderBy(sql`sum(${orderItems.qty} * ${orderItems.unitPricePesewas}) desc`)
      .limit(10)
    return {
      groups: groupRows.map((g) => ({ totalPesewas: toBig(g.totalPesewas), createdAt: g.createdAt })),
      topItems: itemRows.map((r) => ({
        productId: r.productId,
        title: r.title,
        units: Number(r.units),
        gmvPesewas: toBig(r.gmv),
      })),
    }
  }

  async updateOrderStatus(orderId: string, sellerId: string, status: OrderFulfillmentStatus) {
    const [row] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.sellerId, sellerId)))
      .limit(1)
    if (!row) return null
    assertFulfillmentTransition(row.status as OrderFulfillmentStatus, status)
    const [updated] = await this.db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning()
    return updated ? mapOrder(updated) : null
  }

  async listDeliveredUnpaidOrders(sellerId: string) {
    const rows = await this.db
      .select({ order: orders, payoutLineId: payoutLines.id })
      .from(orders)
      .leftJoin(payoutLines, eq(payoutLines.orderId, orders.id))
      .where(and(eq(orders.sellerId, sellerId), eq(orders.status, "delivered"), isNull(payoutLines.id)))
    return rows.map((r) => mapOrder(r.order))
  }

  async createPayout(input: {
    sellerId: string
    commissionBps: number
    paystackTransferCode: string
    paystackReference: string
  }) {
    const unpaid = await this.listDeliveredUnpaidOrders(input.sellerId)
    if (unpaid.length === 0) throw new Error("no delivered unpaid orders")
    const batch = computePayoutBatch(
      input.sellerId,
      input.commissionBps,
      unpaid.map((o) => ({
        orderId: o.id,
        sellerId: o.sellerId,
        subtotalPesewas: o.subtotalPesewas,
      })),
    )

    return this.db.transaction(async (tx) => {
      // Re-validate payout eligibility inside the transaction: the pre-read
      // above is stale under concurrency, and paying an already-paid order
      // twice is unrecoverable. Unique payout_lines.orderId is the last line
      // of defense; this check keeps the error honest and pre-insert.
      const stillUnpaid = await tx
        .select({ orderId: orders.id })
        .from(orders)
        .leftJoin(payoutLines, eq(payoutLines.orderId, orders.id))
        .where(and(eq(orders.sellerId, input.sellerId), eq(orders.status, "delivered"), isNull(payoutLines.id)))
      const unpaidIds = new Set(stillUnpaid.map((r) => r.orderId))
      for (const line of batch.lines) {
        if (!unpaidIds.has(line.orderId)) {
          throw new Error(`order ${line.orderId} is no longer payout-eligible`)
        }
      }

      const payoutId = crypto.randomUUID()
      const [payout] = await tx
        .insert(payouts)
        .values({
          id: payoutId,
          sellerId: input.sellerId,
          status: "paid",
          grossPesewas: batch.grossPesewas,
          commissionPesewas: batch.commissionPesewas,
          netPesewas: batch.netPesewas,
          commissionBps: input.commissionBps,
          paystackTransferCode: input.paystackTransferCode,
          paystackReference: input.paystackReference,
        })
        .returning()
      if (!payout) throw new Error("failed to create payout")

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

      const result: PayoutRow = {
        id: payout.id,
        sellerId: payout.sellerId,
        status: payout.status,
        grossPesewas: payout.grossPesewas,
        commissionPesewas: payout.commissionPesewas,
        netPesewas: payout.netPesewas,
        commissionBps: payout.commissionBps,
        paystackTransferCode: payout.paystackTransferCode,
        paystackReference: payout.paystackReference,
      }
      return result
    })
  }

  async getPayout(id: string) {
    const [row] = await this.db.select().from(payouts).where(eq(payouts.id, id)).limit(1)
    if (!row) return null
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
    }
  }

  async listRecentPayouts(limit = 50) {
    const take = Math.max(1, Math.min(limit, 200))
    const rows = await this.db
      .select()
      .from(payouts)
      .orderBy(desc(payouts.createdAt))
      .limit(take)
    return rows.map((row) => ({
      id: row.id,
      sellerId: row.sellerId,
      status: row.status,
      grossPesewas: row.grossPesewas,
      commissionPesewas: row.commissionPesewas,
      netPesewas: row.netPesewas,
      commissionBps: row.commissionBps,
      paystackTransferCode: row.paystackTransferCode,
      paystackReference: row.paystackReference,
      createdAt: row.createdAt,
    }))
  }

  async enqueueNotification(input: { key: string; recipient: string; body: string }) {
    const inserted = await this.db
      .insert(notifications)
      .values({ id: crypto.randomUUID(), key: input.key, recipient: input.recipient, body: input.body })
      .onConflictDoNothing({ target: notifications.key })
      .returning({ id: notifications.id })
    return { inserted: inserted.length > 0 }
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
      RETURNING id, key, channel, recipient, body, status, attempts, last_error, created_at, sent_at
    `)
    return (rows as unknown as Array<{
      id: string
      key: string
      channel: string
      recipient: string
      body: string
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

  async listPublishedReviewsByProduct(productId: string) {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(and(eq(reviews.productId, productId), eq(reviews.status, "published")))
      .orderBy(desc(reviews.createdAt))
    return rows.map((r) => this.toReviewRow(r))
  }

  async listPendingReviews() {
    const rows = await this.db
      .select()
      .from(reviews)
      .where(eq(reviews.status, "pending"))
      .orderBy(reviews.createdAt)
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
