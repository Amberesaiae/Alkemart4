/**
 * Non-bypassable soft gates on mercur-create-products validate hook.
 * Blocks proposed products when seller cannot sell / quality fails.
 */
import { MedusaError } from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@mercurjs/core/workflows"
import {
  assertCanSell,
  evaluateSellerReadiness,
} from "../../lib/seller-readiness"
import {
  assertCanPropose,
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

// Mercur workflow hook typing is loose across package versions
;(createProductsWorkflow.hooks as { validate: (fn: unknown) => void }).validate(
  async ({ input, products }: HookInput, { container }: { container: { resolve: (k: string) => unknown } }) => {
    const list = products ?? input?.products ?? []
    const proposed = list.filter(
      (p) => (p.status || "").toLowerCase() === "proposed",
    )
    if (!proposed.length) {
      // Drafts always allowed (membership already enforced by vendor middleware)
      return
    }

    const query = container.resolve("query") as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }

    // Resolve seller id from product payload or additional_data
    let sellerId =
      input?.additional_data?.seller_id ||
      proposed.flatMap((p) => p.seller_ids || []).find(Boolean) ||
      ""

    if (!sellerId) {
      // Mercur often attaches seller outside products[]; try common input shape
      const raw = input as Record<string, unknown> | undefined
      if (raw && typeof raw.seller_id === "string") sellerId = raw.seller_id
    }

    if (!sellerId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Cannot propose products without seller context",
      )
    }

    const readiness = await evaluateSellerReadiness(query, sellerId)
    if (!readiness) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Seller ${sellerId} not found`,
      )
    }

    try {
      assertCanSell(readiness, "propose")
    } catch (e) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        e instanceof Error ? e.message : "Seller cannot propose products",
      )
    }

    for (const p of proposed) {
      try {
        const input = {
          title: p.title,
          description: p.description,
          thumbnail: p.thumbnail,
          images: p.images,
          categories: p.categories,
          category_ids: p.category_ids,
        }
        const quality = assertCanPropose(input)
        // Stamp snapshot on product metadata when the create payload is mutable
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
      } catch (e) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          e instanceof Error ? e.message : "Product quality gate failed",
        )
      }
    }
  },
)
