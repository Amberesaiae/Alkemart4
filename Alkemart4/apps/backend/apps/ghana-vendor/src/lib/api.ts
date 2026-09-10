/**
 * Alkemart Ghana Vendor — Typed API client
 *
 * Single source of truth for every endpoint the Seller SPA calls.
 * Handles:
 *  - Bearer token auth (sessionStorage) + session cookies (credentials: 'include')
 *  - Structured ApiError on non-2xx
 *  - Seller context persistence across page refreshes (localStorage)
 *
 * Backend: Cloudflare Workers API only.
 *   Auth          → /vendor/auth/login, /vendor/auth/register
 *   Seller        → /vendor/sellers/me, /vendor/me
 *   Products      → /vendor/products
 *   Orders        → /vendor/orders
 *   Onboarding    → /vendor/onboarding/*
 *   Catalog       → /store/categories
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

/** Workers API origin; empty keeps relative paths (local Vite proxy). */
function apiBase(): string {
  const raw = (import.meta.env.VITE_ALKEMART_API_URL as string | undefined)?.trim()
  return raw ? raw.replace(/\/$/, "") : ""
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = apiBase()
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const extraHeaders: Record<string, string> = {}
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

function patchJson<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SellerStatus = "pending_approval" | "open" | "suspended" | "terminated"
export type ProductStatus = "draft" | "proposed" | "published" | "rejected"

export type VendorAppeal = {
  id: string
  productId: string
  message: string
  status: "open" | "closed"
  decision: "reopened" | "upheld" | null
  response: string | null
}

export type SellerAddress = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  district?: string | null
  latitude?: number | null
  longitude?: number | null
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

export type SellerStorefront = {
  tagline: string | null
  announcement: { text: string; startsAt: string; endsAt: string } | null
  announcementActive: boolean
  seoDescription: string | null
}

export type SellerDisplay = {
  categoryOrder: string[]
  featuredCategoryId: string | null
  stockMode: "exact" | "bands"
}

export type SellerContact = {
  phone: string | null
  hours: { days: string; open: string; close: string } | null
  social: { instagram?: string; facebook?: string; tiktok?: string; whatsapp?: string }
}

export type StorefrontPatch = {
  tagline?: string | null
  bio?: string | null
  announcement?: { text: string; startsAt: string; endsAt: string } | null
  seoDescription?: string | null
}

export type SellerAvailability = {
  state: "open" | "paused"
  pausedUntil: string | null
  note: string | null
}

export type ShopPolicy = {
  id: string
  version: number
  body: { shipping?: string; returnsDays?: number; warranty?: string }
  effectiveFrom: string
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
  storefront?: SellerStorefront | null
  availability?: SellerAvailability | null
  display?: SellerDisplay | null
  contact?: SellerContact | null
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
    imageUrl?: string | null
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
  // Workers pesewas → Medusa-shaped major units.
  const amount = Number(item.offer.pricePesewas) / 100
  const onHand = Number(item.offer.onHand)
  return {
    id: item.product.id,
    title: item.product.title,
    description: item.product.description,
    status: item.product.status,
    handle: item.variant.sku,
    thumbnail: item.product.imageUrl ?? null,
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
   * GET /vendor/sellers/me — current seller profile.
   */
  me: async () => {
    const data = await get<{ seller: Seller }>("/vendor/sellers/me")
    if (data.seller?.id) setActiveSellerId(data.seller.id)
    return data
  },

  /**
   * Alkemart profile is not available yet — no GET /vendor/alkemart/me on Workers.
   */
  alkemartMe: (): Promise<AlkemartMe> => {
    return Promise.reject(new ApiError(501, "Alkemart profile is not available yet"))
  },

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
   * Seller creation is not available yet — use registration instead.
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
    return Promise.reject(new ApiError(501, "Seller creation is not available yet"))
  },

  /**
   * Bind a seller to the current session (local-only).
   */
  select: (sellerId: string) => {
    setActiveSellerId(sellerId)
    return Promise.resolve({ success: true })
  },

  /**
   * POST /vendor/sellers/me — Update current seller profile fields.
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
    return post<{ seller: Seller }>("/vendor/sellers/me", input)
  },

  /**
   * POST /vendor/sellers/me/address — Upsert seller's pack / dispatch address.
   */
  updateAddress: (sellerId: string, address: SellerAddress & { delivery_fee_pesewas?: string }) => {
    return post<{ seller: Seller }>("/vendor/sellers/me/address", {
      pack_region: address.province ?? null,
      digital_address: address.postal_code ?? null,
      delivery_fee_pesewas: address.delivery_fee_pesewas,
      address_1: address.address_1 ?? null,
      address_2: address.address_2 ?? null,
      city: address.city ?? null,
      district: address.district ?? null,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      country_code: address.country_code ?? "gh",
    })
  },

  /**
   * POST /vendor/sellers/me/payment-details — Upsert MoMo / payout info.
   */
  updatePaymentDetails: (
    sellerId: string,
    details: SellerPaymentDetails,
  ) => {
    return post<{ seller: Seller }>("/vendor/sellers/me/payment-details", {
      provider: details.provider,
      phone: details.phone,
    })
  },

  /**
   * PATCH /vendor/sellers/me/storefront — buyer-visible shop copy
   * (tagline, bio, announcement, SEO description). Returns the seller view.
   */
  updateStorefront: (patch: StorefrontPatch) => {
    return patchJson<{ seller: Seller }>("/vendor/sellers/me/storefront", patch)
  },

  /**
   * POST /vendor/sellers/me/pause — pause order intake (server-enforced
   * 409 at checkout). Optional note + scheduled return date.
   */
  pause: (input: { note?: string | null; until?: string | null }) => {
    return post<{ seller: Seller }>("/vendor/sellers/me/pause", input)
  },

  /** POST /vendor/sellers/me/unpause — reopen order intake. */
  unpause: () => {
    return post<{ seller: Seller }>("/vendor/sellers/me/unpause", {})
  },

  /** GET /vendor/sellers/me/policies — current + version history. */
  policies: () => {
    return get<{ current: ShopPolicy | null; history: ShopPolicy[] }>("/vendor/sellers/me/policies")
  },

  /**
   * POST /vendor/sellers/me/policies — append a policy version
   * ({ shipping?, returnsDays?, warranty? }). Returns the new version.
   */
  savePolicy: (body: ShopPolicy["body"]) => {
    return post<{ policy: ShopPolicy }>("/vendor/sellers/me/policies", body)
  },

  /** PATCH /vendor/sellers/me/display — catalog arrangement prefs. */
  updateDisplay: (patch: Partial<SellerDisplay>) => {
    return patchJson<{ seller: Seller }>("/vendor/sellers/me/display", patch)
  },

  /** PATCH /vendor/sellers/me/contact — phone, hours, social links. */
  updateContact: (patch: {
    phone?: string | null
    hours?: SellerContact["hours"]
    social?: SellerContact["social"] | null
  }) => {
    return patchJson<{ seller: Seller }>("/vendor/sellers/me/contact", patch)
  },

  /** GET /vendor/sellers/me/featured — ranked featured product ids. */
  featured: () => {
    return get<{ productIds: string[] }>("/vendor/sellers/me/featured")
  },

  /** PUT /vendor/sellers/me/featured — replace the shelf (≤ 8 own products). */
  setFeatured: (productIds: string[]) => {
    return put<{ productIds: string[] }>("/vendor/sellers/me/featured", { productIds })
  },
}

// ---------------------------------------------------------------------------
// Vendor — Products
// ---------------------------------------------------------------------------

export const products = {
  /**
   * List seller products — GET /vendor/products (`{ items }` adapted to `{ products }`).
   */
  list: async (params?: { limit?: number; offset?: number }) => {
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
  },

  /**
   * Product detail — no GET-by-id, resolved from the list.
   */
  get: async (id: string) => {
    const data = await get<{ items: WorkersProductItem[] }>("/vendor/products")
    const hit = (data.items ?? []).find((i) => i.product.id === id)
    if (!hit) throw new ApiError(404, "Product not found")
    return { product: mapWorkersProduct(hit) }
  },

  /**
   * Update product — PATCH /vendor/products/:id.
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
    const body: Record<string, unknown> = {}
    if (data.title !== undefined) body.title = data.title
      if (data.description !== undefined) body.description = data.description
      if (data.thumbnail !== undefined) body.imageUrl = data.thumbnail
      if (data.pricePesewas !== undefined) body.pricePesewas = data.pricePesewas
      if (data.onHand !== undefined) body.onHand = data.onHand
      if (data.primaryCategoryId !== undefined) body.primaryCategoryId = data.primaryCategoryId
      else if (data.categories?.[0]?.id) body.primaryCategoryId = data.categories[0].id
      const updated = await apiFetch<WorkersProductItem>(`/vendor/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      return { product: mapWorkersProduct(updated), message: "Updated" }
  },

  /**
   * Product delete is not available yet.
   */
  delete: (id: string) => {
    return Promise.reject(new ApiError(501, "Product delete is not available yet"))
  },

  /**
   * Quality score is not available yet.
   */
  quality: (id: string) => {
    return Promise.reject(new ApiError(501, "Quality score is not available yet"))
  },

  /**
   * Submit for admin review — POST /vendor/products/:id/propose.
   */
  propose: async (id: string) => {
    const updated = await post<WorkersProductItem>(`/vendor/products/${id}/propose`)
    return { success: true, product_id: updated.product.id }
  },

  /**
   * Appeal a rejection — POST /vendor/products/:id/appeal.
   * GET /vendor/products/appeals/mine lists your appeals.
   */
  appeal: async (id: string, message: string) => {
    const data = await post<{ appeal: VendorAppeal }>(`/vendor/products/${id}/appeal`, { message })
    return data.appeal
  },
  appealsMine: () => get<{ appeals: VendorAppeal[] }>("/vendor/products/appeals/mine"),

  /**
   * One-shot listing — POST /vendor/products (title, primaryCategoryId, pricePesewas, onHand…).
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
    if (!input.category_id) throw new ApiError(400, "Please choose a category for your product")
    const pricePesewas = String(Math.round(Number(input.price_ghs) * 100))
    const created = await post<WorkersProductItem>("/vendor/products", {
      title: input.title,
      description: input.description,
      primaryCategoryId: input.category_id,
      pricePesewas,
      onHand: input.quantity ?? 1,
      ...(input.image_url ? { imageUrl: input.image_url } : {}),
    })
    return {
      product_id: created.product.id,
      status: created.product.status,
      message: "Product created",
    }
  },

  /**
   * POST /vendor/uploads — Upload a file (image) and get back a URL.
   * Sends field `files`, accepts `{ files: [{ url }] }` or `{ url }` in reply.
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
   * Offers are not available yet — no /vendor/offers/* on Workers.
   */
  list: (params?: {
    limit?: number
    offset?: number
  }): Promise<{ offers: Offer[]; count: number; limit: number; offset: number }> => {
    return Promise.reject(new ApiError(501, "Offers are not available yet"))
  },

  /**
   * Offers are not available yet — no /vendor/offers/* on Workers.
   */
  get: (id: string): Promise<{ offer: Offer }> => {
    return Promise.reject(new ApiError(501, "Offers are not available yet"))
  },

  /**
   * Offers are not available yet — no /vendor/offers/* on Workers.
   */
  update: (
    id: string,
    input: { prices?: { amount: number; currency_code: string }[]; sku?: string },
  ): Promise<{ offer: Offer }> => {
    return Promise.reject(new ApiError(501, "Offers are not available yet"))
  },

  /**
   * Offers are not available yet — no /vendor/offers/* on Workers.
   */
  delete: (id: string): Promise<{ id: string; deleted: boolean }> => {
    return Promise.reject(new ApiError(501, "Offers are not available yet"))
  },
}

// ---------------------------------------------------------------------------
// Vendor — Inventory (no seller-scoped inventory endpoints on Workers yet)
// ---------------------------------------------------------------------------

export const inventoryItems = {
  /**
   * Stock levels are not available yet — no /vendor/inventory-items/* on Workers.
   */
  levels: (id: string): Promise<{ inventory_levels: StockLevel[]; count?: number }> => {
    return Promise.reject(new ApiError(501, "Stock levels are not available yet"))
  },

  /**
   * Stock updates are not available yet — no /vendor/inventory-items/* on Workers.
   */
  setLevel: (
    id: string,
    locationId: string,
    stockedQuantity: number,
  ): Promise<{ inventory_item: unknown }> => {
    return Promise.reject(new ApiError(501, "Stock updates are not available yet"))
  },
}

// ---------------------------------------------------------------------------
// Vendor — Orders  (use /vendor/orders — NOT /admin/orders)
// ---------------------------------------------------------------------------

export const orders = {
  /**
   * GET /vendor/orders — Orders scoped to this seller.
   * Returns `{ items }`, adapted to `{ orders }` for the SPA.
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
  },

  /**
   * Single order detail — GET /vendor/orders/:id (items + address), list fallback.
   */
  get: async (id: string) => {
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
  },

  /**
   * Pack step is not available yet — fulfillment is placed → ship → deliver.
   */
  createFulfillment: (
    orderId: string,
    input: { items: { id: string; quantity: number }[]; location_id?: string },
  ) => {
    return Promise.reject(
      new ApiError(501, "Pack step is not available yet — mark as dispatched directly"),
    )
  },

  /**
   * Mark as shipped — POST /vendor/orders/:id/ship (fulfillmentId ignored).
   */
  markShipped: async (
    orderId: string,
    fulfillmentId: string,
    labels: { tracking_number: string; tracking_url?: string }[],
  ) => {
    const data = await post<{ order: WorkersOrderItem }>(`/vendor/orders/${orderId}/ship`)
    return {
      fulfillment: {
        id: fulfillmentId || "workers",
        shipped_at: new Date().toISOString(),
      } satisfies Fulfillment,
      order: mapWorkersOrder(data.order),
    }
  },

  /**
   * Mark as delivered — POST /vendor/orders/:id/deliver (fulfillmentId ignored).
   */
  markDelivered: async (orderId: string, fulfillmentId: string) => {
    const data = await post<{ order: WorkersOrderItem }>(`/vendor/orders/${orderId}/deliver`)
    return {
      fulfillment: {
        id: fulfillmentId || "workers",
        delivered_at: new Date().toISOString(),
      } satisfies Fulfillment,
      order: mapWorkersOrder(data.order),
    }
  },

  /**
   * Cancel request is not available yet.
   */
  cancel: (orderId: string, reason?: string) => {
    return Promise.reject(new ApiError(501, "Cancel request is not available yet"))
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
   * Returns list is not available yet — returns empty (nav hidden).
   */
  list: (params?: { limit?: number; offset?: number; status?: string; order_id?: string }) => {
    return Promise.resolve({
      returns: [] as Return[],
      count: 0,
      limit: Number(params?.limit ?? 0),
      offset: Number(params?.offset ?? 0),
    })
  },

  get: (id: string) => {
    return Promise.reject(new ApiError(501, "Returns are not available yet"))
  },

  receiveItems: (
    returnId: string,
    input: { items: { id: string; quantity: number; description?: string }[] },
  ) => {
    return Promise.reject(new ApiError(501, "Returns are not available yet"))
  },

  confirmReceive: (
    returnId: string,
    input?: { internal_note?: string; description?: string; metadata?: Record<string, unknown> },
  ) => {
    return Promise.reject(new ApiError(501, "Returns are not available yet"))
  },

  dismissItems: (
    returnId: string,
    input: { items: { id: string; quantity: number; internal_note?: string }[] },
  ) => {
    return Promise.reject(new ApiError(501, "Returns are not available yet"))
  },

  refund: (paymentId: string, input: { amount?: number }) => {
    return Promise.reject(new ApiError(501, "Refunds are not available yet"))
  },

  reasons: () => {
    return Promise.resolve({ return_reasons: [] as ReturnReason[] })
  },
}

// ---------------------------------------------------------------------------
// Vendor — Stats & Onboarding
// ---------------------------------------------------------------------------

export type VendorTask = {
  kind: "approval" | "changes" | "drafts" | "dispatch" | "logo" | "momo" | "address"
  title: string
  detail: string
  href: string
  count: number
}

export type VendorHealth = {
  status: "healthy" | "attention" | "blocked"
  items: { key: string; label: string; detail: string; state: string; href: string }[]
}

export const health = {
  /** GET /vendor/health — account standing scorecard. */
  get: () => get<VendorHealth>("/vendor/health"),
}

export const tasks = {
  /** GET /vendor/tasks — what needs this seller's attention. */
  list: () => get<{ tasks: VendorTask[] }>("/vendor/tasks"),
}

export type ShopTraffic = {
  views30d: number
  conversion: number
  series: { date: string; views: number }[]
  top: { productId: string; title: string; thumbnail: string | null; views: number }[]
}

export const shopTraffic = {
  /** GET /vendor/stats/shop — own traffic: views, conversion, top products. */
  get: () => get<ShopTraffic>("/vendor/stats/shop"),
}

export const stats = {
  /**
   * Live ops snapshot — derived from products + orders.
   */
  get: async (): Promise<VendorStats> => {
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
  },

  /**
   * Seller readiness — GET /vendor/onboarding/status mapped to SellerReadiness.
   */
  readiness: async (): Promise<SellerReadiness> => {
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
  },
}

export const onboarding = {
  /**
   * Ghana delivery / MoMo setup — expects displayName, region, deliveryFeePesewas, momo{…}.
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
  },
}

// ---------------------------------------------------------------------------
// Vendor — Catalog support
// ---------------------------------------------------------------------------

export const catalog = {
  /**
   * Category list for product tagging — GET /store/categories (nav tree) flattened to leaves.
   */
  categories: async () => {
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
  },

  /**
   * Markets list is not available yet — returns empty.
   */
  markets: () => {
    return Promise.resolve({ markets: [] as { id: string; name: string; countries: string[] }[] })
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
 * Login — sellerId is on the JWT claims / login payload.
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
