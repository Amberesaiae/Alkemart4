/**
 * Scheduled: process product images pending derivatives (webp thumb + web).
 * Cron every 5 minutes. No-op when sharp missing (status=skipped).
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { processProductImages } from "../lib/media/process-product-images"
import { logger } from "../lib/logger"

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

export default async function processProductImagesJob(
  container: MedusaContainer,
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  // Prefer products with pending flag; also pick recent published/proposed with images
  let candidates: string[] = []
  try {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "thumbnail", "metadata", "status", "updated_at"],
    })
    const rows = asList(data)
    for (const p of rows) {
      const id = typeof p.id === "string" ? p.id : ""
      if (!id) continue
      const meta = (p.metadata as Record<string, unknown>) || {}
      const alk = (meta.alkemart as Record<string, unknown>) || {}
      const media = (alk.media as Record<string, unknown>) || {}
      const status = String(media.derivatives_status || "")
      if (status === "ready" || status === "skipped" || status === "failed") {
        continue
      }
      // pending or never processed with a thumbnail
      if (status === "pending" || (p.thumbnail && !status)) {
        candidates.push(id)
      }
    }
  } catch (e) {
    logger.warn("media.job_list_failed", {
      error: e instanceof Error ? e.message : String(e),
    })
    return
  }

  // Cap batch size
  candidates = candidates.slice(0, 25)
  if (!candidates.length) return

  let ok = 0
  let fail = 0
  for (const id of candidates) {
    const result = await processProductImages(container, id)
    if (result.ok) ok += 1
    else fail += 1
  }
  logger.info("media.job_batch", { ok, fail, total: candidates.length })
}

export const config = {
  name: "alkemart-process-product-images",
  schedule: "*/5 * * * *",
}
