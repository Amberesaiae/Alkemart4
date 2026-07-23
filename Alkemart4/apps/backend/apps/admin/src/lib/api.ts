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
  seller: { id: string; name: string; handle: string }
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
  country_code: string
  display_name: string
  locale: {
    phone?: { example: string; hint: string }
    address?: { fields: { key: string; label: string }[] }
    payments?: { preferred: string[] }
  }
}

const BASE = import.meta.env.VITE_BACKEND_URL || ""

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const extraHeaders: Record<string, string> = {}
  if (init.body !== undefined && typeof init.body === "string") {
    extraHeaders["Content-Type"] = "application/json"
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

// Auth
export const auth = {
  login: (email: string, password: string) =>
    apiFetch("/auth/user/emailpass", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch("/auth/session", { method: "DELETE" }),
  getSession: () => apiFetch<{ user: { id: string; email: string } }>("/auth/session"),
}

// Stats
export const platformStats = {
  get: () => apiFetch<PlatformStats>("/admin/alkemart/stats"),
}

// Product moderation
export const moderation = {
  listProducts: () => apiFetch<{ proposed: ProposedProduct[] }>("/admin/alkemart/moderation/products"),
  confirmProduct: (id: string) => apiFetch(`/admin/products/${id}/confirm`, { method: "POST" }),
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
    if (params?.status) sp.set("status[]", params.status)
    if (params?.limit) sp.set("limit", String(params.limit))
    if (params?.offset) sp.set("offset", String(params.offset))
    return apiFetch<{ orders: AdminOrder[]; count: number }>(`/admin/orders?${sp}`)
  },
}

// Markets
export const markets = {
  list: () => apiFetch<{ markets: Market[] }>("/admin/alkemart/markets"),
}
