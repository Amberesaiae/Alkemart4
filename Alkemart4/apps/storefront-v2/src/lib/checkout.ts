import { getWorkersAccessToken } from "./auth"
import { getAlkemartApiUrl } from "./env"
import { clearLocalCartId, ensureCartId, getLocalCartId, retrieveCart } from "./cart"

export type CheckoutAddress = {
  first_name: string
  last_name: string
  phone: string
  address_1: string
  /** Landmark / directions for riders (Ghana delivery UX) */
  address_2?: string
  city: string
  province?: string
  country_code: string
  /** GhanaPostGPS digital address when known (optional) */
  postal_code?: string
  /** Exact delivery spot pinned on the map (optional); riders get a maps link. */
  latitude?: number
  longitude?: number
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
  expires_at?: string
  amount_pesewas?: number | string
  provider_status?: string
}

export type CardCheckoutResult = {
  status: "card_redirect"
  cart_id: string
  authorization_url: string
  reference?: string
}

export type GhanaCheckoutResult = CodCheckoutResult | MomoPendingResult | CardCheckoutResult

export type MomoProvider = "mtn" | "vodafone" | "airteltigo"

export type PaymentMethod = "cod" | "momo" | "card"

/**
 * POST /store/checkout — COD, MoMo or card. Delivery is quoted per seller by
 * the Workers cart, so there are no shipping-option ids to attach.
 * MoMo may return 202 pending until the prompt is approved; card returns a
 * Paystack authorization URL to redirect to.
 */
export type FulfillmentMethod = "delivery" | "pickup"

/** One seller's ways to get the order to this buyer, priced for where they are. */
export type SellerFulfillmentOptions = {
  sellerId: string
  sellerName: string
  pickupPlace: string | null
  options: { method: FulfillmentMethod; zone: string | null; label: string; feePesewas: string }[]
}

/** Server-priced delivery/pickup options for the cart. Checkout re-prices on submit. */
export async function getFulfillmentOptions(
  cartId: string,
  where: { city?: string; region?: string; lat?: number; lng?: number },
  signal?: AbortSignal,
): Promise<SellerFulfillmentOptions[]> {
  const u = new URL(`${getAlkemartApiUrl()}/store/checkout/options`)
  u.searchParams.set("cartId", cartId)
  if (where.city) u.searchParams.set("city", where.city)
  if (where.region) u.searchParams.set("region", where.region)
  if (where.lat != null && where.lng != null) {
    u.searchParams.set("lat", String(where.lat))
    u.searchParams.set("lng", String(where.lng))
  }
  const res = await fetch(u, { headers: { accept: "application/json" }, signal })
  if (!res.ok) throw new Error(`options ${res.status}`)
  return ((await res.json()) as { sellers: SellerFulfillmentOptions[] }).sellers
}

export async function placeGhanaOrder(input: {
  address: CheckoutAddress
  email: string
  paymentMethod: PaymentMethod
  momoProvider?: MomoProvider
  callbackUrl?: string
  /** Per seller: delivery or pickup. */
  fulfillment?: Record<string, FulfillmentMethod>
}): Promise<GhanaCheckoutResult> {
  const email = input.email.trim()
  if (!email || !email.includes("@")) throw new Error("A valid email is required")
  if (!input.address.phone?.trim()) throw new Error("Phone is required")
  const cartId = await ensureCartId()
  const cart = await retrieveCart(cartId)
  if (!cart?.items.length) throw new Error("Cart has no line items")

  const body: Record<string, unknown> = {
    cartId,
    method: input.paymentMethod,
    buyerEmail: email,
    shippingAddress: input.address,
    ...(input.fulfillment ? { fulfillment: input.fulfillment } : {}),
  }
  if (input.paymentMethod === "momo") {
    if (!input.momoProvider) throw new Error("Select a Mobile Money network")
    body.momo = { provider: input.momoProvider, phone: input.address.phone.trim() }
  }
  if (input.paymentMethod === "card") {
    if (!input.callbackUrl) throw new Error("Card checkout requires a callback URL")
    body.callbackUrl = input.callbackUrl
  }

  const res = await fetch(`${getAlkemartApiUrl()}/store/checkout`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      // A signed-in buyer's accepted offer prices are applied server-side.
      ...(getWorkersAccessToken() ? { authorization: `Bearer ${getWorkersAccessToken()}` } : {}),
    },
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

/** Poll a pending cart until completed/failed (MoMo and card). */
export async function pollMomoCheckoutStatus(
  cartId: string,
): Promise<GhanaCheckoutResult | { status: "failed" | "idle"; message?: string; cart_id: string }> {
  const res = await fetch(
    `${getAlkemartApiUrl()}/store/checkout/status?cartId=${encodeURIComponent(cartId)}`,
    { headers: { Accept: "application/json" } },
  )
  const data = (await res.json().catch(() => ({}))) as {
    status?: string
    order_id?: string | null
    orderGroupId?: string | null
    cart_id?: string
    cartId?: string
    message?: string
    error?: string
    payment_intent_id?: string
    paymentIntentId?: string
    client_reference?: string | null
    provider_reference?: string | null
    amount_pesewas?: number | string
    provider_status?: string
  }
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
      payment_intent_id: data.payment_intent_id ?? data.paymentIntentId,
      client_reference: data.client_reference ?? undefined,
      provider_reference: data.provider_reference ?? undefined,
      amount_pesewas: data.amount_pesewas,
      provider_status: data.provider_status,
    }
  }
  if (data.status === "failed" || res.status === 402) {
    return {
      status: "failed",
      cart_id: resolvedCartId,
      message: data.message || data.error || "Payment failed",
    }
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Status check failed (${res.status})`)
  }
  return { status: "idle", cart_id: resolvedCartId }
}

export { getLocalCartId }
