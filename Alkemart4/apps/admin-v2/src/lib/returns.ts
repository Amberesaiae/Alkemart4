/** Returns & disputes — mirrors apps/api/src/routes/admin/returns.ts. Amounts are minor-unit strings. */
import type { ConsoleReturnCase } from "@workspace/console-ui/components/console/return-case"
import { api } from "./http"

export type ReturnView = "decide" | "open" | "refunds" | "closed"

export type AdminReturnCase = ConsoleReturnCase & {
  orderId: string
  sellerId: string
  sellerName: string | null
  buyerEmail: string
  orderReference?: string | null
  createdAt: string
  closedAt: string | null
}

export type AdminReturnDetail = AdminReturnCase & {
  order: {
    id: string
    orderGroupId: string
    reference: string
    status: string
    placedAt: string | null
    deliveredAt: string | null
    deliveryConfirmedBy: "buyer_code" | "buyer" | "seller" | null
    fulfillmentMethod: "delivery" | "pickup"
    paymentMethod: string | null
    subtotalPesewas: string
    deliveryFeePesewas: string
    refundedPesewas: string
    paidOut: boolean
    items: { title: string; qty: number; unitPricePesewas: string }[]
  } | null
}

export const listReturns = (view: ReturnView) =>
  api<{ view: ReturnView; counts: Record<ReturnView, number>; items: AdminReturnCase[] }>(`/admin/returns?view=${view}`)

export const getReturn = (id: string) => api<{ returnCase: AdminReturnDetail }>(`/admin/returns/${encodeURIComponent(id)}`).then((r) => r.returnCase)

export const decideReturn = (id: string, input: { outcome: "refund" | "declined"; note: string }) =>
  api<{ returnCase: AdminReturnDetail }>(`/admin/returns/${encodeURIComponent(id)}/decide`, { method: "POST", json: input }).then((r) => r.returnCase)

export const retryRefund = (id: string) =>
  api<{ returnCase: AdminReturnDetail }>(`/admin/returns/${encodeURIComponent(id)}/retry-refund`, { method: "POST" }).then((r) => r.returnCase)
