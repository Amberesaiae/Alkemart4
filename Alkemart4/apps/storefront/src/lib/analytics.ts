/**
 * Product analytics (PostHog) — env-gated, no PII.
 * Loaded via dynamic import so posthog-js stays out of the critical path.
 */

type Props = Record<string, string | number | boolean | null | undefined>

type PostHogLike = {
  init: (key: string, opts: Record<string, unknown>) => void
  capture: (event: string, props?: Record<string, unknown>) => void
}

let posthog: PostHogLike | null = null
let initialized = false
let initPromise: Promise<void> | null = null

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
 * Dynamically imports posthog-js so the main bundle stays smaller.
 */
export function initAnalytics(): Promise<void> {
  if (initialized) return Promise.resolve()
  if (initPromise) return initPromise
  if (typeof window === "undefined") return Promise.resolve()

  const key = getKey()
  if (!key) {
    initialized = true
    return Promise.resolve()
  }

  initPromise = import("posthog-js")
    .then((mod) => {
      const ph = (mod.default ?? mod) as PostHogLike
      ph.init(key, {
        api_host: getHost(),
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
        persistence: "localStorage+cookie",
        autocapture: false,
        // Don’t block load for remote config
        loaded: () => {
          /* no-op */
        },
      })
      posthog = ph
      initialized = true
    })
    .catch(() => {
      initialized = true
      posthog = null
    })

  return initPromise
}

function safeProps(props?: Props): Record<string, string | number | boolean> {
  if (!props) return {}
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue
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
    if (typeof v === "string" && /^order_[a-zA-Z0-9]+$/.test(v)) continue
    out[k] = v
  }
  return out
}

export function track(event: string, props?: Props): void {
  if (!isAnalyticsEnabled()) return
  if (!initialized || !posthog) {
    // Best-effort: fire after idle init if still booting
    void initAnalytics().then(() => {
      try {
        posthog?.capture(event, safeProps(props))
      } catch {
        /* never break commerce UX */
      }
    })
    return
  }
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
  homepageViewed: "homepage_viewed",
  homepageSearchChip: "homepage_search_chip",
  homepageDepartmentChip: "homepage_department_chip",
  searchLandingViewed: "search_landing_viewed",
  searchSuggestionClicked: "search_suggestion_clicked",
} as const

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

/**
 * Blueprint Doc 10 canonical discovery/comparison/merchandising vocabulary.
 * Additive only — legacy `AnalyticsEvents` names above are untouched.
 * All functions are env-gated no-ops without a PostHog key and never throw.
 */

export function trackCategoryViewed(p: {
  categoryId: string
  slug?: string | null
}): void {
  track("category_viewed", {
    category_id: p.categoryId,
    slug: p.slug ?? undefined,
  })
}

export function trackCollectionViewed(p: {
  collectionId: string
  sellerId?: string | null
}): void {
  track("collection_viewed", {
    collection_id: p.collectionId,
    seller_id: p.sellerId ?? undefined,
  })
}

export function trackFilterApplied(p: {
  dimension: string
  value: string
  categoryId?: string | null
}): void {
  track("filter_applied", {
    dimension: p.dimension,
    value: p.value,
    category_id: p.categoryId ?? undefined,
  })
}

export function trackFilterRemoved(p: {
  dimension: string
  value: string
}): void {
  track("filter_removed", { dimension: p.dimension, value: p.value })
}

export function trackSearchZeroResults(p: { query: string }): void {
  const query = p.query.trim()
  if (!query) return
  track("search_zero_results", { query })
}

export function trackSearchRefined(p: { query: string; fromQuery?: string }): void {
  const query = p.query.trim()
  if (!query) return
  track("search_refined", { query, from_query: p.fromQuery ?? undefined })
}

export function trackComparisonOpened(p: {
  productId: string
  variantId?: string | null
  offerCount: number
}): void {
  track("comparison_opened", {
    product_id: p.productId,
    variant_id: p.variantId ?? undefined,
    offer_count: p.offerCount,
  })
}

export function trackOfferSelected(p: {
  productId: string
  variantId?: string | null
  offerId: string
  sellerId?: string | null
}): void {
  track("offer_selected", {
    product_id: p.productId,
    variant_id: p.variantId ?? undefined,
    offer_id: p.offerId,
    seller_id: p.sellerId ?? undefined,
  })
}

export function trackVariantSelected(p: {
  productId: string
  /** Server variant id when known; matrix picks report `options` instead. */
  variantId?: string | null
  /** Human option signature (e.g. "Size=M · Colour=Red") for matrix picks. */
  options?: string | null
}): void {
  track("variant_selected", {
    product_id: p.productId,
    variant_id: p.variantId ?? undefined,
    options: p.options ?? undefined,
  })
}

export function trackAlternativeSelected(p: {
  productId: string
  alternativeId: string
  source?: string | null
}): void {
  track("alternative_selected", {
    product_id: p.productId,
    alternative_id: p.alternativeId,
    source: p.source ?? undefined,
  })
}

export function trackDeliveryChecked(p: {
  productId?: string | null
  offerId?: string | null
  area?: string | null
  eligible?: boolean
}): void {
  track("delivery_checked", {
    product_id: p.productId ?? undefined,
    offer_id: p.offerId ?? undefined,
    area: p.area ?? undefined,
    eligible: p.eligible ?? undefined,
  })
}

export function trackPromotionViewed(p: {
  placementId: string
  campaignId: string
  creativeId?: string | null
  position?: number | null
}): void {
  track("view_promotion", {
    placement_id: p.placementId,
    campaign_id: p.campaignId,
    creative_id: p.creativeId ?? undefined,
    position: p.position ?? undefined,
  })
}

export function trackPromotionSelected(p: {
  placementId: string
  campaignId: string
  creativeId?: string | null
  position?: number | null
}): void {
  track("select_promotion", {
    placement_id: p.placementId,
    campaign_id: p.campaignId,
    creative_id: p.creativeId ?? undefined,
    position: p.position ?? undefined,
  })
}
