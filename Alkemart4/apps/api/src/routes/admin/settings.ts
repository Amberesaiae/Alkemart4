import { DEFAULT_DEAL_POLICY, DEFAULT_DELIVERY_POLICY, parseDealPolicy, parseDeliveryPolicy } from "@alkemart/domain"
import { DEAL_POLICY_KEY, dealPolicy } from "../../lib/deals"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { DELIVERY_POLICY_KEY, deliveryPolicy } from "../../lib/delivery-policy"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

/**
 * Platform rules admin can tune without a deploy. Each change is validated by
 * the domain, stored in platform_settings, and written to the audit log. New
 * values apply from the next order or delivery; nothing already frozen moves.
 */
export const adminSettings = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/delivery-policy", async (c) => c.json({ policy: await deliveryPolicy(c), defaults: DEFAULT_DELIVERY_POLICY }))
  .put("/delivery-policy", async (c) => {
    const parsed = parseDeliveryPolicy(await readJsonBody(c).catch(() => null))
    if (!parsed.ok) throw new HTTPException(400, { message: parsed.message })
    const before = await deliveryPolicy(c)
    await c.get("settings").set(DELIVERY_POLICY_KEY, parsed.policy, c.get("auth").userId)
    await c.get("auditLog").log({
      adminUserId: c.get("auth").userId,
      action: "settings.delivery_policy",
      targetType: "setting",
      targetId: DELIVERY_POLICY_KEY,
      detail: { before, after: parsed.policy },
    })
    return c.json({ policy: parsed.policy })
  })
  .get("/deal-policy", async (c) => c.json({ policy: await dealPolicy(c), defaults: DEFAULT_DEAL_POLICY }))
  .put("/deal-policy", async (c) => {
    const parsed = parseDealPolicy(await readJsonBody(c).catch(() => null))
    if (!parsed.ok) throw new HTTPException(400, { message: parsed.message })
    const before = await dealPolicy(c)
    await c.get("settings").set(DEAL_POLICY_KEY, parsed.policy, c.get("auth").userId)
    await c.get("auditLog").log({ adminUserId: c.get("auth").userId, action: "settings.deal_policy", targetType: "setting", targetId: DEAL_POLICY_KEY, detail: { before, after: parsed.policy } })
    return c.json({ policy: parsed.policy })
  })
