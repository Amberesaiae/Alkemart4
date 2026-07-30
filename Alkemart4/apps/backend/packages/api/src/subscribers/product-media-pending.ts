/**
 * Mark product media derivatives as pending when product has/ changes images.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { logger } from "../lib/logger"

function withMediaMeta(
  meta: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const alk = (meta.alkemart as Record<string, unknown>) || {}
  const media = (alk.media as Record<string, unknown>) || {}
  return {
    ...meta,
    alkemart: {
      ...alk,
      media: { ...media, ...overrides },
    },
  }
}

export default async function productMediaPending({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const id = data?.id
  if (!id) return

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data: rows } = await query.graph({
      entity: "product",
      fields: ["id", "thumbnail", "metadata", "images.url"],
      filters: { id },
    })
    const product = Array.isArray(rows) ? rows[0] : rows
    if (!product || typeof product !== "object") return

    const p = product as {
      thumbnail?: string
      metadata?: Record<string, unknown>
      images?: unknown[]
    }
    const hasImage =
      Boolean(p.thumbnail) ||
      (Array.isArray(p.images) && p.images.length > 0)
    if (!hasImage) return

    const meta = p.metadata || {}
    const alk = (meta.alkemart as Record<string, unknown>) || {}
    const media = (alk.media as Record<string, unknown>) || {}
    // Don't thrash ready/skipped on every update unless thumbnail changed path
    if (media.derivatives_status === "ready" || media.derivatives_status === "skipped" || media.derivatives_status === "failed") {
      return
    }

    // Retry counter: stop after 5 attempts to prevent infinite thrash loop
    const retryCount = (media.retry_count as number) || 0
    if (media.derivatives_status === "pending" && retryCount >= 5) {
      logger.warn(
        `[alkemart] media derivatives: max retries (5) reached for product ${id}, marking skipped`,
      )
      const productModule = container.resolve(Modules.PRODUCT) as {
        updateProducts: (
          id: string,
          data: { metadata?: Record<string, unknown> },
        ) => Promise<unknown>
      }
      await productModule.updateProducts(id, {
        metadata: withMediaMeta(meta, { derivatives_status: "skipped", retry_count: undefined }),
      })
      return
    }

    const productModule = container.resolve(Modules.PRODUCT) as {
      updateProducts: (
        id: string,
        data: { metadata?: Record<string, unknown> },
      ) => Promise<unknown>
    }
    await productModule.updateProducts(id, {
      metadata: withMediaMeta(meta, { derivatives_status: "pending", retry_count: retryCount + 1 }),
    })
  } catch (e) {
    logger.warn("[alkemart] productMediaPending failed", { productId: id, error: e instanceof Error ? e.message : e })
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
