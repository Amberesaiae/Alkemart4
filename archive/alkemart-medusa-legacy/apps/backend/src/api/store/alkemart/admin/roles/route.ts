/**
 * POST   /store/alkemart/admin/roles  — assign role
 * DELETE /store/alkemart/admin/roles  — revoke role
 *
 * Body assign: { email, role, vendorId? }
 * Body revoke: { customerId, role, vendorId? }
 */
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "zod"
import {
  ALKEMART_ROLES,
  type AlkemartRole,
} from "../../../../../modules/customer-roles"
import {
  canManageAdminPanel,
  customerRolesService,
  isAdminRoles,
  loadRolesForCustomer,
} from "../../../../../lib/rbac"
import { MARKETPLACE_MODULE } from "../../../../../modules/marketplace"

export const AUTHENTICATE = true

const assignSchema = z.object({
  email: z.string().email(),
  role: z.enum(ALKEMART_ROLES as unknown as [AlkemartRole, ...AlkemartRole[]]),
  vendorId: z.string().nullable().optional(),
})

const revokeSchema = z.object({
  customerId: z.string().min(1),
  role: z.enum(ALKEMART_ROLES as unknown as [AlkemartRole, ...AlkemartRole[]]),
  vendorId: z.string().nullable().optional(),
})

async function assertAdmin(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<string | null> {
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    res.status(401).json({ error: "Authentication required" })
    return null
  }
  const roles = await loadRolesForCustomer(req.scope, actorId)
  if (!canManageAdminPanel(roles) || !isAdminRoles(roles)) {
    res.status(403).json({ error: "Forbidden — admin role required" })
    return null
  }
  return actorId
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  if (!(await assertAdmin(req, res))) return

  const parsed = assignSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message })
    return
  }

  const { email, role, vendorId } = parsed.data
  const needsVendor = role === "vendor_owner" || role === "vendor_staff"
  if (needsVendor && !vendorId) {
    res.status(400).json({ error: "vendorId is required for vendor roles" })
    return
  }
  if (!needsVendor && vendorId) {
    res.status(400).json({ error: "vendorId must be null for non-vendor roles" })
    return
  }

  if (needsVendor && vendorId) {
    try {
      const marketplace = req.scope.resolve(MARKETPLACE_MODULE) as {
        retrieveVendor: (id: string) => Promise<{ id: string }>
      }
      await marketplace.retrieveVendor(vendorId)
    } catch {
      res.status(404).json({ error: "Vendor not found" })
      return
    }
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "first_name", "last_name"],
    filters: { email: email.toLowerCase() },
  })
  const customer = customers?.[0]
  if (!customer?.id) {
    res.status(404).json({ error: "No customer with that email" })
    return
  }

  const svc = customerRolesService(req.scope)
  await svc.ensureBuyerRole(customer.id)
  await svc.assignRole({
    customerId: customer.id,
    role,
    vendorId: vendorId ?? null,
  })
  const roles = await svc.listRolesForCustomer(customer.id)

  res.status(200).json({
    id: customer.id,
    email: customer.email,
    firstName: customer.first_name ?? null,
    lastName: customer.last_name ?? null,
    roles,
  })
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  if (!(await assertAdmin(req, res))) return

  const parsed = revokeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message })
    return
  }

  const { customerId, role, vendorId } = parsed.data
  if (role === "admin") {
    // Prevent last-admin lockout is complex; block self-revoke of admin
    if (customerId === req.auth_context?.actor_id) {
      res.status(400).json({ error: "Cannot revoke your own admin role" })
      return
    }
  }

  const svc = customerRolesService(req.scope)
  await svc.revokeRole({
    customerId,
    role,
    vendorId: vendorId ?? null,
  })

  res.status(204).send()
}
