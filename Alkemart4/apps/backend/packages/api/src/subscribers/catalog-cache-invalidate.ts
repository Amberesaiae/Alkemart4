/**
 * Bump catalog Redis generation when sellable surface may change.
 * Events: product / offer / seller lifecycle (best-effort; TTL is the safety net).
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { invalidateCatalogCache } from "../lib/catalog-cache"
import { logger } from "../lib/logger"

export default async function catalogCacheInvalidate({
  event,
}: SubscriberArgs<Record<string, unknown>>) {
  const name = event?.name || "unknown"
  try {
    await invalidateCatalogCache(String(name))
  } catch (e) {
    logger.error("[catalog-cache] invalidate failed", {
      eventName: name,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated",
    "product.deleted",
    "seller.updated",
    "seller.created",
    // Mercur / custom offer events — ignored if never emitted
    "offer.created",
    "offer.updated",
    "offer.deleted",
  ],
}
