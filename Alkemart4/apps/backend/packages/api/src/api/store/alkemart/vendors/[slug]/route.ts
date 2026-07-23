/**
 * GET /store/alkemart/vendors/:slug — public storefront seller card by handle.
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
  email?: string | null
  metadata?: Record<string, unknown> | null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const slug = String(req.params.slug ?? "")
    .trim()
    .toLowerCase()
  if (!slug) {
    res.status(400).json({ error: "slug is required" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: SellerRow[] }>
  }

  // Prefer handle match; also try id if clients pass sel_…
  const filters =
    slug.startsWith("sel_")
      ? { id: slug }
      : { handle: slug }

  let { data } = await query.graph({
    entity: "seller",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "logo",
      "status",
      "email",
      "metadata",
    ],
    filters,
  })

  let seller = Array.isArray(data) ? data[0] : (data as unknown as SellerRow)

  // Fallback: case-insensitive scan by handle if exact filter missed
  if (!seller?.id && !slug.startsWith("sel_")) {
    const all = await query.graph({
      entity: "seller",
      fields: [
        "id",
        "name",
        "handle",
        "description",
        "logo",
        "status",
        "email",
        "metadata",
      ],
      filters: {},
    })
    const list = Array.isArray(all.data) ? all.data : []
    seller =
      list.find(
        (s) => (s.handle ?? "").toLowerCase() === slug && s.status === "open"
      ) ??
      list.find((s) => (s.handle ?? "").toLowerCase() === slug) ??
      (undefined as unknown as SellerRow)
  }

  if (!seller?.id) {
    res.status(404).json({ error: "Store not found" })
    return
  }

  // Hide non-open sellers from public storefront
  if (seller.status && seller.status !== "open") {
    res.status(404).json({ error: "Store not found" })
    return
  }

  const meta = seller.metadata ?? {}
  res.status(200).json({
    vendor: {
      id: seller.id,
      slug: seller.handle ?? slug,
      name: seller.name ?? "Store",
      bio: seller.description ?? null,
      logoImageUrl: seller.logo ?? null,
      ratingAvgX100: Number(meta.rating_avg_x100 ?? 0) || 0,
      ratingCount: Number(meta.rating_count ?? 0) || 0,
      badgeTopSeller: Boolean(meta.badge_top_seller),
      badgeFastShipper: Boolean(meta.badge_fast_shipper),
      status: seller.status ?? "open",
    },
  })
}
