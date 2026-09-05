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

/** Workers API origin when set; empty keeps relative paths (local Vite proxy / Mercur). */
function apiBase(): string {
  const raw = (import.meta.env.VITE_ALKEMART_API_URL as string | undefined)?.trim()
  return raw ? raw.replace(/\/$/, "") : ""
}

/** True when talking to the Cloudflare Workers API (not Medusa/Mercur). */
export function isWorkersApi(): boolean {
  return Boolean(apiBase())
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = apiBase()
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const extraHeaders: Record<string, string> = {}
  // Mercur scopes via x-seller-id; Workers JWT already carries sellerId — skip header there.
  if (!isWorkersApi()) {
    const sellerId = getActiveSellerId()
    if (sellerId) extraHeaders["x-seller-id"] = sellerId
  }
  const token = getToken()
  if (token) {
    extraHeaders["Authorization"] = `Bearer ${token}`
  }
  const isJsonBody = init.body !== undefined && typeof init.body === "string"
  if (isJsonBody) {
    extraHeaders["Content-Type"] = "application/json"
  }

  const res = await fetch(resolveUrl(path), {
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
  logo?: string | null
  banner?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
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
  inventory_items?: { id: string; inventory_item_id?: string; stocked_quantity?: number }[]
}

export type StockLevel = {
  id: string
  location_id: string
  stocked_quantity: number
  reserved_quantity?: number
  available_quantity?: number
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
  variant?: { product?: { id?: string } } | null
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
   * Login as a seller member against Workers `/vendor/auth/login`.
   */
  login: async (email: string, password: string) => {
    const data = await post<{
      token?: string
      user?: { id: string; email: string; role: string; sellerId?: string }
    }>("/vendor/auth/login", { email, password })
    if (data.token) setToken(data.token)
    if (data.user?.sellerId) setActiveSellerId(data.user.sellerId)
    return data
  },

  /**
   * Register seller + owner member in one Workers call.
   * Prefer `registerSeller` when shop name/handle are known.
   */
  register: async (email: string, password: string) => {
    const handle = email
      .split("@")[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `seller-${Date.now()}`
    return auth.registerSeller({
      email,
      password,
      sellerName: `${handle}'s Shop`,
      sellerHandle: handle.slice(0, 40),
    })
  },

  registerSeller: async (input: {
    email: string
    password: string
    sellerName: string
    sellerHandle: string
  }) => {
    const data = await post<{
      token?: string
      user?: { id: string; email: string; role: string; sellerId?: string }
    }>("/vendor/auth/register", input)
    if (data.token) setToken(data.token)
    if (data.user?.sellerId) setActiveSellerId(data.user.sellerId)
    return data
  },

  /**
   * Invalidate the current session / bearer token.
   */
  logout: async () => {
    setToken(null)
    setActiveSellerId(null)
  },
}

// ---------------------------------------------------------------------------
// Workers ↔ SPA shape adapters
// ---------------------------------------------------------------------------

type WorkersProductItem = {
  product: {
    id: string
    title: string
    description: string | null
    status: ProductStatus
    primaryCategoryId: string
    sellerId: string | null
  }
  variant: { id: string; sku: string | null; title: string | null }
  offer: {
    id: string
    pricePesewas: string
    onHand: number
    currency?: string
    active?: boolean
  }
}

type WorkersOrderItem = {
  id: string
  orderGroupId: string
  sellerId: string
  subtotalPesewas: string
  deliveryFeePesewas: string
  status: string
}

function mapWorkersProduct(item: WorkersProductItem): Product {
  const amount = Number(item.offer.pricePesewas)
  return {
    id: item.product.id,
    title: item.product.title,
    description: item.product.description,
    status: item.product.status,
    handle: item.variant.sku,
    categories: item.product.primaryCategoryId
      ? [{ id: item.product.primaryCategoryId }]
      : [],
    variants: [
      {
        id: item.variant.id,
        title: item.variant.title,
        sku: item.variant.sku,
        prices: [
          {
            amount: Number.isFinite(amount) ? amount : 0,
            currency_code: item.offer.currency ?? "ghs",
          },
        ],
      },
    ],
    metadata: {
      onHand: item.offer.onHand,
      offerId: item.offer.id,
      primaryCategoryId: item.product.primaryCategoryId,
    },
  }
}

function mapWorkersOrder(item: WorkersOrderItem): Order {
  const sub = Number(item.subtotalPesewas)
  const fee = Number(item.deliveryFeePesewas)
  const fulfillment_status =
    item.status === "placed"
      ? "placed"
      : item.status === "shipped"
        ? "shipped"
        : item.status === "delivered"
          ? "delivered"
          : item.status === "cancelled"
            ? "canceled"
            : item.status
  return {
    id: item.id,
    status: item.status === "cancelled" ? "canceled" : item.status,
    currency_code: "ghs",
    subtotal: Number.isFinite(sub) ? sub : 0,
    shipping_total: Number.isFinite(fee) ? fee : 0,
    total: (Number.isFinite(sub) ? sub : 0) + (Number.isFinite(fee) ? fee : 0),
    fulfillment_status,
  }
}

function emptyStats(): VendorStats {
  return {
    orders_count: 0,
    gmv_ghs: 0,
    offers_count: 0,
    products_count: 0,
    readiness: null,
  }
}

function flattenStoreCategories(
  nodes: {
    id: string
    name: string
    handle?: string
    children?: { id: string; name: string; handle?: string; children?: { id: string; name: string; handle?: string }[] }[]
  }[],
  prefix = "",
): { id: string; name: string; handle: string; is_internal?: boolean }[] {
  const out: { id: string; name: string; handle: string; is_internal?: boolean }[] = []
  for (const n of nodes) {
    const label = prefix ? `${prefix} / ${n.name}` : n.name
    if (!n.children?.length) {
      out.push({ id: n.id, name: label, handle: n.handle ?? n.id })
    } else {
      out.push(...flattenStoreCategories(n.children, label))
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Vendor — Seller
// ---------------------------------------------------------------------------

export const seller = {
  /**
   * GET /vendor/sellers/me — current seller profile (Mercur).
   * Workers: stub from JWT `/vendor/me`.
   */
  me: async () => {
    if (isWorkersApi()) {
      const me = await get<{ userId: string; role: string; sellerId?: string }>("/vendor/me")
      if (me.sellerId) setActiveSellerId(me.sellerId)
      return {
        seller: {
          id: me.sellerId ?? me.userId,
          name: "My Shop",
          email: null,
          status: "open" as SellerStatus,
        },
      }
    }
    return get<{ seller: Seller }>("/vendor/sellers/me")
  },

  /**
   * GET /vendor/alkemart/me — Alkemart custom convenience endpoint.
   * Requires x-seller-id header (called after seller_id is known).
   */
  alkemartMe: () =>
    get<AlkemartMe>("/vendor/alkemart/me"),

  /**
   * Workers `/vendor/me` bootstrap (JWT only).
   * Mapped to the legacy AlkemartMe shape for existing screens.
   */
  memberMe: async () => {
    const me = await get<{ userId: string; role: string; sellerId?: string }>("/vendor/me")
    if (me.sellerId) setActiveSellerId(me.sellerId)
    return {
      id: me.userId,
      seller_id: me.sellerId ?? null,
      email: null,
      name: null,
    } satisfies AlkemartMe
  },

  /**
   * POST /vendor/sellers — Register a new seller (Mercur).
   * Workers registration goes through /vendor/auth/register.
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
  }) => {
    if (isWorkersApi()) {
      return Promise.reject(new ApiError(501, "Use /vendor/auth/register on Workers API"))
    }
    return post<{ seller: Seller }>("/vendor/sellers", {
      ...input,
      currency_code: input.currency_code ?? "ghs",
    })
  },

  /**
   * POST /vendor/sellers/select — Bind a seller to the current session (Mercur).
   */
  select: (sellerId: string) => {
    if (isWorkersApi()) {
      setActiveSellerId(sellerId)
      return Promise.resolve({ success: true })
    }
    return post<{ success: boolean }>("/vendor/sellers/select", { seller_id: sellerId })
  },

  /**
   * POST /vendor/sellers/me — Update current seller profile fields (Mercur).
   * Workers profile updates go through /vendor/onboarding/ghana-setup.
   */
  update: (input: {
    name?: string
    handle?: string
    description?: string
    logo?: string | null
    banner?: string | null
    currency_code?: string
    metadata?: Record<string, unknown> | null
  }) => {
    if (isWorkersApi()) {
      return Promise.reject(
        new ApiError(501, "Profile update via Settings is not wired to Workers yet — use Ghana setup"),
      )
    }
    return post<{ seller: Seller }>("/vendor/sellers/me", input)
  },

  /**
   * POST /vendor/sellers/:id/address — Upsert seller's pack / dispatch address (Mercur).
   */
  updateAddress: (sellerId: string, address: SellerAddress) => {
    if (isWorkersApi()) {
      return Promise.reject(
        new ApiError(501, "Address update via Settings is not wired to Workers yet — use Ghana setup"),
      )
    }
    return post<{ seller: Seller }>(`/vendor/sellers/${sellerId}/address`, address)
  },

  /**
   * POST /vendor/sellers/:id/payment-details — Upsert MoMo / payout info (Mercur).
   */
  updatePaymentDetails: (
    sellerId: string,
    details: SellerPaymentDetails,
  ) => {
    if (isWorkersApi()) {
      return Promise.reject(
        new ApiError(501, "MoMo update via Settings is not wired to Workers yet — use Ghana setup"),
      )
    }
    return post<{ seller: Seller }>(`/vendor/sellers/${sellerId}/payment-details`, details)
  },
}

// ---------------------------------------------------------------------------
// Vendor — Products
// ---------------------------------------------------------------------------

export const products = {
  /**
   * List seller products.
   * Workers: GET /vendor/products → `{ items }` adapted to `{ products }`.
   * Mercur: GET /vendor/alkemart/products.
   */
  list: async (params?: { limit?: number; offset?: number }) => {
    if (isWorkersApi()) {
      const data = await get<{ items: WorkersProductItem[] }>("/vendor/products")
      const all = (data.items ?? []).map(mapWorkersProduct)
      const offset = params?.offset ?? 0
      const limit = params?.limit ?? all.length
      return {
        products: all.slice(offset, offset + limit),
        count: all.length,
        limit,
        offset,
      }
    }
    return get<{ products: Product[]; count: number; limit: number; offset: number }>(
      "/vendor/alkemart/products",
      params,
    )
  },

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
   * Product detail. Workers has no GET-by-id — resolve from list.
   */
  get: async (id: string) => {
    if (isWorkersApi()) {
      const data = await get<{ items: WorkersProductItem[] }>("/vendor/products")
      const hit = (data.items ?? []).find((i) => i.product.id === id)
      if (!hit) throw new ApiError(404, "Product not found")
      return { product: mapWorkersProduct(hit) }
    }
    return get<{ product: Product }>(`/vendor/alkemart/products/${id}`)
  },

  /**
   * Update product. Workers: PATCH /vendor/products/:id.
   */
  update: async (
    id: string,
    data: {
      title?: string
      description?: string
      thumbnail?: string
      categories?: { id: string }[]
      pricePesewas?: string
      onHand?: number
      primaryCategoryId?: string
    },
  ) => {
    if (isWorkersApi()) {
      const body: Record<string, unknown> = {}
      if (data.title !== undefined) body.title = data.title
      if (data.description !== undefined) body.description = data.description
      if (data.pricePesewas !== undefined) body.pricePesewas = data.pricePesewas
      if (data.onHand !== undefined) body.onHand = data.onHand
      if (data.primaryCategoryId !== undefined) body.primaryCategoryId = data.primaryCategoryId
      else if (data.categories?.[0]?.id) body.primaryCategoryId = data.categories[0].id
      const updated = await apiFetch<WorkersProductItem>(`/vendor/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      return { product: mapWorkersProduct(updated), message: "Updated" }
    }
    return put<{ product: Product; message: string }>(`/vendor/alkemart/products/${id}`, data)
  },

  /**
   * DELETE /vendor/alkemart/products/:id — Delete product (Mercur only).
   */
  delete: (id: string) => {
    if (isWorkersApi()) {
      return Promise.reject(new ApiError(501, "Product delete is not available on Workers API yet"))
    }
    return del<{ success: boolean; message: string }>(`/vendor/alkemart/products/${id}`)
  },

  /**
   * GET /vendor/products/:id — Full product detail with variants (Mercur).
   */
  mercurGet: (id: string) =>
    get<{ product: Product }>(`/vendor/products/${id}`),

  /**
   * GET /vendor/alkemart/products/:id/quality — Quality score (Mercur only).
   */
  quality: (id: string) => {
    if (isWorkersApi()) {
      return Promise.reject(new ApiError(501, "Quality score is not available on Workers API"))
    }
    return get<{ quality: ProductQuality; product_id: string }>(
      `/vendor/alkemart/products/${id}/quality`,
    )
  },

  /**
   * Submit for admin review.
   * Workers: POST /vendor/products/:id/propose
   */
  propose: async (id: string) => {
    if (isWorkersApi()) {
      const updated = await post<WorkersProductItem>(`/vendor/products/${id}/propose`)
      return { success: true, product_id: updated.product.id }
    }
    return post<{ success: boolean; product_id: string }>(
      `/vendor/alkemart/products/${id}/propose`,
    )
  },

  /**
   * One-shot listing.
   * Workers: POST /vendor/products (title, primaryCategoryId, pricePesewas, onHand…).
   * Mercur: POST /vendor/alkemart/quick-list.
   */
  quickList: async (input: {
    title: string
    description?: string
    price_ghs: number
    quantity?: number
    category_id?: string
    image_url?: string
    variant_options?: { name: string; values: string[] }[]
    variant_entries?: { options: Record<string, string>; price_ghs?: number; quantity?: number }[]
  }) => {
    if (isWorkersApi()) {
      if (!input.category_id) throw new ApiError(400, "Category is required")
      const pricePesewas = String(Math.round(Number(input.price_ghs) * 100))
      const created = await post<WorkersProductItem>("/vendor/products", {
        title: input.title,
        description: input.description,
        primaryCategoryId: input.category_id,
        pricePesewas,
        onHand: input.quantity ?? 1,
      })
      return {
        product_id: created.product.id,
        status: created.product.status,
        message: "Product created",
      }
    }
    return post<{ product_id: string; status: string; message: string }>(
      "/vendor/alkemart/quick-list",
      input,
    )
  },

  /**
   * POST /vendor/uploads — Upload a file (image) and get back a URL.
   * Not available on Workers cut — callers should skip image when Workers.
   */
  upload: async (file: File): Promise<string> => {
    if (isWorkersApi()) {
      throw new ApiError(501, "Image upload is not available on Workers API yet")
    }
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
  list: (params?: { limit?: number; offset?: number }) =>
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
// Vendor — Inventory (Mercur seller-scoped inventory endpoints)
// ---------------------------------------------------------------------------

export const inventoryItems = {
  /**
   * GET /vendor/inventory-items/:id/location-levels — Stock levels per location.
   */
  levels: (id: string) =>
    get<{ inventory_levels: StockLevel[]; count?: number }>(
      `/vendor/inventory-items/${id}/location-levels`,
    ),

  /**
   * POST /vendor/inventory-items/:id/location-levels/:locationId —
   * Set the stocked quantity at a location (ownership-validated server-side).
   */
  setLevel: (id: string, locationId: string, stockedQuantity: number) =>
    post<{ inventory_item: unknown }>(
      `/vendor/inventory-items/${id}/location-levels/${locationId}`,
      { stocked_quantity: stockedQuantity },
    ),
}

// ---------------------------------------------------------------------------
// Vendor — Orders  (use /vendor/orders — NOT /admin/orders)
// ---------------------------------------------------------------------------

export const orders = {
  /**
   * GET /vendor/orders — Orders scoped to this seller.
   * Workers returns `{ items }`; adapted to `{ orders }` for the SPA.
   */
  list: async (params?: {
    limit?: number
    offset?: number
    status?: string
    payment_status?: string
    fulfillment_status?: string
    created_at_from?: string
    created_at_to?: string
  }) => {
    if (isWorkersApi()) {
      const data = await get<{ items: WorkersOrderItem[] }>("/vendor/orders")
      let all = (data.items ?? []).map(mapWorkersOrder)
      const fs = params?.fulfillment_status
      if (fs === "not_fulfilled") {
        all = all.filter((o) => o.fulfillment_status === "placed" || o.fulfillment_status === "not_fulfilled")
      } else if (fs === "shipped") {
        all = all.filter((o) => o.fulfillment_status === "shipped")
      } else if (fs === "delivered") {
        all = all.filter((o) => o.fulfillment_status === "delivered")
      } else if (params?.status) {
        all = all.filter((o) => o.status === params.status)
      }
      const offset = Number(params?.offset ?? 0)
      const limit = Number(params?.limit ?? all.length)
      return {
        orders: all.slice(offset, offset + limit),
        count: all.length,
        limit,
        offset,
      }
    }
    return get<{ orders: Order[]; count: number; limit: number; offset: number }>(
      "/vendor/orders",
      params,
    )
  },

  /**
   * Single order detail. Workers: GET /vendor/orders/:id (items + address).
   */
  get: async (id: string) => {
    if (isWorkersApi()) {
      try {
        const data = await get<{
          order: WorkersOrderItem & {
            items?: Array<{
              id: string
              title: string
              qty: number
              unitPricePesewas: string
              productId?: string
            }>
            shippingAddress?: Record<string, unknown> | null
            buyerEmail?: string | null
          }
        }>(`/vendor/orders/${id}`)
        const mapped = mapWorkersOrder(data.order)
        const items: OrderItem[] = (data.order.items ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          quantity: item.qty,
          unit_price: Number(item.unitPricePesewas) || 0,
          thumbnail: null,
          product_id: item.productId,
          variant_title: null,
          variant: { product: { id: item.productId ?? "" } },
        }))
        return {
          order: {
            ...mapped,
            items: items.length ? items : mapped.items,
            email: data.order.buyerEmail ?? mapped.email,
            shipping_address: data.order.shippingAddress
              ? {
                  first_name: String(data.order.shippingAddress.first_name ?? ""),
                  last_name: String(data.order.shippingAddress.last_name ?? ""),
                  phone: String(data.order.shippingAddress.phone ?? ""),
                  address_1: String(data.order.shippingAddress.address_1 ?? ""),
                  address_2: data.order.shippingAddress.address_2
                    ? String(data.order.shippingAddress.address_2)
                    : null,
                  city: String(data.order.shippingAddress.city ?? ""),
                  province: data.order.shippingAddress.province
                    ? String(data.order.shippingAddress.province)
                    : null,
                  country_code: String(data.order.shippingAddress.country_code ?? "gh"),
                  postal_code: data.order.shippingAddress.postal_code
                    ? String(data.order.shippingAddress.postal_code)
                    : null,
                }
              : mapped.shipping_address,
          },
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) throw err
        const data = await get<{ items: WorkersOrderItem[] }>("/vendor/orders")
        const hit = (data.items ?? []).find((i) => i.id === id)
        if (!hit) throw new ApiError(404, "Order not found")
        return { order: mapWorkersOrder(hit) }
      }
    }
    return get<{ order: Order }>(`/vendor/orders/${id}`)
  },

  /**
   * POST /vendor/orders/:id/fulfillments — Create a fulfillment (Mercur only).
   * Workers fulfillment is placed → ship → deliver (no pack step).
   */
  createFulfillment: (
    orderId: string,
    input: { items: { id: string; quantity: number }[]; location_id?: string },
  ) => {
    if (isWorkersApi()) {
      return Promise.reject(
        new ApiError(501, "Pack step is not used on Workers API — mark as dispatched directly"),
      )
    }
    return post<{ fulfillment: Fulfillment }>(
      `/vendor/orders/${orderId}/fulfillments`,
      { ...input, requires_shipping: true },
    )
  },

  /**
   * Mark as shipped.
   * Workers: POST /vendor/orders/:id/ship (fulfillmentId ignored).
   */
  markShipped: async (
    orderId: string,
    fulfillmentId: string,
    labels: { tracking_number: string; tracking_url?: string }[],
  ) => {
    if (isWorkersApi()) {
      const data = await post<{ order: WorkersOrderItem }>(`/vendor/orders/${orderId}/ship`)
      return {
        fulfillment: {
          id: fulfillmentId || "workers",
          shipped_at: new Date().toISOString(),
        } satisfies Fulfillment,
        order: mapWorkersOrder(data.order),
      }
    }
    return post<{ fulfillment: Fulfillment }>(
      `/vendor/orders/${orderId}/fulfillments/${fulfillmentId}/shipments`,
      { labels },
    )
  },

  /**
   * Mark as delivered.
   * Workers: POST /vendor/orders/:id/deliver (fulfillmentId ignored).
   */
  markDelivered: async (orderId: string, fulfillmentId: string) => {
    if (isWorkersApi()) {
      const data = await post<{ order: WorkersOrderItem }>(`/vendor/orders/${orderId}/deliver`)
      return {
        fulfillment: {
          id: fulfillmentId || "workers",
          delivered_at: new Date().toISOString(),
        } satisfies Fulfillment,
        order: mapWorkersOrder(data.order),
      }
    }
    return post<{ fulfillment: Fulfillment }>(
      `/vendor/orders/${orderId}/fulfillments/${fulfillmentId}/mark-as-delivered`,
    )
  },

  /**
   * Soft-cancel request (Mercur only).
   */
  cancel: (orderId: string, reason?: string) => {
    if (isWorkersApi()) {
      return Promise.reject(new ApiError(501, "Cancel request is not available on Workers API yet"))
    }
    return post<{ order_id: string; cancel_requested: boolean }>(
      `/vendor/alkemart/orders/${orderId}/cancel`,
      { reason },
    )
  },
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
   * Returns list — Mercur only. Workers cut returns empty (nav hidden).
   */
  list: (params?: { limit?: number; offset?: number; status?: string; order_id?: string }) => {
    if (isWorkersApi()) {
      return Promise.resolve({
        returns: [] as Return[],
        count: 0,
        limit: Number(params?.limit ?? 0),
        offset: Number(params?.offset ?? 0),
      })
    }
    return get<{ returns: Return[]; count: number; limit: number; offset: number }>(
      "/vendor/alkemart/returns",
      params,
    )
  },

  get: (id: string) => {
    if (isWorkersApi()) {
      return Promise.reject(new ApiError(501, "Returns are not available on Workers API"))
    }
    return get<{ return: Return }>(`/vendor/returns/${id}`)
  },

  receiveItems: (
    returnId: string,
    input: { items: { id: string; quantity: number; description?: string }[] },
  ) => {
    if (isWorkersApi()) {
      return Promise.reject(new ApiError(501, "Returns are not available on Workers API"))
    }
    return post<{ return: Return }>(`/vendor/returns/${returnId}/receive-items`, input)
  },

  confirmReceive: (
    returnId: string,
    input?: { internal_note?: string; description?: string; metadata?: Record<string, unknown> },
  ) => {
    if (isWorkersApi()) {
      return Promise.reject(new ApiError(501, "Returns are not available on Workers API"))
    }
    return post<{ return: Return }>(`/vendor/returns/${returnId}/receive`, input)
  },

  dismissItems: (
    returnId: string,
    input: { items: { id: string; quantity: number; internal_note?: string }[] },
  ) => {
    if (isWorkersApi()) {
      return Promise.reject(new ApiError(501, "Returns are not available on Workers API"))
    }
    return post<{ return: Return }>(`/vendor/returns/${returnId}/dismiss-items`, input)
  },

  refund: (paymentId: string, input: { amount?: number }) => {
    if (isWorkersApi()) {
      return Promise.reject(new ApiError(501, "Refunds are not available on Workers API"))
    }
    return post<{ refund: { id: string; amount: number } }>(
      `/vendor/payments/${paymentId}/refund`,
      input,
    )
  },

  reasons: () => {
    if (isWorkersApi()) {
      return Promise.resolve({ return_reasons: [] as ReturnReason[] })
    }
    return get<{ return_reasons: ReturnReason[] }>("/vendor/return-reasons")
  },
}

// ---------------------------------------------------------------------------
// Vendor — Stats & Onboarding
// ---------------------------------------------------------------------------

export const stats = {
  /**
   * Live ops snapshot.
   * Workers: soft-derived from products + orders (no /vendor/alkemart/stats).
   */
  get: async (): Promise<VendorStats> => {
    if (isWorkersApi()) {
      try {
        const [prods, ords] = await Promise.all([
          get<{ items: WorkersProductItem[] }>("/vendor/products"),
          get<{ items: WorkersOrderItem[] }>("/vendor/orders"),
        ])
        const ordersMapped = (ords.items ?? []).map(mapWorkersOrder)
        const gmvPesewas = ordersMapped.reduce((sum, o) => sum + (o.total ?? 0), 0)
        return {
          orders_count: ordersMapped.length,
          products_count: (prods.items ?? []).length,
          offers_count: (prods.items ?? []).length,
          gmv_ghs: gmvPesewas / 100,
          readiness: null,
        }
      } catch {
        return emptyStats()
      }
    }
    return get<VendorStats>("/vendor/alkemart/stats")
  },

  /**
   * Seller readiness.
   * Workers: GET /vendor/onboarding/status → `{ ready, missing }` mapped to SellerReadiness.
   */
  readiness: async (): Promise<SellerReadiness> => {
    if (isWorkersApi()) {
      const data = await get<{ ready: boolean; missing: string[] }>("/vendor/onboarding/status")
      const keys = ["name", "region", "recipient_code"] as const
      const checklist: Record<string, boolean> = {}
      for (const k of keys) checklist[k] = !(data.missing ?? []).includes(k)
      return {
        seller_id: getActiveSellerId() ?? "",
        phase: data.ready ? "active" : "setup_incomplete",
        mercur_status: "open",
        setup_complete: Boolean(data.ready),
        can_propose_products: Boolean(data.ready),
        can_create_offers: Boolean(data.ready),
        checklist,
        checklist_labels: {
          name: "Shop name",
          region: "Pack region",
          recipient_code: "MoMo payout",
        },
        next_action: data.ready
          ? null
          : {
              code: (data.missing ?? [])[0] ?? "setup",
              label: "Complete Ghana setup in Settings",
            },
      }
    }
    return get<SellerReadiness>("/vendor/alkemart/onboarding/status")
  },
}

export const onboarding = {
  /**
   * Ghana delivery / MoMo setup.
   * Workers expects displayName, region, deliveryFeePesewas, momo{…}.
   * Mercur Alkemart path kept for local Medusa.
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
    // Workers-shaped fields (optional passthrough)
    displayName?: string
    deliveryFeePesewas?: string
    digitalAddress?: string
    momo?: { provider: "mtn" | "vodafone" | "airteltigo"; phone: string; accountName: string }
  }) => {
    if (isWorkersApi()) {
      if (!input.momo || !input.region) {
        return Promise.reject(
          new ApiError(400, "Workers ghana-setup requires region and momo details"),
        )
      }
      const deliveryFeePesewas =
        input.deliveryFeePesewas ??
        String(Math.round((input.delivery_fee_ghs ?? 0) * 100))
      return post<{ ready: boolean; missing: string[] }>("/vendor/onboarding/ghana-setup", {
        displayName: input.displayName || input.pack_from_name || "My Shop",
        region: input.region,
        digitalAddress: input.digitalAddress || input.postal_code,
        deliveryFeePesewas,
        momo: input.momo,
      }).then((r) => ({
        message: r.ready ? "Setup complete" : "Setup saved",
        phase: r.ready ? "active" : "setup_incomplete",
        setup_complete: r.ready,
      }))
    }
    return post<{ message: string; phase?: string; setup_complete?: boolean }>(
      "/vendor/alkemart/onboarding/ghana-setup",
      input,
    )
  },
}

// ---------------------------------------------------------------------------
// Vendor — Catalog support
// ---------------------------------------------------------------------------

export const catalog = {
  /**
   * Category list for product tagging.
   * Workers: GET /store/categories (nav tree) → flattened leaves.
   * Mercur: GET /vendor/product-categories (filter is_internal).
   */
  categories: async () => {
    if (isWorkersApi()) {
      const data = await get<{
        categories: {
          id: string
          name: string
          handle?: string
          children?: {
            id: string
            name: string
            handle?: string
            children?: { id: string; name: string; handle?: string }[]
          }[]
        }[]
      }>("/store/categories")
      return {
        product_categories: flattenStoreCategories(data.categories ?? []),
      }
    }
    const data = await get<{
      product_categories: {
        id: string
        name: string
        handle: string
        is_internal?: boolean
      }[]
    }>("/vendor/product-categories")
    return {
      ...data,
      product_categories: (data.product_categories ?? []).filter(
        (c) => !c.is_internal,
      ),
    }
  },

  /**
   * GET /vendor/alkemart/markets — Operating regions / delivery areas (Mercur).
   */
  markets: () => {
    if (isWorkersApi()) {
      return Promise.resolve({ markets: [] as { id: string; name: string; countries: string[] }[] })
    }
    return get<{ markets: { id: string; name: string; countries: string[] }[] }>(
      "/vendor/alkemart/markets",
    )
  },
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
 * Workers login — sellerId is on the JWT claims / login payload.
 */
export async function loginAndSelectSeller(
  email: string,
  password: string,
): Promise<{ sellerId: string | null; me: AlkemartMe }> {
  const data = await auth.login(email, password)
  const sellerId = data.user?.sellerId ?? getActiveSellerId()
  if (sellerId) setActiveSellerId(sellerId)
  const me = await seller.memberMe()
  return { sellerId: me.seller_id ?? sellerId, me }
}
