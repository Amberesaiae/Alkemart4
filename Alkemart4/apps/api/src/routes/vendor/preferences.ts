import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

const TOPICS = ["stock", "price", "sla", "order", "payout"] as const

const PutBody = z.object({
  topic: z.enum(TOPICS),
  optedIn: z.boolean(),
})

function sellerIdOrThrow(c: { get(k: "auth"): AppEnv["Variables"]["auth"] }): string {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
  return sellerId
}

/**
 * Phase 7A/7C — vendor alert topics. These gate dashboard task categories
 * (low stock, stale price, order SLAs, order events), not SMS: no verified
 * vendor phone exists on file, so alerting a phone number would message a
 * stranger. When an sms sender for vendors exists, these same rows extend
 * to channel sms.
 */
export const vendorPreferences = new Hono<AppEnv>()
  .use("*", requireSeller)
  .get("/", async (c) => {
    const sellerId = sellerIdOrThrow(c)
    const items = await c.get("checkoutRepo").listNotificationPreferences("seller", sellerId)
    return c.json({
      topics: TOPICS.map((topic) => {
        const row = items.find((p) => p.topic === topic)
        return { topic, optedIn: row ? row.optedIn : true, channel: "dashboard" }
      }),
    })
  })
  .put("/", async (c) => {
    const parsed = PutBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const saved = await c.get("checkoutRepo").setNotificationPreference({
      ownerType: "seller",
      ownerId: sellerIdOrThrow(c),
      channel: "dashboard",
      category: "operational",
      topic: parsed.data.topic,
      optedIn: parsed.data.optedIn,
      frequencyCap: null,
    })
    return c.json({ topic: saved.topic, optedIn: saved.optedIn })
  })
