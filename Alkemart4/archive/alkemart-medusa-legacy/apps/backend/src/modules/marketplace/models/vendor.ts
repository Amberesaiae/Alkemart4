import { model } from "@medusajs/framework/utils"

const Vendor = model.define("vendor", {
  id: model.id().primaryKey(),
  slug: model.text().unique(),
  name: model.text(),
  bio: model.text().nullable(),
  logo_url: model.text().nullable(),
  rating_avg_x100: model.number().default(0),
  rating_count: model.number().default(0),
  badge_top_seller: model.boolean().default(false),
  badge_fast_shipper: model.boolean().default(false),
  paystack_recipient_code: model.text().nullable(),
  commission_bps: model.number().default(700),
  status: model.text().default("active"),
})

export default Vendor
