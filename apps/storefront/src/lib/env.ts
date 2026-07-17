/**
 * Fail-closed commerce config — no hardcodes, no invented IDs/keys.
 * @see docs/architecture/2026-07-16-no-hardcodes-no-magic.md
 */

const FAKE_PUBLISHABLE_KEY = "pk_default"

function isProd(): boolean {
  return import.meta.env.PROD === true
}

/** Required Vite env. Throws if missing or obviously fake. */
export function requiredEnv(name: string): string {
  const raw = import.meta.env[name] as string | undefined
  const v = typeof raw === "string" ? raw.trim() : ""

  if (!v) {
    throw new Error(
      `Missing required env ${name}. Copy apps/storefront/.env.template → .env ` +
        `and fill values from Mercur Admin / seed output (never invent IDs in code).`,
    )
  }

  if (v === FAKE_PUBLISHABLE_KEY || v.includes(FAKE_PUBLISHABLE_KEY)) {
    throw new Error(
      `Invalid ${name}: "${FAKE_PUBLISHABLE_KEY}" is not a real publishable key.`,
    )
  }

  if (
    isProd() &&
    name === "VITE_MEDUSA_BACKEND_URL" &&
    (v.includes("localhost") || v.includes("127.0.0.1"))
  ) {
    throw new Error(
      `Invalid ${name}: localhost is not allowed in production builds.`,
    )
  }

  return v
}

export function getBackendUrl(): string {
  return requiredEnv("VITE_MEDUSA_BACKEND_URL").replace(/\/$/, "")
}

export function getPublishableKey(): string {
  return requiredEnv("VITE_MEDUSA_PUBLISHABLE_KEY")
}

export function getRegionId(): string {
  return requiredEnv("VITE_MEDUSA_REGION_ID")
}

export function getSalesChannelId(): string {
  return requiredEnv("VITE_MEDUSA_SALES_CHANNEL_ID")
}

/** Optional external Mercur panel URLs — empty string if unset (no invented defaults). */
export function getMercurVendorUrl(): string {
  const v = (import.meta.env.VITE_MERCUR_VENDOR_URL as string | undefined)?.trim()
  return v ?? ""
}

export function getMercurAdminUrl(): string {
  const v = (import.meta.env.VITE_MERCUR_ADMIN_URL as string | undefined)?.trim()
  return v ?? ""
}
