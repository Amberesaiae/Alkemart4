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
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown; metadata?: { count?: number; skip?: number; take?: number } }>
  }
  const { data: payouts, metadata } = await query.graph({
    entity: "payout",
    fields: FIELDS,
    filters: req.filterableFields || {},
    pagination: req.queryConfig?.pagination || { skip: 0, take: 50 },
  })
  res.json({
    payouts,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  })
}
