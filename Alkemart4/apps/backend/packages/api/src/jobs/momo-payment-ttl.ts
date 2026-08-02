/**
 * Scheduled: expire stale MoMo payments that never completed.
 *
 * Ghana MoMo payments that customers abandon mid-flow stay in "initiated",
 * "pending", or "charged" state forever. This job runs every 5 minutes
 * and transitions those past MOMO_PENDING_TTL_MS (30 min) to "expired"
 * so abandoned carts can be freed and payment sessions released.
 *
 * Uses the Medusa CART module service — no raw SQL.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { logger } from "../lib/logger"

const TTL_MS = 30 * 60 * 1000
const ACTIVE_STATUSES = ["initiated", "pending", "charged"]

export default async function momoPaymentTtlJob(
  container: MedusaContainer,
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  // Load all carts that carry MoMo payment metadata.
  // We filter in-process rather than in the query because Medusa's graph
  // doesn't support deep JSONB field filters on metadata directly.
  let expiredCartIds: string[] = []
  try {
    const { data } = await query.graph({
      entity: "cart",
      fields: ["id", "metadata"],
      filters: {},
    })
    const rows = Array.isArray(data) ? data : []
    const cutoff = new Date(Date.now() - TTL_MS)

    for (const row of rows) {
      const meta = (row as { metadata?: Record<string, unknown> | null }).metadata || {}
      if (meta.ghana_payment !== "momo") continue
      if (!ACTIVE_STATUSES.includes(String(meta.ghana_payment_status || ""))) continue
      const expiresAt = meta.ghana_expires_at
      if (!expiresAt || new Date(String(expiresAt)) >= cutoff) continue
      expiredCartIds.push(String((row as { id: string }).id))
    }
  } catch (e) {
    logger.error("[momo-ttl] query failed", {
      error: e instanceof Error ? e.message : String(e),
    })
    return
  }

  if (!expiredCartIds.length) return

  // Resolve the cart module service — avoids raw SQL.
  const cartService = container.resolve(Modules.CART) as {
    updateCarts: (
      updates: Array<{ id: string; metadata: Record<string, unknown> }>
    ) => Promise<unknown>
    retrieveCart: (id: string, options?: unknown) => Promise<{ metadata?: Record<string, unknown> | null }>
  }

  let ok = 0
  let fail = 0

  for (const cartId of expiredCartIds) {
    try {
      // Re-fetch to get current metadata before merging (avoids clobbering concurrent writes).
      const cart = await cartService.retrieveCart(cartId)
      const meta = cart.metadata || {}
      const currentStatus = String(meta.ghana_payment_status || "")

      const updatedMeta: Record<string, unknown> = {
        ...meta,
        ghana_payment_status: "expired",
        ghana_expired_at: new Date().toISOString(),
        ghana_charge_error: currentStatus
          ? `Payment expired after TTL (was: ${currentStatus})`
          : "Payment expired after TTL",
      }

      await cartService.updateCarts([{ id: cartId, metadata: updatedMeta }])
      ok += 1
    } catch (e) {
      logger.warn("[momo-ttl] expire failed", {
        cartId,
        error: e instanceof Error ? e.message : String(e),
      })
      fail += 1
    }
  }

  logger.info("[momo-ttl] batch complete", {
    expired: ok,
    failed: fail,
    total: expiredCartIds.length,
  })
}

export const config = {
  name: "alkemart-momo-payment-ttl",
  schedule: "*/5 * * * *",
}
