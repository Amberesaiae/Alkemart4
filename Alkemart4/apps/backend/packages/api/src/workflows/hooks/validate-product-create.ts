/**
 * Minimal validate hook for mercur-create-products.
 * Does NOT block based on readiness or quality — those checks belong
 * at propose time only. Products can always be created as draft.
 * If proposed, stamps quality metadata (advisory) and passes.
 */
import { createProductsWorkflow } from "@mercurjs/core/workflows"
import {
  scoreProductQuality,
  qualityMetadataSnapshot,
} from "../../lib/product-quality"

type HookProduct = {
  status?: string
  title?: string
  description?: string
  thumbnail?: string
  images?: Array<{ url?: string } | string>
  categories?: Array<{ id?: string } | string>
  category_ids?: string[]
  seller_ids?: string[]
  metadata?: Record<string, unknown>
}

type HookInput = {
  input?: {
    products?: HookProduct[]
    additional_data?: { seller_id?: string }
  }
  products?: HookProduct[]
}

;(createProductsWorkflow.hooks as { validate: (fn: unknown) => void }).validate(
  async ({ input, products }: HookInput) => {
    const list = products ?? input?.products ?? []
    const proposed = list.filter(
      (p) => (p.status || "").toLowerCase() === "proposed",
    )
    if (!proposed.length) return

    // Stamp advisory quality metadata on each proposed product
    for (const p of proposed) {
      try {
        const quality = scoreProductQuality({
          title: p.title,
          description: p.description,
          thumbnail: p.thumbnail,
          images: p.images,
          categories: p.categories,
          category_ids: p.category_ids,
        })
        const prevMeta =
          p.metadata && typeof p.metadata === "object" ? p.metadata : {}
        const prevAlk =
          prevMeta.alkemart && typeof prevMeta.alkemart === "object"
            ? (prevMeta.alkemart as Record<string, unknown>)
            : {}
        p.metadata = {
          ...prevMeta,
          alkemart: {
            ...prevAlk,
            quality: qualityMetadataSnapshot(quality),
          },
        }
      } catch {
        // Non-fatal — quality stamp is best-effort
      }
    }
  },
)
