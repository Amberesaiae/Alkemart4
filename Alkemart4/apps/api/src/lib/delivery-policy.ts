import { deliveryPolicyFrom, type DeliveryPolicy } from "@alkemart/domain"
import type { Context } from "hono"
import type { AppEnv } from "../context"

export const DELIVERY_POLICY_KEY = "delivery_policy"

/** The live delivery policy (admin edits over domain defaults). Never throws. */
export async function deliveryPolicy(c: Context<AppEnv>): Promise<DeliveryPolicy> {
  try {
    return deliveryPolicyFrom(await c.get("settings").get(DELIVERY_POLICY_KEY))
  } catch {
    return deliveryPolicyFrom(null)
  }
}
