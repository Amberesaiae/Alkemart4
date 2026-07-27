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

const TOKEN_KEY = "alkemart:admin_token"

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
function setToken(token: string | null) {
  try { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY) } catch {}
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const extraHeaders: Record<string, string> = {}
  if (init.body !== undefined && typeof init.body === "string") {
    extraHeaders["Content-Type"] = "application/json"
  }
  const token = getToken()
  if (token) extraHeaders["Authorization"] = `Bearer ${token}`
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
  first_name?: string
  last_name?: string
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1]
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json)
  } catch { return null }
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
  logout: async () => {
    try { await apiFetch("/auth/session", { method: "DELETE" }) } catch {}
    setToken(null)
  },
  getSession: async (): Promise<{ user: AuthUser } | null> => {
    const token = getToken()
    if (!token) return null
    const payload = decodeJwtPayload(token)
    if (!payload) { setToken(null); return null }
    if (payload.exp && typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      setToken(null)
      return null
    }
    return {
      user: {
        id: payload.actor_id as string || "",
        email: (payload.app_metadata as Record<string,string>)?.email || (payload.user_metadata as Record<string,string>)?.email || "",
      },
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
