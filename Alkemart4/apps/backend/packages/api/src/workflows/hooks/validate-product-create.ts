import { createProductsWorkflow } from "@mercurjs/core/workflows"
import {
  scoreProductQuality,
  qualityMetadataSnapshot,
} from "../../lib/product-quality"

type HookProduct = {
  status?: string | null
  title?: string | null
  description?: string | null
  thumbnail?: string | null
  images?: Array<{ url?: string } | string> | null
  categories?: Array<{ id?: string } | string> | null
  category_ids?: string[] | null
  seller_ids?: string[] | null
  metadata?: Record<string, unknown> | null
}

type HookInput = {
  input?: {
    products?: HookProduct[]
    additional_data?: { seller_id?: string }
  }
  products?: HookProduct[]
}

createProductsWorkflow.hooks.validate(
  async ({ input, products }: HookInput) => {
    const list = products ?? input?.products ?? []
    const proposed = list.filter(
      (p) => (p.status || "").toLowerCase() === "proposed",
    )
    if (!proposed.length) return

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
        /* non-fatal */
      }
    }
  },
)
