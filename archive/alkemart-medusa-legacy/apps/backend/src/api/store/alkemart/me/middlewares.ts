import {
  authenticate,
  type MiddlewareRoute,
} from "@medusajs/framework/http"

/**
 * Require customer JWT/session for /store/alkemart/me.
 */
export const storeAlkemartMeMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/alkemart/me",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
