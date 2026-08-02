/**
 * Process one seller's images: download logo & banner, generate webp
 * thumb + web derivatives (sharp), upload via the FILE module (R2), and
 * persist URLs under seller.metadata.alkemart.media.{logo|banner}.
 *
 * Mirrors src/lib/media/process-product-images.ts — same primitives,
 * applied to seller identity images so the public storefront never serves
 * raw multi-megabyte covers.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processImageBuffer } from "./derivatives"
import type { SellerImageMeta } from "./derivatives"
import { logger } from "../logger"
import { asList } from "../graph-utils"

type QueryService = {
  graph: (args: unknown) => Promise<{ data: unknown }>
}

type SellerRow = {
  id: string
  logo?: string | null
  banner?: string | null
  metadata?: Record<string, unknown> | null
}

type FileModule = {
  createFiles?: (files: Array<{
    filename: string
    mimeType: string
    content: string
    access?: string
  }>) => Promise<Array<{ url?: string }>>
}

type SellerService = {
  updateSellers: (data: {
    id: string
    metadata?: Record<string, unknown>
  }) => Promise<unknown>
}

type ProcessResult = { ok: boolean; processed: string[]; skipped: string[]; failed: string[] }

export async function processSellerImages(
  container: MedusaContainer,
  sellerId: string,
): Promise<ProcessResult> {
  const query = container.resolve(
    ContainerRegistrationKeys.QUERY,
  ) as QueryService

  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "logo", "banner", "metadata"],
    filters: { id: sellerId },
  })
  const seller = asList(data)[0] as SellerRow | undefined
  if (!seller?.id) {
    return { ok: false, processed: [], skipped: [], failed: [String(sellerId)] }
  }

  const meta = seller.metadata || {}
  const alk =
    meta.alkemart && typeof meta.alkemart === "object"
      ? { ...(meta.alkemart as Record<string, unknown>) }
      : {}
  const media = (alk.media as Record<string, unknown>) || {}
  const updatedMedia: Record<string, unknown> = { ...media }

  const fileModule = container.resolve(Modules.FILE) as FileModule
  const sellerModule = container.resolve("seller") as SellerService

  const result: ProcessResult = {
    ok: true,
    processed: [],
    skipped: [],
    failed: [],
  }

  const images: Array<{ key: "logo" | "banner"; url?: string | null }> = [
    { key: "logo", url: seller.logo },
    { key: "banner", url: seller.banner },
  ]

  for (const { key, url } of images) {
    if (!url) continue

    const current = (updatedMedia[key] as SellerImageMeta) || {}
    const status = current.derivatives_status
    // Already derived (or explicitly skipped/failed) — leave alone.
    if (status === "ready" || status === "skipped" || status === "failed") {
      result.skipped.push(`${seller.id}:${key}`)
      continue
    }

    const buf = await fetchBinary(url)
    if (!buf?.length) {
      result.failed.push(`${seller.id}:${key}:download`)
      updatedMedia[key] = { ...current, derivatives_status: "failed", derivatives_error: "download_failed" }
      continue
    }

    const processed = await processImageBuffer(buf)
    if (!processed.ok) {
      updatedMedia[key] = {
        ...current,
        derivatives_status: processed.sharpMissing ? "skipped" : "failed",
        derivatives_error: processed.error,
        derivatives_at: new Date().toISOString(),
      }
      if (processed.sharpMissing) result.skipped.push(`${seller.id}:${key}`)
      else result.failed.push(`${seller.id}:${key}:process`)
      continue
    }

    // Upload derivatives via FILE module (R2) when available.
    let thumbUrl: string | undefined
    let webUrl: string | undefined
    try {
      if (typeof fileModule.createFiles === "function") {
        for (const d of processed.derivatives) {
          const [uploaded] = await fileModule.createFiles([
            {
              filename: `${seller.id}-${key}${d.filenameSuffix}`,
              mimeType: d.contentType,
              content: d.buffer.toString("base64"),
              access: "public",
            },
          ])
          if (d.kind === "thumb") thumbUrl = uploaded?.url
          if (d.kind === "web") webUrl = uploaded?.url
        }
      }
    } catch (e) {
      logger.warn("media.seller_upload_failed", {
        sellerId: seller.id,
        key,
        error: e instanceof Error ? e.message : e,
      })
    }

    updatedMedia[key] = {
      thumb_url: thumbUrl,
      web_url: webUrl,
      derivatives_status: "ready",
      derivatives_at: new Date().toISOString(),
      source_width: processed.source.width,
      source_height: processed.source.height,
    }
    result.processed.push(`${seller.id}:${key}`)
  }

  if (result.processed.length > 0) {
    alk.media = updatedMedia
    try {
      await sellerModule.updateSellers({ id: seller.id, metadata: { ...meta, alkemart: alk } })
      logger.info("media.seller_derivatives_ready", {
        sellerId: seller.id,
        processed: result.processed,
      })
    } catch (e) {
      logger.warn("media.seller_meta_update_failed", {
        sellerId: seller.id,
        error: e instanceof Error ? e.message : e,
      })
      result.ok = false
      return result
    }
  }

  return result
}

/** Reuse the binary fetch helper used by product image processing. */
async function fetchBinary(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}
