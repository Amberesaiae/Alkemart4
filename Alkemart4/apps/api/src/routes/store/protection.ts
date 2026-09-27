import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { returnPolicy } from "../../lib/returns"

/**
 * alkemart Buyer Protection, in numbers the storefront can show. Online
 * payments are held until the buyer has the order (the seller is paid after
 * delivery); faulty, wrong or not-as-described items can be returned for at
 * least `faultReturnDays`. Pay-on-delivery cash goes straight to the seller,
 * so it isn't held. Numbers come from the admin return policy.
 */
export const storeProtection = new Hono<AppEnv>().get("/", async (c) => {
  const p = await returnPolicy(c)
  c.header("Cache-Control", "public, max-age=300")
  return c.json({ faultReturnDays: p.faultReturnDays, heldUntilDelivered: ["momo", "card"] })
})
