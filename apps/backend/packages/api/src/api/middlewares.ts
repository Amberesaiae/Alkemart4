import { defineMiddlewares, authenticate } from "@medusajs/medusa"
import { validateVendorUploads } from "./middlewares/validate-vendor-uploads"

export default defineMiddlewares({
  routes: [
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
      matcher: "/vendor/alkemart/products/*/quality",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
    {
      matcher: "/vendor/alkemart/products/*/propose",
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
