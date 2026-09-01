export type OrderFulfillmentStatus = "placed" | "shipped" | "delivered" | "cancelled"

const ALLOWED: Record<OrderFulfillmentStatus, ReadonlySet<OrderFulfillmentStatus>> = {
  placed: new Set(["shipped", "cancelled"]),
  shipped: new Set(["delivered", "cancelled"]),
  delivered: new Set(),
  cancelled: new Set(),
}

export class InvalidFulfillmentTransitionError extends Error {
  readonly from: OrderFulfillmentStatus
  readonly to: OrderFulfillmentStatus

  constructor(from: OrderFulfillmentStatus, to: OrderFulfillmentStatus) {
    super(`cannot transition order ${from} → ${to}`)
    this.name = "InvalidFulfillmentTransitionError"
    this.from = from
    this.to = to
  }
}

export function assertFulfillmentTransition(
  from: OrderFulfillmentStatus,
  to: OrderFulfillmentStatus,
): void {
  if (from === to) return
  if (!ALLOWED[from].has(to)) {
    throw new InvalidFulfillmentTransitionError(from, to)
  }
}

export type PayoutOrderInput = {
  orderId: string
  sellerId: string
  /** Goods subtotal only (delivery fees are not commissionable in v1). */
  subtotalPesewas: bigint
}

export type PayoutLineComputed = {
  orderId: string
  sellerId: string
  grossPesewas: bigint
  commissionPesewas: bigint
  netPesewas: bigint
}

export type PayoutBatchComputed = {
  sellerId: string
  commissionBps: number
  lines: PayoutLineComputed[]
  grossPesewas: bigint
  commissionPesewas: bigint
  netPesewas: bigint
}

/** Apply commission_bps to delivered order subtotals. */
export function computePayoutBatch(
  sellerId: string,
  commissionBps: number,
  orders: PayoutOrderInput[],
): PayoutBatchComputed {
  if (commissionBps < 0 || commissionBps > 10_000) {
    throw new Error(`commissionBps out of range: ${commissionBps}`)
  }
  const lines: PayoutLineComputed[] = []
  let grossPesewas = 0n
  let commissionPesewas = 0n
  let netPesewas = 0n

  for (const order of orders) {
    if (order.sellerId !== sellerId) {
      throw new Error(`order ${order.orderId} seller mismatch`)
    }
    if (order.subtotalPesewas < 0n) {
      throw new Error(`negative subtotal on ${order.orderId}`)
    }
    const commission = (order.subtotalPesewas * BigInt(commissionBps)) / 10_000n
    const net = order.subtotalPesewas - commission
    lines.push({
      orderId: order.orderId,
      sellerId,
      grossPesewas: order.subtotalPesewas,
      commissionPesewas: commission,
      netPesewas: net,
    })
    grossPesewas += order.subtotalPesewas
    commissionPesewas += commission
    netPesewas += net
  }

  return { sellerId, commissionBps, lines, grossPesewas, commissionPesewas, netPesewas }
}
