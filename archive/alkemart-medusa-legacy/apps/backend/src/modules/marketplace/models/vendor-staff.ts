import { model } from "@medusajs/framework/utils"

const VendorStaff = model.define("vendor_staff", {
  id: model.id().primaryKey(),
  role: model.text().default("member"),
})

export default VendorStaff
