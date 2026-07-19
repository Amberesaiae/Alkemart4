/**
 * Product analytics (PostHog) — env-gated, no PII.
 *
 * System of record for money remains Medusa/Mercur.
 * @see docs/architecture/2026-07-17-data-search-seo-ghana-adaptation-plan.md
 */

import posthog from "posthog-js"

type Props = Record<string, string | number | boolean | null | undefined>

let initialized = false

function getKey(): string {
  const v = (import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined)?.trim()
  return v ?? ""
}

function getHost(): string {
  const v = (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined)?.trim()
  return v || "https://us.i.posthog.com"
}

/** True when a PostHog project key is configured. */
export function isAnalyticsEnabled(): boolean {
  return Boolean(getKey())
}

/**
 * Init once (no-op without key). Safe to call multiple times.
 * Does not capture email, phone, address, or MoMo numbers.
 */
export function initAnalytics(): void {
  if (initialized || typeof window === "undefined") return
  const key = getKey()
  if (!key) return

  posthog.init(key, {
    api_host: getHost(),
    person_profiles: "identified_only",
    capture_pageview: false, // we send $pageview from the router
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    // Avoid automatic form/input capture of addresses/phones
    autocapture: false,
  })
  initialized = true
}

function safeProps(props?: Props): Record<string, string | number | boolean> {
  if (!props) return {}
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue
    // Hard block common PII keys even if a caller slips
    const lower = k.toLowerCase()
    if (
      lower.includes("email") ||
      lower.includes("phone") ||
      lower.includes("address") ||
      lower.includes("password") ||
      lower.includes("momo") ||
      lower.includes("token") ||
      lower.includes("order_id") ||
      lower === "orderid" ||
      lower.includes("customer")
    ) {
      continue
    }
    // Never send full Medusa order ids
    if (typeof v === "string" && /^order_[a-zA-Z0-9]+$/.test(v)) continue
    out[k] = v
  }
  return out
}

export function track(event: string, props?: Props): void {
  if (!initialized || !isAnalyticsEnabled()) return
  try {
    posthog.capture(event, safeProps(props))
  } catch {
    /* never break commerce UX for analytics */
  }
}

export function trackPageview(path: string): void {
  track("$pageview", { path })
}

/** PostHog ecommerce-aligned names where practical. */
export const AnalyticsEvents = {
  productViewed: "product_viewed",
  productAdded: "product_added",
  checkoutStarted: "checkout_started",
  orderCompleted: "order_completed",
  searchPerformed: "search_performed",
  sellerStoreViewed: "seller_store_viewed",
  /** Homepage is the primary discovery + analytics surface */
  homepageViewed: "homepage_viewed",
  homepageSearchChip: "homepage_search_chip",
  homepageDepartmentChip: "homepage_department_chip",
  searchLandingViewed: "search_landing_viewed",
  searchSuggestionClicked: "search_suggestion_clicked",
} as const

/** First-page / discovery analytics — call once catalog has settled. */
export function trackHomepageViewed(p: {
  productCount: number
  categoryCount: number
  sellerCount: number
  hasFeatured: boolean
}): void {
  track(AnalyticsEvents.homepageViewed, {
    product_count: p.productCount,
    category_count: p.categoryCount,
    seller_count: p.sellerCount,
    has_featured: p.hasFeatured,
    surface: "storefront_home",
  })
}

export function trackSearchLandingViewed(): void {
  track(AnalyticsEvents.searchLandingViewed, { surface: "search_empty" })
}

export function trackProductViewed(p: {
  productId: string
  name?: string | null
  price?: number | null
  currency?: string | null
  sellerId?: string | null
}): void {
  track(AnalyticsEvents.productViewed, {
    product_id: p.productId,
    product_name: p.name ?? undefined,
    price: p.price ?? undefined,
    currency: p.currency ?? undefined,
    seller_id: p.sellerId ?? undefined,
  })
}

export function trackProductAdded(p: {
  productId?: string | null
  offerId: string
  quantity: number
  price?: number | null
  currency?: string | null
}): void {
  track(AnalyticsEvents.productAdded, {
    product_id: p.productId ?? undefined,
    offer_id: p.offerId,
    quantity: p.quantity,
    price: p.price ?? undefined,
    currency: p.currency ?? undefined,
  })
}

export function trackCheckoutStarted(p: {
  itemCount: number
  cartTotal?: number | null
  currency?: string | null
}): void {
  track(AnalyticsEvents.checkoutStarted, {
    item_count: p.itemCount,
    cart_total: p.cartTotal ?? undefined,
    currency: p.currency ?? undefined,
  })
}

/** Never send raw order ids to analytics (privacy). */
export function trackOrderCompleted(p: {
  orderId?: string
  paymentMethod?: string
  itemCount?: number
  total?: number | null
  currency?: string | null
}): void {
  track(AnalyticsEvents.orderCompleted, {
    payment_method: p.paymentMethod ?? "cod",
    item_count: p.itemCount ?? undefined,
    has_total: p.total != null,
    currency: p.currency ?? undefined,
  })
}

export function trackSearchPerformed(q: string, resultCount?: number): void {
  const query = q.trim()
  if (!query) return
  track(AnalyticsEvents.searchPerformed, {
    query,
    result_count: resultCount ?? undefined,
  })
}

export function trackSellerStoreViewed(p: {
  sellerHandle: string
  sellerId?: string | null
}): void {
  track(AnalyticsEvents.sellerStoreViewed, {
    seller_handle: p.sellerHandle,
    seller_id: p.sellerId ?? undefined,
  })
}
