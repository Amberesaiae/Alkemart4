import Medusa from "@medusajs/js-sdk"
import {
  getBackendUrl,
  getPublishableKey,
  getRegionId,
  getSalesChannelId,
} from "./env"

let client: Medusa | null = null

/** Single Medusa JS SDK instance — config only from env. */
export function getMedusaClient(): Medusa {
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
