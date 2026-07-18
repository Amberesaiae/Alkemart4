/**
 * GET /vendor/alkemart/onboarding/status
 * Seller readiness poll endpoint (15–30s on onboarding UI).
 * Auth: member + Mercur ensureSeller on /vendor/* — do NOT set AUTHENTICATE=false.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { evaluateSellerReadiness } from "../../../../../lib/seller-readiness"

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
    const readiness = await evaluateSellerReadiness(query, sellerId)
    if (!readiness) {
      res.status(404).json({ error: "Seller not found" })
      return
    }
    res.status(200).json(readiness)
  } catch (e) {
    res.status(500).json({
      error:
        e instanceof Error ? e.message : "Failed to evaluate seller readiness",
    })
  }
}
