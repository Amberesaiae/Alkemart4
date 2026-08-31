export type QuoteLine = {
  offerId: string
  sellerId: string
  qty: number
  unitPricePesewas: bigint
  lineTotalPesewas: bigint
}

export type SellerQuote = {
  sellerId: string
  lines: QuoteLine[]
  subtotalPesewas: bigint
  deliveryFeePesewas: bigint
  sellerTotalPesewas: bigint
}

export type CartQuote = {
  sellers: SellerQuote[]
  totalPesewas: bigint
  currency: "ghs"
}

export type QuoteLineInput = {
  offerId: string
  sellerId: string
  qty: number
  unitPricePesewas: bigint
  deliveryFeePesewas: bigint
}

export function quoteCart(lines: QuoteLineInput[]): CartQuote {
  const bySeller = new Map<
    string,
    { lines: QuoteLine[]; deliveryFeePesewas: bigint }
  >()

  for (const line of lines) {
    if (line.qty <= 0) {
      throw new Error(`qty must be positive (offer ${line.offerId})`)
    }
    if (line.unitPricePesewas < 0n) {
      throw new Error(`unitPricePesewas must be non-negative (offer ${line.offerId})`)
    }
    const existing = bySeller.get(line.sellerId)
    const quoteLine: QuoteLine = {
      offerId: line.offerId,
      sellerId: line.sellerId,
      qty: line.qty,
      unitPricePesewas: line.unitPricePesewas,
      lineTotalPesewas: line.unitPricePesewas * BigInt(line.qty),
    }
    if (existing) {
      existing.lines.push(quoteLine)
      // delivery once per seller — keep first seen fee
    } else {
      bySeller.set(line.sellerId, {
        lines: [quoteLine],
        deliveryFeePesewas: line.deliveryFeePesewas < 0n ? 0n : line.deliveryFeePesewas,
      })
    }
  }

  const sellers: SellerQuote[] = []
  let totalPesewas = 0n
  for (const [sellerId, group] of bySeller) {
    const subtotalPesewas = group.lines.reduce((s, l) => s + l.lineTotalPesewas, 0n)
    const sellerTotalPesewas = subtotalPesewas + group.deliveryFeePesewas
    sellers.push({
      sellerId,
      lines: group.lines,
      subtotalPesewas,
      deliveryFeePesewas: group.deliveryFeePesewas,
      sellerTotalPesewas,
    })
    totalPesewas += sellerTotalPesewas
  }

  return { sellers, totalPesewas, currency: "ghs" }
}

export type PaymentIntentStatus =
  | "initiated"
  | "pending"
  | "succeeded"
  | "completed"
  | "failed"
  | "expired"
  | "refunded"

const ALLOWED: Record<PaymentIntentStatus, ReadonlySet<PaymentIntentStatus>> = {
  initiated: new Set(["pending", "failed", "expired", "completed"]),
  pending: new Set(["succeeded", "failed", "expired"]),
  succeeded: new Set(["completed", "refunded"]),
  completed: new Set(),
  failed: new Set(),
  expired: new Set(),
  refunded: new Set(),
}

export class InvalidPaymentTransitionError extends Error {
  readonly from: PaymentIntentStatus
  readonly to: PaymentIntentStatus

  constructor(from: PaymentIntentStatus, to: PaymentIntentStatus) {
    super(`cannot transition payment intent ${from} → ${to}`)
    this.name = "InvalidPaymentTransitionError"
    this.from = from
    this.to = to
  }
}

export function assertPaymentTransition(
  from: PaymentIntentStatus,
  to: PaymentIntentStatus,
): void {
  if (from === to) return
  if (!ALLOWED[from].has(to)) {
    throw new InvalidPaymentTransitionError(from, to)
  }
}
