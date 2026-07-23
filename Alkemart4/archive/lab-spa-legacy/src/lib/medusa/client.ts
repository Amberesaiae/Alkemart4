import Medusa from "@medusajs/js-sdk"

/**
 * Single Medusa SPA client factory + commerce context (region / sales channel).
 *
 * Env rules:
 * - PROD: all required vars must be set; reject empty and `pk_default`.
 * - DEV: publishable key, region, and sales channel are never invented.
 *   Backend URL may fall back to http://localhost:9000 when VITE_MEDUSA_BACKEND_URL
 *   is missing (local Medusa default only).
 */

const FAKE_PUBLISHABLE_KEY = "pk_default"
const DEV_DEFAULT_BACKEND_URL = "http://localhost:9000"

function isProd(): boolean {
  return import.meta.env.PROD === true
}

/**
 * Read a Vite env var. In PROD throws if missing/invalid.
 * Rejects `pk_default` and empty strings in all modes when used for critical keys.
 */
export function requiredEnv(name: string): string {
  const raw = import.meta.env[name] as string | undefined
  const v = typeof raw === "string" ? raw.trim() : ""

  if (!v) {
    throw new Error(
      `Missing required env ${name}. Set it in .env (VITE_MEDUSA_*). ` +
        (isProd()
          ? "Production builds cannot start without real commerce configuration."
          : "In DEV, publishable key / region / sales channel must still be real — only backend URL may use a localhost default."),
    )
  }

  if (v === FAKE_PUBLISHABLE_KEY || v.includes(FAKE_PUBLISHABLE_KEY)) {
    throw new Error(
      `Invalid ${name}: "${FAKE_PUBLISHABLE_KEY}" is not a real publishable key. ` +
        `Create a key in Medusa Admin and set ${name}.`,
    )
  }

  if (isProd() && name === "VITE_MEDUSA_BACKEND_URL" && v.includes("localhost")) {
    throw new Error(`Invalid ${name}: localhost backend URL is not allowed in production.`)
  }

  return v
}

function resolveBackendUrl(): string {
  const raw = import.meta.env.VITE_MEDUSA_BACKEND_URL as string | undefined
  const v = typeof raw === "string" ? raw.trim() : ""

  if (v) {
    if (isProd() && v.includes("localhost")) {
      throw new Error(
        `Invalid VITE_MEDUSA_BACKEND_URL: localhost is not allowed in production.`,
      )
    }
    return v
  }

  // DEV only: local Medusa default when env is omitted.
  if (!isProd()) {
    return DEV_DEFAULT_BACKEND_URL
  }

  throw new Error("Missing required env VITE_MEDUSA_BACKEND_URL")
}

function resolvePublishableKey(): string {
  // Never fall back to pk_default — cart/store APIs will fail silently otherwise.
  return requiredEnv("VITE_MEDUSA_PUBLISHABLE_KEY")
}

export function createMedusaClient(): Medusa {
  return new Medusa({
    baseUrl: resolveBackendUrl(),
    publishableKey: resolvePublishableKey(),
    auth: {
      type: "jwt",
      jwtTokenStorageMethod: "local",
    },
  })
}

/**
 * Lazy commerce context. Call at cart/product request time so missing env
 * surfaces as a clear error rather than inventing region/SC IDs at module load.
 */
export const commerceContext = {
  regionId(): string {
    return requiredEnv("VITE_MEDUSA_REGION_ID")
  },
  salesChannelId(): string {
    return requiredEnv("VITE_MEDUSA_SALES_CHANNEL_ID")
  },
  /**
   * Best-effort region for product list/retrieve (calculated prices).
   * Returns undefined if region is not configured yet (e.g. partial local setup).
   */
  tryRegionId(): string | undefined {
    try {
      return commerceContext.regionId()
    } catch {
      return undefined
    }
  },
}
