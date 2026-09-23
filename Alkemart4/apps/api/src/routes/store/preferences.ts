import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAuth } from "../../middleware/auth"

const PutBody = z.object({
  category: z.enum(["promotional", "operational"]),
  optedIn: z.boolean(),
  frequencyCap: z.number().int().min(1).max(10).optional().nullable(),
})

async function buyerEmail(c: {
  get(k: "auth"): AppEnv["Variables"]["auth"]
  get(k: "authRepo"): AppEnv["Variables"]["authRepo"]
}): Promise<string> {
  const auth = c.get("auth")
  if (auth.role !== "buyer") throw new HTTPException(403, { message: "buyer account required" })
  const user = await c.get("authRepo").findUserById(auth.userId)
  if (!user) throw new HTTPException(401, { message: "unknown buyer" })
  return user.email.toLowerCase()
}

/**
 * Phase 7A — buyer preference center. Transactional service messages
 * (your own order truth) cannot be opted out of and are not listed here;
 * promotional needs explicit opt-in (default off), operational rides along
 * unless refused (default on). Only sms exists as a sender today.
 */
export const storePreferences = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const email = await buyerEmail(c)
    const items = await c.get("checkoutRepo").listNotificationPreferences("buyer", email)
    return c.json({
      email,
      items: items.map((p) => ({
        channel: p.channel,
        category: p.category,
        topic: p.topic,
        optedIn: p.optedIn,
        frequencyCap: p.frequencyCap,
      })),
    })
  })
  .put("/", async (c) => {
    const parsed = PutBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const email = await buyerEmail(c)
    const saved = await c.get("checkoutRepo").setNotificationPreference({
      ownerType: "buyer",
      ownerId: email,
      channel: "sms",
      category: parsed.data.category,
      topic: null,
      optedIn: parsed.data.optedIn,
      frequencyCap: parsed.data.frequencyCap ?? null,
    })
    return c.json({
      preference: {
        channel: saved.channel,
        category: saved.category,
        optedIn: saved.optedIn,
        frequencyCap: saved.frequencyCap,
      },
    })
  })
