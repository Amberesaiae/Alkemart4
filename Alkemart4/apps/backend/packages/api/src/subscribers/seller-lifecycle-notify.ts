/**
 * Email + SMS on Mercur seller lifecycle events (approve / suspend / …).
 *
 * Approval SMS is the most critical touchpoint — sellers in Ghana
 * may not check email promptly. SMS fires immediately.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendEmail, sellerLifecycleEmail } from "../lib/email"
import { sendSms, sellerApprovedSms } from "../lib/sms"
import { sendWhatsAppTemplate, waSellerApproved } from "../lib/whatsapp"
import { logger } from "../lib/logger"

type SellerEvent = {
  id?: string
  seller_id?: string
}

async function resolveSeller(
  container: SubscriberArgs["container"],
  id: string,
): Promise<{ email?: string; name?: string; phone?: string; status_reason?: string } | null> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "email", "name", "phone", "status_reason"],
      filters: { id },
    })
    const row = Array.isArray(data) ? data[0] : data
    return (row as { email?: string; name?: string; phone?: string; status_reason?: string }) || null
  } catch {
    return null
  }
}

export default async function sellerLifecycleNotify({
  event,
  container,
}: SubscriberArgs<SellerEvent>) {
  const sellerId = event.data?.id || event.data?.seller_id
  if (!sellerId) return

  const seller = await resolveSeller(container, sellerId)
  if (!seller?.email && !seller?.phone) {
    logger.warn("seller.notify_skip_no_contact", { sellerId, event: event.name })
    return
  }

  const shopName = seller.name || "your shop"
  const tasks: Promise<unknown>[] = []

  // Email (all events)
  if (seller.email) {
    const msg = sellerLifecycleEmail({
      to: seller.email,
      shopName,
      event: event.name,
      reason: seller.status_reason,
    })
    tasks.push(
      sendEmail(msg).then(result => {
        if (!result.ok) logger.error("seller.email_failed", { sellerId, error: result.error })
        else logger.info("seller.email_sent", { sellerId, mode: result.mode })
      }),
    )
  }

  // SMS + WhatsApp — high-priority for approval; SMS-only for suspensions
  if (seller.phone) {
    if (event.name === "seller.approved") {
      tasks.push(
        sendSms({ to: seller.phone, body: sellerApprovedSms({ shopName }) }).then(r => {
          logger.info("seller.sms_sent", { sellerId, ok: r.ok })
        }),
        sendWhatsAppTemplate(waSellerApproved({ vendorPhone: seller.phone!, shopName })).then(r => {
          logger.info("seller.wa_sent", { sellerId, ok: r.ok })
        }),
      )
    } else if (event.name === "seller.suspended" || event.name === "seller.terminated") {
      const reasonLine = seller.status_reason ? ` Reason: ${seller.status_reason.slice(0, 80)}` : ""
      const body =
        event.name === "seller.suspended"
          ? `Alkemart: Your shop "${shopName}" has been suspended.${reasonLine} Contact support at alkemart.com/help`
          : `Alkemart: Your shop "${shopName}" has been closed.${reasonLine}`
      tasks.push(
        sendSms({ to: seller.phone, body }).then(r => {
          logger.info("seller.sms_sent", { sellerId, ok: r.ok })
        }),
      )
    } else if (event.name === "seller.unsuspended") {
      tasks.push(
        sendSms({
          to: seller.phone,
          body: `Alkemart: Great news! Your shop "${shopName}" has been reinstated. You can list and sell again.`,
        }).then(r => { logger.info("seller.sms_sent", { sellerId, ok: r.ok }) }),
      )
    }
  }

  await Promise.allSettled(tasks)
}

export const config: SubscriberConfig = {
  event: [
    "seller.approved",
    "seller.suspended",
    "seller.unsuspended",
    "seller.terminated",
  ],
}
