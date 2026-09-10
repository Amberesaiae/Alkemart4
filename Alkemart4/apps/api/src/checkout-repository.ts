import {
  assertFulfillmentTransition,
  assertPaymentTransition,
  computePayoutBatch,
  isSellable,
  quoteCart,
  type CartQuote,
  type OrderFulfillmentStatus,
  type PaymentIntentStatus,
} from "@alkemart/domain"
import type { CatalogOffer, CatalogSnapshot } from "./demo-seed"

export type CartItemRow = {
  id: string
  cartId: string
  offerId: string
  sellerId: string
  qty: number
}

export type CartRow = {
  id: string
  currency: string
  buyerEmail: string | null
}

export type ShippingAddress = {
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2?: string
  city: string
  province?: string
  country_code: string
  postal_code?: string
}

export type PaymentIntentRow = {
  id: string
  cartId: string
  method: "momo" | "card" | "cod"
  status: PaymentIntentStatus
  amountPesewas: bigint
  currency: string
  paystackReference: string | null
  buyerEmail: string
  momoProvider: string | null
  momoPhone: string | null
  shippingAddress: ShippingAddress | null
  createdAt?: Date
}

export type StockReservationRow = {
  id: string
  paymentIntentId: string
  offerId: string
  qty: number
}

export type OrderGroupRow = {
  id: string
  paymentIntentId: string
  buyerEmail: string
  totalPesewas: bigint
  currency: string
}

export type PlatformOrderStats = {
  groups: { totalPesewas: bigint; createdAt: Date }[]
  topItems: { productId: string; title: string; units: number; gmvPesewas: bigint }[]
}

export type OrderRow = {
  id: string
  orderGroupId: string
  sellerId: string
  subtotalPesewas: bigint
  deliveryFeePesewas: bigint
  status: OrderFulfillmentStatus
  payoutId: string | null
}

export type PayoutRow = {
  id: string
  sellerId: string
  status: "pending" | "processing" | "paid" | "failed"
  grossPesewas: bigint
  commissionPesewas: bigint
  netPesewas: bigint
  commissionBps: number
  paystackTransferCode: string | null
  paystackReference: string | null
}

export type OrderItemRow = {
  id: string
  orderId: string
  offerId: string
  sellerId: string
  productId: string
  title: string
  qty: number
  unitPricePesewas: bigint
}

export type CheckoutOfferView = {
  offer: CatalogOffer
  productStatus: "draft" | "proposed" | "published" | "rejected"
  sellerStatus: "pending_approval" | "open" | "suspended" | "terminated"
  deliveryFeePesewas: bigint
  productTitle: string
  sellerName: string
  sellerHandle: string
}

export interface CheckoutRepository {
  createCart(): Promise<CartRow>
  getCart(cartId: string): Promise<CartRow | null>
  addCartItem(cartId: string, offerId: string, qty: number): Promise<CartItemRow>
  setCartItemQty(cartId: string, itemId: string, qty: number): Promise<CartItemRow | null>
  listCartItems(cartId: string): Promise<CartItemRow[]>
  getOfferView(offerId: string): Promise<CheckoutOfferView | null>
  getOfferViews(offerIds: string[]): Promise<Map<string, CheckoutOfferView>>
  quote(cartId: string): Promise<CartQuote>
  createPaymentIntent(input: Omit<PaymentIntentRow, "status"> & { status: PaymentIntentStatus }): Promise<PaymentIntentRow>
  getPaymentIntent(id: string): Promise<PaymentIntentRow | null>
  getPaymentIntentByReference(ref: string): Promise<PaymentIntentRow | null>
  updatePaymentIntentStatus(id: string, status: PaymentIntentStatus): Promise<PaymentIntentRow>
  reserveStock(paymentIntentId: string, lines: Array<{ offerId: string; qty: number }>): Promise<void>
  releaseReservations(paymentIntentId: string): Promise<void>
  confirmPaidOrder(paymentIntentId: string): Promise<{ orderGroup: OrderGroupRow; orders: OrderRow[] }>
  getOrderGroupByPaymentIntent(paymentIntentId: string): Promise<OrderGroupRow | null>
  getOrderGroup(id: string): Promise<(OrderGroupRow & { createdAt?: Date }) | null>
  listOrderGroupsByBuyerEmail(
    email: string,
  ): Promise<Array<OrderGroupRow & { createdAt?: Date }>>
  listOrdersForGroup(orderGroupId: string): Promise<OrderRow[]>
  listOrderItems(orderId: string): Promise<OrderItemRow[]>
  getOrder(orderId: string): Promise<OrderRow | null>
  getLatestPaymentIntentByCartId(cartId: string): Promise<PaymentIntentRow | null>
  /** Non-terminal momo/card intents created before `cutoff` — inputs for the expiry job. */
  listStalePendingIntents(cutoff: Date): Promise<PaymentIntentRow[]>
  listOrdersForSeller(sellerId: string): Promise<OrderRow[]>
  listRecentOrderGroups(limit?: number): Promise<Array<OrderGroupRow & { createdAt?: Date }>>
  platformOrderStats(): Promise<PlatformOrderStats>
  /** Per-seller order counts + subtotal GMV (admin lists). */
  orderTotalsBySeller(): Promise<Map<string, { orders: number; gmvPesewas: bigint }>>
  updateOrderStatus(
    orderId: string,
    sellerId: string,
    status: OrderFulfillmentStatus,
  ): Promise<OrderRow | null>
  listDeliveredUnpaidOrders(sellerId: string): Promise<OrderRow[]>
  createPayout(input: {
    sellerId: string
    commissionBps: number
    paystackTransferCode: string
    paystackReference: string
  }): Promise<PayoutRow>
  getPayout(id: string): Promise<PayoutRow | null>
  /** Recent payouts for the admin ledger (newest first). */
  listRecentPayouts(limit?: number): Promise<(PayoutRow & { createdAt: Date | null })[]>
  /**
   * SMS outbox. Idempotency key (`${orderId}:${status}`) is unique:
   * double-enqueues are no-ops so retries never text twice.
   */
  enqueueNotification(input: { key: string; recipient: string; body: string }): Promise<{ inserted: boolean }>
  claimPendingNotifications(limit?: number, maxAttempts?: number): Promise<NotificationRow[]>
  markNotificationSent(id: string): Promise<void>
  markNotificationFailed(id: string, error: string): Promise<void>
}

export type NotificationRow = {
  id: string
  key: string
  channel: string
  recipient: string
  body: string
  status: "pending" | "sent" | "failed"
  attempts: number
  lastError: string | null
  createdAt: Date
  sentAt: Date | null
}

export class InMemoryCheckoutRepository implements CheckoutRepository {
  private carts = new Map<string, CartRow>()
  private items = new Map<string, CartItemRow[]>()
  private intents = new Map<string, PaymentIntentRow>()
  private reservations = new Map<string, StockReservationRow[]>()
  private orderGroups = new Map<string, OrderGroupRow & { createdAt: Date }>()
  private orders = new Map<string, OrderRow[]>()
  private orderItems = new Map<string, OrderItemRow[]>()
  private orderIndex = new Map<string, OrderRow>()
  private payouts = new Map<string, PayoutRow>()

  constructor(private readonly catalog: CatalogSnapshot) {}

  async createCart(): Promise<CartRow> {
    const cart: CartRow = { id: crypto.randomUUID(), currency: "ghs", buyerEmail: null }
    this.carts.set(cart.id, cart)
    this.items.set(cart.id, [])
    return cart
  }

  async getCart(cartId: string) {
    return this.carts.get(cartId) ?? null
  }

  async getOfferView(offerId: string): Promise<CheckoutOfferView | null> {
    const offer = this.catalog.offers.find((o) => o.id === offerId)
    if (!offer) return null
    const product = this.catalog.products.find((p) => p.id === offer.productId)
    const seller = this.catalog.sellers.find((s) => s.id === offer.sellerId)
    if (!product || !seller) return null
    return {
      offer,
      productStatus: product.status,
      sellerStatus: seller.status,
      deliveryFeePesewas: seller.deliveryFeePesewas,
      productTitle: product.title,
      sellerName: seller.name,
      sellerHandle: seller.handle,
    }
  }

  async getOfferViews(offerIds: string[]): Promise<Map<string, CheckoutOfferView>> {
    const out = new Map<string, CheckoutOfferView>()
    for (const id of offerIds) {
      const view = await this.getOfferView(id)
      if (view) out.set(id, view)
    }
    return out
  }

  async addCartItem(cartId: string, offerId: string, qty: number): Promise<CartItemRow> {
    if (!(await this.getCart(cartId))) throw new Error("cart not found")
    if (qty <= 0) throw new Error("invalid qty")
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
    const list = this.items.get(cartId)!
    const existing = list.find((i) => i.offerId === offerId)
    if (existing) {
      existing.qty += qty
      return existing
    }
    const row: CartItemRow = {
      id: crypto.randomUUID(),
      cartId,
      offerId,
      sellerId: view.offer.sellerId,
      qty,
    }
    list.push(row)
    return row
  }

  async setCartItemQty(cartId: string, itemId: string, qty: number): Promise<CartItemRow | null> {
    const list = this.items.get(cartId)
    if (!list) return null
    const idx = list.findIndex((i) => i.id === itemId)
    if (idx < 0) return null
    if (qty <= 0) {
      list.splice(idx, 1)
      return null
    }
    const row = list[idx]!
    row.qty = qty
    return row
  }

  async listCartItems(cartId: string) {
    return [...(this.items.get(cartId) ?? [])]
  }

  async quote(cartId: string): Promise<CartQuote> {
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
    this.intents.set(input.id, { ...input, createdAt: new Date() })
    return { ...input, createdAt: new Date() }
  }

  async getPaymentIntent(id: string) {
    const row = this.intents.get(id)
    return row ? { ...row } : null
  }

  async getPaymentIntentByReference(ref: string) {
    for (const row of this.intents.values()) {
      if (row.paystackReference === ref) return { ...row }
    }
    return null
  }

  async updatePaymentIntentStatus(id: string, status: PaymentIntentStatus) {
    const row = this.intents.get(id)
    if (!row) throw new Error("payment intent not found")
    assertPaymentTransition(row.status, status)
    row.status = status
    return { ...row }
  }

  async reserveStock(paymentIntentId: string, lines: Array<{ offerId: string; qty: number }>) {
    const rows: StockReservationRow[] = []
    for (const line of lines) {
      const offer = this.catalog.offers.find((o) => o.id === line.offerId)
      if (!offer) throw new Error(`offer not found: ${line.offerId}`)
      const available = offer.onHand - offer.reserved
      if (available < line.qty) throw new Error(`insufficient stock for ${line.offerId}`)
      offer.reserved += line.qty
      rows.push({
        id: crypto.randomUUID(),
        paymentIntentId,
        offerId: line.offerId,
        qty: line.qty,
      })
    }
    this.reservations.set(paymentIntentId, rows)
  }

  async releaseReservations(paymentIntentId: string) {
    const rows = this.reservations.get(paymentIntentId) ?? []
    for (const row of rows) {
      const offer = this.catalog.offers.find((o) => o.id === row.offerId)
      if (offer) offer.reserved = Math.max(0, offer.reserved - row.qty)
    }
    this.reservations.delete(paymentIntentId)
  }

  async getOrderGroupByPaymentIntent(paymentIntentId: string) {
    for (const g of this.orderGroups.values()) {
      if (g.paymentIntentId === paymentIntentId) {
        const { createdAt: _c, ...row } = g
        return row
      }
    }
    return null
  }

  async getOrderGroup(id: string) {
    const g = this.orderGroups.get(id)
    if (!g) return null
    return { ...g }
  }

  async listOrderGroupsByBuyerEmail(email: string) {
    const normalized = email.trim().toLowerCase()
    return [...this.orderGroups.values()]
      .filter((g) => g.buyerEmail.toLowerCase() === normalized)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((g) => ({ ...g }))
  }

  async listOrdersForGroup(orderGroupId: string) {
    return [...(this.orders.get(orderGroupId) ?? [])]
  }

  async listOrderItems(orderId: string) {
    return [...(this.orderItems.get(orderId) ?? [])].map((i) => ({ ...i }))
  }

  async getLatestPaymentIntentByCartId(cartId: string) {
    let latest: PaymentIntentRow | null = null
    for (const intent of this.intents.values()) {
      if (intent.cartId !== cartId) continue
      if (!latest) {
        latest = { ...intent }
        continue
      }
      // Map insertion order is creation order; prefer the last matching intent.
      latest = { ...intent }
    }
    return latest
  }

  async listStalePendingIntents(cutoff: Date): Promise<PaymentIntentRow[]> {
    const stale: PaymentIntentRow[] = []
    for (const intent of this.intents.values()) {
      if (intent.method === "cod") continue
      if (intent.status !== "pending" && intent.status !== "initiated") continue
      const createdAt = intent.createdAt ?? new Date(0)
      if (createdAt.getTime() < cutoff.getTime()) stale.push({ ...intent })
    }
    return stale
  }

  async confirmPaidOrder(paymentIntentId: string) {
    const existing = await this.getOrderGroupByPaymentIntent(paymentIntentId)
    if (existing) {
      return { orderGroup: existing, orders: await this.listOrdersForGroup(existing.id) }
    }

    const intent = this.intents.get(paymentIntentId)
    if (!intent) throw new Error("payment intent not found")

    const quote = await this.quote(intent.cartId)
    if (quote.totalPesewas !== intent.amountPesewas) {
      throw new Error("quote total mismatch")
    }

    const orderGroup: OrderGroupRow & { createdAt: Date } = {
      id: crypto.randomUUID(),
      paymentIntentId,
      buyerEmail: intent.buyerEmail,
      totalPesewas: intent.amountPesewas,
      currency: intent.currency,
      createdAt: new Date(),
    }
    this.orderGroups.set(orderGroup.id, orderGroup)

    const createdOrders: OrderRow[] = []
    for (const seller of quote.sellers) {
      const order: OrderRow = {
        id: crypto.randomUUID(),
        orderGroupId: orderGroup.id,
        sellerId: seller.sellerId,
        subtotalPesewas: seller.subtotalPesewas,
        deliveryFeePesewas: seller.deliveryFeePesewas,
        status: "placed",
        payoutId: null,
      }
      createdOrders.push(order)
      this.orderIndex.set(order.id, order)
      const items: OrderItemRow[] = []
      for (const line of seller.lines) {
        const view = await this.getOfferView(line.offerId)
        if (!view) throw new Error("offer missing at confirm")
        items.push({
          id: crypto.randomUUID(),
          orderId: order.id,
          offerId: line.offerId,
          sellerId: line.sellerId,
          productId: view.offer.productId,
          title: view.productTitle,
          qty: line.qty,
          unitPricePesewas: line.unitPricePesewas,
        })
        // commit stock
        view.offer.onHand -= line.qty
        view.offer.reserved = Math.max(0, view.offer.reserved - line.qty)
      }
      this.orderItems.set(order.id, items)
    }
    this.orders.set(orderGroup.id, createdOrders)
    this.reservations.delete(paymentIntentId)

    // MoMo: pending → succeeded → completed; COD: initiated → completed
    if (intent.status === "pending") {
      assertPaymentTransition(intent.status, "succeeded")
      intent.status = "succeeded"
    }
    assertPaymentTransition(intent.status, "completed")
    intent.status = "completed"

    return { orderGroup, orders: createdOrders }
  }

  async getOrder(orderId: string) {
    const row = this.orderIndex.get(orderId)
    return row ? { ...row } : null
  }

  async listOrdersForSeller(sellerId: string) {
    return [...this.orderIndex.values()]
      .filter((o) => o.sellerId === sellerId)
      .map((o) => ({ ...o }))
  }

  async listRecentOrderGroups(limit = 50) {
    return [...this.orderGroups.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, Math.max(1, Math.min(limit, 200)))
      .map((g) => ({ ...g }))
  }

  async orderTotalsBySeller(): Promise<Map<string, { orders: number; gmvPesewas: bigint }>> {
    const totals = new Map<string, { orders: number; gmvPesewas: bigint }>()
    for (const o of this.orderIndex.values()) {
      const slot = totals.get(o.sellerId) ?? { orders: 0, gmvPesewas: 0n }
      slot.orders += 1
      slot.gmvPesewas += typeof o.subtotalPesewas === "bigint" ? o.subtotalPesewas : BigInt(o.subtotalPesewas)
      totals.set(o.sellerId, slot)
    }
    return totals
  }

  async platformOrderStats(): Promise<PlatformOrderStats> {
    const groups = [...this.orderGroups.values()].map((g) => ({
      totalPesewas: g.totalPesewas,
      createdAt: g.createdAt,
    }))
    const byProduct = new Map<string, { title: string; units: number; gmvPesewas: bigint }>()
    for (const items of this.orderItems.values()) {
      for (const item of items) {
        const slot = byProduct.get(item.productId) ?? { title: item.title, units: 0, gmvPesewas: 0n }
        slot.units += item.qty
        const unit = typeof item.unitPricePesewas === "bigint" ? item.unitPricePesewas : BigInt(item.unitPricePesewas)
        slot.gmvPesewas += BigInt(item.qty) * unit
        byProduct.set(item.productId, slot)
      }
    }
    const topItems = [...byProduct]
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => (b.gmvPesewas > a.gmvPesewas ? 1 : b.gmvPesewas < a.gmvPesewas ? -1 : 0))
      .slice(0, 10)
    return { groups, topItems }
  }

  async updateOrderStatus(
    orderId: string,
    sellerId: string,
    status: OrderFulfillmentStatus,
  ) {
    const row = this.orderIndex.get(orderId)
    if (!row || row.sellerId !== sellerId) return null
    assertFulfillmentTransition(row.status, status)
    row.status = status
    return { ...row }
  }

  async listDeliveredUnpaidOrders(sellerId: string) {
    return [...this.orderIndex.values()]
      .filter((o) => o.sellerId === sellerId && o.status === "delivered" && !o.payoutId)
      .map((o) => ({ ...o }))
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
    const payout: PayoutRow = {
      id: crypto.randomUUID(),
      sellerId: input.sellerId,
      status: "paid",
      grossPesewas: batch.grossPesewas,
      commissionPesewas: batch.commissionPesewas,
      netPesewas: batch.netPesewas,
      commissionBps: input.commissionBps,
      paystackTransferCode: input.paystackTransferCode,
      paystackReference: input.paystackReference,
    }
    this.payouts.set(payout.id, payout)
    for (const order of unpaid) {
      const live = this.orderIndex.get(order.id)
      if (live) live.payoutId = payout.id
    }
    return { ...payout }
  }

  async getPayout(id: string) {
    const row = this.payouts.get(id)
    return row ? { ...row } : null
  }

  async listRecentPayouts(limit = 50) {
    return [...this.payouts.values()]
      .reverse()
      .slice(0, Math.max(1, Math.min(limit, 200)))
      .map((row) => ({ ...row, createdAt: null as Date | null }))
  }

  private notifications = new Map<string, NotificationRow>()

  async enqueueNotification(input: { key: string; recipient: string; body: string }) {
    if (this.notifications.has(input.key)) return { inserted: false }
    this.notifications.set(input.key, {
      id: crypto.randomUUID(),
      key: input.key,
      channel: "sms",
      recipient: input.recipient,
      body: input.body,
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    })
    return { inserted: true }
  }

  async claimPendingNotifications(limit = 50, maxAttempts = 5) {
    const take = Math.max(1, Math.min(limit, 200))
    const claimed: NotificationRow[] = []
    for (const row of [...this.notifications.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )) {
      if (claimed.length >= take) break
      if (row.status === "pending" || (row.status === "failed" && row.attempts < maxAttempts)) {
        row.attempts += 1
        claimed.push(row)
      }
    }
    return claimed
  }

  async markNotificationSent(id: string) {
    for (const row of this.notifications.values()) {
      if (row.id === id) {
        row.status = "sent"
        row.lastError = null
        row.sentAt = new Date()
        return
      }
    }
  }

  async markNotificationFailed(id: string, error: string) {
    for (const row of this.notifications.values()) {
      if (row.id === id) {
        row.status = "failed"
        row.lastError = error.slice(0, 500)
        return
      }
    }
  }
}
