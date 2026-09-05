import { getAlkemartApiUrl } from "./env"
import { getMedusaClient } from "./medusa"
import { transferLocalCartToCustomer } from "./cart"

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

function useWorkersAuth(): boolean {
  return Boolean(getAlkemartApiUrl())
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
  if (useWorkersAuth()) {
    const session = readStoredSession()
    return session ? toCustomer(session) : null
  }

  const sdk = getMedusaClient()
  const token = await sdk.client.getToken()
  if (!token) return null
  try {
    const { customer } = await sdk.store.customer.retrieve()
    return {
      id: customer.id,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
    }
  } catch {
    return null
  }
}

export async function login(email: string, password: string): Promise<SessionCustomer> {
  if (useWorkersAuth()) {
    return workersAuth("/store/auth/login", {
      email: email.trim(),
      password,
    })
  }

  const sdk = getMedusaClient()
  const result = await sdk.auth.login("customer", "emailpass", {
    email: email.trim(),
    password,
  })
  if (typeof result !== "string") {
    throw new Error("Authentication requires additional steps")
  }
  await transferLocalCartToCustomer()
  const me = await getSessionCustomer()
  if (!me) throw new Error("Login succeeded but customer session is empty")
  return me
}

export async function register(input: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}): Promise<SessionCustomer> {
  if (useWorkersAuth()) {
    return workersAuth("/store/auth/register", {
      email: input.email.trim(),
      password: input.password,
    })
  }

  const sdk = getMedusaClient()
  await sdk.auth.register("customer", "emailpass", {
    email: input.email.trim(),
    password: input.password,
  })
  await sdk.store.customer.create({
    email: input.email.trim(),
    first_name: input.firstName?.trim(),
    last_name: input.lastName?.trim(),
  })
  return login(input.email, input.password)
}

export async function logout(): Promise<void> {
  if (useWorkersAuth()) {
    writeStoredSession(null)
    return
  }
  const sdk = getMedusaClient()
  try {
    await sdk.auth.logout()
  } catch {
    /* ignore */
  }
}

/** Update signed-in customer profile fields from store API. */
export async function updateCustomerProfile(input: {
  firstName?: string
  lastName?: string
  phone?: string
}): Promise<SessionCustomer> {
  if (useWorkersAuth()) {
    const me = await getSessionCustomer()
    if (!me) throw new Error("Sign in required")
    // Workers buyer profile fields are not yet persisted beyond email/role.
    return {
      ...me,
      firstName: input.firstName?.trim() || me.firstName,
      lastName: input.lastName?.trim() || me.lastName,
    }
  }

  const sdk = getMedusaClient()
  const token = await sdk.client.getToken()
  if (!token) throw new Error("Sign in required")

  await sdk.store.customer.update({
    first_name: input.firstName?.trim() || undefined,
    last_name: input.lastName?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
  } as never)

  const me = await getSessionCustomer()
  if (!me) throw new Error("Profile update succeeded but session is empty")
  return me
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
