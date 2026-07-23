import { MedusaService } from "@medusajs/framework/utils"
import Vendor from "./models/vendor"
import VendorStaff from "./models/vendor-staff"

class MarketplaceModuleService extends MedusaService({
  Vendor,
  VendorStaff,
}) {}

export default MarketplaceModuleService
