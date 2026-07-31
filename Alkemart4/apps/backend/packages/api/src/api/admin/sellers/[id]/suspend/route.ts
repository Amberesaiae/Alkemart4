import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { suspendSellerWorkflow } from "@mercurjs/core/workflows"
import { writeAuditLog } from "../../../../../lib/audit-log"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = req.params.id
  if (!sellerId) {
    res.status(400).json({ error: "Seller id required" })
    return
  }

  try {
    const reason = (req.body as { reason?: string } | undefined)?.reason
    if (!reason) {
      res.status(400).json({ error: "Reason is required to suspend a seller" })
      return
    }

    await suspendSellerWorkflow(req.scope).run({
      input: { seller_id: sellerId, reason },
    })

    writeAuditLog({
      action: "seller.suspended",
      actorId: "admin",
      actorType: "user",
      resourceId: sellerId,
      resourceType: "seller",
      details: { reason },
    })

    res.status(200).json({ seller_id: sellerId, status: "suspended" })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to suspend seller",
    })
  }
}
