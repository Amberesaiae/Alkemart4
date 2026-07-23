/**
 * Email + SMS on Mercur product moderation events.
 *
 * SMS is the primary channel for Ghana sellers — most check their phones
 * before email. Both channels run in parallel; failures are logged only.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendEmail, productLifecycleEmail } from "../lib/email"
import { sendSms, productPublishedSms, productRejectedSms } from "../lib/sms"
import { logger } from "../lib/logger"

type ProductEvent = {
  id?: string
  product_id?: string
  message?: string
}

async function resolveProductNotify(
  container: SubscriberArgs["container"],
  productId: string,
): Promise<{ title?: string; sellerEmail?: string; sellerPhone?: string } | null> {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "seller.id", "seller.email", "seller.name", "seller.phone"],
      filters: { id: productId },
    })
    const row = (Array.isArray(data) ? data[0] : data) as {
      title?: string
      seller?: { email?: string; phone?: string }
    } | null
    if (!row) return null
    return {
      title: row.title,
      sellerEmail: row.seller?.email,
      sellerPhone: row.seller?.phone,
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
  if (!info?.sellerEmail && !info?.sellerPhone) {
    logger.warn("product.notify_skip_no_contact", { productId, event: event.name })
    return
  }

  const title   = info.title || productId
  const message = event.data?.message

  // Build SMS body based on event
  let smsBody: string | null = null
  if (event.name === "product.published")        smsBody = productPublishedSms({ title })
  else if (event.name === "product.rejected")    smsBody = productRejectedSms({ title, message })
  else if (event.name === "product.change-requested") {
    smsBody = `Alkemart: Changes requested for "${title.slice(0, 40)}".${message ? ` ${message.slice(0, 80)}` : ""} Edit in your Seller Hub.`
  }

  // Run email + SMS in parallel — neither blocks the other
  const tasks: Promise<unknown>[] = []

  if (info.sellerEmail) {
    const msg = productLifecycleEmail({
      to: info.sellerEmail,
      productTitle: title,
      event: event.name,
      message,
    })
    tasks.push(
      sendEmail(msg).then(result => {
        if (!result.ok) logger.error("product.email_failed", { productId, error: result.error })
        else logger.info("product.email_sent", { productId, mode: result.mode })
      }),
    )
  }

  if (info.sellerPhone && smsBody) {
    tasks.push(
      sendSms({ to: info.sellerPhone, body: smsBody }).then(result => {
        if (!result.ok) logger.error("product.sms_failed", { productId, error: result.error })
        else logger.info("product.sms_sent", { productId, mode: result.mode })
      }),
    )
  }

  await Promise.allSettled(tasks)
}

export const config: SubscriberConfig = {
  event: [
    "product.published",
    "product.rejected",
    "product.change-requested",
  ],
}
