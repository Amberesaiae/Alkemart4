import { getMedusaClient } from "./medusa"

export type SessionCustomer = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

export async function getSessionCustomer(): Promise<SessionCustomer | null> {
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
  const sdk = getMedusaClient()
  const result = await sdk.auth.login("customer", "emailpass", {
    email: email.trim(),
    password,
  })
  if (typeof result !== "string") {
    throw new Error("Authentication requires additional steps")
  }
  // Attach guest cart to customer when API supports it
  try {
    const cartId = localStorage.getItem("alkemart.storefront.cart_id")
    if (cartId) {
      const transfer = (
        sdk.store.cart as { transferCart?: (id: string) => Promise<unknown> }
      ).transferCart
      if (typeof transfer === "function") {
        await transfer.call(sdk.store.cart, cartId)
      }
    }
  } catch {
    /* non-fatal */
  }
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
 * Seller / admin / support RBAC screens live in Mercur — not this app.
 */
export type BuyerAccess = "guest" | "customer"

export async function getBuyerAccess(): Promise<BuyerAccess> {
  const me = await getSessionCustomer()
  return me ? "customer" : "guest"
}
