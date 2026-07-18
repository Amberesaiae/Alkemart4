/**
 * Ghana checkout orchestration for clean-slate Mercur/Medusa.
 *
 * COD: system payment provider + completeCartWorkflow.
 * MoMo: Paystack charge-before-commit (ADR-014 shape via cart metadata).
 *   - sync success → complete cart immediately
 *   - pending/send_otp/pay_offline → 202 payment_pending; webhook completes
 */
import {
  completeCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  assertPaystackAmountMatches,
  chargeMobileMoney,
  PaymentDeclinedError,
  refundCharge,
  toPaystackAmountPesewas,
  verifyPaystackTransaction,
  type MomoProvider,
} from "./paystack-client"
import {
  listOperatingMarkets,
  normalizePhoneForCountry,
  requireOperatingMarket,
} from "./operating-markets"

export const SYSTEM_PAYMENT_PROVIDER_ID = "pp_system_default"

const MOMO_PENDING_TTL_MS = 30 * 60 * 1000

export type CheckoutInput = {
  cartId: string
  paymentMethod: "cod" | "momo"
  email?: string
  phone?: string
  momoProvider?: MomoProvider
}

export type CheckoutResult =
  | { status: "completed"; order_id: string; cart_id: string }
  | {
      status: "payment_pending"
      cart_id: string
      payment_intent_id?: string
      client_reference?: string
      provider_reference?: string
      expires_at?: string
      amount_pesewas?: number
      provider_status?: string
    }

export class CheckoutHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "CheckoutHttpError"
    this.status = status
  }
}

function errorMessage(err: unknown): string {
  if (!err) return "Unknown error"
  if (typeof err === "string") return err
  if (err instanceof Error && err.message) return err.message
  const anyErr = err as {
    message?: string
    error?: { message?: string }
    errors?: { error?: { message?: string }; message?: string }[]
  }
  if (anyErr.message) return String(anyErr.message)
  if (anyErr.error?.message) return String(anyErr.error.message)
  if (Array.isArray(anyErr.errors) && anyErr.errors[0]) {
    const first = anyErr.errors[0]
    return String(first.error?.message || first.message || "Workflow error")
  }
  try {
    return JSON.stringify(err).slice(0, 500)
  } catch {
    return "Unknown error"
  }
}

type LoadedCart = {
  id: string
  email?: string | null
  total?: number | string | null
  currency_code?: string | null
  shipping_address?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  payment_collection?: {
    id: string
    payment_sessions?: { id: string; status?: string; provider_id?: string }[]
  } | null
  items?: { id: string; quantity?: number }[] | null
  shipping_methods?: { id: string; shipping_option_id?: string | null }[] | null
  completed_at?: string | Date | null
}

export async function loadCheckoutCart(
  container: MedusaContainer,
  cartId: string
): Promise<LoadedCart> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: LoadedCart[] }>
  }

  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "total",
      "currency_code",
      "completed_at",
      "metadata",
      "shipping_address.*",
      "items.id",
      "items.quantity",
      "shipping_methods.id",
      "shipping_methods.shipping_option_id",
      "payment_collection.id",
      "payment_collection.payment_sessions.id",
      "payment_collection.payment_sessions.status",
      "payment_collection.payment_sessions.provider_id",
    ],
    filters: { id: cartId },
  })

  const cart = Array.isArray(data) ? data[0] : (data as unknown as LoadedCart)
  if (!cart?.id) {
    throw new CheckoutHttpError(404, `Cart not found: ${cartId}`)
  }
  return cart
}

/**
 * Spine: cart ready + shipping country is an operating market + currency match.
 */
async function requireCartReadyForCheckout(
  container: MedusaContainer,
  cart: LoadedCart,
): Promise<void> {
  if (cart.completed_at) {
    throw new CheckoutHttpError(409, "Cart has already been completed")
  }
  if (!cart.items?.length) {
    throw new CheckoutHttpError(400, "Cart has no line items")
  }
  if (!cart.shipping_address) {
    throw new CheckoutHttpError(
      400,
      "Cart requires a shipping_address before checkout",
    )
  }
  if (!cart.shipping_methods?.length) {
    throw new CheckoutHttpError(
      400,
      "Cart requires a shipping method before checkout. Choose a delivery option returned by the store API.",
    )
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }
  const markets = await listOperatingMarkets(query)
  if (!markets.length) {
    throw new CheckoutHttpError(
      503,
      "No operating markets configured. Admin must enable a country on a region.",
    )
  }

  const country = String(cart.shipping_address?.country_code || "")
    .trim()
    .toLowerCase()
  if (!country) {
    throw new CheckoutHttpError(400, "Shipping address country is required")
  }

  let market
  try {
    market = requireOperatingMarket(markets, country)
  } catch (e) {
    throw new CheckoutHttpError(
      400,
      e instanceof Error
        ? e.message
        : `Country ${country.toUpperCase()} is not in operation`,
    )
  }

  const cartCurrency = String(cart.currency_code || "").toLowerCase()
  if (
    cartCurrency &&
    market.currency_code &&
    cartCurrency !== market.currency_code
  ) {
    throw new CheckoutHttpError(
      400,
      `Cart currency ${cartCurrency.toUpperCase()} does not match ${market.display_name} (${market.currency_code.toUpperCase()}).`,
    )
  }

  const addr = cart.shipping_address || {}
  for (const field of market.locale.address.fields) {
    if (!field.required || field.key === "country_code") continue
    const raw = addr[field.key as keyof typeof addr]
    const val = raw == null ? "" : String(raw).trim()
    if (!val) {
      throw new CheckoutHttpError(
        400,
        `${field.label} is required for ${market.display_name}`,
      )
    }
  }
}

/**
 * Normalize phone for checkout. Defaults to Ghana rules (primary market).
 * Prefer normalizePhoneForCountry(country, phone) when country is known.
 */
export function normalizeGhanaPhone(phone: string): string {
  try {
    return normalizePhoneForCountry("gh", phone)
  } catch (e) {
    throw new CheckoutHttpError(
      400,
      e instanceof Error
        ? e.message
        : "Enter a valid Ghana mobile money number (e.g. 024… or +23324…)",
    )
  }
}

async function mergeCartMetadata(
  container: MedusaContainer,
  cartId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const cart = await loadCheckoutCart(container, cartId)
  const next = { ...(cart.metadata ?? {}), ...patch }
  const cartModule = container.resolve(Modules.CART) as {
    updateCarts: (
      data: { id: string; metadata?: Record<string, unknown> }[]
    ) => Promise<unknown>
  }
  await cartModule.updateCarts([{ id: cartId, metadata: next }])
}

export async function ensureSystemPaymentAndCompleteCart(
  container: MedusaContainer,
  cartId: string
): Promise<{ order_id: string }> {
  const cart = await loadCheckoutCart(container, cartId)

  // Idempotent: already completed
  if (cart.completed_at) {
    const existing = cart.metadata?.ghana_order_id
    if (existing) {
      return { order_id: String(existing) }
    }
  }

  let paymentCollectionId = cart.payment_collection?.id

  if (!paymentCollectionId) {
    await createPaymentCollectionForCartWorkflow(container).run({
      input: { cart_id: cartId },
    })
    const refreshed = await loadCheckoutCart(container, cartId)
    paymentCollectionId = refreshed.payment_collection?.id
  }

  if (!paymentCollectionId) {
    throw new CheckoutHttpError(
      500,
      "Failed to create payment collection for cart"
    )
  }

  await createPaymentSessionsWorkflow(container).run({
    input: {
      payment_collection_id: paymentCollectionId,
      provider_id: SYSTEM_PAYMENT_PROVIDER_ID,
      data: { ghana_checkout: true },
    },
  })

  const { result, errors } = await completeCartWorkflow(container).run({
    input: { id: cartId },
    throwOnError: false,
  })

  if (errors?.length) {
    throw new CheckoutHttpError(400, errorMessage({ errors }))
  }

  const orderId =
    (result as { id?: string })?.id ||
    (result as { order?: { id?: string } })?.order?.id ||
    (result as { order_id?: string })?.order_id

  if (!orderId) {
    throw new CheckoutHttpError(
      500,
      "completeCartWorkflow did not return an order id"
    )
  }

  try {
    await mergeCartMetadata(container, cartId, {
      ghana_order_id: String(orderId),
      ghana_payment_status: "completed",
    })
  } catch {
    // non-fatal — order already exists
  }

  return { order_id: String(orderId) }
}

export async function runCodCheckout(
  container: MedusaContainer,
  input: CheckoutInput
): Promise<CheckoutResult> {
  const cart = await loadCheckoutCart(container, input.cartId)
  await requireCartReadyForCheckout(container, cart)

  try {
    const { order_id } = await ensureSystemPaymentAndCompleteCart(
      container,
      input.cartId
    )
    return {
      status: "completed",
      order_id,
      cart_id: input.cartId,
    }
  } catch (err) {
    if (err instanceof CheckoutHttpError) throw err
    if (err instanceof MedusaError) {
      const status =
        err.type === MedusaError.Types.NOT_ALLOWED ||
        err.type === MedusaError.Types.DUPLICATE_ERROR
          ? 409
          : 400
      throw new CheckoutHttpError(status, err.message)
    }
    throw new CheckoutHttpError(400, errorMessage(err) || "COD checkout failed")
  }
}

/**
 * Confirm MoMo payment by Paystack reference (webhook or poll).
 * Idempotent when cart already completed.
 */
export async function confirmMomoByPaystackReference(
  container: MedusaContainer,
  reference: string
): Promise<CheckoutResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new CheckoutHttpError(503, "PAYSTACK_SECRET_KEY is not configured")
  }
  if (!reference?.trim()) {
    throw new CheckoutHttpError(400, "reference is required")
  }

  const verified = await verifyPaystackTransaction(secretKey, reference.trim())
  if (!verified) {
    throw new CheckoutHttpError(400, "Could not verify Paystack transaction")
  }
  if (verified.status !== "success") {
    throw new CheckoutHttpError(
      409,
      `Payment not successful yet (status=${verified.status})`
    )
  }

  const meta = (verified.metadata ?? {}) as Record<string, unknown>
  const cartId = String(meta.cart_id ?? meta.cartId ?? "").trim()
  if (!cartId) {
    throw new CheckoutHttpError(
      400,
      "Paystack transaction missing cart_id metadata"
    )
  }

  const cart = await loadCheckoutCart(container, cartId)
  if (cart.completed_at) {
    const orderId = cart.metadata?.ghana_order_id
    if (orderId) {
      return {
        status: "completed",
        order_id: String(orderId),
        cart_id: cartId,
      }
    }
  }

  const currency = (cart.currency_code || verified.currency || "ghs").toLowerCase()
  const intentPesewas =
    Number(cart.metadata?.ghana_amount_pesewas) ||
    toPaystackAmountPesewas(Number(cart.total ?? 0), currency)

  try {
    assertPaystackAmountMatches(Number(verified.amount), intentPesewas)
  } catch (err) {
    throw new CheckoutHttpError(
      400,
      err instanceof Error ? err.message : "Amount mismatch"
    )
  }

  try {
    const { order_id } = await ensureSystemPaymentAndCompleteCart(
      container,
      cartId
    )
    await mergeCartMetadata(container, cartId, {
      ghana_payment: "momo",
      paystack_reference: reference,
      ghana_payment_status: "succeeded",
      ghana_order_id: order_id,
    })
    return { status: "completed", order_id, cart_id: cartId }
  } catch (err) {
    // Charge succeeded but complete failed — best-effort refund
    const refund = await refundCharge({
      secretKey,
      reference,
      amountPesewas: intentPesewas,
    })
    await mergeCartMetadata(container, cartId, {
      ghana_payment_status: "complete_failed",
      ghana_refund_ok: refund.ok,
      ghana_refund_error: refund.ok ? undefined : refund.error,
    }).catch(() => undefined)

    if (err instanceof CheckoutHttpError) throw err
    throw new CheckoutHttpError(
      500,
      errorMessage(err) ||
        "Payment captured but order could not be completed — refund attempted"
    )
  }
}

export async function runMomoCheckout(
  container: MedusaContainer,
  input: CheckoutInput
): Promise<CheckoutResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new CheckoutHttpError(
      503,
      "Mobile Money requires PAYSTACK_SECRET_KEY. Use cash on delivery for local E2E."
    )
  }

  if (!input.email?.trim()) {
    throw new CheckoutHttpError(400, "email is required for momo")
  }
  if (!input.phone?.trim()) {
    throw new CheckoutHttpError(400, "phone is required for momo")
  }
  if (!input.momoProvider) {
    throw new CheckoutHttpError(400, "momo_provider is required for momo")
  }

  const cart = await loadCheckoutCart(container, input.cartId)
  await requireCartReadyForCheckout(container, cart)

  // Resume: already paid & completed
  if (cart.completed_at && cart.metadata?.ghana_order_id) {
    return {
      status: "completed",
      order_id: String(cart.metadata.ghana_order_id),
      cart_id: cart.id,
    }
  }

  // Resume pending: re-verify existing reference
  const existingRef = cart.metadata?.paystack_reference
  if (typeof existingRef === "string" && existingRef && !cart.completed_at) {
    const verified = await verifyPaystackTransaction(secretKey, existingRef)
    if (verified?.status === "success") {
      return confirmMomoByPaystackReference(container, existingRef)
    }
    if (
      verified &&
      verified.status !== "failed" &&
      verified.status !== "abandoned"
    ) {
      const amountPesewas = Number(cart.metadata?.ghana_amount_pesewas) || 0
      return {
        status: "payment_pending",
        cart_id: cart.id,
        payment_intent_id: existingRef,
        client_reference: existingRef,
        provider_reference: existingRef,
        amount_pesewas: amountPesewas || undefined,
        expires_at:
          typeof cart.metadata?.ghana_expires_at === "string"
            ? cart.metadata.ghana_expires_at
            : undefined,
        provider_status: verified.status,
      }
    }
  }

  const currency = (cart.currency_code || "ghs").toLowerCase()
  const totalMajor = Number(cart.total ?? 0)
  if (!Number.isFinite(totalMajor) || totalMajor <= 0) {
    throw new CheckoutHttpError(400, "Cart total must be greater than zero")
  }
  const amountPesewas = toPaystackAmountPesewas(totalMajor, currency)
  const shipCountry = String(
    cart.shipping_address?.country_code || "gh",
  ).toLowerCase()
  let phone: string
  try {
    phone = normalizePhoneForCountry(shipCountry, input.phone)
  } catch (e) {
    throw new CheckoutHttpError(
      400,
      e instanceof Error ? e.message : "Invalid phone for market",
    )
  }
  const reference = `momo_${cart.id.replace(/[^a-zA-Z0-9]/g, "").slice(-16)}_${Date.now().toString(36)}`
  const expiresAt = new Date(Date.now() + MOMO_PENDING_TTL_MS).toISOString()

  // Intent-before-HTTP: persist intent metadata before calling Paystack
  await mergeCartMetadata(container, cart.id, {
    ghana_payment: "momo",
    ghana_payment_status: "initiated",
    paystack_reference: reference,
    client_reference: reference,
    ghana_amount_pesewas: amountPesewas,
    ghana_momo_provider: input.momoProvider,
    ghana_expires_at: expiresAt,
    ghana_email: input.email.trim(),
    ghana_momo_phone: phone,
  })

  let charge
  try {
    charge = await chargeMobileMoney({
      secretKey,
      amountPesewas,
      email: input.email.trim(),
      phone,
      provider: input.momoProvider,
      currency,
      reference,
      metadata: {
        cart_id: cart.id,
        client_reference: reference,
        momo_provider: input.momoProvider,
        ghana_checkout: true,
        payment_intent_id: reference,
      },
    })
  } catch (err) {
    await mergeCartMetadata(container, cart.id, {
      ghana_payment_status: "charge_failed",
      ghana_charge_error:
        err instanceof Error ? err.message.slice(0, 300) : "charge failed",
    }).catch(() => undefined)

    if (err instanceof PaymentDeclinedError) {
      throw new CheckoutHttpError(402, err.message)
    }
    throw new CheckoutHttpError(
      502,
      err instanceof Error ? err.message : "Paystack charge failed"
    )
  }

  // Paystack may return a different reference — store the authoritative one
  const providerRef = charge.reference || reference
  await mergeCartMetadata(container, cart.id, {
    paystack_reference: providerRef,
    client_reference: providerRef,
    ghana_payment_status: charge.status === "success" ? "charged" : "pending",
    ghana_provider_status: charge.providerStatus,
  })

  if (charge.status === "success") {
    try {
      return await confirmMomoByPaystackReference(container, providerRef)
    } catch (err) {
      // confirm already attempts refund on complete failure
      if (err instanceof CheckoutHttpError) throw err
      throw new CheckoutHttpError(500, errorMessage(err))
    }
  }

  return {
    status: "payment_pending",
    cart_id: cart.id,
    payment_intent_id: providerRef,
    client_reference: providerRef,
    provider_reference: providerRef,
    expires_at: expiresAt,
    amount_pesewas: amountPesewas,
    provider_status: charge.providerStatus,
  }
}

/** Poll status for SPA pending MoMo screen. */
export async function getMomoCheckoutStatus(
  container: MedusaContainer,
  cartId: string
): Promise<CheckoutResult | { status: "idle" | "failed"; cart_id: string; message?: string }> {
  const cart = await loadCheckoutCart(container, cartId)
  const meta = cart.metadata ?? {}

  if (cart.completed_at || meta.ghana_order_id) {
    return {
      status: "completed",
      order_id: String(meta.ghana_order_id ?? ""),
      cart_id: cartId,
    }
  }

  if (meta.ghana_payment !== "momo") {
    return { status: "idle", cart_id: cartId }
  }

  if (meta.ghana_payment_status === "charge_failed") {
    return {
      status: "failed",
      cart_id: cartId,
      message: String(meta.ghana_charge_error ?? "Charge failed"),
    }
  }

  const ref = meta.paystack_reference
  if (typeof ref === "string" && ref) {
    const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim()
    if (secretKey) {
      const verified = await verifyPaystackTransaction(secretKey, ref)
      if (verified?.status === "success") {
        return confirmMomoByPaystackReference(container, ref)
      }
      if (verified?.status === "failed" || verified?.status === "abandoned") {
        return {
          status: "failed",
          cart_id: cartId,
          message: verified.gateway_response || verified.status,
        }
      }
    }

    return {
      status: "payment_pending",
      cart_id: cartId,
      payment_intent_id: ref,
      client_reference: ref,
      provider_reference: ref,
      amount_pesewas: Number(meta.ghana_amount_pesewas) || undefined,
      expires_at:
        typeof meta.ghana_expires_at === "string"
          ? meta.ghana_expires_at
          : undefined,
    }
  }

  return { status: "idle", cart_id: cartId }
}

export async function runGhanaCheckout(
  container: MedusaContainer,
  input: CheckoutInput
): Promise<CheckoutResult> {
  if (input.paymentMethod === "cod") {
    return runCodCheckout(container, input)
  }
  if (input.paymentMethod === "momo") {
    return runMomoCheckout(container, input)
  }
  throw new CheckoutHttpError(400, "payment_method must be cod or momo")
}
