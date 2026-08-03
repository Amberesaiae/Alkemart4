import { defineLink } from "@medusajs/framework/utils";
import CustomerModule from "@medusajs/medusa/customer";

import WishlistModule from "../modules/wishlist/index.ts";

export default defineLink(CustomerModule.linkable.customer, {
  linkable: WishlistModule.linkable.wishlist,
  deleteCascade: true,
  isList: false,
});
