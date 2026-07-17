/**
 * Grant admin role to a Medusa customer by email.
 *
 * Usage (from apps/backend):
 *   ALKEMART_BOOTSTRAP_ADMIN_EMAIL=you@example.com npx medusa exec ./src/scripts/bootstrap-admin-role.ts
 *
 * Customer must already exist (signup via SPA first).
 */
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { customerRolesService } from "../lib/rbac"

export default async function bootstrapAdminRole({ container }: ExecArgs) {
  const email = (
    process.env.ALKEMART_BOOTSTRAP_ADMIN_EMAIL ||
    process.env.BOOTSTRAP_ADMIN_EMAIL ||
    ""
  )
    .trim()
    .toLowerCase()

  if (!email) {
    throw new Error(
      "Set ALKEMART_BOOTSTRAP_ADMIN_EMAIL to the customer email to promote",
    )
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: { email },
  })

  const customer = customers?.[0]
  if (!customer?.id) {
    throw new Error(
      `No customer with email ${email}. Create an account via SPA signup first.`,
    )
  }

  const svc = customerRolesService(container)
  await svc.ensureBuyerRole(customer.id)
  await svc.assignRole({
    customerId: customer.id,
    role: "admin",
    vendorId: null,
  })

  const roles = await svc.listRolesForCustomer(customer.id)
  logger.info(
    `Admin role granted to ${email} (${customer.id}). roles=${JSON.stringify(roles)}`,
  )
}
