import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { approveSellerWorkflow } from "@mercurjs/core/workflows"
import { writeAuditLog } from "../../../../../lib/audit-log"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = req.params.id
  if (!sellerId) {
    res.status(400).json({ error: "Seller id required" })
    return
  }

  try {
    await approveSellerWorkflow(req.scope).run({
      input: { seller_id: sellerId },
    })

    writeAuditLog({
      action: "seller.approved",
      actorId: "admin",
      actorType: "user",
      resourceId: sellerId,
      resourceType: "seller",
      details: {},
    })

    res.status(200).json({ seller_id: sellerId, status: "open" })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to approve seller",
    })
  }
}
