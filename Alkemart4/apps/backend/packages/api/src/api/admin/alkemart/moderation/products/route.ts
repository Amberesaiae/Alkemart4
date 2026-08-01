/**
 * GET /admin/alkemart/moderation/products
 * Proposed products + quality snapshot for ops queue.
 * Actions: Mercur confirm / reject / request-changes.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_REASON_CODES } from "../../../../../lib/moderation-reasons"
import { scoreProductQuality } from "../../../../../lib/product-quality"
import { asList } from "../../../../../lib/graph-utils"
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown; metadata?: unknown }>
  }

  // Pagination: defaults to 50, max 200
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)

  try {
    const { data, metadata } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "status",
        "description",
        "thumbnail",
        "metadata",
        "created_at",
        "updated_at",
        "categories.id",
        "sellers.id",
        "sellers.name",
        "sellers.handle",
        "images.url",
      ],
      filters: { status: "proposed" },
      skip: offset,
      take: limit,
    })

    const totalCount =
      (metadata as { count?: number })?.count ?? asList(data).length
    const products = asList(data).map((p) => {
      const quality = scoreProductQuality({
        title: p.title as string,
        description: p.description as string,
        thumbnail: p.thumbnail as string,
        images: p.images as Array<{ url?: string }>,
        categories: p.categories as Array<{ id?: string }>,
      })
      const sellers = (p.sellers as Array<Record<string, unknown>> | undefined) ?? []
      const seller = sellers[0] ?? null
      return {
        id: p.id,
        title: p.title,
        handle: p.handle,
        status: p.status,
        thumbnail: p.thumbnail,
        created_at: p.created_at,
        seller: seller
          ? { id: seller.id, name: seller.name, handle: seller.handle }
          : null,
        quality: {
          score: quality.score,
          band: quality.band,
          blocking: quality.blocking,
        },
      }
    })

    res.status(200).json({
      proposed: products,
      pagination: {
        total: totalCount,
        limit,
        offset,
        has_more: offset + limit < totalCount,
      },
      reason_codes: PRODUCT_REASON_CODES,
      actions: {
        confirm: "POST /admin/products/:id/confirm",
        reject: "POST /admin/products/:id/reject { message }",
        request_changes: "POST /admin/products/:id/request-changes { message }",
      },
      compose_message_hint:
        "Send message as `[code] human text` e.g. `[poor_images] …`",
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to load product queue",
    })
  }
}
