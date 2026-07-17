import CustomerRolesModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const CUSTOMER_ROLES_MODULE = "customerRoles"

export default Module(CUSTOMER_ROLES_MODULE, {
  service: CustomerRolesModuleService,
})

export { ALKEMART_ROLES, type AlkemartRole, type AuthUserRoleDto } from "./service"
