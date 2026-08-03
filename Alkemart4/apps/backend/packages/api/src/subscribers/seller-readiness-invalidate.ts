/**
 * Invalidate the seller-readiness Redis cache on seller lifecycle events.
 *
 * Previously readiness was only cleared by the ghana-setup route. An operator
 * status change (approved / suspended / terminated) or any seller.updated
 * (logo / banner / profile) could therefore serve stale readiness to the
 * vendor's onboarding-status poll for up to the 60s TTL.
 *
 * Pattern mirrors catalog-cache-invalidate.ts: best-effort, no-op when Redis
 * is down (getRedisClient returns null → invalidateSellerReadiness returns).
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { logger } from "../lib/logger.ts"
import { invalidateSellerReadiness } from "../lib/seller-readiness-cache.ts"

type SellerEvent = { id?: string; seller_id?: string }

/**
 * Extract the seller id carried by the event payload.
 * Medusa `seller.updated` carries { id, ... }; lifecycle events may expose
 * `seller_id` instead — accept both. Pure helper (unit-tested).
 */
export function sellerIdFromEvent(
  event: SubscriberArgs<SellerEvent>["event"] | undefined,
): string | null {
  if (!event?.data) return null
  const d = event.data as SellerEvent
  const raw = (d.id || d.seller_id || "").trim()
  return raw || null
}

export default async function sellerReadinessInvalidate({
  event,
}: SubscriberArgs<SellerEvent>) {
  const sellerId = sellerIdFromEvent(event)
  if (!sellerId) return
  const name = event?.name || "unknown"
  try {
    await invalidateSellerReadiness(sellerId)
  } catch (e) {
    logger.error("[seller-readiness-invalidate] failed", {
      eventName: name,
      sellerId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export const config: SubscriberConfig = {
  // seller.updated covers profile/logo/banner changes; status events cover
  // operator toggles that flip readiness phase (see deriveSellerPhase).
  event: [
    "seller.updated",
    "seller.created",
    "seller.approved",
    "seller.suspended",
    "seller.unsuspended",
    "seller.terminated",
  ],
}
