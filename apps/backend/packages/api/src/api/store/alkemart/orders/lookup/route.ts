/**
 * POST /store/alkemart/orders/lookup
 *
 * Guest-safe order retrieve: order_id + email must match.
 * Authenticated customers should use GET /store/orders/:id (Medusa).
 * Never return order PII without one of: owning JWT (Medusa) or email proof.
 * Rate-limited per order_id + email to blunt enumeration.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "zod"
import { checkRateLimit } from "../../../../../lib/simple-rate-limit"

const bodySchema = z.object({
  order_id: z.string().min(1),
  email: z.string().email(),
})

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

function normEmail(e: string): string {
  return e.trim().toLowerCase()
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: "order_id and a valid email are required",
    })
    return
  }

  const orderId = parsed.data.order_id.trim()
  const email = normEmail(parsed.data.email)

  const rl = checkRateLimit({
    key: `order-lookup:${orderId}:${email}`,
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfterSec))
    res.status(429).json({
      error: "Too many lookup attempts. Try again shortly.",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "email",
        "created_at",
        "total",
        "item_total",
        "shipping_total",
        "currency_code",
        "payment_status",
        "fulfillment_status",
        "shipping_address.*",
        "items.id",
        "items.title",
        "items.quantity",
        "items.unit_price",
        "items.thumbnail",
        "items.product_id",
      ],
      filters: { id: orderId },
    })

    const order = asList(data)[0]
    if (!order?.id) {
      // Same message as mismatch — no order enumeration
      res.status(404).json({
        error: "Order not found for that id and email",
      })
      return
    }

    const orderEmail = normEmail(String(order.email || ""))
    if (!orderEmail || orderEmail !== email) {
      res.status(404).json({
        error: "Order not found for that id and email",
      })
      return
    }

    res.status(200).json({ order })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Lookup failed",
    })
  }
}
