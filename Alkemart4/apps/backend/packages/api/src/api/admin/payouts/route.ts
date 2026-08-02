/**
 * GET /admin/payouts — list all seller payouts.
 * POST /admin/payouts — create / trigger a payout.
 *
 * Payout accounts are set up during vendor onboarding (ghana-setup).
 * Paystack transfer recipients are stored in payout_account.data.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { paystackRequest, toPaystackAmountPesewas } from "../../../lib/paystack-client"

const LIST_FIELDS = [
  "id",
  "display_id",
  "seller_id",
  "seller.name",
  "seller.handle",
  "account.id",
  "account.status",
  "amount",
  "currency_code",
  "status",
  "data",
  "period_start",
  "period_end",
  "paid_at",
  "created_at",
  "updated_at",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{
      data: unknown
      metadata?: { count?: number; skip?: number; take?: number }
    }>
  }

  const pagination = req.queryConfig?.pagination ?? { skip: 0, take: 50 }
  const filters: Record<string, unknown> = {}

  // Optional filter: seller_id, status
  if (typeof req.query?.seller_id === "string") {
    filters.seller_id = req.query.seller_id
  }
  if (typeof req.query?.status === "string") {
    filters.status = req.query.status
  }

  const { data: payouts, metadata } = await query.graph({
    entity: "payout",
    fields: LIST_FIELDS,
    filters,
    pagination,
  })

  res.json({
    payouts: Array.isArray(payouts) ? payouts : payouts ? [payouts] : [],
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 50,
  })
}

/**
 * POST /admin/payouts — trigger a payout for a seller.
 *
 * Validates:
 *   - seller exists and has an active payout account (Paystack recipient_code)
 *   - amount is a positive number in GHS (major units)
 *
 * Body: {
 *   seller_id: string
 *   amount: number        // GHS major units (e.g. 450.50)
 *   currency_code?: string  // defaults to "ghs"
 *   period_start?: string   // ISO date for accounting
 *   period_end?: string
 *   note?: string
 * }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as {
    seller_id?: string
    amount?: number
    currency_code?: string
    period_start?: string
    period_end?: string
    note?: string
  } | undefined

  if (!body?.seller_id) {
    res.status(400).json({ error: "seller_id is required." })
    return
  }
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number (GHS major units)." })
    return
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    res.status(500).json({ error: "PAYSTACK_SECRET_KEY not configured." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    // Fetch seller's payout account (Paystack recipient code lives in account.data)
    const { data: accountData } = await query.graph({
      entity: "payout_account",
      fields: ["id", "status", "data"],
      filters: { seller_id: body.seller_id },
    })
    const accounts = Array.isArray(accountData) ? accountData : accountData ? [accountData] : []
    const account = (accounts as Array<{ id: string; status: string; data?: Record<string, unknown> }>)[0]

    if (!account) {
      res.status(400).json({ error: "Seller does not have a payout account. They must complete onboarding first." })
      return
    }
    if (account.status !== "active") {
      res.status(400).json({ error: `Payout account is not active (status: ${account.status}).` })
      return
    }

    const recipientCode = account.data?.["recipient_code"] as string | undefined
    if (!recipientCode) {
      res.status(400).json({ error: "Payout account has no Paystack recipient code. Seller must re-link their MoMo account." })
      return
    }

    // Call Paystack transfer API via paystack-client
    const currency = body.currency_code || "ghs"
    const amountPesewas = toPaystackAmountPesewas(amount, currency)

    const transfer = await paystackRequest<{
      transfer_code: string
      status: string
      reference: string
    }>({
      secretKey,
      path: "/transfer",
      method: "POST",
      body: {
        source: "balance",
        amount: amountPesewas,
        recipient: recipientCode,
        reason: body.note || "Alkemart marketplace payout",
      },
    })

    res.status(201).json({
      payout: {
        seller_id: body.seller_id,
        amount,
        currency_code: currency,
        transfer_code: transfer.transfer_code,
        status: transfer.status === "success" ? "paid" : "processing",
        period_start: body.period_start || null,
        period_end: body.period_end || null,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to trigger payout" })
  }
}
