import { defineNavigationConfig } from "@mercurjs/dashboard-sdk"

/**
 * Seller Hub sidebar — Ghana shop essentials only.
 * Hide EU marketing / Stripe-style modules from day-to-day seller UI.
 */
export default defineNavigationConfig({
  items: [
    { id: "orders", rank: 1, label: "Orders" },
    { id: "products", rank: 2, label: "Products" },
    { id: "offers", rank: 3, label: "Offers" },
    { id: "inventory", rank: 4, label: "Inventory" },
    { id: "customers", rank: 5, label: "Customers" },
    // —— Silenced for Ghana COD/MoMo v1 ——
    { id: "campaigns", hidden: true },
    { id: "price-lists", hidden: true },
    { id: "promotions", hidden: true },
    { id: "payouts", hidden: true },
    { id: "customer-groups", hidden: true },
    { id: "collections", hidden: true },
    // Categories — seed with ensure-ghana-categories.ts; assign on products when listing
    { id: "categories", rank: 6, label: "Categories" },
  ],
})
