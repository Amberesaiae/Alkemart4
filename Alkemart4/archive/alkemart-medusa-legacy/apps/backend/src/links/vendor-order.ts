import MarketplaceModule from "../modules/marketplace"
import OrderModule from "@medusajs/medusa/order"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  {
    linkable: MarketplaceModule.linkable.vendor,
  },
  {
    linkable: OrderModule.linkable.order,
    isList: true,
  }
)
