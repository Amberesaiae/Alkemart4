import PaystackPaymentProvider from "./service.ts"
import { ModuleProvider, Modules } from "@medusajs/framework/utils"

export default ModuleProvider(Modules.PAYMENT, {
  services: [PaystackPaymentProvider],
})
