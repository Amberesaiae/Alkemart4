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

  await sdk.store.cart.update(cartId, {
    shipping_address,
    ...(email ? { email } : {}),
  })

  // Best-effort: attach first available shipping option (required by many regions).
  try {
    const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
      cart_id: cartId,
    })
    const option = shipping_options?.[0]
    if (option?.id) {
      await sdk.store.cart.addShippingMethod(cartId, {
        option_id: option.id,
      })
    }
  } catch {
    // If options are not configured, backend COD may still succeed when
    // shipping was set earlier or region does not require a method.
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
