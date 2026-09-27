import { orderReference } from "@alkemart/shared/order-ref"
import type { SellerRef } from "./seller"
import { apiJson } from "./http"
import { getActiveMarket } from "./market"
import { getWorkersAccessToken } from "./auth"

export type FulfillmentStatus = "placed" | "shipped" | "delivered" | "cancelled"

export type OrderItem = {
  id: string
  title: string
  quantity: number
  unitPrice: number | null
  productId?: string | null
  seller?: SellerRef | null
}

export type OrderPromise = {
  dispatchBy: string | null
  deliverEarliest: string | null
  deliverLatest: string | null
  state: "on_track" | "dispatch_late" | "delivery_late" | "done"
}

/** One dated step, oldest first. `by` is a role, never an id. */
export type OrderTimelineStep = { status: FulfillmentStatus; at: string; by: string }

/** One seller's share of an OrderGroup — each ships on its own. */
export type SellerOrder = {
  id: string
  seller: SellerRef | null
  status: FulfillmentStatus | string
  subtotal: number | null
  deliveryFee: number | null
  items: OrderItem[]
  /** Null on orders placed before promises existed. */
  promise: OrderPromise | null
  timeline: OrderTimelineStep[]
  fulfillmentMethod: "delivery" | "pickup"
  /** The buyer's handover code; null once delivered. */
  handoverCode: string | null
  /** Where to collect a pickup order. */
  pickup: { place: string | null; landmark: string | null; lat: number | null; lng: number | null } | null
  deliveryConfirmedBy: "buyer_code" | "buyer" | "seller" | null
  problemReported: boolean
  /** Already refunded on this order (major units). */
  refunded: number
  /** The newest return on this order (open, or the last that closed). */
  returnCase: ReturnCase | null
  /** What the buyer can ask for right now; null = nothing. Computed by the API. */
  returnOptions: ReturnOptions | null
}

export type ReturnReason = "damaged" | "wrong_item" | "not_as_described" | "changed_mind"
export type ReturnStatus = "requested" | "declined" | "escalated" | "closed"

export type ReturnCase = {
  id: string
  status: ReturnStatus
  waitingOn: "seller" | "buyer" | "admin" | null
  respondBy: string | null
  reason: ReturnReason
  reasonLabel: string
  wish: "refund" | "swap"
  note: string
  declineReason: string | null
  outcome: "refund" | "swap" | "declined" | "withdrawn" | null
  refund: { amount: number | null; via: "provider" | "seller" | null; status: "pending" | "paid" | "failed" | "owed" | null } | null
  adminNote: string | null
  timeline: { at: string; by: string; note: string }[]
}

export type ReturnOptions = {
  reasons: { reason: ReturnReason; label: string; until: string | null }[]
  refundable: number | null
  shopReturnDays: number
}

export type PaymentState = "collect_on_delivery" | "collected" | "paid" | "pending" | "failed"

export type OrderAddress = {
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  countryCode?: string | null
  postalCode?: string | null
}

export type StoreOrder = {
  id: string
  /** Aggregate across seller orders, computed by the API. */
  fulfillmentStatus: FulfillmentStatus | string
  /** From the payment intent; null when the API did not say — never assumed paid. */
  paymentStatus: "captured" | "pending" | null
  paymentMethod: "cod" | "momo" | "card" | string | null
  /** COD reads collect_on_delivery until delivered — never "paid" early. */
  paymentState: PaymentState | null
  createdAt: string | null
  total: number | null
  itemTotal: number | null
  shippingTotal: number | null
  currencyCode: string
  email: string | null
  sellerOrders: SellerOrder[]
  items: OrderItem[]
  shippingAddress: OrderAddress | null
}

function toMajor(pesewas: string | number | null | undefined): number | null {
  if (pesewas == null || pesewas === "") return null
  const n = typeof pesewas === "string" ? Number(pesewas) : pesewas
  // Minor units per major come from the market (100 for cedis; not universal).
  return Number.isFinite(n) ? n / getActiveMarket().currency.minorUnitsPerMajor : null
}

type WorkersOrderGroup = {
  id: string
  buyerEmail?: string
  totalPesewas: string
  currency: string
  createdAt?: string | null
  paymentMethod?: string | null
  paymentStatus?: string | null
  paymentState?: PaymentState | null
  fulfillmentStatus?: string | null
  shippingAddress?: Record<string, unknown> | null
  orders: Array<{
    id: string
    sellerId: string
    sellerName?: string | null
    sellerHandle?: string | null
    status: string
    subtotalPesewas: string
    deliveryFeePesewas: string
    promise?: OrderPromise | null
    timeline?: OrderTimelineStep[]
    fulfillmentMethod?: "delivery" | "pickup"
    handoverCode?: string | null
    pickup?: SellerOrder["pickup"]
    deliveryConfirmedBy?: SellerOrder["deliveryConfirmedBy"]
    problemReported?: boolean
    refundedPesewas?: string
    returnCase?: WorkersReturnCase | null
    returnOptions?: { reasons: ReturnOptions["reasons"]; refundablePesewas: string; shopReturnDays: number } | null
    items: Array<{
      id: string
      title: string
      qty: number
      unitPricePesewas: string
      productId?: string
    }>
  }>
}

type WorkersReturnCase = Omit<ReturnCase, "refund"> & {
  refund: { amountPesewas: string; via: "provider" | "seller" | null; status: NonNullable<ReturnCase["refund"]>["status"] } | null
}

function mapReturnCase(r: WorkersReturnCase): ReturnCase {
  return {
    ...r,
    refund: r.refund ? { amount: toMajor(r.refund.amountPesewas), via: r.refund.via, status: r.refund.status } : null,
  }
}

function mapAddress(addr: Record<string, unknown> | null | undefined): OrderAddress | null {
  if (!addr || typeof addr !== "object") return null
  const s = (k: string) => (typeof addr[k] === "string" && addr[k] ? (addr[k] as string) : null)
  return {
    firstName: s("first_name"),
    lastName: s("last_name"),
    phone: s("phone"),
    address1: s("address_1"),
    address2: s("address_2"),
    city: s("city"),
    province: s("province"),
    countryCode: s("country_code"),
    postalCode: s("postal_code"),
  }
}

/** Pure mapping of a Workers OrderGroup (exported for tests). */
export function mapWorkersOrderGroup(group: WorkersOrderGroup): StoreOrder {
  const sellerOrders: SellerOrder[] = (group.orders ?? []).map((order) => {
    // A missing name reads as unknown, never as a raw id string.
    const seller = order.sellerName
      ? { id: order.sellerId, name: order.sellerName, handle: order.sellerHandle ?? null }
      : null
    return {
      id: order.id,
      seller,
      status: order.status,
      subtotal: toMajor(order.subtotalPesewas),
      deliveryFee: toMajor(order.deliveryFeePesewas),
      promise: order.promise && (order.promise.dispatchBy || order.promise.deliverLatest) ? order.promise : null,
      timeline: order.timeline ?? [],
      fulfillmentMethod: order.fulfillmentMethod ?? "delivery",
      handoverCode: order.handoverCode ?? null,
      pickup: order.pickup ?? null,
      deliveryConfirmedBy: order.deliveryConfirmedBy ?? null,
      problemReported: order.problemReported ?? false,
      refunded: toMajor(order.refundedPesewas ?? "0") ?? 0,
      returnCase: order.returnCase ? mapReturnCase(order.returnCase) : null,
      returnOptions: order.returnOptions
        ? { reasons: order.returnOptions.reasons, refundable: toMajor(order.returnOptions.refundablePesewas), shopReturnDays: order.returnOptions.shopReturnDays }
        : null,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.qty,
        unitPrice: toMajor(item.unitPricePesewas),
        productId: item.productId ?? null,
        seller,
      })),
    }
  })
  const sum = (pick: (o: WorkersOrderGroup["orders"][number]) => string) =>
    (group.orders ?? []).reduce((acc, o) => acc + (Number(pick(o)) || 0), 0)
  const payment = group.paymentStatus
  return {
    id: group.id,
    fulfillmentStatus: group.fulfillmentStatus ?? "placed",
    paymentStatus: payment === "captured" || payment === "pending" ? payment : null,
    paymentMethod: group.paymentMethod ?? null,
    paymentState: group.paymentState ?? null,
    createdAt: group.createdAt ?? null,
    total: toMajor(group.totalPesewas),
    itemTotal: toMajor(sum((o) => o.subtotalPesewas)),
    shippingTotal: toMajor(sum((o) => o.deliveryFeePesewas)),
    currencyCode: group.currency || "ghs",
    email: group.buyerEmail ?? null,
    sellerOrders,
    items: sellerOrders.flatMap((o) => o.items),
    shippingAddress: mapAddress(group.shippingAddress),
  }
}

export async function listMyOrders(): Promise<StoreOrder[]> {
  const token = getWorkersAccessToken()
  if (!token) throw new Error("Sign in required to list orders")
  const data = await apiJson<{ items?: WorkersOrderGroup[] }>("/store/orders", { token })
  return (data.items ?? []).map(mapWorkersOrderGroup)
}

/**
 * Signed in: GET /store/orders/:id. Otherwise (or when the account does not
 * own it) the guest lookup, which requires the checkout email.
 */
export async function getOrder(
  orderId: string,
  opts?: { email?: string | null },
): Promise<StoreOrder> {
  const id = orderId.trim()
  if (!id) throw new Error("order id required")
  const token = getWorkersAccessToken()
  if (token) {
    try {
      const data = await apiJson<{ orderGroup?: WorkersOrderGroup }>(
        `/store/orders/${encodeURIComponent(id)}`,
        { token },
      )
      if (data.orderGroup) return mapWorkersOrderGroup(data.orderGroup)
    } catch {
      /* not this account's order — fall through to email lookup */
    }
  }
  const email = opts?.email?.trim()
  if (!email) {
    throw new Error(
      token
        ? "Order not found for this account. Try looking up with the checkout email."
        : "Enter the email used at checkout to view this order.",
    )
  }
  return lookupOrderByEmail(id, email)
}

/** Guest-safe lookup — the server requires the checkout email to match. */
export async function lookupOrderByEmail(orderId: string, email: string): Promise<StoreOrder> {
  try {
    const data = await apiJson<{ orderGroup?: WorkersOrderGroup }>("/store/orders/lookup", {
      method: "POST",
      body: JSON.stringify({ orderId: orderId.trim(), email: email.trim() }),
    })
    if (!data.orderGroup) throw new Error("Order not found for that id and email")
    return mapWorkersOrderGroup(data.orderGroup)
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw new Error("Order not found for that id and email", { cause: err })
    }
    throw err
  }
}

/** Short ref for chrome — the same number sellers, SMS and admin quote. */
export function maskOrderId(orderId: string): string {
  return orderReference(orderId)
}

export function formatOrderLabel(order: Pick<StoreOrder, "id">): string {
  return `Order ${maskOrderId(order.id)}`
}

/** a***@domain.com */
export function maskEmail(email: string): string {
  const e = email.trim()
  const at = e.indexOf("@")
  if (at < 1) return "···"
  return `${e.charAt(0)}***@${e.slice(at + 1)}`
}

export function formatAddressLines(addr: OrderAddress): string[] {
  const lines: string[] = []
  const name = [addr.firstName, addr.lastName].filter(Boolean).join(" ")
  if (name) lines.push(name)
  if (addr.address1) lines.push(addr.address1)
  if (addr.address2) lines.push(addr.address2)
  const cityLine = [addr.city, addr.province, addr.postalCode].filter(Boolean).join(", ")
  if (cityLine) lines.push(cityLine)
  if (addr.phone) lines.push(addr.phone)
  return lines
}



/**
 * Buyer actions on one seller's order. Signed-in buyers are recognised by
 * their session; guests prove it with the checkout email (as in lookup).
 */
const buyerAction = (orderId: string, path: string, body: Record<string, unknown>) =>
  apiJson<{ ok: true }>(`/store/orders/${encodeURIComponent(orderId)}/${path}`, {
    method: "POST",
    token: getWorkersAccessToken(),
    body: JSON.stringify(body),
  })

/** "I got it" — confirms delivery and releases the seller's payment. */
export const confirmReceived = (orderId: string, email?: string | null) => buyerAction(orderId, "received", email ? { email } : {})

/** "There's a problem" — the seller is told and this order's payment waits. */
export const reportProblem = (orderId: string, note: string, email?: string | null) =>
  buyerAction(orderId, "problem", { note, ...(email ? { email } : {}) })

/** "It's sorted" — withdraws the report. */
export const problemSorted = (orderId: string, email?: string | null) => buyerAction(orderId, "problem/resolved", email ? { email } : {})

/** Ask for a return (money back or a replacement) on one seller's order. */
export const askForReturn = (orderId: string, input: { reason: ReturnReason; wish: "refund" | "swap"; note: string }, email?: string | null) =>
  buyerAction(orderId, "return", { ...input, ...(email ? { email } : {}) })

/** Answer a seller's decline (accept it, or ask alkemart to decide), or close the return. */
export const respondToReturn = (orderId: string, action: "accept" | "escalate" | "withdraw", email?: string | null) =>
  buyerAction(orderId, "return/respond", { action, ...(email ? { email } : {}) })
