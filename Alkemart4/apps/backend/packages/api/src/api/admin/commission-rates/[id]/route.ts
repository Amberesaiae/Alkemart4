import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateCommissionRatesWorkflow, deleteCommissionRatesWorkflow } from "@mercurjs/core/workflows"

const FIELDS = [
  "id", "name", "code", "type", "value", "currency_code",
  "is_enabled", "is_default", "created_at", "updated_at",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = req.params.id
  if (!sellerId) {
    res.status(400).json({ error: "Commission rate id required" })
    return
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown[] }>
  }
  const { data } = await query.graph({
    entity: "commission_rate",
    fields: FIELDS,
    filters: { id: sellerId },
  })
  const commission_rate = Array.isArray(data) ? data[0] : data
  if (!commission_rate) {
    res.status(404).json({ error: "Commission rate not found" })
    return
  }
  res.json({ commission_rate })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const rateId = req.params.id
  if (!rateId) {
    res.status(400).json({ error: "Commission rate id required" })
    return
  }
  const { result } = await updateCommissionRatesWorkflow(req.scope).run({
    input: [{ id: rateId, ...(req.validatedBody || req.body) }],
  })
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown[] }>
  }
  const { data } = await query.graph({
    entity: "commission_rate",
    fields: FIELDS,
    filters: { id: result[0].id },
  })
  const commission_rate = Array.isArray(data) ? data[0] : data
  res.json({ commission_rate })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const rateId = req.params.id
  if (!rateId) {
    res.status(400).json({ error: "Commission rate id required" })
    return
  }
  await deleteCommissionRatesWorkflow(req.scope).run({
    input: { ids: [rateId] },
  })
  res.json({
    id: rateId,
    object: "commission_rate",
    deleted: true,
  })
}
