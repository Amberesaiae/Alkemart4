/**
 * POST /admin/sellers/:id/unsuspend — re-activate a suspended seller.
 *
 * Sets seller.status back to "open". Only valid for suspended sellers.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MercurModules } from "@mercurjs/types"
import { writeAuditLog } from "../../../../../lib/audit-log.ts"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = req.params.id
  if (!sellerId) {
    res.status(400).json({ error: "Seller id required." })
    return
  }

  try {
    const sellerService = req.scope.resolve(MercurModules.SELLER) as {
      updateSellers: (updates: Array<{ id: string; status: string; status_reason?: string | null }>) => Promise<unknown[]>
    }

    await sellerService.updateSellers([{
      id: sellerId,
      status: "open",
      status_reason: null,
    }])

    writeAuditLog({
      action: "admin.action",
      actorId: "admin",
      actorType: "user",
      resourceId: sellerId,
      resourceType: "seller",
      details: { action: "unsuspend" },
    })

    res.json({ seller_id: sellerId, status: "open" })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to unsuspend seller" })
  }
}
