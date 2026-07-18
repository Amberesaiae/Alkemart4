/**
 * Mark product media derivatives as pending when product has/ changes images.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { markMediaPending } from "../lib/media/derivatives"

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
    if (media.derivatives_status === "ready" || media.derivatives_status === "skipped") {
      return
    }

    const nextMeta = markMediaPending(meta)
    const productModule = container.resolve(Modules.PRODUCT) as {
      updateProducts: (
        id: string,
        data: { metadata?: Record<string, unknown> },
      ) => Promise<unknown>
    }
    await productModule.updateProducts(id, { metadata: nextMeta })
  } catch {
    /* non-fatal */
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
