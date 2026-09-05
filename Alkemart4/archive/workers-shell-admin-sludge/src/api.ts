const API_URL = (
  import.meta.env.VITE_ALKEMART_API_URL as string | undefined
)?.replace(/\/$/, "") || "https://alkemart-api.glean-circular-passport.workers.dev"

const TOKEN_KEY = "alkemart_admin_token"
const USER_KEY = "alkemart_admin_user"

export type SessionUser = { id: string; email: string; role: string }
export type Seller = {
  id: string
  handle: string
  name: string
  status: string
  commissionBps: number
}

type AuthResponse = { token: string; user: SessionUser }

function token() {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

function saveSession(res: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, res.token)
  localStorage.setItem(USER_KEY, JSON.stringify(res.user))
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("accept", "application/json")
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }
  const t = token()
  if (t) headers.set("authorization", `Bearer ${t}`)
  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error || `HTTP_${res.status}`)
  return body
}

export async function loginAdmin(email: string, password: string) {
  const res = await request<AuthResponse>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  saveSession(res)
  return res.user
}

export async function me() {
  return request<{ userId: string; role: string }>("/admin/me")
}

export async function listSellers() {
  return request<{ items: Seller[] }>("/admin/sellers")
}

export async function approveSeller(id: string) {
  return request<{ seller: Seller }>(`/admin/sellers/${id}/approve`, { method: "POST" })
}

export async function suspendSeller(id: string) {
  return request<{ seller: Seller }>(`/admin/sellers/${id}/suspend`, { method: "POST" })
}

export async function approveProduct(id: string) {
  return request<{ product: Record<string, unknown> }>(`/admin/products/${id}/approve`, {
    method: "POST",
  })
}

export { API_URL }
