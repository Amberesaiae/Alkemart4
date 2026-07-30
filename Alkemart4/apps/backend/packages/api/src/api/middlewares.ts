import { authenticate, defineMiddlewares } from "@medusajs/medusa"
import { storeWishlistMiddlewares } from "./store/wishlist/middlewares"
import { csrfProtection } from "./middlewares/csrf-protection"
import { inputSanitize } from "./middlewares/input-sanitize"
import { securityHeaders } from "./middlewares/security-headers"

export default defineMiddlewares({
  routes: [
    ...storeWishlistMiddlewares,
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
      matcher: "/*",
      middlewares: [inputSanitize],
    },
  ],
})
