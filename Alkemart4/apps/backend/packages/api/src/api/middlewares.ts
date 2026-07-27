import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { validateVendorUploads } from "./middlewares/validate-vendor-uploads"
import { applyStrictSellerProductFilter } from "./middlewares/strict-seller-products"

/** Redirect bare root → admin dashboard (makes the Replit preview useful). */
const redirectRootToDashboard = (
  _req: MedusaRequest,
  res: MedusaResponse,
  _next: MedusaNextFunction,
) => {
  res.redirect(302, "/dashboard")
}

export default defineMiddlewares({
  routes: [
    // ── Dev convenience ─────────────────────────────────────────────────────
    {
      matcher: "/",
      methods: ["GET"],
      middlewares: [redirectRootToDashboard],
    },
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
    // Alkemart vendor product routes (list, detail, update, delete)
    {
      matcher: "/vendor/alkemart/products",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/alkemart/products/*",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/alkemart/products/*",
      methods: ["PUT"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/alkemart/products/*",
      methods: ["DELETE"],
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
    // Login bootstrap: resolve seller_id from JWT (outside /vendor/* to skip ensureSeller)
    {
      matcher: "/alkemart/member/me",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    // /vendor/alkemart/markets uses AUTHENTICATE=false (public operating config)
  ],
})
