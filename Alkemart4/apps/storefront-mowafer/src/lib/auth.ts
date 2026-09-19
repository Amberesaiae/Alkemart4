import { loginBuyer, registerBuyer } from "./api"
import { ensureApiBaseUrl } from "./api"
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
  try {
    if (!session) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* private mode */
  }
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

export async function getSessionCustomer(): Promise<SessionCustomer | null> {
  const session = readStoredSession()
  return session ? toCustomer(session) : null
}

export async function login(email: string, password: string): Promise<SessionCustomer> {
  ensureApiBaseUrl()
  if (!getAlkemartApiUrl()) throw new Error("VITE_ALKEMART_API_URL is not set")
  const json = await loginBuyer({ email: email.trim(), password })
  if (!json.token || !json.user) throw new Error("auth response missing token")
  const session: AuthSession = { token: json.token, user: json.user }
  writeStoredSession(session)
  return toCustomer(session)
}

export async function register(input: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}): Promise<SessionCustomer> {
  ensureApiBaseUrl()
  if (!getAlkemartApiUrl()) throw new Error("VITE_ALKEMART_API_URL is not set")
  const json = await registerBuyer({
    email: input.email.trim(),
    password: input.password,
  })
  if (!json.token || !json.user) throw new Error("auth response missing token")
  const session: AuthSession = { token: json.token, user: json.user }
  writeStoredSession(session)
  return toCustomer(session)
}

export async function logout(): Promise<void> {
  writeStoredSession(null)
}

export function getWorkersAccessToken(): string | null {
  return readStoredSession()?.token ?? null
}
