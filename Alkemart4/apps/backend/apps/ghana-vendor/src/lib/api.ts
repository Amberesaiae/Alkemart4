/**
 * Alkemart Ghana Vendor — Typed API client
 *
 * Single source of truth for every endpoint the Seller SPA calls.
 * Handles:
 *  - session cookie auth (credentials: 'include')
 *  - x-seller-id header for Mercur seller scoping
 *  - Structured ApiError on non-2xx
 *  - Seller context persistence across page refreshes (localStorage)
 *
 * Endpoint mapping (Mercur v2.2.x):
 *   Auth          → /auth/member/emailpass[/register]
 *   Seller        → /vendor/sellers/*, /vendor/members/me
 *   Products      → /vendor/products, /vendor/alkemart/products (lightweight)
 *   Offers        → /vendor/offers
 *   Orders        → /vendor/orders (NOT /admin/orders — vendor-scoped)
 *   Stats         → /vendor/alkemart/stats
 *   Onboarding    → /vendor/alkemart/onboarding/*
 *   Quick-list    → /vendor/alkemart/quick-list
 *   Uploads       → /vendor/uploads
 */

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ---------------------------------------------------------------------------
// Seller context — persisted in localStorage so the header survives refresh
// ---------------------------------------------------------------------------

const SELLER_KEY = "alk:seller_id"
let _sellerId: string | null = null

export function setActiveSellerId(id: string | null): void {
  _sellerId = id
  try {
    if (id) localStorage.setItem(SELLER_KEY, id)
    else localStorage.removeItem(SELLER_KEY)
  } catch {
    // SSR / private mode — ignore
  }
}

export function getActiveSellerId(): string | null {
  if (_sellerId) return _sellerId
  try {
    _sellerId = localStorage.getItem(SELLER_KEY)
  } catch {
    /* ignore */
  }
  return _sellerId
}

// ---------------------------------------------------------------------------
// Base fetch
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const sellerId = getActiveSellerId()
  const extraHeaders: Record<string, string> = {}
  if (sellerId) extraHeaders["x-seller-id"] = sellerId
  if (init.body !== undefined && typeof init.body === "string") {
    extraHeaders["Content-Type"] = "application/json"
  }

  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...extraHeaders,
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  if (res.status === 401) {
    // Session expired — clear seller context so UI redirects to login
    setActiveSellerId(null)
    throw new ApiError(401, "Session expired. Please sign in again.")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as {
      error?: string
      message?: string
      type?: string
    }
    const msg = body.error || body.message || `HTTP ${res.status}`
    throw new ApiError(res.status, msg)
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T
  }
  return res.json() as Promise<T>
}

function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  if (params) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) sp.set(k, String(v))
    }
    const qs = sp.toString()
    if (qs) path = `${path}?${qs}`
  }
  return apiFetch<T>(path)
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function del<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SellerStatus = "pending_approval" | "open" | "suspended" | "terminated"
export type ProductStatus = "draft" | "proposed" | "published" | "rejected"

export type SellerAddress = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  country_code?: string | null
  province?: string | null
  postal_code?: string | null
}

export type SellerPaymentDetails = {
  payment_method?: string | null
  phone?: string | null
  provider?: string | null
  account_name?: string | null
  [key: string]: unknown
}

export type Seller = {
  id: string
  name?: string | null
  handle?: string | null
  email?: string | null
  status: SellerStatus
  currency_code?: string | null
  address?: SellerAddress | null
  payment_details?: SellerPaymentDetails | null
}

export type SellerMember = {
  id: string
  is_owner?: boolean
  member?: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }
  rbac_role?: { id: string; name: string }
  seller?: Seller
}

export type AlkemartMe = {
  id: string
  name?: string | null
  email?: string | null
  seller_id?: string | null
  seller_name?: string | null
  profile?: { phone?: string | null; name?: string | null }
}

export type Product = {
  id: string
  title?: string | null
  handle?: string | null
  status?: ProductStatus | null
  thumbnail?: string | null
  description?: string | null
  categories?: { id: string; name?: string | null }[]
  images?: { url: string }[]
  variants?: ProductVariant[]
  created_at?: string | null
  updated_at?: string | null
}

export type ProductVariant = {
  id: string
  title?: string | null
  sku?: string | null
  prices?: { amount: number; currency_code: string }[]
}

export type Offer = {
  id: string
  seller_id?: string
  variant_id?: string
  product_id?: string
  sku?: string | null
  prices?: { amount: number; currency_code: string }[]
  inventory_items?: { id: string; stocked_quantity?: number }[]
}

export type Order = {
  id: string
  display_id?: number
  status: string
  email?: string | null
  currency_code?: string
  total?: number
  item_total?: number
  shipping_total?: number
  subtotal?: number
  payment_status?: string
  fulfillment_status?: string
  customer_id?: string | null
  items?: OrderItem[]
  shipping_address?: Record<string, unknown>
  fulfillments?: Fulfillment[]
  created_at?: string
  updated_at?: string
  canceled_at?: string | null
}

export type OrderItem = {
  id: string
  title?: string | null
  quantity?: number
  unit_price?: number
  thumbnail?: string | null
  product_id?: string
  variant_title?: string | null
}

export type Fulfillment = {
  id: string
  packed_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  canceled_at?: string | null
  requires_shipping?: boolean
  location_id?: string
  labels?: { tracking_number?: string; tracking_url?: string }[]
}

export type VendorStats = {
  orders_count?: number
  gmv_ghs?: number
  offers_count?: number
  products_count?: number
  readiness?: {
    phase: string
    setup_complete: boolean
    can_propose_products: boolean
    can_create_offers: boolean
    checklist: Record<string, boolean>
    next_action?: { code: string; label: string } | null
  } | null
  series?: {
    days: { date: string; orders: number; gmv: number }[]
    primary_currency: string
  }
  [key: string]: unknown
}

export type SellerReadiness = {
  seller_id: string
  phase: "pending_approval" | "rejected" | "setup_incomplete" | "active" | "suspended" | "terminated"
  mercur_status: string
  setup_complete: boolean
  can_propose_products: boolean
  can_create_offers: boolean
  checklist: Record<string, boolean>
  next_action?: { code: string; label: string } | null
  poll_after_seconds?: number
  cache?: string
}

export type ProductQuality = {
  score: number
  band: "poor" | "fair" | "good" | "excellent"
  blocking: string[]
  warnings: string[]
}

export type Pagination<T> = {
  count: number
  limit: number
  offset: number
  data: T
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const auth = {
  /**
   * Login as a seller member.
   * Mercur actor_type = "member" (NOT "seller" — common mistake).
   */
  login: (email: string, password: string) =>
    post<{ token?: string }>("/auth/member/emailpass", { email, password }),

  /**
   * Register a new auth identity for a seller member.
   * Creates the identity; does NOT create the Seller record.
   * Follow with vendor.sellers.create() to create the Seller.
   */
  register: (email: string, password: string) =>
    post<{ token?: string }>("/auth/member/emailpass/register", { email, password }),

  /**
   * Invalidate the current session / bearer token.
   */
  logout: () =>
    del<void>("/auth/session"),
}

// ---------------------------------------------------------------------------
// Vendor — Seller
// ---------------------------------------------------------------------------

export const seller = {
  /**
   * GET /vendor/sellers/me — current seller profile.
   * Includes address, payment_details from Mercur.
   */
  me: () =>
    get<{ seller: Seller }>("/vendor/sellers/me"),

  /**
   * GET /vendor/members/me — current member with nested seller context.
   * Richest profile endpoint: member + rbac_role + seller.
   */
  memberMe: () =>
    get<{ seller_member: SellerMember }>("/vendor/members/me"),

  /**
   * GET /vendor/alkemart/me — Alkemart custom convenience endpoint.
   * Used to resolve seller_id for the x-seller-id header after login.
   */
  alkemartMe: () =>
    get<AlkemartMe>("/vendor/alkemart/me"),

  /**
   * POST /vendor/sellers — Register a new seller.
   * allowUnregistered: true — call after creating auth identity.
   */
  create: (input: {
    name: string
    email: string
    currency_code?: string
    handle?: string
    first_name?: string
    last_name?: string
    phone?: string
  }) =>
    post<{ seller: Seller }>("/vendor/sellers", {
      ...input,
      currency_code: input.currency_code ?? "ghs",
    }),

  /**
   * POST /vendor/sellers/select — Bind a seller to the current session.
   * MUST be called after login if the member belongs to multiple sellers,
   * or to ensure ensureSellerMiddleware has seller_context in the session.
   */
  select: (sellerId: string) =>
    post<{ success: boolean }>("/vendor/sellers/select", { seller_id: sellerId }),

  /**
   * POST /vendor/sellers/me — Update current seller profile fields.
   */
  update: (input: { name?: string; handle?: string; currency_code?: string }) =>
    post<{ seller: Seller }>("/vendor/sellers/me", input),

  /**
   * POST /vendor/sellers/:id/address — Upsert seller's pack / dispatch address.
   */
  updateAddress: (sellerId: string, address: SellerAddress) =>
    post<{ seller: Seller }>(`/vendor/sellers/${sellerId}/address`, address),

  /**
   * POST /vendor/sellers/:id/payment-details — Upsert MoMo / payout info.
   */
  updatePaymentDetails: (
    sellerId: string,
    details: SellerPaymentDetails,
  ) =>
    post<{ seller: Seller }>(`/vendor/sellers/${sellerId}/payment-details`, details),
}

// ---------------------------------------------------------------------------
// Vendor — Products
// ---------------------------------------------------------------------------

export const products = {
  /**
   * GET /vendor/alkemart/products — Alkemart lightweight exclusive list.
   * Fast: product_seller ownership only, no heavy Mercur graph.
   * Fields: id, title, handle, status, thumbnail.
   */
  list: (params?: { limit?: number; offset?: number }) =>
    get<{ products: Product[]; count: number; limit: number; offset: number }>(
      "/vendor/alkemart/products",
      params,
    ),

  /**
   * GET /vendor/products — Mercur full product list (seller-scoped).
   * Slower but returns full graph including variants, categories.
   */
  mercurList: (params?: {
    limit?: number
    offset?: number
    status?: ProductStatus
    q?: string
  }) =>
    get<{ products: Product[]; count: number; limit: number; offset: number }>(
      "/vendor/products",
      params,
    ),

  /**
   * GET /vendor/products/:id — Full product detail with variants.
   */
  get: (id: string) =>
    get<{ product: Product }>(`/vendor/products/${id}`),

  /**
   * GET /vendor/alkemart/products/:id/quality — Quality score.
   */
  quality: (id: string) =>
    get<{ quality: ProductQuality; product_id: string }>(
      `/vendor/alkemart/products/${id}/quality`,
    ),

  /**
   * POST /vendor/alkemart/products/:id/propose — Submit for admin review.
   */
  propose: (id: string) =>
    post<{ success: boolean; product_id: string }>(
      `/vendor/alkemart/products/${id}/propose`,
    ),

  /**
   * POST /vendor/alkemart/quick-list — One-shot listing (product + offer).
   * Ghana-optimised: title + price_ghs + optional image_url.
   * Returns product_id with status: "proposed".
   */
  quickList: (input: {
    title: string
    description?: string
    price_ghs: number
    quantity?: number
    category_id?: string
    image_url?: string
  }) =>
    post<{ product_id: string; status: string; message: string }>(
      "/vendor/alkemart/quick-list",
      input,
    ),

  /**
   * POST /vendor/uploads — Upload a file (image) and get back a URL.
   * Use for quick-sell photo before calling quickList.
   */
  upload: async (file: File): Promise<string> => {
    const form = new FormData()
    form.append("files", file)
    const res = await fetch("/vendor/uploads", {
      method: "POST",
      credentials: "include",
      headers: (() => {
        const h: Record<string, string> = {}
        const id = getActiveSellerId()
        if (id) h["x-seller-id"] = id
        return h
      })(),
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string }
      throw new ApiError(res.status, body.message || "Upload failed")
    }
    const data = await res.json() as { files?: { url: string }[]; url?: string }
    const url = data.files?.[0]?.url ?? data.url
    if (!url) throw new ApiError(500, "Upload succeeded but returned no URL")
    return url
  },
}

// ---------------------------------------------------------------------------
// Vendor — Offers
// ---------------------------------------------------------------------------

export const offers = {
  /**
   * GET /vendor/offers — List this seller's offers.
   */
  list: (params?: { limit?: number; offset?: number; product_id?: string }) =>
    get<{ offers: Offer[]; count: number; limit: number; offset: number }>(
      "/vendor/offers",
      params,
    ),

  /**
   * GET /vendor/offers/:id — Offer detail.
   */
  get: (id: string) =>
    get<{ offer: Offer }>(`/vendor/offers/${id}`),

  /**
   * POST /vendor/offers/:id — Update price / sku on an existing offer.
   */
  update: (
    id: string,
    input: { prices?: { amount: number; currency_code: string }[]; sku?: string },
  ) =>
    post<{ offer: Offer }>(`/vendor/offers/${id}`, input),

  /**
   * DELETE /vendor/offers/:id — Remove an offer (unlists from store).
   */
  delete: (id: string) =>
    del<{ id: string; deleted: boolean }>(`/vendor/offers/${id}`),
}

// ---------------------------------------------------------------------------
// Vendor — Orders  (use /vendor/orders — NOT /admin/orders)
// ---------------------------------------------------------------------------

export const orders = {
  /**
   * GET /vendor/orders — Orders scoped to this seller.
   * Mercur filters automatically by seller_id from session / x-seller-id.
   */
  list: (params?: {
    limit?: number
    offset?: number
    status?: string
    payment_status?: string
    fulfillment_status?: string
    created_at_from?: string
    created_at_to?: string
  }) =>
    get<{ orders: Order[]; count: number; limit: number; offset: number }>(
      "/vendor/orders",
      params,
    ),

  /**
   * GET /vendor/orders/:id — Single order detail.
   */
  get: (id: string) =>
    get<{ order: Order }>(`/vendor/orders/${id}`),

  /**
   * POST /vendor/orders/:id/fulfillments — Create a fulfillment.
   */
  createFulfillment: (
    orderId: string,
    input: { items: { id: string; quantity: number }[]; location_id?: string },
  ) =>
    post<{ fulfillment: Fulfillment }>(
      `/vendor/orders/${orderId}/fulfillments`,
      { ...input, requires_shipping: true },
    ),

  /**
   * POST /vendor/orders/:id/fulfillments/:fid/shipments — Mark as shipped.
   */
  markShipped: (
    orderId: string,
    fulfillmentId: string,
    labels: { tracking_number: string; tracking_url?: string }[],
  ) =>
    post<{ fulfillment: Fulfillment }>(
      `/vendor/orders/${orderId}/fulfillments/${fulfillmentId}/shipments`,
      { labels },
    ),

  /**
   * POST /vendor/orders/:id/fulfillments/:fid/mark-as-delivered
   */
  markDelivered: (orderId: string, fulfillmentId: string) =>
    post<{ fulfillment: Fulfillment }>(
      `/vendor/orders/${orderId}/fulfillments/${fulfillmentId}/mark-as-delivered`,
    ),
}

// ---------------------------------------------------------------------------
// Vendor — Stats & Onboarding
// ---------------------------------------------------------------------------

export const stats = {
  /**
   * GET /vendor/alkemart/stats — Live ops snapshot: orders, GMV, products, offers.
   * Also returns readiness checklist.
   */
  get: () =>
    get<VendorStats>("/vendor/alkemart/stats"),

  /**
   * GET /vendor/alkemart/onboarding/status — Seller readiness evaluation.
   * Poll periodically when phase !== "active".
   */
  readiness: () =>
    get<SellerReadiness>("/vendor/alkemart/onboarding/status"),
}

export const onboarding = {
  /**
   * POST /vendor/alkemart/onboarding/ghana-setup
   * One-step Ghana delivery setup: address + delivery fee → moves seller to active phase.
   */
  ghanaSetup: (input: {
    pack_from_name?: string
    address_1: string
    city: string
    region?: string
    postal_code?: string
    phone?: string
    delivery_fee_ghs?: number
    delivery_label?: string
  }) =>
    post<{ message: string; phase?: string; setup_complete?: boolean }>(
      "/vendor/alkemart/onboarding/ghana-setup",
      input,
    ),
}

// ---------------------------------------------------------------------------
// Vendor — Catalog support
// ---------------------------------------------------------------------------

export const catalog = {
  /**
   * GET /vendor/product-categories — Category list for product tagging.
   */
  categories: () =>
    get<{ product_categories: { id: string; name: string; handle: string }[] }>(
      "/vendor/product-categories",
    ),

  /**
   * GET /vendor/alkemart/markets — Operating regions / delivery areas.
   */
  markets: () =>
    get<{ markets: { id: string; name: string; countries: string[] }[] }>(
      "/vendor/alkemart/markets",
    ),
}

// ---------------------------------------------------------------------------
// Convenience: complete login flow
// ---------------------------------------------------------------------------

/**
 * Full login + seller-select sequence.
 * 1. POST /auth/member/emailpass
 * 2. GET /vendor/alkemart/me → resolve seller_id
 * 3. POST /vendor/sellers/select → bind seller to session
 * 4. Persist seller_id for x-seller-id header
 * Returns the seller_id on success.
 */
export async function loginAndSelectSeller(
  email: string,
  password: string,
): Promise<{ sellerId: string | null; me: AlkemartMe }> {
  await auth.login(email, password)

  const me = await seller.alkemartMe()
  const sellerId = me.seller_id ?? null

  if (sellerId) {
    setActiveSellerId(sellerId)
    // Bind seller to session for Mercur native endpoints
    await seller.select(sellerId).catch(() => {
      // Non-fatal: custom /vendor/alkemart/* endpoints use x-seller-id header fallback
    })
  }

  return { sellerId, me }
}
