import PaymentsGhanaModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PAYMENTS_GHANA_MODULE = "paymentsGhana"

export default Module(PAYMENTS_GHANA_MODULE, {
  service: PaymentsGhanaModuleService,
})
