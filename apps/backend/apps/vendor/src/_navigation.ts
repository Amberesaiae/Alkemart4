import { defineNavigationConfig } from "@mercurjs/dashboard-sdk"

/**
 * Seller Hub sidebar — alkemart labels; routes stay Mercur.
 */
export default defineNavigationConfig({
  items: [
    { id: "orders", rank: 1, label: "Orders" },
    { id: "offers", rank: 2, label: "Offers" },
    { id: "products", rank: 3, label: "Products" },
  ],
})
