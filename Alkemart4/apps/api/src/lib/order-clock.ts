import { promiseStatus } from "@alkemart/domain"
import type { OrderEventRow, OrderRow } from "../checkout-repository"

/**
 * One description of an order's clock for every audience: the frozen
 * promise, where the order stands against it, and the dated timeline.
 * Actor ids never leave the server; the role is enough for any UI.
 */
export function orderClock(order: OrderRow, events: OrderEventRow[], now = new Date()) {
  const mine = events.filter((e) => e.orderId === order.id).sort((a, b) => a.at.getTime() - b.at.getTime())
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
  return {
    promise: {
      dispatchBy: iso(order.dispatchBy),
      deliverEarliest: iso(order.deliverEarliest),
      deliverLatest: iso(order.deliverLatest),
      state: promiseStatus(
        order.status,
        { dispatchBy: order.dispatchBy ?? null, deliverLatest: order.deliverLatest ?? null },
        now,
      ),
    },
    timeline: mine.map((e) => ({ status: e.status, at: e.at.toISOString(), by: e.actor })),
  }
}

/**
 * Payment truth for display. Pay-on-delivery is never "paid" until the order
 * is delivered (the rider collects), whatever the intent row says.
 */
export function paymentState(
  method: string | null | undefined,
  intentStatus: string | null | undefined,
  fulfilment: "placed" | "shipped" | "delivered" | "cancelled" | string,
): "collect_on_delivery" | "collected" | "paid" | "pending" | "failed" {
  if (method === "cod") return fulfilment === "delivered" ? "collected" : "collect_on_delivery"
  if (intentStatus === "succeeded" || intentStatus === "completed") return "paid"
  if (intentStatus === "failed" || intentStatus === "expired") return "failed"
  return "pending"
}
