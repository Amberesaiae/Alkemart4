import { isWorkersApi } from "./config"

export { isWorkersApi }

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// Platform Stats
export type PlatformStats = {
  total_orders: number
  total_gmv_ghs: number
  active_sellers: number
  catalog_size: number
  gmv_last_30_days?: Array<{ date: string; amount: number }>
  top_products?: Array<{
    title: string
    thumbnail: string | null
    units: number
    gmv: number
  }>
}

// Product Moderation
export type ProposedProduct = {
  id: string; title: string; thumbnail?: string
  status: "proposed"
  quality_score?: number
  seller: { id: string; name: string; handle: string } | null
  created_at: string
}

// Seller Application
export type SellerApplication = {
  id: string; name: string; handle: string
  member: { email: string; first_name: string; last_name: string }
  created_at: string; status: "pending" | "active" | "suspended"
}

// Order (admin view)
export type AdminOrder = {
  id: string; display_id: number; status: string; fulfillment_status: string
  payment_status: string; total: number; currency_code: string
  created_at: string
  customer?: { first_name: string; last_name: string; email: string }
}

// Market
export type Market = {
  region_id: string
  region_name: string
  currency_code: string
  display_name: string
  name?: string
  countries?: Array<{ iso_2: string; name: string }>
  country_code?: string
  locale: {
    phone?: { example: string; hint: string }
    address?: { fields: { key: string; label: string }[] }
    payments?: { preferred: string[] }
  }
}

// Commission Rate
export type CommissionRate = {
  id: string
  name: string
  code: string
  type: "percentage" | "fixed"
  value: number
  currency_code?: string
  include_tax: boolean
  include_shipping: boolean
  is_enabled: boolean
  is_default: boolean
  created_at: string
  updated_at: string
  rules?: Array<{ id: string; reference: string; reference_id: string }>
}

// Featured Product
export type FeaturedProduct = {
  id: string
  title: string
  thumbnail?: string
  metadata?: Record<string, string>
  sale_status?: string
  created_at: string
  seller?: { name: string; handle: string }
}

// Promotion (Medusa)
export type AdminPromotion = {
  id: string
  code: string
  type: "standard" | "buyget" | "free_shipping"
  status: string
  is_automatic: boolean
  created_at: string
  application_method?: {
    value: number
    type: "fixed" | "percentage"
    currency_code?: string
    max_quantity?: number
    target_type: "items" | "order" | "shipping"
  }
}

// Seller detail
export type AdminSeller = {
  id: string
  name: string
  handle: string
  email: string
  phone: string | null
  description: string | null
  logo: string | null
  banner: string | null
  status: string
  status_reason: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  address: {
    address_1: string | null
    address_2: string | null
    city: string | null
    country_code: string | null
    province: string | null
    postal_code: string | null
  } | null
  members: Array<{
    id: string
    is_owner: boolean
    member: {
      id: string
      email: string
      first_name: string
      last_name: string
    }
  }>
  /** Workers-only field from GET /admin/sellers */
  commissionBps?: number
}

type WorkersSeller = {
  id: string
  handle: string
  name: string
  status: string
  commissionBps?: number
}

type WorkersProduct = {
  id: string
  title: string
  description?: string | null
  status: string
  primaryCategoryId?: string
  sellerId?: string | null
  imageUrl?: string | null
}

function mapWorkersSeller(s: WorkersSeller): AdminSeller {
  return {
    id: s.id,
    name: s.name,
    handle: s.handle,
    email: "",
    phone: null,
    description: null,
    logo: null,
    banner: null,
    status: s.status,
    status_reason: null,
    approved_at: null,
    created_at: "",
    updated_at: "",
    address: null,
    members: [],
    commissionBps: s.commissionBps,
  }
}

function mapWorkersProduct(p: WorkersProduct): ProposedProduct {
  return {
    id: p.id,
    title: p.title,
    thumbnail: p.imageUrl ?? undefined,
    status: "proposed",
    seller: p.sellerId
      ? { id: p.sellerId, name: "", handle: "" }
      : null,
    created_at: "",
  }
}

const BASE = (
  (import.meta.env.VITE_ALKEMART_API_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_MERCUR_BACKEND_URL as string | undefined)?.trim() ||
  ""
).replace(/\/$/, "")

const TOKEN_KEY = "alk:admin_token"
let _token: string | null = null

function getToken(): string | null {
  if (_token) return _token
  try { _token = sessionStorage.getItem(TOKEN_KEY) } catch { /* storage may be unavailable */ }
  return _token
}

function setToken(t: string | null) {
  _token = t
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* storage may be unavailable */ }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const extraHeaders: Record<string, string> = {}
  if (init.body !== undefined && typeof init.body === "string") {
    extraHeaders["Content-Type"] = "application/json"
  }
  const token = getToken()
  if (token) {
    extraHeaders["Authorization"] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { Accept: "application/json", ...extraHeaders, ...(init.headers as Record<string, string>) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string; error?: string }
    throw new ApiError(res.status, body.error || body.message || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface AuthUser {
  id: string
  email: string
  role?: string
  first_name?: string
  last_name?: string
}

export const auth = {
  login: async (email: string, password: string) => {
    const data = await apiFetch<{
      token?: string
      user?: { id: string; email: string; role: string }
    }>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    if (data.token) setToken(data.token)
    return data
  },
  logout: async (_hasSession?: boolean) => {
    setToken(null)
  },
  getSession: async (): Promise<{ user: AuthUser } | null> => {
    try {
      const me = await apiFetch<{ userId: string; role: string }>("/admin/me")
      if (!me?.userId) return null
      return {
        user: {
          id: me.userId,
          email: "",
          role: me.role === "admin" ? "admin" : me.role,
        },
      }
    } catch {
      return null
    }
  },
}

// Stats
export const platformStats = {
  get: () => apiFetch<PlatformStats>("/admin/alkemart/stats"),
}

// Product moderation
export const moderation = {
  listProducts: async () => {
    if (isWorkersApi) {
      try {
        const data = await apiFetch<{ items: WorkersProduct[] }>(
          "/admin/products?status=proposed",
        )
        return {
          proposed: (data.items ?? [])
            .filter((p) => p.status === "proposed")
            .map(mapWorkersProduct),
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return { proposed: [] as ProposedProduct[] }
        }
        throw err
      }
    }
    return apiFetch<{ proposed: ProposedProduct[] }>("/admin/alkemart/moderation/products")
  },
  confirmProduct: (id: string) => apiFetch(`/admin/products/${id}/approve`, { method: "POST" }),
  rejectProduct: (id: string, reason: string) =>
    apiFetch(`/admin/products/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  requestChanges: (id: string, reason: string) =>
    apiFetch(`/admin/products/${id}/request-changes`, { method: "POST", body: JSON.stringify({ reason }) }),
}

// Seller queue — Workers `/admin/sellers` (+ legacy Mercur path fallback)
export const sellerQueue = {
  list: async () => {
    if (isWorkersApi) {
      const data = await apiFetch<{ items: WorkersSeller[] }>("/admin/sellers")
      const pending = (data.items ?? [])
        .filter((s) => s.status === "pending_approval")
        .map((s) => ({
          id: s.id,
          name: s.name,
          handle: s.handle,
          member: { email: "", first_name: "", last_name: "" },
          created_at: "",
          status: "pending" as const,
        }))
      return { pending, rejected_applications: [] as SellerApplication[] }
    }
    try {
      const data = await apiFetch<{ items: WorkersSeller[] }>("/admin/sellers")
      if (Array.isArray(data.items)) {
        const pending = data.items
          .filter((s) => s.status === "pending_approval")
          .map((s) => ({
            id: s.id,
            name: s.name,
            handle: s.handle,
            member: { email: "", first_name: "", last_name: "" },
            created_at: "",
            status: "pending" as const,
          }))
        return { pending, rejected_applications: [] as SellerApplication[] }
      }
    } catch {
      /* fall through to Mercur path */
    }
    return apiFetch<{ pending: SellerApplication[]; rejected_applications: SellerApplication[] }>(
      "/admin/alkemart/moderation/sellers",
    )
  },
  approve: (id: string) => apiFetch(`/admin/sellers/${id}/approve`, { method: "POST" }),
  suspend: (id: string, _reason?: string) =>
    apiFetch(`/admin/sellers/${id}/suspend`, { method: "POST" }),
}

// Orders
export const adminOrders = {
  list: async (params?: { status?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.status) sp.set("status", params.status)
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
    if (isWorkersApi) {
      const data = await apiFetch<{
        items: Array<{
          id: string
          buyerEmail: string
          totalPesewas: string
          currency: string
          createdAt: string | null
          orders: Array<{ id: string; status: string }>
        }>
      }>(`/admin/orders?${sp}`)
      const orders: AdminOrder[] = (data.items ?? []).map((g, i) => {
        const statuses = g.orders.map((o) => o.status)
        let fulfillment = "placed"
        if (statuses.every((s) => s === "delivered")) fulfillment = "delivered"
        else if (statuses.some((s) => s === "shipped" || s === "delivered")) fulfillment = "shipped"
        return {
          id: g.id,
          display_id: i + 1,
          status: fulfillment,
          fulfillment_status: fulfillment,
          payment_status: "captured",
          total: Number(g.totalPesewas) || 0,
          currency_code: g.currency || "ghs",
          created_at: g.createdAt ?? new Date().toISOString(),
          customer: {
            first_name: "",
            last_name: "",
            email: g.buyerEmail,
          },
        }
      })
      return { orders, count: orders.length }
    }
    return apiFetch<{ orders: AdminOrder[]; count: number }>(`/admin/orders?${sp}`)
  },
}

// Markets
export const markets = {
  list: () => apiFetch<{ markets: Market[] }>("/admin/alkemart/markets"),
}

// Commission Rates
export const commissionRates = {
  list: (params?: { offset?: number; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.offset) sp.set("offset", String(params.offset))
    if (params?.limit) sp.set("limit", String(params.limit))
    return apiFetch<{ commission_rates: CommissionRate[]; count: number }>(`/admin/commission-rates?${sp}`)
  },
  create: (data: { name: string; code: string; type: "percentage" | "fixed"; value: number; is_enabled?: boolean; is_default?: boolean }) =>
    apiFetch<{ commission_rate: CommissionRate }>("/admin/commission-rates", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CommissionRate>) =>
    apiFetch<{ commission_rate: CommissionRate }>(`/admin/commission-rates/${id}`, { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/admin/commission-rates/${id}`, { method: "DELETE" }),
}

// Featured Products
export const featuredProducts = {
  list: () => apiFetch<{ products: FeaturedProduct[] }>("/admin/featured-products"),
  toggle: (id: string, featured: string) =>
    apiFetch("/admin/featured-products", { method: "POST", body: JSON.stringify({ id, featured }) }),
}

// Products (for listing all products — Mercur featured/categories tooling)
export const adminProducts = {
  list: (params?: { offset?: number; limit?: number; q?: string }) => {
    const sp = new URLSearchParams()
    if (params?.offset) sp.set("offset", String(params.offset))
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.q) sp.set("q", params.q)
    return apiFetch<{ products: FeaturedProduct[]; count: number }>(`/admin/products?${sp}`)
  },
  update: (id: string, data: { metadata?: Record<string, string> }) =>
    apiFetch(`/admin/products/${id}`, { method: "POST", body: JSON.stringify(data) }),
}

// Returns (admin overview)
export type AdminReturn = {
  id: string
  display_id: number
  order_id: string
  status: string
  refund_amount?: number | null
  items_count?: number
  created_at: string
  seller?: { id: string; name: string; handle: string }
}

export type AdminReturnDetail = AdminReturn & {
  order?: {
    display_id: number
    total: number
    currency_code: string
    customer?: { first_name?: string; last_name?: string; email?: string; phone?: string }
    shipping_address?: { first_name?: string; address_1?: string; city?: string; country_code?: string; phone?: string }
  }
  items?: Array<{ id: string; item_id: string; quantity: number; received_quantity: number; note?: string | null }>
  metadata?: Record<string, unknown>
  payment_id?: string | null
  rejection_reason?: string | null
}

export const adminReturns = {
  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.status) sp.set("status", params.status)
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
    return apiFetch<{ returns: AdminReturn[]; count: number }>(`/admin/returns?${sp}`)
  },

  retrieve: (id: string) =>
    apiFetch<{ return: AdminReturnDetail }>(`/admin/returns/${id}`),

  approve: (id: string, note?: string) =>
    apiFetch(`/admin/returns/${id}/approve`, { method: "POST", body: JSON.stringify({ note }) }),

  reject: (id: string, reason: string) =>
    apiFetch(`/admin/returns/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),

  refund: (id: string) =>
    apiFetch(`/admin/returns/${id}/refund`, { method: "POST" }),
}

// Promotions
export const adminPromotions = {
  list: (params?: { offset?: number; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.offset) sp.set("offset", String(params.offset))
    if (params?.limit) sp.set("limit", String(params.limit))
    return apiFetch<{ promotions: AdminPromotion[]; count: number }>(`/admin/promotions?${sp}`)
  },
  create: (data: { code: string; type: string; value: number; value_type: "fixed" | "percentage" }) =>
    apiFetch("/admin/promotions", { method: "POST", body: JSON.stringify(data) }),
}

// Payout
export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "canceled"
export type AdminPayout = {
  id: string
  display_id: number
  account_id: string
  amount: number
  currency_code: string
  status: PayoutStatus
  data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export const adminPayouts = {
  list: async (params?: { limit?: number; offset?: number }) => {
    if (isWorkersApi) {
      // Workers currently only exposes POST /admin/payouts (trigger). Soft-empty list.
      return { payouts: [] as AdminPayout[], count: 0 }
    }
    const sp = new URLSearchParams()
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
    return apiFetch<{ payouts: AdminPayout[]; count: number }>(`/admin/payouts?${sp}`)
  },
  retrieve: (id: string) =>
    apiFetch<{ payout: AdminPayout }>(`/admin/payouts/${id}`),
  trigger: async (input: {
    seller_id: string
    amount?: number
    currency_code?: string
    period_start?: string
    period_end?: string
    note?: string
  }): Promise<{ payout: { status: string } }> => {
    if (isWorkersApi) {
      return apiFetch("/admin/payouts", {
        method: "POST",
        body: JSON.stringify({ sellerId: input.seller_id }),
      })
    }
    return apiFetch("/admin/payouts", { method: "POST", body: JSON.stringify(input) })
  },
}

// Disputes (returns with metadata.is_disputed = true)
export type AdminDispute = {
  id: string
  display_id?: number
  order_id: string
  status: string
  metadata?: Record<string, unknown>
  created_at: string
  order?: { display_id?: number; total?: number; currency_code?: string }
}

export const adminDisputes = {
  list: (params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
    return apiFetch<{ disputes: AdminDispute[]; count: number }>(`/admin/disputes?${sp}`)
  },
  retrieve: (id: string) =>
    apiFetch<{ dispute: AdminDispute }>(`/admin/disputes/${id}`),
  resolve: (id: string, input: { decision: "favor_buyer" | "favor_seller" | "partial"; refund_amount?: number; note?: string }) =>
    apiFetch(`/admin/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify(input) }),
}

export const adminSellers = {
  retrieve: async (id: string) => {
    if (isWorkersApi) {
      const data = await apiFetch<{ items: WorkersSeller[] }>("/admin/sellers")
      const hit = (data.items ?? []).find((s) => s.id === id)
      if (!hit) throw new ApiError(404, "seller not found")
      return { seller: mapWorkersSeller(hit) }
    }
    return apiFetch<{ seller: AdminSeller }>(`/admin/sellers/${id}`)
  },

  list: async (params?: { limit?: number; offset?: number; q?: string }) => {
    if (isWorkersApi) {
      const data = await apiFetch<{ items: WorkersSeller[] }>("/admin/sellers")
      let sellers = (data.items ?? []).map(mapWorkersSeller)
      const q = params?.q?.trim().toLowerCase()
      if (q) {
        sellers = sellers.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.handle.toLowerCase().includes(q),
        )
      }
      const offset = params?.offset ?? 0
      const limit = params?.limit ?? sellers.length
      const page = sellers.slice(offset, offset + limit)
      return { sellers: page, count: sellers.length }
    }
    const sp = new URLSearchParams()
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
    if (params?.q) sp.set("q", params.q)
    return apiFetch<{ sellers: AdminSeller[]; count: number }>(`/admin/sellers?${sp}`)
  },

  approve: (id: string) =>
    apiFetch(`/admin/sellers/${id}/approve`, { method: "POST" }),

  suspend: (id: string, reason: string) =>
    apiFetch(`/admin/sellers/${id}/suspend`, {
      method: "POST",
      body: isWorkersApi ? undefined : JSON.stringify({ reason }),
    }),

  unsuspend: (id: string) =>
    apiFetch(`/admin/sellers/${id}/unsuspend`, { method: "POST" }),

  terminate: (id: string, reason: string) =>
    apiFetch(`/admin/sellers/${id}/terminate`, {
      method: "POST",
      body: isWorkersApi ? undefined : JSON.stringify({ reason }),
    }),

  setCommission: (id: string, commission_bps: number) =>
    apiFetch(`/admin/sellers/${id}/commission`, {
      method: "POST",
      body: JSON.stringify(
        isWorkersApi
          ? { commissionBps: commission_bps }
          : { commission_bps },
      ),
    }),
}

// Categories (taxonomy management)
export type AdminCategory = {
  id: string
  name: string
  description: string | null
  handle: string | null
  is_active: boolean
  is_internal: boolean
  is_restricted: boolean
  rank: number | null
  parent_category_id: string | null
  created_at: string
  updated_at: string
  category_children?: AdminCategory[]
  parent_category?: { id: string; name: string; handle: string } | null
}

export type AdminCategoryInput = {
  name: string
  description?: string
  handle?: string
  is_active?: boolean
  is_internal?: boolean
  rank?: number
  parent_category_id?: string | null
}

export const adminCategories = {
  list: (params?: { is_internal?: boolean; parent_category_id?: string | null; q?: string }) => {
    const sp = new URLSearchParams()
    if (params?.is_internal !== undefined) sp.set("is_internal", String(params.is_internal))
    if (params?.parent_category_id) sp.set("parent_category_id", params.parent_category_id)
    if (params?.q) sp.set("q", params.q)
    return apiFetch<{ product_categories: AdminCategory[]; count: number }>(
      `/admin/product-categories?${sp}`,
    )
  },
  create: (data: AdminCategoryInput) =>
    apiFetch<{ product_category: AdminCategory }>("/admin/product-categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<AdminCategoryInput>) =>
    apiFetch<{ product_category: AdminCategory }>(
      `/admin/product-categories/${id}`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  remove: (id: string) =>
    apiFetch<{ id: string; deleted: boolean }>(
      `/admin/product-categories/${id}`,
      { method: "DELETE" },
    ),
  linkProducts: (id: string, add: string[], remove: string[]) =>
    apiFetch<{ id: string }>(`/admin/product-categories/${id}/products`, {
      method: "POST",
      body: JSON.stringify({ add, remove }),
    }),
  // Lightweight product snapshot for per-category counts + assignment.
  productsWithCategories: () =>
    apiFetch<{
      products: Array<{
        id: string
        title: string
        thumbnail?: string | null
        categories?: Array<{ id: string }>
      }>
    }>("/admin/products?limit=1000&fields=id,title,thumbnail,categories.id,categories.name"),
}

// Order detail
export type AdminOrderItem = {
  id: string
  title: string
  quantity: number
  unit_price: number
  thumbnail: string | null
  variant_title: string | null
}

export type AdminOrderDetail = AdminOrder & {
  items: AdminOrderItem[]
  shipping_address: {
    first_name: string | null
    last_name: string | null
    phone: string | null
    address_1: string | null
    address_2: string | null
    city: string | null
    country_code: string | null
    province: string | null
    postal_code: string | null
  } | null
  email: string | null
}

export const adminOrderDetail = {
  retrieve: async (id: string) => {
    if (isWorkersApi) {
      const data = await apiFetch<{
        orderGroup: {
          id: string
          buyerEmail: string
          totalPesewas: string
          currency: string
          createdAt: string | null
          shippingAddress: Record<string, unknown> | null
          paymentStatus: string | null
          orders: Array<{
            id: string
            sellerId: string
            status: string
            items: Array<{
              id: string
              title: string
              qty: number
              unitPricePesewas: string
            }>
          }>
        }
      }>(`/admin/orders/${id}`)
      const g = data.orderGroup
      const statuses = g.orders.map((o) => o.status)
      let fulfillment = "placed"
      if (statuses.every((s) => s === "delivered")) fulfillment = "delivered"
      else if (statuses.some((s) => s === "shipped" || s === "delivered")) fulfillment = "shipped"
      const addr = g.shippingAddress
      const order: AdminOrderDetail = {
        id: g.id,
        display_id: 0,
        status: fulfillment,
        fulfillment_status: fulfillment,
        payment_status: g.paymentStatus ?? "captured",
        total: Number(g.totalPesewas) || 0,
        currency_code: g.currency || "ghs",
        created_at: g.createdAt ?? new Date().toISOString(),
        customer: { first_name: "", last_name: "", email: g.buyerEmail },
        email: g.buyerEmail,
        items: g.orders.flatMap((o) =>
          o.items.map((item) => ({
            id: item.id,
            title: item.title,
            quantity: item.qty,
            unit_price: Number(item.unitPricePesewas) || 0,
            thumbnail: null,
            variant_title: null,
          })),
        ),
        shipping_address: addr
          ? {
              first_name: String(addr.first_name ?? null),
              last_name: String(addr.last_name ?? null),
              phone: String(addr.phone ?? null),
              address_1: String(addr.address_1 ?? null),
              address_2: addr.address_2 ? String(addr.address_2) : null,
              city: String(addr.city ?? null),
              country_code: String(addr.country_code ?? null),
              province: addr.province ? String(addr.province) : null,
              postal_code: addr.postal_code ? String(addr.postal_code) : null,
            }
          : null,
      }
      return { order }
    }
    return apiFetch<{ order: AdminOrderDetail }>(`/admin/orders/${id}`)
  },
  cancel: (id: string, reason?: string) => {
    if (isWorkersApi) {
      return Promise.reject(new ApiError(501, "Order cancel is not available on Workers yet"))
    }
    return apiFetch(`/admin/orders/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
  },
}
