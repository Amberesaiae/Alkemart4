/**
 * Process one product's images: download thumbnail, generate derivatives, upload via file module.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processImageBuffer, type ProductMediaMeta } from "./derivatives"
import { logger } from "../logger"

type QueryService = {
  graph: (args: unknown) => Promise<{ data: unknown }>
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

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

export async function processProductImages(
  container: MedusaContainer,
  productId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryService
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "thumbnail", "metadata", "images.url", "images.id"],
    filters: { id: productId },
  })
  const product = asList(data)[0]
  if (!product?.id) return { ok: false, reason: "not_found" }

  const thumb = typeof product.thumbnail === "string" ? product.thumbnail : ""
  const images = Array.isArray(product.images)
    ? (product.images as { url?: string }[])
    : []
  const sourceUrl = thumb || images.find((i) => i.url)?.url || ""
  if (!sourceUrl) {
    return { ok: false, reason: "no_image" }
  }

  // Skip remote processing for data URLs / missing host in lab
  if (sourceUrl.startsWith("data:")) {
    return { ok: false, reason: "data_url" }
  }

  const buf = await fetchBinary(sourceUrl)
  if (!buf?.length) {
    return { ok: false, reason: "download_failed" }
  }

  const processed = await processImageBuffer(buf)
  const meta = (product.metadata as Record<string, unknown>) || {}
  const alk =
    meta.alkemart && typeof meta.alkemart === "object"
      ? { ...(meta.alkemart as Record<string, unknown>) }
      : {}

  if (!processed.ok) {
    const media: ProductMediaMeta = {
      derivatives_status: processed.sharpMissing ? "skipped" : "failed",
      derivatives_at: new Date().toISOString(),
      derivatives_error: processed.error,
    }
    alk.media = media
    try {
      const productModule = container.resolve(Modules.PRODUCT) as {
        updateProducts: (
          id: string,
          data: { metadata?: Record<string, unknown> },
        ) => Promise<unknown>
      }
      await productModule.updateProducts(productId, {
        metadata: { ...meta, alkemart: alk },
      })
    } catch (e) {
      logger.warn("media.meta_update_failed", {
        productId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
    return {
      ok: false,
      reason: processed.sharpMissing ? "sharp_missing" : "process_failed",
    }
  }

  // Upload derivatives via file module when available
  let thumbUrl: string | undefined
  let webUrl: string | undefined
  try {
    const fileModule = container.resolve(Modules.FILE) as {
      createFiles?: (
        files: Array<{
          filename: string
          mimeType: string
          content: string
          access?: string
        }>,
      ) => Promise<Array<{ url?: string }>>
    }

    if (typeof fileModule.createFiles === "function") {
      for (const d of processed.derivatives) {
        const [uploaded] = await fileModule.createFiles([
          {
            filename: `${productId}${d.filenameSuffix}`,
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
    logger.warn("media.upload_failed", {
      productId,
      error: e instanceof Error ? e.message : String(e),
    })
  }

  const media: ProductMediaMeta = {
    derivatives_status: "ready",
    derivatives_at: new Date().toISOString(),
    source_width: processed.source.width,
    source_height: processed.source.height,
    thumb_url: thumbUrl,
    web_url: webUrl,
  }
  alk.media = media

  // Prefer web derivative as thumbnail when we got a URL
  const update: { metadata: Record<string, unknown>; thumbnail?: string } = {
    metadata: { ...meta, alkemart: alk },
  }
  if (thumbUrl && !thumb) {
    update.thumbnail = thumbUrl
  } else if (thumbUrl && process.env.ALKEMART_REPLACE_THUMBNAIL === "true") {
    update.thumbnail = thumbUrl
  }

  try {
    const productModule = container.resolve(Modules.PRODUCT) as {
      updateProducts: (
        id: string,
        data: { metadata?: Record<string, unknown>; thumbnail?: string },
      ) => Promise<unknown>
    }
    await productModule.updateProducts(productId, update)
  } catch (e) {
    logger.warn("media.product_update_failed", {
      productId,
      error: e instanceof Error ? e.message : String(e),
    })
    return { ok: false, reason: "update_failed" }
  }

  logger.info("media.derivatives_ready", {
    productId,
    thumbUrl: Boolean(thumbUrl),
    webUrl: Boolean(webUrl),
  })
  return { ok: true }
}
