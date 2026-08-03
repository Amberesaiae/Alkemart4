import { Module } from "@medusajs/framework/utils";

import WishlistModuleService from "./service.ts";

export const WISHLIST_MODULE = "wishlist";
export { WishlistModuleService };
export * from "./types.ts";
export * from "./utils.ts";

export default Module(WISHLIST_MODULE, {
  service: WishlistModuleService,
});
