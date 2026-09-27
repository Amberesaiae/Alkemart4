/**
 * Make an offer (pilot phase 5). A seller marks a listing negotiable, with
 * an optional hidden floor. A buyer offers a price for a quantity; anything
 * below the floor is declined at once (the floor is never revealed). The
 * seller accepts, counters or declines. An accepted price is held for that
 * buyer, that listing and that quantity for a short time at checkout.
 *
 * Money is bigint minor units. Rules and windows live here; apps display.
 */

export type DealStatus = "pending" | "countered" | "accepted" | "declined" | "expired" | "used" | "withdrawn"
export const OPEN_DEAL_STATUSES: readonly DealStatus[] = ["pending", "countered"]

export class DealRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DealRuleError"
  }
}

/** Admin-tunable numbers (platform_settings "deal_policy"). */
export type DealPolicy = {
  /** Hours an accepted price stays usable at checkout. */
  validHours: number
  /** Hours the seller has to answer before an offer lapses. */
  sellerReplyHours: number
  /** Hours the buyer has to answer a counter-offer. */
  buyerReplyHours: number
  /** Offers below this share of the listed price are refused outright (not sent). */
  minPercentOfPrice: number
  /** Open offers one buyer may have at once. */
  maxOpenPerBuyer: number
}

export const DEFAULT_DEAL_POLICY: DealPolicy = { validHours: 24, sellerReplyHours: 24, buyerReplyHours: 24, minPercentOfPrice: 50, maxOpenPerBuyer: 5 }

const LIMITS: Record<keyof DealPolicy, readonly [number, number, string]> = {
  validHours: [1, 168, "Accepted prices must last 1–168 hours."],
  sellerReplyHours: [1, 168, "Seller reply time must be 1–168 hours."],
  buyerReplyHours: [1, 168, "Buyer reply time must be 1–168 hours."],
  minPercentOfPrice: [1, 99, "The lowest offer must be 1–99% of the price."],
  maxOpenPerBuyer: [1, 50, "Open offers per buyer must be 1–50."],
}

export function parseDealPolicy(input: unknown): { ok: true; policy: DealPolicy } | { ok: false; message: string } {
  const v = (input && typeof input === "object" ? input : {}) as Partial<Record<keyof DealPolicy, unknown>>
  const out = { ...DEFAULT_DEAL_POLICY } as Record<keyof DealPolicy, number>
  for (const k of Object.keys(LIMITS) as (keyof DealPolicy)[]) {
    const raw = v[k] === undefined ? DEFAULT_DEAL_POLICY[k] : v[k]
    const [lo, hi, message] = LIMITS[k]
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < lo || raw > hi) return { ok: false, message }
    out[k] = raw
  }
  return { ok: true, policy: out }
}

export function dealPolicyFrom(stored: unknown): DealPolicy {
  const r = parseDealPolicy(stored ?? {})
  return r.ok ? r.policy : DEFAULT_DEAL_POLICY
}

/** Seller's floor must be below the listed price (else there's nothing to negotiate). */
export function checkFloor(floorMinor: bigint | null, priceMinor: bigint): string | null {
  if (floorMinor === null) return null
  if (floorMinor <= 0n) return "Set a lowest price above zero, or leave it empty."
  if (floorMinor >= priceMinor) return "Your lowest price must be below the listed price."
  return null
}

/**
 * A buyer's offer before it reaches the seller. Refused outright if it's
 * not a real offer; auto-declined (and recorded) if under the hidden floor.
 */
export function judgeBuyerOffer(
  o: { priceMinor: bigint; amountMinor: bigint; qty: number; available: number; negotiable: boolean; floorMinor: bigint | null; openByBuyer: number },
  policy: DealPolicy = DEFAULT_DEAL_POLICY,
): { verdict: "send" | "auto_decline" } {
  if (!o.negotiable) throw new DealRuleError("This seller has fixed prices on this item.")
  if (!Number.isInteger(o.qty) || o.qty < 1) throw new DealRuleError("Choose how many you want.")
  if (o.qty > o.available) throw new DealRuleError(`Only ${o.available} left.`)
  if (o.amountMinor <= 0n) throw new DealRuleError("Enter a price like 1500 or 1500.50.")
  if (o.amountMinor >= o.priceMinor) throw new DealRuleError("That's the listed price or more — just buy it.")
  if (o.amountMinor * 100n < o.priceMinor * BigInt(policy.minPercentOfPrice)) {
    throw new DealRuleError("That offer is too low to send. Try something closer to the price.")
  }
  if (o.openByBuyer >= policy.maxOpenPerBuyer) throw new DealRuleError("You have too many offers waiting. Wait for answers, or withdraw one.")
  return { verdict: o.floorMinor !== null && o.amountMinor < o.floorMinor ? "auto_decline" : "send" }
}

export type DealState = { status: DealStatus; amountMinor: bigint; counterMinor: bigint | null; priceMinor: bigint; respondBy: Date | null }

export type DealAction =
  | { by: "seller"; type: "accept" }
  | { by: "seller"; type: "counter"; amountMinor: bigint }
  | { by: "seller"; type: "decline" }
  | { by: "buyer"; type: "accept" }
  | { by: "buyer"; type: "decline" }
  | { by: "buyer"; type: "withdraw" }
  | { by: "system"; type: "expire" }

export type DealStep = { status: DealStatus; respondBy: Date | null; counterMinor?: bigint | null; agreedMinor?: bigint; validUntil?: Date; note: string }

const later = (now: Date, h: number) => new Date(now.getTime() + h * 3_600_000)

export function nextDealStep(s: DealState, a: DealAction, now: Date, policy: DealPolicy = DEFAULT_DEAL_POLICY): DealStep {
  const moved = () => new DealRuleError("This offer has already moved on. Refresh to see where it stands.")
  if (a.by === "system") {
    if (!s.respondBy || s.respondBy.getTime() > now.getTime() || !OPEN_DEAL_STATUSES.includes(s.status)) throw moved()
    return { status: "expired", respondBy: null, note: s.status === "pending" ? "The seller didn't answer in time" : "The buyer didn't answer in time" }
  }
  if (a.by === "seller") {
    if (s.status !== "pending") throw moved()
    if (a.type === "accept") return { status: "accepted", respondBy: null, agreedMinor: s.amountMinor, validUntil: later(now, policy.validHours), note: "Seller accepted" }
    if (a.type === "decline") return { status: "declined", respondBy: null, note: "Seller declined" }
    if (a.amountMinor <= s.amountMinor) throw new DealRuleError("A counter-offer must be above the buyer's offer — or accept it.")
    if (a.amountMinor >= s.priceMinor) throw new DealRuleError("A counter-offer must be below your listed price.")
    return { status: "countered", respondBy: later(now, policy.buyerReplyHours), counterMinor: a.amountMinor, note: "Seller countered" }
  }
  if (a.type === "withdraw") {
    if (!OPEN_DEAL_STATUSES.includes(s.status)) throw moved()
    return { status: "withdrawn", respondBy: null, note: "Buyer withdrew the offer" }
  }
  if (s.status !== "countered" || s.counterMinor === null) throw moved()
  if (a.type === "decline") return { status: "declined", respondBy: null, note: "Buyer declined the counter-offer" }
  return { status: "accepted", respondBy: null, agreedMinor: s.counterMinor, validUntil: later(now, policy.validHours), note: "Buyer accepted the counter-offer" }
}

/** The price to charge at checkout, when this accepted deal fits the cart line exactly. */
export function dealPriceFor(
  d: { status: DealStatus; agreedMinor: bigint | null; validUntil: Date | null; qty: number; buyerUserId: string; offerId: string },
  line: { buyerUserId: string | null; offerId: string; qty: number },
  now: Date,
): bigint | null {
  if (d.status !== "accepted" || d.agreedMinor === null || !d.validUntil) return null
  if (d.validUntil.getTime() <= now.getTime()) return null
  if (!line.buyerUserId || line.buyerUserId !== d.buyerUserId || line.offerId !== d.offerId || line.qty !== d.qty) return null
  return d.agreedMinor
}
