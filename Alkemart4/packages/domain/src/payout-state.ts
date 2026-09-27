/**
 * Payout lifecycle. A payout is reserved (pending) before any money moves,
 * sent to Paystack (processing), then settled by Paystack's answer — by
 * webhook or by verifying the reference. Only these moves are legal:
 *
 *   pending ─► processing ─► paid ─► reversed
 *      │            │
 *      └────────────┴─► failed          (orders become payable again)
 */
export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "reversed"

const NEXT: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ["processing", "paid", "failed"],
  processing: ["paid", "failed"],
  paid: ["reversed"],
  failed: [],
  reversed: [],
}

export function canMovePayout(from: PayoutStatus, to: PayoutStatus): boolean {
  return NEXT[from].includes(to)
}

/** Our status for a Paystack transfer status; null = still in flight, no change. */
export function payoutStatusFromTransfer(status: string): Exclude<PayoutStatus, "pending"> | null {
  switch (status.toLowerCase()) {
    case "success":
      return "paid"
    case "reversed":
      return "reversed"
    case "failed":
    case "rejected":
    case "abandoned":
    case "blocked":
      return "failed"
    case "pending":
    case "processing":
    case "received":
    case "queued":
      return "processing"
    default:
      // "otp" means OTP confirmation is still on for API transfers — it will
      // never complete on its own. Surface it; don't guess.
      return null
  }
}

/** Plain-language line for sellers and admins. */
export function payoutStatusText(status: PayoutStatus): string {
  return {
    pending: "Being prepared",
    processing: "On its way to your MoMo",
    paid: "Paid",
    failed: "Didn't go through — your orders are back in the next payout",
    reversed: "Returned by the network — your orders are back in the next payout",
  }[status]
}

/**
 * How sellers get paid in a market. With `autoPayout`, a seller's released
 * money is sent as soon as it is released (handover code, the buyer's "I got
 * it", or the end of the report window) — no admin press. Admin's "Pay" and
 * "Pay everyone ready" stay as the backstop.
 */
export type PayoutPolicy = { autoPayout: boolean }

/** Off for the pilot (owner, 2026-09-27): admin pays with "Pay everyone ready"; decide after the pilot (ESCROW-OPTIONS.md). */
export const DEFAULT_PAYOUT_POLICY: PayoutPolicy = { autoPayout: false }
