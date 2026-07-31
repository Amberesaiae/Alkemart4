import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createCommissionRatesWorkflow } from "@mercurjs/core/workflows"
import type { CreateCommissionRateDTO } from "@mercurjs/types"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown; metadata?: { count?: number; skip?: number; take?: number } }>
  }
  const { data: commission_rates, metadata } = await query.graph({
    entity: "commission_rate",
    fields: req.queryConfig?.fields || [
      "id", "name", "code", "type", "value", "currency_code",
      "is_enabled", "is_default", "created_at", "updated_at",
    ],
    filters: req.filterableFields || {},
    pagination: req.queryConfig?.pagination || { skip: 0, take: 50 },
  })
  res.json({
    commission_rates,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.validatedBody || req.body) as CreateCommissionRateDTO
  const { result } = await createCommissionRatesWorkflow(req.scope).run({
    input: [body],
  })
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown[] }>
  }
  const { data } = await query.graph({
    entity: "commission_rate",
    fields: [
      "id", "name", "code", "type", "value", "currency_code",
      "is_enabled", "is_default", "created_at", "updated_at",
    ],
    filters: { id: result[0].id },
  })
  const commission_rate = Array.isArray(data) ? data[0] : data
  res.status(201).json({ commission_rate })
}
