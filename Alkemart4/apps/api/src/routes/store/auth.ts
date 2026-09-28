import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { confirmPasswordReset, requestPasswordReset } from "../../lib/password-reset"
import { loginAs, registerBuyer } from "../../lib/session"
import { confirmEmailVerification, requestEmailVerification } from "../../lib/email-verification"
import { requireFreshSession } from "../../middleware/auth"
import { workosAuth } from "../workos-auth"

export const storeAuth = new Hono<AppEnv>()
  .route("/workos", workosAuth("store"))
  .post("/register", (c) => registerBuyer(c))
  .post("/login", (c) => loginAs(c, "buyer"))
  .post("/verify-email/request", requireFreshSession, (c) => requestEmailVerification(c, "buyer", "storefront"))
  .post("/verify-email/confirm", (c) => confirmEmailVerification(c, "buyer"))
  .post("/password-reset/request", (c) => requestPasswordReset(c, "buyer", "storefront"))
  .post("/password-reset/confirm", (c) => confirmPasswordReset(c, "buyer"))
