import Medusa from "@medusajs/js-sdk"
import {
  getBackendUrl,
  getPublishableKey,
  getRegionId,
  getSalesChannelId,
  hasMedusaBackend,
  useWorkersCommerce,
} from "./env"

let client: Medusa | null = null

/**
 * Medusa JS SDK — lab / legacy dual-path only.
 * Throws when Workers commerce is configured without a Medusa backend URL
 * so accidental fallthrough fails closed instead of hitting a dead host.
 */
export function getMedusaClient(): Medusa {
  if (useWorkersCommerce() && !hasMedusaBackend()) {
    throw new Error(
      "Medusa is not configured for this Workers build. Use the Cloudflare API path.",
    )
  }
  if (!client) {
    client = new Medusa({
      baseUrl: getBackendUrl(),
      publishableKey: getPublishableKey(),
    })
  }
  return client
}

export function commerceContext() {
  return {
    regionId: getRegionId(),
    salesChannelId: getSalesChannelId(),
  }
}
