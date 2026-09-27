import { getAlkemartApiUrl } from "./env"

const SESSION_KEY = "alkemart_session"

export type SessionCustomer = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  role?: string
  sellerId?: string
  token?: string
}

type AuthSession = {
  token: string
  user: {
    id: string
    email: string
    role: string
    sellerId?: string
  }
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.token || !parsed?.user?.id) return null
    return parsed
  } catch {
    return null
  }
}

function writeStoredSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function toCustomer(session: AuthSession): SessionCustomer {
  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    sellerId: session.user.sellerId,
    token: session.token,
  }
}

async function workersAuth(
  path: "/store/auth/login" | "/store/auth/register",
  body: Record<string, unknown>,
): Promise<SessionCustomer> {
  const base = getAlkemartApiUrl()
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as AuthSession & { error?: string }
  if (!res.ok) {
    throw new Error(json.error || `auth failed (${res.status})`)
  }
  if (!json.token || !json.user) throw new Error("auth response missing token")
  writeStoredSession({ token: json.token, user: json.user })
  return toCustomer({ token: json.token, user: json.user })
}

export async function getSessionCustomer(): Promise<SessionCustomer | null> {
  const session = readStoredSession()
  return session ? toCustomer(session) : null
}

export async function login(email: string, password: string): Promise<SessionCustomer> {
  return workersAuth("/store/auth/login", { email: email.trim(), password })
}

export async function register(input: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}): Promise<SessionCustomer> {
  return workersAuth("/store/auth/register", {
    email: input.email.trim(),
    password: input.password,
  })
}

/** Swap in a fresh session (e.g. after a password change retires the old one). */
export function replaceSession(next: { token: string; user: AuthSession["user"] }): void {
  writeStoredSession(next)
}

export async function logout(): Promise<void> {
  writeStoredSession(null)
}

/**
 * Buyer SPA roles (storefront only):
 * - guest: browse, cart, COD checkout, order-by-id
 * - customer (signed-in): + addresses, account orders, profile
 *
 * Seller / admin screens live in dedicated Workers apps.
 */
export type BuyerAccess = "guest" | "customer"

export async function getBuyerAccess(): Promise<BuyerAccess> {
  const me = await getSessionCustomer()
  return me ? "customer" : "guest"
}

export function getWorkersAccessToken(): string | null {
  return readStoredSession()?.token ?? null
}
