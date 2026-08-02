/**
 * SMS + WhatsApp notifications for return lifecycle events.
 *
 * Events handled:
 *   order.return_requested  → vendor SMS (return requested) + admin WhatsApp
 *   order.return_approved   → buyer SMS (return approved by admin)
 *   order.return_rejected   → buyer SMS (return rejected with reason)
 *
 * Design: never throws — failures are logged only (same pattern as order-lifecycle-notify).
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendSms } from "../lib/sms"
import { sendWhatsAppTemplate } from "../lib/whatsapp"
import { logger } from "../lib/logger"

type ReturnEvent = {
  id?: string
  return_id?: string
  order_id?: string
  reason?: string
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

async function resolveReturnContext(
  container: SubscriberArgs["container"],
  returnId: string,
): Promise<{
  order_id: string | null
  display_id: number | null
  buyer_phone: string | null
  buyer_name: string | null
  vendor_phone: string | null
  vendor_name: string | null
} | null> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }

    const { data } = await query.graph({
      entity: "return",
      fields: [
        "id", "order_id",
        "order.display_id",
        "order.customer.first_name", "order.customer.last_name", "order.customer.phone",
        "order.shipping_address.phone", "order.shipping_address.first_name",
        "order.seller.name", "order.seller.phone",
      ],
      filters: { id: returnId },
    })

    const ret = (Array.isArray(data) ? data[0] : data) as {
      order_id?: string
      order?: {
        display_id?: number
        customer?: { first_name?: string; last_name?: string; phone?: string }
        shipping_address?: { first_name?: string; phone?: string }
        seller?: { name?: string; phone?: string }
      }
    } | null

    if (!ret) return null

    const order = ret.order
    return {
      order_id: ret.order_id || null,
      display_id: order?.display_id ?? null,
      buyer_phone:
        order?.shipping_address?.phone?.trim() ||
        order?.customer?.phone?.trim() ||
        null,
      buyer_name:
        order?.shipping_address?.first_name ||
        order?.customer?.first_name ||
        "Customer",
      vendor_phone: order?.seller?.phone?.trim() || null,
      vendor_name: order?.seller?.name || "your shop",
    }
  } catch (e) {
    logger.warn("[return-notify] resolveReturnContext failed", {
      returnId,
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

function orderId(id: number | string | null): string {
  return String(id || "").slice(-8).toUpperCase() || "N/A"
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleReturnRequested(
  container: SubscriberArgs["container"],
  returnId: string,
): Promise<void> {
  const ctx = await resolveReturnContext(container, returnId)
  if (!ctx) return

  const displayId = orderId(ctx.display_id)

  // Vendor SMS — most important: they need to know immediately
  if (ctx.vendor_phone) {
    await sendSms({
      to: ctx.vendor_phone,
      body: `Alkemart: A return was requested on order #${displayId}. Log in to your Seller Hub to review it.`,
    }).catch((e) =>
      logger.warn("[return-notify] vendor sms failed", { error: e?.message }),
    )
  }

  // Admin WhatsApp alert (admin phone from env, fallback to log-only)
  const adminPhone = process.env.ADMIN_ALERT_PHONE
  if (adminPhone) {
    await sendWhatsAppTemplate({
      to: adminPhone,
      templateName: "alkemart_return_requested",
      bodyParams: [displayId, ctx.vendor_name],
    }).catch((e) =>
      logger.warn("[return-notify] admin wa failed", { error: e?.message }),
    )
  }

  logger.info("return.notify_requested", {
    returnId,
    order_id: ctx.order_id,
    vendor_notified: !!ctx.vendor_phone,
    admin_notified: !!adminPhone,
  })
}

async function handleReturnApproved(
  container: SubscriberArgs["container"],
  returnId: string,
): Promise<void> {
  const ctx = await resolveReturnContext(container, returnId)
  if (!ctx) return

  const displayId = orderId(ctx.display_id)

  if (ctx.buyer_phone) {
    await sendSms({
      to: ctx.buyer_phone,
      body: `Alkemart: Your return for order #${displayId} has been approved. A refund will be processed shortly.`,
    }).catch((e) =>
      logger.warn("[return-notify] buyer approved sms failed", { error: e?.message }),
    )
  }

  logger.info("return.notify_approved", {
    returnId,
    buyer_notified: !!ctx.buyer_phone,
  })
}

async function handleReturnRejected(
  container: SubscriberArgs["container"],
  returnId: string,
  reason?: string,
): Promise<void> {
  const ctx = await resolveReturnContext(container, returnId)
  if (!ctx) return

  const displayId = orderId(ctx.display_id)
  const reasonNote = reason ? ` Reason: ${reason.slice(0, 60)}` : ""

  if (ctx.buyer_phone) {
    await sendSms({
      to: ctx.buyer_phone,
      body: `Alkemart: Your return request for order #${displayId} was not approved.${reasonNote} Contact support for help.`,
    }).catch((e) =>
      logger.warn("[return-notify] buyer rejected sms failed", { error: e?.message }),
    )
  }

  logger.info("return.notify_rejected", {
    returnId,
    buyer_notified: !!ctx.buyer_phone,
  })
}

// ---------------------------------------------------------------------------
// Subscriber entry point
// ---------------------------------------------------------------------------

export default async function returnLifecycleNotify({
  event,
  container,
}: SubscriberArgs<ReturnEvent>) {
  const returnId = event.data?.id || event.data?.return_id
  if (!returnId) {
    logger.warn("return.notify_no_id", { event: event.name })
    return
  }

  switch (event.name) {
    case "order.return_requested":
      await handleReturnRequested(container, returnId)
      break
    case "order.return_approved":
      await handleReturnApproved(container, returnId)
      break
    case "order.return_rejected":
      await handleReturnRejected(container, returnId, event.data?.reason)
      break
    default:
      break
  }
}

export const config: SubscriberConfig = {
  event: [
    "order.return_requested",
    "order.return_approved",
    "order.return_rejected",
  ],
}
