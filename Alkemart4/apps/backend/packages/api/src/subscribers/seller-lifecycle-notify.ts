/**
 * Email on Mercur seller lifecycle events (approve / suspend / …).
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendEmail, sellerLifecycleEmail } from "../lib/email"
import { logger } from "../lib/logger"

type SellerEvent = {
  id?: string
  seller_id?: string
}

async function resolveSeller(
  container: SubscriberArgs["container"],
  id: string,
): Promise<{ email?: string; name?: string; status_reason?: string } | null> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "email", "name", "status_reason"],
      filters: { id },
    })
    const row = Array.isArray(data) ? data[0] : data
    return (row as { email?: string; name?: string; status_reason?: string }) || null
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
  if (!seller?.email) {
    logger.warn("seller.notify_skip_no_email", { sellerId, event: event.name })
    return
  }

  const msg = sellerLifecycleEmail({
    to: seller.email,
    shopName: seller.name || "your shop",
    event: event.name,
    reason: seller.status_reason,
  })

  const result = await sendEmail(msg)
  if (!result.ok) {
    logger.error("seller.notify_failed", {
      sellerId,
      event: event.name,
      error: result.error,
    })
  } else {
    logger.info("seller.notify_sent", {
      sellerId,
      event: event.name,
      mode: result.mode,
    })
  }
}

export const config: SubscriberConfig = {
  event: [
    "seller.approved",
    "seller.suspended",
    "seller.unsuspended",
    "seller.terminated",
  ],
}
