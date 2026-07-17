import { defineMiddlewares, authenticate } from "@medusajs/medusa"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/alkemart/me",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    // Vendor alkemart stats: member auth; ensureSeller is applied by Mercur /vendor/*
    {
      matcher: "/vendor/alkemart/stats",
      methods: ["GET"],
      middlewares: [authenticate("member", ["session", "bearer"])],
    },
  ],
})