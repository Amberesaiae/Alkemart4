/**
 * Day-to-day operations: orders, sellers, appeals, buyer reviews.
 * Mirrors apps/api/src/routes/admin/{orders,sellers,appeals,reviews}.ts.
 */
import { api } from "./http"

// ─── Orders ─────────────────────────────────────────────────────────────

export type FulfilmentStatus = "placed" | "shipped" | "delivered" | "cancelled"
export type PaymentState = "collect_on_delivery" | "collected" | "paid" | "pending" | "failed"
export type PromiseState = "on_track" | "dispatch_late" | "delivery_late" | "done"

export type AdminSellerOrder = {
  id: string
  sellerId: string
  status: FulfilmentStatus
  subtotalPesewas: string
  deliveryFeePesewas: string
  paymentState: PaymentState
  /** Active hold on this order's payout, if any. */
  payoutHold: { id: string; reason: string; createdAt: string } | null
  promise: { dispatchBy: string | null; deliverEarliest: string | null; deliverLatest: string | null; state: PromiseState }
  timeline: { status: string; at: string; by: string }[]
  items: { id: string; title: string; qty: number; unitPricePesewas: string; productId: string; offerId: string }[]
}

export type AdminOrderGroup = {
  id: string
  buyerEmail: string | null
  totalPesewas: string
  currency: string
  createdAt: string | null
  shippingAddress: {
    first_name: string
    last_name: string
    phone: string
    address_1: string
    address_2?: string
    city: string
    province?: string
    country_code: string
    postal_code?: string
  } | null
  paymentMethod: string | null
  paymentStatus: string | null
  orders: AdminSellerOrder[]
}

export const listOrders = () => api<{ items: AdminOrderGroup[] }>("/admin/orders?limit=200").then((r) => r.items)

// ─── Sellers ────────────────────────────────────────────────────────────

export type SellerStatus = "pending_approval" | "open" | "suspended" | "terminated"

export type SellerDetail = {
  seller: {
    id: string
    handle: string
    name: string
    description: string | null
    logo: string | null
    banner: string | null
    email: string | null
    status: SellerStatus
    created_at: string
    commissionBps: number
    address: { province: string | null; postal_code: string | null } | null
    momo: { provider: string | null; phone: string; recipient: boolean } | null
    members: { id: string; is_owner: boolean; member: { email: string } }[]
  }
  counts: { products: Record<string, number>; orders: Record<string, number>; members: number; partial: boolean }
  recentOrders: { id: string; status: string; subtotalPesewas: string }[]
}

export type Verification = {
  id: string
  sellerId: string
  kind: "contact" | "identity" | "business" | "brand_auth" | "fulfillment_proven"
  status: "pending" | "verified" | "revoked" | "expired"
  evidence: string | null
  /** What the badge tells buyers. */
  meaning: string
  issuedAt: string | null
  expiresAt: string | null
}

export const getSeller = (id: string) => api<SellerDetail>(`/admin/sellers/${encodeURIComponent(id)}`)
const post = <T,>(path: string, json?: unknown) => api<T>(path, { method: "POST", ...(json ? { json } : {}) })
export const approveSeller = (id: string) => post(`/admin/sellers/${encodeURIComponent(id)}/approve`)
export const suspendSeller = (id: string, reason: string) => post(`/admin/sellers/${encodeURIComponent(id)}/suspend`, { reason })
export const unsuspendSeller = (id: string) => post(`/admin/sellers/${encodeURIComponent(id)}/unsuspend`)
export const setCommission = (id: string, commissionBps: number) => post(`/admin/sellers/${encodeURIComponent(id)}/commission`, { commissionBps })
export const listVerifications = (id: string) =>
  api<{ verifications: Verification[] }>(`/admin/sellers/${encodeURIComponent(id)}/verifications`).then((r) => r.verifications)
export const issueVerification = (id: string, input: { kind: Verification["kind"]; evidence?: string | null }) =>
  post(`/admin/sellers/${encodeURIComponent(id)}/verifications`, input)
export const revokeVerification = (id: string, verificationId: string, reason: string) =>
  post(`/admin/sellers/${encodeURIComponent(id)}/verifications/${encodeURIComponent(verificationId)}/revoke`, { reason })

// ─── Appeals ────────────────────────────────────────────────────────────

export type Appeal = {
  id: string
  productId: string
  sellerId: string
  message: string
  status: "open" | "closed"
  createdAt: string
  product: { id: string; title: string; status: string; imageUrl: string | null } | null
  seller: { id: string; name: string; handle: string } | null
}
export const listAppealsFull = () => api<{ appeals: Appeal[] }>("/admin/appeals").then((r) => r.appeals)
export const resolveAppeal = (id: string, decision: "reopen" | "uphold", note: string | null) =>
  post(`/admin/appeals/${encodeURIComponent(id)}/resolve`, { decision, note })

// ─── Buyer reviews ──────────────────────────────────────────────────────

export type BuyerReview = {
  id: string
  orderId: string
  productId: string
  buyerEmail: string | null
  rating: number
  title: string | null
  body: string
  status: string
  createdAt: string
  seller: { id: string; name: string; handle: string } | null
}
export const listBuyerReviews = () => api<{ reviews: BuyerReview[] }>("/admin/reviews").then((r) => r.reviews)
export const moderateReview = (id: string, action: "publish" | "hide") => post(`/admin/reviews/${encodeURIComponent(id)}/moderate`, { action })
