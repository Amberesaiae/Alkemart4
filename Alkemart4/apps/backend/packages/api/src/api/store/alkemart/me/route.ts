/**
 * GET /store/alkemart/me — buyer session for SPA (profile only).
 * Requires customer auth (session or bearer).
 *
 * RBAC note (production audit 2026-07-19):
 * - Do NOT trust customer.metadata.roles — Medusa allows customers to write metadata.
 * - Always return fixed buyer role until a server-owned role module exists.
 * - Staff privileges are NEVER expressed on the customer actor (use member/user).
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type CustomerRow = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  metadata?: Record<string, unknown> | null
}

/** Fixed buyer roles — ignore client-writable metadata.roles */
function buyerRoles() {
  return [{ role: "buyer" as const, vendorId: null as string | null }]
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Medusa attaches auth_context after authenticate middleware; not on base types
  const auth = (req as MedusaRequest & {
    auth_context?: { actor_id?: string }
  }).auth_context
  const customerId = auth?.actor_id
  if (!customerId) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: CustomerRow[] }>
  }

  const { data } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name", "phone", "metadata"],
    filters: { id: customerId },
  })

  const customer = Array.isArray(data)
    ? data[0]
    : (data as unknown as CustomerRow)
  if (!customer?.id) {
    res.status(404).json({ error: "Customer not found" })
    return
  }

  const meta = customer.metadata ?? {}
  const roles = buyerRoles()

  res.status(200).json({
    user: {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name ?? undefined,
      lastName: customer.last_name ?? undefined,
      phone: customer.phone ?? undefined,
      roles,
      countryCode: (meta.country_code as string) || undefined,
      preferredCurrency: (meta.preferred_currency as string) || undefined,
    },
    roles,
  })
}
