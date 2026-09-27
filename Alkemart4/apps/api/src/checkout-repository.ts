import {
  assertFulfillmentTransition,
  assertPaymentTransition,
  computePayoutBatch,
  isSellable,
  quoteCart,
  type CartQuote,
  type OrderFulfillmentStatus,
  type PaymentIntentStatus,
  freezePromise,
  canMovePayout,
  type DeliveryConfirmedBy,
  type DeliveryPromise,
  type DeliveryZone,
  type OrderFact,
  type PayoutFact,
  type FulfillmentMethod,
  type PayoutStatus,
  type ReturnActor,
  type ReturnOutcome,
  type ReturnReason,
  type ReturnStatus,
  type ReturnWish,
  applyRecoveries,
  newHandoverCode,
  payableSubtotal,
} from "@alkemart/domain"
import type { CatalogOffer, CatalogSnapshot } from "./demo-seed"
import { marketCurrency } from "@alkemart/shared/markets"
import { InMemoryLedgerStore, payoutEntry, payoutReversalEntry, refundEntries, saleEntries, type LedgerStore } from "./ledger"

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
  /** Buyer's pinned delivery spot, when they dropped one. */
  latitude?: number
  longitude?: number
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
  /** Per seller: delivery or pickup and the fee quoted at checkout (0042). */
  fulfillment?: IntentFulfillment | null
  /** Per offer: accepted deal price used at checkout (0046). */
  deals?: IntentDeals | null
  createdAt?: Date
}

export type OrderFactFilter = {
  sellerId?: string
  placedFrom?: Date
  placedTo?: Date
  deliveredFrom?: Date
  deliveredTo?: Date
}

export type FulfillmentChoice = { method: FulfillmentMethod; zone: DeliveryZone | null; feePesewas: string }
export type IntentFulfillment = Record<string, FulfillmentChoice>
/** offerId → the accepted deal price (per unit) and the exact quantity it covers. */
export type IntentDeals = Record<string, { dealId: string; unitPricePesewas: string; qty: number }>

/** Deal prices from the intent, for lines whose quantity matches the deal exactly. */
export function withDeals<T extends { offerId: string; qty: number; unitPricePesewas: bigint }>(lines: T[], deals?: IntentDeals | null): T[] {
  if (!deals) return lines
  return lines.map((l) => {
    const d = deals[l.offerId]
    return d && d.qty === l.qty ? { ...l, unitPricePesewas: BigInt(d.unitPricePesewas) } : l
  })
}

/** Delivery fee per seller as frozen on the intent; undefined = seller defaults. */
/** Order columns from the buyer's choice; every order gets a handover code. */
export function orderFulfillment(choice: FulfillmentChoice | undefined) {
  return {
    fulfillmentMethod: choice?.method ?? ("delivery" as const),
    deliveryZone: choice?.method === "pickup" ? null : (choice?.zone ?? null),
    handoverCode: newHandoverCode(),
    handoverFailures: 0,
  }
}

export function feesFromFulfillment(f: IntentFulfillment | null | undefined): Map<string, bigint> | undefined {
  if (!f) return undefined
  return new Map(Object.entries(f).map(([sellerId, c]) => [sellerId, BigInt(c.feePesewas)]))
}

export function withFees<T extends { sellerId: string; deliveryFeePesewas: bigint }>(lines: T[], fees?: Map<string, bigint>): T[] {
  return fees ? lines.map((l) => (fees.has(l.sellerId) ? { ...l, deliveryFeePesewas: fees.get(l.sellerId)! } : l)) : lines
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
  /** Frozen at checkout (0036); null on legacy orders. */
  dispatchBy?: Date | null
  deliverEarliest?: Date | null
  deliverLatest?: Date | null
  /** Delivery or pickup (0042); legacy orders are delivery. */
  fulfillmentMethod?: FulfillmentMethod
  deliveryZone?: DeliveryZone | null
  /** Buyer's handover code. Never send to the seller. */
  handoverCode?: string | null
  handoverFailures?: number
  deliveryConfirmedBy?: DeliveryConfirmedBy | null
  /** Online payout released from here (report window); null/absent = payable. */
  payoutReleaseAt?: Date | null
  /** Items refunded to the buyer so far (0044); payouts pay only what's left. */
  refundedPesewas?: bigint
}

export type OrderActor = "buyer" | "seller" | "admin" | "system"

/** One step of an order's timeline (0036, append-only). */
export type OrderEventRow = {
  orderId: string
  status: OrderFulfillmentStatus
  actor: OrderActor
  at: Date
  note: string | null
}

/**
 * One seller order with what the seller's order list needs: when it was
 * placed, what's in it, where it goes (area only — no street or phone on a
 * list) and how the buyer paid. Newest first.
 */
export type SellerOrderSummary = OrderRow & {
  placedAt: Date | null
  items: { productId: string; title: string; qty: number }[]
  shipTo: { city: string | null; region: string | null } | null
  paymentMethod: string | null
}

export type PayoutRow = {
  id: string
  sellerId: string
  status: PayoutStatus
  grossPesewas: bigint
  commissionPesewas: bigint
  netPesewas: bigint
  commissionBps: number
  paystackTransferCode: string | null
  paystackReference: string | null
  failureReason?: string | null
  paidAt?: Date | null
  createdBy?: string | null
  /** Refunds on already-paid orders taken back from this payout (0044). */
  recoveredPesewas?: bigint
}

/** One step in a payout's life, shown to the seller and admins. */
export type PayoutEventRow = {
  id: string
  payoutId: string
  status: "created" | "sent" | "paid" | "failed" | "reversed" | "checked" | "retried" | string
  actor: string
  detail: string | null
  createdAt: Date
}

export type PayoutLineRow = { orderId: string; grossPesewas: bigint; commissionPesewas: bigint; netPesewas: bigint }

/** A signed Paystack webhook we received, and what we did with it. */
export type PaystackEventRow = {
  id: string
  event: string
  reference: string | null
  amountMinor: bigint | null
  currency: string | null
  status: string | null
  outcome: string
  detail: string | null
  receivedAt: Date
}

/** Why a payout can't be reserved right now — shown to the admin as-is. */
export class PayoutBlockedError extends Error {
  constructor(
    readonly code: "seller_hold" | "nothing_payable" | "mixed_currency",
    message: string,
  ) {
    super(message)
    this.name = "PayoutBlockedError"
  }
}

export type PayoutHoldRow = {
  id: string
  sellerId: string
  orderId: string | null
  amountPesewas: bigint | null
  reason: string
  status: "held" | "released"
  createdBy: string | null
  releasedBy: string | null
  releasedAt: Date | null
  createdAt: Date
}

export type ReturnTimelineEntry = { at: string; by: ReturnActor; status: ReturnStatus; note: string }

/** A return or dispute on one seller order (0044). */
export type ReturnCaseRow = {
  id: string
  orderId: string
  sellerId: string
  buyerEmail: string
  reason: ReturnReason
  wish: ReturnWish
  note: string
  status: ReturnStatus
  /** Who must act by when (see returnWaitingOn); null when nobody is on a clock. */
  respondBy: Date | null
  declineReason: string | null
  outcome: ReturnOutcome | null
  refundPesewas: bigint
  refundVia: "provider" | "seller" | null
  /** provider: pending → paid | failed; seller (pay on delivery): owed → paid. */
  refundStatus: "pending" | "paid" | "failed" | "owed" | null
  refundRef: string | null
  /** Seller's share of a refund on an order that was already paid out. */
  sellerRecoveryPesewas: bigint
  recoveredPayoutId: string | null
  adminNote: string | null
  timeline: ReturnTimelineEntry[]
  createdAt: Date
  updatedAt: Date
  closedAt: Date | null
}

export type ReturnCaseFilter = {
  sellerId?: string
  orderIds?: string[]
  buyerEmail?: string
  statuses?: ReturnStatus[]
  /** Open cases whose deadline has passed at this moment. */
  dueAt?: Date
  /** Provider refunds still waiting on the provider's answer. */
  refundPending?: boolean
}

/** One step applied to a case (see nextReturnStep). Money only when closing with a refund. */
export type ReturnCaseChange = {
  status: ReturnStatus
  respondBy: Date | null
  declineReason?: string | null
  outcome?: ReturnOutcome | null
  adminNote?: string | null
  entry: { by: ReturnActor; note: string }
  refund?: {
    minor: bigint
    via: "provider" | "seller"
    status: "pending" | "owed" | "failed" | "paid"
    ref?: string | null
    /** Non-zero when the order was already paid out: taken from the next payout. */
    sellerRecoveryMinor: bigint
    platformMinor: bigint
    currency: string
    intentId: string | null
  }
}

/** A case is already open on this order. */
export class ReturnCaseOpenError extends Error {
  constructor(readonly existingId: string) {
    super("There's already an open return on this order.")
    this.name = "ReturnCaseOpenError"
  }
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
  /** `fees` overrides the seller's default delivery fee (zone/pickup choice). */
  quote(cartId: string, fees?: Map<string, bigint>, deals?: IntentDeals | null): Promise<CartQuote>
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
  listSellerOrderSummaries(sellerId: string): Promise<SellerOrderSummary[]>
  listRecentOrderGroups(limit?: number): Promise<Array<OrderGroupRow & { createdAt?: Date }>>
  platformOrderStats(): Promise<PlatformOrderStats>
  /** Per-seller order counts + subtotal GMV (admin lists). */
  orderTotalsBySeller(): Promise<Map<string, { orders: number; gmvPesewas: bigint }>>
  /** Delivered units per product since a cutoff (trending shelf). */
  productUnitsSince(since: Date): Promise<Map<string, number>>
  /**
   * Phase 7B — the phone the buyer themselves put on their latest order.
   * Alert sends resolve contacts here, never from request bodies.
   */
  latestBuyerPhone(buyerEmail: string): Promise<string | null>
  /**
   * Transition + timeline event in one unit of work. Conditional on the
   * status read, so two concurrent taps can't both apply (the loser throws
   * InvalidFulfillmentTransitionError → 409).
   */
  updateOrderStatus(
    orderId: string,
    sellerId: string,
    status: OrderFulfillmentStatus,
    actor?: { kind: OrderActor; id?: string | null; note?: string | null },
  ): Promise<OrderRow | null>
  /** Timeline events for these orders, oldest first. */
  listOrderEvents(orderIds: string[]): Promise<OrderEventRow[]>
  /**
   * Flattened orders for reports. `placed*` filters by when the order was
   * placed; `delivered*` by when it was delivered (statements).
   */
  listOrderFacts(filter: OrderFactFilter): Promise<OrderFact[]>
  /** Payouts for reports; `paid*` filters by when Paystack paid them. */
  listPayoutFacts(filter: { sellerId?: string; paidFrom?: Date; paidTo?: Date }): Promise<PayoutFact[]>
  /** Count a wrong handover code; returns the new total. */
  recordHandoverFailure(orderId: string): Promise<number>
  /** Who confirmed the delivery, and when its online payout may be released. */
  recordDeliveryConfirmation(orderId: string, by: DeliveryConfirmedBy, releaseAt: Date): Promise<void>
  /**
   * Delivered, not yet paid out, and paid ONLINE. Pay-on-delivery orders are
   * never payable: the seller's rider already holds the buyer's cash, and the
   * seller owes the commission instead (COD settlement rule, 2026-09-25).
   */
  listDeliveredUnpaidOrders(sellerId: string): Promise<OrderRow[]>
  /**
   * Step 1 of a payout: lock the exact payable orders (delivered, online,
   * not held, not already in a payout) into a `pending` payout with its
   * Paystack reference — before any money moves. Throws PayoutBlockedError.
   */
  reservePayout(input: { sellerId: string; commissionBps: number; reference: string; createdBy: string }): Promise<PayoutRow>
  /** Step 2: Paystack accepted the transfer request (pending → processing). */
  markPayoutSent(payoutId: string, transferCode: string | null, actor: string): Promise<PayoutRow | null>
  /**
   * Step 3: Paystack's final answer. Idempotent; illegal moves are no-ops.
   * paid → ledger payout row; failed/reversed → orders become payable again
   * (reversed also writes a ledger adjustment).
   */
  settlePayout(
    payoutId: string,
    to: "paid" | "failed" | "reversed",
    opts: { actor: string; reason?: string | null; transferCode?: string | null },
  ): Promise<{ payout: PayoutRow | null; changed: boolean }>
  getPayoutByReference(reference: string): Promise<PayoutRow | null>
  listPayoutLines(payoutId: string): Promise<PayoutLineRow[]>
  listPayoutEvents(payoutIds: string[]): Promise<PayoutEventRow[]>
  addPayoutEvent(payoutId: string, status: PayoutEventRow["status"], actor: string, detail?: string | null): Promise<void>
  recordPaystackEvent(row: Omit<PaystackEventRow, "receivedAt">): Promise<void>
  listPaystackEvents(limit?: number): Promise<PaystackEventRow[]>
  /** Legacy/test helper: reserve + settle paid in one go. */
  createPayout(input: {
    sellerId: string
    commissionBps: number
    paystackTransferCode: string
    paystackReference: string
  }): Promise<PayoutRow>
  getPayout(id: string): Promise<PayoutRow | null>
  /** Recent payouts for the admin ledger (newest first). */
  listRecentPayouts(limit?: number): Promise<(PayoutRow & { createdAt: Date | null })[]>
  /** Payout batches for one seller (newest first). */
  listPayoutsForSeller(sellerId: string): Promise<(PayoutRow & { createdAt: Date | null })[]>
  /** Paid lines with batch status for one seller's statement. */
  listPaidLinesForSeller(
    sellerId: string,
  ): Promise<
    {
      payoutId: string
      orderId: string
      grossPesewas: bigint
      commissionPesewas: bigint
      netPesewas: bigint
      payoutStatus: PayoutRow["status"]
      paidAt: Date | null
    }[]
  >
  // ── Phase 4D: payout holds (admin-gated, reason-required) ──
  listPayoutHolds(sellerId: string, activeOnly?: boolean): Promise<PayoutHoldRow[]>
  createPayoutHold(input: {
    sellerId: string
    orderId?: string | null
    amountPesewas?: bigint | null
    reason: string
    createdBy: string
  }): Promise<PayoutHoldRow>
  releasePayoutHold(id: string, releasedBy: string): Promise<PayoutHoldRow | null>
  // ── Returns and disputes (0044) ──
  /**
   * Open a case. Holds the order's payout (if not paid out yet) until it
   * closes. Throws ReturnCaseOpenError when one is already open.
   */
  createReturnCase(input: {
    orderId: string
    sellerId: string
    buyerEmail: string
    reason: ReturnReason
    wish: ReturnWish
    note: string
    respondBy: Date
  }): Promise<ReturnCaseRow>
  getReturnCase(id: string): Promise<ReturnCaseRow | null>
  /** Newest first. */
  listReturnCases(filter: ReturnCaseFilter): Promise<ReturnCaseRow[]>
  /**
   * Compare-and-swap one step: applies only if the case is still `from`
   * (null = someone moved it first). Closing releases the order's buyer
   * holds; a refund adds to orders.refunded_pesewas and the ledger, in the
   * same transaction.
   */
  advanceReturnCase(id: string, from: ReturnStatus, change: ReturnCaseChange): Promise<ReturnCaseRow | null>
  /** Record what happened to the money after the case closed (provider result, seller paid back). */
  setReturnRefund(id: string, patch: { status: "pending" | "paid" | "failed" | "owed"; ref?: string | null; entry?: { by: ReturnActor; note: string } }): Promise<ReturnCaseRow | null>
  /**
   * SMS outbox. Idempotency key (`${orderId}:${status}`) is unique:
   * double-enqueues are no-ops so retries never text twice.
   */
  enqueueNotification(input: {
    key: string
    recipient: string
    body: string
    channel?: string
    category?: "transactional" | "promotional" | "operational"
  }): Promise<{ inserted: boolean }>
  /** Sends to one recipient+channel since a cutoff (frequency caps). */
  countRecentSends(recipient: string, channel: string, since: Date): Promise<number>
  claimPendingNotifications(limit?: number, maxAttempts?: number): Promise<NotificationRow[]>
  markNotificationSent(id: string): Promise<void>
  markNotificationFailed(id: string, error: string): Promise<void>
  /** True when any order item references the product (money trail guard). */
  productHasOrders(productId: string): Promise<boolean>
  // ── Phase 7A: preference center ──
  listNotificationPreferences(
    ownerType: "buyer" | "seller",
    ownerId: string,
  ): Promise<NotificationPreferenceDto[]>
  setNotificationPreference(input: {
    ownerType: "buyer" | "seller"
    ownerId: string
    channel: string
    category: "transactional" | "promotional" | "operational"
    topic?: string | null
    optedIn: boolean
    frequencyCap?: number | null
  }): Promise<NotificationPreferenceDto>
  // ── Phase 7B: stock/price alert subscriptions (one-shot) ──
  listStockSubscriptions(filters: {
    offerId?: string
    buyerEmail?: string
  }): Promise<StockSubscriptionDto[]>
  createStockSubscription(input: {
    buyerEmail: string
    productId: string
    offerId?: string | null
    kind: "back_in_stock" | "price_drop"
    belowPesewas?: bigint | null
    channel?: string
  }): Promise<StockSubscriptionDto>
  deleteStockSubscription(id: string, buyerEmail: string): Promise<boolean>
  // ── Phase 7D: experiment registry ──
  listExperiments(status?: ExperimentDto["status"]): Promise<ExperimentDto[]>
  getExperiment(id: string): Promise<ExperimentDto | null>
  createExperiment(input: {
    key: string
    name: string
    description?: string | null
    controlPct?: number
    primaryMetric?: string | null
    guardrails?: unknown
    createdBy: string
  }): Promise<ExperimentDto>
  updateExperiment(id: string, patch: {
    name?: string
    description?: string | null
    controlPct?: number
    primaryMetric?: string | null
    guardrails?: unknown
    status?: ExperimentDto["status"]
  }): Promise<ExperimentDto | null>
  /**
   * Deterministic bucket for a unit; logs exposure once (replays answer
   * identically). Non-running experiments always answer control.
   */
  assignExperiment(
    experimentKey: string,
    unitId: string,
  ): Promise<{ experimentId: string; bucket: "control" | "exposed" } | null>
  reportExperiment(id: string): Promise<{ control: number; exposed: number } | null>
  /**
   * Verified-purchase reviews. One row per order (unique order_id);
   * duplicate writes return null so routes answer 409.
   */
  createReview(input: {
    orderId: string
    productId: string
    sellerId: string
    buyerEmail: string
    rating: number
    title: string | null
    body: string
  }): Promise<ReviewRow | null>
  getReview(id: string): Promise<ReviewRow | null>
  listReviewsBySeller(sellerId: string): Promise<ReviewRow[]>
  /**
   * Published-review count and mean per seller, in one pass.
   *
   * The stores index shows a rating on every card, so doing this per seller
   * would be one query per shop on a page that lists all of them.
   */
  reviewTotalsBySeller(): Promise<Map<string, { count: number; avg: number }>>
  /**
   * Published-review count and mean per product, in one pass.
   *
   * Every catalogue card carries a rating, so this must be one query for a
   * whole page of cards — the alternative is one query per card on the
   * storefront's busiest surface.
   */
  reviewTotalsByProduct(): Promise<Map<string, { count: number; avg: number }>>
  /**
   * Units sold per product, optionally limited to orders since a date.
   *
   * Powers the "Most ordered" and "Trending" shelves. Real order data or
   * nothing: a popularity shelf with no orders behind it renders empty
   * rather than falling back to an arbitrary slice of the catalogue.
   */
  productOrderCounts(since?: Date): Promise<Map<string, number>>
  listPublishedReviewsByProduct(productId: string): Promise<ReviewRow[]>
  listPendingReviews(): Promise<ReviewRow[]>
  updateReviewStatus(id: string, status: "published" | "hidden"): Promise<ReviewRow | null>
  respondToReview(id: string, sellerId: string, message: string): Promise<ReviewRow | null>
}

export type ReviewRow = {
  id: string
  orderId: string
  productId: string
  sellerId: string
  buyerEmail: string
  rating: number
  title: string | null
  body: string
  status: "pending" | "published" | "hidden"
  vendorResponse: string | null
  respondedAt: Date | null
  createdAt: Date
}

export type NotificationRow = {
  id: string
  key: string
  channel: string
  recipient: string
  body: string
  /** Phase 7A send classification. */
  category: string
  status: "pending" | "sent" | "failed"
  attempts: number
  lastError: string | null
  createdAt: Date
  sentAt: Date | null
}

export type NotificationPreferenceDto = {
  id: string
  ownerType: "buyer" | "seller"
  ownerId: string
  channel: string
  category: "transactional" | "promotional" | "operational"
  topic: string | null
  optedIn: boolean
  frequencyCap: number | null
  createdAt: Date
  updatedAt: Date
}

export type StockSubscriptionDto = {
  id: string
  buyerEmail: string
  productId: string
  offerId: string | null
  kind: "back_in_stock" | "price_drop"
  belowPesewas: string | null
  channel: string
  createdAt: Date
}

export type ExperimentDto = {
  id: string
  key: string
  name: string
  description: string | null
  status: "draft" | "running" | "paused" | "ended"
  controlPct: number
  primaryMetric: string | null
  guardrails: unknown
  startedAt: Date | null
  endedAt: Date | null
  createdBy: string | null
  createdAt: Date
}

export class InMemoryCheckoutRepository implements CheckoutRepository {
  private carts = new Map<string, CartRow>()
  private items = new Map<string, CartItemRow[]>()
  private intents = new Map<string, PaymentIntentRow>()
  private reservations = new Map<string, StockReservationRow[]>()
  private orderGroups = new Map<string, OrderGroupRow & { createdAt: Date }>()
  private orders = new Map<string, OrderRow[]>()
  private orderItems = new Map<string, OrderItemRow[]>()
  private events: OrderEventRow[] = []
  private orderIndex = new Map<string, OrderRow>()
  private payouts = new Map<string, PayoutRow>()
  private holds = new Map<string, PayoutHoldRow>()
  private prefs = new Map<string, NotificationPreferenceDto>()
  private subscriptions = new Map<string, StockSubscriptionDto>()
  private experiments = new Map<string, ExperimentDto>()
  private exposures = new Map<string, { experimentId: string; unitId: string; bucket: "control" | "exposed" }>()

  /**
   * Where a seller's delivery promise lives. Postgres reads sellers.metadata
   * (what the seller edits in Shop); set this to do the same in memory.
   * Unset, the catalogue snapshot's `delivery` is used (unit tests).
   */
  promiseFor?: (sellerId: string) => Promise<DeliveryPromise | null>

  constructor(
    private readonly catalog: CatalogSnapshot,
    readonly ledger: LedgerStore = new InMemoryLedgerStore(),
  ) {}

  async createCart(): Promise<CartRow> {
    const cart: CartRow = { id: crypto.randomUUID(), currency: marketCurrency(), buyerEmail: null }
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

  async quote(cartId: string, fees?: Map<string, bigint>, deals?: IntentDeals | null): Promise<CartQuote> {
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
    return quoteCart(withDeals(withFees(lines, fees), deals), this.carts.get(cartId)?.currency ?? marketCurrency())
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

    const quote = await this.quote(intent.cartId, feesFromFulfillment(intent.fulfillment), intent.deals)
    if (quote.totalPesewas !== intent.amountPesewas) {
      throw new Error("quote total mismatch")
    }

    const orderGroup: OrderGroupRow & { createdAt: Date } = {
      id: crypto.randomUUID(),
      paymentIntentId,
      buyerEmail: intent.buyerEmail,
      totalPesewas: intent.amountPesewas,
      currency: intent.currency,
      createdAt: this.now(),
    }
    this.orderGroups.set(orderGroup.id, orderGroup)

    const createdOrders: OrderRow[] = []
    for (const seller of quote.sellers) {
      const promise = freezePromise(
        orderGroup.createdAt,
        this.promiseFor
          ? await this.promiseFor(seller.sellerId)
          : (this.catalog.sellers.find((s) => s.id === seller.sellerId)?.delivery ?? null),
      )
      const order: OrderRow = {
        id: crypto.randomUUID(),
        orderGroupId: orderGroup.id,
        sellerId: seller.sellerId,
        subtotalPesewas: seller.subtotalPesewas,
        deliveryFeePesewas: seller.deliveryFeePesewas,
        status: "placed",
        payoutId: null,
        dispatchBy: promise.dispatchBy,
        deliverEarliest: promise.deliverEarliest,
        deliverLatest: promise.deliverLatest,
        ...orderFulfillment(intent.fulfillment?.[seller.sellerId]),
      }
      this.events.push({ orderId: order.id, status: "placed", actor: "buyer", at: orderGroup.createdAt, note: null })
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

    // Ledger: one sale + one platform_fee row per seller order, same unit of
    // work. Replay converges: early-return above skips confirmed groups, and
    // idempotency keys dedupe any double-append.
    for (const order of createdOrders) {
      const seller = this.catalog.sellers.find((s) => s.id === order.sellerId)
      if (!seller) throw new Error(`seller missing for ledger: ${order.sellerId}`)
      for (const entry of saleEntries({
        orderId: order.id,
        intentId: paymentIntentId,
        sellerId: order.sellerId,
        subtotalMinor: order.subtotalPesewas,
        currency: intent.currency,
        commissionBps: seller.commissionBps,
      })) {
        await this.ledger.append(entry)
      }
    }

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

  async listSellerOrderSummaries(sellerId: string): Promise<SellerOrderSummary[]> {
    const rows = await this.listOrdersForSeller(sellerId)
    return rows
      .map((o) => {
        const group = this.orderGroups.get(o.orderGroupId)
        const intent = group ? this.intents.get(group.paymentIntentId) : undefined
        const addr = intent?.shippingAddress ?? null
        return {
          ...o,
          placedAt: group?.createdAt ?? null,
          items: (this.orderItems.get(o.id) ?? []).map((i) => ({ productId: i.productId, title: i.title, qty: i.qty })),
          shipTo: addr ? { city: addr.city || null, region: addr.province ?? null } : null,
          paymentMethod: intent?.method ?? null,
        }
      })
      .sort((a, b) => (b.placedAt?.getTime() ?? 0) - (a.placedAt?.getTime() ?? 0))
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

  async productUnitsSince(since: Date): Promise<Map<string, number>> {
    const units = new Map<string, number>()
    for (const [orderId, items] of this.orderItems) {
      const order = this.orderIndex.get(orderId)
      if (!order || order.status !== "delivered") continue
      const group = this.orderGroups.get(order.orderGroupId)
      if (!group || group.createdAt < since) continue
      for (const item of items) {
        units.set(item.productId, (units.get(item.productId) ?? 0) + item.qty)
      }
    }
    return units
  }

  async latestBuyerPhone(buyerEmail: string): Promise<string | null> {
    const email = buyerEmail.trim().toLowerCase()
    const intents = [...this.intents.values()]
      .filter((i) => i.buyerEmail.toLowerCase() === email)
      .sort((a, b) => {
        const at = a.createdAt ? +a.createdAt : 0
        const bt = b.createdAt ? +b.createdAt : 0
        return bt - at
      })
    for (const intent of intents) {
      const phone = intent.shippingAddress?.phone
      if (typeof phone === "string" && phone.trim()) return phone.trim()
      if (typeof intent.momoPhone === "string" && intent.momoPhone.trim()) {
        return intent.momoPhone.trim()
      }
    }
    return null
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
    actor?: { kind: OrderActor; id?: string | null; note?: string | null },
  ) {
    const row = this.orderIndex.get(orderId)
    if (!row || row.sellerId !== sellerId) return null
    assertFulfillmentTransition(row.status, status)
    if (row.status === status) return { ...row }
    row.status = status
    this.events.push({ orderId, status, actor: actor?.kind ?? "seller", at: this.now(), note: actor?.note ?? null })
    return { ...row }
  }

  async listOrderEvents(orderIds: string[]) {
    const ids = new Set(orderIds)
    return this.events.filter((e) => ids.has(e.orderId)).map((e) => ({ ...e }))
  }

  async listOrderFacts(filter: OrderFactFilter): Promise<OrderFact[]> {
    const out: OrderFact[] = []
    for (const o of this.orderIndex.values()) {
      if (filter.sellerId && o.sellerId !== filter.sellerId) continue
      const group = this.orderGroups.get(o.orderGroupId)
      if (!group) continue
      const placedAt = group.createdAt
      if (filter.placedFrom && placedAt < filter.placedFrom) continue
      if (filter.placedTo && placedAt >= filter.placedTo) continue
      const deliveredAt = this.events.filter((e) => e.orderId === o.id && e.status === "delivered").map((e) => e.at).sort((a, b) => +a - +b)[0] ?? null
      if (filter.deliveredFrom && (!deliveredAt || deliveredAt < filter.deliveredFrom)) continue
      if (filter.deliveredTo && (!deliveredAt || deliveredAt >= filter.deliveredTo)) continue
      const intent = this.intents.get(group.paymentIntentId)
      const addr = intent?.shippingAddress
      out.push({
        orderId: o.id,
        orderGroupId: o.orderGroupId,
        sellerId: o.sellerId,
        placedAt,
        status: o.status as OrderFact["status"],
        deliveredAt: o.status === "delivered" ? deliveredAt : null,
        subtotalPesewas: o.subtotalPesewas,
        deliveryFeePesewas: o.deliveryFeePesewas,
        paymentMethod: intent?.method ?? null,
        fulfillmentMethod: o.fulfillmentMethod ?? "delivery",
        buyerKey: group.buyerEmail?.trim().toLowerCase() || null,
        region: addr?.province ?? null,
        city: addr?.city ?? null,
        items: (this.orderItems.get(o.id) ?? []).map((i) => ({ productId: i.productId, title: i.title, qty: i.qty, amountPesewas: i.unitPricePesewas * BigInt(i.qty) })),
      })
    }
    return out
  }

  async listPayoutFacts(filter: { sellerId?: string; paidFrom?: Date; paidTo?: Date }): Promise<PayoutFact[]> {
    return [...this.payouts.values()]
      .filter((p) => !filter.sellerId || p.sellerId === filter.sellerId)
      .filter((p) => !filter.paidFrom || (p.paidAt != null && p.paidAt >= filter.paidFrom))
      .filter((p) => !filter.paidTo || (p.paidAt != null && p.paidAt < filter.paidTo))
      .map((p) => ({
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
    const row = this.orderIndex.get(orderId)
    if (!row) return
    row.deliveryConfirmedBy = by
    row.payoutReleaseAt = releaseAt
  }

  /** Test/sandbox clock for the report window. */
  now: () => Date = () => new Date()

  async recordHandoverFailure(orderId: string) {
    const row = this.orderIndex.get(orderId)
    if (!row) return 0
    row.handoverFailures = (row.handoverFailures ?? 0) + 1
    return row.handoverFailures
  }

  async listDeliveredUnpaidOrders(sellerId: string) {
    return [...this.orderIndex.values()]
      .filter((o) => o.sellerId === sellerId && o.status === "delivered" && !o.payoutId)
      .filter((o) => this.paymentMethodForOrder(o) !== "cod")
      // A held order is not payable until an admin releases the hold.
      .filter((o) => ![...this.holds.values()].some((h) => h.status === "held" && h.orderId === o.id))
      // Seller-only confirmations wait out the buyer's report window.
      .filter((o) => !o.payoutReleaseAt || o.payoutReleaseAt.getTime() <= this.now().getTime())
      // Fully refunded: nothing left to pay the seller.
      .filter((o) => payableSubtotal(o) > 0n)
      .map((o) => ({ ...o }))
  }

  private payoutEvents: PayoutEventRow[] = []
  private payoutLineGross = new Map<string, bigint>()
  private returnCases = new Map<string, ReturnCaseRow>()
  private payoutCreatedAt = new Map<string, Date>()
  private paystackEvents = new Map<string, PaystackEventRow>()

  async reservePayout(input: { sellerId: string; commissionBps: number; reference: string; createdBy: string }) {
    const accountHold = [...this.holds.values()].find((h) => h.sellerId === input.sellerId && h.status === "held" && !h.orderId)
    if (accountHold) throw new PayoutBlockedError("seller_hold", `Payouts are on hold for this seller: ${accountHold.reason}`)
    const unpaid = await this.listDeliveredUnpaidOrders(input.sellerId)
    if (unpaid.length === 0) throw new PayoutBlockedError("nothing_payable", "No delivered, paid-online orders are waiting for a payout.")
    const batch = computePayoutBatch(
      input.sellerId,
      input.commissionBps,
      unpaid.map((o) => ({ orderId: o.id, sellerId: o.sellerId, subtotalPesewas: payableSubtotal(o) })),
    )
    // Refunds on orders already paid out come off this payout, oldest first.
    const owed = [...this.returnCases.values()]
      .filter((r) => r.sellerId === input.sellerId && r.sellerRecoveryPesewas > 0n && !r.recoveredPayoutId && r.refundStatus !== "failed")
      .sort((a, b) => +a.createdAt - +b.createdAt)
      .map((r) => ({ id: r.id, amountMinor: r.sellerRecoveryPesewas }))
    const recovered = applyRecoveries(batch.netPesewas, owed)
    const payout: PayoutRow = {
      id: crypto.randomUUID(),
      sellerId: input.sellerId,
      status: "pending",
      grossPesewas: batch.grossPesewas,
      commissionPesewas: batch.commissionPesewas,
      netPesewas: batch.netPesewas - recovered.totalMinor,
      recoveredPesewas: recovered.totalMinor,
      commissionBps: input.commissionBps,
      paystackTransferCode: null,
      paystackReference: input.reference,
      failureReason: null,
      paidAt: null,
      createdBy: input.createdBy,
    }
    this.payouts.set(payout.id, payout)
    this.payoutCreatedAt.set(payout.id, new Date())
    for (const line of batch.lines) {
      const live = this.orderIndex.get(line.orderId)
      if (live) live.payoutId = payout.id
      this.payoutLineGross.set(line.orderId, line.grossPesewas)
    }
    for (const r of recovered.applied) {
      const c = this.returnCases.get(r.id)
      if (c) c.recoveredPayoutId = payout.id
    }
    await this.addPayoutEvent(
      payout.id,
      "created",
      input.createdBy,
      `${unpaid.length} order${unpaid.length === 1 ? "" : "s"}${recovered.totalMinor > 0n ? ` · ${recovered.applied.length} refund${recovered.applied.length === 1 ? "" : "s"} taken back` : ""}`,
    )
    return { ...payout }
  }

  async markPayoutSent(payoutId: string, transferCode: string | null, actor: string) {
    const p = this.payouts.get(payoutId)
    if (!p) return null
    if (p.status === "pending") {
      p.status = "processing"
      p.paystackTransferCode = transferCode ?? p.paystackTransferCode
      await this.addPayoutEvent(payoutId, "sent", actor, transferCode)
    }
    return { ...p }
  }

  async settlePayout(payoutId: string, to: "paid" | "failed" | "reversed", opts: { actor: string; reason?: string | null; transferCode?: string | null }) {
    const p = this.payouts.get(payoutId)
    if (!p) return { payout: null, changed: false }
    if (p.status === to || !canMovePayout(p.status, to)) return { payout: { ...p }, changed: false }
    const currency = this.payoutCurrency(p.id)
    p.status = to
    if (opts.transferCode) p.paystackTransferCode = opts.transferCode
    if (to === "paid") {
      p.paidAt = this.now()
      if (!currency) throw new Error("payment intent missing for payout ledger")
      await this.ledger.append(payoutEntry({ payoutId: p.id, sellerId: p.sellerId, netMinor: p.netPesewas, currency }))
    } else {
      p.failureReason = opts.reason ?? null
      if (to === "reversed" && currency) {
        await this.ledger.append(payoutReversalEntry({ payoutId: p.id, sellerId: p.sellerId, netMinor: p.netPesewas, currency }))
      }
      // The money never arrived: those orders go back into the next payout,
      // and any refunds it took back are owed again.
      const back = new Set<string>()
      for (const o of this.orderIndex.values()) {
        if (o.payoutId === p.id) {
          o.payoutId = null
          this.payoutLineGross.delete(o.id)
          back.add(o.id)
        }
      }
      for (const c of this.returnCases.values()) {
        if (c.recoveredPayoutId === p.id) c.recoveredPayoutId = null
        // Refunded while in this payout: the order now pays only what's left,
        // so there's nothing to take back any more.
        else if (back.has(c.orderId) && !c.recoveredPayoutId) c.sellerRecoveryPesewas = 0n
      }
    }
    await this.addPayoutEvent(p.id, to, opts.actor, opts.reason ?? null)
    return { payout: { ...p }, changed: true }
  }

  private payoutCurrency(payoutId: string): string | null {
    const order = [...this.orderIndex.values()].find((o) => o.payoutId === payoutId)
    const group = order ? this.orderGroups.get(order.orderGroupId) : undefined
    return group ? (this.intents.get(group.paymentIntentId)?.currency ?? null) : null
  }

  async getPayoutByReference(reference: string) {
    const p = [...this.payouts.values()].find((x) => x.paystackReference === reference)
    return p ? { ...p } : null
  }

  async listPayoutLines(payoutId: string) {
    const p = this.payouts.get(payoutId)
    if (!p) return []
    return [...this.orderIndex.values()]
      .filter((o) => o.payoutId === payoutId)
      .map((o) => {
        // Frozen at reserve time: a later refund never rewrites a payout line.
        const gross = this.payoutLineGross.get(o.id) ?? o.subtotalPesewas
        const commission = (gross * BigInt(p.commissionBps)) / 10_000n
        return { orderId: o.id, grossPesewas: gross, commissionPesewas: commission, netPesewas: gross - commission }
      })
  }

  async listPayoutEvents(payoutIds: string[]) {
    const ids = new Set(payoutIds)
    return this.payoutEvents.filter((e) => ids.has(e.payoutId)).map((e) => ({ ...e }))
  }

  async addPayoutEvent(payoutId: string, status: PayoutEventRow["status"], actor: string, detail: string | null = null) {
    this.payoutEvents.push({ id: crypto.randomUUID(), payoutId, status, actor, detail, createdAt: new Date(Date.now() + this.payoutEvents.length) })
  }

  async recordPaystackEvent(row: Omit<PaystackEventRow, "receivedAt">) {
    const prev = this.paystackEvents.get(row.id)
    this.paystackEvents.set(row.id, { ...row, receivedAt: prev?.receivedAt ?? new Date() })
  }

  async listPaystackEvents(limit = 100) {
    return [...this.paystackEvents.values()].sort((a, b) => +b.receivedAt - +a.receivedAt).slice(0, limit)
  }

  private paymentMethodForOrder(o: OrderRow): string | null {
    const group = this.orderGroups.get(o.orderGroupId)
    return group ? (this.intents.get(group.paymentIntentId)?.method ?? null) : null
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
    const row = this.payouts.get(id)
    return row ? { ...row } : null
  }

  async listRecentPayouts(limit = 50) {
    return [...this.payouts.values()]
      .reverse()
      .slice(0, Math.max(1, Math.min(limit, 200)))
      .map((row) => ({ ...row, createdAt: this.payoutCreatedAt.get(row.id) ?? null }))
  }

  async listPayoutsForSeller(sellerId: string) {
    return [...this.payouts.values()]
      .filter((p) => p.sellerId === sellerId)
      .reverse()
      .map((row) => ({ ...row, createdAt: this.payoutCreatedAt.get(row.id) ?? null }))
  }

  async listPaidLinesForSeller(sellerId: string) {
    const out: {
      payoutId: string
      orderId: string
      grossPesewas: bigint
      commissionPesewas: bigint
      netPesewas: bigint
      payoutStatus: PayoutRow["status"]
      paidAt: Date | null
    }[] = []
    for (const payout of this.payouts.values()) {
      if (payout.sellerId !== sellerId) continue
      for (const order of this.orderIndex.values()) {
        if (order.sellerId !== sellerId || order.payoutId !== payout.id) continue
        const gross = this.payoutLineGross.get(order.id) ?? order.subtotalPesewas
        const commission = (gross * BigInt(payout.commissionBps)) / 10_000n
        out.push({
          payoutId: payout.id,
          orderId: order.id,
          grossPesewas: gross,
          commissionPesewas: commission,
          netPesewas: gross - commission,
          payoutStatus: payout.status,
          paidAt: payout.paidAt ?? null,
        })
      }
    }
    return out
  }

  async listPayoutHolds(sellerId: string, activeOnly = true): Promise<PayoutHoldRow[]> {
    return [...this.holds.values()]
      .filter((h) => h.sellerId === sellerId && (!activeOnly || h.status === "held"))
      .sort((a, b) => +b.createdAt - +a.createdAt || a.id.localeCompare(b.id))
  }

  async createPayoutHold(input: {
    sellerId: string
    orderId?: string | null
    amountPesewas?: bigint | null
    reason: string
    createdBy: string
  }): Promise<PayoutHoldRow> {
    const reason = input.reason?.trim()
    if (!reason) throw new Error("reason required")
    if (input.orderId) {
      const order = this.orderIndex.get(input.orderId)
      if (!order || order.sellerId !== input.sellerId) throw new Error("order not in this seller's orders")
    }
    if (input.amountPesewas !== undefined && input.amountPesewas !== null && input.amountPesewas < 0n) {
      throw new Error("amount must be >= 0")
    }
    const hold: PayoutHoldRow = {
      id: crypto.randomUUID(),
      sellerId: input.sellerId,
      orderId: input.orderId ?? null,
      amountPesewas: input.amountPesewas ?? null,
      reason,
      status: "held",
      createdBy: input.createdBy,
      releasedBy: null,
      releasedAt: null,
      createdAt: new Date(),
    }
    this.holds.set(hold.id, hold)
    return { ...hold }
  }

  async releasePayoutHold(id: string, releasedBy: string): Promise<PayoutHoldRow | null> {
    const hold = this.holds.get(id)
    if (!hold) return null
    hold.status = "released"
    hold.releasedBy = releasedBy
    hold.releasedAt = new Date()
    return { ...hold }
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
    const open = [...this.returnCases.values()].find((r) => r.orderId === input.orderId && r.status !== "closed")
    if (open) throw new ReturnCaseOpenError(open.id)
    const order = this.orderIndex.get(input.orderId)
    if (!order || order.sellerId !== input.sellerId) throw new Error("order not in this seller's orders")
    const now = this.now()
    const row: ReturnCaseRow = {
      id: crypto.randomUUID(),
      ...input,
      status: "requested",
      declineReason: null,
      outcome: null,
      refundPesewas: 0n,
      refundVia: null,
      refundStatus: null,
      refundRef: null,
      sellerRecoveryPesewas: 0n,
      recoveredPayoutId: null,
      adminNote: null,
      timeline: [{ at: now.toISOString(), by: "buyer", status: "requested", note: "Buyer asked for a return" }],
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    }
    this.returnCases.set(row.id, row)
    // The order's payout waits while the case is open (if it hasn't gone out yet).
    if (!order.payoutId && ![...this.holds.values()].some((h) => h.orderId === order.id && h.status === "held" && h.createdBy === "buyer")) {
      await this.createPayoutHold({ sellerId: order.sellerId, orderId: order.id, reason: `Return requested: ${input.note}`, createdBy: "buyer" })
    }
    return structuredClone(row)
  }

  async getReturnCase(id: string) {
    const r = this.returnCases.get(id)
    return r ? structuredClone(r) : null
  }

  async listReturnCases(f: ReturnCaseFilter) {
    const ids = f.orderIds ? new Set(f.orderIds) : null
    return [...this.returnCases.values()]
      .filter((r) => (!f.sellerId || r.sellerId === f.sellerId) && (!ids || ids.has(r.orderId)))
      .filter((r) => !f.buyerEmail || r.buyerEmail.toLowerCase() === f.buyerEmail.toLowerCase())
      .filter((r) => !f.statuses || f.statuses.includes(r.status))
      .filter((r) => !f.dueAt || (r.status !== "closed" && !!r.respondBy && r.respondBy.getTime() <= f.dueAt.getTime()))
      .filter((r) => !f.refundPending || (r.refundVia === "provider" && r.refundStatus === "pending"))
      .sort((a, b) => +b.createdAt - +a.createdAt)
      .map((r) => structuredClone(r))
  }

  async advanceReturnCase(id: string, from: ReturnStatus, change: ReturnCaseChange) {
    const r = this.returnCases.get(id)
    if (!r || r.status !== from) return null
    const now = this.now()
    r.status = change.status
    r.respondBy = change.respondBy
    if (change.declineReason !== undefined) r.declineReason = change.declineReason
    if (change.outcome !== undefined) r.outcome = change.outcome
    if (change.adminNote !== undefined) r.adminNote = change.adminNote
    r.timeline.push({ at: now.toISOString(), by: change.entry.by, status: change.status, note: change.entry.note })
    r.updatedAt = now
    const money = change.refund
    if (money && money.minor > 0n) {
      const order = this.orderIndex.get(r.orderId)
      if (order) order.refundedPesewas = (order.refundedPesewas ?? 0n) + money.minor
      r.refundPesewas = money.minor
      r.refundVia = money.via
      r.refundStatus = money.status
      r.refundRef = money.ref ?? null
      r.sellerRecoveryPesewas = money.sellerRecoveryMinor
      for (const e of refundEntries({ caseId: r.id, orderId: r.orderId, intentId: money.intentId, sellerId: r.sellerId, refundMinor: money.minor, platformMinor: money.platformMinor, currency: money.currency })) {
        await this.ledger.append(e)
      }
    }
    if (change.status === "closed") {
      r.closedAt = now
      for (const h of this.holds.values()) {
        if (h.orderId === r.orderId && h.status === "held" && h.createdBy === "buyer") await this.releasePayoutHold(h.id, "return closed")
      }
    }
    return structuredClone(r)
  }

  async setReturnRefund(id: string, patch: { status: "pending" | "paid" | "failed" | "owed"; ref?: string | null; entry?: { by: ReturnActor; note: string } }) {
    const r = this.returnCases.get(id)
    if (!r || r.refundPesewas <= 0n) return null
    r.refundStatus = patch.status
    if (patch.ref !== undefined) r.refundRef = patch.ref
    r.updatedAt = this.now()
    if (patch.entry) r.timeline.push({ at: r.updatedAt.toISOString(), by: patch.entry.by, status: r.status, note: patch.entry.note })
    return structuredClone(r)
  }

  private notifications = new Map<string, NotificationRow>()

  async enqueueNotification(input: {
    key: string
    recipient: string
    body: string
    channel?: string
    category?: "transactional" | "promotional" | "operational"
  }) {
    if (this.notifications.has(input.key)) return { inserted: false }
    this.notifications.set(input.key, {
      id: crypto.randomUUID(),
      key: input.key,
      channel: input.channel ?? "sms",
      recipient: input.recipient,
      body: input.body,
      category: input.category ?? "transactional",
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      sentAt: null,
    })
    return { inserted: true }
  }

  async countRecentSends(recipient: string, channel: string, since: Date): Promise<number> {
    let n = 0
    for (const row of this.notifications.values()) {
      if (row.recipient === recipient && row.channel === channel && row.createdAt >= since) n += 1
    }
    return n
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

  async productHasOrders(productId: string) {
    for (const items of this.orderItems.values()) {
      if (items.some((i) => i.productId === productId)) return true
    }
    return false
  }

  private reviewsById = new Map<string, ReviewRow>()
  private reviewIdByOrder = new Map<string, string>()

  async createReview(input: {
    orderId: string
    productId: string
    sellerId: string
    buyerEmail: string
    rating: number
    title: string | null
    body: string
  }) {
    if (this.reviewIdByOrder.has(input.orderId)) return null
    const row: ReviewRow = {
      id: crypto.randomUUID(),
      ...input,
      status: "pending",
      vendorResponse: null,
      respondedAt: null,
      createdAt: new Date(),
    }
    this.reviewsById.set(row.id, row)
    this.reviewIdByOrder.set(row.orderId, row.id)
    return row
  }

  async getReview(id: string) {
    return this.reviewsById.get(id) ?? null
  }

  async listReviewsBySeller(sellerId: string) {
    return [...this.reviewsById.values()]
      .filter((r) => r.sellerId === sellerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async productOrderCounts(_since?: Date) {
    // The in-memory store keeps no order timestamps, so the window is
    // ignored here; Postgres applies it. Tests that care about recency use
    // the Postgres repository.
    const counts = new Map<string, number>()
    for (const items of this.orderItems.values()) {
      for (const item of items) {
        counts.set(item.productId, (counts.get(item.productId) ?? 0) + item.qty)
      }
    }
    return counts
  }

  async reviewTotalsBySeller() {
    const sums = new Map<string, { count: number; total: number }>()
    for (const r of this.reviewsById.values()) {
      if (r.status !== "published") continue
      const acc = sums.get(r.sellerId) ?? { count: 0, total: 0 }
      acc.count += 1
      acc.total += r.rating
      sums.set(r.sellerId, acc)
    }
    const out = new Map<string, { count: number; avg: number }>()
    for (const [sellerId, acc] of sums) {
      out.set(sellerId, {
        count: acc.count,
        avg: Math.round((acc.total / acc.count) * 10) / 10,
      })
    }
    return out
  }

  async reviewTotalsByProduct() {
    const sums = new Map<string, { count: number; total: number }>()
    for (const r of this.reviewsById.values()) {
      if (r.status !== "published") continue
      const acc = sums.get(r.productId) ?? { count: 0, total: 0 }
      acc.count += 1
      acc.total += r.rating
      sums.set(r.productId, acc)
    }
    const out = new Map<string, { count: number; avg: number }>()
    for (const [productId, acc] of sums) {
      out.set(productId, {
        count: acc.count,
        avg: Math.round((acc.total / acc.count) * 10) / 10,
      })
    }
    return out
  }

  async listPublishedReviewsByProduct(productId: string) {
    return [...this.reviewsById.values()]
      .filter((r) => r.productId === productId && r.status === "published")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async listPendingReviews() {
    return [...this.reviewsById.values()]
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  async updateReviewStatus(id: string, status: "published" | "hidden") {
    const row = this.reviewsById.get(id)
    if (!row) return null
    row.status = status
    return row
  }

  async respondToReview(id: string, sellerId: string, message: string) {
    const row = this.reviewsById.get(id)
    if (!row || row.sellerId !== sellerId) return null
    row.vendorResponse = message
    row.respondedAt = new Date()
    return row
  }

  // ── Phase 7A: preference center ──

  async listNotificationPreferences(
    ownerType: "buyer" | "seller",
    ownerId: string,
  ): Promise<NotificationPreferenceDto[]> {
    return [...this.prefs.values()]
      .filter((p) => p.ownerType === ownerType && p.ownerId === ownerId)
      .sort((a, b) => a.category.localeCompare(b.category) || (a.topic ?? "").localeCompare(b.topic ?? ""))
      .map((p) => ({ ...p }))
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
    const key = `${input.ownerType}\n${input.ownerId}\n${input.channel}\n${input.category}\n${input.topic ?? ""}`
    const now = new Date()
    const existing = this.prefs.get(key)
    if (existing) {
      existing.optedIn = input.optedIn
      existing.frequencyCap = input.frequencyCap ?? null
      existing.updatedAt = now
      return { ...existing }
    }
    const row: NotificationPreferenceDto = {
      id: crypto.randomUUID(),
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      channel: input.channel,
      category: input.category,
      topic: input.topic ?? null,
      optedIn: input.optedIn,
      frequencyCap: input.frequencyCap ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.prefs.set(key, row)
    return { ...row }
  }

  // ── Phase 7B: alert subscriptions (one-shot) ──

  async listStockSubscriptions(filters: {
    offerId?: string
    buyerEmail?: string
  }): Promise<StockSubscriptionDto[]> {
    return [...this.subscriptions.values()]
      .filter(
        (s) =>
          (!filters.offerId || s.offerId === filters.offerId) &&
          (!filters.buyerEmail || s.buyerEmail === filters.buyerEmail),
      )
      .map((s) => ({ ...s }))
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
    const row: StockSubscriptionDto = {
      id: crypto.randomUUID(),
      buyerEmail: email,
      productId: input.productId,
      offerId: input.offerId ?? null,
      kind: input.kind,
      belowPesewas: input.belowPesewas != null ? input.belowPesewas.toString() : null,
      channel: input.channel ?? "sms",
      createdAt: new Date(),
    }
    this.subscriptions.set(row.id, row)
    return { ...row }
  }

  async deleteStockSubscription(id: string, buyerEmail: string): Promise<boolean> {
    const row = this.subscriptions.get(id)
    if (!row || row.buyerEmail !== buyerEmail.trim().toLowerCase()) return false
    this.subscriptions.delete(id)
    return true
  }

  // ── Phase 7D: experiment registry ──

  async listExperiments(status?: ExperimentDto["status"]): Promise<ExperimentDto[]> {
    return [...this.experiments.values()]
      .filter((e) => !status || e.status === status)
      .sort((a, b) => +b.createdAt - +a.createdAt)
      .map((e) => ({ ...e }))
  }

  async getExperiment(id: string): Promise<ExperimentDto | null> {
    const row = this.experiments.get(id)
    return row ? { ...row } : null
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
    if ([...this.experiments.values()].some((e) => e.key === key)) {
      throw new Error("experiment key already used")
    }
    const name = input.name?.trim()
    if (!name) throw new Error("name required")
    const controlPct = input.controlPct ?? 50
    if (!Number.isInteger(controlPct) || controlPct < 0 || controlPct > 100) {
      throw new Error("controlPct must be 0-100")
    }
    if (!input.createdBy?.trim()) throw new Error("createdBy required")
    const row: ExperimentDto = {
      id: crypto.randomUUID(),
      key,
      name,
      description: input.description?.trim() || null,
      status: "draft",
      controlPct,
      primaryMetric: input.primaryMetric?.trim() || null,
      guardrails: input.guardrails ?? null,
      startedAt: null,
      endedAt: null,
      createdBy: input.createdBy.trim(),
      createdAt: new Date(),
    }
    this.experiments.set(row.id, row)
    return { ...row }
  }

  async updateExperiment(id: string, patch: {
    name?: string
    description?: string | null
    controlPct?: number
    primaryMetric?: string | null
    guardrails?: unknown
    status?: ExperimentDto["status"]
  }): Promise<ExperimentDto | null> {
    const row = this.experiments.get(id)
    if (!row) return null
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (!name) throw new Error("name required")
      row.name = name
    }
    if (patch.description !== undefined) row.description = patch.description?.trim() || null
    if (patch.controlPct !== undefined) {
      if (row.status === "running" || row.status === "ended") {
        throw new Error("controlPct is frozen once running")
      }
      if (!Number.isInteger(patch.controlPct) || patch.controlPct < 0 || patch.controlPct > 100) {
        throw new Error("controlPct must be 0-100")
      }
      row.controlPct = patch.controlPct
    }
    if (patch.primaryMetric !== undefined) row.primaryMetric = patch.primaryMetric?.trim() || null
    if (patch.guardrails !== undefined) row.guardrails = patch.guardrails ?? null
    if (patch.status !== undefined) {
      const ok =
        (row.status === "draft" && patch.status === "running") ||
        (row.status === "running" && (patch.status === "paused" || patch.status === "ended")) ||
        (row.status === "paused" && (patch.status === "running" || patch.status === "ended"))
      if (!ok) throw new Error(`cannot move ${row.status} to ${patch.status}`)
      row.status = patch.status
      const now = new Date()
      if (patch.status === "running" && !row.startedAt) row.startedAt = now
      if (patch.status === "ended") row.endedAt = now
    }
    return { ...row }
  }

  async assignExperiment(
    experimentKey: string,
    unitId: string,
  ): Promise<{ experimentId: string; bucket: "control" | "exposed" } | null> {
    const exp = [...this.experiments.values()].find((e) => e.key === experimentKey)
    if (!exp) return null
    const unit = unitId.trim()
    if (!unit) return null
    if (exp.status !== "running") return { experimentId: exp.id, bucket: "control" }
    const seen = this.exposures.get(`${exp.id}\n${unit}`)
    if (seen) return { experimentId: exp.id, bucket: seen.bucket }
    let hash = 2166136261
    const input = `${exp.id}:${unit}`
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
    const bucket = (hash >>> 0) % 100 < exp.controlPct ? "control" : "exposed"
    this.exposures.set(`${exp.id}\n${unit}`, { experimentId: exp.id, unitId: unit, bucket })
    return { experimentId: exp.id, bucket }
  }

  async reportExperiment(id: string): Promise<{ control: number; exposed: number } | null> {
    if (!this.experiments.has(id)) return null
    let control = 0
    let exposed = 0
    for (const e of this.exposures.values()) {
      if (e.experimentId !== id) continue
      if (e.bucket === "control") control += 1
      else exposed += 1
    }
    return { control, exposed }
  }
}
