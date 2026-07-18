/**
 * GET /store/alkemart/me — buyer session for SPA (roles + profile).
 * Requires customer auth (session or bearer).
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

function defaultBuyerRoles() {
  return [{ role: "buyer" as const, vendorId: null as string | null }]
}

function normalizeRoles(
  raw: unknown
): { role: string; vendorId: string | null }[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultBuyerRoles()
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null
      const role = (r as { role?: string }).role
      if (!role || typeof role !== "string") return null
      const vendorId = (r as { vendorId?: string | null }).vendorId ?? null
      return { role, vendorId }
    })
    .filter((r): r is { role: string; vendorId: string | null } => Boolean(r))
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context?.actor_id
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

  const customer = Array.isArray(data) ? data[0] : (data as unknown as CustomerRow)
  if (!customer?.id) {
    res.status(404).json({ error: "Customer not found" })
    return
  }

  const meta = customer.metadata ?? {}
  const roles = normalizeRoles(meta.roles)

  res.status(200).json({
    user: {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name ?? undefined,
      lastName: customer.last_name ?? undefined,
      phone: customer.phone ?? undefined,
      roles,
      // Prefer metadata; UI should still bind country from operating markets API
      countryCode: (meta.country_code as string) || undefined,
      preferredCurrency: (meta.preferred_currency as string) || undefined,
    },
    roles,
  })
}
