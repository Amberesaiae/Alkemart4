/**
 * On customer.created, ensure a buyer role row exists in customer-roles.
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { customerRolesService } from "../lib/rbac"

export default async function customerCreatedBuyerRole({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const customerId = data?.id
  if (!customerId) return

  try {
    const svc = customerRolesService(container)
    await svc.ensureBuyerRole(customerId)
  } catch (err) {
    // Log but do not fail the create path — GET /me also ensures buyer
    console.warn(
      "[customer-created-buyer-role] failed:",
      err instanceof Error ? err.message : err,
    )
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}
