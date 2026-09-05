import {
  carts,
  cartItems,
  offers,
  orders,
  orderGroups,
  orderItems,
  paymentIntents,
  payoutLines,
  payouts,
  products,
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
import { and, desc, eq, isNull, sql } from "drizzle-orm"
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
    const [row] = await this.db
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
      .where(eq(offers.id, offerId))
      .limit(1)
    if (!row) return null
    return {
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
    }
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

    const [existing] = await this.db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.offerId, offerId)))
      .limit(1)

    if (existing) {
      const [updated] = await this.db
        .update(cartItems)
        .set({ qty: existing.qty + qty })
        .where(eq(cartItems.id, existing.id))
        .returning()
      if (!updated) throw new Error("failed to update cart item")
      return {
        id: updated.id,
        cartId: updated.cartId,
        offerId: updated.offerId,
        sellerId: updated.sellerId,
        qty: updated.qty,
      }
    }

    const [created] = await this.db
      .insert(cartItems)
      .values({
        id: crypto.randomUUID(),
        cartId,
        offerId,
        sellerId: view.offer.sellerId,
        qty,
      })
      .returning()
    if (!created) throw new Error("failed to create cart item")
    return {
      id: created.id,
      cartId: created.cartId,
      offerId: created.offerId,
      sellerId: created.sellerId,
      qty: created.qty,
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
    const lines = []
    for (const item of items) {
      const view = await this.getOfferView(item.offerId)
      if (!view) throw new Error(`offer missing: ${item.offerId}`)
      lines.push({
        offerId: item.offerId,
        sellerId: item.sellerId,
        qty: item.qty,
        unitPricePesewas: view.offer.pricePesewas,
        deliveryFeePesewas: view.deliveryFeePesewas,
      })
    }
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
    const [row] = await this.db
      .update(paymentIntents)
      .set({ status, updatedAt: new Date() })
      .where(eq(paymentIntents.id, id))
      .returning()
    if (!row) throw new Error("failed to update payment intent")
    return mapIntent(row)
  }

  async reserveStock(paymentIntentId: string, lines: Array<{ offerId: string; qty: number }>) {
    await this.db.transaction(async (tx) => {
      for (const line of lines) {
        const [offer] = await tx.select().from(offers).where(eq(offers.id, line.offerId)).limit(1)
        if (!offer) throw new Error(`offer not found: ${line.offerId}`)
        if (offer.onHand - offer.reserved < line.qty) {
          throw new Error(`insufficient stock for ${line.offerId}`)
        }
        await tx
          .update(offers)
          .set({ reserved: offer.reserved + line.qty })
          .where(eq(offers.id, line.offerId))
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

  async confirmPaidOrder(paymentIntentId: string) {
    const existing = await this.getOrderGroupByPaymentIntent(paymentIntentId)
    if (existing) {
      return { orderGroup: existing, orders: await this.listOrdersForGroup(existing.id) }
    }

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
}
