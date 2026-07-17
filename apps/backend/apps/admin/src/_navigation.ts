import { defineNavigationConfig } from "@mercurjs/dashboard-sdk"

/**
 * Sidebar labels / order — alkemart language, Mercur routes unchanged.
 */
export default defineNavigationConfig({
  items: [
    { id: "orders", rank: 1, label: "Orders" },
    { id: "products", rank: 2, label: "Products" },
    { id: "customers", rank: 3, label: "Customers" },
  ],
})
