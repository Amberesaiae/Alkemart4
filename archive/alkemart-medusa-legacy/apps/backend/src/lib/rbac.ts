/**
 * Alkemart RBAC helpers for Medusa custom routes.
 * Role matrix lives in monorepo `@workspace/abilities`; Medusa mirrors role
 * names here so the backend boots without workspace linking.
 */
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  CUSTOMER_ROLES_MODULE,
  type AuthUserRoleDto,
  type AlkemartRole,
} from "../modules/customer-roles"
import type CustomerRolesModuleService from "../modules/customer-roles/service"

export type { AuthUserRoleDto, AlkemartRole }

export function customerRolesService(
  container: MedusaContainer,
): CustomerRolesModuleService {
  return container.resolve(CUSTOMER_ROLES_MODULE) as CustomerRolesModuleService
}

export async function loadRolesForCustomer(
  container: MedusaContainer,
  customerId: string,
): Promise<AuthUserRoleDto[]> {
  const svc = customerRolesService(container)
  return svc.listRolesForCustomer(customerId)
}

export function isAdminRoles(roles: AuthUserRoleDto[]): boolean {
  return roles.some((r) => r.role === "admin")
}

export function canReadAdminPanel(roles: AuthUserRoleDto[]): boolean {
  return roles.some((r) => r.role === "admin" || r.role === "support_agent")
}

export function canManageAdminPanel(roles: AuthUserRoleDto[]): boolean {
  return isAdminRoles(roles)
}

/** Coarse CASL-equivalent checks without importing @casl (Medusa isolate). */
export function canUpdateProduct(roles: AuthUserRoleDto[]): boolean {
  return roles.some(
    (r) =>
      r.role === "admin" ||
      r.role === "vendor_owner" ||
      r.role === "vendor_staff",
  )
}

export function canManageVendor(roles: AuthUserRoleDto[]): boolean {
  return roles.some((r) => r.role === "admin" || r.role === "vendor_owner")
}
