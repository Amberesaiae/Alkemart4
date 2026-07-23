import { MedusaService } from "@medusajs/framework/utils"
import CustomerRole from "./models/customer-role"

export const ALKEMART_ROLES = [
  "buyer",
  "vendor_owner",
  "vendor_staff",
  "admin",
  "support_agent",
] as const

export type AlkemartRole = (typeof ALKEMART_ROLES)[number]

export type CustomerRoleRow = {
  id: string
  customer_id: string
  role: string
  vendor_id: string | null
}

export type AuthUserRoleDto = {
  role: AlkemartRole
  vendorId: string | null
}

function isAlkemartRole(r: string): r is AlkemartRole {
  return (ALKEMART_ROLES as readonly string[]).includes(r)
}

class CustomerRolesModuleService extends MedusaService({
  CustomerRole,
}) {
  /**
   * List role assignments for a customer as AuthUserRole DTOs.
   * Empty → default buyer (does not persist).
   */
  async listRolesForCustomer(customerId: string): Promise<AuthUserRoleDto[]> {
    if (!customerId) {
      return [{ role: "buyer", vendorId: null }]
    }

    const rows = (await this.listCustomerRoles({
      customer_id: customerId,
    })) as CustomerRoleRow[]

    if (!rows?.length) {
      return [{ role: "buyer", vendorId: null }]
    }

    const out: AuthUserRoleDto[] = []
    for (const row of rows) {
      if (!isAlkemartRole(row.role)) continue
      out.push({
        role: row.role,
        vendorId: row.vendor_id ?? null,
      })
    }
    return out.length > 0 ? out : [{ role: "buyer", vendorId: null }]
  }

  /** Ensure at least a buyer role row exists (idempotent). */
  async ensureBuyerRole(customerId: string): Promise<void> {
    const existing = (await this.listCustomerRoles({
      customer_id: customerId,
      role: "buyer",
    })) as CustomerRoleRow[]

    const hasBuyer = existing.some((r) => r.role === "buyer" && !r.vendor_id)
    if (hasBuyer) return

    await this.createCustomerRoles({
      customer_id: customerId,
      role: "buyer",
      vendor_id: null,
    })
  }

  async assignRole(input: {
    customerId: string
    role: AlkemartRole
    vendorId?: string | null
  }): Promise<CustomerRoleRow> {
    const needsVendor =
      input.role === "vendor_owner" || input.role === "vendor_staff"
    const vendorId = needsVendor ? input.vendorId ?? null : null

    if (needsVendor && !vendorId) {
      throw new Error("vendorId is required for vendor roles")
    }
    if (!needsVendor && input.vendorId) {
      throw new Error("vendorId must be null for non-vendor roles")
    }

    // Soft uniqueness: skip if already present
    const existing = (await this.listCustomerRoles({
      customer_id: input.customerId,
      role: input.role,
      vendor_id: vendorId,
    })) as CustomerRoleRow[]

    if (existing[0]) {
      return existing[0]
    }

    return this.createCustomerRoles({
      customer_id: input.customerId,
      role: input.role,
      vendor_id: vendorId,
    }) as Promise<CustomerRoleRow>
  }

  async revokeRole(input: {
    customerId: string
    role: AlkemartRole
    vendorId?: string | null
  }): Promise<void> {
    const vendorId =
      input.role === "vendor_owner" || input.role === "vendor_staff"
        ? input.vendorId ?? null
        : null

    const existing = (await this.listCustomerRoles({
      customer_id: input.customerId,
      role: input.role,
      ...(vendorId != null ? { vendor_id: vendorId } : {}),
    })) as CustomerRoleRow[]

    for (const row of existing) {
      const rowVendor = row.vendor_id ?? null
      if (rowVendor !== vendorId) continue
      await this.deleteCustomerRoles(row.id)
    }
  }
}

export default CustomerRolesModuleService
