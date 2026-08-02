// Platform Stats
export type PlatformStats = {
  total_orders: number
  total_gmv_ghs: number
  active_sellers: number
  catalog_size: number
  gmv_last_30_days?: Array<{ date: string; amount: number }>
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

const BASE = import.meta.env.VITE_MERCUR_BACKEND_URL || ""

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
    headers: { Accept: "application/json", ...extraHeaders, ...(init.headers as Record<string,string>) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(body.message || `HTTP ${res.status}`)
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
    const data = await apiFetch<{ token?: string }>("/auth/user/emailpass", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    if (data.token) setToken(data.token)
    return data
  },
  logout: async (hasSession?: boolean) => {
    setToken(null)
    if (hasSession === false) return
    try { await apiFetch("/auth/session", { method: "DELETE" }) } catch { /* ignore */ }
  },
  getSession: async (): Promise<{ user: AuthUser } | null> => {
    try {
      const data = await apiFetch<{ user: Record<string, unknown> }>("/auth/session", { method: "POST" })
      if (!data.user) return null
      const actor = data.user
      const roles: string[] = (actor.app_metadata as Record<string, unknown>)?.["roles"] as string[] ?? []
      const role = roles.includes("role_super_admin") ? "admin" : roles[0] ?? "user"
      return {
        user: {
          id: (actor.actor_id as string) ?? "",
          email: (actor.entity_id as string) ?? "",
          role,
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
  listProducts: () => apiFetch<{ proposed: ProposedProduct[] }>("/admin/alkemart/moderation/products"),
  confirmProduct: (id: string) => apiFetch(`/admin/products/${id}/approve`, { method: "POST" }),
  rejectProduct: (id: string, reason: string) =>
    apiFetch(`/admin/products/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  requestChanges: (id: string, reason: string) =>
    apiFetch(`/admin/products/${id}/request-changes`, { method: "POST", body: JSON.stringify({ reason }) }),
}

// Seller queue
export const sellerQueue = {
  list: () => apiFetch<{ pending: SellerApplication[], rejected_applications: SellerApplication[] }>("/admin/alkemart/moderation/sellers"),
  approve: (id: string) => apiFetch(`/admin/sellers/${id}/approve`, { method: "POST" }),
  suspend: (id: string, reason: string) =>
    apiFetch(`/admin/sellers/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }),
}

// Orders
export const adminOrders = {
  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.status) sp.set("status", params.status)
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
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

// Products (for listing all products)
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
  list: (params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
    return apiFetch<{ payouts: AdminPayout[]; count: number }>(`/admin/payouts?${sp}`)
  },
  retrieve: (id: string) =>
    apiFetch<{ payout: AdminPayout }>(`/admin/payouts/${id}`),
  trigger: (input: {
    seller_id: string
    amount: number
    currency_code?: string
    period_start?: string
    period_end?: string
    note?: string
  }) =>
    apiFetch<{ payout: { seller_id: string; amount: number; currency_code: string; transfer_code: string; status: string } }>(
      "/admin/payouts", { method: "POST", body: JSON.stringify(input) }
    ),
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
}

export const adminSellers = {
  retrieve: (id: string) =>
    apiFetch<{ seller: AdminSeller }>(`/admin/sellers/${id}`),

  list: (params?: { limit?: number; offset?: number; q?: string }) => {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
    if (params?.q) sp.set("q", params.q)
    return apiFetch<{ sellers: AdminSeller[]; count: number }>(`/admin/sellers?${sp}`)
  },

  approve: (id: string) =>
    apiFetch(`/admin/sellers/${id}/approve`, { method: "POST" }),

  suspend: (id: string, reason: string) =>
    apiFetch(`/admin/sellers/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }),

  unsuspend: (id: string) =>
    apiFetch(`/admin/sellers/${id}/unsuspend`, { method: "POST" }),

  terminate: (id: string, reason: string) =>
    apiFetch(`/admin/sellers/${id}/terminate`, { method: "POST", body: JSON.stringify({ reason }) }),

  setCommission: (id: string, commission_bps: number) =>
    apiFetch(`/admin/sellers/${id}/commission`, { method: "POST", body: JSON.stringify({ commission_bps }) }),
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
  retrieve: (id: string) =>
    apiFetch<{ order: AdminOrderDetail }>(`/admin/orders/${id}`),
  cancel: (id: string, reason?: string) =>
    apiFetch(`/admin/orders/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
}
