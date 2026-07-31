import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const FIELDS = [
  "id", "display_id", "seller_id", "seller.name", "seller.handle",
  "account.id", "account.status",
  "amount", "currency_code", "status", "data",
  "period_start", "period_end", "paid_at",
  "created_at", "updated_at",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const payoutId = req.params.id
  if (!payoutId) {
    res.status(400).json({ error: "Payout id required" })
    return
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown[] }>
  }
  const { data } = await query.graph({
    entity: "payout",
    fields: FIELDS,
    filters: { id: payoutId },
  })
  const payout = Array.isArray(data) ? data[0] : data
  if (!payout) {
    res.status(404).json({ error: "Payout not found" })
    return
  }
  res.json({ payout })
}
