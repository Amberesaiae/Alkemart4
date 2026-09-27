import { listingPolicyFrom, type ListingPolicy } from "@alkemart/domain"
import type { Context } from "hono"
import type { AppEnv } from "../context"

export const LISTING_POLICY_KEY = "listing_policy"

/** Listing helpers' limits (admin edits over domain defaults). Never throws. */
export async function listingPolicy(c: Context<AppEnv>): Promise<ListingPolicy> {
  try {
    return listingPolicyFrom(await c.get("settings").get(LISTING_POLICY_KEY))
  } catch {
    return listingPolicyFrom(null)
  }
}
