import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { confirmPasswordReset, requestPasswordReset } from "../../lib/password-reset"
import { loginAs, registerVendor } from "../../lib/session"
import { confirmEmailVerification, requestEmailVerification } from "../../lib/email-verification"
import { requireFreshSession } from "../../middleware/auth"
import { workosAuth } from "../workos-auth"

export const vendorAuth = new Hono<AppEnv>()
  .route("/workos", workosAuth("vendor"))
  .post("/register", (c) => registerVendor(c))
  .post("/login", (c) => loginAs(c, "seller_member"))
  .post("/verify-email/request", requireFreshSession, (c) => requestEmailVerification(c, "seller_member", "vendor"))
  .post("/verify-email/confirm", (c) => confirmEmailVerification(c, "seller_member"))
  .post("/password-reset/request", (c) => requestPasswordReset(c, "seller_member", "vendor"))
  .post("/password-reset/confirm", (c) => confirmPasswordReset(c, "seller_member"))
