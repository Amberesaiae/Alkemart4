/**
 * GET /vendor/alkemart/stats — seller-scoped live ops snapshot.
 * Requires member session + selected seller (session.seller_id or x-seller-id).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { collectSellerCommerceStats } from "../../../../lib/commerce-stats"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  session?: { seller_id?: string }
}

export async function GET(req: SellerReq, res: MedusaResponse) {
  const sellerId =
    req.seller_context?.seller_id ||
    req.session?.seller_id ||
    req.get("x-seller-id") ||
    ""

  if (!sellerId) {
    res.status(400).json({
      error: "Seller context required — select a store in Seller Hub first.",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const stats = await collectSellerCommerceStats(query, sellerId, { days: 30 })
    res.status(200).json(stats)
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to collect seller stats",
    })
  }
}
