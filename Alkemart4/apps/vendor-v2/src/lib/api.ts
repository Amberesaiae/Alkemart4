/**
 * Seller API — Workers only. Shapes mirror apps/api/src/routes/vendor/*.
 * Errors always propagate: an outage is shown as an error, never as zeros
 * (CONSOLE-REDESIGN V5).
 */
import { api } from "./http"
import { readSession, writeSession, type SellerSession } from "./session"
import { workosBrowser, workosEnabled } from "./workos"

// ─── Auth ────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const s = await api<SellerSession>("/vendor/auth/login", {
    method: "POST",
    json: { email: email.trim(), password },
  })
  writeSession(s)
  return s
}

export type RegisterInput = { email: string; password: string; sellerName: string; sellerHandle: string; turnstileToken?: string }

export async function register(input: RegisterInput) {
  const s = await api<SellerSession>("/vendor/auth/register", { method: "POST", json: input })
  writeSession(s)
  return s
}

export async function signOut() {
  if (workosEnabled) await workosBrowser.logout()
  writeSession(null)
}

export const resendEmailVerification = () =>
  api<{ ok: boolean; verified: boolean }>("/vendor/auth/verify-email/request", { method: "POST" })

export async function confirmEmailVerification(token: string) {
  const result = await api<{ ok: boolean; userId: string }>("/vendor/auth/verify-email/confirm", { method: "POST", json: { token } })
  const session = readSession()
  if (session?.user.id === result.userId) writeSession({ ...session, user: { ...session.user, emailVerified: true } })
}

// ─── Shop ────────────────────────────────────────────────────────────────

export type SellerStatus = "pending_approval" | "open" | "suspended" | "terminated"

export type Seller = {
  id: string
  name: string
  handle: string
  email: string | null
  status: SellerStatus
  description: string | null
  logo: string | null
  banner: string | null
}

export const getSeller = () => api<{ seller: Seller }>("/vendor/sellers/me").then((r) => r.seller)

// ─── To do ───────────────────────────────────────────────────────────────

export type TaskKind =
  | "approval"
  | "changes"
  | "drafts"
  | "dispatch"
  | "logo"
  | "momo"
  | "address"
  | "stock"
  | "price"
  | "sla"
  | "payout"
  | "returns"

export type Task = { kind: TaskKind; title: string; detail: string; href: string; count: number }

export const getTasks = () => api<{ tasks: Task[] }>("/vendor/tasks").then((r) => r.tasks)

export type HealthState = "healthy" | "attention" | "blocked"
export type Health = {
  status: HealthState
  items: { key: string; label: string; detail: string; state: HealthState; href: string }[]
}

export const getHealth = () => api<Health>("/vendor/health")

// ─── Orders ──────────────────────────────────────────────────────────────

export type OrderStatus = "placed" | "shipped" | "delivered" | "cancelled"

export type OrderSummary = {
  id: string
  orderGroupId: string
  subtotalPesewas: string
  deliveryFeePesewas: string
  status: OrderStatus
  /** Newest first. Null only for legacy rows. */
  placedAt: string | null
  itemCount: number
  items: { productId: string; title: string; qty: number }[]
  /** Area only on lists — street and phone live on the order page. */
  shipTo: { city: string | null; region: string | null } | null
  paymentMethod: "cod" | "momo" | "card" | string | null
  /** Deadlines frozen at checkout from your delivery settings. */
  dispatchBy: string | null
  deliverBy: string | null
  fulfillmentMethod?: "delivery" | "pickup"
  deliveryZone?: "town" | "region" | "country" | null
  /** Latest return on this order (list only). */
  returnCase?: { status: ReturnStatus; waitingOnYou: boolean } | null
}

// ─── Returns ─────────────────────────────────────────────────────────────

export type ReturnStatus = "requested" | "declined" | "escalated" | "closed"

/** A buyer's return, as the API computed it. Amounts are minor-unit strings. */
export type ReturnCase = {
  id: string
  orderId: string
  status: ReturnStatus
  waitingOn: "seller" | "buyer" | "admin" | null
  respondBy: string | null
  reason: string
  reasonLabel: string
  wish: "refund" | "swap"
  note: string
  declineReason: string | null
  outcome: "refund" | "swap" | "declined" | "withdrawn" | null
  refund: { amountPesewas: string; via: "provider" | "seller" | null; status: "pending" | "paid" | "failed" | "owed" | null } | null
  adminNote: string | null
  sellerRecoveryPesewas: string
  recovered: boolean
  timeline: { at: string; by: string; note: string }[]
  createdAt: string
  closedAt: string | null
  orderReference?: string | null
  subtotalPesewas?: string | null
}

export const listReturns = () => api<{ items: ReturnCase[]; waitingOnYou: number }>("/vendor/returns")

const returnAction = (id: string, path: string, json: Record<string, unknown> = {}) =>
  api<{ returnCase: ReturnCase }>(`/vendor/returns/${encodeURIComponent(id)}/${path}`, { method: "POST", json }).then((r) => r.returnCase)

/** Refund in full. */
export const refundReturn = (id: string) => returnAction(id, "refund")
/** Send a replacement (no money moves). */
export const replaceReturn = (id: string) => returnAction(id, "replace")
export const declineReturn = (id: string, reason: string) => returnAction(id, "decline", { reason })
/** Pay on delivery: you paid the buyer back yourself. */
export const refundPaid = (id: string) => returnAction(id, "refund-paid")

export type OrderTimelineStep = { status: OrderStatus; at: string; by: string }
export type OrderPromise = {
  dispatchBy: string | null
  deliverEarliest: string | null
  deliverLatest: string | null
  state: "on_track" | "dispatch_late" | "delivery_late" | "done"
}

export const listOrders = (limit = 200) =>
  api<{ items: OrderSummary[]; count: number }>(`/vendor/orders?limit=${limit}`)

export type OrderDetail = Omit<OrderSummary, "items" | "itemCount" | "shipTo"> & {
  /** The buyer's code can still be checked on this order. */
  handoverAvailable?: boolean
  deliveryConfirmedBy?: "buyer_code" | "buyer" | "seller" | null
  /** Set while the online payout waits out the buyer's report window; null once payable. */
  payoutReleaseAt?: string | null
  /** The buyer reported a problem; this order's payout is on hold. */
  problem?: { note: string; at: string } | null
  /** Latest return on this order (open, or the last one that closed). */
  returnCase?: ReturnCase | null
  refundedPesewas?: string
  /** The payout this order went out in; null while not paid out. */
  payout?: { status: "pending" | "processing" | "paid" | "failed" | "reversed"; paidAt: string | null } | null
  buyerEmail: string | null
  paymentStatus: string | null
  paymentState: "collect_on_delivery" | "collected" | "paid" | "pending" | "failed" | null
  promise: OrderPromise
  timeline: OrderTimelineStep[]
  shippingAddress: {
    first_name: string
    last_name: string
    phone: string
    address_1: string
    address_2?: string
    city: string
    province?: string
    postal_code?: string
    /** Buyer's pinned delivery spot. */
    latitude?: number
    longitude?: number
  } | null
  items: { id: string; title: string; qty: number; unitPricePesewas: string; productId: string; offerId: string }[]
}

export const getOrder = (id: string) =>
  api<{ order: OrderDetail }>(`/vendor/orders/${encodeURIComponent(id)}`).then((r) => r.order)

/** placed → shipped. The API texts the buyer (never blocks the update). */
export const markSent = (id: string) =>
  api<{ order: { status: OrderStatus } }>(`/vendor/orders/${encodeURIComponent(id)}/ship`, { method: "POST" })

/**
 * → delivered (from placed or shipped). The buyer's code is optional proof:
 * with it an online payout is released at once.
 */
export const markDelivered = (id: string, code?: string) =>
  api<{ order: { status: OrderStatus } }>(`/vendor/orders/${encodeURIComponent(id)}/deliver`, { method: "POST", json: code ? { code } : {} })

// ─── Money ───────────────────────────────────────────────────────────────

export type Statement = {
  currency: string
  commissionBps: number
  totals: {
    pendingGrossPesewas: string
    pendingNetPesewas: string
    heldNetPesewas: string
    paidNetPesewas: string
    /** Pay-on-delivery cash the seller already collected. */
    cashCollectedPesewas: string
    /** Commission the seller owes alkemart on those cash orders. */
    commissionOwedPesewas: string
    /** In a payout Paystack hasn't confirmed yet. */
    sendingNetPesewas: string
    /** Refunds on orders you were already paid for, to come off your next payout. */
    refundsToRecoverPesewas?: string
    lineCount: number
  }
  payoutAccount: { type: "momo"; provider: string | null; phoneLast4: string } | null
  payouts: Payout[]
  holds: { id: string; orderId: string | null; amountPesewas: string | null; reason: string; createdAt: string }[]
  lines: StatementLine[]
}

export type StatementLine = {
  orderId: string
  orderGroupId: string
  orderedAt: string | null
  /** paid = arrived · sending = on its way · pending = in the next payout · held = paused · cash = you collected it */
  state: "paid" | "sending" | "pending" | "held" | "cash" | "refunded"
  subtotalPesewas: string
  paymentMethod: string | null
  commissionPesewas: string
  netPesewas: string
  cashCollectedPesewas: string | null
  holdReason: string | null
  payoutId: string | null
  payoutStatus: string | null
  paidAt: string | null
}

export type Payout = {
  id: string
  status: "pending" | "processing" | "paid" | "failed" | "reversed"
  statusText: string
  grossPesewas: string
  commissionPesewas: string
  netPesewas: string
  /** Refunds on already-paid orders taken back from this payout. */
  recoveredPesewas?: string
  reference: string | null
  failureReason: string | null
  createdAt: string | null
  paidAt: string | null
  orderCount: number
  steps: { status: string; by: "Paystack" | "alkemart"; at: string; detail: string | null }[]
}

export const getStatement = () => api<Statement>("/vendor/payouts/statement")

// ─── Performance ─────────────────────────────────────────────────────────

export type ShopStats = {
  views30d: number
  conversion: number
  series: { date: string; views: number }[]
  top: { productId: string; title: string; thumbnail: string | null; views: number }[]
}

export const getShopStats = () => api<ShopStats>("/vendor/stats/shop")

// ─── Messages ────────────────────────────────────────────────────────────

export type SellerThread = {
  id: string
  buyerName: string
  productId: string | null
  productTitle: string | null
  orderId: string | null
  orderReference: string | null
  last: { body: string; sender: "buyer" | "seller"; at: string } | null
  unread: boolean
  blocked: boolean
  blockedByYou: boolean
  reported: boolean
  lastMessageAt: string
}
export type ChatMessage = { id: string; sender: "buyer" | "seller"; body: string; at: string; warning: string | null }
export type SellerQuestion = { id: string; productId: string; productTitle: string | null; askerName: string; question: string; answer: string | null; askedAt: string; hidden: boolean }

export const listThreads = () =>
  api<{ items: SellerThread[]; unread: number; unansweredQuestions: number; replyTime: { minutes: number | null; label: string | null } | null }>("/vendor/messages")
export const getThread = (id: string) =>
  api<{ thread: SellerThread; messages: ChatMessage[]; quickReplies: string[] }>(`/vendor/messages/${encodeURIComponent(id)}`)
export const sendMessage = (id: string, body: string) => api<{ message: ChatMessage }>(`/vendor/messages/${encodeURIComponent(id)}`, { method: "POST", json: { body } })
export const threadAction = (id: string, action: "block" | "unblock" | "report", reason?: string) =>
  api<{ ok: true }>(`/vendor/messages/${encodeURIComponent(id)}/${action}`, { method: "POST", json: reason ? { reason } : {} })
export const listQuestions = () => api<{ items: SellerQuestion[] }>("/vendor/messages/questions")
export const answerQuestion = (id: string, answer: string) =>
  api<{ question: SellerQuestion }>(`/vendor/messages/questions/${encodeURIComponent(id)}/answer`, { method: "POST", json: { answer } })

// ─── Offers (make an offer) ──────────────────────────────────────────────

export type SellerDeal = {
  id: string
  offerId: string
  productId: string
  productTitle: string | null
  buyerName: string
  qty: number
  listPricePesewas: string
  amountPesewas: string
  counterPesewas: string | null
  agreedPesewas: string | null
  status: "pending" | "countered" | "accepted" | "declined" | "expired" | "used" | "withdrawn"
  respondBy: string | null
  validUntil: string | null
  timeline: { at: string; by: string; note: string }[]
  createdAt: string
}
export const listDeals = () => api<{ items: SellerDeal[]; waitingOnYou: number }>("/vendor/deals")
export const dealAnswer = (id: string, action: "accept" | "decline" | "counter", amountPesewas?: string) =>
  api<{ deal: SellerDeal }>(`/vendor/deals/${encodeURIComponent(id)}/${action}`, { method: "POST", json: amountPesewas ? { amountPesewas } : {} })
export const getNegotiation = (offerIds: string[]) =>
  api<{ settings: Record<string, { negotiable: boolean; floorPesewas: string | null }> }>(`/vendor/deals/settings?offerIds=${encodeURIComponent(offerIds.join(","))}`).then((r) => r.settings)
export const saveNegotiation = (offerId: string, input: { negotiable: boolean; floorPesewas: string | null }) =>
  api<{ settings: { negotiable: boolean; floorPesewas: string | null } }>(`/vendor/deals/settings/${encodeURIComponent(offerId)}`, { method: "PUT", json: input })
