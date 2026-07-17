import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useMedusa } from "./medusa-provider"
import { requiredEnv } from "./medusa/client"
import type { AddressFormValues, AlkemartAddress } from "./hooks-cart"

/** Local payment enums — do not import from api-stubs for checkout. */
export const OrderPaymentMethod = {
  momo: "momo",
  cash_on_delivery: "cash_on_delivery",
} as const

export const MomoProvider = {
  mtn: "mtn",
  vodafone: "vodafone",
  airteltigo: "airteltigo",
} as const

export type OrderPaymentMethod =
  (typeof OrderPaymentMethod)[keyof typeof OrderPaymentMethod]
export type MomoProvider = (typeof MomoProvider)[keyof typeof MomoProvider]

/** Cart shipping_address payload for Medusa store cart update. */
export type CheckoutShippingAddress = {
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2?: string
  city: string
  province?: string
  country_code: string
  postal_code?: string
  company?: string
}

export type GhanaCheckoutInput = {
  paymentMethod: OrderPaymentMethod
  email?: string
  /** MoMo wallet phone (required when paymentMethod is momo). */
  momoPhone?: string
  momoProvider?: MomoProvider
  /**
   * Prefer either a selected saved address or an inline/form shipping address.
   * Mutation maps these to cart.shipping_address before calling ghana-checkout.
   */
  address?: AlkemartAddress
  /** When no saved address: form values used as cart shipping_address. */
  inlineAddress?: AddressFormValues
  promoCode?: string
}

export type GhanaCheckoutResult =
  | {
      id: string
      status: "completed"
      order_id: string
      cart_id: string
      pending?: false
    }
  | {
      id: string
      status: "payment_pending"
      cart_id: string
      payment_intent_id?: string
      client_reference?: string
      provider_reference?: string
      expires_at?: string
      amount_pesewas?: number
      pending: true
    }

type GhanaCheckoutApiResponse =
  | { status: "completed"; order_id: string; cart_id: string }
  | {
      status: "payment_pending"
      cart_id: string
      payment_intent_id?: string
      client_reference?: string
      provider_reference?: string
      expires_at?: string
      amount_pesewas?: number
    }
  | { error?: string; message?: string }

function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { first_name: "Customer", last_name: "" }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { first_name: parts[0]!, last_name: "" }
  return {
    first_name: parts[0]!,
    last_name: parts.slice(1).join(" "),
  }
}

/** Map UI / form address → Medusa cart shipping_address. */
export function toCartShippingAddress(
  source: AlkemartAddress | AddressFormValues,
): CheckoutShippingAddress {
  const fullName =
    "fullName" in source && source.fullName
      ? source.fullName
      : [ (source as AlkemartAddress).fullName ].filter(Boolean).join(" ") || "Customer"
  const { first_name, last_name } = splitFullName(fullName)
  const country =
    ("countryCode" in source && source.countryCode
      ? source.countryCode
      : "GH"
    ).toUpperCase() || "GH"

  return {
    first_name,
    last_name,
    phone: source.phone?.trim() || "",
    address_1: "line1" in source ? source.line1 : "",
    city: source.city,
    province: source.region?.trim() || undefined,
    country_code: country.length === 2 ? country.toLowerCase() : "gh",
    postal_code: source.digitalAddress?.trim() || undefined,
    company: source.label?.trim() || undefined,
  }
}

function mapPaymentMethod(method: OrderPaymentMethod): "cod" | "momo" {
  if (method === OrderPaymentMethod.cash_on_delivery) return "cod"
  return "momo"
}

type CartShippingOption = { id: string; name?: string; amount?: number }

/**
 * Mercur store shipping options are often:
 *   { [seller_id]: ShippingOption[] }
 * Vanilla Medusa returns a flat array. Normalize both.
 */
export function flattenShippingOptions(raw: unknown): CartShippingOption[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.filter((o): o is CartShippingOption => Boolean(o && typeof o === "object" && "id" in o))
  }
  if (typeof raw === "object") {
    const out: CartShippingOption[] = []
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const o of value) {
          if (o && typeof o === "object" && "id" in o) {
            out.push(o as CartShippingOption)
          }
        }
      }
    }
    return out
  }
  return []
}

async function listCartShippingOptions(
  sdk: ReturnType<typeof useMedusa>,
  cartId: string,
): Promise<CartShippingOption[]> {
  // Prefer SDK when it works
  try {
    const res = await sdk.store.fulfillment.listCartOptions({ cart_id: cartId })
    const flat = flattenShippingOptions(
      (res as { shipping_options?: unknown }).shipping_options ?? res,
    )
    if (flat.length) return flat
  } catch {
    // fall through to raw fetch
  }

  // Raw store endpoint (same Mercur seller-map shape)
  const baseUrl = resolveBackendUrl()
  const publishableKey = requiredEnv("VITE_MEDUSA_PUBLISHABLE_KEY")
  const res = await fetch(
    `${baseUrl}/store/shipping-options?cart_id=${encodeURIComponent(cartId)}`,
    {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": publishableKey,
      },
    },
  )
  if (!res.ok) return []
  const data = (await res.json()) as { shipping_options?: unknown }
  return flattenShippingOptions(data.shipping_options)
}

function resolveBackendUrl(): string {
  const raw = import.meta.env.VITE_MEDUSA_BACKEND_URL as string | undefined
  const v = typeof raw === "string" ? raw.trim() : ""
  if (v) return v.replace(/\/$/, "")
  if (import.meta.env.PROD !== true) return "http://localhost:9000"
  throw new Error("Missing required env VITE_MEDUSA_BACKEND_URL")
}

/**
 * POST /store/ghana-checkout with publishable key + JWT.
 * Uses raw fetch so `{ error }` from the custom route surfaces correctly
 * (SDK FetchError only reads `message`).
 */
async function postGhanaCheckout(
  sdk: ReturnType<typeof useMedusa>,
  body: Record<string, unknown>,
): Promise<GhanaCheckoutApiResponse> {
  const baseUrl = resolveBackendUrl()
  const publishableKey = requiredEnv("VITE_MEDUSA_PUBLISHABLE_KEY")
  const token = await sdk.client.getToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-publishable-api-key": publishableKey,
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${baseUrl}/store/ghana-checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "omit",
  })

  const data = (await res.json().catch(() => ({}))) as GhanaCheckoutApiResponse

  if (!res.ok) {
    const msg =
      ("error" in data && typeof data.error === "string" && data.error) ||
      ("message" in data && typeof data.message === "string" && data.message) ||
      res.statusText ||
      "Checkout failed"
    const err = new Error(msg) as Error & { status?: number }
    err.status = res.status
    throw err
  }

  return data
}

async function prepareCartForCheckout(
  sdk: ReturnType<typeof useMedusa>,
  cartId: string,
  input: GhanaCheckoutInput,
): Promise<void> {
  const addressSource = input.address ?? input.inlineAddress
  if (!addressSource) {
    throw new Error("A delivery address is required to place an order")
  }

  const shipping_address = toCartShippingAddress(addressSource)
  if (!shipping_address.address_1?.trim() || !shipping_address.city?.trim()) {
    throw new Error("Delivery address is incomplete")
  }
  if (!shipping_address.phone?.trim()) {
    throw new Error("A phone number is required on the delivery address")
  }

  const email =
    input.email?.trim() ||
    undefined

  // Attach cart to logged-in customer so orders appear under /orders.
  try {
    const transfer = (sdk.store.cart as { transferCart?: (id: string) => Promise<unknown> })
      .transferCart
    if (typeof transfer === "function") {
      await transfer.call(sdk.store.cart, cartId)
    }
  } catch {
    // Guest cart or already transferred — continue with email update.
  }

  await sdk.store.cart.update(cartId, {
    shipping_address,
    ...(email ? { email } : {}),
  })

  // Mercur returns shipping_options keyed by seller_id → option[], not a flat array.
  try {
    const options = await listCartShippingOptions(sdk, cartId)
    // Multi-seller carts may need one method per seller; attach each first option.
    const seen = new Set<string>()
    for (const option of options) {
      if (!option?.id || seen.has(option.id)) continue
      seen.add(option.id)
      try {
        await sdk.store.cart.addShippingMethod(cartId, {
          option_id: option.id,
        })
      } catch {
        // continue other sellers
      }
    }
  } catch {
    // If options are not configured, COD may still work when shipping is optional.
  }

  if (input.promoCode?.trim()) {
    try {
      await sdk.store.cart.addPromotions(cartId, {
        promo_codes: [input.promoCode.trim()],
      })
    } catch {
      // Non-fatal: place order without promo if code is invalid.
    }
  }
}

/**
 * Poll MoMo pending checkout: GET /store/ghana-checkout/status?cart_id=
 */
export async function pollGhanaCheckoutStatus(
  sdk: ReturnType<typeof useMedusa>,
  cartId: string,
): Promise<GhanaCheckoutResult | { status: "failed" | "idle"; cart_id: string; message?: string }> {
  const baseUrl = resolveBackendUrl()
  const publishableKey = requiredEnv("VITE_MEDUSA_PUBLISHABLE_KEY")
  const token = await sdk.client.getToken()
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-publishable-api-key": publishableKey,
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(
    `${baseUrl}/store/ghana-checkout/status?cart_id=${encodeURIComponent(cartId)}`,
    { headers, credentials: "omit" },
  )
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (data.status === "completed" && typeof data.order_id === "string") {
    localStorage.removeItem("alkemart:cart_id")
    return {
      id: data.order_id,
      status: "completed",
      order_id: data.order_id,
      cart_id: String(data.cart_id ?? cartId),
    }
  }
  if (data.status === "payment_pending") {
    return {
      id: String(data.cart_id ?? cartId),
      status: "payment_pending",
      cart_id: String(data.cart_id ?? cartId),
      payment_intent_id: data.payment_intent_id as string | undefined,
      client_reference: data.client_reference as string | undefined,
      provider_reference: data.provider_reference as string | undefined,
      expires_at: data.expires_at as string | undefined,
      amount_pesewas: data.amount_pesewas as number | undefined,
      pending: true,
    }
  }
  if (data.status === "failed") {
    return {
      status: "failed",
      cart_id: String(data.cart_id ?? cartId),
      message: (data.message as string) || (data.error as string) || "Payment failed",
    }
  }
  return { status: "idle", cart_id: cartId }
}

/**
 * Place order via Medusa `POST /store/ghana-checkout`.
 * Prepares cart (shipping address + shipping method) then calls the API.
 */
export function useGhanaCheckout(opts?: {
  mutation?: { onSuccess?: (result: GhanaCheckoutResult) => void }
}) {
  const sdk = useMedusa()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { data: GhanaCheckoutInput }): Promise<GhanaCheckoutResult> => {
      const cartId = localStorage.getItem("alkemart:cart_id")
      if (!cartId) throw new Error("No cart — add items before checking out")

      const input = params.data
      const apiPayment = mapPaymentMethod(input.paymentMethod)

      if (apiPayment === "momo") {
        if (!input.momoPhone?.trim() || input.momoPhone.trim().replace(/\D/g, "").length < 9) {
          throw new Error("Enter a valid Mobile Money phone number")
        }
        if (!input.momoProvider) {
          throw new Error("Select a Mobile Money network")
        }
        if (!input.email?.trim()) {
          throw new Error("Email is required for Mobile Money checkout")
        }
      }

      await prepareCartForCheckout(sdk, cartId, input)

      const phone =
        input.momoPhone?.trim() ||
        input.address?.phone?.trim() ||
        input.inlineAddress?.phone?.trim()

      const body: Record<string, unknown> = {
        cart_id: cartId,
        payment_method: apiPayment,
      }
      if (input.email?.trim()) body.email = input.email.trim()
      if (phone) body.phone = phone
      if (apiPayment === "momo" && input.momoProvider) {
        body.momo_provider = input.momoProvider
      }

      const data = await postGhanaCheckout(sdk, body)

      if ("status" in data && data.status === "completed" && data.order_id) {
        localStorage.removeItem("alkemart:cart_id")
        return {
          id: data.order_id,
          status: "completed",
          order_id: data.order_id,
          cart_id: data.cart_id,
        }
      }

      if ("status" in data && data.status === "payment_pending") {
        // Keep cart id until payment confirms — do not clear localStorage.
        return {
          id: data.cart_id,
          status: "payment_pending",
          cart_id: data.cart_id,
          payment_intent_id: data.payment_intent_id,
          client_reference: data.client_reference,
          provider_reference: data.provider_reference,
          expires_at: data.expires_at,
          amount_pesewas: data.amount_pesewas,
          pending: true,
        }
      }

      throw new Error(
        ("error" in data && data.error) || "Unexpected checkout response",
      )
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["medusa", "cart"] })
      queryClient.invalidateQueries({ queryKey: ["medusa", "orders"] })
      opts?.mutation?.onSuccess?.(result)
    },
  })
}
