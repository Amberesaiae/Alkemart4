import { defineNavigationConfig } from "@mercurjs/dashboard-sdk"

/**
 * Admin sidebar for Ghana marketplace ops.
 * Hide Mercur/EU-oriented modules that confuse alkemart lab operators.
 * Routes still exist if opened by URL — silenced from the nav only.
 */
export default defineNavigationConfig({
  items: [
    { id: "orders", rank: 1, label: "Orders" },
    { id: "products", rank: 2, label: "Products" },
    { id: "offers", rank: 3, label: "Offers" },
    { id: "customers", rank: 4, label: "Customers" },
    { id: "inventory", rank: 5, label: "Inventory" },
    { id: "stores", rank: 6, label: "Sellers" },
    // —— Silenced for Ghana COD/MoMo v1 (not deleted) ——
    { id: "campaigns", hidden: true },
    { id: "price-lists", hidden: true },
    { id: "promotions", hidden: true },
    { id: "payouts", hidden: true },
    { id: "customer-groups", hidden: true },
    { id: "reservations", hidden: true },
    { id: "collections", hidden: true },
    // Categories visible for Ghana taxonomy (seed: ensure-ghana-categories.ts)
    { id: "categories", rank: 7, label: "Categories" },
  ],
})
