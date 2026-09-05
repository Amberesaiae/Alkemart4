const API_URL = (
  import.meta.env.VITE_ALKEMART_API_URL as string | undefined
)?.replace(/\/$/, "") || "https://alkemart-api.glean-circular-passport.workers.dev"

const TOKEN_KEY = "alkemart_vendor_token"

export type SessionUser = {
  id: string
  email: string
  role: string
  sellerId?: string
}

type AuthResponse = { token: string; user: SessionUser }

function token(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
}

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem("alkemart_vendor_user")
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

function saveSession(res: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, res.token)
  localStorage.setItem("alkemart_vendor_user", JSON.stringify(res.user))
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

export async function registerVendor(input: {
  email: string
  password: string
  sellerName: string
  sellerHandle: string
}) {
  const res = await request<AuthResponse>("/vendor/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  })
  saveSession(res)
  return res.user
}

export async function loginVendor(email: string, password: string) {
  const res = await request<AuthResponse>("/vendor/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  saveSession(res)
  return res.user
}

export async function me() {
  return request<{ userId: string; role: string; sellerId?: string }>("/vendor/me")
}

export async function onboardingStatus() {
  return request<{ ready: boolean; missing: string[] }>("/vendor/onboarding/status")
}

export async function ghanaSetup(input: {
  displayName: string
  region: string
  digitalAddress?: string
  deliveryFeePesewas: string
  momo: { provider: "mtn" | "vodafone" | "airteltigo"; phone: string; accountName: string }
}) {
  return request<{ ready: boolean; missing: string[] }>("/vendor/onboarding/ghana-setup", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function listProducts() {
  return request<{ items: Array<Record<string, unknown>> }>("/vendor/products")
}

export async function createProduct(input: {
  title: string
  description?: string
  primaryCategoryId: string
  pricePesewas: string
  onHand: number
  sku?: string
}) {
  return request<{ product: Record<string, unknown>; offer: Record<string, unknown> }>(
    "/vendor/products",
    { method: "POST", body: JSON.stringify(input) },
  )
}

export async function listOrders() {
  return request<{ items: Array<Record<string, unknown>> }>("/vendor/orders")
}

export async function listCategories() {
  return request<{
    categories: Array<{
      id: string
      name: string
      children?: Array<{
        id: string
        name: string
        children?: Array<{ id: string; name: string }>
      }>
    }>
  }>("/store/categories")
}

export function flattenLeafCategories(
  tree: Array<{ id: string; name: string; children?: Array<{ id: string; name: string; children?: Array<{ id: string; name: string }> }> }>,
): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = []
  const walk = (nodes: typeof tree, prefix = "") => {
    for (const n of nodes) {
      const label = prefix ? `${prefix} / ${n.name}` : n.name
      if (!n.children?.length) out.push({ id: n.id, name: label })
      else walk(n.children, label)
    }
  }
  walk(tree)
  return out
}

export { API_URL }
