/**
 * Bump catalog Redis generation when sellable surface may change.
 * Events: product / offer / seller lifecycle (best-effort; TTL is the safety net).
 */
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { invalidateCatalogCache } from "../lib/catalog-cache"

export default async function catalogCacheInvalidate({
  event,
}: SubscriberArgs<Record<string, unknown>>) {
  const name = event?.name || "unknown"
  try {
    await invalidateCatalogCache(String(name))
  } catch (e) {
    console.error(
      "[catalog-cache] invalidate failed",
      name,
      e instanceof Error ? e.message : e,
    )
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
