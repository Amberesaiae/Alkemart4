import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { loginAs } from "../../lib/session"

export const adminAuth = new Hono<AppEnv>().post("/login", (c) => loginAs(c, "admin"))
