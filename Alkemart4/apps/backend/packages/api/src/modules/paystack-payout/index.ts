import PaystackPayoutProvider from "./service.ts"
import { ModuleProvider } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"

export default ModuleProvider(MercurModules.PAYOUT, {
  services: [PaystackPayoutProvider],
})
