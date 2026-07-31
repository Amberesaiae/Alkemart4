import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createPromotionsWorkflow } from "@medusajs/core-flows"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown; metadata?: { count?: number; skip?: number; take?: number } }>
  }
  const { limit = 50, offset = 0 } = req.query as Record<string, unknown>

  try {
    const { data: promotions, metadata } = await query.graph({
      entity: "promotion",
      fields: [
        "id", "code", "type", "status", "is_automatic",
        "created_at", "updated_at",
        "application_method.value", "application_method.type",
        "application_method.currency_code", "application_method.target_type",
      ],
      pagination: { skip: Number(offset), take: Number(limit) },
    })

    const enriched = (promotions as Record<string, unknown>[]).map((p) => {
      const method = p.application_method as Record<string, unknown> | null
      const freeShipping =
        p.type === "standard" &&
        method?.target_type === "shipping_methods" &&
        Number(method?.value) === 100
      return { ...p, type: freeShipping ? "free_shipping" : p.type }
    })

    res.json({
      promotions: enriched,
      count: metadata?.count ?? 0,
      offset: metadata?.skip ?? 0,
      limit: metadata?.take ?? 0,
    })
  } catch (e) {
    res.status(500).json({
      type: "unknown_error",
      code: "unknown_error",
      message: e instanceof Error ? e.message : "Failed to fetch promotions",
    })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, unknown>
  const code = String(body.code || "").trim().toUpperCase()
  const isFreeShipping = body.type === "free_shipping"
  const value = Number(body.value)
  const valueType = body.value_type === "fixed" ? "fixed" : "percentage"

  if (!code) {
    res.status(400).json({ error: "Promotion code is required." })
    return
  }
  if (!Number.isFinite(value) || value <= 0) {
    res.status(400).json({ error: "Promotion value must be a positive number." })
    return
  }

  try {
    const { result } = await createPromotionsWorkflow(req.scope).run({
      input: {
        promotionsData: [
          {
            code,
            type: "standard",
            status: "active",
            application_method: {
              type: valueType,
              target_type: isFreeShipping ? "shipping_methods" : "items",
              allocation: "across",
              value,
              currency_code: valueType === "fixed" ? "ghs" : undefined,
            },
          },
        ],
      },
    })
    res.status(201).json({ promotion: result[0] })
  } catch (e) {
    res.status(400).json({
      type: "unknown_error",
      code: "unknown_error",
      message: e instanceof Error ? e.message : "Failed to create promotion",
    })
  }
}
