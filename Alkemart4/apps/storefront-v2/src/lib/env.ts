/**
 * Storefront config — Workers is the only commerce backend.
 * Fail closed: a missing API origin is an error, never a silent fallback.
 */

export function isProd(): boolean {
  return import.meta.env.PROD === true
}

function flagEnabled(name: string, defaultOn: boolean): boolean {
  const raw = (import.meta.env[name] as string | undefined)?.trim()
  if (raw == null || raw === "") return defaultOn
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on"
}

function optionalUrl(name: string): string {
  const v = (import.meta.env[name] as string | undefined)?.trim()
  if (!v) return ""
  if (isProd() && (v.includes("localhost") || v.includes("127.0.0.1"))) {
    throw new Error(`${name} must not be localhost in production builds`)
  }
  return v.replace(/\/$/, "")
}

/**
 * Workers API origin (VITE_ALKEMART_API_URL). Required — every catalog,
 * cart, checkout and account call goes through it.
 */
export function getAlkemartApiUrl(): string {
  const v = optionalUrl("VITE_ALKEMART_API_URL")
  if (!v) {
    throw new Error(
      "Missing VITE_ALKEMART_API_URL. Copy apps/storefront-v2/.env.template → .env.local.",
    )
  }
  return v
}

/** Seller workspace (vendor app) — "Sell on alkemart" links. */
export function getVendorAppUrl(): string {
  return optionalUrl("VITE_VENDOR_APP_URL") || "https://alkemart4-vendor.pages.dev"
}

/** Mobile Money at checkout — off until MoMo is fully enabled for shoppers. */
export function isMomoLabEnabled(): boolean {
  return flagEnabled("VITE_FEATURE_MOMO_LAB", false)
}

/** Card payments via Paystack — on by default; VITE_FEATURE_CARD=0 hides it. */
export function isCardEnabled(): boolean {
  return flagEnabled("VITE_FEATURE_CARD", true)
}

/** Canonical public origin for SEO; empty in lab. */
export function getPublicSiteUrl(): string {
  return optionalUrl("VITE_PUBLIC_SITE_URL")
}
