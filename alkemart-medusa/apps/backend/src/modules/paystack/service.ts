import { AbstractPaymentProvider, BigNumber } from "@medusajs/framework/utils"
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
import { MedusaError } from "@medusajs/framework/utils"

type Options = {
  secretKey: string
  publicKey: string
}

type InjectedDependencies = {
  logger: any
}

class PaystackPaymentProvider extends AbstractPaymentProvider<Options> {
  static identifier = "paystack"
  protected options_: Options
  protected logger_: any

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.options_ = options
    this.logger_ = container.logger
  }

  static validateOptions(options: Record<string, any>) {
    if (!options.secretKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Paystack secretKey is required"
      )
    }
  }

  private async paystackRequest(path: string, body?: any, method = "POST") {
    const url = `https://api.paystack.co${path}`
    const opts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.options_.secretKey}`,
        "Content-Type": "application/json",
      },
    }
    if (body && method !== "GET") {
      opts.body = JSON.stringify(body)
    }
    const res = await fetch(url, opts)
    const json = await res.json()
    if (!json.status) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        json.message || "Paystack API error"
      )
    }
    return json.data
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const reference = `alk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const data = await this.paystackRequest("/transaction/initialize", {
      amount: Math.round(input.amount),
      currency: input.currency_code?.toUpperCase() || "GHS",
      reference,
      metadata: {
        cart_id: input.context?.cart_id,
        ...input.data?.metadata,
      },
    })
    return {
      id: data.reference,
      data: {
        reference: data.reference,
        authorization_url: data.authorization_url,
        access_code: data.access_code,
      },
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const reference = input.data?.reference as string
    if (!reference) {
      return { data: input.data, status: "pending" }
    }
    try {
      const data = await this.paystackRequest(`/transaction/verify/${reference}`, "", "GET")
      if (data.status === "success") {
        return { data: { ...input.data, paystack_data: data }, status: "authorized" }
      }
      return { data: input.data, status: "pending" }
    } catch {
      return { data: input.data, status: "pending" }
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: input.data }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const reference = input.data?.reference as string
    if (!reference) {
      return { status: "pending" }
    }
    try {
      const data = await this.paystackRequest(`/transaction/verify/${reference}`, "", "GET")
      switch (data.status) {
        case "success":
          return { status: "captured" }
        case "failed":
        case "abandoned":
          return { status: "canceled" }
        default:
          return { status: "pending" }
      }
    } catch {
      return { status: "pending" }
    }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = await this.paystackRequest("/refund", {
      transaction: input.data?.reference,
      amount: input.amount,
    })
    return { data: { ...input.data, refund_id: data.id } }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const reference = input.data?.reference as string
    if (!reference) return input.data
    try {
      return await this.paystackRequest(`/transaction/verify/${reference}`, "", "GET")
    } catch {
      return input.data
    }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return input.data
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const { rawData, headers } = payload
    const crypto = await import("crypto")
    const rawBody = typeof rawData === "string" ? rawData : JSON.stringify(rawData)
    const hash = crypto
      .createHmac("sha512", this.options_.secretKey)
      .update(rawBody)
      .digest("hex")
    if (hash !== (headers as any)["x-paystack-signature"]) {
      return {
        action: "failed",
        data: { session_id: "", amount: new BigNumber(0) },
      }
    }
    const event = typeof rawData === "string" ? JSON.parse(rawData) : rawData
    switch (event.event) {
      case "charge.success":
        return {
          action: "captured",
          data: {
            session_id: event.data?.metadata?.session_id || "",
            amount: new BigNumber(event.data?.amount || 0),
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
