/**
 * GET /admin/payouts — list all seller payouts.
 * POST /admin/payouts — create / trigger a payout.
 *
 * Payout accounts are set up during vendor onboarding (ghana-setup).
 * Paystack transfer recipients are stored in payout_account.data.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const LIST_FIELDS = [
  "id",
  "display_id",
  "seller_id",
  "seller.name",
  "seller.handle",
  "account.id",
  "account.status",
  "amount",
  "currency_code",
  "status",
  "data",
  "period_start",
  "period_end",
  "paid_at",
  "created_at",
  "updated_at",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{
      data: unknown
      metadata?: { count?: number; skip?: number; take?: number }
    }>
  }

  const pagination = req.queryConfig?.pagination ?? { skip: 0, take: 50 }
  const filters: Record<string, unknown> = {}

  // Optional filter: seller_id, status
  if (typeof req.query?.seller_id === "string") {
    filters.seller_id = req.query.seller_id
  }
  if (typeof req.query?.status === "string") {
    filters.status = req.query.status
  }

  const { data: payouts, metadata } = await query.graph({
    entity: "payout",
    fields: LIST_FIELDS,
    filters,
    pagination,
  })

  res.json({
    payouts: Array.isArray(payouts) ? payouts : payouts ? [payouts] : [],
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 50,
  })
}
