/**
 * SMS + WhatsApp + Email notifications for order lifecycle events.
 *
 * Events handled:
 *   order.placed          → buyer SMS/WA (confirmed) + vendor SMS/WA (new order)
 *   order.fulfillment_shipped  → buyer SMS (shipped)
 *   order.fulfillment_delivered → buyer SMS (delivered)
 *   order.canceled        → buyer SMS (canceled)
 *
 * Design principles:
 *   - Never throw — failures are logged, not propagated
 *   - SMS is primary channel for Ghana (high open rate, no smartphone required)
 *   - WhatsApp is sent in parallel when WA_PHONE_NUMBER_ID is configured
 *   - Email is tertiary (low open rate in GH but useful for receipts)
 *   - Resolve buyer + vendor phone from Medusa query graph
 */

import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendSms, orderConfirmedSms, orderShippedSms, orderDeliveredSms, newOrderVendorSms } from "../lib/sms"
import { sendWhatsAppTemplate, waOrderConfirmed, waOrderShipped, waNewOrderVendor } from "../lib/whatsapp"
import { logger } from "../lib/logger"

type OrderEvent = {
  id?: string
  order_id?: string
}

type OrderRow = {
  id: string
  display_id?: number
  status?: string
  currency_code?: string
  total?: number
  customer?: { first_name?: string; last_name?: string; email?: string; phone?: string }
  shipping_address?: { phone?: string; first_name?: string }
  items?: { id: string; quantity: number }[]
  seller?: { id: string; name?: string; email?: string; phone?: string }
}

async function resolveOrder(
  container: SubscriberArgs["container"],
  orderId: string,
): Promise<OrderRow | null> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "status", "currency_code", "total",
        "customer.first_name", "customer.last_name", "customer.email", "customer.phone",
        "shipping_address.phone", "shipping_address.first_name",
        "items.id", "items.quantity",
        "seller.id", "seller.name", "seller.email", "seller.phone",
      ],
      filters: { id: orderId },
    })
    const row = (Array.isArray(data) ? data[0] : data) as OrderRow | null
    return row ?? null
  } catch (e) {
    logger.warn("order.notify_resolve_failed", {
      orderId,
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

function formatTotal(order: OrderRow): string {
  if (!order.total) return ""
  const symbol = order.currency_code?.toLowerCase() === "ghs" ? "GH₵" : (order.currency_code?.toUpperCase() ?? "")
  return `${symbol} ${(order.total / 100).toFixed(2)}`
}

function buyerPhone(order: OrderRow): string | null {
  // Prefer shipping address phone (most accurate for delivery), fall back to account phone
  return (
    order.shipping_address?.phone?.trim() ||
    order.customer?.phone?.trim() ||
    null
  )
}

function buyerName(order: OrderRow): string {
  return (
    order.shipping_address?.first_name ||
    order.customer?.first_name ||
    "customer"
  )
}

// ---------------------------------------------------------------------------
// order.placed
// ---------------------------------------------------------------------------

async function handleOrderPlaced(
  container: SubscriberArgs["container"],
  orderId: string,
): Promise<void> {
  const order = await resolveOrder(container, orderId)
  if (!order) return

  const phone  = buyerPhone(order)
  const name   = buyerName(order)
  const total  = formatTotal(order)
  const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0

  // --- Buyer notifications ---
  if (phone) {
    const [smsResult, waResult] = await Promise.allSettled([
      sendSms({ to: phone, body: orderConfirmedSms({ buyerName: name, orderId, total }) }),
      sendWhatsAppTemplate(waOrderConfirmed({ buyerPhone: phone, buyerName: name, orderId, total })),
    ])
    logger.info("order.notify_buyer_placed", {
      orderId,
      sms: smsResult.status === "fulfilled" ? smsResult.value.ok : "rejected",
      wa:  waResult.status  === "fulfilled" ? waResult.value.ok  : "rejected",
    })
  } else {
    logger.warn("order.notify_no_buyer_phone", { orderId })
  }

  // --- Vendor notifications ---
  const vendorPhone = order.seller?.phone?.trim()
  const shopName    = order.seller?.name || "your shop"
  if (vendorPhone) {
    const [smsResult, waResult] = await Promise.allSettled([
      sendSms({ to: vendorPhone, body: newOrderVendorSms({ shopName, orderId, items: itemCount }) }),
      sendWhatsAppTemplate(waNewOrderVendor({ vendorPhone, shopName, orderId, items: itemCount })),
    ])
    logger.info("order.notify_vendor_placed", {
      orderId,
      sms: smsResult.status === "fulfilled" ? smsResult.value.ok : "rejected",
      wa:  waResult.status  === "fulfilled" ? waResult.value.ok  : "rejected",
    })
  }
}

// ---------------------------------------------------------------------------
// order.fulfillment_shipped
// ---------------------------------------------------------------------------

async function handleOrderShipped(
  container: SubscriberArgs["container"],
  orderId: string,
): Promise<void> {
  const order = await resolveOrder(container, orderId)
  if (!order) return

  const phone = buyerPhone(order)
  if (!phone) return

  const [smsResult, waResult] = await Promise.allSettled([
    sendSms({ to: phone, body: orderShippedSms({ buyerName: buyerName(order), orderId }) }),
    sendWhatsAppTemplate(waOrderShipped({ buyerPhone: phone, orderId })),
  ])
  logger.info("order.notify_shipped", {
    orderId,
    sms: smsResult.status === "fulfilled" ? smsResult.value.ok : "rejected",
    wa:  waResult.status  === "fulfilled" ? waResult.value.ok  : "rejected",
  })
}

// ---------------------------------------------------------------------------
// order.fulfillment_delivered
// ---------------------------------------------------------------------------

async function handleOrderDelivered(
  container: SubscriberArgs["container"],
  orderId: string,
): Promise<void> {
  const order = await resolveOrder(container, orderId)
  if (!order) return

  const phone = buyerPhone(order)
  if (!phone) return

  const result = await sendSms({
    to: phone,
    body: orderDeliveredSms({ buyerName: buyerName(order), orderId }),
  })
  logger.info("order.notify_delivered", { orderId, sms: result.ok })
}

// ---------------------------------------------------------------------------
// order.canceled
// ---------------------------------------------------------------------------

async function handleOrderCanceled(
  container: SubscriberArgs["container"],
  orderId: string,
): Promise<void> {
  const order = await resolveOrder(container, orderId)
  if (!order) return

  const phone = buyerPhone(order)
  if (!phone) return

  await sendSms({
    to: phone,
    body: `Alkemart: Order #${orderId.slice(-8).toUpperCase()} was canceled. Contact support at alkemart.com/help if you have questions.`,
  })
}

// ---------------------------------------------------------------------------
// Main subscriber
// ---------------------------------------------------------------------------

export default async function orderLifecycleNotify({
  event,
  container,
}: SubscriberArgs<OrderEvent>) {
  const orderId = event.data?.id || event.data?.order_id
  if (!orderId) return

  try {
    switch (event.name) {
      case "order.placed":
        await handleOrderPlaced(container, orderId)
        break
      case "order.fulfillment_shipped":
        await handleOrderShipped(container, orderId)
        break
      case "order.fulfillment_delivered":
        await handleOrderDelivered(container, orderId)
        break
      case "order.canceled":
        await handleOrderCanceled(container, orderId)
        break
    }
  } catch (e) {
    // Must never crash the event bus
    logger.error("order.notify_unhandled", {
      event: event.name,
      orderId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "order.fulfillment_shipped",
    "order.fulfillment_delivered",
    "order.canceled",
  ],
}
