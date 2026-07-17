import { model } from "@medusajs/framework/utils"

/**
 * Alkemart RBAC role assignment for a Medusa store customer.
 *
 * Roles: buyer | vendor_owner | vendor_staff | admin | support_agent
 * vendor_id is marketplace Vendor id for vendor_* roles; null otherwise.
 *
 * Server is source of truth — do not trust customer.metadata.roles alone.
 */
const CustomerRole = model.define("customer_role", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  role: model.text(),
  vendor_id: model.text().nullable(),
})

export default CustomerRole
