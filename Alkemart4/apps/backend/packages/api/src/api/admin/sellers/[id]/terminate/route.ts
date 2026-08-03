/**
 * POST /admin/sellers/:id/terminate — permanently terminate a seller.
 *
 * Irreversible. Sets seller.status to "terminated".
 * Body: { reason: string } — required for audit trail.
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

  const body = req.body as { reason?: string } | undefined
  if (!body?.reason?.trim()) {
    res.status(400).json({ error: "reason is required to terminate a seller." })
    return
  }

  try {
    const sellerService = req.scope.resolve(MercurModules.SELLER) as {
      updateSellers: (updates: Array<{ id: string; status: string; status_reason?: string }>) => Promise<unknown[]>
    }

    await sellerService.updateSellers([{
      id: sellerId,
      status: "terminated",
      status_reason: body.reason.trim(),
    }])

    writeAuditLog({
      action: "admin.action",
      actorId: "admin",
      actorType: "user",
      resourceId: sellerId,
      resourceType: "seller",
      details: { action: "terminate", reason: body.reason },
    })

    res.json({ seller_id: sellerId, status: "terminated" })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to terminate seller" })
  }
}
