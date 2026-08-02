/**
 * Mark seller logo / banner derivatives as pending when a seller with images
 * is created or updated. The cron job (process-seller-images) picks up
 * pending rows. Mirrors src/subscribers/product-media-pending.ts.
 *
 * Best-effort: never throws into the event bus; TTL/no-op path when
 * the seller module update fails.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { markSellerMediaPending, readSellerImageMeta } from "../lib/media/derivatives"
import { logger } from "../lib/logger"

type SellerRow = {
  id: string
  logo?: string | null
  banner?: string | null
  metadata?: Record<string, unknown> | null
}

type SellerService = {
  updateSellers: (data: { id: string; metadata?: Record<string, unknown> }) => Promise<unknown>
}

export default async function sellerMediaPending({
  event,
  container,
}: SubscriberArgs<{ id?: string | null }>) {
  const id = event?.data?.id
  if (!id) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "logo", "banner", "metadata"],
      filters: { id },
    })
    const list = Array.isArray(data) ? data : data ? [data] : []
    const seller = list[0] as SellerRow | undefined
    if (!seller?.id) return

    if (!seller.logo && !seller.banner) return

    const meta = seller.metadata || {}
    const { logo, banner } = readSellerImageMeta(meta)
    const logoReady = ["ready", "skipped", "failed"].includes(logo.derivatives_status || "")
    const bannerReady = ["ready", "skipped", "failed"].includes(banner.derivatives_status || "")

    let next: Record<string, unknown> | null = null
    if (seller.logo && !logoReady) {
      next = markSellerMediaPending(next ?? meta, "logo")
    }
    if (seller.banner && !bannerReady) {
      next = markSellerMediaPending(next ?? meta, "banner")
    }
    if (!next) return

    const sellerModule = container.resolve("seller") as SellerService
    await sellerModule.updateSellers({ id: seller.id, metadata: next as Record<string, unknown> })
  } catch (e) {
    logger.warn("[seller-media-pending] failed", {
      sellerId: id,
      error: e instanceof Error ? e.message : e,
    })
  }
}

export const config: SubscriberConfig = {
  event: ["seller.updated", "seller.created"],
}
