import { defineMiddlewares, authenticate } from "@medusajs/medusa"
import { validateVendorUploads } from "./middlewares/validate-vendor-uploads"
import { applyStrictSellerProductFilter } from "./middlewares/strict-seller-products"

export default defineMiddlewares({
  routes: [
    /**
     * Exclusive multi-vendor: after Mercur's shared-catalog filter, restrict
     * GET /vendor/products to this seller only (product_seller + authored).
     * Prevents lab/orphan published products from appearing in new shops.
     */
    {
      matcher: "/vendor/products",
      methods: ["GET"],
      middlewares: [applyStrictSellerProductFilter],
    },
    {
      matcher: "/store/alkemart/me",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    // Seller-scoped stats still need member + seller (Mercur ensureSeller)
    {
      matcher: "/vendor/alkemart/stats",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    // Onboarding status poll — never AUTHENTICATE=false; ensureSeller still applies via Mercur /vendor/*
    {
      matcher: "/vendor/alkemart/onboarding/status",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/alkemart/onboarding/ghana-setup",
      methods: ["POST"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    // Lightweight exclusive product list (prefer over heavy Mercur /vendor/products)
    {
      matcher: "/vendor/alkemart/products",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/alkemart/products/*/quality",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/alkemart/products/*/propose",
      methods: ["POST"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/alkemart/me",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/alkemart/quick-list",
      methods: ["POST"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    // Image quality gate on vendor uploads (runs with multer files when present)
    {
      matcher: "/vendor/uploads",
      methods: ["POST"],
      middlewares: [validateVendorUploads],
    },
    // Admin moderation queues + summary
    {
      matcher: "/admin/alkemart/moderation/*",
      methods: ["GET"],
      middlewares: [authenticate("user", ["session", "bearer"])],
    },
    {
      matcher: "/admin/alkemart/moderation/summary",
      methods: ["GET"],
      middlewares: [authenticate("user", ["session", "bearer"])],
    },
    // /vendor/alkemart/markets uses AUTHENTICATE=false (public operating config)
  ],
})
