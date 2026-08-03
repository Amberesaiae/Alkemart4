/**
 * POST /admin/sellers/:id/commission — override a seller's commission rate.
 *
 * Sets seller.metadata.commission_bps (basis points) directly.
 * This is a per-seller override on top of the platform commission_rate table.
 *
 * Body: { commission_bps: number } — 0–10000 (0%–100%)
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MercurModules } from "@mercurjs/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { asList } from "../../../../../lib/graph-utils.ts"
import { writeAuditLog } from "../../../../../lib/audit-log.ts"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = req.params.id
  if (!sellerId) {
    res.status(400).json({ error: "Seller id required." })
    return
  }

  const body = req.body as { commission_bps?: number } | undefined
  const bps = Number(body?.commission_bps)
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
    res.status(400).json({ error: "commission_bps must be an integer between 0 and 10000." })
    return
  }

  try {
    // Fetch current metadata
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: unknown) => Promise<{ data: unknown }>
    }
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "metadata"],
      filters: { id: sellerId },
    })
    const seller = asList(data)[0] as { id: string; metadata?: Record<string, unknown> } | undefined
    if (!seller) {
      res.status(404).json({ error: "Seller not found." })
      return
    }

    const sellerService = req.scope.resolve(MercurModules.SELLER) as {
      updateSellers: (updates: Array<{ id: string; metadata: Record<string, unknown> }>) => Promise<unknown[]>
    }

    await sellerService.updateSellers([{
      id: sellerId,
      metadata: {
        ...(seller.metadata || {}),
        commission_bps: bps,
        commission_bps_set_at: new Date().toISOString(),
        commission_bps_set_by: "admin",
      },
    }])

    writeAuditLog({
      action: "seller.updated",
      actorId: "admin",
      actorType: "user",
      resourceId: sellerId,
      resourceType: "seller",
      details: { commission_bps: bps },
    })

    res.json({ seller_id: sellerId, commission_bps: bps })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to update commission" })
  }
}
