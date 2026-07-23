/**
 * GET /admin/alkemart/moderation/sellers
 * Queue view: pending applications + recently suspended (ops).
 * Lifecycle actions remain Mercur POST /admin/sellers/:id/{approve,suspend,...}
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SELLER_REASON_CODES } from "../../../../../lib/moderation-reasons"
import {
  buildSellerReadiness,
  evaluateSellerChecklist,
  type SellerSnapshot,
} from "../../../../../lib/seller-readiness"

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const { data } = await query.graph({
      entity: "seller",
      fields: [
        "id",
        "name",
        "handle",
        "email",
        "status",
        "status_reason",
        "approved_at",
        "currency_code",
        "metadata",
        "created_at",
        "address.address_1",
        "address.city",
        "address.country_code",
      ],
    })

    const sellers = asList(data)
    const pending = sellers.filter(
      (s) => String(s.status || "").toLowerCase() === "pending_approval",
    )
    const suspendedApps = sellers.filter((s) => {
      const st = String(s.status || "").toLowerCase()
      return st === "suspended" && !s.approved_at
    })

    const enrich = async (row: Record<string, unknown>) => {
      const snap = row as unknown as SellerSnapshot
      try {
        const checklist = await evaluateSellerChecklist(query, snap)
        const readiness = buildSellerReadiness(snap, checklist)
        return {
          id: snap.id,
          name: snap.name,
          handle: snap.handle,
          email: snap.email,
          status: snap.status,
          status_reason: snap.status_reason,
          approved_at: snap.approved_at,
          created_at: row.created_at,
          phase: readiness.phase,
          checklist: readiness.checklist,
          setup_complete: readiness.setup_complete,
        }
      } catch {
        return {
          id: snap.id,
          name: snap.name,
          handle: snap.handle,
          email: snap.email,
          status: snap.status,
          status_reason: snap.status_reason,
          approved_at: snap.approved_at,
          created_at: row.created_at,
          phase: null,
          checklist: null,
          setup_complete: false,
        }
      }
    }

    const [pendingRows, rejectedRows] = await Promise.all([
      Promise.all(pending.map(enrich)),
      Promise.all(suspendedApps.map(enrich)),
    ])

    res.status(200).json({
      pending: pendingRows,
      rejected_applications: rejectedRows,
      reason_codes: SELLER_REASON_CODES,
      actions: {
        approve: "POST /admin/sellers/:id/approve",
        reject_or_suspend: "POST /admin/sellers/:id/suspend { reason }",
        unsuspend: "POST /admin/sellers/:id/unsuspend",
        terminate: "POST /admin/sellers/:id/terminate",
      },
      compose_reason_hint:
        "Send reason as `[code] human text` e.g. `[policy] Does not meet…`",
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to load seller queue",
    })
  }
}
