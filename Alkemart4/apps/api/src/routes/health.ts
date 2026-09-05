import { Hono } from "hono"
import type { AppEnv } from "../context"
import { primaryDb } from "../db"
import { parseEnv } from "../env"
import { sql } from "drizzle-orm"

export const health = new Hono<AppEnv>()
  .get("/", (c) => c.json({ ok: true, service: "alkemart-api" }))
  .get("/ready", async (c) => {
    const checks: Record<string, "ok" | "fail" | "degraded" | "skip"> = {
      paystack: "skip",
      postgres: "skip",
    }
    let ready = true

    const raw = c.env as unknown as Record<string, unknown> | undefined
    try {
      const env = parseEnv(raw ?? {})
      // COD works without Paystack; MoMo/card need the secret.
      checks.paystack = env.PAYSTACK_SECRET_KEY ? "ok" : "degraded"

      const db = primaryDb(env)
      await db.execute(sql`select 1`)
      checks.postgres = "ok"
    } catch {
      checks.postgres = "fail"
      ready = false
    }

    return c.json({ ok: ready, service: "alkemart-api", checks }, ready ? 200 : 503)
  })
