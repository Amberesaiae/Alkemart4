import { defineMiddlewares } from "@medusajs/framework/http"
import { storeAlkemartMeMiddlewares } from "./store/alkemart/me/middlewares"
import { storeAlkemartAdminMiddlewares } from "./store/alkemart/admin/middlewares"

/**
 * Preserve raw body for Paystack webhook HMAC verification.
 * @see https://docs.medusajs.com/learn/fundamentals/api-routes/parse-body
 */
export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/hooks/paystack",
      bodyParser: { preserveRawBody: true },
    },
    ...storeAlkemartMeMiddlewares,
    ...storeAlkemartAdminMiddlewares,
  ],
})
