import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { loginAs, registerVendor } from "../../lib/session"

export const vendorAuth = new Hono<AppEnv>()
  .post("/register", (c) => registerVendor(c))
  .post("/login", (c) => loginAs(c, "seller_member"))
