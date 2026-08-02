/**
 * GET /admin/disputes — list all escalated return disputes.
 * POST /admin/disputes — escalate an existing return to a dispute.
 *
 * A dispute is a return with metadata.is_disputed = true.
 * Buyers or vendors escalate by contacting support; admin sets the flag.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asList } from "../../../lib/graph-utils"

const DISPUTE_FIELDS = [
  "id", "display_id", "status", "refund_amount", "metadata",
  "created_at", "updated_at", "requested_at",
  "order_id",
  "order.display_id", "order.status", "order.currency_code", "order.total",
  "order.customer.email", "order.customer.first_name", "order.customer.last_name",
  "items.id", "items.item_id", "items.quantity", "items.note",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{
      data: unknown
      metadata?: { count?: number; skip?: number; take?: number }
    }>
  }

  const { limit = 50, offset = 0 } = req.query as Record<string, unknown>

  try {
    // Fetch all returns — filter for disputed ones in process
    // (Medusa graph doesn't support JSONB metadata field equality filters)
    const { data } = await query.graph({
      entity: "return",
      fields: DISPUTE_FIELDS,
      filters: {},
      pagination: { skip: Number(offset), take: Number(limit) },
    })

    const all = asList(data)
    const disputes = all.filter((r) => {
      const meta = (r as { metadata?: Record<string, unknown> }).metadata || {}
      return meta.is_disputed === true
    })

    res.json({
      disputes,
      count: disputes.length,
      offset: Number(offset),
      limit: Number(limit),
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch disputes" })
  }
}

/**
 * POST /admin/disputes — escalate a return to a dispute.
 * Body: { return_id: string; reason: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as { return_id?: string; reason?: string } | undefined

  if (!body?.return_id) {
    res.status(400).json({ error: "return_id is required." })
    return
  }
  if (!body?.reason?.trim()) {
    res.status(400).json({ error: "reason is required." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  const orderService = req.scope.resolve(Modules.ORDER) as unknown as {
    updateReturns?: (updates: Array<{ id: string; metadata: Record<string, unknown> }>) => Promise<unknown>
  }

  try {
    const { data } = await query.graph({
      entity: "return",
      fields: ["id", "status", "metadata"],
      filters: { id: body.return_id },
    })
    const ret = asList(data)[0] as {
      id: string
      status: string
      metadata?: Record<string, unknown>
    } | undefined

    if (!ret) {
      res.status(404).json({ error: "Return not found." })
      return
    }
    if ((ret.metadata || {}).is_disputed) {
      res.status(409).json({ error: "This return is already escalated as a dispute." })
      return
    }

    if (typeof orderService.updateReturns === "function") {
      await orderService.updateReturns([{
        id: body.return_id,
        metadata: {
          ...(ret.metadata || {}),
          is_disputed: true,
          dispute_reason: body.reason.trim(),
          dispute_opened_at: new Date().toISOString(),
          dispute_status: "open",
        },
      }])
    }

    res.status(201).json({ dispute: { return_id: body.return_id, status: "open" } })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to escalate dispute" })
  }
}
