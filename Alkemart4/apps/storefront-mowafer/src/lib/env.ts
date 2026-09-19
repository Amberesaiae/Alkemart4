/**
 * Fail-closed Workers commerce config. Medusa dual-path is not used in this lab.
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

/** Cloudflare Workers commerce origin. Empty in tests / unconfigured lab. */
export function getAlkemartApiUrl(): string {
  const v = (import.meta.env.VITE_ALKEMART_API_URL as string | undefined)?.trim()
  if (!v) return ""
  if (isProd() && (v.includes("localhost") || v.includes("127.0.0.1"))) {
    throw new Error("VITE_ALKEMART_API_URL must not be localhost in production builds")
  }
  return v.replace(/\/$/, "")
}

export function useWorkersCommerce(): boolean {
  return Boolean(getAlkemartApiUrl())
}

export function isCardEnabled(): boolean {
  return flagEnabled("VITE_FEATURE_CARD", true)
}

export function getVendorAppUrl(): string {
  const next = (import.meta.env.VITE_VENDOR_APP_URL as string | undefined)?.trim()
  if (next) return next.replace(/\/$/, "")
  return ""
}
