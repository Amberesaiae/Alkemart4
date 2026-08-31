import {
  assertPaymentTransition,
  isSellable,
  quoteCart,
  type CartQuote,
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

export type OrderRow = {
  id: string
  orderGroupId: string
  sellerId: string
  subtotalPesewas: bigint
  deliveryFeePesewas: bigint
  status: string
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
}

export interface CheckoutRepository {
  createCart(): Promise<CartRow>
  getCart(cartId: string): Promise<CartRow | null>
  addCartItem(cartId: string, offerId: string, qty: number): Promise<CartItemRow>
  listCartItems(cartId: string): Promise<CartItemRow[]>
  getOfferView(offerId: string): Promise<CheckoutOfferView | null>
  quote(cartId: string): Promise<CartQuote>
  createPaymentIntent(input: Omit<PaymentIntentRow, "status"> & { status: PaymentIntentStatus }): Promise<PaymentIntentRow>
  getPaymentIntent(id: string): Promise<PaymentIntentRow | null>
  getPaymentIntentByReference(ref: string): Promise<PaymentIntentRow | null>
  updatePaymentIntentStatus(id: string, status: PaymentIntentStatus): Promise<PaymentIntentRow>
  reserveStock(paymentIntentId: string, lines: Array<{ offerId: string; qty: number }>): Promise<void>
  releaseReservations(paymentIntentId: string): Promise<void>
  confirmPaidOrder(paymentIntentId: string): Promise<{ orderGroup: OrderGroupRow; orders: OrderRow[] }>
  getOrderGroupByPaymentIntent(paymentIntentId: string): Promise<OrderGroupRow | null>
  listOrdersForGroup(orderGroupId: string): Promise<OrderRow[]>
}

export class InMemoryCheckoutRepository implements CheckoutRepository {
  private carts = new Map<string, CartRow>()
  private items = new Map<string, CartItemRow[]>()
  private intents = new Map<string, PaymentIntentRow>()
  private reservations = new Map<string, StockReservationRow[]>()
  private orderGroups = new Map<string, OrderGroupRow>()
  private orders = new Map<string, OrderRow[]>()
  private orderItems = new Map<string, OrderItemRow[]>()

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
    }
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
    this.intents.set(input.id, { ...input })
    return { ...input }
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
      if (g.paymentIntentId === paymentIntentId) return { ...g }
    }
    return null
  }

  async listOrdersForGroup(orderGroupId: string) {
    return [...(this.orders.get(orderGroupId) ?? [])]
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

    const orderGroup: OrderGroupRow = {
      id: crypto.randomUUID(),
      paymentIntentId,
      buyerEmail: intent.buyerEmail,
      totalPesewas: intent.amountPesewas,
      currency: intent.currency,
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
      }
      createdOrders.push(order)
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
}
