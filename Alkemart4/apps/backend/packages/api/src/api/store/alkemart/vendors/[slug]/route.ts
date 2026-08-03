/**
 * GET /store/alkemart/vendors/:slug — public storefront seller card by handle.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { readSellerImageMeta } from "../../../../../lib/media/derivatives.ts"

type SellerRow = {
  id: string
  name?: string | null
  handle?: string | null
  description?: string | null
  logo?: string | null
  banner?: string | null
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

  const { data } = await query.graph({
    entity: "seller",
    fields: [
      "id",
      "name",
      "handle",
      "description",
      "logo",
      "banner",
      "status",
      "email",
      "metadata",
    ],
    filters,
  })

  const seller = Array.isArray(data) ? data[0] : (data as unknown as SellerRow)

  // Handles are stored lowercase — if exact match missed, the seller doesn't exist.
  // No unbounded in-memory fallback (prevents OOM on large seller catalogues).

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
  const alkemartMeta =
    (meta.alkemart as Record<string, unknown> | undefined) ?? {}
  // Prefer Mercur's native `banner`; fall back to alkemart metadata for backfill.
  const coverImageUrl =
    seller.banner ||
    (alkemartMeta.cover_image_url as string | undefined) ||
    (meta.cover_image_url as string | undefined) ||
    null
  // Optional webp derivatives (seller-media pipeline). Storefront prefers these
  // over the raw logo/banner for bandwidth; falls back transparently when absent.
  const { logo: logoMedia, banner: bannerMedia } = readSellerImageMeta(meta)
  res.status(200).json({
    vendor: {
      id: seller.id,
      slug: seller.handle ?? slug,
      name: seller.name ?? "Store",
      bio: seller.description ?? null,
      logoImageUrl: seller.logo ?? null,
      coverImageUrl: coverImageUrl ?? null,
      logoThumbUrl: logoMedia.thumb_url ?? null,
      logoWebUrl: logoMedia.web_url ?? null,
      coverThumbUrl: bannerMedia.thumb_url ?? null,
      coverWebUrl: bannerMedia.web_url ?? null,
      ratingAvgX100: Number(meta.rating_avg_x100 ?? 0) || 0,
      ratingCount: Number(meta.rating_count ?? 0) || 0,
      badgeTopSeller: Boolean(meta.badge_top_seller),
      badgeFastShipper: Boolean(meta.badge_fast_shipper),
      status: seller.status ?? "open",
    },
  })
}
