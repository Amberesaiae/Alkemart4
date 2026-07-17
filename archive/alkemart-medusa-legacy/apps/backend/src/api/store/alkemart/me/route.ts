/**
 * GET /store/alkemart/me
 *
 * Authenticated store customer + Alkemart RBAC roles.
 * SPA must use this (not customer.metadata.roles) as session source of truth.
 */
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  customerRolesService,
  loadRolesForCustomer,
} from "../../../../lib/rbac"

export const AUTHENTICATE = true

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  const customerId = req.auth_context?.actor_id
  if (!customerId) {
    res.status(401).json({ error: "Authentication required" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: [
      "id",
      "email",
      "first_name",
      "last_name",
      "phone",
      "metadata",
      "created_at",
      "updated_at",
    ],
    filters: { id: customerId },
  })

  const customer = customers?.[0]
  if (!customer) {
    res.status(401).json({ error: "Customer not found for session" })
    return
  }

  // Ensure buyer role exists for legacy customers created before RBAC module
  try {
    const svc = customerRolesService(req.scope)
    await svc.ensureBuyerRole(customerId)
  } catch {
    // Module may not be migrated yet — still return default buyer below
  }

  let roles
  try {
    roles = await loadRolesForCustomer(req.scope, customerId)
  } catch {
    roles = [{ role: "buyer" as const, vendorId: null }]
  }

  const meta =
    customer.metadata && typeof customer.metadata === "object"
      ? (customer.metadata as Record<string, unknown>)
      : {}

  res.status(200).json({
    customer: {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      metadata: customer.metadata,
      created_at: customer.created_at,
      updated_at: customer.updated_at,
    },
    roles,
    // SPA-friendly flat user
    user: {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      roles,
      countryCode: (meta.country_code as string) ?? "GH",
      preferredCurrency: (meta.preferred_currency as string) ?? "GHS",
    },
  })
}
