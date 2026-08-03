import { paystackRequest, toPaystackAmountPesewas } from "../../lib/paystack-client.ts"

type Options = {
  secretKey: string
}

class PaystackPayoutProvider {
  static identifier = "paystack-payout"
  private options_: Options

  constructor(_cradle: any, options: Options) {
    this.options_ = options
  }

  async createPayoutAccount(input: any) {
    const data = input.data || {}
    const phone = data.phone
    const provider = data.provider
    const name = data.name || "Seller"

    const bankCodes: Record<string, string> = {
      mtn: "MTN",
      vodafone: "VODAFONE",
      airteltigo: "AIRTELTIGO",
    }

    const bankCode = bankCodes[String(provider || "").toLowerCase()] || "MTN"

    const recipient = await paystackRequest<any>({
      secretKey: this.options_.secretKey,
      path: "/transferrecipient",
      body: {
        type: "mobile_money",
        name,
        account_number: String(phone),
        bank_code: bankCode,
        currency: "GHS",
      },
    })

    return {
      id: recipient.recipient_code as string,
      status: "active" as const,
      data: { recipient_code: recipient.recipient_code },
    }
  }

  async createPayout(input: any) {
    const amount = toPaystackAmountPesewas(
      Number(input.amount),
      input.currency_code || "ghs"
    )

    const transfer = await paystackRequest<any>({
      secretKey: this.options_.secretKey,
      path: "/transfer",
      body: {
        source: "balance",
        amount,
        recipient: input.account_id,
        reason: "Marketplace payout",
      },
    })

    return {
      status: transfer.status === "success" ? ("paid" as const) : ("processing" as const),
      data: { transfer_code: transfer.transfer_code },
    }
  }

  async createOnboarding(_input: any) {
    return { data: {} }
  }

  async getWebhookActionAndData(payload: any) {
    const event = payload.data?.event
    const transfer = payload.data?.data

    if (event === "transfer.success") {
      return { action: "payout.paid" as const, data: { id: transfer?.reference } }
    }
    if (event === "transfer.failed") {
      return { action: "payout.failed" as const, data: { id: transfer?.reference } }
    }

    return { action: "not_supported" as const }
  }
}

export default PaystackPayoutProvider
