/**
 * GET /vendor/alkemart/stats — seller-scoped live ops snapshot + readiness.
 * Requires member session + selected seller (session.seller_id or x-seller-id).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { collectSellerCommerceStats } from "../../../../lib/commerce-stats"
import { evaluateSellerReadiness } from "../../../../lib/seller-readiness"

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
    const [stats, readiness] = await Promise.all([
      collectSellerCommerceStats(query, sellerId, { days: 30 }),
      evaluateSellerReadiness(query, sellerId),
    ])
    res.status(200).json({
      ...stats,
      readiness: readiness
        ? {
            phase: readiness.phase,
            setup_complete: readiness.setup_complete,
            can_propose_products: readiness.can_propose_products,
            can_create_offers: readiness.can_create_offers,
            checklist: readiness.checklist,
            next_action: readiness.next_action,
            mercur_status: readiness.mercur_status,
          }
        : null,
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to collect seller stats",
    })
  }
}
