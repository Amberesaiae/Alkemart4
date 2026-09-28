import { ensureApiBaseUrl, workersJson } from "./api"
import { clearLocalCartId, ensureCartId, retrieveCart } from "./cart"
import { getAlkemartApiUrl } from "./env"

export type CheckoutAddress = {
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2?: string
  city: string
  province?: string
  country_code: string
  postal_code?: string
}

export type CodCheckoutResult = {
  status: "completed"
  order_id: string
  cart_id: string
}

export type MomoPendingResult = {
  status: "payment_pending"
  cart_id: string
  payment_intent_id?: string
  client_reference?: string
  provider_reference?: string
}

export type CardCheckoutResult = {
  status: "card_redirect"
  cart_id: string
  authorization_url: string
  reference?: string
}

export type MarketCheckoutResult = CodCheckoutResult | MomoPendingResult | CardCheckoutResult

/** @deprecated Use MarketCheckoutResult — kept for existing imports. */
export type GhanaCheckoutResult = MarketCheckoutResult

export type MomoProvider = "mtn" | "vodafone" | "airteltigo"

export type ShippingOption = {
  id: string
  name: string
  amount: number | null
  currencyCode: string | null
}

/**
 * Workers quotes include per-seller delivery fees; there are no Medusa
 * shipping-option ids. Return an empty list so the delivery step can show
 * the quoted fee from the cart instead of inventing slots.
 */
export async function listShippingOptionsForCart(_cartId?: string): Promise<ShippingOption[]> {
  return []
}

export async function placeMarketOrder(input: {
  address: CheckoutAddress
  email: string
  paymentMethod: "cod" | "momo" | "card"
  momoProvider?: MomoProvider
  callbackUrl?: string
}): Promise<MarketCheckoutResult> {
  const email = input.email.trim()
  if (!email || !email.includes("@")) throw new Error("A valid email is required")
  if (!input.address.phone?.trim()) throw new Error("Phone is required")
  if (!input.address.address_1?.trim() || !input.address.city?.trim()) {
    throw new Error("Address and city are required")
  }
  if (!getAlkemartApiUrl()) throw new Error("VITE_ALKEMART_API_URL is not set")

  const cartId = await ensureCartId()
  const cart = await retrieveCart(cartId)
  if (!cart?.items.length) throw new Error("Cart has no line items")

  const body: Record<string, unknown> = {
    cartId,
    method: input.paymentMethod,
    buyerEmail: email,
    shippingAddress: input.address,
  }
  if (input.paymentMethod === "momo") {
    if (!input.momoProvider) throw new Error("Select a Mobile Money network")
    body.momo = { provider: input.momoProvider, phone: input.address.phone.trim() }
  }
  if (input.paymentMethod === "card") {
    if (!input.callbackUrl) throw new Error("Card checkout requires a callback URL")
    body.callbackUrl = input.callbackUrl
  }

  ensureApiBaseUrl()
  const res = await fetch(`${getAlkemartApiUrl()}/store/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as {
    status?: string
    paymentIntentId?: string
    orderGroupId?: string
    orders?: Array<{ id: string; sellerId: string }>
    authorizationUrl?: string
    paystackReference?: string
    error?: string
    message?: string
  }

  if (data.status === "pending" && data.authorizationUrl) {
    return {
      status: "card_redirect",
      cart_id: cartId,
      authorization_url: data.authorizationUrl,
      reference: data.paystackReference,
    }
  }
  if (res.status === 202 || data.status === "pending") {
    return {
      status: "payment_pending",
      cart_id: cartId,
      payment_intent_id: data.paymentIntentId,
      client_reference: data.paystackReference,
      provider_reference: data.paystackReference,
    }
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Checkout failed (${res.status})`)
  }
  const orderId = data.orderGroupId || data.orders?.[0]?.id
  if (data.status !== "completed" || !orderId) {
    throw new Error(data.error || "Unexpected checkout response")
  }
  clearLocalCartId()
  return { status: "completed", order_id: orderId, cart_id: cartId }
}

/** @deprecated Use placeMarketOrder — kept for existing imports. */
export const placeGhanaOrder = placeMarketOrder

export async function pollCheckoutStatus(
  cartId: string,
): Promise<MarketCheckoutResult | { status: "failed" | "idle"; message?: string; cart_id: string }> {
  const data = await workersJson<{
    status?: string
    order_id?: string | null
    orderGroupId?: string | null
    cart_id?: string
    cartId?: string
    message?: string
    error?: string
    paymentIntentId?: string
    paystackReference?: string
  }>(`/store/checkout/status?cartId=${encodeURIComponent(cartId)}`)
  const resolvedCartId = data.cart_id ?? data.cartId ?? cartId
  if (data.status === "completed" && (data.order_id || data.orderGroupId)) {
    clearLocalCartId()
    return {
      status: "completed",
      order_id: (data.order_id || data.orderGroupId) as string,
      cart_id: resolvedCartId,
    }
  }
  if (data.status === "payment_pending") {
    return {
      status: "payment_pending",
      cart_id: resolvedCartId,
      payment_intent_id: data.paymentIntentId,
      client_reference: data.paystackReference,
    }
  }
  if (data.status === "failed") {
    return { status: "failed", cart_id: resolvedCartId, message: data.message || data.error }
  }
  return { status: "idle", cart_id: resolvedCartId }
}
