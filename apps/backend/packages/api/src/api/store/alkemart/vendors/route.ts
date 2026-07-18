/**
 * GET /store/alkemart/vendors — public list of open marketplace sellers.
 * Used by storefront /sellers. Never invents sellers.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type SellerRow = {
  id: string
  name?: string | null
  handle?: string | null
  description?: string | null
  logo?: string | null
  status?: string | null
  metadata?: Record<string, unknown> | null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: SellerRow[] }>
  }

  const limit = Math.min(
    Math.max(Number(req.query?.limit ?? 50) || 50, 1),
    100,
  )
  const offset = Math.max(Number(req.query?.offset ?? 0) || 0, 0)

  const { data } = await query.graph({
    entity: "seller",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "logo",
      "status",
      "metadata",
    ],
    filters: { status: "open" },
  })

  const list = (Array.isArray(data) ? data : []).filter(
    (s) => s?.id && s?.name && s?.handle,
  )

  // Stable order by name
  list.sort((a, b) =>
    String(a.name).localeCompare(String(b.name), undefined, {
      sensitivity: "base",
    }),
  )

  const page = list.slice(offset, offset + limit)

  res.status(200).json({
    vendors: page.map((s) => {
      const meta = s.metadata ?? {}
      return {
        id: s.id,
        name: s.name,
        slug: s.handle,
        handle: s.handle,
        bio: s.description ?? null,
        logoImageUrl: s.logo ?? null,
        ratingAvgX100: Number(meta.rating_avg_x100 ?? 0) || 0,
        ratingCount: Number(meta.rating_count ?? 0) || 0,
        badgeTopSeller: Boolean(meta.badge_top_seller),
        badgeFastShipper: Boolean(meta.badge_fast_shipper),
        status: s.status ?? "open",
      }
    }),
    count: list.length,
    offset,
    limit,
  })
}
