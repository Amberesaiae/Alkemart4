import { getAlkemartApiUrl } from "./env"
import { workosBrowser, workosEnabled } from "./workos"

const SESSION_KEY = "alkemart_session"

export type SessionCustomer = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  role?: string
  sellerId?: string
  token?: string
  emailVerified?: boolean
}

type AuthSession = {
  token: string
  user: {
    id: string
    email: string
    role: string
    sellerId?: string
    emailVerified?: boolean
  }
}

function readStoredSession(): AuthSession | null {
  if (workosEnabled) return workosBrowser.peek()
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
  if (workosEnabled) {
    if (!session) workosBrowser.clear()
    return
  }
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
    emailVerified: Boolean(session.user.emailVerified),
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
  if (workosEnabled) {
    const session = await workosBrowser.restore()
    return session ? toCustomer(session) : null
  }
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
  turnstileToken?: string
}): Promise<SessionCustomer> {
  return workersAuth("/store/auth/register", {
    email: input.email.trim(),
    password: input.password,
    turnstileToken: input.turnstileToken,
  })
}

/** Swap in a fresh session (e.g. after a password change retires the old one). */
export function replaceSession(next: { token: string; user: AuthSession["user"] }): void {
  writeStoredSession(next)
}

export function markSessionEmailVerified(userId: string): void {
  const session = readStoredSession()
  if (session?.user.id === userId) writeStoredSession({ ...session, user: { ...session.user, emailVerified: true } })
}

export async function resendEmailVerification(): Promise<void> {
  const token = getWorkersAccessToken()
  if (!token) throw new Error("Sign in to resend your verification email")
  const res = await fetch(`${getAlkemartApiUrl()}/store/auth/verify-email/request`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Could not send verification email. Try again shortly.")
}

export async function confirmEmailVerification(token: string): Promise<void> {
  const res = await fetch(`${getAlkemartApiUrl()}/store/auth/verify-email/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new Error("This verification link expired or was already used. Request a new one.")
  const result = await res.json() as { userId: string }
  markSessionEmailVerified(result.userId)
}

export async function logout(): Promise<void> {
  if (workosEnabled) await workosBrowser.logout()
  writeStoredSession(null)
}

/**
 * Buyer SPA roles (storefront only):
 * - guest: browse and build a cart; purchasing requires verified sign-in
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

export async function ensureWorkersAccessToken(): Promise<string | null> {
  return workosEnabled ? (await workosBrowser.restore())?.token ?? null : getWorkersAccessToken()
}
