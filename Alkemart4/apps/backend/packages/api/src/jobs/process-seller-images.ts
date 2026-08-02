/**
 * Scheduled: process seller logo / banner image derivatives (webp thumb + web).
 * Cron every 5 minutes. No-op when sharp missing (derivatives marked skipped).
 * Mirrors src/jobs/process-product-images.ts but for seller identity images.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { processSellerImages } from "../lib/media/process-seller-images"
import { logger } from "../lib/logger"
import { asList } from "../lib/graph-utils"

type QueryService = {
  graph: (args: unknown) => Promise<{ data: unknown }>
}

type SellerRow = {
  id: string
  logo?: string | null
  banner?: string | null
  metadata?: Record<string, unknown> | null
}

export default async function processSellerImagesJob(
  container: MedusaContainer,
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryService

  let candidates: string[] = []
  try {
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "logo", "banner", "metadata"],
      filters: { status: "open" },
    })
    const rows = asList(data) as SellerRow[]
    for (const s of rows) {
      if (!s?.id) continue
      if (!s.logo && !s.banner) continue
      const meta = s.metadata || {}
      const alk = (meta.alkemart as Record<string, unknown>) || {}
      const media = (alk.media as Record<string, unknown>) || {}
      const logoStatus = (media.logo as { derivatives_status?: string })?.derivatives_status
      const bannerStatus = (media.banner as { derivatives_status?: string })?.derivatives_status
      const logoPending =
        s.logo && !["ready", "skipped", "failed"].includes(logoStatus || "")
      const bannerPending =
        s.banner && !["ready", "skipped", "failed"].includes(bannerStatus || "")
      if (logoPending || bannerPending) {
        candidates.push(s.id)
      }
    }
  } catch (e) {
    logger.warn("media.seller_job_list_failed", {
      error: e instanceof Error ? e.message : e,
    })
    return
  }

  candidates = candidates.slice(0, 25)
  if (!candidates.length) return

  let processed = 0
  let failed = 0
  for (const id of candidates) {
    const result = await processSellerImages(container, id)
    if (result.ok) processed += 1
    else failed += 1
    logger.info("media.seller_job_item", { sellerId: id, result: result.processed })
  }
  logger.info("media.seller_job_batch", { processed, failed, total: candidates.length })
}

export const config = {
  name: "alkemart-process-seller-images",
  schedule: "*/5 * * * *",
}
