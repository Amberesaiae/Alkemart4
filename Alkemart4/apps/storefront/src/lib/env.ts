/**
 * Fail-closed commerce config — no hardcodes, no invented IDs/keys.
 * @see docs/architecture/2026-07-16-no-hardcodes-no-magic.md
 */

const FAKE_PUBLISHABLE_KEY = "pk_default"

export function isProd(): boolean {
  return import.meta.env.PROD === true
}

function flagEnabled(name: string, defaultOn: boolean): boolean {
  const raw = (import.meta.env[name] as string | undefined)?.trim()
  if (raw == null || raw === "") return defaultOn
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on"
}

/**
 * Lab-only: surface Admin / ops links on the public shop.
 * Production default: never show Admin on buyer chrome.
 * Set VITE_SHOW_ADMIN_LINK=1 only for internal lab builds.
 */
export function showAdminLinkOnShop(): boolean {
  if (!isProd()) {
    return flagEnabled("VITE_SHOW_ADMIN_LINK", true)
  }
  return flagEnabled("VITE_SHOW_ADMIN_LINK", false)
}

/**
 * Public “sell with us” entry (/sell + Seller Hub) is OK on production.
 * Ops map (/partners with Admin) is lab-only unless flagged.
 */
export function showOpsPartnersPage(): boolean {
  if (!isProd()) {
    return flagEnabled("VITE_SHOW_OPS_PARTNERS", true)
  }
  return flagEnabled("VITE_SHOW_OPS_PARTNERS", false)
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

/**
 * Cloudflare Workers commerce origin is set.
 * When true, Medusa/Mercur env is optional and Medusa SDK paths must not run.
 */
export function useWorkersCommerce(): boolean {
  const v = (import.meta.env.VITE_ALKEMART_API_URL as string | undefined)?.trim()
  return Boolean(v)
}

function optionalEnv(name: string): string {
  const raw = import.meta.env[name] as string | undefined
  return typeof raw === "string" ? raw.trim() : ""
}

/** Medusa backend URL — required only when Workers commerce is not configured. */
export function getBackendUrl(): string {
  if (useWorkersCommerce()) {
    return optionalEnv("VITE_MEDUSA_BACKEND_URL").replace(/\/$/, "")
  }
  return requiredEnv("VITE_MEDUSA_BACKEND_URL").replace(/\/$/, "")
}

export function getPublishableKey(): string {
  if (useWorkersCommerce()) {
    return optionalEnv("VITE_MEDUSA_PUBLISHABLE_KEY")
  }
  return requiredEnv("VITE_MEDUSA_PUBLISHABLE_KEY")
}

export function getRegionId(): string {
  if (useWorkersCommerce()) {
    return optionalEnv("VITE_MEDUSA_REGION_ID")
  }
  return requiredEnv("VITE_MEDUSA_REGION_ID")
}

export function getSalesChannelId(): string {
  if (useWorkersCommerce()) {
    return optionalEnv("VITE_MEDUSA_SALES_CHANNEL_ID")
  }
  return requiredEnv("VITE_MEDUSA_SALES_CHANNEL_ID")
}

/** True when a Medusa backend URL is present (lab dual-path). */
export function hasMedusaBackend(): boolean {
  return Boolean(getBackendUrl())
}

/** Optional external Mercur panel URLs — empty string if unset (no invented defaults). */
/**
 * Vendor app URL (Workers-native seller workspace).
 * Prefers VITE_VENDOR_APP_URL, then legacy VITE_MERCUR_VENDOR_URL.
 */
export function getMercurVendorUrl(): string {
  const next = (import.meta.env.VITE_VENDOR_APP_URL as string | undefined)?.trim()
  if (next) return next.replace(/\/$/, "")
  const legacy = (import.meta.env.VITE_MERCUR_VENDOR_URL as string | undefined)?.trim()
  if (legacy) return legacy.replace(/\/$/, "")
  return "https://alkemart4-vendor.pages.dev"
}

/**
 * Admin panel URL for lab/ops tooling only.
 * Prefers VITE_ADMIN_APP_URL, then legacy VITE_MERCUR_ADMIN_URL.
 */
export function getMercurAdminUrl(): string {
  if (!showAdminLinkOnShop()) return ""
  const next = (import.meta.env.VITE_ADMIN_APP_URL as string | undefined)?.trim()
  if (next) return next.replace(/\/$/, "")
  const legacy = (import.meta.env.VITE_MERCUR_ADMIN_URL as string | undefined)?.trim()
  if (legacy) return legacy.replace(/\/$/, "")
  return "https://alkemart4-admin.pages.dev"
}

/**
 * Feature flag: show Mobile Money at checkout.
 * Default off until MoMo is fully enabled for shoppers.
 */
export function isMomoLabEnabled(): boolean {
  const v = (import.meta.env.VITE_FEATURE_MOMO_LAB as string | undefined)?.trim()
  return v === "1" || v === "true" || v === "yes"
}

/**
 * Card payments at checkout.
 * Default on — Paystack provider handles card natively.
 * Set VITE_FEATURE_CARD=0 to hide the card option.
 */
export function isCardEnabled(): boolean {
  return flagEnabled("VITE_FEATURE_CARD", true)
}

/**
 * Prefer ATC-capable products (offer_id) in browse/home.
 * Default on — set VITE_FILTER_STORE_SELLABLE=false only for lab debugging.
 */
export function filterStoreSellable(): boolean {
  return flagEnabled("VITE_FILTER_STORE_SELLABLE", true)
}

/**
 * Prefer GET /store/alkemart/catalog for unfiltered home/browse lists.
 * Default on — catalog is sellable-oriented (published + offer).
 */
export function useAlkemartCatalog(): boolean {
  return flagEnabled("VITE_USE_ALKEMART_CATALOG", true)
}

/**
 * Cloudflare multivendor API origin (Plan 1+).
 * When set, browse/PLP/PDP/seller shop prefer this API over Medusa catalog.
 * Empty is allowed in lab so Medusa checkout paths keep working.
 * Production builds must not use localhost.
 */
export function getAlkemartApiUrl(): string {
  const v = (import.meta.env.VITE_ALKEMART_API_URL as string | undefined)?.trim()
  if (!v) return ""
  if (isProd() && (v.includes("localhost") || v.includes("127.0.0.1"))) {
    throw new Error("VITE_ALKEMART_API_URL must not be localhost in production builds")
  }
  return v.replace(/\/$/, "")
}

/** True when Cloudflare catalog API is configured for browse surfaces. */
export function useCloudflareCatalog(): boolean {
  return Boolean(getAlkemartApiUrl())
}

/**
 * Optional public site origin (canonical/OG). Required for production builds
 * when set via CI — empty is allowed for lab.
 */
export function getPublicSiteUrl(): string {
  const v = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim()
  if (!v) return ""
  if (isProd() && (v.includes("localhost") || v.includes("127.0.0.1"))) {
    throw new Error("VITE_PUBLIC_SITE_URL must not be localhost in production builds")
  }
  return v.replace(/\/$/, "")
}
