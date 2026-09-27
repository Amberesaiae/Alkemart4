/**
 * Returns and disputes (pilot phase 3).
 *
 * Trust by default: the buyer asks, the seller answers, and admin only
 * decides what the two of them can't settle. Every rule and window lives
 * here; the API computes with it and the apps only display the result.
 *
 * Money is bigint minor units. A case covers one seller's order; a refund
 * never exceeds what the buyer paid for its items minus earlier refunds.
 */
import type { DeliveryConfirmedBy } from "./delivery-options"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// ─── Vocabulary ──────────────────────────────────────────────────────────

export const RETURN_REASONS = ["damaged", "wrong_item", "not_as_described", "changed_mind"] as const
export type ReturnReason = (typeof RETURN_REASONS)[number]

/** Plain words for each reason — the API sends these so every app says the same. */
export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  damaged: "Damaged or doesn't work",
  wrong_item: "Wrong item",
  not_as_described: "Not as described",
  changed_mind: "Changed my mind",
}

/** What the buyer asks for. */
export type ReturnWish = "refund" | "swap"

/**
 * requested → the seller must answer by `respondBy`
 * declined → the buyer accepts it, or asks alkemart to decide (no deadline)
 * escalated → admin decides
 * closed → done (see outcome)
 *
 * Kept deliberately small (owner, 2026-09-27): the seller refunds, replaces
 * or declines. No counter-offers; if the seller wants the item back first
 * they arrange it with the buyer in messages before tapping Refund.
 */
export type ReturnStatus = "requested" | "declined" | "escalated" | "closed"
export const OPEN_RETURN_STATUSES: readonly ReturnStatus[] = ["requested", "declined", "escalated"]

export type ReturnOutcome = "refund" | "swap" | "declined" | "withdrawn"
export type ReturnActor = "buyer" | "seller" | "admin" | "system"

/** Plain-language rule failure; the API maps it to 400/409 as-is. */
export class ReturnRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReturnRuleError"
  }
}

// ─── Policy ──────────────────────────────────────────────────────────────

/**
 * The numbers behind returns, in one place (fixed defaults; not admin-tunable
 * — owner, 2026-09-27). Apps never repeat them.
 */
export type ReturnPolicy = {
  /** Change-of-mind days for shops that haven't set their own. */
  defaultReturnDays: number
  /** Faulty, wrong or not-as-described items: at least this many days, whatever the shop's policy. */
  faultReturnDays: number
  /** Hours the seller has to answer before the case goes to admin. */
  sellerReplyHours: number
}

export const DEFAULT_RETURN_POLICY: ReturnPolicy = {
  defaultReturnDays: 7,
  faultReturnDays: 7,
  sellerReplyHours: 48,
}

// ─── Who can ask, for what, until when ───────────────────────────────────

export type ReturnableOrder = {
  status: "placed" | "shipped" | "delivered" | "cancelled" | string
  deliveredAt: Date | null
  deliveryConfirmedBy: DeliveryConfirmedBy | null
  /** Online payment that succeeded. Pay-on-delivery is paid only once delivered. */
  paidOnline: boolean
  subtotalMinor: bigint
  refundedMinor: bigint
  /** The shop's change-of-mind days in force when the order was placed; null = shop set none. */
  shopReturnDays: number | null
}

export type ReturnOption = { reason: ReturnReason; label: string; until: Date | null }

/** What the buyer has paid for these items and not had back. */
export function refundableMinor(o: Pick<ReturnableOrder, "status" | "paidOnline" | "subtotalMinor" | "refundedMinor">): bigint {
  const paid = o.paidOnline || o.status === "delivered"
  if (!paid) return 0n
  const left = o.subtotalMinor - o.refundedMinor
  return left > 0n ? left : 0n
}

/** Change-of-mind days that apply to this order. */
export function shopReturnDays(o: Pick<ReturnableOrder, "shopReturnDays">, policy: ReturnPolicy = DEFAULT_RETURN_POLICY): number {
  return o.shopReturnDays ?? policy.defaultReturnDays
}

/**
 * The reasons this buyer can use right now, each with its last moment
 * (null = no end while the order is on the way). Empty = nothing to ask for.
 */
export function returnOptions(o: ReturnableOrder, now: Date, policy: ReturnPolicy = DEFAULT_RETURN_POLICY): ReturnOption[] {
  if (refundableMinor(o) <= 0n) return []
  const out: ReturnOption[] = []
  const add = (reason: ReturnReason, until: Date | null) => {
    if (until === null || until.getTime() >= now.getTime()) out.push({ reason, label: RETURN_REASON_LABEL[reason], until })
  }
  const after = (days: number) => (o.deliveredAt ? new Date(o.deliveredAt.getTime() + days * DAY) : null)
  const shopDays = shopReturnDays(o, policy)
  if (o.status === "delivered" && o.deliveredAt) {
    const faultUntil = after(Math.max(policy.faultReturnDays, shopDays))!
    add("damaged", faultUntil)
    add("wrong_item", faultUntil)
    add("not_as_described", faultUntil)
    if (shopDays > 0) add("changed_mind", after(shopDays))
  }
  return out
}

/** Throws a plain ReturnRuleError when this reason can't be used now; returns its window. */
export function assertCanAskForReturn(o: ReturnableOrder, reason: ReturnReason, now: Date, policy: ReturnPolicy = DEFAULT_RETURN_POLICY): ReturnOption {
  const hit = returnOptions(o, now, policy).find((x) => x.reason === reason)
  if (hit) return hit
  if (o.status === "cancelled") throw new ReturnRuleError("This order was cancelled.")
  if (refundableMinor(o) <= 0n) {
    throw new ReturnRuleError(o.refundedMinor > 0n ? "This order has already been refunded in full." : "There's nothing paid on this order to return yet.")
  }
  if (reason === "changed_mind" && shopReturnDays(o, policy) === 0) throw new ReturnRuleError("This shop doesn't take returns for a change of mind. If something's wrong with the item, pick what's wrong.")
  if (o.status !== "delivered") throw new ReturnRuleError("You can ask for a return once the order has arrived.")
  throw new ReturnRuleError("The time to ask for this has passed.")
}

// ─── The case, step by step ──────────────────────────────────────────────

export type ReturnCaseState = {
  status: ReturnStatus
  wish: ReturnWish
  respondBy: Date | null
  /** What can still be refunded on the order right now (caller computes). */
  refundableMinor: bigint
}

export type ReturnAction =
  | { by: "seller"; type: "refund" }
  | { by: "seller"; type: "replace" }
  | { by: "seller"; type: "decline"; reason: string }
  | { by: "buyer"; type: "accept" }
  | { by: "buyer"; type: "escalate" }
  | { by: "buyer"; type: "withdraw" }
  | { by: "admin"; type: "decide"; outcome: "refund" | "declined"; note: string }
  | { by: "system"; type: "timeout" }

/** The case after an action: the new status and, when closing, what was settled. */
export type ReturnStep = {
  status: ReturnStatus
  respondBy: Date | null
  declineReason?: string
  outcome?: ReturnOutcome
  /** Money going back to the buyer when the case closes (0 for swaps and declines). */
  refundMinor: bigint
  /** One timeline line, in plain words. */
  note: string
}


function closed(outcome: ReturnOutcome, refundMinor: bigint, note: string, extra: Partial<ReturnStep> = {}): ReturnStep {
  return { status: "closed", respondBy: null, outcome, refundMinor, note, ...extra }
}

/**
 * Apply one action. Throws ReturnRuleError (plain words) when it isn't
 * allowed from the current status, or the amount is wrong.
 */
export function nextReturnStep(s: ReturnCaseState, a: ReturnAction, now: Date): ReturnStep {
  const is = (...st: ReturnStatus[]) => st.includes(s.status)
  const moved = () => new ReturnRuleError("This return has already moved on. Refresh to see where it stands.")
  const due = s.respondBy !== null && s.respondBy.getTime() <= now.getTime()

  switch (a.by) {
    case "seller": {
      if (!is("requested")) throw moved()
      if (a.type === "refund") {
        if (s.refundableMinor <= 0n) throw new ReturnRuleError("Nothing is left to refund on this order.")
        return closed("refund", s.refundableMinor, "Seller refunded in full")
      }
      if (a.type === "replace") return closed("swap", 0n, "Seller will send a replacement")
      const reason = a.reason.trim()
      if (reason.length < 5) throw new ReturnRuleError("Tell the buyer why in a few words.")
      return { status: "declined", respondBy: null, declineReason: reason, refundMinor: 0n, note: "Seller declined" }
    }

    case "buyer": {
      if (a.type === "withdraw") {
        if (!is(...OPEN_RETURN_STATUSES)) throw moved()
        return closed("withdrawn", 0n, "Buyer said it's sorted")
      }
      if (a.type === "accept") {
        if (!is("declined")) throw moved()
        return closed("declined", 0n, "Buyer accepted the seller's answer")
      }
      // escalate
      if (is("declined")) return { status: "escalated", respondBy: null, refundMinor: 0n, note: "Buyer asked alkemart to decide" }
      if (is("requested")) {
        if (!due) throw new ReturnRuleError("The seller still has time to answer. If they don't, alkemart steps in automatically.")
        return { status: "escalated", respondBy: null, refundMinor: 0n, note: "Buyer asked alkemart to decide" }
      }
      throw moved()
    }

    case "admin": {
      if (!is("escalated")) throw new ReturnRuleError("Only cases the buyer and seller couldn't settle come to admin.")
      const note = a.note.trim()
      if (note.length < 5) throw new ReturnRuleError("Write a short reason — both sides will see it.")
      if (a.outcome === "declined") return closed("declined", 0n, "alkemart sided with the seller")
      if (s.refundableMinor <= 0n) throw new ReturnRuleError("Nothing is left to refund on this order.")
      return closed("refund", s.refundableMinor, "alkemart decided: full refund")
    }

    case "system": {
      if (!due) throw new ReturnRuleError("Nothing is due on this return yet.")
      if (is("requested")) return { status: "escalated", respondBy: null, refundMinor: 0n, note: "The seller didn't answer in time — alkemart will decide" }
      throw moved()
    }
  }
}

/** The automatic step that's due now (a deadline passed), or null. */
export function dueReturnAction(s: Pick<ReturnCaseState, "status" | "respondBy">, now: Date): ReturnAction | null {
  if (!s.respondBy || s.respondBy.getTime() > now.getTime()) return null
  return s.status === "requested" ? { by: "system", type: "timeout" } : null
}

/** Who is expected to act next — for "Waiting for you" / "Waiting for the seller" labels. */
export function returnWaitingOn(status: ReturnStatus): "seller" | "buyer" | "admin" | null {
  if (status === "requested") return "seller"
  if (status === "declined") return "buyer"
  if (status === "escalated") return "admin"
  return null
}

// ─── Money ───────────────────────────────────────────────────────────────

/**
 * Split a refund between the seller and the platform's commission, rounded
 * the same way payouts round commission (down). The seller carries their
 * share; the platform gives back its commission on the refunded amount.
 */
export function refundShares(amountMinor: bigint, commissionBps: number): { sellerMinor: bigint; platformMinor: bigint } {
  if (amountMinor < 0n) throw new ReturnRuleError("A refund can't be negative.")
  if (commissionBps < 0 || commissionBps > 10_000) throw new Error(`commissionBps out of range: ${commissionBps}`)
  const platformMinor = (amountMinor * BigInt(commissionBps)) / 10_000n
  return { sellerMinor: amountMinor - platformMinor, platformMinor }
}

/**
 * How the money goes back. Online payments go back through the payment
 * provider; pay-on-delivery cash is with the seller, who pays it back and
 * records it.
 */
export function refundRoute(paymentMethod: string | null | undefined): "provider" | "seller" {
  return paymentMethod === "cod" ? "seller" : "provider"
}

/**
 * Take back refunds on already-paid orders from a new payout, oldest first,
 * only while they fit in what the payout would pay. What doesn't fit waits
 * for a later payout — a payout never goes below zero.
 */
export function applyRecoveries<T extends { id: string; amountMinor: bigint }>(netMinor: bigint, owed: T[]): { applied: T[]; totalMinor: bigint } {
  const applied: T[] = []
  let total = 0n
  for (const r of owed) {
    if (r.amountMinor <= 0n) continue
    if (total + r.amountMinor > netMinor) continue
    applied.push(r)
    total += r.amountMinor
  }
  return { applied, totalMinor: total }
}

/** What a payout pays for an order: its items less any refunds. */
export function payableSubtotal(o: { subtotalPesewas: bigint; refundedPesewas?: bigint | null }): bigint {
  const left = o.subtotalPesewas - (o.refundedPesewas ?? 0n)
  return left > 0n ? left : 0n
}
