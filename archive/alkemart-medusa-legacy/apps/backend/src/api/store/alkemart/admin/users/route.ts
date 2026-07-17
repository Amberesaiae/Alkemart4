/**
 * GET /store/alkemart/admin/users
 * List customers with Alkemart roles (admin ability required).
 *
 * Customer-based admin (SPA JWT), not Medusa /app staff.
 */
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  canManageAdminPanel,
  customerRolesService,
  loadRolesForCustomer,
} from "../../../../../lib/rbac"

export const AUTHENTICATE = true

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    res.status(401).json({ error: "Authentication required" })
    return
  }

  const actorRoles = await loadRolesForCustomer(req.scope, actorId)
  if (!canManageAdminPanel(actorRoles)) {
    res.status(403).json({ error: "Forbidden" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name"],
    pagination: { take: 200, skip: 0 },
  })

  const svc = customerRolesService(req.scope)
  const items = []
  for (const c of customers ?? []) {
    if (!c?.id) continue
    const roles = await svc.listRolesForCustomer(c.id)
    items.push({
      id: c.id,
      email: c.email,
      firstName: c.first_name ?? null,
      lastName: c.last_name ?? null,
      roles,
    })
  }

  res.status(200).json({ items, total: items.length })
}
