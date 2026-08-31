import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { loginAs, registerBuyer } from "../../lib/session"

export const storeAuth = new Hono<AppEnv>()
  .post("/register", (c) => registerBuyer(c))
  .post("/login", (c) => loginAs(c, "buyer"))
