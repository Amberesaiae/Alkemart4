import {
  authenticate,
  type MiddlewareRoute,
} from "@medusajs/framework/http"

export const storeAlkemartAdminMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/alkemart/admin/users",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["POST", "DELETE"],
    matcher: "/store/alkemart/admin/roles",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
]
