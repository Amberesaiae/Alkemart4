/**
 * Email on Mercur product moderation events.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendEmail, productLifecycleEmail } from "../lib/email"
import { logger } from "../lib/logger"

type ProductEvent = {
  id?: string
  product_id?: string
  message?: string
}

async function resolveProductNotify(
  container: SubscriberArgs["container"],
  productId: string,
): Promise<{ title?: string; sellerEmail?: string } | null> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "seller.id", "seller.email", "seller.name"],
      filters: { id: productId },
    })
    const row = (Array.isArray(data) ? data[0] : data) as {
      title?: string
      seller?: { email?: string }
    } | null
    if (!row) return null
    return {
      title: row.title,
      sellerEmail: row.seller?.email,
    }
  } catch {
    return null
  }
}

export default async function productLifecycleNotify({
  event,
  container,
}: SubscriberArgs<ProductEvent>) {
  const productId = event.data?.id || event.data?.product_id
  if (!productId) return

  const info = await resolveProductNotify(container, productId)
  if (!info?.sellerEmail) {
    logger.warn("product.notify_skip_no_email", {
      productId,
      event: event.name,
    })
    return
  }

  const msg = productLifecycleEmail({
    to: info.sellerEmail,
    productTitle: info.title || productId,
    event: event.name,
    message: event.data?.message,
  })

  const result = await sendEmail(msg)
  if (!result.ok) {
    logger.error("product.notify_failed", {
      productId,
      event: event.name,
      error: result.error,
    })
  } else {
    logger.info("product.notify_sent", {
      productId,
      event: event.name,
      mode: result.mode,
    })
  }
}

export const config: SubscriberConfig = {
  event: [
    "product.published",
    "product.rejected",
    "product.change-requested",
  ],
}
