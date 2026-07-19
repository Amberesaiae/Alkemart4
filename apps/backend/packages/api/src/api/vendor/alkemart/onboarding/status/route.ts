/**
 * GET /vendor/alkemart/onboarding/status
 * Seller readiness poll endpoint.
 * Auth: member + Mercur ensureSeller on /vendor/* — do NOT set AUTHENTICATE=false.
 *
 * Cached in Redis (~60s) so banner polls do not re-run multi-graph readiness
 * on every tick (was 15–30s per hit on Neon free).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { evaluateSellerReadiness } from "../../../../../lib/seller-readiness"
import {
  getCachedSellerReadiness,
  setCachedSellerReadiness,
} from "../../../../../lib/seller-readiness-cache"

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

  try {
    const cached = await getCachedSellerReadiness(sellerId)
    if (cached) {
      res.status(200).json({ ...cached, cache: "hit" })
      return
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }

    const readiness = await evaluateSellerReadiness(query, sellerId)
    if (!readiness) {
      res.status(404).json({ error: "Seller not found" })
      return
    }
    // Active sellers: long poll gap already 0; cache longer. Incomplete: still cache briefly.
    const ttl =
      readiness.phase === "active"
        ? 120
        : readiness.phase === "pending_approval"
          ? 45
          : 30
    void setCachedSellerReadiness(sellerId, readiness, ttl)
    // Cap client poll interval so banner cannot DDOS Neon
    const poll = Math.max(
      readiness.poll_after_seconds || 0,
      readiness.phase === "active" ? 0 : 45,
    )
    res.status(200).json({
      ...readiness,
      poll_after_seconds: poll,
      cache: "miss",
    })
  } catch (e) {
    res.status(500).json({
      error:
        e instanceof Error ? e.message : "Failed to evaluate seller readiness",
    })
  }
}
