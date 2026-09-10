import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { requireAdmin } from "../../middleware/auth"

/** GET /admin/actions — read the admin audit trail (newest first). */
export const adminActions = new Hono<AppEnv>().use("*", requireAdmin).get("/", async (c) => {
  const limitRaw = Number(c.req.query("limit") ?? "50")
  const items = await c.get("auditLog").list({
    targetType: c.req.query("target_type") || undefined,
    targetId: c.req.query("target_id") || undefined,
    limit: Number.isFinite(limitRaw) ? limitRaw : 50,
  })
  return c.json({ items })
})
