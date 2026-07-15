/**
 * Ghana checkout orchestration (COD + MoMo/Paystack).
 *
 * ADR-014: create payment intent BEFORE any external HTTP.
 * Orders are created only via Medusa completeCartWorkflow — never custom order tables.
 */
import {
  completeCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { PAYMENTS_GHANA_MODULE } from "../modules/payments-ghana"
import type PaymentsGhanaModuleService from "../modules/payments-ghana/service"
import {
  assertPaystackAmountMatches,
  chargeMobileMoney,
  PaymentDeclinedError,
  refundCharge,
  toPaystackAmountPesewas,
  type MomoProvider,
  verifyPaystackTransaction,
} from "./paystack-client"

export const SYSTEM_PAYMENT_PROVIDER_ID = "pp_system_default"

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
      payment_intent_id: string
      client_reference: string
      provider_reference: string
      expires_at: string
      amount_pesewas: number
    }

export class CheckoutHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "CheckoutHttpError"
    this.status = status
  }
}

/** Best-effort message extraction from Medusa workflow / MedusaError shapes. */
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
  payment_collection?: {
    id: string
    payment_sessions?: { id: string; status?: string; provider_id?: string }[]
  } | null
  items?: { id: string; quantity?: number }[] | null
  completed_at?: string | Date | null
}

function getPaymentTtlMinutes(): number {
  const raw = process.env.PAYMENT_PENDING_TTL_MINUTES
  const n = raw ? Number(raw) : 30
  if (!Number.isFinite(n) || n < 10) return 30
  if (n > 120) return 120
  return Math.floor(n)
}

function getPaystackSecretKey(): string | undefined {
  const key = process.env.PAYSTACK_SECRET_KEY
  return key && key.trim() ? key.trim() : undefined
}

function paymentsGhana(
  container: MedusaContainer
): PaymentsGhanaModuleService {
  return container.resolve(PAYMENTS_GHANA_MODULE) as PaymentsGhanaModuleService
}

/**
 * Load cart with fields needed for checkout validation + totals.
 */
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
      "shipping_address.*",
      "items.id",
      "items.quantity",
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

function requireCartReadyForCheckout(cart: LoadedCart): void {
  if (cart.completed_at) {
    throw new CheckoutHttpError(409, "Cart has already been completed")
  }
  if (!cart.items?.length) {
    throw new CheckoutHttpError(400, "Cart has no line items")
  }
  if (!cart.shipping_address) {
    throw new CheckoutHttpError(
      400,
      "Cart requires a shipping_address before checkout"
    )
  }
}

/**
 * Ensure cart has a processable system payment session, then complete cart → order.
 * Used for COD and for MoMo after external Paystack success verification.
 */
export async function ensureSystemPaymentAndCompleteCart(
  container: MedusaContainer,
  cartId: string
): Promise<{ order_id: string }> {
  const cart = await loadCheckoutCart(container, cartId)

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

  // Always (re)create a system session so completeCart can authorize/capture.
  // System provider auto-authorizes; suitable for COD and post-MoMo capture.
  await createPaymentSessionsWorkflow(container).run({
    input: {
      payment_collection_id: paymentCollectionId,
      provider_id: SYSTEM_PAYMENT_PROVIDER_ID,
      data: {
        ghana_checkout: true,
      },
    },
  })

  const { result, errors } = await completeCartWorkflow(container).run({
    input: { id: cartId },
    throwOnError: false,
  })

  if (errors?.length) {
    throw new CheckoutHttpError(400, errorMessage({ errors }))
  }

  const orderId = result?.id
  if (!orderId) {
    throw new CheckoutHttpError(
      500,
      "completeCartWorkflow did not return an order id"
    )
  }

  return { order_id: orderId }
}

/**
 * COD path: sync order via system payment provider + completeCartWorkflow.
 */
export async function runCodCheckout(
  container: MedusaContainer,
  input: CheckoutInput
): Promise<CheckoutResult> {
  if (input.paymentMethod !== "cod") {
    throw new CheckoutHttpError(400, "paymentMethod must be cod")
  }

  const cart = await loadCheckoutCart(container, input.cartId)
  requireCartReadyForCheckout(cart)

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
 * MoMo path: intent-first (ADR-014), then Paystack charge. Cart is NOT completed
 * until payment success (sync charge or webhook/confirm).
 */
export async function runMomoCheckout(
  container: MedusaContainer,
  input: CheckoutInput
): Promise<CheckoutResult> {
  if (input.paymentMethod !== "momo") {
    throw new CheckoutHttpError(400, "paymentMethod must be momo")
  }

  const secretKey = getPaystackSecretKey()
  if (!secretKey) {
    throw new CheckoutHttpError(
      400,
      "PAYSTACK_SECRET_KEY is not configured — cannot process MoMo payments"
    )
  }

  if (!input.email?.trim()) {
    throw new CheckoutHttpError(400, "email is required for MoMo checkout")
  }
  if (!input.phone?.trim()) {
    throw new CheckoutHttpError(400, "phone is required for MoMo checkout")
  }
  if (!input.momoProvider) {
    throw new CheckoutHttpError(
      400,
      "momo_provider is required for MoMo checkout (mtn | vodafone | airteltigo)"
    )
  }

  const cart = await loadCheckoutCart(container, input.cartId)
  requireCartReadyForCheckout(cart)

  const currency = (cart.currency_code || "ghs").toLowerCase()
  const totalMajor = Number(cart.total ?? 0)
  if (!Number.isFinite(totalMajor) || totalMajor <= 0) {
    throw new CheckoutHttpError(400, "Cart total must be greater than zero")
  }

  let amountPesewas: number
  try {
    amountPesewas = toPaystackAmountPesewas(totalMajor, currency)
  } catch (err) {
    throw new CheckoutHttpError(
      400,
      err instanceof Error ? err.message : "Invalid cart amount"
    )
  }

  const ttlMin = getPaymentTtlMinutes()
  const expiresAt = new Date(Date.now() + ttlMin * 60_000)

  const ghana = paymentsGhana(container)

  // ADR-014: persist intent BEFORE any Paystack HTTP call
  const intent = await ghana.createInitiated({
    cartId: cart.id,
    amountPesewas,
    currency,
    expiresAt,
    metadata: {
      email: input.email.trim(),
      phone: input.phone.trim(),
      momoProvider: input.momoProvider,
    },
  })

  let charge
  try {
    charge = await chargeMobileMoney({
      secretKey,
      amountPesewas,
      email: input.email.trim(),
      phone: input.phone.trim(),
      provider: input.momoProvider,
      currency,
      reference: intent.client_reference,
      metadata: {
        payment_intent_id: intent.id,
        client_reference: intent.client_reference,
        cart_id: cart.id,
      },
    })
  } catch (err) {
    await ghana.markFailed(intent.id).catch(() => undefined)
    if (err instanceof PaymentDeclinedError) {
      throw new CheckoutHttpError(402, err.message)
    }
    throw new CheckoutHttpError(
      402,
      err instanceof Error ? err.message : "MoMo charge failed"
    )
  }

  await ghana.attachProviderReference(intent.id, charge.reference)

  if (charge.status === "success") {
    // Sync success (common in sandbox): confirm + complete cart
    return confirmPaidByProviderReference(container, charge.reference)
  }

  // Async pending — buyer must approve USSD/prompt; webhook will confirm
  return {
    status: "payment_pending",
    cart_id: cart.id,
    payment_intent_id: intent.id,
    client_reference: intent.client_reference,
    provider_reference: charge.reference,
    expires_at:
      expiresAt instanceof Date
        ? expiresAt.toISOString()
        : String(intent.expires_at ?? expiresAt),
    amount_pesewas: amountPesewas,
  }
}

/**
 * Confirm a successful Paystack charge by provider reference (webhook / sync).
 * Idempotent when intent already succeeded with order_id.
 */
export async function confirmPaidByProviderReference(
  container: MedusaContainer,
  providerReference: string
): Promise<CheckoutResult> {
  if (!providerReference) {
    throw new CheckoutHttpError(400, "provider reference is required")
  }

  const ghana = paymentsGhana(container)
  let intent =
    (await ghana.findByProviderReference(providerReference)) ??
    (await ghana.findByClientReference(providerReference))

  if (!intent) {
    throw new CheckoutHttpError(
      404,
      `Payment intent not found for reference: ${providerReference}`
    )
  }

  // Idempotent success
  if (intent.status === "succeeded" && intent.order_id) {
    return {
      status: "completed",
      order_id: intent.order_id,
      cart_id: intent.cart_id || "",
    }
  }

  const secretKey = getPaystackSecretKey()
  if (!secretKey) {
    throw new CheckoutHttpError(
      400,
      "PAYSTACK_SECRET_KEY is not configured — cannot verify payment"
    )
  }

  const verified = await verifyPaystackTransaction(
    secretKey,
    providerReference
  )
  if (!verified || verified.status !== "success") {
    throw new CheckoutHttpError(
      402,
      `Paystack transaction not successful (status=${verified?.status ?? "unknown"})`
    )
  }

  try {
    assertPaystackAmountMatches(verified.amount, Number(intent.amount_pesewas))
  } catch (err) {
    // Amount mismatch: attempt refund, fail intent
    await refundCharge({
      secretKey,
      reference: providerReference,
      amountPesewas: Number(verified.amount),
    })
    await ghana.markFailed(intent.id)
    await ghana.updatePaymentIntents({
      id: intent.id,
      metadata: {
        ...(typeof intent.metadata === "object" && intent.metadata
          ? (intent.metadata as Record<string, unknown>)
          : {}),
        amount_mismatch: true,
        paystack_amount: verified.amount,
        intent_amount: intent.amount_pesewas,
      },
    })
    throw new CheckoutHttpError(
      402,
      err instanceof Error ? err.message : "Amount mismatch"
    )
  }

  await ghana.markSucceeded(intent.id)

  const cartId = intent.cart_id
  if (!cartId) {
    throw new CheckoutHttpError(
      500,
      "Payment intent has no cart_id — cannot complete order"
    )
  }

  try {
    const { order_id } = await ensureSystemPaymentAndCompleteCart(
      container,
      cartId
    )
    await ghana.updatePaymentIntents({
      id: intent.id,
      order_id,
      status: "succeeded",
    })
    return {
      status: "completed",
      order_id,
      cart_id: cartId,
    }
  } catch (err) {
    // Charge already succeeded — must refund to avoid orphaned capture
    const refund = await refundCharge({
      secretKey,
      reference: providerReference,
      amountPesewas: Number(intent.amount_pesewas),
    })
    await ghana.markFailed(intent.id)
    await ghana.updatePaymentIntents({
      id: intent.id,
      metadata: {
        ...(typeof intent.metadata === "object" && intent.metadata
          ? (intent.metadata as Record<string, unknown>)
          : {}),
        complete_cart_failed: true,
        complete_cart_error:
          err instanceof Error ? err.message : String(err),
        refund_attempted: true,
        refund_ok: refund.ok,
        refund_error: refund.ok ? undefined : refund.error,
      },
    })
    throw new CheckoutHttpError(
      500,
      `Payment succeeded but order creation failed (refund ${refund.ok ? "issued" : "FAILED — ops reconciliation required"}): ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }
}

/**
 * Expire initiated/pending intents past expires_at. Does NOT complete carts.
 */
export async function abandonExpiredIntents(
  container: MedusaContainer
): Promise<{ expired: number; ids: string[] }> {
  const ghana = paymentsGhana(container)
  const now = new Date()

  const intents = await ghana.listPaymentIntents(
    {
      status: ["initiated", "pending"],
    },
    { take: 500 }
  )

  const expiredIds: string[] = []
  for (const intent of intents) {
    if (!intent.expires_at) continue
    const exp = new Date(intent.expires_at)
    if (Number.isNaN(exp.getTime()) || exp >= now) continue
    await ghana.markExpired(intent.id)
    expiredIds.push(intent.id)
  }

  return { expired: expiredIds.length, ids: expiredIds }
}

/**
 * Top-level dispatcher used by the store route.
 */
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
