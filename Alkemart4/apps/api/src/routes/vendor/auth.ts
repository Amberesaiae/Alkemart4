import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { confirmPasswordReset, requestPasswordReset } from "../../lib/password-reset"
import { loginAs, registerVendor } from "../../lib/session"

export const vendorAuth = new Hono<AppEnv>()
  .post("/register", (c) => registerVendor(c))
  .post("/login", (c) => loginAs(c, "seller_member"))
  .post("/password-reset/request", (c) => requestPasswordReset(c, "seller_member", "vendor"))
  .post("/password-reset/confirm", (c) => confirmPasswordReset(c, "seller_member"))
