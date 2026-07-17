/**
 * GET /store/alkemart/vendors/:slug
 * Public vendor storefront profile (active vendors only).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_MODULE } from "../../../../../modules/marketplace"

type VendorRow = {
  id: string
  slug: string
  name: string
  bio: string | null
  logo_url: string | null
  rating_avg_x100: number
  rating_count: number
  badge_top_seller: boolean
  badge_fast_shipper: boolean
  status: string
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const slug = String(req.params.slug ?? "")
    .trim()
    .toLowerCase()
  if (!slug) {
    res.status(400).json({ error: "slug is required" })
    return
  }

  try {
    const marketplace = req.scope.resolve(MARKETPLACE_MODULE) as {
      listVendors: (filters: Record<string, unknown>) => Promise<VendorRow[]>
    }
    const rows = await marketplace.listVendors({ slug })
    const vendor = rows?.[0]
    if (!vendor || vendor.status !== "active") {
      res.status(404).json({ error: "Store not found" })
      return
    }

    res.status(200).json({
      vendor: {
        id: vendor.id,
        slug: vendor.slug,
        name: vendor.name,
        bio: vendor.bio,
        logoImageUrl: vendor.logo_url,
        ratingAvgX100: vendor.rating_avg_x100 ?? 0,
        ratingCount: vendor.rating_count ?? 0,
        badgeTopSeller: Boolean(vendor.badge_top_seller),
        badgeFastShipper: Boolean(vendor.badge_fast_shipper),
        status: vendor.status,
      },
    })
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load vendor",
    })
  }
}
