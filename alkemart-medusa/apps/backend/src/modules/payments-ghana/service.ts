import { MedusaService } from "@medusajs/framework/utils"
import { randomUUID } from "crypto"
import PaymentIntent from "./models/payment-intent"

export type PaymentIntentStatus =
  | "initiated"
  | "pending"
  | "succeeded"
  | "failed"
  | "expired"

export type CreateInitiatedInput = {
  cartId?: string | null
  orderId?: string | null
  amountPesewas: number
  currency?: string
  expiresAt?: Date | string | null
  metadata?: Record<string, unknown> | null
}

class PaymentsGhanaModuleService extends MedusaService({
  PaymentIntent,
}) {
  /**
   * Create a payment intent in `initiated` status with a server-generated
   * client_reference (UUID). Call this before any Paystack HTTP request.
   */
  async createInitiated(input: CreateInitiatedInput) {
    if (!Number.isInteger(input.amountPesewas) || input.amountPesewas < 0) {
      throw new Error(
        `amountPesewas must be a non-negative integer (got ${input.amountPesewas})`
      )
    }

    const clientReference = randomUUID()

    return this.createPaymentIntents({
      cart_id: input.cartId ?? null,
      order_id: input.orderId ?? null,
      client_reference: clientReference,
      provider_reference: null,
      amount_pesewas: input.amountPesewas,
      currency: (input.currency ?? "ghs").toLowerCase(),
      status: "initiated" satisfies PaymentIntentStatus,
      expires_at: input.expiresAt ?? null,
      metadata: input.metadata ?? null,
    })
  }

  async attachProviderReference(id: string, providerReference: string) {
    if (!providerReference) {
      throw new Error("providerReference is required")
    }
    return this.updatePaymentIntents({
      id,
      provider_reference: providerReference,
      // Charge submitted — still awaiting confirmation unless already terminal.
      status: "pending",
    })
  }

  /**
   * Mark intent succeeded. Idempotent: if already succeeded, returns as-is.
   */
  async markSucceeded(id: string) {
    const intent = await this.retrievePaymentIntent(id)
    if (intent.status === "succeeded") {
      return intent
    }
    return this.updatePaymentIntents({ id, status: "succeeded" })
  }

  /**
   * Mark intent failed. Idempotent for already-failed; does not overwrite succeeded.
   */
  async markFailed(id: string) {
    const intent = await this.retrievePaymentIntent(id)
    if (intent.status === "failed" || intent.status === "succeeded") {
      return intent
    }
    return this.updatePaymentIntents({ id, status: "failed" })
  }

  /**
   * Mark intent expired. Idempotent for already-expired; does not overwrite succeeded.
   */
  async markExpired(id: string) {
    const intent = await this.retrievePaymentIntent(id)
    if (intent.status === "expired" || intent.status === "succeeded") {
      return intent
    }
    return this.updatePaymentIntents({ id, status: "expired" })
  }

  async findByClientReference(clientReference: string) {
    const [intent] = await this.listPaymentIntents({
      client_reference: clientReference,
    })
    return intent ?? null
  }

  async findByProviderReference(providerReference: string) {
    const [intent] = await this.listPaymentIntents({
      provider_reference: providerReference,
    })
    return intent ?? null
  }
}

export default PaymentsGhanaModuleService
