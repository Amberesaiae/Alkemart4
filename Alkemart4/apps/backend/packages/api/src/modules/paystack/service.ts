import { AbstractPaymentProvider, BigNumber, MedusaError } from "@medusajs/framework/utils"
import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  fromPaystackAmountMajor,
  paystackRequest,
  toPaystackAmountPesewas,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "../../lib/paystack-client"

type Options = {
  secretKey: string
  publicKey?: string
}

type InjectedDependencies = {
  logger: {
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
  }
}

/**
 * Paystack payment provider for Medusa v2.
 *
 * Amount units:
 * - Medusa GHS store amounts are **major units** (e.g. 25.5).
 * - Paystack GHS API expects **integer pesewas** (minor): major * 100.
 * - Conversion is applied in initiatePayment / refundPayment via toPaystackAmountPesewas.
 *
 * ADR-014 metadata (when available from checkout workflow):
 * order_id, payment_intent_id, client_reference should be passed in input.data.
 */
class PaystackPaymentProvider extends AbstractPaymentProvider<Options> {
  static identifier = "paystack"
  protected options_: Options
  protected logger_: InjectedDependencies["logger"]

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.options_ = options
    this.logger_ = container.logger
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.secretKey || typeof options.secretKey !== "string") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Paystack secretKey is required"
      )
    }
  }

  private async api<T = Record<string, unknown>>(
    path: string,
    body?: Record<string, unknown>,
    method: "GET" | "POST" = "POST"
  ): Promise<T> {
    try {
      return await paystackRequest<T>({
        secretKey: this.options_.secretKey,
        path,
        method,
        body,
      })
    } catch (err) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        err instanceof Error ? err.message : "Paystack API error"
      )
    }
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const currency = (input.currency_code || "ghs").toLowerCase()
    // Medusa GHS = major units → Paystack pesewas
    const amountPesewas = toPaystackAmountPesewas(input.amount as number, currency)

    const dataMeta = (input.data || {}) as Record<string, unknown>
    const context = (input.context || {}) as Record<string, unknown>

    const reference =
      (dataMeta.client_reference as string) ||
      `alk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const email =
      (dataMeta.email as string) ||
      (context.email as string) ||
      "customer@alkemart.local"

    const metadata: Record<string, unknown> = {
      // ADR-014 required join keys when checkout workflow supplies them
      order_id: dataMeta.order_id ?? context.order_id,
      payment_intent_id: dataMeta.payment_intent_id,
      client_reference: dataMeta.client_reference ?? reference,
      cart_id: dataMeta.cart_id ?? context.cart_id,
      session_id: dataMeta.session_id,
      ...(typeof dataMeta.metadata === "object" && dataMeta.metadata
        ? (dataMeta.metadata as Record<string, unknown>)
        : {}),
    }

    // Drop undefined keys so Paystack metadata stays clean
    for (const key of Object.keys(metadata)) {
      if (metadata[key] === undefined) {
        delete metadata[key]
      }
    }

    const data = await this.api<{
      reference: string
      authorization_url: string
      access_code: string
    }>("/transaction/initialize", {
      amount: amountPesewas,
      currency: currency.toUpperCase(),
      email,
      reference,
      metadata,
    })

    return {
      id: data.reference,
      data: {
        reference: data.reference,
        authorization_url: data.authorization_url,
        access_code: data.access_code,
        amount_pesewas: amountPesewas,
        currency,
        public_key: this.options_.publicKey,
      },
    }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const reference = input.data?.reference as string | undefined
    if (!reference) {
      return { data: input.data, status: "pending" }
    }

    const data = await verifyPaystackTransaction(
      this.options_.secretKey,
      reference
    )
    if (data?.status === "success") {
      return {
        data: { ...input.data, paystack_data: data },
        status: "authorized",
      }
    }
    return { data: input.data, status: "pending" }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    // Paystack charges are captured at authorize for card/momo success paths.
    return { data: input.data }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const reference = input.data?.reference as string | undefined
    if (!reference) {
      return { status: "pending" }
    }

    const data = await verifyPaystackTransaction(
      this.options_.secretKey,
      reference
    )
    if (!data) {
      return { status: "pending" }
    }

    switch (data.status) {
      case "success":
        return { status: "captured" }
      case "failed":
      case "abandoned":
        return { status: "canceled" }
      default:
        return { status: "pending" }
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const currency =
      ((input.data?.currency as string) || "ghs").toLowerCase()
    // Prefer explicit pesewas on session data; else convert Medusa major → pesewas
    let amountPesewas: number
    if (
      input.data?.amount_pesewas != null &&
      Number.isInteger(Number(input.data.amount_pesewas))
    ) {
      amountPesewas = Number(input.data.amount_pesewas)
    } else if (input.amount != null) {
      amountPesewas = toPaystackAmountPesewas(input.amount as number, currency)
    } else {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Refund amount is required"
      )
    }

    const data = await this.api<{ id: number }>("/refund", {
      transaction: input.data?.reference,
      amount: amountPesewas,
    })

    return { data: { ...input.data, refund_id: data.id } }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const reference = input.data?.reference as string | undefined
    if (!reference) {
      return { data: input.data }
    }

    const data = await verifyPaystackTransaction(
      this.options_.secretKey,
      reference
    )
    if (!data) {
      return { data: input.data }
    }
    return { data: { ...input.data, ...data } }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data }
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { rawData, headers } = payload
    const rawBody =
      typeof rawData === "string"
        ? rawData
        : Buffer.isBuffer(rawData)
          ? rawData.toString("utf8")
          : JSON.stringify(rawData)

    const signature =
      (headers as Record<string, string | string[] | undefined>)?.[
        "x-paystack-signature"
      ] ??
      (headers as Record<string, string | string[] | undefined>)?.[
        "X-Paystack-Signature"
      ]
    const signatureHeader = Array.isArray(signature) ? signature[0] : signature

    const valid = verifyPaystackWebhookSignature(
      rawBody,
      signatureHeader,
      this.options_.secretKey
    )

    if (!valid) {
      this.logger_?.warn?.("Paystack webhook signature verification failed")
      return {
        action: "failed",
        data: { session_id: "", amount: new BigNumber(0) },
      }
    }

    const event =
      typeof rawData === "string" ? JSON.parse(rawData) : (rawData as any)

    switch (event.event) {
      case "charge.success": {
        // Paystack amount is always minor units (pesewas for GHS)
        const amountPesewas = Number(event.data?.amount || 0)
        const currency = String(event.data?.currency || "GHS").toLowerCase()
        const major = fromPaystackAmountMajor(amountPesewas, currency)
        const sessionId =
          event.data?.metadata?.session_id ||
          event.data?.metadata?.client_reference ||
          event.data?.reference ||
          ""

        return {
          action: "captured",
          data: {
            session_id: String(sessionId),
            amount: new BigNumber(major),
          },
        }
      }
      case "charge.failed":
        return {
          action: "failed",
          data: {
            session_id: String(
              event.data?.metadata?.session_id ||
                event.data?.reference ||
                ""
            ),
            amount: new BigNumber(
              fromPaystackAmountMajor(
                Number(event.data?.amount || 0),
                String(event.data?.currency || "GHS")
              )
            ),
          },
        }
      default:
        return {
          action: "not_supported",
          data: { session_id: "", amount: new BigNumber(0) },
        }
    }
  }
}

export default PaystackPaymentProvider
