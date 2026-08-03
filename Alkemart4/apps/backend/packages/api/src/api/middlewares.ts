import { authenticate, defineMiddlewares } from "@medusajs/medusa"
import { storeWishlistMiddlewares } from "./store/wishlist/middlewares.ts"
import { authRateLimit } from "./middlewares/auth-rate-limit.ts"
import { rateLimit } from "./middlewares/rate-limit.ts"
import { csrfProtection } from "./middlewares/csrf-protection.ts"
import { inputSanitize } from "./middlewares/input-sanitize.ts"
import { securityHeaders } from "./middlewares/security-headers.ts"

export default defineMiddlewares({
  routes: [
    ...storeWishlistMiddlewares,
    {
      matcher: "/store/auth/*",
      middlewares: [authRateLimit],
    },
    {
      matcher: "/admin/auth/*",
      middlewares: [authRateLimit],
    },
    {
      matcher: "/vendor/auth/*",
      middlewares: [authRateLimit],
    },
    {
      matcher: "/store/search/*",
      middlewares: [rateLimit],
    },
    {
      matcher: "/store/alkemart/catalog/*",
      middlewares: [rateLimit],
    },
    {
      matcher: "/store/alkemart/vendors/*",
      middlewares: [rateLimit],
    },
    {
      matcher: "/store/featured-products/*",
      middlewares: [rateLimit],
    },
    {
      matcher: "/health/*",
      middlewares: [rateLimit],
    },
    {
      method: ["GET"],
      matcher: "/alkemart/member/me",
      middlewares: [
        authenticate("member", ["bearer", "session"], {
          allowUnregistered: true,
        }),
      ],
    },
    {
      matcher: "/admin/*",
      middlewares: [securityHeaders],
    },
    {
      matcher: "/vendor/*",
      middlewares: [securityHeaders],
    },
    {
      matcher: "/store/*",
      middlewares: [securityHeaders],
    },
    {
      method: ["POST", "PUT", "DELETE"],
      matcher: "/admin/*",
      middlewares: [csrfProtection],
    },
    {
      method: ["POST", "PUT", "DELETE"],
      matcher: "/vendor/*",
      middlewares: [csrfProtection],
    },
    {
      method: ["POST"],
      matcher: "/hooks/paystack",
      bodyParser: {
        preserveRawBody: true,
        sizeLimit: "1mb",
      },
    },
    {
      matcher: "/*",
      middlewares: [inputSanitize],
    },
  ],
})
