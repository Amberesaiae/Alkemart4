/**
 * Payouts & Paystack — mirrors apps/api/src/routes/admin/payouts.ts.
 * A payout is reserved, sent, then settled by Paystack (webhook or Check).
 */
import { api } from "./http"

export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "reversed"

export type AdminPayout = {
  id: string
  sellerId: string
  sellerName?: string | null
  sellerHandle?: string | null
  status: PayoutStatus
  grossPesewas: string
  commissionPesewas: string
  netPesewas: string
  commissionBps: number
  paystackTransferCode: string | null
  paystackReference: string | null
  failureReason: string | null
  paidAt: string | null
  createdBy: string | null
  createdAt: string | null
}

export type PayableSeller = {
  sellerId: string
  sellerName: string
  sellerHandle: string
  orderCount: number
  grossPesewas: string
  commissionPesewas: string
  netPesewas: string
  heldOrders: number
  payoutAccount: { provider: string | null; phoneLast4: string } | null
  /** Why "Pay" is disabled, in words. */
  blocker: string | null
  inFlightPayoutId: string | null
  /** Payable orders (held ones are excluded and listed under holds). */
  orders: { orderId: string; orderGroupId: string; subtotalPesewas: string }[]
}

export type PayoutEvent = { id: string; payoutId: string; status: string; actor: string; detail: string | null; createdAt: string }
export type PayoutDetail = {
  payout: AdminPayout
  lines: { orderId: string; grossPesewas: string; commissionPesewas: string; netPesewas: string }[]
  events: PayoutEvent[]
}
export type PayResult = { payout: AdminPayout; outcome?: "paid" | "sent" | "failed" | "unknown" | "otp"; message?: string; replayed?: boolean }

export type PaystackEvent = {
  id: string
  event: string
  reference: string | null
  amountMinor: string | null
  currency: string | null
  status: string | null
  outcome: string
  detail: string | null
  receivedAt: string
  alert: string | null
}

export type Hold = {
  id: string
  sellerId: string
  orderId: string | null
  amountPesewas: string | null
  reason: string
  status: "held" | "released"
  createdBy: string | null
  releasedBy: string | null
  releasedAt: string | null
  createdAt: string
}

export const listPayable = () => api<{ sellers: PayableSeller[] }>("/admin/payouts/payable").then((r) => r.sellers)
export const listPayouts = () => api<{ payouts: AdminPayout[] }>("/admin/payouts?limit=200").then((r) => r.payouts)
export const getPayout = (id: string) => api<PayoutDetail>(`/admin/payouts/${encodeURIComponent(id)}`)
export const payNow = (sellerId: string) => api<PayResult>("/admin/payouts", { method: "POST", json: { sellerId } })
export type PayRunResult = { sellerId: string; sellerName: string; outcome: "paid" | "sent" | "failed" | "unknown" | "otp" | "skipped"; netPesewas: string | null; message: string }
/** Pay every seller whose money is released (skips holds, missing accounts, payouts on their way). */
export const payEveryone = () => api<{ results: PayRunResult[] }>("/admin/payouts/run", { method: "POST" }).then((r) => r.results)
export const checkPayout = (id: string) =>
  api<{ payout: AdminPayout; paystackStatus: string; message?: string }>(`/admin/payouts/${encodeURIComponent(id)}/check`, { method: "POST" })
export const retryPayout = (id: string) => api<PayResult>(`/admin/payouts/${encodeURIComponent(id)}/retry`, { method: "POST" })
export const listPaystackEvents = () => api<{ events: PaystackEvent[] }>("/admin/payouts/paystack-events").then((r) => r.events)
export const refundPayment = (reference: string) =>
  api<{ refund: { status: string } }>("/admin/payouts/refunds", { method: "POST", json: { reference } })

export const listHolds = (sellerId: string) =>
  api<{ holds: Hold[] }>(`/admin/payouts/holds?seller_id=${encodeURIComponent(sellerId)}&all=1`).then((r) => r.holds)
export const createHold = (input: { sellerId: string; orderId?: string | null; reason: string }) =>
  api<{ hold: Hold }>("/admin/payouts/holds", { method: "POST", json: input })
export const releaseHold = (id: string) => api<{ hold: Hold }>(`/admin/payouts/holds/${encodeURIComponent(id)}/release`, { method: "POST" })
