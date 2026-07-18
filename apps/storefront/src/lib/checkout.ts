import { getBackendUrl, getPublishableKey } from "./env"
import { getMedusaClient } from "./medusa"
import { clearLocalCartId, ensureCartId, getLocalCartId, retrieveCart } from "./cart"
import { flattenShippingOptions } from "./shipping"

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
  amount_pesewas?: number
  provider_status?: string
}

export type GhanaCheckoutResult = CodCheckoutResult | MomoPendingResult

export type MomoProvider = "mtn" | "vodafone" | "airteltigo"

/** Public: list shipping options for cart (API only — never invent option ids). */
export async function listShippingOptionsForCart(cartId?: string) {
  const id = cartId ?? (await ensureCartId())
  return listCartShippingOptions(id)
}

async function listCartShippingOptions(cartId: string) {
  const sdk = getMedusaClient()
  try {
    const res = await sdk.store.fulfillment.listCartOptions({ cart_id: cartId })
    const flat = flattenShippingOptions(
      (res as { shipping_options?: unknown }).shipping_options ?? res,
    )
    if (flat.length) return flat
  } catch {
    /* fall through */
  }

  const base = getBackendUrl()
  const pk = getPublishableKey()
  const res = await fetch(
    `${base}/store/shipping-options?cart_id=${encodeURIComponent(cartId)}`,
    {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": pk,
      },
    },
  )
  if (!res.ok) {
    throw new Error(`Shipping options failed (${res.status})`)
  }
  const data = (await res.json()) as { shipping_options?: unknown }
  return flattenShippingOptions(data.shipping_options)
}

/**
 * Prepare cart for COD: address, email, attach first available shipping option per list.
 * Shipping option ids come only from the API.
 */
export async function prepareCartForCod(input: {
  address: CheckoutAddress
  email: string
}): Promise<string> {
  const email = input.email.trim()
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required")
  }
  const a = input.address
  if (!a.address_1?.trim() || !a.city?.trim() || !a.phone?.trim()) {
    throw new Error("Address, city, and phone are required")
  }
  if (!a.country_code?.trim()) {
    throw new Error("Country is required for delivery")
  }

  const cartId = await ensureCartId()
  const sdk = getMedusaClient()

  await sdk.store.cart.update(cartId, {
    email,
    shipping_address: {
      first_name: a.first_name.trim(),
      last_name: a.last_name.trim(),
      phone: a.phone.trim(),
      address_1: a.address_1.trim(),
      address_2: a.address_2?.trim() || undefined,
      city: a.city.trim(),
      province: a.province?.trim() || undefined,
      country_code: a.country_code.trim().toLowerCase(),
      postal_code: a.postal_code?.trim() || undefined,
    },
  })

  const options = await listCartShippingOptions(cartId)
  if (!options.length) {
    throw new Error(
      "No delivery options are available for this cart. Please try another address or contact the seller.",
    )
  }

  const seen = new Set<string>()
  let attached = 0
  for (const option of options) {
    if (!option.id || seen.has(option.id)) continue
    seen.add(option.id)
    try {
      await sdk.store.cart.addShippingMethod(cartId, { option_id: option.id })
      attached += 1
    } catch {
      /* try remaining options */
    }
  }
  if (!attached) {
    throw new Error("Could not attach any shipping method returned by the API")
  }

  return cartId
}

/** POST /store/ghana-checkout payment_method=cod — body only from prepared cart. */
export async function placeCodOrder(input: {
  address: CheckoutAddress
  email: string
}): Promise<CodCheckoutResult> {
  const result = await placeGhanaOrder({
    ...input,
    paymentMethod: "cod",
  })
  if (result.status !== "completed") {
    throw new Error("Unexpected COD response")
  }
  return result
}

/**
 * COD or lab MoMo via /store/ghana-checkout.
 * MoMo may return payment_pending (202) until USSD/pay-offline confirms.
 */
export async function placeGhanaOrder(input: {
  address: CheckoutAddress
  email: string
  paymentMethod: "cod" | "momo"
  momoProvider?: MomoProvider
}): Promise<GhanaCheckoutResult> {
  const cartId = await prepareCartForCod(input)
  const cart = await retrieveCart(cartId)
  if (!cart?.items.length) {
    throw new Error("Cart has no line items")
  }

  const sdk = getMedusaClient()
  const token = await sdk.client.getToken()
  const base = getBackendUrl()
  const pk = getPublishableKey()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-publishable-api-key": pk,
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const body: Record<string, unknown> = {
    cart_id: cartId,
    payment_method: input.paymentMethod,
    email: input.email.trim(),
    phone: input.address.phone.trim(),
  }
  if (input.paymentMethod === "momo") {
    if (!input.momoProvider) {
      throw new Error("Select a Mobile Money network")
    }
    body.momo_provider = input.momoProvider
  }

  const res = await fetch(`${base}/store/ghana-checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as {
    status?: string
    order_id?: string
    cart_id?: string
    payment_intent_id?: string
    client_reference?: string
    provider_reference?: string
    expires_at?: string
    amount_pesewas?: number
    provider_status?: string
    error?: string
    message?: string
  }

  if (res.status === 202 || data.status === "payment_pending") {
    return {
      status: "payment_pending",
      cart_id: data.cart_id ?? cartId,
      payment_intent_id: data.payment_intent_id,
      client_reference: data.client_reference,
      provider_reference: data.provider_reference,
      expires_at: data.expires_at,
      amount_pesewas: data.amount_pesewas,
      provider_status: data.provider_status,
    }
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Checkout failed (${res.status})`)
  }
  if (data.status !== "completed" || !data.order_id) {
    throw new Error(data.error || "Unexpected checkout response")
  }

  clearLocalCartId()
  return {
    status: "completed",
    order_id: data.order_id,
    cart_id: data.cart_id ?? cartId,
  }
}

/** Poll MoMo pending cart until completed/failed. */
export async function pollMomoCheckoutStatus(
  cartId: string,
): Promise<GhanaCheckoutResult | { status: "failed" | "idle"; message?: string; cart_id: string }> {
  const base = getBackendUrl()
  const pk = getPublishableKey()
  const sdk = getMedusaClient()
  const token = await sdk.client.getToken()
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-publishable-api-key": pk,
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(
    `${base}/store/ghana-checkout/status?cart_id=${encodeURIComponent(cartId)}`,
    { headers },
  )
  const data = (await res.json().catch(() => ({}))) as {
    status?: string
    order_id?: string
    cart_id?: string
    message?: string
    error?: string
    payment_intent_id?: string
    client_reference?: string
    provider_reference?: string
    expires_at?: string
    amount_pesewas?: number
    provider_status?: string
  }

  if (data.status === "completed" && data.order_id) {
    clearLocalCartId()
    return {
      status: "completed",
      order_id: data.order_id,
      cart_id: data.cart_id ?? cartId,
    }
  }
  if (data.status === "payment_pending") {
    return {
      status: "payment_pending",
      cart_id: data.cart_id ?? cartId,
      payment_intent_id: data.payment_intent_id,
      client_reference: data.client_reference,
      provider_reference: data.provider_reference,
      expires_at: data.expires_at,
      amount_pesewas: data.amount_pesewas,
      provider_status: data.provider_status,
    }
  }
  if (data.status === "failed" || res.status === 402) {
    return {
      status: "failed",
      cart_id: data.cart_id ?? cartId,
      message: data.message || data.error || "Payment failed",
    }
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `Status check failed (${res.status})`)
  }
  return { status: "idle", cart_id: data.cart_id ?? cartId }
}

export { getLocalCartId }
