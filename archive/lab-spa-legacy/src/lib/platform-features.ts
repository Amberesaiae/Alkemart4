/**
 * Portal / ops surface policy — clean-slate cutover.
 *
 * Architecture (ADR clean-slate + unclog):
 *   Buyer SPA  → shop only (browse, cart, checkout, account, orders)
 *   Mercur     → seller + admin (never re-implement ops in SPA)
 *
 * Mode B (2026-07-16): honest lab demo freeze.
 *   - Supported buyer payment: cash on delivery
 *   - MoMo is lab-only (VITE_FEATURE_MOMO_LAB=true), not product-complete
 *
 * SPA /admin and /vendor are legacy dual-home. They stay OFF unless you
 * explicitly set VITE_FEATURE_*_PORTAL=true for emergency local debug.
 */

export type OpsBackend = "off" | "express" | "medusa"

/**
 * @deprecated Dual-home ops. Always prefer Mercur URLs.
 * Only returns non-off when an explicit emergency feature flag is set.
 */
function readOpsBackend(): OpsBackend {
  // Emergency only — never treat VITE_OPS_BACKEND=medusa as “SPA is the admin app”.
  if (import.meta.env.VITE_FEATURE_ADMIN_PORTAL === "true") return "medusa"
  if (import.meta.env.VITE_FEATURE_VENDOR_PORTAL === "true") return "express"
  return "off"
}

export function getOpsBackend(): OpsBackend {
  return readOpsBackend()
}

/** External Mercur Vendor Hub (canonical seller UI). */
export function getMercurVendorUrl(): string {
  const raw = (import.meta.env.VITE_MERCUR_VENDOR_URL as string | undefined)?.trim()
  // Prefer API-hosted panel (same origin as Medusa) when unset.
  return raw || "http://localhost:9000/seller"
}

/** External Mercur Admin dashboard (canonical ops UI). */
export function getMercurAdminUrl(): string {
  const raw = (import.meta.env.VITE_MERCUR_ADMIN_URL as string | undefined)?.trim()
  return raw || "http://localhost:9000/dashboard"
}

/** Legacy SPA vendor shell — OFF by default. */
export function isVendorPortalEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_VENDOR_PORTAL === "true"
}

/** Legacy SPA admin shell — OFF by default. */
export function isAdminPortalEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_ADMIN_PORTAL === "true"
}

/** Medusa-specific SPA RBAC pages — OFF unless admin portal emergency flag. */
export function isMedusaRbacAdminEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_ADMIN_PORTAL === "true"
}

export function opsUnavailableMessage(surface: "vendor" | "admin"): string {
  return surface === "vendor"
    ? "Seller tools live in the Mercur Seller Hub — not in this storefront."
    : "Platform admin tools live in the Mercur Admin dashboard — not in this storefront."
}

/**
 * Mode B freeze: MoMo is not product-complete.
 * Opt-in lab only — never default-on for demos that claim production readiness.
 */
export function isMomoLabEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_MOMO_LAB === "true"
}

/** Short lab disclaimer for checkout / orders chrome. */
export function getLabDemoBanner(): string {
  return "Lab demo — cash on delivery is the supported checkout. Not a production marketplace."
}

/** Buyer-facing order number: prefer display_id, never pretend opaque Medusa ids are receipts. */
export function formatOrderNumber(order: {
  displayId?: number | null
  id: string
}): string {
  if (order.displayId != null && Number.isFinite(Number(order.displayId))) {
    return `#${order.displayId}`
  }
  // Last 6 of id for lab traceability — not a formal receipt number
  const tail = order.id.replace(/^order_/, "").slice(-6).toUpperCase()
  return `Lab · ${tail}`
}
