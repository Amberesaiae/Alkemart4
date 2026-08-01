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

export interface ApiErrorBody {
  error?: string
  message?: string
  type?: string
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
// Auth token — stored in-memory after login, sent as Bearer on every request
// ---------------------------------------------------------------------------

const TOKEN_KEY = "alk:vendor_token"
let _token: string | null = null

function getToken(): string | null {
  if (_token) return _token
  try { _token = sessionStorage.getItem(TOKEN_KEY) } catch {}
  return _token
}

function setToken(t: string | null) {
  _token = t
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {}
}

// ---------------------------------------------------------------------------
// Base fetch
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const sellerId = getActiveSellerId()
  const extraHeaders: Record<string, string> = {}
  if (sellerId) extraHeaders["x-seller-id"] = sellerId
  const token = getToken()
  if (token) {
    extraHeaders["Authorization"] = `Bearer ${token}`
  }
  const isJsonBody = init.body !== undefined && typeof init.body === "string"
  if (isJsonBody) {
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
    // Unauthenticated — clear seller context so UI redirects to login,
    // but surface the server's real reason instead of a generic "Session
    // expired": login failures say "Invalid email or password", expired
    // tokens say "Not authenticated".
    setActiveSellerId(null)
    const body = await res.json().catch(() => ({})) as unknown as ApiErrorBody
    const msg =
      body.error ||
      body.message ||
      "Session expired. Please sign in again."
    throw new ApiError(401, msg)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as unknown as ApiErrorBody
    const msg = body.error || body.message || `HTTP ${res.status}`
    throw new ApiError(res.status, msg)
  }

  if (res.status === 204) {
    return undefined as unknown as T
  }
  return res.json() as unknown as Promise<T>
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
  metadata?: Record<string, unknown> | null
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
    checklist_labels?: Record<string, string>
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
  checklist_labels?: Record<string, string>
  next_action?: { code: string; label: string } | null
  quick_setup_available?: boolean
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
  login: async (email: string, password: string) => {
    const data = await post<{ token?: string }>("/auth/member/emailpass", { email, password })
    if (data.token) setToken(data.token)
    return data
  },

  /**
   * Register a new auth identity for a seller member.
   * Creates the identity; does NOT create the Seller record.
   * Follow with vendor.sellers.create() to create the Seller.
   */
  register: async (email: string, password: string) => {
    const data = await post<{ token?: string }>("/auth/member/emailpass/register", { email, password })
    if (data.token) setToken(data.token)
    return data
  },

  /**
   * Invalidate the current session / bearer token.
   */
  logout: async () => {
    setToken(null)
    try { await del<void>("/auth/session") } catch {}
  },
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
   * GET /vendor/alkemart/me — Alkemart custom convenience endpoint.
   * Requires x-seller-id header (called after seller_id is known).
   */
  alkemartMe: () =>
    get<AlkemartMe>("/vendor/alkemart/me"),

  /**
   * GET /alkemart/member/me — Login bootstrap endpoint.
   * Returns member info + seller_id using ONLY the JWT token (no x-seller-id).
   * Used right after login when the seller_id is not yet known.
   */
  memberMe: () =>
    get<AlkemartMe>("/alkemart/member/me"),

  /**
   * POST /vendor/sellers — Register a new seller.
   * allowUnregistered: true — call after creating auth identity.
   */
  create: (input: {
    name: string
    email: string
    member_email: string
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
   * GET /vendor/alkemart/products/:id — Product detail.
   */
  get: (id: string) =>
    get<{ product: Product }>(`/vendor/alkemart/products/${id}`),

  /**
   * PUT /vendor/alkemart/products/:id — Update product (title, description, categories, thumbnail).
   */
  update: (id: string, data: {
    title?: string
    description?: string
    thumbnail?: string
    categories?: { id: string }[]
  }) =>
    put<{ product: Product; message: string }>(
      `/vendor/alkemart/products/${id}`,
      data,
    ),

  /**
   * DELETE /vendor/alkemart/products/:id — Delete product.
   */
  delete: (id: string) =>
    del<{ success: boolean; message: string }>(
      `/vendor/alkemart/products/${id}`,
    ),

  /**
   * GET /vendor/products/:id — Full product detail with variants (Mercur).
   */
  mercurGet: (id: string) =>
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
    variant_options?: { name: string; values: string[] }[]
    variant_entries?: { options: Record<string, string>; price_ghs?: number; quantity?: number }[]
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
    const data = await apiFetch<{ files?: { url: string }[]; url?: string }>(
      "/vendor/uploads",
      { method: "POST", body: form },
    )
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
// Vendor — Returns & Refunds
// ---------------------------------------------------------------------------

export type ReturnItem = {
  id: string
  item_id: string
  quantity: number
  received_quantity: number
  damaged_quantity: number
  reason_id?: string | null
  note?: string | null
  metadata?: Record<string, unknown>
}

export type ReturnStatus =
  | "open"
  | "requested"
  | "received"
  | "partially_received"
  | "canceled"

export type Return = {
  id: string
  order_id: string
  status: ReturnStatus
  display_id: number
  refund_amount?: number | null
  payment_id?: string | null
  payment_status?: string | null
  items: ReturnItem[]
  created_at: string
  updated_at?: string
  received_at?: string | null
  canceled_at?: string | null
  requested_at?: string | null
}

export type ReturnReason = {
  id: string
  label: string
  description?: string | null
}

export const returns = {
  /**
   * GET /vendor/alkemart/returns — Returns for this seller's orders,
   * enriched with each order's payment_id (required for refunds).
   */
  list: (params?: { limit?: number; offset?: number; status?: string; order_id?: string }) =>
    get<{ returns: Return[]; count: number; limit: number; offset: number }>(
      "/vendor/alkemart/returns",
      params,
    ),

  /**
   * GET /vendor/returns/:id — Single return detail.
   */
  get: (id: string) =>
    get<{ return: Return }>(`/vendor/returns/${id}`),

  /**
   * POST /vendor/returns/:id/receive-items — Record items as received.
   */
  receiveItems: (
    returnId: string,
    input: { items: { id: string; quantity: number; description?: string }[] },
  ) =>
    post<{ return: Return }>(`/vendor/returns/${returnId}/receive-items`, input),

  /**
   * POST /vendor/returns/:id/receive — Confirm receipt of the return.
   */
  confirmReceive: (
    returnId: string,
    input?: { internal_note?: string; description?: string; metadata?: Record<string, unknown> },
  ) =>
    post<{ return: Return }>(`/vendor/returns/${returnId}/receive`, input),

  /**
   * POST /vendor/returns/:id/dismiss-items — Reject / dismiss items from return.
   */
  dismissItems: (
    returnId: string,
    input: { items: { id: string; quantity: number; internal_note?: string }[] },
  ) =>
    post<{ return: Return }>(`/vendor/returns/${returnId}/dismiss-items`, input),

  /**
   * POST /vendor/payments/:id/refund — Refund a payment.
   */
  refund: (paymentId: string, input: { amount?: number }) =>
    post<{ refund: { id: string; amount: number } }>(
      `/vendor/payments/${paymentId}/refund`,
      input,
    ),

  /**
   * GET /vendor/return-reasons — List return reasons.
   */
  reasons: () =>
    get<{ return_reasons: ReturnReason[] }>("/vendor/return-reasons"),
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
// Shared utilities
// ---------------------------------------------------------------------------

export function maskEmail(email?: string | null): string | null {
  if (!email || !email.includes("@")) return email ?? null
  const [name, domain] = email.split("@", 2)
  return `${name.slice(0, 2)}***@${domain}`
}

// ---------------------------------------------------------------------------
// Convenience: complete login flow
// ---------------------------------------------------------------------------

/**
 * Full login + seller-select sequence.
 * 1. POST /auth/member/emailpass
 * 2. GET /alkemart/member/me → resolve seller_id (no x-seller-id needed)
 * 3. POST /vendor/sellers/select → bind seller to session
 * 4. Persist seller_id for x-seller-id header
 * Returns the seller_id on success.
 */
export async function loginAndSelectSeller(
  email: string,
  password: string,
): Promise<{ sellerId: string | null; me: AlkemartMe }> {
  await auth.login(email, password)
  // auth.login() stores the token via setToken()

  const me = await seller.memberMe()
  const sellerId = me.seller_id ?? null

  if (sellerId) {
    setActiveSellerId(sellerId)
    await seller.select(sellerId)
  }

  return { sellerId, me }
}
