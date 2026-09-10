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
 * Explicit opt-in for the archived Medusa lab path.
 * Production Workers builds never set this; dual-path stays quarantined.
 */
function allowMedusaLab(): boolean {
  const raw = (import.meta.env.VITE_ALLOW_MEDUSA_LAB as string | undefined)?.trim()
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on"
}

/**
 * Medusa JS SDK — archived lab path only.
 * Fail closed unless `VITE_ALLOW_MEDUSA_LAB=1` **and** a Medusa backend URL
 * is present. Workers commerce (`VITE_ALKEMART_API_URL`) never uses this.
 */
export function getMedusaClient(): Medusa {
  if (useWorkersCommerce() || !allowMedusaLab() || !hasMedusaBackend()) {
    throw new Error(
      "Medusa is quarantined. Workers commerce is canonical; set VITE_ALLOW_MEDUSA_LAB=1 only for archived lab dual-path.",
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
