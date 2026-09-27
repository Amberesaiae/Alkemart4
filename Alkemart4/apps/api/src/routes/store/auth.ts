import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { confirmPasswordReset, requestPasswordReset } from "../../lib/password-reset"
import { loginAs, registerBuyer } from "../../lib/session"

export const storeAuth = new Hono<AppEnv>()
  .post("/register", (c) => registerBuyer(c))
  .post("/login", (c) => loginAs(c, "buyer"))
  .post("/password-reset/request", (c) => requestPasswordReset(c, "buyer", "storefront"))
  .post("/password-reset/confirm", (c) => confirmPasswordReset(c, "buyer"))
